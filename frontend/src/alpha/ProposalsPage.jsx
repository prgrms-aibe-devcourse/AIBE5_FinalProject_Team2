import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Inbox, CheckCircle2, XCircle, Clock, AlertTriangle, Loader2, RefreshCw, Plus, X,
} from "lucide-react";
import { useTheme, BRAND_GRADIENT } from "./ThemeContext";
import { useLanguage } from "../i18n/LanguageContext";
import { listProposals, approveProposal, rejectProposal, createProposal, listBrokerAccounts } from "./alphaApi";
import OrderConfirmModal from "./OrderConfirmModal";

/**
 * 자동주문 승인 큐.
 * SIGNAL이 만든 PENDING 제안 + 사용자 수동 제안을 모두 표시.
 * 승인 = 즉시 KIS 주문 (BrokerAccount.tradingEnabled 필수).
 */

const STATUS_ICONS = {
  PENDING:     { color: "#D97706", bg: "#FEF3C7", Icon: Clock },
  APPROVED:    { color: "#0369A1", bg: "#DBEAFE", Icon: CheckCircle2 },
  EXECUTED:    { color: "#15803D", bg: "#DCFCE7", Icon: CheckCircle2 },
  REJECTED:    { color: "#6B7280", bg: "#F3F4F6", Icon: XCircle },
  EXPIRED:     { color: "#6B7280", bg: "#F3F4F6", Icon: Clock },
  EXEC_FAILED: { color: "#B91C1C", bg: "#FEE2E2", Icon: AlertTriangle },
  ALL:         { color: "#6B7280", bg: "#F3F4F6", Icon: Clock },
};

const EMPTY_FORM = { brokerAccountId: "", ticker: "", side: "BUY", qty: "", limitPrice: "", rationale: "", orderType: "LIMIT", kisSubType: "정규장" };

