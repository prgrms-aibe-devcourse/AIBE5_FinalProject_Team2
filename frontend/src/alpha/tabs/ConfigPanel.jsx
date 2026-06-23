import React, { useEffect, useState } from "react";
import { useTheme } from "../ThemeContext";
import {
  formalize, runBacktest, selectStrategyCandidate,
  listBrokerAccounts, linkWorkspaceBroker, setBrokerTrading,
  updateGoalProfile, patchBrokerLimits,
} from "../alphaApi";
import { Play, RefreshCw } from "lucide-react";
import { PanelHeader, Card, Empty, primaryBtn, DonutChart } from "./helpers";

const acctName = (a) => a
  ? `${a.brokerType === "BINANCE" ? "바이낸스" : "한국투자증권"} ${a.env === "REAL" ? "실전" : "모의"}계좌`
  : null;

const RISK = { 보수적: "🛡️ 보수", 보수: "🛡️ 보수", 중립: "⚖️ 중립", 공격적: "🔥 공격", 공격: "🔥 공격", conservative: "🛡️ 보수", moderate: "⚖️ 중립", aggressive: "🔥 공격" };
const TONE_STYLE = {
  "보수적":      { color: "#1E40AF", bg: "#DBEAFE", border: "#93C5FD" },
  "보수":        { color: "#1E40AF", bg: "#DBEAFE", border: "#93C5FD" },
  "중립":        { color: "#78350F", bg: "#FEF3C7", border: "#FCD34D" },
  "공격적":      { color: "#991B1B", bg: "#FEE2E2", border: "#FCA5A5" },
  "공격":        { color: "#991B1B", bg: "#FEE2E2", border: "#FCA5A5" },
  "conservative":{ color: "#1E40AF", bg: "#DBEAFE", border: "#93C5FD" },
  "moderate":    { color: "#78350F", bg: "#FEF3C7", border: "#FCD34D" },
  "aggressive":  { color: "#991B1B", bg: "#FEE2E2", border: "#FCA5A5" },
};

