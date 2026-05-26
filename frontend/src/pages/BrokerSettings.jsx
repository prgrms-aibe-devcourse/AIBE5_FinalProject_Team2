import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header_client from "../components/Header_client";
import {
  fetchMyBroker, upsertBroker, testBroker, setTradingEnabled, deleteBroker
} from "../lib/brokerApi";

const BASE_FONT = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const FIELD_HINT = {
  appKey: "KIS Developers 포털 → 앱 등록 후 발급받은 'AppKey'. 보통 'PSAT...' 또는 'PS...'로 시작.",
  appSecret: "함께 발급되는 'AppSecret'. 한 번만 표시되므로 분실 시 재발급 필요. (저장 즉시 AES-256으로 암호화)",
  cano: "종합계좌번호 8자리. MTS/HTS 계좌 화면의 '50000000-01'에서 앞 8자리.",
  acntPrdtCd: "상품코드 2자리. 위 예시의 '-01' 부분. 대부분 '01'.",
};

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{label}</label>
      {hint && <p style={{ fontSize: 11, color: "#6B7280", margin: "0 0 6px", lineHeight: 1.5 }}>{hint}</p>}
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "10px 12px", border: "1px solid #D1D5DB", borderRadius: 8,
  fontSize: 13, fontFamily: BASE_FONT, outline: "none", boxSizing: "border-box",
};

