import React, { useEffect, useState, useMemo } from "react";
import ReactDOM from "react-dom";
import { Wallet, Loader2, Plus, Trash2 } from "lucide-react";
import binanceLogo from "../assets/binance.webp";
import { useTheme, BRAND_GRADIENT } from "./ThemeContext";
import { useLanguage } from "../i18n/useLanguage";
import {
  listBrokerAccounts, upsertBrokerAccount, deleteBrokerAccount,
  testBrokerAccount, setBrokerTrading, ackRealRisk, setBrokerAutoExecute, getPromotionGate,
  getBrokerBalance,
  previewBrokerOrder, placeBrokerOrder, getBrokerQuote,
  testBinanceAccount, getBinanceBalance,
} from "./alphaApi";
import { brokerCache } from "./brokerCache";
import BrokerRegisterModal from "./BrokerRegisterModal";

/**
 * 계좌 페이지 — KIS(한국투자증권) + Binance 모의/실전 동시 등록·관리.
 *
 * 흐름:
 *  1. 상단 탭으로 브로커 선택 (KIS | BINANCE)
 *  2. 환경 탭으로 MOCK / REAL 선택
 *  3. 미등록이면 등록 폼, 등록되어 있으면 상태 + 잔고 + 주문 UI
 *  4. 모든 broker API 호출은 ?env=MOCK|REAL 파라미터 동반
 */
