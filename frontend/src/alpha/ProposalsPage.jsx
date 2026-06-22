import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Inbox, CheckCircle2, XCircle, Clock, AlertTriangle, Loader2, RefreshCw, Plus, X, Pencil, Trash2,
} from "lucide-react";
import { useTheme, BRAND_GRADIENT } from "./ThemeContext";
import { useLanguage } from "../i18n/useLanguage";
import { listProposals, approveProposal, rejectProposal, createProposal, amendProposal, listBrokerAccounts, deleteProposal, deleteProposalsBulk } from "./alphaApi";
import OrderConfirmModal from "./OrderConfirmModal";
import OrderAmendModal from "./OrderAmendModal";
import OrderRejectModal from "./OrderRejectModal";
import { TICKER_LIST, CRYPTO_LIST, ORDER_TYPES, LIMIT_SUB_TYPES } from "./stockList";
import Toast from "../components/common/Toast";
import { useNotificationStore } from "../store/useNotificationStore";

/**
 * 자동주문 승인 큐.
 * SIGNAL이 만든 PENDING 제안 + 사용자 수동 제안을 모두 표시.
 * 승인 = 즉시 KIS 주문 (BrokerAccount.tradingEnabled 필수).
 */

function expiryInfo(expiresAt) {
  const diffMs = new Date(expiresAt) - new Date();
  if (diffMs <= 0) return { expired: true, label: null, urgent: false };
  const h = Math.floor(diffMs / 3600000);
  const m = Math.floor((diffMs % 3600000) / 60000);
  const label = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return { expired: false, label, urgent: diffMs < 3600000 };
}

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
  const fetchNotifications = useNotificationStore((s) => s.fetch);
  const [toast, setToast] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(null); // proposal
  const [modalErr, setModalErr] = useState(null);

  // 주문 정정 모달 상태
  const [amending, setAmending] = useState(null);     // proposal
  const [amendErr, setAmendErr] = useState(null);
  const [amendBusy, setAmendBusy] = useState(false);  // 정정 저장 중
  const [cancelBusy, setCancelBusy] = useState(false); // 주문 취소(거절) 중

  // 거절 모달 상태
  const [rejecting, setRejecting] = useState(null);   // proposal
  const [rejectErr, setRejectErr] = useState(null);
  const [rejectBusy, setRejectBusy] = useState(false);

  // 수동 제안 생성 상태
  const [createOpen, setCreateOpen] = useState(false);
  const [brokerAccounts, setBrokerAccounts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [createBusy, setCreateBusy] = useState(false);
  const [createErr, setCreateErr] = useState(null);
  const [activeTab, setActiveTab] = useState("BUY");
  const [fieldErrors, setFieldErrors] = useState({});
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: "single", id, ticker } | { type: "bulk", count }

  // expiresAt 지난 PENDING → 클라이언트에서 EXPIRED로 정규화
  const normalizedRows = allRows.map(r =>
    r.status === "PENDING" && r.expiresAt && new Date(r.expiresAt) <= new Date()
      ? { ...r, status: "EXPIRED" }
      : r
  );
  const rows = filter === "ALL" ? normalizedRows : normalizedRows.filter(r => r.status === filter);
  const filterCount = (s) => s === "ALL" ? normalizedRows.length : normalizedRows.filter(r => r.status === s).length;

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

  // 가장 빨리 만료될 PENDING 제안 시점에 자동 reload
  useEffect(() => {
    const futurePending = allRows
      .filter(r => r.status === "PENDING" && r.expiresAt)
      .map(r => new Date(r.expiresAt).getTime())
      .filter(t => t > Date.now());
    if (futurePending.length === 0) return;
    const nearest = Math.min(...futurePending);
    const delay = nearest - Date.now() + 1000;
    const timer = setTimeout(() => load(), delay);
    return () => clearTimeout(timer);
  }, [allRows, load]);

  const openCreate = async () => {
    setCreateErr(null);
    setFieldErrors({});
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
    const errs = {};
    if (!form.brokerAccountId) errs.brokerAccountId = t("proposals.validate.account");
    if (!form.ticker) errs.ticker = t("proposals.validate.ticker");
    if (!form.qty || Number(form.qty) <= 0) errs.qty = t("proposals.validate.qty");
    if (form.orderType !== "MARKET" && !form.limitPrice) errs.limitPrice = t("proposals.validate.price");
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setCreateBusy(true);
    setCreateErr(null);
    const rationaleText = form.rationale.trim()
      || t("proposals.form.defaultRationale", { orderType: form.orderType === "LIMIT" ? `LIMIT(${form.kisSubType})` : form.orderType === "MARKET" ? "MARKET" : "LOC" });
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
    const ticker = confirming.ticker;
    const side = confirming.side;
    setBusyId(confirming.id);
    setModalErr(null);
    try {
      await approveProposal(confirming.id);
      setConfirming(null);
      await load();
      setToast({
        type: "order",
        title: t("proposals.toast.orderSent"),
        body: t("proposals.toast.orderSentBody", { ticker, side }),
      });
      window.dispatchEvent(new CustomEvent("alpha:proposal-updated"));
      fetchNotifications().catch(() => {});
    } catch (e) {
      setModalErr(e?.response?.data?.error || e.message);
    } finally {
      setBusyId(null);
    }
  };

  const onReject = (p) => {
    setRejectErr(null);
    setRejecting(p);
  };

  const onConfirmReject = async (reason) => {
    if (!rejecting) return;
    setRejectBusy(true);
    setRejectErr(null);
    try {
      await rejectProposal(rejecting.id, reason || "거절");
      setRejecting(null);
      await load();
      setToast({ type: "info", title: t("proposals.toast.rejected"), body: t("proposals.toast.rejectedBody", { ticker: rejecting.ticker }) });
    } catch (e) {
      setRejectErr(e?.response?.data?.error || e.message);
    } finally {
      setRejectBusy(false);
    }
  };

  // ── 주문 정정 ──────────────────────────────────────────────
  const onAmend = (p) => {
    setAmendErr(null);
    setAmending(p);
  };

  const onSaveAmend = async (fields) => {
    if (!amending) return;
    setAmendBusy(true);
    setAmendErr(null);
    try {
      await amendProposal(amending.id, fields);
      setAmending(null);
      await load();
    } catch (e) {
      setAmendErr(e?.response?.data?.error || e.message);
    } finally {
      setAmendBusy(false);
    }
  };

  // 주문 취소 = 큐에서 제거(거절 처리). 정정 모달 우측 버튼.
  const onCancelOrder = async () => {
    if (!amending) return;
    setCancelBusy(true);
    setAmendErr(null);
    try {
      await rejectProposal(amending.id, "주문 취소");
      setAmending(null);
      await load();
    } catch (e) {
      setAmendErr(e?.response?.data?.error || e.message);
    } finally {
      setCancelBusy(false);
    }
  };

  const enterDeleteMode = () => setDeleteMode(true);
  const exitDeleteMode = () => { setDeleteMode(false); setSelectedIds(new Set()); };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(rows.map(r => r.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const onDeleteOne = (id) => {
    const target = rows.find(r => r.id === id);
    setDeleteConfirm({ type: "single", id, ticker: target?.ticker || `#${id}`, side: target?.side });
  };

  const onDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    setDeleteConfirm({ type: "bulk", count: selectedIds.size });
  };

  const executeDeleteOne = async (id) => {
    setDeleteBusy(true);
    try {
      await deleteProposal(id);
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      await load();
      setToast({ type: "info", title: t("proposals.toast.deleted"), body: t("proposals.toast.deletedSingle") });
    } catch (e) {
      setToast({ type: "error", title: t("proposals.toast.deleteFailed"), body: e?.response?.data?.error || e.message });
    } finally {
      setDeleteBusy(false);
      setDeleteConfirm(null);
    }
  };

  const executeDeleteBulk = async () => {
    setDeleteBusy(true);
    try {
      const count = selectedIds.size;
      await deleteProposalsBulk([...selectedIds]);
      setSelectedIds(new Set());
      setDeleteMode(false);
      await load();
      setToast({ type: "info", title: t("proposals.toast.deleted"), body: t("proposals.toast.deletedBulk", { count }) });
    } catch (e) {
      setToast({ type: "error", title: t("proposals.toast.deleteFailed"), body: e?.response?.data?.error || e.message });
    } finally {
      setDeleteBusy(false);
      setDeleteConfirm(null);
    }
  };

  return (
    <div className="alpha-proposals" style={{ padding: "clamp(16px, 3vw, 36px) clamp(12px, 3vw, 40px) 80px", background: "#F8FAFC", minHeight: "calc(100vh - 44px)" }}>
      {toast && <Toast title={toast.title} body={toast.body} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── 삭제 확인 모달 ── */}
      {deleteConfirm && (
        <div
          onClick={() => !deleteBusy && setDeleteConfirm(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 4000,
            background: "rgba(2,6,23,0.65)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 400, borderRadius: 20, overflow: "hidden",
              boxShadow: "0 32px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.05)",
              animation: "deleteModalIn 0.18s cubic-bezier(0.22,1,0.36,1)",
            }}
          >
            {/* 헤더 */}
            <div style={{
              background: "linear-gradient(135deg,#1c0a0a 0%,#2d1515 100%)",
              padding: "22px 24px 18px",
              display: "flex", alignItems: "center", gap: 14,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                background: "linear-gradient(135deg,#ef4444,#b91c1c)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 16px rgba(239,68,68,0.45)",
              }}>
                <Trash2 size={20} color="white" />
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "white", letterSpacing: -0.3 }}>
                  {deleteConfirm.type === "bulk" ? t("proposals.deleteModal.titleBulk", { count: deleteConfirm.count }) : t("proposals.deleteModal.title")}
                </div>
                <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 3 }}>
                  {t("proposals.deleteModal.irreversible")}
                </div>
              </div>
            </div>

            {/* 본문 */}
            <div style={{ background: "white", padding: "22px 24px" }}>
              {deleteConfirm.type === "single" ? (
                <div style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 16px", borderRadius: 12,
                  background: "#FFF5F5", border: "1.5px solid #FECACA",
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: deleteConfirm.side === "BUY" ? "#DCFCE7" : "#DBEAFE",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 800,
                    color: deleteConfirm.side === "BUY" ? "#15803D" : "#1D4ED8",
                  }}>
                    {deleteConfirm.side === "BUY" ? "B" : "S"}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>{deleteConfirm.ticker}</div>
                    <div style={{ fontSize: 12, color: "#64748B", marginTop: 1 }}>{t("proposals.deleteModal.singleSub")}</div>
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: "14px 16px", borderRadius: 12,
                  background: "#FFF5F5", border: "1.5px solid #FECACA",
                  fontSize: 14, color: "#7F1D1D", fontWeight: 600, lineHeight: 1.6,
                }}>
                  {t("proposals.deleteModal.bulkBody", { count: deleteConfirm.count })}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button
                  onClick={() => !deleteBusy && setDeleteConfirm(null)}
                  disabled={deleteBusy}
                  style={{
                    flex: 1, padding: "13px", borderRadius: 11,
                    border: "1.5px solid #E2E8F0", background: "white",
                    color: "#374151", fontSize: 13.5, fontWeight: 700,
                    cursor: deleteBusy ? "not-allowed" : "pointer",
                  }}
                >
                  {t("proposals.deleteModal.cancel")}
                </button>
                <button
                  onClick={() => deleteConfirm.type === "single"
                    ? executeDeleteOne(deleteConfirm.id)
                    : executeDeleteBulk()}
                  disabled={deleteBusy}
                  style={{
                    flex: 1, padding: "13px", borderRadius: 11, border: "none",
                    background: deleteBusy
                      ? "#E2E8F0"
                      : "linear-gradient(135deg,#ef4444 0%,#b91c1c 100%)",
                    color: deleteBusy ? "#94A3B8" : "white",
                    fontSize: 13.5, fontWeight: 800,
                    cursor: deleteBusy ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    boxShadow: deleteBusy ? "none" : "0 4px 14px rgba(239,68,68,0.4)",
                    transition: "all 0.15s",
                  }}
                >
                  {deleteBusy
                    ? <><Loader2 size={14} className="spin" /> {t("proposals.deleteModal.deleting")}</>
                    : <><Trash2 size={14} /> {t("proposals.deleteModal.confirm")}</>}
                </button>
              </div>
            </div>
          </div>
          <style>{`@keyframes deleteModalIn { from { opacity:0; transform:scale(0.93) translateY(10px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>
        </div>
      )}
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
          {!deleteMode && (
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
          )}
          <button
            onClick={deleteMode ? exitDeleteMode : enterDeleteMode}
            style={{
              background: deleteMode ? "#FEF2F2" : "white",
              border: `1.5px solid ${deleteMode ? "#FECACA" : "#E2E8F0"}`,
              color: deleteMode ? "#B91C1C" : "#475569",
              padding: "9px 18px", borderRadius: 12,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13,
              fontWeight: 600, boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}>
            <Trash2 size={14} />
            {deleteMode ? t("proposals.deleteMode.exit") : t("proposals.deleteMode.enter")}
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

      {/* 선택 삭제 액션 바 — 삭제 모드일 때만 표시 */}
      {deleteMode && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 16px", marginBottom: 12,
          background: "#FEF2F2", border: "1.5px solid #FECACA",
          borderRadius: 12,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: selectedIds.size > 0 ? "#B91C1C" : "#94A3B8", flex: 1 }}>
            {selectedIds.size > 0 ? t("proposals.deleteMode.selectedCount", { count: selectedIds.size }) : t("proposals.deleteMode.prompt")}
          </span>
          <button onClick={selectAll} style={{
            padding: "6px 12px", borderRadius: 8, border: "1px solid #FECACA",
            background: "white", color: "#6B7280", fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>{t("proposals.deleteMode.selectAll")}</button>
          <button onClick={clearSelection} style={{
            padding: "6px 12px", borderRadius: 8, border: "1px solid #FECACA",
            background: "white", color: "#6B7280", fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>{t("proposals.deleteMode.clearSelection")}</button>
          <button onClick={onDeleteSelected} disabled={deleteBusy} style={{
            padding: "6px 14px", borderRadius: 8, border: "none",
            background: deleteBusy ? "#E2E8F0" : "#EF4444",
            color: deleteBusy ? "#94A3B8" : "white",
            fontSize: 12, fontWeight: 700, cursor: deleteBusy ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            <Trash2 size={12} /> {deleteBusy ? t("proposals.deleteMode.deleting") : t("proposals.deleteMode.deleteSelected")}
          </button>
        </div>
      )}

      {/* 필터 */}
      <div className="filter-row" style={{ display: "flex", gap: 8, marginBottom: 30, flexWrap: "wrap" }}>
        {["ALL", "PENDING", "EXECUTED", "REJECTED", "EXPIRED", "EXEC_FAILED"].map(s => {
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
          const expiry = isPending && p.expiresAt ? expiryInfo(p.expiresAt) : null;
          const isClientExpired = expiry?.expired === true;
          return (
            <div key={p.id} className="prop-card"
              style={{
                background: isClientExpired ? "#FFF7F7" : theme.panel,
                border: `1px solid ${isClientExpired ? "#FECACA" : theme.panelBorder}`,
                borderRadius: 12, padding: 14, display: "flex", alignItems: "center", gap: 14,
                opacity: isClientExpired ? 0.85 : 1,
              }}>
              {/* 체크박스 — 삭제 모드에서만 표시 */}
              {deleteMode && (
                <input
                  type="checkbox"
                  checked={selectedIds.has(p.id)}
                  onChange={() => toggleSelect(p.id)}
                  onClick={e => e.stopPropagation()}
                  style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0, accentColor: "#6366F1" }}
                />
              )}
              <div style={{
                background: meta.bg, color: meta.color,
                padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                whiteSpace: "nowrap", minWidth: 90, flexShrink: 0,
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
                  {p.source === "MANUAL" ? t("proposals.source.manual") : p.source === "SIGNAL" ? t("proposals.source.signal") : p.source}
                  {p.sourceSignalId && ` · signal#${p.sourceSignalId}`}
                  {" · "}broker#{p.brokerAccountId}
                  {" · "}{new Date(p.createdAt).toLocaleString("ko-KR")}
                  {p.kisOrderNo && ` · ${p.qtyDecimal != null ? "Binance" : "KIS"}#${p.kisOrderNo}`}
                  {p.execError && (
                    <span style={{ color: "#B91C1C", marginLeft: 8 }}>· {p.execError}</span>
                  )}
                </div>
                {isClientExpired && (
                  <div style={{
                    marginTop: 6, padding: "5px 10px",
                    background: "#FEE2E2", color: "#B91C1C",
                    borderRadius: 6, fontSize: 11, fontWeight: 700,
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}>
                    ⚠ {t("proposals.expiredNotice")}
                  </div>
                )}
                {!isClientExpired && expiry && (
                  <div style={{
                    marginTop: 4, fontSize: 11, fontWeight: 600,
                    color: expiry.urgent ? "#D97706" : "#94A3B8",
                    display: "flex", alignItems: "center", gap: 3,
                  }}>
                    <Clock size={10} />
                    {t("proposals.expiresIn").replace("{time}", expiry.label)}
                  </div>
                )}
              </div>
              {isPending && (
                <div className="prop-actions" style={{ display: "flex", gap: 6 }}>
                  <button disabled={busyId === p.id || isClientExpired} onClick={() => !isClientExpired && onAmend(p)}
                    style={{
                      background: isClientExpired
                        ? "#E2E8F0"
                        : "linear-gradient(135deg, #86efac 0%, #4ade80 50%, #22c55e 100%)",
                      color: isClientExpired ? "#94A3B8" : "#fff", fontWeight: 700, fontSize: 12,
                      border: "none", borderRadius: 8, padding: "8px 14px",
                      cursor: busyId === p.id || isClientExpired ? "not-allowed" : "pointer",
                      display: "inline-flex", alignItems: "center", gap: 4,
                    }}>
                    <Pencil size={12} /> {t("proposals.amend") || "주문 정정"}
                  </button>
                  <button disabled={busyId === p.id || isClientExpired} onClick={() => !isClientExpired && onApprove(p)}
                    style={{
                      background: isClientExpired
                        ? "#E2E8F0"
                        : "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)",
                      color: isClientExpired ? "#94A3B8" : "#fff", fontWeight: 700, fontSize: 12,
                      border: "none", borderRadius: 8, padding: "8px 14px",
                      cursor: busyId === p.id || isClientExpired ? "not-allowed" : "pointer",
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
              {/* 단일 삭제 버튼 — 삭제 모드에서만 표시 */}
              {deleteMode && (
                <button
                  onClick={e => { e.stopPropagation(); onDeleteOne(p.id); }}
                  title={t("proposals.deleteModal.title")}
                  style={{
                    width: 30, height: 30, borderRadius: 8, border: "1px solid #E5E7EB",
                    background: "white", color: "#9CA3AF", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                    transition: "background 0.12s, color 0.12s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.color = "#EF4444"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "white"; e.currentTarget.style.color = "#9CA3AF"; }}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        @media (max-width: 1024px) {
          .alpha-proposals h1 { font-size: 20px !important; }
        }
        @media (max-width: 768px) {
          .alpha-proposals { padding: 12px 10px !important; }
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

      <OrderAmendModal
        open={!!amending}
        proposal={amending}
        loading={amendBusy}
        canceling={cancelBusy}
        error={amendErr}
        onSave={onSaveAmend}
        onCancelOrder={onCancelOrder}
        onClose={() => { if (!amendBusy && !cancelBusy) { setAmending(null); setAmendErr(null); } }}
      />

      <OrderRejectModal
        open={!!rejecting}
        proposal={rejecting}
        loading={rejectBusy}
        error={rejectErr}
        onConfirm={onConfirmReject}
        onClose={() => { if (!rejectBusy) { setRejecting(null); setRejectErr(null); } }}
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
                  <div style={{ fontSize: 20, fontWeight: 800, color: "white", letterSpacing: -0.3 }}>{t("proposals.form.title")}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <select
                      required value={form.brokerAccountId}
                      onChange={e => { setForm(f => ({ ...f, brokerAccountId: e.target.value, ticker: "" })); setFieldErrors(fe => { const { brokerAccountId: _, ...rest } = fe; return rest; }); }}
                      style={{
                        padding: "8px 12px", borderRadius: 9,
                        border: fieldErrors.brokerAccountId ? "1.5px solid #EF4444" : "1px solid rgba(255,255,255,0.1)",
                        background: fieldErrors.brokerAccountId ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.07)",
                        color: form.brokerAccountId ? "#E2E8F0" : "#64748B",
                        fontSize: 12.5, fontWeight: 600, outline: "none", cursor: "pointer", maxWidth: 200,
                      }}
                    >
                      <option value="" style={{ color: "#0F172A" }}>{t("proposals.form.selectAccount")}</option>
                      {brokerAccounts.map(a => (
                        <option key={a.id} value={a.id} style={{ color: "#0F172A" }}>
                          [{a.env}] {a.brokerType} {a.accountAlias || a.accountNumber || `#${a.id}`}
                          {a.tradingEnabled ? "" : ` ${t("proposals.form.tradingDisabled")}`}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.brokerAccountId && (
                      <span style={{ fontSize: 11, color: "#FCA5A5", fontWeight: 600 }}>⚠ {fieldErrors.brokerAccountId}</span>
                    )}
                  </div>
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
                { key: "BUY",     labelKey: "proposals.form.tabs.buy",     color: "#EF4444", soft: "#FFF1F1" },
                { key: "SELL",    labelKey: "proposals.form.tabs.sell",    color: "#3B82F6", soft: "#EFF6FF" },
                { key: "CANCEL",  labelKey: "proposals.form.tabs.cancel",  color: "#10B981", soft: "#F0FDF4" },
                { key: "HISTORY", labelKey: "proposals.form.tabs.history", color: "#8B5CF6", soft: "#F5F3FF" },
              ].map(({ key, labelKey, color, soft }) => {
                const label = t(labelKey);
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
                  {activeTab === "CANCEL" ? t("proposals.form.cancelContent") : t("proposals.form.historyContent")}
                </div>
              ) : (
                <form onSubmit={onSubmitCreate} style={{ padding: "20px 22px 22px" }}>

                  {/* 종목 */}
                  <div style={{ marginBottom: 13 }}>
                    <label style={mLabelStyle}>{t("proposals.form.ticker")} <span style={{ color: "#EF4444" }}>*</span></label>
                    <select required value={form.ticker}
                      onChange={e => { setForm(f => ({ ...f, ticker: e.target.value })); setFieldErrors(fe => { const { ticker: _, ...rest } = fe; return rest; }); }}
                      style={{ ...mInputStyle, borderColor: fieldErrors.ticker ? "#EF4444" : "#E2E8F0", background: fieldErrors.ticker ? "#FFF5F5" : "#FAFAFA" }}>
                      <option value="">{t("proposals.form.tickerSelect")}</option>
                      {(brokerAccounts.find(a => String(a.id) === String(form.brokerAccountId))?.brokerType === "BINANCE"
                        ? CRYPTO_LIST : TICKER_LIST
                      ).map(tk => <option key={tk.value} value={tk.value}>{tk.value} — {tk.name}</option>)}
                    </select>
                    {fieldErrors.ticker && <span style={{ fontSize: 11, color: "#EF4444", marginTop: 4, display: "block" }}>⚠ {fieldErrors.ticker}</span>}
                  </div>

                  {/* 주문유형 */}
                  <div style={{ marginBottom: 13 }}>
                    <label style={mLabelStyle}>{t("proposals.form.orderType")} <span style={{ color: "#EF4444" }}>*</span></label>
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
                      <label style={mLabelStyle}>{t("proposals.form.qty")} <span style={{ color: "#EF4444" }}>*</span></label>
                      <input required type="number" step="any" min="0.0001" placeholder="0"
                        value={form.qty}
                        onChange={e => { setForm(f => ({ ...f, qty: e.target.value })); setFieldErrors(fe => { const { qty: _, ...rest } = fe; return rest; }); }}
                        style={{ ...mInputStyle, borderColor: fieldErrors.qty ? "#EF4444" : "#E2E8F0", background: fieldErrors.qty ? "#FFF5F5" : "#FAFAFA" }} />
                      {fieldErrors.qty && <span style={{ fontSize: 11, color: "#EF4444", marginTop: 4, display: "block" }}>⚠ {fieldErrors.qty}</span>}
                    </div>
                    {form.orderType !== "MARKET" && (
                      <div>
                        <label style={mLabelStyle}>{t("proposals.form.price")} <span style={{ color: "#EF4444" }}>*</span></label>
                        <input required type="number" step="any" min="0" placeholder="0.00"
                          value={form.limitPrice}
                          onChange={e => { setForm(f => ({ ...f, limitPrice: e.target.value })); setFieldErrors(fe => { const { limitPrice: _, ...rest } = fe; return rest; }); }}
                          style={{ ...mInputStyle, borderColor: fieldErrors.limitPrice ? "#EF4444" : "#E2E8F0", background: fieldErrors.limitPrice ? "#FFF5F5" : "#FAFAFA" }} />
                        {fieldErrors.limitPrice && <span style={{ fontSize: 11, color: "#EF4444", marginTop: 4, display: "block" }}>⚠ {fieldErrors.limitPrice}</span>}
                      </div>
                    )}
                  </div>

                  {/* 사유 */}
                  <div style={{ marginBottom: 4 }}>
                    <label style={mLabelStyle}>{t("proposals.form.rationale")} <span style={{ color: "#CBD5E1", fontWeight: 400 }}>({t("proposals.form.optional")})</span></label>
                    <input placeholder={t("proposals.form.rationalePlaceholder")}
                      value={form.rationale} onChange={e => setForm(f => ({ ...f, rationale: e.target.value }))} style={mInputStyle} />
                  </div>

                  {createErr && (
                    <div style={{ padding: "9px 12px", background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA", borderRadius: 9, fontSize: 12, marginTop: 12 }}>{createErr}</div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                    <button type="button" onClick={() => !createBusy && setCreateOpen(false)} style={{
                      flex: 1, padding: "13px", borderRadius: 11, border: "1.5px solid #E2E8F0",
                      background: "white", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer",
                    }}>{t("proposals.form.cancel")}</button>
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
                      {isBuy ? t("proposals.form.submitBuy") : t("proposals.form.submitSell")}
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