export default function BrokerSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    env: "MOCK", appKey: "", appSecret: "", cano: "", acntPrdtCd: "01",
    maxOrderUsd: 5000, dailyOrderUsd: 20000,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  const reload = async () => {
    setLoading(true); setErr(null);
    try {
      const a = await fetchMyBroker();
      setAccount(a);
      if (!a) setEditing(true);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { reload(); }, []);

  const handleSave = async () => {
    setErr(null); setMsg(null); setSaving(true);
    try {
      const saved = await upsertBroker(form);
      setAccount(saved);
      setEditing(false);
      setMsg("저장 완료. '연결 테스트' 버튼으로 키 유효성을 검증하세요.");
      setForm(f => ({ ...f, appKey: "", appSecret: "" }));
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setErr(null); setMsg(null);
    try {
      await testBroker();
      setMsg("✅ KIS 연결 성공. 이제 자동매매 스위치를 켤 수 있습니다.");
      reload();
    } catch (e) {
      const r = e?.response;
      if (r?.status === 501) {
        setMsg("⏳ " + (r.data?.error || "KIS 연결 테스트는 다음 배포에서 활성화됩니다."));
      } else {
        setErr(r?.data?.error || e.message);
      }
    }
  };

  const handleToggleTrading = async (next) => {
    setErr(null); setMsg(null);
    try {
      const updated = await setTradingEnabled(next);
      setAccount(updated);
      setMsg(next ? "자동 시그널 발송 + 승인 매매 ON" : "자동 시그널 발송 OFF");
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("KIS 연결을 해제합니다. 이 작업은 되돌릴 수 없습니다. 진행할까요?")) return;
    try {
      await deleteBroker();
      setAccount(null);
      setEditing(true);
      setMsg("연결 해제 완료.");
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", fontFamily: BASE_FONT }}>
      <Header_client />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px 80px" }}>
        <div style={{ marginBottom: 24 }}>
          <button onClick={() => navigate("/client_home")}
            style={{ background: "none", border: "none", color: "#6B7280", fontSize: 13, cursor: "pointer", padding: 0 }}>
            ‹ 홈으로
          </button>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0F2C52", margin: "8px 0 6px" }}>
            한국투자증권 연결
          </h1>
          <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.6, margin: 0 }}>
            매일 22:30(KST) 시그널 메일 → 본인이 승인 버튼을 눌러야만 주문이 실행됩니다. 자동 실행 없음.
          </p>
        </div>

        {loading && <div style={{ padding: 40, textAlign: "center", color: "#6B7280" }}>로딩 중…</div>}

        {err && (
          <div style={{ padding: 12, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, color: "#B91C1C", fontSize: 13, marginBottom: 16 }}>
            {err}
          </div>
        )}
        {msg && (
          <div style={{ padding: 12, background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, color: "#065F46", fontSize: 13, marginBottom: 16 }}>
            {msg}
          </div>
        )}

        {/* 등록된 계정 표시 */}
        {!loading && account && !editing && (
          <div style={{ background: "white", borderRadius: 14, border: "1px solid #E5E7EB", padding: 24, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <span style={{
                  display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800,
                  background: account.env === "REAL" ? "#FEF3C7" : "#DBEAFE",
                  color: account.env === "REAL" ? "#92400E" : "#1E3A5F",
                }}>{account.env === "REAL" ? "실전투자" : "모의투자"}</span>
                <span style={{
                  marginLeft: 8, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800,
                  background: account.lastVerifiedAt ? "#DCFCE7" : "#FEE2E2",
                  color: account.lastVerifiedAt ? "#166534" : "#991B1B",
                }}>
                  {account.lastVerifiedAt ? "✅ 검증됨" : "⚠ 미검증"}
                </span>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13, color: "#374151" }}>
              <div><b>AppKey</b><br/><span style={{ fontFamily: "monospace" }}>{account.appKeyMasked}</span></div>
              <div><b>계좌</b><br/><span style={{ fontFamily: "monospace" }}>{account.cano}-{account.acntPrdtCd}</span></div>
              <div><b>1건 한도</b><br/>${account.maxOrderUsd?.toLocaleString()}</div>
              <div><b>일일 한도</b><br/>${account.dailyOrderUsd?.toLocaleString()}</div>
            </div>
            <div style={{ marginTop: 18, padding: 14, background: "#F8FAFC", borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginBottom: 6 }}>자동 시그널 발송 + 승인 매매</div>
              <p style={{ fontSize: 11, color: "#6B7280", margin: "0 0 10px", lineHeight: 1.5 }}>
                ON 시 매일 22:30(KST) 분석 결과를 이메일로 받고, 메일 안의 승인 버튼을 클릭하면 그 1건만 실행됩니다.
                실제 주문은 사용자가 직접 누른 후 한 번 더 확인 화면에서 승인해야만 진행됩니다.
              </p>
              <button
                onClick={() => handleToggleTrading(!account.tradingEnabled)}
                disabled={!account.lastVerifiedAt && !account.tradingEnabled}
                style={{
                  padding: "8px 18px", borderRadius: 8, border: "none", cursor: (!account.lastVerifiedAt && !account.tradingEnabled) ? "not-allowed" : "pointer",
                  fontSize: 13, fontWeight: 700,
                  background: account.tradingEnabled ? "#EF4444" : (account.lastVerifiedAt ? "#0CA5A0" : "#E5E7EB"),
                  color: account.tradingEnabled ? "white" : (account.lastVerifiedAt ? "white" : "#9CA3AF"),
                }}>
                {account.tradingEnabled ? "🔴 OFF로 전환" : "🟢 ON으로 전환"}
              </button>
              {!account.lastVerifiedAt && (
                <span style={{ marginLeft: 10, fontSize: 11, color: "#B45309" }}>
                  ⚠ 먼저 '연결 테스트'로 키 유효성을 검증하세요.
                </span>
              )}
            </div>
            <div style={{ marginTop: 18, display: "flex", gap: 8 }}>
              <button onClick={handleTest}
                style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #D1D5DB", background: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#111827" }}>
                연결 테스트
              </button>
              <button onClick={() => { setEditing(true); setForm(f => ({ ...f, env: account.env, cano: account.cano, acntPrdtCd: account.acntPrdtCd, maxOrderUsd: account.maxOrderUsd, dailyOrderUsd: account.dailyOrderUsd })); }}
                style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #D1D5DB", background: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#111827" }}>
                키 다시 입력
              </button>
              <button onClick={handleDelete}
                style={{ marginLeft: "auto", padding: "10px 16px", borderRadius: 8, border: "1px solid #FECACA", background: "#FEF2F2", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#B91C1C" }}>
                연결 해제
              </button>
            </div>
          </div>
        )}

        {/* 등록 폼 */}
        {!loading && editing && (
          <div style={{ background: "white", borderRadius: 14, border: "1px solid #E5E7EB", padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 6px", color: "#111827" }}>
              {account ? "키 다시 입력" : "신규 연결"}
            </h2>
            <p style={{ fontSize: 12, color: "#6B7280", margin: "0 0 20px", lineHeight: 1.6 }}>
              KIS Developers 포털(<a href="https://apiportal.koreainvestment.com" target="_blank" rel="noreferrer" style={{ color: "#2563EB" }}>apiportal.koreainvestment.com</a>)에서 발급받은 값을 입력하세요. AppSecret은 저장 즉시 AES-256으로 암호화됩니다.
            </p>

            <Field label="환경">
              <div style={{ display: "flex", gap: 8 }}>
                {["MOCK", "REAL"].map(v => (
                  <button key={v} type="button" onClick={() => setForm({ ...form, env: v })}
                    style={{
                      flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid",
                      borderColor: form.env === v ? "#0CA5A0" : "#D1D5DB",
                      background: form.env === v ? "#ECFDF5" : "white",
                      color: form.env === v ? "#065F46" : "#374151",
                      fontWeight: 700, fontSize: 13, cursor: "pointer",
                    }}>
                    {v === "MOCK" ? "모의투자 (권장)" : "실전투자"}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 11, color: "#B45309", marginTop: 6 }}>
                ⚠ 처음에는 반드시 '모의투자'로 시작하세요. 실전 전환은 2주 이상 모의 운용 후 권장.
              </p>
            </Field>

            <Field label="AppKey" hint={FIELD_HINT.appKey}>
              <input style={inputStyle} value={form.appKey}
                onChange={e => setForm({ ...form, appKey: e.target.value })}
                placeholder="PSAT0000000000000000000000000000000" />
            </Field>

            <Field label="AppSecret" hint={FIELD_HINT.appSecret}>
              <input style={inputStyle} type="password" value={form.appSecret}
                onChange={e => setForm({ ...form, appSecret: e.target.value })}
                placeholder="발급받은 시크릿 키" />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
              <Field label="종합계좌번호 (CANO)" hint={FIELD_HINT.cano}>
                <input style={inputStyle} value={form.cano}
                  onChange={e => setForm({ ...form, cano: e.target.value.replace(/\D/g, "") })}
                  placeholder="50000000" />
              </Field>
              <Field label="상품코드" hint={FIELD_HINT.acntPrdtCd}>
                <input style={inputStyle} value={form.acntPrdtCd}
                  onChange={e => setForm({ ...form, acntPrdtCd: e.target.value.replace(/\D/g, "") })}
                  placeholder="01" />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="1건 최대 주문금액 (USD)">
                <input style={inputStyle} type="number" min={0} value={form.maxOrderUsd}
                  onChange={e => setForm({ ...form, maxOrderUsd: Number(e.target.value) })} />
              </Field>
              <Field label="일일 누적 한도 (USD)">
                <input style={inputStyle} type="number" min={0} value={form.dailyOrderUsd}
                  onChange={e => setForm({ ...form, dailyOrderUsd: Number(e.target.value) })} />
              </Field>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={handleSave} disabled={saving}
                style={{
                  flex: 1, padding: "12px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)",
                  color: "white", fontWeight: 700, fontSize: 14,
                  opacity: saving ? 0.6 : 1,
                }}>
                {saving ? "저장 중…" : "저장"}
              </button>
              {account && (
                <button onClick={() => setEditing(false)}
                  style={{ padding: "12px 20px", borderRadius: 8, border: "1px solid #D1D5DB", background: "white", color: "#111827", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                  취소
                </button>
              )}
            </div>
          </div>
        )}

        {/* 안내 박스 */}
        <div style={{ marginTop: 24, padding: 18, background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12 }}>
          <h3 style={{ fontSize: 13, fontWeight: 800, color: "#92400E", margin: "0 0 8px" }}>🔐 보안 약속</h3>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#78350F", lineHeight: 1.7 }}>
            <li>AppSecret은 입력 즉시 AES-256-GCM으로 암호화되어 DB에 저장됩니다. 평문 노출/로그 기록 없음.</li>
            <li>모든 매매는 사용자가 이메일 승인 링크 클릭 → 확인 페이지 '최종 승인' 버튼을 눌러야만 실행됩니다.</li>
            <li>화이트리스트 종목(TQQQ/SOXL/QLD 등)만 주문 가능. 1건/일일 한도 초과 시 거부.</li>
            <li>Kill Switch가 활성화되면 모든 주문이 즉시 차단됩니다.</li>
            <li>본 서비스는 투자자문/일임이 아니며, 모든 주문 결과는 사용자 본인의 책임입니다.</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