export default function ProposalsPage() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [filter, setFilter] = useState("ALL");
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(null); // proposal
  const [modalErr, setModalErr] = useState(null);

  // 수동 제안 생성 상태
  const [createOpen, setCreateOpen] = useState(false);
  const [brokerAccounts, setBrokerAccounts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [createBusy, setCreateBusy] = useState(false);
  const [createErr, setCreateErr] = useState(null);
  const [activeTab, setActiveTab] = useState("BUY");

  const rows = filter === "ALL" ? allRows : allRows.filter(r => r.status === filter);
  const filterCount = (s) => s === "ALL" ? allRows.length : allRows.filter(r => r.status === s).length;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listProposals(null);
      setAllRows(data);
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = async () => {
    setCreateErr(null);
    setForm(EMPTY_FORM);
    setActiveTab("BUY");
    setCreateOpen(true);
    try {
      const accts = await listBrokerAccounts();
      setBrokerAccounts(Array.isArray(accts) ? accts : []);
    } catch (_) { setBrokerAccounts([]); }
  };

  const onSubmitCreate = async (e) => {
    e.preventDefault();
    if (!form.brokerAccountId || !form.ticker || !form.qty) return;
    setCreateBusy(true);
    setCreateErr(null);
    const rationaleText = form.rationale.trim()
      || `${form.orderType === "LIMIT" ? `지정가(${form.kisSubType})` : form.orderType === "MARKET" ? "시장가" : "LOC"} 수동 제안`;
    try {
      await createProposal({
        brokerAccountId: Number(form.brokerAccountId),
        ticker: form.ticker.trim().toUpperCase(),
        side: form.side,
        qty: form.qty,
        orderType: form.orderType,
        ...(form.orderType !== "MARKET" && form.limitPrice ? { limitPrice: form.limitPrice } : {}),
        rationale: rationaleText,
      });
      setCreateOpen(false);
      await load();
    } catch (e) {
      setCreateErr(e?.response?.data?.error || e.message);
    } finally {
      setCreateBusy(false);
    }
  };

  const onApprove = (p) => {
    setModalErr(null);
    setConfirming(p);
  };

  const onConfirmApprove = async () => {
    if (!confirming) return;
    setBusyId(confirming.id);
    setModalErr(null);
    try {
      await approveProposal(confirming.id);
      setConfirming(null);
      await load();
    } catch (e) {
      setModalErr(e?.response?.data?.error || e.message);
    } finally {
      setBusyId(null);
    }
  };

  const onReject = async (p) => {
    const reason = window.prompt(t("proposals.rejectPrompt"), "");
    if (reason === null) return;
    setBusyId(p.id);
    try {
      await rejectProposal(p.id, reason);
      await load();
    } catch (e) {
      alert(t("proposals.rejectFailed").replace("{err}", e?.response?.data?.error || e.message));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="alpha-proposals" style={{ padding: "36px 40px 80px", background: "#F8FAFC", minHeight: "calc(100vh - 44px)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{
            width: 54, height: 54, borderRadius: 17, flexShrink: 0,
            background: "linear-gradient(135deg,#60a5fa 0%,#6366f1 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 6px 20px rgba(99,102,241,0.32)",
          }}>
            <Inbox size={24} color="white" strokeWidth={2.2} />
          </div>
          <div>
            <h1 style={{
              margin: 0, fontSize: 26, fontWeight: 800, lineHeight: 1.15,
              background: "linear-gradient(90deg,#3b82f6 0%,#6366f1 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              {t("proposals.title")}
            </h1>
            <p style={{ margin: "5px 0 0", fontSize: 13, color: "#64748B", fontWeight: 500 }}>
              {t("proposals.subtitle")}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={openCreate}
            style={{
              background: "linear-gradient(135deg,#60a5fa 0%,#6366f1 100%)",
              color: "white", border: "none",
              padding: "9px 18px", borderRadius: 12,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13,
              fontWeight: 700, boxShadow: "0 4px 12px rgba(99,102,241,0.28)",
            }}>
            <Plus size={14} /> {t("proposals.create") || "수동 제안"}
          </button>
          <button onClick={load} disabled={loading}
            style={{
              background: "white", border: "1.5px solid #E2E8F0",
              color: "#475569", padding: "9px 18px", borderRadius: 12,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13,
              fontWeight: 600, boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}>
            {loading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
            {t("proposals.refresh")}
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className="filter-row" style={{ display: "flex", gap: 8, marginBottom: 30, flexWrap: "wrap" }}>
        {["ALL", "PENDING", "EXECUTED", "REJECTED", "EXEC_FAILED"].map(s => {
          const active = filter === s;
          const cnt = filterCount(s);
          const I = STATUS_ICONS[s]?.Icon;
          return (
            <button key={s} onClick={() => setFilter(s)} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 15px", borderRadius: 20, border: "none",
              background: active
                ? "linear-gradient(135deg,#60a5fa 0%,#6366f1 100%)"
                : "rgba(148,163,184,0.12)",
              color: active ? "white" : "#475569",
              fontSize: 13, fontWeight: active ? 700 : 500,
              cursor: "pointer",
              boxShadow: active ? "0 3px 12px rgba(99,102,241,0.28)" : "none",
              transition: "all 0.15s",
            }}>
              {I && <I size={13} />}
              {t(`proposals.status.${s}`) || s}
              {cnt > 0 && (
                <span style={{
                  background: active ? "rgba(255,255,255,0.25)" : "rgba(100,116,139,0.14)",
                  color: active ? "white" : "#64748B",
                  borderRadius: 10, padding: "0 6px",
                  fontSize: 11, fontWeight: 700, lineHeight: "18px",
                }}>
                  {cnt}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <div style={{
          padding: 12, background: "#FEE2E2", color: "#B91C1C",
          borderRadius: 8, fontSize: 13, marginBottom: 12,
        }}>{t("proposals.error").replace("{err}", error)}</div>
      )}

      {/* 카드 목록 */}
      {rows.length === 0 && !loading && (
        <div style={{
          padding: 40, textAlign: "center", color: theme.textMuted, fontSize: 14,
          background: theme.panel, borderRadius: 12, border: `1px dashed ${theme.panelBorder}`,
        }}>
          {t("proposals.noItems")}
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {rows.map(p => {
          const meta = STATUS_ICONS[p.status] || { color: "#6B7280", bg: "#F3F4F6", Icon: Clock };
          const SideIcon = meta.Icon;
          const isPending = p.status === "PENDING";
          return (
            <div key={p.id} className="prop-card"
              style={{
                background: theme.panel, border: `1px solid ${theme.panelBorder}`,
                borderRadius: 12, padding: 14, display: "flex", alignItems: "center", gap: 14,
              }}>
              <div style={{
                background: meta.bg, color: meta.color,
                padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
              }}>
                <SideIcon size={12} />{t(`proposals.status.${p.status}`) || p.status}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: theme.text, marginBottom: 2 }}>
                  <span style={{
                    color: p.side === "BUY" ? "#15803D" : "#B91C1C",
                    marginRight: 6,
                  }}>{p.side}</span>
                  {p.qtyDecimal != null ? `${p.qtyDecimal} · ${p.ticker}` : `${p.qty}주 · ${p.ticker}`}
                  {p.limitPrice && <span style={{ color: theme.textMuted, fontWeight: 500, marginLeft: 8 }}>
                    @ {p.qtyDecimal != null ? `${Number(p.limitPrice)} USDT` : `$${Number(p.limitPrice).toFixed(2)}`}
                  </span>}
                </div>
                <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 2 }}>
                  {p.rationale || t("proposals.noReason")}
                </div>
                <div style={{ fontSize: 11, color: theme.textMuted, opacity: 0.8 }}>
                  source={p.source}
                  {p.sourceSignalId && ` · signal#${p.sourceSignalId}`}
                  {" · "}broker#{p.brokerAccountId}
                  {" · "}{new Date(p.createdAt).toLocaleString("ko-KR")}
                  {p.kisOrderNo && ` · ${p.qtyDecimal != null ? "Binance" : "KIS"}#${p.kisOrderNo}`}
                  {p.execError && (
                    <span style={{ color: "#B91C1C", marginLeft: 8 }}>· {p.execError}</span>
                  )}
                </div>
              </div>
              {isPending && (
                <div className="prop-actions" style={{ display: "flex", gap: 6 }}>
                  <button disabled={busyId === p.id} onClick={() => onApprove(p)}
                    style={{
                      background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)",
                      color: "#fff", fontWeight: 700, fontSize: 12,
                      border: "none", borderRadius: 8, padding: "8px 14px",
                      cursor: busyId === p.id ? "wait" : "pointer",
                    }}>
                    {busyId === p.id ? "..." : t("proposals.approve")}
                  </button>
                  <button disabled={busyId === p.id} onClick={() => onReject(p)}
                    style={{
                      background: "#fff", color: "#374151", fontWeight: 600, fontSize: 12,
                      border: "1px solid #E5E7EB", borderRadius: 8, padding: "8px 12px",
                      cursor: busyId === p.id ? "wait" : "pointer",
                    }}>
                    {t("proposals.reject")}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .alpha-proposals { padding: 16px 12px !important; }
          .alpha-proposals h1 { font-size: 22px !important; }
          .alpha-proposals .filter-row { overflow-x: auto; flex-wrap: nowrap !important; -webkit-overflow-scrolling: touch; }
          .alpha-proposals .filter-row button { white-space: nowrap; flex-shrink: 0; }
          .alpha-proposals .prop-card { flex-wrap: wrap !important; }
          .alpha-proposals .prop-card .prop-actions { width: 100%; margin-top: 8px; }
          .alpha-proposals .prop-card .prop-actions button { flex: 1; min-height: 44px; font-size: 13px !important; }
        }
      `}</style>
      <OrderConfirmModal
        open={!!confirming}
        proposal={confirming}
        loading={busyId === confirming?.id}
        error={modalErr}
        onConfirm={onConfirmApprove}
        onClose={() => { if (busyId !== confirming?.id) { setConfirming(null); setModalErr(null); } }}
      />

      {/* 수동 제안 생성 모달 */}
      {createOpen && (() => {
        const isBuy = activeTab === "BUY";
        const ac = isBuy ? "#EF4444" : "#3B82F6";
        const acSoft = isBuy ? "#FFF1F1" : "#EFF6FF";
        const acMid  = isBuy ? "#FECACA" : "#BFDBFE";
        return (
        <div onClick={() => !createBusy && setCreateOpen(false)} style={{
          position: "fixed", inset: 0, background: "rgba(2,6,23,0.7)",
          backdropFilter: "blur(6px)", zIndex: 3000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "100%", maxWidth: 460, borderRadius: 22, overflow: "hidden",
            boxShadow: "0 40px 100px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)",
          }}>

            {/* ── 다크 헤더 ── */}
            <div style={{ background: "linear-gradient(135deg,#0F172A 0%,#1E293B 100%)", padding: "22px 22px 18px" }}>
              {/* 타이틀(좌) + 계좌선택·X(우) */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "#475569", letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 4 }}>Order Proposal</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "white", letterSpacing: -0.3 }}>수동 주문 제안</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <select
                    required value={form.brokerAccountId}
                    onChange={e => setForm(f => ({ ...f, brokerAccountId: e.target.value }))}
                    style={{
                      padding: "8px 12px", borderRadius: 9,
                      border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.07)",
                      color: form.brokerAccountId ? "#E2E8F0" : "#64748B",
                      fontSize: 12.5, fontWeight: 600, outline: "none", cursor: "pointer", maxWidth: 200,
                    }}
                  >
                    <option value="" style={{ color: "#0F172A" }}>계좌 선택 *</option>
                    {brokerAccounts.map(a => (
                      <option key={a.id} value={a.id} style={{ color: "#0F172A" }}>
                        [{a.env}] {a.brokerType} {a.accountAlias || a.accountNumber || `#${a.id}`}
                        {a.tradingEnabled ? "" : " (거래 비활성)"}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => !createBusy && setCreateOpen(false)} style={{
                    width: 32, height: 32, borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.05)", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B",
                  }}><X size={14} /></button>
                </div>
              </div>
            </div>

            {/* ── 탭 ── */}
            <div style={{ display: "flex", background: "#F8FAFC", borderBottom: "1.5px solid #E2E8F0" }}>
              {[
                { key: "BUY",     label: "매수",     color: "#EF4444", soft: "#FFF1F1" },
                { key: "SELL",    label: "매도",     color: "#3B82F6", soft: "#EFF6FF" },
                { key: "CANCEL",  label: "정정/취소", color: "#10B981", soft: "#F0FDF4" },
                { key: "HISTORY", label: "주문내역",  color: "#8B5CF6", soft: "#F5F3FF" },
              ].map(({ key, label, color, soft }) => {
                const isAct = activeTab === key;
                return (
                  <button key={key} type="button"
                    onClick={() => { setActiveTab(key); if (key === "BUY" || key === "SELL") setForm(f => ({ ...f, side: key })); }}
                    style={{
                      flex: 1, padding: "12px 0", fontSize: 13, fontWeight: isAct ? 800 : 500,
                      border: "none", cursor: "pointer", transition: "all 0.15s",
                      background: isAct ? soft : "transparent",
                      color: isAct ? color : "#94A3B8",
                      borderBottom: isAct ? `2.5px solid ${color}` : "2.5px solid transparent",
                    }}>{label}</button>
                );
              })}
            </div>

            {/* ── 콘텐츠 ── */}
            <div style={{ background: "white" }}>
              {(activeTab === "CANCEL" || activeTab === "HISTORY") ? (
                <div style={{ padding: "48px 22px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                  {activeTab === "CANCEL" ? "정정/취소는 체결 목록에서 지원 예정입니다." : "주문내역은 아래 목록에서 확인하세요."}
                </div>
              ) : (
                <form onSubmit={onSubmitCreate} style={{ padding: "20px 22px 22px" }}>

                  {/* 종목 */}
                  <div style={{ marginBottom: 13 }}>
                    <label style={mLabelStyle}>종목 <span style={{ color: "#EF4444" }}>*</span></label>
                    <select required value={form.ticker} onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))} style={mInputStyle}>
                      <option value="">종목 선택</option>
                      {TICKER_LIST.map(tk => <option key={tk.value} value={tk.value}>{tk.value} — {tk.name}</option>)}
                    </select>
                  </div>

                  {/* 주문유형 */}
                  <div style={{ marginBottom: 13 }}>
                    <label style={mLabelStyle}>주문유형 <span style={{ color: "#EF4444" }}>*</span></label>
                    <div style={{ display: "flex", gap: 6 }}>
                      {ORDER_TYPES.map(ot => (
                        <button key={ot.value} type="button"
                          onClick={() => setForm(f => ({ ...f, orderType: ot.value, kisSubType: ot.value === "LIMIT" ? "정규장" : "", limitPrice: ot.value === "MARKET" ? "" : f.limitPrice }))}
                          style={{
                            flex: 1, padding: "9px 6px", borderRadius: 9, fontSize: 12.5, fontWeight: 600,
                            border: `1.5px solid ${form.orderType === ot.value ? ac : "#E2E8F0"}`,
                            background: form.orderType === ot.value ? acSoft : "#F8FAFC",
                            color: form.orderType === ot.value ? ac : "#64748B",
                            cursor: "pointer", transition: "all 0.12s",
                          }}>{ot.label}</button>
                      ))}
                    </div>
                    {form.orderType === "LIMIT" && (
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
                        {LIMIT_SUB_TYPES.map(st => (
                          <button key={st} type="button"
                            onClick={() => setForm(f => ({ ...f, kisSubType: st }))}
                            style={{
                              padding: "4px 11px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                              border: `1.5px solid ${form.kisSubType === st ? ac : "#E2E8F0"}`,
                              background: form.kisSubType === st ? acSoft : "#F8FAFC",
                              color: form.kisSubType === st ? ac : "#64748B",
                              cursor: "pointer", transition: "all 0.12s",
                            }}>{st}</button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 수량 + 단가 */}
                  <div style={{ display: "grid", gridTemplateColumns: form.orderType === "MARKET" ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 13 }}>
                    <div>
                      <label style={mLabelStyle}>수량 <span style={{ color: "#EF4444" }}>*</span></label>
                      <input required type="number" step="any" min="0.0001" placeholder="0"
                        value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} style={mInputStyle} />
                    </div>
                    {form.orderType !== "MARKET" && (
                      <div>
                        <label style={mLabelStyle}>단가 <span style={{ color: "#EF4444" }}>*</span></label>
                        <input required type="number" step="any" min="0" placeholder="0.00"
                          value={form.limitPrice} onChange={e => setForm(f => ({ ...f, limitPrice: e.target.value }))} style={mInputStyle} />
                      </div>
                    )}
                  </div>

                  {/* 사유 */}
                  <div style={{ marginBottom: 4 }}>
                    <label style={mLabelStyle}>사유 <span style={{ color: "#CBD5E1", fontWeight: 400 }}>(선택)</span></label>
                    <input placeholder="예: 기술적 지표 기반 매수 판단"
                      value={form.rationale} onChange={e => setForm(f => ({ ...f, rationale: e.target.value }))} style={mInputStyle} />
                  </div>

                  {createErr && (
                    <div style={{ padding: "9px 12px", background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA", borderRadius: 9, fontSize: 12, marginTop: 12 }}>{createErr}</div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                    <button type="button" onClick={() => !createBusy && setCreateOpen(false)} style={{
                      flex: 1, padding: "13px", borderRadius: 11, border: "1.5px solid #E2E8F0",
                      background: "white", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer",
                    }}>취소</button>
                    <button type="submit" disabled={createBusy} style={{
                      flex: 2, padding: "13px", borderRadius: 11, border: "none",
                      background: createBusy ? "#E2E8F0" : isBuy
                        ? "linear-gradient(135deg,#F87171 0%,#DC2626 100%)"
                        : "linear-gradient(135deg,#60A5FA 0%,#2563EB 100%)",
                      color: createBusy ? "#94A3B8" : "white",
                      fontSize: 13.5, fontWeight: 800, cursor: createBusy ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      boxShadow: createBusy ? "none" : isBuy ? "0 4px 18px rgba(239,68,68,0.35)" : "0 4px 18px rgba(37,99,235,0.35)",
                      transition: "all 0.15s",
                    }}>
                      {createBusy && <Loader2 size={14} className="spin" />}
                      {isBuy ? "매수 주문 제출" : "매도 주문 제출"}
                    </button>
                  </div>
                </form>
              )}
            </div>

          </div>
        </div>
        );
      })()}
    </div>
  );
}

const labelStyle = { fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6, marginTop: 14 };
const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E2E8F0",
  fontSize: 13, outline: "none", color: "#0F172A", boxSizing: "border-box", background: "white",
};

// 수동 제안 모달 전용 스타일
const mLabelStyle = { fontSize: 11.5, fontWeight: 700, color: "#374151", display: "block", marginBottom: 5, letterSpacing: 0.2 };
const mInputStyle = {
  width: "100%", padding: "10px 13px", borderRadius: 9, border: "1.5px solid #E2E8F0",
  fontSize: 13, outline: "none", color: "#0F172A", boxSizing: "border-box", background: "#FAFAFA",
};

const TICKER_LIST = [
  { value: "005930", name: "삼성전자 🇰🇷" },
  { value: "000660", name: "SK하이닉스 🇰🇷" },
  { value: "035420", name: "NAVER 🇰🇷" },
  { value: "005380", name: "현대차 🇰🇷" },
  { value: "051910", name: "LG화학 🇰🇷" },
  { value: "006400", name: "삼성SDI 🇰🇷" },
  { value: "035720", name: "카카오 🇰🇷" },
  { value: "207940", name: "삼성바이오로직스 🇰🇷" },
  { value: "SPY",   name: "S&P500 ETF 🇺🇸" },
  { value: "QQQ",   name: "나스닥100 ETF 🇺🇸" },
  { value: "AAPL",  name: "애플 🇺🇸" },
  { value: "TSLA",  name: "테슬라 🇺🇸" },
  { value: "NVDA",  name: "엔비디아 🇺🇸" },
  { value: "MSFT",  name: "마이크로소프트 🇺🇸" },
  { value: "AMZN",  name: "아마존 🇺🇸" },
  { value: "META",  name: "메타 🇺🇸" },
  { value: "GOOGL", name: "구글 🇺🇸" },
  { value: "NFLX",  name: "넷플릭스 🇺🇸" },
  { value: "AMD",   name: "AMD 🇺🇸" },
  { value: "INTC",  name: "인텔 🇺🇸" },
  { value: "TSM",   name: "TSMC 🇺🇸" },
  { value: "V",     name: "비자 🇺🇸" },
  { value: "MA",    name: "마스터카드 🇺🇸" },
  { value: "JPM",   name: "JP모건 🇺🇸" },
  { value: "DIS",   name: "디즈니 🇺🇸" },
  { value: "WMT",   name: "월마트 🇺🇸" },
  { value: "COIN",  name: "코인베이스 🇺🇸" },
  { value: "PLTR",  name: "팔란티어 🇺🇸" },
];

const ORDER_TYPES = [
  { value: "LIMIT",  label: "보통(지정가)" },
  { value: "MARKET", label: "시장가" },
  { value: "LOC",    label: "LOC(장마감)" },
];

const LIMIT_SUB_TYPES = ["정규장", "장전시간외", "장후시간외", "조건부지정가", "최유리지정가", "최우선지정가"];
