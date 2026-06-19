import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Key, AlertTriangle, Loader2, CheckCircle2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import binanceLogo from "../assets/binance.webp";
import { upsertBrokerAccount } from "./alphaApi";

/**
 * 브로커 계좌 등록 모달 — KIS / Binance 통합.
 *
 * Props:
 *   open: boolean
 *   brokerType: "KIS" | "BINANCE"
 *   env: "MOCK" | "REAL"
 *   accounts: array (중복 키 체크용)
 *   onSuccess(): void
 *   onClose(): void
 */
export default function BrokerRegisterModal({ open, brokerType, env, accounts = [], onSuccess, onClose }) {
  const isMock = env === "MOCK";
  const isBinance = brokerType === "BINANCE";

  /* ── 색 팔레트 ── */
  const palette = isMock
    ? { from: "#60a5fa", to: "#6366f1", grad: "linear-gradient(135deg,#eff6ff 0%,#e0e7ff 100%)", iconGrad: "linear-gradient(135deg,#60a5fa,#6366f1)", title: "#1e3a8a", sub: "#475569", border: "#C7D2FE", btnGrad: "linear-gradient(135deg,#60a5fa 0%,#3b82f6 50%,#6366f1 100%)", btnShadow: "0 3px 10px rgba(99,102,241,0.3)" }
    : { from: "#f87171", to: "#dc2626", grad: "linear-gradient(135deg,#fff1f2 0%,#ffe4e6 100%)", iconGrad: "linear-gradient(135deg,#f87171,#dc2626)", title: "#7f1d1d", sub: "#b91c1c", border: "#FECACA", btnGrad: "linear-gradient(135deg,#f87171 0%,#dc2626 100%)", btnShadow: "0 3px 10px rgba(220,38,38,0.3)" };

  /* ── KIS 폼 ── */
  const [kisForm, setKisForm] = useState({
    appKey: "", appSecret: "", cano: "", acntPrdtCd: "01",
    maxOrderUsd: isMock ? 1000 : 100,
    dailyOrderUsd: isMock ? 5000 : 500,
    dailyBuyKrw: isMock ? 50_000_000 : 10_000_000,
    dailySellKrw: isMock ? 300_000_000 : 30_000_000,
  });
  const [showSecret, setShowSecret] = useState(false);

  /* ── Binance 폼 ── */
  const [bnbForm, setBnbForm] = useState({
    binanceApiKey: "", binanceApiSecret: "",
    binanceMode: "SPOT",
    maxOrderUsd: isMock ? 2000 : 200,
    dailyOrderUsd: isMock ? 10000 : 1000,
  });
  const [showBnbSecret, setShowBnbSecret] = useState(false);

  /* ── 공통 상태 ── */
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmed, setConfirmed] = useState(false); // 확인 단계 표시 여부
  const [preview, setPreview] = useState(null);      // { key, secretLen, ... }

  /* 모달 열릴 때 초기화 */
  useEffect(() => {
    if (open) {
      setError(null); setSaving(false); setConfirmed(false); setPreview(null);
      setShowSecret(false); setShowBnbSecret(false);
      setKisForm({ appKey: "", appSecret: "", cano: "", acntPrdtCd: "01",
        maxOrderUsd: isMock ? 1000 : 100, dailyOrderUsd: isMock ? 5000 : 500,
        dailyBuyKrw: isMock ? 50_000_000 : 10_000_000, dailySellKrw: isMock ? 300_000_000 : 30_000_000 });
      setBnbForm({ binanceApiKey: "", binanceApiSecret: "", binanceMode: "SPOT",
        maxOrderUsd: isMock ? 2000 : 200, dailyOrderUsd: isMock ? 10000 : 1000 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* ESC + 스크롤 잠금 */
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape" && !saving) onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, saving, onClose]);

  if (!open) return null;

  /* ── 유효성 검사 → 확인 단계 진입 ── */
  const handlePreview = () => {
    setError(null);
    if (isBinance) {
      const cleanKey = (bnbForm.binanceApiKey || "").replace(/[\s​ ]/g, "");
      const cleanSec = (bnbForm.binanceApiSecret || "").replace(/[\s​ ]/g, "");
      if (cleanKey.length < 20) { setError(`API Key가 너무 짧습니다 (${cleanKey.length}자).`); return; }
      if (cleanSec.length < 20) { setError(`API Secret이 너무 짧습니다 (${cleanSec.length}자).`); return; }
      setPreview({ keyHead: cleanKey.slice(0, 6), keyTail: cleanKey.slice(-5), keyLen: cleanKey.length, secretLen: cleanSec.length, mode: bnbForm.binanceMode, cleanKey, cleanSec });
    } else {
      const cleanKey = (kisForm.appKey || "").replace(/[\s​ ]/g, "");
      const cleanSec = (kisForm.appSecret || "").replace(/[\s​ ]/g, "");
      if (cleanKey.length < 20) { setError(`App Key가 너무 짧습니다 (${cleanKey.length}자). 정상 키는 36자입니다.`); return; }
      if (cleanSec.length < 100) { setError(`App Secret이 너무 짧습니다 (${cleanSec.length}자). 정상 시크릿은 180자+입니다.`); return; }
      /* 동일 키 중복 차단 */
      const otherEnv = env === "MOCK" ? "REAL" : "MOCK";
      const otherAcct = accounts.find(a => a.brokerType === "KIS" && a.env === otherEnv);
      if (otherAcct?.appKeyMasked) {
        const m = otherAcct.appKeyMasked.match(/^(.{4,8}).*?(.{3,5})$/);
        if (m && cleanKey.startsWith(m[1]) && cleanKey.endsWith(m[2])) {
          setError(`입력한 키가 ${otherEnv} 환경에 이미 등록된 키와 같습니다. KIS는 모의/실전이 별도 키쌍을 발급합니다.`);
          return;
        }
      }
      setPreview({ keyHead: cleanKey.slice(0, 6), keyTail: cleanKey.slice(-5), keyLen: cleanKey.length, secretLen: cleanSec.length, cano: kisForm.cano, cleanKey, cleanSec });
    }
    setConfirmed(true);
  };

  /* ── 실제 등록 ── */
  const handleSubmit = async () => {
    if (!preview) return;
    setSaving(true); setError(null);
    try {
      if (isBinance) {
        await upsertBrokerAccount({
          brokerType: "BINANCE", env,
          binanceApiKey: preview.cleanKey, binanceApiSecret: preview.cleanSec,
          binanceMode: preview.mode,
          maxOrderUsd: bnbForm.maxOrderUsd, dailyOrderUsd: bnbForm.dailyOrderUsd,
        });
      } else {
        await upsertBrokerAccount({
          ...kisForm, env,
          appKey: preview.cleanKey, appSecret: preview.cleanSec,
        });
      }
      onSuccess();
      onClose();
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
      setConfirmed(false);
    } finally {
      setSaving(false);
    }
  };

  /* ── 라벨 ── */
  const envLabel = isMock ? (isBinance ? "테스트넷" : "모의투자") : (isBinance ? "메인넷" : "실전투자");
  const modalTitle = isBinance
    ? `Binance ${envLabel} 계정 등록`
    : `KIS ${envLabel} 계좌 등록`;

  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: 9,
    border: "1.5px solid #E2E8F0", fontSize: 13.5, outline: "none",
    color: "#0F172A", background: "#fff", boxSizing: "border-box",
    fontFamily: "inherit", transition: "border-color 0.15s",
  };
  const labelStyle = { fontSize: 11.5, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6, letterSpacing: 0.1 };

  const content = (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }} onClick={() => !saving && onClose()}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "white", borderRadius: 20, width: "100%", maxWidth: 520,
        boxShadow: "0 24px 64px rgba(0,0,0,0.22)", overflow: "hidden",
        maxHeight: "92vh", display: "flex", flexDirection: "column",
      }}>
        {/* 헤더 */}
        <div style={{
          padding: "22px 26px 18px",
          background: palette.grad,
          borderBottom: `1px solid ${palette.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14, flexShrink: 0,
              background: palette.iconGrad,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 4px 12px rgba(0,0,0,0.2)`,
            }}>
              {isBinance
                ? <img src={binanceLogo} alt="Binance" style={{ width: 26, height: 26, objectFit: "contain" }} />
                : <Key size={20} color="white" />}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: palette.title }}>{modalTitle}</h2>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: palette.sub }}>
                {isMock ? "가상 자금으로 안전하게 시작하세요" : "실제 자금이 연결됩니다 · 신중하게 입력하세요"}
              </p>
            </div>
          </div>
          <button onClick={onClose} disabled={saving} style={{
            width: 30, height: 30, borderRadius: "50%", border: `1px solid ${palette.border}`,
            background: "white", cursor: saving ? "wait" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", flexShrink: 0,
          }}><X size={14} /></button>
        </div>

        {/* 본문 (스크롤 가능) */}
        <div style={{ overflowY: "auto", padding: "22px 26px 26px", flex: 1 }}>

          {/* 실전 경고 배너 */}
          {!isMock && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              background: "#FEF3C7", color: "#92400E",
              border: "1px solid #FCD34D", borderRadius: 10,
              padding: "12px 14px", fontSize: 12.5, lineHeight: 1.6, marginBottom: 20,
            }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                {isBinance
                  ? <><strong>실전 계정입니다.</strong> API 키 생성 시 <strong>IP 화이트리스트</strong>를 반드시 설정하고, 필요한 권한(스팟: Enable Spot / 선물: Enable Futures)만 최소로 부여하세요.</>
                  : <><strong>실전계좌는 진짜 돈이 움직입니다.</strong> 1회·일일 한도를 작게 설정하고, 매매 스위치는 OFF로 시작하세요.</>}
              </div>
            </div>
          )}

          {/* ── 확인 단계 ── */}
          {confirmed && preview ? (
            <div>
              <div style={{
                background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 12,
                padding: "16px 18px", marginBottom: 18,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <ShieldCheck size={16} color="#16A34A" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#15803D" }}>등록 정보 최종 확인</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    ["환경", envLabel],
                    isBinance ? ["API Key", `${preview.keyHead}…${preview.keyTail} (${preview.keyLen}자)`] : ["App Key", `${preview.keyHead}…${preview.keyTail} (${preview.keyLen}자)`],
                    ["Secret 길이", `${preview.secretLen}자`],
                    isBinance ? ["거래 모드", preview.mode] : ["계좌번호(CANO)", preview.cano || "—"],
                  ].filter(Boolean).map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: "#64748B" }}>{k}</span>
                      <span style={{ fontWeight: 700, color: "#0F172A" }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p style={{ fontSize: 12.5, color: "#64748B", marginBottom: 18, lineHeight: 1.6 }}>
                위 정보가 맞으면 <strong>등록 확정</strong>을 누르세요. 틀리면 <strong>수정하기</strong>를 눌러 돌아가세요.
              </p>
            </div>
          ) : (
            /* ── 폼 ── */
            isBinance ? (
              <BinanceForm form={bnbForm} setForm={setBnbForm} showSecret={showBnbSecret} setShowSecret={setShowBnbSecret} inputStyle={inputStyle} labelStyle={labelStyle} />
            ) : (
              <KisForm form={kisForm} setForm={setKisForm} env={env} showSecret={showSecret} setShowSecret={setShowSecret} inputStyle={inputStyle} labelStyle={labelStyle} />
            )
          )}

          {/* 에러 */}
          {error && (
            <div style={{
              background: "#FEE2E2", color: "#B91C1C", border: "1px solid #FCA5A5",
              borderRadius: 9, padding: "10px 13px", fontSize: 12.5, marginBottom: 4,
              wordBreak: "break-word", lineHeight: 1.6,
            }}>
              {error}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div style={{
          padding: "14px 26px 20px",
          borderTop: "1px solid #F1F5F9",
          display: "flex", gap: 8, justifyContent: "flex-end",
          flexShrink: 0,
        }}>
          {confirmed ? (
            <>
              <button onClick={() => setConfirmed(false)} disabled={saving} style={{
                padding: "11px 20px", borderRadius: 10, border: "1px solid #E2E8F0",
                background: "white", color: "#374151", fontSize: 13, fontWeight: 600,
                cursor: saving ? "wait" : "pointer",
              }}>수정하기</button>
              <button onClick={handleSubmit} disabled={saving} style={{
                padding: "11px 22px", borderRadius: 10, border: "none",
                background: saving ? "#E2E8F0" : palette.btnGrad,
                color: saving ? "#94A3B8" : "white",
                fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer",
                display: "flex", alignItems: "center", gap: 7,
                boxShadow: saving ? "none" : palette.btnShadow,
              }}>
                {saving ? <><Loader2 size={14} className="brk-spin" />등록 중…</> : <><CheckCircle2 size={14} />등록 확정</>}
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} disabled={saving} style={{
                padding: "11px 20px", borderRadius: 10, border: "1px solid #E2E8F0",
                background: "white", color: "#374151", fontSize: 13, fontWeight: 600,
                cursor: "pointer",
              }}>취소</button>
              <button onClick={handlePreview} disabled={saving} style={{
                padding: "11px 22px", borderRadius: 10, border: "none",
                background: palette.btnGrad, color: "white",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                boxShadow: palette.btnShadow,
              }}>다음 · 확인하기 →</button>
            </>
          )}
        </div>
      </div>
      <style>{`
        @keyframes brk-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        .brk-spin { animation: brk-spin 1s linear infinite; }
        .brk-input:focus { border-color: #6366F1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
      `}</style>
    </div>
  );

  return createPortal(content, document.body);
}