// ─── GoalProfileSummary ──────────────────────────────────────────────
function GoalProfileSummary({ profile, theme, wsId, onChange }) {
  const [currency, setCurrency] = useState("KRW");
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState({});
  const [modal, setModal] = useState(null); // null | { type: "nochange" } | { type: "confirm", changes: [] }
  const [saving, setSaving] = useState(false);
  const FX = 1380;

  if (!profile || typeof profile !== "object") return null;

  const fmtMoney = (v) => {
    if (v == null || v === "") return "—";
    const n = Number(v);
    if (currency === "USD") return `$${(n / FX).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    return `₩${n.toLocaleString("ko-KR")}`;
  };
  const DIR = {
    infinite_buying: "♾️ 무한매수법",
    "추세추종": "📈 추세추종",
    "평균회귀": "🔁 평균회귀",
    "모멘텀": "🚀 모멘텀",
    "변동성조절": "🎚️ 변동성조절",
    "잘모름": "🤔 미정",
  };
  const assets = Array.isArray(profile.assets) ? profile.assets : [];
  const alloc = profile.asset_allocation && typeof profile.asset_allocation === "object" ? profile.asset_allocation : null;
  const dir = profile.initial_strategy_direction || "";
  const dirLabel = DIR[dir] || (dir ? `🧭 ${dir}` : "—");
  const risk = profile.risk_tolerance || "";
  const riskLabel = RISK[risk] || (risk ? `⚖️ ${risk}` : "—");

  const castNum = (s) => { const n = Number(String(s).replace(/[,\s₩$]/g, "")); return isNaN(n) ? null : n; };

  const FIELDS = [
    { label: "🎯 목표", key: "goal", type: "text", wide: true,
      display: () => profile.goal || "—" },
    { label: "⏳ 투자 기간 (년)", key: "horizon_years", type: "num", max: 50,
      display: () => profile.horizon_years != null ? `${profile.horizon_years}년` : "—" },
    { label: "💰 초기 투자금 (KRW)", key: "initial_capital_krw", type: "num",
      display: () => fmtMoney(profile.initial_capital_krw) },
    { label: "📅 월 적립금 (KRW)", key: "monthly_contribution_krw", type: "num",
      display: () => fmtMoney(profile.monthly_contribution_krw) },
    { label: "💢 투자 성향", key: "risk_tolerance", type: "select",
      options: ["보수적", "중립", "공격적"],
      display: () => riskLabel },
    { label: "📈 하루 매수 한도 (KRW)", key: "daily_buy_limit_krw", type: "num",
      hint: "보통 자산의 1% 권장",
      display: () => profile.daily_buy_limit_krw != null && profile.daily_buy_limit_krw !== ""
        ? fmtMoney(profile.daily_buy_limit_krw)
        : (Number(profile.initial_capital_krw) > 0 ? `추천 ${fmtMoney(Math.round(Number(profile.initial_capital_krw) * 0.01))}` : "—"),
      muted: () => profile.daily_buy_limit_krw == null || profile.daily_buy_limit_krw === "" },
    { label: "🏷️ 하루 매도 한도 (KRW)", key: "daily_sell_limit_krw", type: "num",
      hint: "보통 자산의 1% 권장",
      display: () => profile.daily_sell_limit_krw != null && profile.daily_sell_limit_krw !== ""
        ? fmtMoney(profile.daily_sell_limit_krw)
        : (Number(profile.initial_capital_krw) > 0 ? `추천 ${fmtMoney(Math.round(Number(profile.initial_capital_krw) * 0.01))}` : "—"),
      muted: () => profile.daily_sell_limit_krw == null || profile.daily_sell_limit_krw === "" },
    { label: "📉 MDD 허용 (%)", key: "max_drawdown_target_pct", type: "num", wide: true,
      display: () => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span>{profile.max_drawdown_target_pct != null ? `${profile.max_drawdown_target_pct}%` : "—"}</span>
          <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
            background: "linear-gradient(135deg,#dbeafe 0%,#ede9fe 100%)", color: "#3730a3", border: "1px solid #c7d2fe" }}>
            {dirLabel}
          </span>
        </span>
      ) },
  ];

  const startEdit = () => {
    const d = {};
    FIELDS.forEach(f => { d[f.key] = profile[f.key] != null ? String(profile[f.key]) : ""; });
    setDraft(d);
    setEditMode(true);
  };

  const cancelEdit = () => { setEditMode(false); setDraft({}); };

  const horizonWarn  = editMode && Number(draft.horizon_years) > 50;
  const mddVal       = editMode ? Number(draft.max_drawdown_target_pct) : null;
  const mddWarn      = editMode && draft.max_drawdown_target_pct !== "" && (mddVal < 1 || mddVal > 99);
  const capital      = castNum(draft.initial_capital_krw ?? "");
  const buyWarn      = editMode && capital > 0 && castNum(draft.daily_buy_limit_krw ?? "") > capital;
  const sellWarn     = editMode && capital > 0 && castNum(draft.daily_sell_limit_krw ?? "") > capital;

  const handleSave = () => {
    if (horizonWarn || mddWarn) return; // 하드 오류 시 저장 불가
    const changes = [];
    FIELDS.forEach(f => {
      const rawDraft = (draft[f.key] ?? "").trim();
      const newVal = f.type === "num" ? castNum(rawDraft) : (rawDraft || null);
      const oldVal = profile[f.key] ?? null;
      const changed = String(newVal ?? "") !== String(oldVal ?? "");
      if (changed) changes.push({ label: f.label.replace(/^[^\s]+\s/, ""), key: f.key, oldVal, newVal, type: f.type });
    });
    if (changes.length === 0) { setModal({ type: "nochange" }); return; }
    setModal({ type: "confirm", changes });
  };

  const doSave = async () => {
    if (!modal || modal.type !== "confirm") return;
    setSaving(true);
    try {
      const payload = {};
      modal.changes.forEach(c => { payload[c.key] = c.newVal; });
      await updateGoalProfile(wsId, payload);
      setModal(null);
      setEditMode(false);
      setDraft({});
      if (onChange) await onChange();
    } catch (e) {
      alert("저장 실패: " + (e?.response?.data?.error || e.message));
    } finally { setSaving(false); }
  };

  const fmtVal = (val, type) => {
    if (val == null || val === "") return "—";
    if (type === "num") return Number(val).toLocaleString("ko-KR");
    return String(val);
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {/* 모달 — 확인 */}
      {modal?.type === "confirm" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 4000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={() => setModal(null)}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 400,
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F1F5F9" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>이렇게 수정할까요?</div>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>변경된 항목만 저장됩니다.</div>
            </div>
            <div style={{ padding: "14px 24px", display: "grid", gap: 8, maxHeight: 320, overflowY: "auto" }}>
              {modal.changes.map(c => (
                <div key={c.key} style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontWeight: 700, color: "#374151" }}>{c.label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#94A3B8", textDecoration: "line-through" }}>{fmtVal(c.oldVal, c.type)}</span>
                    <span style={{ color: "#64748B" }}>→</span>
                    <span style={{ color: "#111827", fontWeight: 700 }}>{fmtVal(c.newVal, c.type)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: "14px 24px", display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid #F1F5F9" }}>
              <button onClick={() => setModal(null)} style={{ padding: "9px 18px", borderRadius: 9,
                border: "1px solid #E2E8F0", background: "white", color: "#374151",
                fontSize: 13, fontWeight: 600, cursor: "pointer" }}>취소</button>
              <button onClick={doSave} disabled={saving} style={{ padding: "9px 18px", borderRadius: 9,
                border: "none", background: "linear-gradient(135deg,#3b82f6,#6366f1)",
                color: "white", fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
                {saving ? "저장 중…" : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 모달 — 변경 없음 */}
      {modal?.type === "nochange" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 4000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={() => setModal(null)}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 360,
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)", padding: "28px 28px 24px" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 8 }}>수정된 내용이 없어요</div>
            <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6, marginBottom: 20 }}>
              아무것도 변경되지 않았습니다.<br />그냥 취소할까요?
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setModal(null)} style={{ padding: "9px 18px", borderRadius: 9,
                border: "1px solid #E2E8F0", background: "white", color: "#374151",
                fontSize: 13, fontWeight: 600, cursor: "pointer" }}>계속 수정</button>
              <button onClick={cancelEdit} style={{ padding: "9px 18px", borderRadius: 9,
                border: "none", background: "#F1F5F9", color: "#374151",
                fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#E2E8F0"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#F1F5F9"; }}>
                그냥 취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 — 통화 토글 + 수정/저장/취소 버튼 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ display: "inline-flex", borderRadius: 999, border: `1px solid ${theme.panelBorder}`, overflow: "hidden" }}>
          {["KRW", "USD"].map((c) => (
            <button key={c} onClick={() => setCurrency(c)} style={{
              padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", border: "none",
              background: currency === c ? "linear-gradient(135deg,#dbeafe,#ede9fe)" : "white",
              color: currency === c ? "#3730a3" : theme.textMuted,
            }}>{c === "KRW" ? "₩ 원" : "$ 달러"}</button>
          ))}
        </div>
        {wsId && !editMode && (
          <button onClick={startEdit} style={{ padding: "5px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
            border: `1px solid ${theme.panelBorder}`, background: "white", color: theme.text, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 5 }}>
            ✏️ 수정
          </button>
        )}
        {editMode && (
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={cancelEdit} style={{ padding: "5px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: `1px solid ${theme.panelBorder}`, background: "white", color: "#64748B", cursor: "pointer" }}>
              취소
            </button>
            <button onClick={handleSave} disabled={horizonWarn || mddWarn}
              style={{ padding: "5px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "none",
                background: (horizonWarn || mddWarn) ? "#CBD5E1" : "linear-gradient(135deg,#3b82f6,#6366f1)",
                color: (horizonWarn || mddWarn) ? "#94A3B8" : "white",
                cursor: (horizonWarn || mddWarn) ? "not-allowed" : "pointer",
                boxShadow: (horizonWarn || mddWarn) ? "none" : "0 2px 8px rgba(99,102,241,0.3)" }}>
              저장
            </button>
          </div>
        )}
      </div>

      {/* 필드 그리드 */}
      <div className="cfg-fields-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {FIELDS.map((f) => {
          const isMuted = f.muted?.();
          return (
            <div key={f.key} style={{
              gridColumn: f.wide ? "1 / -1" : "auto",
              padding: "10px 12px", borderRadius: 8,
              background: editMode ? "#F1F5F9" : (theme.codeBg || "#f8fafc"),
              border: `1px solid ${editMode ? "#CBD5E1" : theme.panelBorder}`,
            }}>
              <div style={{ fontSize: 11.5, color: theme.textMuted, marginBottom: 4, fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
                <span>{f.label}</span>
                {f.hint && editMode && <span style={{ fontWeight: 400, fontStyle: "italic", color: theme.textMuted }}>{f.hint}</span>}
              </div>
              {editMode && f.type === "select" ? (
                <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                  {f.options.map(opt => {
                    const sel = (draft[f.key] ?? "") === opt;
                    const ts = TONE_STYLE[opt] || {};
                    return (
                      <button key={opt} onClick={() => setDraft(prev => ({ ...prev, [f.key]: opt }))}
                        style={{
                          flex: 1, padding: "5px 0", borderRadius: 7, fontSize: 12, fontWeight: 700,
                          cursor: "pointer", border: sel ? `1.5px solid ${ts.border || "#6366f1"}` : "1.5px solid #E2E8F0",
                          background: sel ? (ts.bg || "#EEF2FF") : "white",
                          color: sel ? (ts.color || "#3730a3") : "#94A3B8",
                          transition: "all 0.15s",
                        }}>
                        {opt === "보수적" ? "🛡️ 보수적" : opt === "중립" ? "⚖️ 중립" : "🔥 공격적"}
                      </button>
                    );
                  })}
                </div>
              ) : editMode ? (
                <>
                  {(() => {
                    const isHardErr = (f.key === "horizon_years" && horizonWarn) || (f.key === "max_drawdown_target_pct" && mddWarn);
                    const isSoftWarn = (f.key === "daily_buy_limit_krw" && buyWarn) || (f.key === "daily_sell_limit_krw" && sellWarn);
                    const lineColor = isHardErr ? "#ef4444" : isSoftWarn ? "#f59e0b" : "#CBD5E1";
                    const focusColor = isHardErr ? "#ef4444" : isSoftWarn ? "#f59e0b" : (theme.accent || "#6366f1");
                    return (
                      <input
                        type={f.type === "num" ? "number" : "text"}
                        value={draft[f.key] ?? ""}
                        onChange={e => setDraft(prev => ({ ...prev, [f.key]: e.target.value }))}
                        style={{ width: "100%", boxSizing: "border-box", padding: "3px 0", fontSize: 13, fontWeight: 700,
                          border: "none", borderBottom: `1.5px solid ${lineColor}`,
                          outline: "none", color: theme.text, background: "transparent" }}
                        onFocus={e => { e.currentTarget.style.borderBottomColor = focusColor; }}
                        onBlur={e => { e.currentTarget.style.borderBottomColor = lineColor; }}
                      />
                    );
                  })()}
                  {f.key === "horizon_years" && horizonWarn && (
                    <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4, fontWeight: 600 }}>
                      ⚠️ 투자 기간은 50년 이내로 입력해 주세요.
                    </div>
                  )}
                  {f.key === "max_drawdown_target_pct" && mddWarn && (
                    <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4, fontWeight: 600 }}>
                      ⚠️ MDD는 1~99% 사이로 입력해 주세요.
                    </div>
                  )}
                  {f.key === "daily_buy_limit_krw" && buyWarn && (
                    <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 4, fontWeight: 600 }}>
                      하루 매수 한도가 초기 투자금보다 큽니다.
                    </div>
                  )}
                  {f.key === "daily_sell_limit_krw" && sellWarn && (
                    <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 4, fontWeight: 600 }}>
                      하루 매도 한도가 초기 투자금보다 큽니다.
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 13, color: isMuted ? theme.textMuted : theme.text,
                  fontWeight: isMuted ? 600 : 700, fontStyle: isMuted ? "italic" : "normal" }}>
                  {f.display()}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {assets.length > 0 && (() => {
        const PALETTE = ["#60a5fa", "#a78bfa", "#f472b6", "#fbbf24", "#fb7185", "#22d3ee", "#facc15", "#fb923c"];
        const rawItems = assets.map((a, i) => ({
          label: a,
          value: alloc?.[a] != null ? Number(alloc[a]) : Math.round(100 / assets.length),
          color: PALETTE[i % PALETTE.length],
        }));
        const rawSum = rawItems.reduce((s, x) => s + x.value, 0) || 1;
        const cashPct = profile.cash_pct != null
          ? Number(profile.cash_pct)
          : Math.max(0, 100 - rawSum);
        const items = rawItems.map((it) => ({
          ...it,
          value: cashPct > 0.01 ? (it.value / rawSum) * (100 - cashPct) : it.value,
        }));
        if (cashPct > 0.01) items.push({ label: "현금", value: cashPct, color: "#22c55e" });
        const totalKrw = Number(profile.initial_capital_krw || 0);
        const totalLabel = totalKrw > 0
          ? (currency === "USD"
              ? `$${(totalKrw / FX).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
              : `₩${totalKrw.toLocaleString("ko-KR")}`)
          : `${items.length}종`;
        const amountOf = (pct) => {
          if (!totalKrw) return null;
          const krw = totalKrw * pct / 100;
          return currency === "USD"
            ? `$${(krw / FX).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
            : `₩${Math.round(krw).toLocaleString("ko-KR")}`;
        };
        return (
          <div style={{
            gridColumn: "1 / -1",
            padding: "14px 16px", borderRadius: 10,
            background: theme.codeBg || "#f8fafc",
            border: `1px solid ${theme.panelBorder}`,
          }}>
            <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 10, fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
              <span>📊 관심 자산 · 배분 비율</span>
              {totalKrw > 0 && (
                <span style={{ fontSize: 11, color: theme.text, fontWeight: 800 }}>
                  총 {currency === "USD" ? `$${(totalKrw/FX).toLocaleString("en-US",{maximumFractionDigits:0})}` : `₩${totalKrw.toLocaleString("ko-KR")}`}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <DonutChart items={items} centerLabel="총 자산" centerValue={totalLabel} theme={theme} size={160} thickness={32} amountOf={amountOf} />
              <div style={{ flex: 1, minWidth: 180, display: "grid", gap: 6 }}>
                {items.map((it) => (
                  <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: it.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, color: theme.text, fontWeight: 600 }}>{it.label}</span>
                    <span style={{ color: theme.textMuted, fontWeight: 700 }}>{it.value.toFixed(0)}%</span>
                    {amountOf(it.value) && (
                      <span style={{ color: theme.text, fontWeight: 800, minWidth: 90, textAlign: "right" }}>
                        {amountOf(it.value)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
      {wsId && <BrokerLimitsCard theme={theme} />}
      {profile.notes && (
        <div style={{
          padding: "10px 12px", borderRadius: 8,
          background: theme.codeBg || "#f8fafc",
          border: `1px solid ${theme.panelBorder}`, fontSize: 12, color: theme.textMuted, lineHeight: 1.6,
        }}>
          📝 {profile.notes}
        </div>
      )}
    </div>
  );
}

// ─── BrokerLimitsCard ────────────────────────────────────────────────
function BrokerLimitsCard({ theme }) {
  const [accts, setAccts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState({}); // { "brokerType-env-key": string }
  const [modal, setModal] = useState(null); // null | { type: "nochange" } | { type: "confirm", changes: [] }
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    try { setAccts(await listBrokerAccounts()); }
    catch { setAccts([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);

  const draftKey = (b, key) => `${b.brokerType}-${b.env}-${key}`;

  const startEdit = () => {
    const d = {};
    accts.forEach(b => {
      ["maxOrderUsd", "dailyOrderUsd"].forEach(key => {
        d[draftKey(b, key)] = b[key] != null ? String(b[key]) : "";
      });
    });
    setDraft(d);
    setEditMode(true);
  };

  const cancelEdit = () => { setEditMode(false); setDraft({}); };

  const handleSave = () => {
    const changes = [];
    accts.forEach(b => {
      ["maxOrderUsd", "dailyOrderUsd"].forEach(key => {
        const dk = draftKey(b, key);
        const newVal = parseInt(String(draft[dk] ?? "").replace(/[,\s$]/g, ""), 10);
        const oldVal = b[key] ?? 0;
        if (!isNaN(newVal) && newVal !== oldVal) {
          const label = (b.brokerType === "BINANCE" ? "Binance" : "KIS") +
            " " + (b.env === "REAL" ? "실전" : "모의") +
            " · " + (key === "maxOrderUsd" ? "1건당 한도" : "일일 누적 한도");
          changes.push({ dk, brokerType: b.brokerType, env: b.env, key, label, oldVal, newVal });
        }
      });
    });
    if (changes.length === 0) { setModal({ type: "nochange" }); return; }
    setModal({ type: "confirm", changes });
  };

  const doSave = async () => {
    if (!modal || modal.type !== "confirm") return;
    setSaving(true);
    try {
      for (const c of modal.changes) {
        await patchBrokerLimits(c.env, { [c.key]: c.newVal }, c.brokerType);
      }
      setModal(null);
      setEditMode(false);
      setDraft({});
      await reload();
    } catch (e) {
      alert("저장 실패: " + (e?.response?.data?.error || e.message));
    } finally { setSaving(false); }
  };

  if (loading) return null;
  if (!accts || accts.length === 0) {
    return (
      <div style={{
        gridColumn: "1 / -1", padding: "10px 12px", borderRadius: 8,
        background: "#FEF3C7", border: "1px solid #FCD34D",
        fontSize: 12, color: "#92400E",
      }}>
        ⚠️ KIS 브로커 계좌가 등록되지 않았습니다. 자동 큐 주문을 사용하려면 먼저 <b>설정 → 브로커 키</b>에서 KIS 모의/실전 계좌를 등록하세요.
      </div>
    );
  }
  return (
    <div style={{
      gridColumn: "1 / -1", padding: "14px 16px", borderRadius: 10,
      background: theme.codeBg || "#f8fafc", border: `1px solid ${theme.panelBorder}`,
    }}>
      {/* 확인 모달 */}
      {modal?.type === "confirm" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 4000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={() => setModal(null)}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 400,
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F1F5F9" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>이렇게 수정할까요?</div>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>변경된 항목만 저장됩니다.</div>
            </div>
            <div style={{ padding: "14px 24px", display: "grid", gap: 8 }}>
              {modal.changes.map(c => (
                <div key={c.dk} style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontWeight: 700, color: "#374151" }}>{c.label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#94A3B8", textDecoration: "line-through" }}>USD {Number(c.oldVal).toLocaleString("en-US")}</span>
                    <span style={{ color: "#64748B" }}>→</span>
                    <span style={{ color: "#111827", fontWeight: 700 }}>USD {Number(c.newVal).toLocaleString("en-US")}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: "14px 24px", display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid #F1F5F9" }}>
              <button onClick={() => setModal(null)} style={{ padding: "9px 18px", borderRadius: 9,
                border: "1px solid #E2E8F0", background: "white", color: "#374151",
                fontSize: 13, fontWeight: 600, cursor: "pointer" }}>취소</button>
              <button onClick={doSave} disabled={saving} style={{ padding: "9px 18px", borderRadius: 9,
                border: "none", background: "linear-gradient(135deg,#3b82f6,#6366f1)",
                color: "white", fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
                {saving ? "저장 중…" : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 변경 없음 모달 */}
      {modal?.type === "nochange" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 4000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={() => setModal(null)}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 360,
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)", padding: "28px 28px 24px" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 8 }}>수정된 내용이 없어요</div>
            <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6, marginBottom: 20 }}>
              아무것도 변경되지 않았습니다.<br />그냥 취소할까요?
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setModal(null)} style={{ padding: "9px 18px", borderRadius: 9,
                border: "1px solid #E2E8F0", background: "white", color: "#374151",
                fontSize: 13, fontWeight: 600, cursor: "pointer" }}>계속 수정</button>
              <button onClick={cancelEdit} style={{ padding: "9px 18px", borderRadius: 9,
                border: "none", background: "#F1F5F9", color: "#374151",
                fontSize: 13, fontWeight: 700, cursor: "pointer" }}>그냥 취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: theme.textMuted, fontWeight: 700 }}>
          🏦 브로커 주문 한도 (KIS) — 자동 큐 매수가 막히는 가장 흔한 원인
        </span>
        {!editMode
          ? <button onClick={startEdit} style={{ padding: "5px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
              border: `1px solid ${theme.panelBorder}`, background: "white", color: theme.text, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 5 }}>✏️ 수정</button>
          : <div style={{ display: "flex", gap: 6 }}>
              <button onClick={cancelEdit} style={{ padding: "5px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: `1px solid ${theme.panelBorder}`, background: "white", color: "#64748B", cursor: "pointer" }}>취소</button>
              <button onClick={handleSave} style={{ padding: "5px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                border: "none", background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "white", cursor: "pointer",
                boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }}>저장</button>
            </div>
        }
      </div>

      {/* 계좌 목록 */}
      <div style={{ display: "grid", gap: 10 }}>
        {accts.map((b) => (
          <div key={b.id} style={{
            padding: "10px 12px", borderRadius: 8,
            background: editMode ? "#F1F5F9" : "white",
            border: `1px solid ${theme.panelBorder}`,
          }}>
            {/* 배지 */}
            <span style={{
              display: "inline-block", marginBottom: 8,
              padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800,
              background: b.env === "REAL" ? "linear-gradient(135deg,#fecaca,#fca5a5)" : "linear-gradient(135deg,#bae6fd,#7dd3fc)",
              color: b.env === "REAL" ? "#7f1d1d" : "#075985",
              whiteSpace: "nowrap",
            }}>{acctName(b)}</span>
            {/* 필드 2컬럼 */}
            <div className="cfg-broker-limits-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {["maxOrderUsd", "dailyOrderUsd"].map((key) => {
                const dk = draftKey(b, key);
                const label = key === "maxOrderUsd" ? "1건당 한도" : "일일 누적 한도";
                return (
                  <div key={key}>
                    <div style={{ fontSize: 10, color: theme.textMuted, fontWeight: 600, marginBottom: 4 }}>{label}</div>
                    {editMode ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 11, color: theme.textMuted, flexShrink: 0 }}>USD</span>
                        <input
                          type="number" min="0" step="100"
                          value={draft[dk] ?? ""}
                          onChange={e => setDraft(prev => ({ ...prev, [dk]: e.target.value }))}
                          style={{ flex: 1, minWidth: 0, padding: "2px 0", fontSize: 13, fontWeight: 700,
                            border: "none", borderBottom: "1.5px solid #CBD5E1", outline: "none",
                            background: "transparent", color: theme.text }}
                          onFocus={e => { e.currentTarget.style.borderBottomColor = theme.accent || "#6366f1"; }}
                          onBlur={e => { e.currentTarget.style.borderBottomColor = "#CBD5E1"; }}
                        />
                      </div>
                    ) : (
                      <span style={{ fontSize: 14, fontWeight: 800, color: theme.text }}>
                        USD {Number(b[key] || 0).toLocaleString("en-US")}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: theme.textMuted, lineHeight: 1.5 }}>
        💡 자동 큐 주문 1건의 예상 총액이 위 <b>1건당 한도</b>를 넘으면 거부됩니다.
        실전 계좌는 안전을 위해 1건당 USD 50,000 / 일일 USD 200,000 상한이 적용됩니다.
      </div>
    </div>
  );
}

// ─── ConfigPanel (default export) ────────────────────────────────────
export default function ConfigPanel({ id, ws, onChange, setTab, topSummary }) {
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);
  const [btBusy, setBtBusy] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    listBrokerAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, []);

  const sc = ws.strategyConfig;
  const candidates = (sc && Array.isArray(sc.candidates))
    ? sc.candidates
    : (sc && typeof sc === "object" && (sc.strategy_name || sc.strategy_type))
        ? [{ ...sc, id: "cand-1" }]
        : [];
  const selectedId = sc?.selectedId || candidates[0]?.id || null;

  const onFormalize = async () => {
    if (busy) return;
    setBusy(true);
    try { await formalize(id); onChange(); }
    catch (e) { alert("정형화 실패: " + (e?.response?.data?.error || e.message)); }
    finally { setBusy(false); }
  };

  const onSelect = async (candId) => {
    try { await selectStrategyCandidate(id, candId); onChange(); }
    catch (e) { alert("선택 실패: " + (e?.response?.data?.error || e.message)); }
  };

  const onRunBacktest = async (candId) => {
    if (btBusy) return;
    setBtBusy(true);
    try {
      if (candId && candId !== selectedId) await selectStrategyCandidate(id, candId);
      await runBacktest(id);
      await onChange();
      if (setTab) setTab("report");
    } catch (e) {
      alert("백테스트 실패: " + (e?.response?.data?.error || e.message));
    } finally { setBtBusy(false); }
  };

  const onLink = async (e) => {
    const v = e.target.value;
    const newId = v === "" ? null : Number(v);
    setLinking(true);
    try {
      await linkWorkspaceBroker(id, newId);
      if (newId != null) {
        const picked = accounts.find(a => a.id === newId);
        if (picked && picked.env === "MOCK" && !picked.tradingEnabled) {
          try { await setBrokerTrading("MOCK", true); } catch { /* noop */ }
        }
      }
      onChange();
    } catch (err) {
      alert("계정 연결 실패: " + (err?.response?.data?.error || err.message));
    } finally {
      setLinking(false);
    }
  };

  const headerBtnLabel = busy ? "변환 중…" : (candidates.length > 0 ? "후보 다시 생성" : "Goal → Strategy");

  return (
    <div>
      <style>{`
        @keyframes candidateSpin { to { transform: rotate(360deg); } }
        @media (max-width: 1024px) {
          .cfg-outer-grid { grid-template-columns: 1fr !important; }
          .cfg-outer-grid > * { min-width: 0; }
          .cfg-fields-grid { grid-template-columns: 1fr !important; }
          .cfg-fields-grid > * { grid-column: auto !important; }
          .cfg-broker-limits-grid { grid-template-columns: 1fr !important; }
          .cfg-panel-header-action { flex-wrap: wrap; }
        }
      `}</style>
      <PanelHeader
        icon="🧩"
        title="Strategy Card"
        description="Goal Profile로 LLM이 6개 템플릿 중 3개 후보를 제시합니다. 후보 중 하나를 선택해 백테스트를 실행하세요."
        theme={theme}
        action={
          <button onClick={onFormalize} disabled={!ws.goalProfile || busy} style={primaryBtn(theme, busy)}>
            {candidates.length > 0 ? <RefreshCw size={14} /> : <Play size={14} />} {headerBtnLabel}
          </button>
        }
      />

      {topSummary}

      <div className="cfg-outer-grid" style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
        <Card title="Goal Profile (사용자 목표 구조화)" theme={theme} titleSize={19}>
          {ws.goalProfile
            ? <GoalProfileSummary profile={ws.goalProfile} theme={theme} wsId={id} onChange={onChange} />
            : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Empty msg="오른쪽 Heli 대화창에서 8가지 항목(목표/기간/초기금/적립금/성향/MDD/자산/방향)을 채워주세요" theme={theme} />
                <button
                  data-tutorial-id="tutorial-goal-ai-btn"
                  onClick={() => window.dispatchEvent(new CustomEvent("alpha:open-chat", { detail: { goal: true } }))}
                  style={{
                    width: "100%", padding: "11px 16px", borderRadius: 10, border: "none",
                    background: "linear-gradient(135deg,#60a5fa 0%,#3b82f6 50%,#6366f1 100%)",
                    color: "white", fontWeight: 700, fontSize: 13,
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
                    cursor: "pointer", boxShadow: "0 2px 10px rgba(99,102,241,0.3)",
                  }}
                >
                  🤖 AI와 목표 설정하기
                </button>
              </div>
            )}
        </Card>
        <div data-tutorial-id="tutorial-backtest-candidates">
        <Card title="Strategy 후보 (선택 → 백테스트)" theme={theme} titleSize={19}>
          {candidates.length === 0 ? (
            <Empty msg="Goal Profile이 채워지면 상단의 Goal → Strategy 버튼으로 3개 후보를 생성합니다" theme={theme} />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {candidates.map((c) => {
                const isSel = c.id === selectedId;
                return (
                  <div key={c.id} style={{
                    border: `${isSel ? 2 : 1}px solid ${isSel ? theme.accent : theme.panelBorder}`,
                    background: isSel ? `${theme.accent}0d` : theme.bg,
                    borderRadius: 10, padding: 12,
                    boxShadow: isSel ? `0 0 0 3px ${theme.accent}18` : "none",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 700, color: theme.text, fontSize: 14 }}>
                          {c.strategy_name || c.strategy_type}
                        </span>
                        {c.risk_tone && (() => {
                          const ts = TONE_STYLE[c.risk_tone];
                          const label = RISK[c.risk_tone] || c.risk_tone;
                          return <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: ts?.bg ?? "#F1F5F9", border: `1px solid ${ts?.border ?? "#CBD5E1"}`, color: ts?.color ?? "#475569" }}>{label}</span>;
                        })()}
                      </div>
                      {isSel && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 999,
                          background: `${theme.accent}18`, color: theme.accent, border: `1px solid ${theme.accent}40`,
                        }}>✓ 현재 적용 중</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6, lineHeight: 1.55 }}>
                      <b>{c.strategy_type}</b> · 자산: {Array.isArray(c.assets) ? c.assets.join(", ") : "-"}
                    </div>
                    {c.rationale && (
                      <div style={{ fontSize: 12, color: theme.text, marginBottom: 10, lineHeight: 1.6 }}>
                        {c.rationale}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 6 }}>
                      {isSel ? (
                        <div style={{
                          flex: 1, padding: "7px 10px", borderRadius: 7, textAlign: "center",
                          border: `1px solid ${theme.accent}40`, background: `${theme.accent}08`,
                          color: theme.accent, fontSize: 12, fontWeight: 600,
                        }}>✓ 이 후보 적용 중</div>
                      ) : (
                        <button
                          onClick={() => onSelect(c.id)}
                          style={{
                            flex: 1, padding: "7px 10px", borderRadius: 7,
                            border: `1px solid ${theme.panelBorder}`, background: "white",
                            color: theme.text, fontSize: 12, fontWeight: 600, cursor: "pointer",
                            transition: "all 0.18s ease",
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = theme.accent + "12";
                            e.currentTarget.style.borderColor = theme.accent;
                            e.currentTarget.style.color = theme.accent;
                            e.currentTarget.style.transform = "translateY(-1px)";
                            e.currentTarget.style.boxShadow = `0 4px 12px ${theme.accent}28`;
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = "white";
                            e.currentTarget.style.borderColor = theme.panelBorder;
                            e.currentTarget.style.color = theme.text;
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "none";
                          }}
                        >이 후보 선택</button>
                      )}
                      <button
                        onClick={() => !btBusy && onRunBacktest(c.id)}
                        disabled={btBusy}
                        style={{
                          flex: 1, padding: "7px 10px", borderRadius: 7, border: "none",
                          background: btBusy
                            ? "#E2E8F0"
                            : (theme.accentGradient || theme.accent),
                          color: btBusy ? "#94A3B8" : "white",
                          fontSize: 12, fontWeight: 700,
                          cursor: btBusy ? "not-allowed" : "pointer",
                          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
                          transition: "all 0.18s ease",
                        }}
                        onMouseEnter={e => { if (!btBusy) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 4px 14px ${theme.accent}44`; } }}
                        onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                      >
                        {btBusy ? (
                          <>
                            <span style={{
                              width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                              border: "2px solid #CBD5E1", borderTopColor: "#94A3B8",
                              animation: "candidateSpin 0.7s linear infinite",
                              display: "inline-block",
                            }} />
                            실행 중…
                          </>
                        ) : (
                          <>
                            <Play size={11} />
                            백테스트 실행
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        </div>

        <Card title="🔗 자동주문 BrokerAccount 연결" theme={theme} titleSize={19}>
          <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 0, marginBottom: 12, lineHeight: 1.6 }}>
            이 워크스페이스의 시그널이 BUY를 발사하면 선택된 계정 앞으로 <b>PENDING 제안</b>이 만들어집니다.
            승인은 좌측 사이드바 인박스에서 수동으로 해야 KIS로 전송됩니다.
          </p>
          <select
            value={ws.brokerAccountId || ""}
            onChange={onLink}
            disabled={linking}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 8,
              border: `1px solid ${theme.panelBorder}`, background: theme.bg,
              color: theme.text, fontSize: 13,
            }}>
            <option value="">— 연결 안 함 (자동주문 비활성) —</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>
                {acctName(a)}{a.tradingEnabled ? "" : " (거래 잠김)"}
              </option>
            ))}
          </select>
          {ws.brokerAccount && (
            <div style={{ marginTop: 10, fontSize: 12, color: theme.textMuted, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span>현재 연결: <b>{acctName(ws.brokerAccount)}</b>
                {ws.brokerAccount.tradingEnabled
                  ? <span style={{ color: "#059669", marginLeft: 6, fontWeight: 700 }}>· ✓ 거래 열림</span>
                  : <span style={{ color: "#B91C1C", marginLeft: 6 }}>· ⚠️ 거래 잠김 — <b>계좌 탭</b>에서 토글하세요</span>}
              </span>
            </div>
          )}
          {accounts.length === 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: theme.textMuted }}>
              등록된 BrokerAccount가 없습니다. <b>계좌 · 주문</b> 페이지에서 먼저 등록하세요.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