export default function AccountPage({ extraTabs = [], pageTitle } = {}) {
  const { theme: rawTheme } = useTheme();
  const { t } = useLanguage();
  const theme = useMemo(() => ({
    ...rawTheme,
    card: rawTheme.panel,
    border: rawTheme.panelBorder,
    subtle: rawTheme.textMuted,
  }), [rawTheme]);

  const [brokerType, setBrokerType] = useState("KIS"); // "KIS" | "BINANCE"
  const [env, setEnv] = useState("MOCK");
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [registerOpen, setRegisterOpen] = useState(false);

  // 현재 선택된 브로커+환경에 해당하는 계좌
  const acct = useMemo(
    () => accounts.find(a => a.brokerType === brokerType && a.env === env) || null,
    [accounts, brokerType, env]
  );

  const reload = async () => {
    // 캐시된 계좌 목록이 있으면 즉시 표시 (loading 상태 스킵)
    const cached = brokerCache.getAccounts();
    if (cached) {
      setAccounts(cached);
      setLoading(false);
    }
    try {
      const list = await listBrokerAccounts();
      const arr = Array.isArray(list) ? list : [];
      brokerCache.setAccounts(arr);
      setAccounts(arr);
    } catch (e) {
      if (!cached) setMsg({ type: "err", text: t("account.loadFailed", { err: e?.response?.data?.error || e.message }) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  return (
    <div className="alpha-account" style={{ padding: "clamp(16px, 3vw, 36px) clamp(12px, 3vw, 40px) 80px", background: "#F8FAFC", minHeight: "calc(100vh - 44px)" }}>
      <style>{`
        @media (max-width: 1024px) {
          .alpha-account .broker-tabs button { flex: 1 1 200px; }
          .alpha-account .stat-grid { grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)) !important; }
        }
        @media (max-width: 768px) {
          .alpha-account { padding: 12px 10px !important; }
          .alpha-account h1 { font-size: 22px !important; }
          .alpha-account .broker-tabs, .alpha-account .env-tabs { flex-wrap: wrap; }
          .alpha-account .broker-tabs button, .alpha-account .env-tabs button { flex: 1 1 45%; min-width: 0; padding: 10px 12px !important; font-size: 13px !important; }
          .alpha-account .info-row { flex-direction: column !important; align-items: flex-start !important; gap: 8px !important; }
          .alpha-account .action-row { flex-wrap: wrap; gap: 8px !important; }
          .alpha-account .action-row button { flex: 1 1 calc(50% - 4px); min-height: 44px; }
          .alpha-account input, .alpha-account select, .alpha-account textarea { font-size: 16px !important; }
          .alpha-account .stat-grid { grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)) !important; }
        }
      `}</style>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{
            width: 54, height: 54, borderRadius: 17, flexShrink: 0,
            background: "linear-gradient(135deg,#60a5fa 0%,#6366f1 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 6px 20px rgba(99,102,241,0.32)",
          }}>
            <Wallet size={24} color="white" strokeWidth={2.2} />
          </div>
          <div>
            <h1 style={{
              margin: 0, fontSize: 26, fontWeight: 800, lineHeight: 1.15,
              background: "linear-gradient(90deg,#3b82f6 0%,#6366f1 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>{pageTitle || t("account.title")}</h1>
            <p style={{ margin: "5px 0 0", fontSize: 13, color: "#64748B", fontWeight: 500 }}>
              {t("account.subtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* 브로커 탭 + 컨텐츠 패널 (브라우저 탭처럼 하나로 묶임) */}
      <div className="broker-tabs" style={{ display: "flex", gap: 4, marginBottom: 0 }}>
        {[
          { id: "KIS",     label: t("account.brokers.KIS.label"),     sub: t("account.brokers.KIS.sub"),     icon: <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}><img src="https://www.google.com/s2/favicons?domain=truefriend.com&sz=64" alt="KIS" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>,  accent: "linear-gradient(135deg,#60a5fa,#6366f1)" },
          { id: "BINANCE", label: t("account.brokers.BINANCE.label"), sub: t("account.brokers.BINANCE.sub"), icon: <img src={binanceLogo} alt="Binance.US" style={{ width: 32, height: 32, objectFit: "contain" }} />, accent: "linear-gradient(135deg,#fbbf24,#f59e0b)" },
          ...extraTabs,
        ].map(({ id, label, sub, icon, accent }) => {
          const active = brokerType === id;
          const hasAny = accounts.some(a => a.brokerType === id);
          return (
            <button key={id} onClick={() => { setBrokerType(id); setMsg(null); }}
              style={{
                flex: "0 1 320px", padding: "14px 18px",
                borderTopLeftRadius: 14, borderTopRightRadius: 14,
                borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
                cursor: "pointer",
                background: active ? "white" : "rgba(241,245,249,0.7)",
                border: "1px solid #E2E8F0",
                borderBottom: active ? "1px solid white" : "1px solid #E2E8F0",
                marginBottom: -1,
                boxShadow: active ? "0 -2px 8px rgba(15,23,42,0.04)" : "none",
                display: "flex", alignItems: "center", gap: 12, textAlign: "left",
                position: "relative", zIndex: active ? 2 : 1,
                transition: "background 0.15s",
              }}>
              <div style={{
                flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{icon}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 14.5, fontWeight: 800,
                  color: active ? "#0f172a" : "#64748B",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  {label}
                  {hasAny && (
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      padding: "2px 7px", borderRadius: 99,
                      background: "#DCFCE7", color: "#15803D",
                    }}>● {t("account.registered")}</span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: active ? "#64748B" : "#94A3B8", marginTop: 2, fontWeight: 500 }}>
                  {sub}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 브로커 탭 컨텐츠 패널 */}
      <div style={{
        background: "white",
        border: "1px solid #E2E8F0",
        borderRadius: 16,
        borderTopLeftRadius: brokerType === "KIS" ? 0 : 16,
        padding: "22px 24px 26px",
        boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
        position: "relative", zIndex: 1,
      }}>

      {extraTabs.find(tb => tb.id === brokerType) ? (
        extraTabs.find(tb => tb.id === brokerType).node
      ) : (<>
      {/* 환경 탭 */}
      <div className="env-tabs" style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {["MOCK", "REAL"].map(e => {
          const active = env === e;
          const has = accounts.some(a => a.brokerType === brokerType && a.env === e);
          return (
            <button key={e} onClick={() => { setEnv(e); setMsg(null); }}
              style={{
                padding: "10px 18px", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer",
                background: active
                  ? (e === "REAL" ? "linear-gradient(135deg,#ef4444,#dc2626)" : "linear-gradient(135deg,#60a5fa,#3b82f6)")
                  : "#F8FAFC",
                color: active ? "white" : theme.text,
                border: `1px solid ${active ? "transparent" : theme.border}`,
              }}>
              {e === "MOCK" ? t("account.envMock") : t("account.envLive")} {has && <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.85 }}>● {t("account.registered")}</span>}
            </button>
          );
        })}
      </div>

      {msg && (
        <div style={{
          padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13,
          background: msg.type === "err" ? "#FEE2E2" : "#DCFCE7",
          color: msg.type === "err" ? "#991B1B" : "#166534",
        }}>{msg.text}</div>
      )}

      {loading ? <div style={{ color: theme.subtle }}>{t("account.loading")}</div>
        : acct
          ? (brokerType === "BINANCE"
              ? <BinanceActive key={`${brokerType}-${env}`} theme={theme} env={env} acct={acct} reload={reload} setMsg={setMsg} />
              : <AccountActive key={`${brokerType}-${env}`} theme={theme} env={env} acct={acct} reload={reload} setMsg={setMsg} />)
          : <RegisterEmptyState brokerType={brokerType} env={env} onOpen={() => { setMsg(null); setRegisterOpen(true); }} />}
      </>)}
      </div>

      <BrokerRegisterModal
        open={registerOpen}
        brokerType={brokerType}
        env={env}
        accounts={accounts}
        onSuccess={() => { reload(); setMsg({ type: "ok", text: t("account.registerSuccess") }); }}
        onClose={() => setRegisterOpen(false)}
      />
    </div>
  );
}

/* ───────────────────────────────────────────── 등록 폼 (레거시 — 미사용) */
function AccountRegister({ theme, env, accounts = [], reload, setMsg }) {
  const [form, setForm] = useState({
    appKey: "", appSecret: "", cano: "", acntPrdtCd: "01",
    maxOrderUsd: env === "REAL" ? 100 : 1000,
    dailyOrderUsd: env === "REAL" ? 500 : 5000,
    // KIS 전용 — 1일 누적 매수/매도 한도 (원화). 기본값: 실전 1천만/3천만, 모의 5천만/3억.
    dailyBuyKrw:  env === "REAL" ? 10_000_000  : 50_000_000,
    dailySellKrw: env === "REAL" ? 30_000_000  : 300_000_000,
  });
  const [saving, setSaving] = useState(false);

  // 다른 환경에 이미 등록된 계좌(있다면) — 키 중복 차단용
  const otherEnv = env === "MOCK" ? "REAL" : "MOCK";
  const otherAcct = accounts.find(a => a.env === otherEnv) || null;

  const submit = async (e) => {
    e.preventDefault();
    // 입력값 정화 — 양 끝 공백/줄바꿈/zero-width 제거
    const cleanKey = (form.appKey || "").replace(/[\s\u200B\u00A0]/g, "");
    const cleanSecret = (form.appSecret || "").replace(/[\s\u200B\u00A0]/g, "");
    if (cleanKey.length < 20) {
      setMsg({ type: "err", text: `App Key가 너무 짧습니다 (${cleanKey.length}자). 정상 키는 36자입니다.` });
      return;
    }
    if (cleanSecret.length < 100) {
      setMsg({ type: "err", text: `App Secret이 너무 짧습니다 (${cleanSecret.length}자). 정상 시크릿은 180자+ 입니다.` });
      return;
    }
    // ⚠ MOCK/REAL 동일 키 차단 — KIS는 환경별 별도 키쌍을 발급함
    if (otherAcct?.appKeyMasked) {
      const masked = otherAcct.appKeyMasked; // 예: "PSji9T...cbl3"
      const m = masked.match(/^(.{4,8}).*?(.{3,5})$/);
      if (m && cleanKey.startsWith(m[1]) && cleanKey.endsWith(m[2])) {
        setMsg({ type: "err", text: `❌ 입력한 키가 ${otherEnv} 환경에 이미 등록된 키와 같습니다 (${masked}). KIS는 모의/실전이 별도 키쌍을 발급합니다. ${env === "MOCK" ? "모의투자" : "실전"}용 키를 KIS 개발자센터에서 다시 발급/복사해 주세요.` });
        return;
      }
    }
    // 사용자에게 마지막 확인 — 키 앞/뒤 + 설정 환경 표시
    const envLabel = env === "MOCK" ? "모의투자" : "실전투자";
    const ok = window.confirm(
      `[${envLabel}] 계좌로 등록합니다. 아래 값이 맞나요?\n\n` +
      `• App Key:    ${cleanKey.slice(0, 6)} … ${cleanKey.slice(-5)}  (전체 ${cleanKey.length}자)\n` +
      `• App Secret: ∗∗∗∗ 알 수 없음 ∗∗∗∗  (전체 ${cleanSecret.length}자)\n` +
      `• CANO:       ${form.cano}\n` +
      `• 상품코드:    ${form.acntPrdtCd}\n\n` +
      `→ ${envLabel} 용 키쌍이 맞으면 [확인], 아니면 [취소] 후 다시 입력하세요.`
    );
    if (!ok) return;
    setSaving(true); setMsg(null);
    try {
      await upsertBrokerAccount({ ...form, appKey: cleanKey, appSecret: cleanSecret, env });
      setMsg({ type: "ok", text: `${env} 계좌 등록 완료. 아래에서 연결 테스트를 진행하세요.` });
      reload();
    } catch (err) {
      setMsg({ type: "err", text: "등록 실패: " + (err?.response?.data?.error || err.message) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card theme={theme}>
      <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>
        {env === "MOCK" ? "🧪 모의투자 계좌 등록" : "💰 실전투자 계좌 등록"}
      </h2>
      {env === "REAL" && (
        <div style={{ background: "#FEF3C7", color: "#92400E", padding: 10, borderRadius: 6, fontSize: 12, marginBottom: 14 }}>
          ⚠️ 실전계좌는 진짜 돈이 움직입니다. 1회·일일 한도를 작게 설정하고 매매 스위치는 OFF로 시작하세요.
        </div>
      )}
      <form onSubmit={submit} autoComplete="off" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* 브라우저 자동완성 후킹 와전 차단: hidden dummy fields */}
        <input type="text" name="username" autoComplete="username" style={{ display: "none" }} />
        <input type="password" name="password" autoComplete="current-password" style={{ display: "none" }} />
        <Field label={`App Key (${env === "MOCK" ? "모의" : "실전"}용, 36자)`} col={2}>
          <input style={inp(theme)} value={form.appKey} name={`appkey-${env}`}
            autoComplete="off" spellCheck="false" autoCorrect="off"
            placeholder={env === "MOCK" ? "PSKey... 으로 시작하는 모의 키" : "PS... 으로 시작하는 실전 키"}
            onChange={e => setForm(f => ({ ...f, appKey: e.target.value }))} required />
        </Field>
        <Field label={`App Secret (${env === "MOCK" ? "모의" : "실전"}용, 180자+)`} col={2}>
          <input type="text" style={inp(theme)}
            value={form.appSecret} name={`appsecret-${env}`}
            autoComplete="off" spellCheck="false" autoCorrect="off"
            placeholder="KIS에서 복사한 App Secret 전체를 붙여넣으세요"
            onChange={e => setForm(f => ({ ...f, appSecret: e.target.value }))} required />
        </Field>
        <Field label="종합계좌번호 (CANO)">
          <input style={inp(theme)} value={form.cano}
            onChange={e => setForm(f => ({ ...f, cano: e.target.value }))} placeholder="46953079" required />
        </Field>
        <Field label="상품코드">
          <input style={inp(theme)} value={form.acntPrdtCd}
            onChange={e => setForm(f => ({ ...f, acntPrdtCd: e.target.value }))} placeholder="01" required />
        </Field>
        <Field label="1회 최대 주문 (USD)">
          <input type="number" min="0" style={inp(theme)} value={form.maxOrderUsd}
            onChange={e => setForm(f => ({ ...f, maxOrderUsd: Number(e.target.value) }))} />
        </Field>
        <Field label="일일 누적 한도 (USD) — Binance 호환">
          <input type="number" min="0" style={inp(theme)} value={form.dailyOrderUsd}
            onChange={e => setForm(f => ({ ...f, dailyOrderUsd: Number(e.target.value) }))} />
        </Field>
        <Field label="매수 1일 누적 한도 (원화)">
          <input type="number" min="0" step="1000000" style={inp(theme)} value={form.dailyBuyKrw}
            onChange={e => setForm(f => ({ ...f, dailyBuyKrw: Number(e.target.value) }))} />
        </Field>
        <Field label="매도 1일 누적 한도 (원화)">
          <input type="number" min="0" step="1000000" style={inp(theme)} value={form.dailySellKrw}
            onChange={e => setForm(f => ({ ...f, dailySellKrw: Number(e.target.value) }))} />
        </Field>
        <div style={{ gridColumn: "1 / -1", marginTop: 6 }}>
          <button type="submit" disabled={saving} style={btnPrimary}>
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </Card>
  );
}

/* ───────────────────────────────────────────── 활성 계좌 */
function AccountActive({ theme, env, acct, reload, setMsg }) {
  const { t } = useLanguage();
  // 캐시 hit 시 즉시 표시 (null 초기화 없음)
  const [balance, setBalance] = useState(() => brokerCache.getBalance(env, "KIS"));
  const [limitInKrw, setLimitInKrw] = useState(true);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [gate, setGate] = useState(null); // { passed, summary, checks } — REAL 계정에만 로드
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const refresh = async ({ silent = false } = {}) => {
    if (!silent) setRefreshing(true);
    try {
      const b = await getBrokerBalance(env).catch(() => null);
      if (b) { brokerCache.setBalance(env, "KIS", b); setBalance(b); }
    } catch {}
    finally { setRefreshing(false); }
  };

  useEffect(() => {
    const cachedBal = brokerCache.getBalance(env, "KIS");
    setBalance(cachedBal ?? null);
    if (acct.lastVerifiedAt) refresh({ silent: !!cachedBal });
  }, [env, acct.id, acct.lastVerifiedAt]);

  // REAL 계정 선택 시 승격 게이트 현황 자동 로드
  useEffect(() => {
    if (env !== "REAL") { setGate(null); return; }
    getPromotionGate(env).then(setGate).catch(() => setGate(null));
  }, [env, acct.id, acct.tradingEnabled, acct.lastVerifiedAt]);

  const doTest = async () => {
    setBusy(true); setTesting(true); setMsg(null);
    try {
      const res = await testBrokerAccount(env);
      setMsg({ type: "ok", text: t("account.testSuccess", { usd: Number(res.cash_usd || 0).toFixed(2), krw: Number(res.cash_krw || 0).toLocaleString() }) });
      // test 응답이 이미 balance 데이터를 전부 가지고 있으니 그대로 박는다.
      // (별도 refresh() 호출은 또 KIS 4종을 부르므로 EGW00201 재발 위험)
      const newBal = {
        cash_usd: res.cash_usd,
        cash_krw: res.cash_krw,
        positions: res.positions || [],
        total_market_value_usd: res.total_market_value_usd || 0,
      };
      brokerCache.setBalance(env, "KIS", newBal);
      setBalance(newBal);
      brokerCache.invalidateAll(); // lastVerifiedAt 등 계좌 메타 갱신 유도
      reload();
    } catch (e) {
      const status = e?.response?.status;
      const data = e?.response?.data || {};
      // 서버 암호화 키 변경/불일치 → 재등록 안내 + 원클릭 삭제
      if (status === 409 && data.requireReregister) {
        if (window.confirm(t("account.reRegisterConfirm"))) {
          try {
            await deleteBrokerAccount(env);
            reload();
            setMsg({ type: "ok", text: t("account.reRegisterSuccess") });
          } catch (de) {
            setMsg({ type: "err", text: t("account.reRegisterFailed", { err: de?.response?.data?.error || de.message }) });
          }
        } else {
          setMsg({ type: "err", text: data.error || t("account.cryptoKeyError") });
        }
      } else {
        setMsg({ type: "err", text: t("account.testFailed", { err: data.error || e.message }) });
      }
    } finally { setBusy(false); setTesting(false); }
  };
  const doToggleTrading = async () => {
    setBusy(true); setMsg(null);
    try {
      await setBrokerTrading(env, !acct.tradingEnabled);
      reload();
    } catch (e) {
      const data = e?.response?.data;
      // 책임고지 동의 필요 → confirm 후 /ack-risk 호출 → 재시도
      if (data?.needAck) {
        setBusy(false);
        const agreed = window.confirm(t("account.ackConfirm"));
        if (!agreed) return;
        setBusy(true);
        try {
          await ackRealRisk(env);
          await setBrokerTrading(env, true);
          reload();
        } catch (e2) {
          const d2 = e2?.response?.data;
          setMsg({ type: "err", text: t("account.tradingFailed", { err: d2?.error || e2.message }) });
        } finally { setBusy(false); }
        return;
      }
      if (data?.checks) {
        setGate({ passed: false, summary: data.summary, checks: data.checks });
        setMsg({ type: "err", text: t("account.tradingGateFailed") });
      } else {
        setMsg({ type: "err", text: t("account.tradingFailed", { err: data?.error || e.message }) });
      }
    } finally { setBusy(false); }
  };
  const doToggleAutoExecute = async () => {
    const turningOn = !acct.autoExecute;
    if (turningOn && env === "REAL" && !confirm(t("account.autoExecuteConfirm"))) return;
    setBusy(true); setMsg(null);
    try {
      await setBrokerAutoExecute(env, turningOn);
      setMsg({ type: "ok", text: turningOn ? t("account.autoExecuteOnMsg") : t("account.autoExecuteOffMsg") });
      reload();
    } catch (e) {
      const data = e?.response?.data;
      // REAL 졸업 게이트 미충족 → summary 안내
      if (data?.summary && data?.requiredTrades) {
        setMsg({ type: "err", text: t("account.autoExecuteGateFailed", { summary: data.summary }) });
      } else {
        setMsg({ type: "err", text: t("account.autoExecuteFailed", { err: data?.error || e.message }) });
      }
    } finally { setBusy(false); }
  };
  const doDelete = () => setDeleteConfirm(true);
  const doDeleteConfirm = async () => {
    setDeleteConfirm(false);
    setBusy(true);
    try { await deleteBrokerAccount(env); reload(); }
    catch (e) { setMsg({ type: "err", text: t("account.deleteFailed", { err: e?.response?.data?.error || e.message }) }); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* 상태 카드 */}
      <Card theme={theme}>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
          <CurrencyToggle krw={limitInKrw} onChange={setLimitInKrw} />
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 16 }}>
          <tbody>
            {[
              { label: t("account.stat.env"),          value: env === "REAL" ? t("account.statEnvLive") : t("account.statEnvMock"), tone: env === "REAL" ? "warn" : "info" },
              { label: t("account.stat.accountNo"),    value: `${acct.cano}-${acct.acntPrdtCd}` },
              { label: t("account.stat.appKey"),       value: acct.appKeyMasked },
              { label: t("account.stat.verified"),     value: acct.lastVerifiedAt ? new Date(acct.lastVerifiedAt).toLocaleString() : t("account.statUnverified"), tone: acct.lastVerifiedAt ? "ok" : "warn" },
              { label: t("account.stat.tradingSwitch"),value: acct.tradingEnabled ? "ON" : "OFF", tone: acct.tradingEnabled ? "ok" : "warn" },
              { label: t("account.stat.autoExecute"),  value: acct.autoExecute ? "ON" : "OFF", tone: acct.autoExecute ? (env === "REAL" ? "warn" : "ok") : "info" },
              { label: t("account.stat.singleLimit"),  value: limitInKrw
                  ? `₩${Number((acct.maxOrderUsd || 0) * 1400).toLocaleString()}`
                  : `$${Number(acct.maxOrderUsd || 0).toLocaleString()}` },
              { label: t("account.stat.dailyBuyLimit"), value: acct.dailyBuyKrw != null
                  ? (limitInKrw ? `₩${Number(acct.dailyBuyKrw).toLocaleString()}` : `$${Math.round(Number(acct.dailyBuyKrw) / 1400).toLocaleString()}`)
                  : t("account.statUnlimited") },
              { label: t("account.stat.dailySellLimit"), value: acct.dailySellKrw != null
                  ? (limitInKrw ? `₩${Number(acct.dailySellKrw).toLocaleString()}` : `$${Math.round(Number(acct.dailySellKrw) / 1400).toLocaleString()}`)
                  : t("account.statUnlimited") },
            ].map(({ label, value, tone }, i) => {
              const vc = tone === "ok" ? "#16a34a" : tone === "warn" ? "#d97706" : tone === "info" ? "#3b82f6" : theme.text;
              const bg = i % 2 === 0 ? "transparent" : (theme.isDark ? "rgba(255,255,255,0.03)" : "#F8FAFC");
              return (
                <tr key={label} style={{ background: bg }}>
                  <td style={{ padding: "9px 14px", fontSize: 12, color: theme.subtle, fontWeight: 500, width: "38%", borderBottom: `1px solid ${theme.border}` }}>{label}</td>
                  <td style={{ padding: "9px 14px", color: vc, fontWeight: 700, borderBottom: `1px solid ${theme.border}`, fontFamily: "monospace", fontSize: 13 }}>{value}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="action-row" style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button onClick={doTest} disabled={busy} style={{
            ...btnSecondary,
            display: "inline-flex", alignItems: "center", gap: 6,
            ...(testing ? { opacity: 0.75, cursor: "wait" } : {}),
          }}>
            {testing
              ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />{t("account.testing")}</>
              : t("account.testBtn")}
          </button>
          <button onClick={doToggleTrading} disabled={busy || !acct.lastVerifiedAt}
            style={acct.tradingEnabled ? btnDanger : btnPrimary}>
            {acct.tradingEnabled ? t("account.tradingOff") : t("account.tradingOn")}
          </button>
          <button onClick={doToggleAutoExecute} disabled={busy || !acct.tradingEnabled}
            style={acct.autoExecute ? btnDanger : btnSecondary}>
            {acct.autoExecute ? t("account.autoExecuteOff") : t("account.autoExecuteOn")}
          </button>
          <button onClick={doDelete} disabled={busy} style={btnDefault}>{t("account.deleteBtn")}</button>
        </div>
      </Card>

      {/* MOCK\u2192REAL \uc2b9\uaca9 \uac8c\uc774\ud2b8 (REAL \uacc4\uc815\uc5d0\ub9cc \ud45c\uc2dc) */}
      {env === "REAL" && gate && (
        <Card theme={theme}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
            {gate.passed ? t("account.gatePassedTitle") : t("account.gatePendingTitle")}
          </h3>
          <p style={{ fontSize: 12, color: theme.subtle, marginTop: 0, marginBottom: 12, lineHeight: 1.6 }}>
            {gate.summary}
          </p>
          <div style={{ display: "grid", gap: 6 }}>
            {(gate.checks || []).map((c) => (
              <div key={c.key} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px", borderRadius: 8,
                background: c.ok ? "#ECFDF5" : "#FEF2F2",
                border: `1px solid ${c.ok ? "#A7F3D0" : "#FECACA"}`,
              }}>
                <span style={{ fontSize: 16 }}>{c.ok ? "✓" : "✗"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: c.ok ? "#065F46" : "#991B1B" }}>
                    {c.label}
                  </div>
                  <div style={{ fontSize: 12, color: c.ok ? "#047857" : "#B91C1C", marginTop: 2 }}>
                    {c.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 잔고 */}
      <Card theme={theme}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
            {t("account.balanceSectionTitle")}
            {refreshing && <span style={{ marginLeft: 8, fontSize: 11, color: "#94A3B8", fontWeight: 500 }}>{t("account.balanceRefreshing")}</span>}
          </h3>
          <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 999,
              background: "linear-gradient(135deg,#ecfdf5 0%,#d1fae5 100%)",
              border: "1px solid #6ee7b7", color: "#065f46",
              fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
            }}>
            {t("account.collateralBadge")}
          </div>
        </div>
        {!balance ? <div style={{ color: theme.subtle, fontSize: 13 }}>{t("account.balanceNotLoaded")}</div> : (
          <>
            <div style={{ fontSize: 13, color: theme.subtle, marginBottom: 8 }}>
              {t("account.cashUsd")} <b style={{ color: theme.text }}>${Number(balance.cash_usd || 0).toFixed(2)}</b>
              {" · "}{t("account.cashKrw")} <b style={{ color: theme.text }}>₩{Number(balance.cash_krw || 0).toLocaleString()}</b>
              {" · "}{t("account.totalValue")} <b style={{ color: theme.text }}>${Number(balance.total_market_value_usd || 0).toFixed(2)}</b>
            </div>
            {(balance.positions || []).length === 0 ? (
              <div style={{ color: theme.subtle, fontSize: 13 }}>{t("account.noPositions")}</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                <thead><tr style={{ color: theme.subtle, textAlign: "left" }}>
                  <th style={th}>{t("account.colTicker")}</th><th style={th}>{t("account.colQty")}</th><th style={th}>{t("account.colAvg")}</th>
                  <th style={th}>{t("account.colValue")}</th><th style={th}>{t("account.colPnL")}</th>
                </tr></thead>
                <tbody>
                  {balance.positions.map((p, i) => {
                    const isKrw = p.currency === "KRW";
                    const curr = isKrw ? "₩" : "$";
                    const pnl = Number(p.unrealized_pnl || 0);
                    const avg = Number(p.avg_price);
                    const qty = Number(p.qty);
                    // 평가금액: 백엔드 market_value 우선, 없으면 수량×평단으로 추정(0원/NaN 표시 방지)
                    let mv = Number(p.market_value);
                    if (!Number.isFinite(mv) || mv === 0) {
                      mv = (Number.isFinite(qty) && Number.isFinite(avg)) ? qty * avg + pnl : NaN;
                    }
                    const fmtPrice = (v) => Number.isFinite(v)
                      ? isKrw ? `₩${v.toLocaleString("ko-KR")}` : `$${v.toFixed(2)}`
                      : "—";
                    const fmtPnl = (v) => isKrw
                      ? `${v >= 0 ? "+" : ""}₩${Math.round(v).toLocaleString("ko-KR")}`
                      : `${v >= 0 ? "+" : ""}$${v.toFixed(2)}`;
                    // 종목명(코드) 표시: 국내주식은 "삼성전자(005930)", 미국주식은 "AAPL" 또는 "Apple Inc.(AAPL)"
                    const nameLabel = p.name ? `${p.name}(${p.ticker})` : p.ticker;
                    return (
                      <tr key={i} style={{ borderTop: `1px solid ${theme.border}` }}>
                        <td style={td}>{nameLabel}</td>
                        <td style={td}>{p.qty}</td>
                        <td style={td}>{fmtPrice(avg)}</td>
                        <td style={td}>{fmtPrice(mv)}</td>
                        <td style={{ ...td, color: pnl >= 0 ? "#16a34a" : "#dc2626", fontWeight: 700 }}>
                          {fmtPnl(pnl)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </>
        )}
      </Card>

      <DeleteAccountModal
        open={deleteConfirm}
        brokerName="KIS"
        envLabel={env === "REAL" ? t("account.liveInvest") : t("account.mockInvest")}
        onConfirm={doDeleteConfirm}
        onClose={() => setDeleteConfirm(false)}
      />
    </div>
  );
}

/* ───────────────────────────────────────────── 공통 UI */
function Card({ children, theme }) {
  return <div style={{
    background: theme.card, border: `1px solid ${theme.border}`,
    borderRadius: 12, padding: 18,
  }}>{children}</div>;
}
function Field({ label, children, col }) {
  return <label style={{ display: "block", gridColumn: col ? `span ${col}` : undefined }}>
    <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, opacity: 0.7 }}>{label}</div>
    {children}
  </label>;
}
function CurrencyToggle({ krw, onChange }) {
  return (
    <div onClick={() => onChange(!krw)} style={{
      display: "inline-flex", alignItems: "center",
      background: "#F1F5F9", borderRadius: 99, padding: 3,
      cursor: "pointer", border: "1px solid #E2E8F0", userSelect: "none",
    }}>
      <span style={{
        padding: "4px 11px", borderRadius: 99, fontSize: 11, fontWeight: 700,
        transition: "background 0.18s, color 0.18s, box-shadow 0.18s",
        background: krw ? "white" : "transparent",
        color: krw ? "#4338CA" : "#94A3B8",
        boxShadow: krw ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
      }}>₩ 원화</span>
      <span style={{
        padding: "4px 11px", borderRadius: 99, fontSize: 11, fontWeight: 700,
        transition: "background 0.18s, color 0.18s, box-shadow 0.18s",
        background: !krw ? "white" : "transparent",
        color: !krw ? "#B45309" : "#94A3B8",
        boxShadow: !krw ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
      }}>$ USD</span>
    </div>
  );
}
function Stat({ label, value, tone, theme }) {
  const c = tone === "ok" ? "#16a34a" : tone === "warn" ? "#d97706" : tone === "info" ? "#3b82f6" : theme.text;
  return <div>
    <div style={{ fontSize: 10, color: theme.subtle, marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 13, fontWeight: 700, color: c }}>{value}</div>
  </div>;
}

const inp = (theme) => ({
  width: "100%", boxSizing: "border-box",
  padding: "8px 10px", borderRadius: 6,
  border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text, fontSize: 13,
});
const th = { padding: "6px 8px", fontWeight: 600, fontSize: 11, textTransform: "uppercase" };
const td = { padding: "6px 8px" };
const btnPrimary = {
  padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13,
  background: "linear-gradient(135deg,#60a5fa 0%,#3b82f6 50%,#6366f1 100%)", color: "white",
};
const btnSecondary = {
  padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13,
  background: "#DBEAFE", color: "#1e3a5f",
};
const btnDanger = {
  padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13,
  background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "white",
};
const btnDefault = {
  padding: "8px 14px", borderRadius: 8, border: "1px solid #E5E7EB", cursor: "pointer", fontWeight: 600, fontSize: 13,
  background: "#ffffff", color: "#374151",
};

/* ─────────────────────────────── Binance 등록 폼 */
function BinanceRegister({ theme, env, reload, setMsg }) {
  const [form, setForm] = useState({
    binanceApiKey: "", binanceApiSecret: "",
    binanceMode: "SPOT",
    maxOrderUsd: env === "REAL" ? 200 : 2000,
    dailyOrderUsd: env === "REAL" ? 1000 : 10000,
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const cleanKey = (form.binanceApiKey || "").replace(/[\s\u200B\u00A0]/g, "");
    const cleanSecret = (form.binanceApiSecret || "").replace(/[\s\u200B\u00A0]/g, "");
    if (cleanKey.length < 20) {
      setMsg({ type: "err", text: `API Key가 너무 짧습니다 (${cleanKey.length}자). Binance에서 발급한 키를 확인해 주세요.` });
      return;
    }
    if (cleanSecret.length < 20) {
      setMsg({ type: "err", text: `API Secret이 너무 짧습니다 (${cleanSecret.length}자).` });
      return;
    }
    const envLabel = env === "MOCK" ? "테스트넷" : "메인넷";
    if (!window.confirm(
      `[${envLabel}] Binance 계정으로 등록합니다.\n\n` +
      `• API Key: ${cleanKey.slice(0, 6)} … ${cleanKey.slice(-5)} (${cleanKey.length}자)\n` +
      `• Mode: ${form.binanceMode}\n\n` +
      `${env === "REAL" ? "⚠️ 실전 계정입니다. API 권한이 최소한으로 설정되었는지 확인하세요." : ""}\n\n` +
      `계속하시겠습니까?`
    )) return;

    setSaving(true); setMsg(null);
    try {
      await upsertBrokerAccount({
        brokerType: "BINANCE", env,
        binanceApiKey: cleanKey, binanceApiSecret: cleanSecret,
        binanceMode: form.binanceMode,
        maxOrderUsd: form.maxOrderUsd, dailyOrderUsd: form.dailyOrderUsd,
      });
      setMsg({ type: "ok", text: `Binance ${envLabel} 계정 등록 완료. 연결 테스트를 진행하세요.` });
      reload();
    } catch (err) {
      setMsg({ type: "err", text: "등록 실패: " + (err?.response?.data?.error || err.message) });
    } finally { setSaving(false); }
  };

  return (
    <Card theme={theme}>
      <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>
        {env === "MOCK" ? "🧪 Binance 테스트넷 등록" : "🟡 Binance 메인넷 등록"}
      </h2>
      {env === "REAL" && (
        <div style={{ background: "#FEF3C7", color: "#92400E", padding: 10, borderRadius: 6, fontSize: 12, marginBottom: 14 }}>
          ⚠️ 실전 계정입니다. Binance API 키 생성 시 <strong>IP 화이트리스트</strong>를 반드시 설정하고,
          필요한 권한(스팟: Enable Spot & Margin / 선물: Enable Futures)만 최소로 부여하세요.
        </div>
      )}
      <form onSubmit={submit} autoComplete="off" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <input type="text" name="username" autoComplete="username" style={{ display: "none" }} />
        <input type="password" name="password" autoComplete="current-password" style={{ display: "none" }} />
        <Field label="API Key" col={2}>
          <input style={inp(theme)} value={form.binanceApiKey} name={`bnb-key-${env}`}
            autoComplete="off" spellCheck="false"
            placeholder="Binance API Key (64자)"
            onChange={e => setForm(f => ({ ...f, binanceApiKey: e.target.value }))} required />
        </Field>
        <Field label="API Secret" col={2}>
          <input type="text" style={inp(theme)}
            value={form.binanceApiSecret} name={`bnb-secret-${env}`}
            autoComplete="off" spellCheck="false"
            placeholder="Binance API Secret (64자)"
            onChange={e => setForm(f => ({ ...f, binanceApiSecret: e.target.value }))} required />
        </Field>
        <Field label="거래 모드">
          <select style={inp(theme)} value={form.binanceMode}
            onChange={e => setForm(f => ({ ...f, binanceMode: e.target.value }))}>
            <option value="SPOT">SPOT (현물)</option>
            <option value="FUTURES">FUTURES (선물)</option>
          </select>
        </Field>
        <Field label="" />
        <Field label="1회 최대 주문 (USD)">
          <input type="number" min="0" style={inp(theme)} value={form.maxOrderUsd}
            onChange={e => setForm(f => ({ ...f, maxOrderUsd: Number(e.target.value) }))} />
        </Field>
        <Field label="일일 누적 한도 (USD)">
          <input type="number" min="0" style={inp(theme)} value={form.dailyOrderUsd}
            onChange={e => setForm(f => ({ ...f, dailyOrderUsd: Number(e.target.value) }))} />
        </Field>
        <div style={{ gridColumn: "1 / -1", marginTop: 6 }}>
          <button type="submit" disabled={saving} style={btnPrimary}>
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </Card>
  );
}

/* ─────────────────────────────── 미등록 빈 상태 */
function RegisterEmptyState({ brokerType, env, onOpen }) {
  const { t } = useLanguage();
  const isMock = env === "MOCK";
  const isBinance = brokerType === "BINANCE";
  const grad = isMock
    ? "linear-gradient(135deg,#eff6ff 0%,#e0e7ff 100%)"
    : "linear-gradient(135deg,#fff1f2 0%,#ffe4e6 100%)";
  const iconGrad = isMock
    ? "linear-gradient(135deg,#60a5fa,#6366f1)"
    : "linear-gradient(135deg,#f87171,#dc2626)";
  const btnGrad = isMock
    ? "linear-gradient(135deg,#60a5fa 0%,#3b82f6 50%,#6366f1 100%)"
    : "linear-gradient(135deg,#f87171 0%,#dc2626 100%)";
  const envLabel = isMock ? (isBinance ? t("account.testnet") : t("account.mockInvest")) : (isBinance ? t("account.mainnet") : t("account.liveInvest"));

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "52px 24px", textAlign: "center", gap: 20,
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 22,
        background: grad, border: `2px solid ${isMock ? "#C7D2FE" : "#FECACA"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: iconGrad,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
        }}>
          {isBinance
            ? <img src={binanceLogo} alt="Binance" style={{ width: 28, height: 28, objectFit: "contain" }} />
            : <Wallet size={22} color="white" />}
        </div>
      </div>
      <div>
        <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 800, color: "#0F172A" }}>
          {t("account.emptyTitle", { broker: isBinance ? "Binance" : "KIS", env: envLabel })}
        </h3>
        <p style={{ margin: 0, fontSize: 13.5, color: "#64748B", lineHeight: 1.7, maxWidth: 340 }}>
          {isMock ? t("account.emptyMockDesc") : t("account.emptyLiveDesc")}
        </p>
      </div>
      <button onClick={onOpen} style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "13px 28px", borderRadius: 12, border: "none",
        background: btnGrad, color: "white",
        fontSize: 14, fontWeight: 700, cursor: "pointer",
        boxShadow: isMock ? "0 4px 16px rgba(99,102,241,0.35)" : "0 4px 16px rgba(220,38,38,0.35)",
        transition: "transform 0.15s, opacity 0.15s",
      }}
        onMouseEnter={e => { e.currentTarget.style.opacity = "0.9"; e.currentTarget.style.transform = "translateY(-1px)"; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "none"; }}
      >
        <Plus size={16} />
        {t("account.emptyRegisterBtn", { env: envLabel })}
      </button>
    </div>
  );
}

/* ─────────────────────────────── Binance 활성 계좌 */
function BinanceActive({ theme, env, acct, reload, setMsg }) {
  const { t } = useLanguage();
  const [balance, setBalance] = useState(null);
  const [limitInKrw, setLimitInKrw] = useState(true);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [mode, setMode] = useState(acct.binanceMode || "SPOT");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const refresh = async () => {
    try {
      const b = await getBinanceBalance(env, mode);
      setBalance(b);
    } catch {}
  };
  useEffect(() => { setBalance(null); if (acct.lastVerifiedAt) refresh(); }, [env, acct.id, mode]);

  const doTest = async () => {
    setBusy(true); setTesting(true); setMsg(null);
    try {
      const res = await testBinanceAccount(env, mode);
      const bal = res.balance || {};
      const summary = mode === "FUTURES"
        ? `${Number(bal.totalWalletBalance || 0).toFixed(2)} USDT (${Number(bal.availableBalance || 0).toFixed(2)} avail.)`
        : `${Number(bal.totalUsdtValue || 0).toFixed(2)} USDT`;
      setMsg({ type: "ok", text: t("account.binanceTestSuccess", { summary }) });
      setBalance(bal);
      reload();
    } catch (e) {
      setMsg({ type: "err", text: t("account.binanceTestFailed", { err: e?.response?.data?.error || e.message }) });
    } finally { setBusy(false); setTesting(false); }
  };

  const doDelete = () => setDeleteConfirm(true);
  const doDeleteConfirm = async () => {
    setDeleteConfirm(false);
    setBusy(true);
    try { await deleteBrokerAccount(env, "BINANCE"); reload(); }
    catch (e) { setMsg({ type: "err", text: t("account.binanceDeleteFailed", { err: e?.response?.data?.error || e.message }) }); }
    finally { setBusy(false); }
  };

  const doToggleTrading = async () => {
    const next = !acct.tradingEnabled;
    if (next && env === "REAL" && !confirm(t("account.binanceTradingOnConfirm"))) return;
    setBusy(true); setMsg(null);
    try {
      await setBrokerTrading(env, next, "BINANCE");
      setMsg({ type: "ok", text: next ? t("account.binanceTradingOnMsg") : t("account.binanceTradingOffMsg") });
      reload();
    } catch (e) {
      setMsg({ type: "err", text: t("account.binanceTradingFailed", { err: e?.response?.data?.error || e.message }) });
    } finally { setBusy(false); }
  };

  const infoRow = (label, value) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, borderBottom: `1px solid ${theme.border}` }}>
      <span style={{ color: theme.subtle }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card theme={theme}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>
            {t("account.binanceTitle", { env: env === "MOCK" ? t("account.testnet") : t("account.mainnet") })}
          </h2>
          <CurrencyToggle krw={limitInKrw} onChange={setLimitInKrw} />
        </div>
        {infoRow("API Key", acct.binanceApiKeyMasked || "—")}
        {infoRow(t("account.binanceTradingMode"), acct.binanceMode || "SPOT")}
        {infoRow(t("account.binanceTradingEnabled"), acct.tradingEnabled ? "✅ ON" : "❌ OFF")}
        {infoRow(t("account.binanceLastVerified"), acct.lastVerifiedAt ? new Date(acct.lastVerifiedAt).toLocaleString() : t("account.statUnverified"))}
        {infoRow(t("account.binanceSingleLimit"), limitInKrw
          ? `₩${Number((acct.maxOrderUsd || 0) * 1400).toLocaleString()}`
          : `$${Number(acct.maxOrderUsd || 0).toLocaleString()}`)}
        {infoRow(t("account.binanceDailyLimit"), limitInKrw
          ? `₩${Number((acct.dailyOrderUsd || 0) * 1400).toLocaleString()}`
          : `$${Number(acct.dailyOrderUsd || 0).toLocaleString()}`)}

        {/* 모드 선택 */}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {["SPOT", "FUTURES"].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              ...btnDefault, fontSize: 12,
              background: mode === m ? "#DBEAFE" : "#ffffff",
              color: mode === m ? "#1e3a5f" : "#374151",
              fontWeight: mode === m ? 700 : 600,
            }}>{m}</button>
          ))}
        </div>

        <div className="action-row" style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <button onClick={doTest} disabled={busy} style={{
            ...btnPrimary,
            display: "inline-flex", alignItems: "center", gap: 6,
            ...(testing ? { opacity: 0.75, cursor: "wait" } : {}),
          }}>
            {testing
              ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />{t("account.binanceTesting")}</>
              : t("account.binanceTestBtn")}
          </button>
          {acct.lastVerifiedAt && (
            <button onClick={doToggleTrading} disabled={busy}
              style={acct.tradingEnabled ? btnDanger : { ...btnPrimary, background: "linear-gradient(135deg,#22c55e,#16a34a)" }}>
              {acct.tradingEnabled ? t("account.binanceTradingOff") : t("account.binanceTradingOn")}
            </button>
          )}
          <button onClick={() => refresh()} disabled={busy} style={btnSecondary}>
            {t("account.binanceRefresh")}
          </button>
          <button onClick={doDelete} disabled={busy} style={btnDanger}>
            {t("account.binanceDeleteBtn")}
          </button>
        </div>
      </Card>

      {/* 현물 주문 폼 (SPOT + 검증완료일 때만) */}
      {mode === "SPOT" && acct.lastVerifiedAt && (
        <BinanceOrderForm theme={theme} env={env} acct={acct} setMsg={setMsg} onPlaced={refresh} />
      )}
      {mode === "FUTURES" && (
        <Card theme={theme}>
          <div style={{ fontSize: 13, color: theme.subtle }}>
            {t("account.binanceFuturesDisabled")}
          </div>
        </Card>
      )}

      <DeleteAccountModal
        open={deleteConfirm}
        brokerName="Binance"
        envLabel={env === "REAL" ? t("account.mainnet") : t("account.testnet")}
        onConfirm={doDeleteConfirm}
        onClose={() => setDeleteConfirm(false)}
      />

      {/* 잔고 카드 */}
      {balance && (
        <Card theme={theme}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{t("account.binanceBalance", { mode })}</h3>
          {mode === "FUTURES" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                [t("account.binanceWalletBalance"), `${Number(balance.totalWalletBalance || 0).toFixed(4)} USDT`],
                [t("account.binanceAvailableBalance"), `${Number(balance.availableBalance || 0).toFixed(4)} USDT`],
                [t("account.binanceUnrealizedPnl"), `${Number(balance.totalUnrealizedProfit || 0).toFixed(4)} USDT`],
              ].map(([k, v]) => (
                <div key={k} style={{ background: theme.bg, borderRadius: 8, padding: "8px 12px", border: `1px solid ${theme.border}` }}>
                  <div style={{ fontSize: 11, color: theme.subtle }}>{k}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: theme.subtle, marginBottom: 8 }}>
                {t("account.binanceTotalUsdt")} <strong>{Number(balance.totalUsdtValue || 0).toFixed(4)} USDT</strong>
                &nbsp;|&nbsp; {t("account.binanceTradable")} {balance.canTrade ? "✅" : "❌"}
              </div>
              {Array.isArray(balance.balances) && balance.balances.length > 0 && (
                <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: theme.bg }}>
                      <th style={th}>{t("account.binanceColAsset")}</th><th style={th}>{t("account.binanceColFree")}</th><th style={th}>{t("account.binanceColLocked")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balance.balances.map((b, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${theme.border}` }}>
                        <td style={td}><strong>{b.asset}</strong></td>
                        <td style={td}>{Number(b.free).toFixed(8)}</td>
                        <td style={td}>{Number(b.locked).toFixed(8)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          )}

          {/* 오픈 포지션 (선물만) */}
          {mode === "FUTURES" && Array.isArray(balance.openPositions) && balance.openPositions.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{t("account.binanceOpenPositions")}</div>
              <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: theme.bg }}>
                    <th style={th}>{t("account.binanceColSymbol")}</th><th style={th}>{t("account.binanceColQty")}</th><th style={th}>{t("account.binanceColEntry")}</th>
                    <th style={th}>{t("account.binanceColPnl")}</th><th style={th}>{t("account.binanceColLeverage")}</th>
                  </tr>
                </thead>
                <tbody>
                  {balance.openPositions.map((p, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${theme.border}` }}>
                      <td style={td}><strong>{p.symbol}</strong></td>
                      <td style={{ ...td, color: p.positionAmt > 0 ? "#16a34a" : "#dc2626" }}>
                        {p.positionAmt > 0 ? "▲" : "▼"} {Math.abs(p.positionAmt)}
                      </td>
                      <td style={td}>{Number(p.entryPrice).toFixed(4)}</td>
                      <td style={{ ...td, color: Number(p.unrealizedPnl) >= 0 ? "#16a34a" : "#dc2626" }}>
                        {Number(p.unrealizedPnl).toFixed(4)}
                      </td>
                      <td style={td}>{p.leverage}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

/* ─────────────────────────────── Binance 현물 주문 폼 (분수 수량 · MARKET/LIMIT · USDT) */
function BinanceOrderForm({ theme, env, acct, setMsg, onPlaced }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({ symbol: "BTCUSDT", side: "BUY", quantity: "", type: "MARKET", limitPrice: "" });
  const [quote, setQuote] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const fetchQuote = async (symbol) => {
    if (!symbol || !acct.lastVerifiedAt) { setQuote(null); return; }
    try { setQuote(await getBrokerQuote(env, symbol, "BINANCE")); } catch { setQuote(null); }
  };

  const buildBody = () => ({
    ticker: (form.symbol || "").toUpperCase(),
    side: form.side,
    quantity: form.quantity ? Number(form.quantity) : 0,
    limitPrice: form.type === "LIMIT" && form.limitPrice ? Number(form.limitPrice) : null,
  });

  const doPreview = async () => {
    setBusy(true); setMsg(null);
    try { setPreview(await previewBrokerOrder(env, buildBody(), "BINANCE")); }
    catch (e) { setMsg({ type: "err", text: t("account.binancePreviewFailed", { err: e?.response?.data?.error || e.message }) }); }
    finally { setBusy(false); }
  };
  const doPlace = async () => {
    if (!preview?.ok) return;
    setBusy(true); setMsg(null);
    try {
      const r = await placeBrokerOrder(env, buildBody(), "BINANCE");
      setMsg({ type: "ok", text: t("account.binanceOrderSent", { no: `${r.order_no || "(응답확인)"}${r.status_code ? ` (${r.status_code})` : ""}` }) });
      setPreview(null);
      onPlaced?.();
    } catch (e) {
      setMsg({ type: "err", text: t("account.binanceOrderFailed", { err: e?.response?.data?.error || e.message }) });
    } finally { setBusy(false); }
  };

  const overLimit = preview?.over_single_limit;
  const isLimit = form.type === "LIMIT";

  return (
    <Card theme={theme}>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>{t("account.binanceOrderTitle", { env: env === "REAL" ? t("account.mainnet") : t("account.testnet") })}</h3>
      <div style={{ display: "grid", gridTemplateColumns: isLimit ? "1.6fr 1fr 1fr 1.2fr 1.2fr auto" : "1.6fr 1fr 1fr 1.4fr auto", gap: 8, alignItems: "end" }}>
        <Field label={t("account.binanceSymbol")}>
          <input style={inp(theme)} value={form.symbol}
            onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))}
            onBlur={e => fetchQuote(e.target.value.trim().toUpperCase())} />
        </Field>
        <Field label={t("account.fieldSide")}>
          <select style={inp(theme)} value={form.side}
            onChange={e => setForm(f => ({ ...f, side: e.target.value }))}>
            <option value="BUY">{t("account.optionBuy")}</option><option value="SELL">{t("account.optionSell")}</option>
          </select>
        </Field>
        <Field label={t("account.fieldOrderType")}>
          <select style={inp(theme)} value={form.type}
            onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            <option value="MARKET">{t("account.optionMarket")}</option><option value="LIMIT">{t("account.optionLimit")}</option>
          </select>
        </Field>
        <Field label={t("account.binanceQty")}>
          <input type="number" step="any" min="0" style={inp(theme)} value={form.quantity}
            placeholder="e.g. 0.001"
            onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
        </Field>
        {isLimit && (
          <Field label={t("account.binanceLimitPrice")}>
            <input type="number" step="any" style={inp(theme)} value={form.limitPrice}
              onChange={e => setForm(f => ({ ...f, limitPrice: e.target.value }))} />
          </Field>
        )}
        <button onClick={doPreview} disabled={busy} style={btnSecondary}>{t("account.previewBtn")}</button>
      </div>

      {quote && quote.last_price > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: theme.subtle }}>
          📊 <b>{form.symbol}</b>:{" "}
          <b style={{ color: theme.text }}>{Number(quote.last_price).toLocaleString(undefined, { maximumFractionDigits: 8 })} USDT</b>
          {isLimit && <>
            {" · "}
            <button type="button"
              onClick={() => setForm(f => ({ ...f, limitPrice: String(quote.last_price) }))}
              style={{ background: "none", border: "none", color: "#3b82f6", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
              {t("account.binanceUseThisPrice")}
            </button>
          </>}
        </div>
      )}

      {preview && (
        <div style={{
          marginTop: 14, padding: 12, borderRadius: 8,
          background: overLimit ? "#FEE2E2" : (form.side === "BUY" ? "#DCFCE7" : "#FEE2E2"),
          color: overLimit ? "#991B1B" : (form.side === "BUY" ? "#166534" : "#991B1B"),
          fontSize: 13,
        }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>
            {overLimit ? t("account.binancePreviewOverLimit") : `✅ ${preview.side} ${preview.quantity} ${preview.ticker}${isLimit ? ` @ ${preview.limit_price} USDT` : ` ${t("account.binanceMarketPrice")}`}`}
          </div>
          <div>{t("account.binanceEstNotional", { total: Number(preview.est_total_usd).toFixed(2), limit: preview.max_order_usd })}{!isLimit && preview.ref_price > 0 ? ` · ref ${Number(preview.ref_price).toLocaleString(undefined, { maximumFractionDigits: 8 })} USDT` : ""}</div>
          <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
            <button onClick={doPlace} disabled={busy || !preview.ok || !acct.tradingEnabled}
              style={form.side === "BUY" ? btnPrimary : btnDanger}>
              {acct.tradingEnabled ? `${form.side === "BUY" ? t("account.executeBuy") : t("account.executeSell")}` : t("account.tradingSwitchOff")}
            </button>
            <button onClick={() => setPreview(null)} style={btnDefault}>{t("account.cancelBtn")}</button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ─────────────────────────────── 계좌 삭제 확인 모달 */
function DeleteAccountModal({ open, brokerName, envLabel, onConfirm, onClose }) {
  if (!open) return null;
  return ReactDOM.createPortal(
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 3000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      backdropFilter: "blur(4px)",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "white", borderRadius: 20, width: "100%", maxWidth: 400,
        boxShadow: "0 24px 64px rgba(0,0,0,0.22)", overflow: "hidden",
      }}>
        <div style={{
          padding: "24px 28px 20px",
          background: "linear-gradient(135deg,#fef2f2 0%,#fee2e2 100%)",
          borderBottom: "1px solid #FECACA",
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, flexShrink: 0,
            background: "linear-gradient(135deg,#f87171,#ef4444)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(239,68,68,0.3)",
          }}>
            <Trash2 size={20} color="white" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#7f1d1d" }}>계좌 연동 해제</h2>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#991b1b" }}>{brokerName} · {envLabel}</p>
          </div>
        </div>
        <div style={{ padding: "22px 28px" }}>
          <p style={{ margin: 0, fontSize: 14, color: "#374151", lineHeight: 1.75 }}>
            이 계좌의 연동을 해제합니다.<br />
            저장된 API 키와 설정이 모두 삭제되며, <strong>복구할 수 없습니다.</strong>
          </p>
          <div style={{
            marginTop: 14, padding: "12px 14px", borderRadius: 10,
            background: "#FEF2F2", border: "1px solid #FECACA",
            fontSize: 12.5, color: "#991b1b", lineHeight: 1.65,
          }}>
            재등록하려면 API 키를 다시 입력해야 합니다.
          </div>
        </div>
        <div style={{ padding: "0 28px 24px", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "10px 20px", borderRadius: 10,
            border: "1px solid #E2E8F0", background: "white", color: "#374151",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>취소</button>
          <button onClick={onConfirm} style={{
            padding: "10px 20px", borderRadius: 10, border: "none",
            background: "linear-gradient(135deg,#f87171,#ef4444)",
            color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 3px 10px rgba(239,68,68,0.3)",
          }}>연동 해제</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