/* ── KIS 폼 ──────────────────────────────────────────────────────────────── */
function KisForm({ form, setForm, env, showSecret, setShowSecret, inputStyle, labelStyle }) {
  const isMock = env === "MOCK";
  const f = (key, val) => setForm(p => ({ ...p, [key]: val }));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <input type="text" name="username" autoComplete="username" style={{ display: "none" }} />
      <input type="password" name="password" autoComplete="current-password" style={{ display: "none" }} />

      <div>
        <label style={labelStyle}>App Key <span style={{ color: "#94A3B8", fontWeight: 400 }}>({isMock ? "모의" : "실전"}용 · 36자)</span></label>
        <input className="brk-input" style={inputStyle}
          value={form.appKey} name={`appkey-${env}`}
          autoComplete="off" spellCheck="false" autoCorrect="off"
          placeholder={isMock ? "PSji… 으로 시작하는 모의 키" : "PS… 으로 시작하는 실전 키"}
          onChange={e => f("appKey", e.target.value)} />
      </div>

      <div>
        <label style={labelStyle}>App Secret <span style={{ color: "#94A3B8", fontWeight: 400 }}>({isMock ? "모의" : "실전"}용 · 180자+)</span></label>
        <div style={{ position: "relative" }}>
          <input className="brk-input"
            type={showSecret ? "text" : "password"}
            style={{ ...inputStyle, paddingRight: 42 }}
            value={form.appSecret} name={`appsecret-${env}`}
            autoComplete="off" spellCheck="false" autoCorrect="off"
            placeholder="KIS에서 복사한 App Secret 전체를 붙여넣으세요"
            onChange={e => f("appSecret", e.target.value)} />
          <button type="button" onClick={() => setShowSecret(s => !s)} style={{
            position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 0,
          }}>
            {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>종합계좌번호 (CANO)</label>
          <input className="brk-input" style={inputStyle} value={form.cano}
            placeholder="46953079" onChange={e => f("cano", e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>상품코드</label>
          <input className="brk-input" style={inputStyle} value={form.acntPrdtCd}
            placeholder="01" onChange={e => f("acntPrdtCd", e.target.value)} />
        </div>
      </div>

      <div style={{ borderTop: "1px dashed #E2E8F0", paddingTop: 14 }}>
        <p style={{ fontSize: 11.5, color: "#64748B", marginBottom: 12, fontWeight: 600 }}>주문 한도 설정</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>1회 최대 주문 (USD)</label>
            <input className="brk-input" type="number" min="0" style={inputStyle}
              value={form.maxOrderUsd} onChange={e => f("maxOrderUsd", Number(e.target.value))} />
          </div>
          <div>
            <label style={labelStyle}>일일 누적 한도 (USD)</label>
            <input className="brk-input" type="number" min="0" style={inputStyle}
              value={form.dailyOrderUsd} onChange={e => f("dailyOrderUsd", Number(e.target.value))} />
          </div>
          <div>
            <label style={labelStyle}>매수 일일 한도 (원화)</label>
            <input className="brk-input" type="number" min="0" step="1000000" style={inputStyle}
              value={form.dailyBuyKrw} onChange={e => f("dailyBuyKrw", Number(e.target.value))} />
          </div>
          <div>
            <label style={labelStyle}>매도 일일 한도 (원화)</label>
            <input className="brk-input" type="number" min="0" step="1000000" style={inputStyle}
              value={form.dailySellKrw} onChange={e => f("dailySellKrw", Number(e.target.value))} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Binance 폼 ───────────────────────────────────────────────────────────── */
function BinanceForm({ form, setForm, showSecret, setShowSecret, inputStyle, labelStyle }) {
  const f = (key, val) => setForm(p => ({ ...p, [key]: val }));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <input type="text" name="username" autoComplete="username" style={{ display: "none" }} />
      <input type="password" name="password" autoComplete="current-password" style={{ display: "none" }} />

      <div>
        <label style={labelStyle}>API Key <span style={{ color: "#94A3B8", fontWeight: 400 }}>(64자)</span></label>
        <input className="brk-input" style={inputStyle}
          value={form.binanceApiKey} name="bnb-key"
          autoComplete="off" spellCheck="false"
          placeholder="Binance API Key"
          onChange={e => f("binanceApiKey", e.target.value)} />
      </div>

      <div>
        <label style={labelStyle}>API Secret <span style={{ color: "#94A3B8", fontWeight: 400 }}>(64자)</span></label>
        <div style={{ position: "relative" }}>
          <input className="brk-input"
            type={showSecret ? "text" : "password"}
            style={{ ...inputStyle, paddingRight: 42 }}
            value={form.binanceApiSecret} name="bnb-secret"
            autoComplete="off" spellCheck="false"
            placeholder="Binance API Secret"
            onChange={e => f("binanceApiSecret", e.target.value)} />
          <button type="button" onClick={() => setShowSecret(s => !s)} style={{
            position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 0,
          }}>
            {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div>
        <label style={labelStyle}>거래 모드</label>
        <select className="brk-input" style={inputStyle}
          value={form.binanceMode} onChange={e => f("binanceMode", e.target.value)}>
          <option value="SPOT">SPOT (현물)</option>
          <option value="FUTURES">FUTURES (선물)</option>
        </select>
      </div>

      <div style={{ borderTop: "1px dashed #E2E8F0", paddingTop: 14 }}>
        <p style={{ fontSize: 11.5, color: "#64748B", marginBottom: 12, fontWeight: 600 }}>주문 한도 설정</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>1회 최대 주문 (USD)</label>
            <input className="brk-input" type="number" min="0" style={inputStyle}
              value={form.maxOrderUsd} onChange={e => f("maxOrderUsd", Number(e.target.value))} />
          </div>
          <div>
            <label style={labelStyle}>일일 누적 한도 (USD)</label>
            <input className="brk-input" type="number" min="0" style={inputStyle}
              value={form.dailyOrderUsd} onChange={e => f("dailyOrderUsd", Number(e.target.value))} />
          </div>
        </div>
      </div>
    </div>
  );
}
