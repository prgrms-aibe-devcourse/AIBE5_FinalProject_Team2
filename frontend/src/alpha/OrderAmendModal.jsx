import React, { useEffect, useState } from "react";
import { X, Pencil, Trash2, Loader2, CheckCircle2 } from "lucide-react";
import { useTheme, BRAND_GRADIENT } from "./ThemeContext";

/**
 * 주문 정정 모달.
 *  - PENDING 제안의 수량/단가/주문유형/방향/사유를 수정.
 *  - 하단: [주문 정정](저장) 좌측 · [주문 취소](큐에서 제거=거절) 우측.
 *  - 데스크탑(>=768px): 중앙 모달 / 모바일(<768px): 하단 bottom-sheet.
 *
 * Props:
 *   open: boolean
 *   proposal: { id, ticker, side, qty, qtyDecimal, limitPrice, orderType, rationale, brokerAccountId }
 *   loading: boolean         // 정정 저장 중
 *   canceling: boolean       // 주문 취소(거절) 진행 중
 *   error: string|null
 *   onSave(fields): Promise<void>
 *   onCancelOrder(): Promise<void>   // 큐에서 제거
 *   onClose(): void
 */
const ORDER_TYPES = [
  { value: "LIMIT",  label: "보통(지정가)" },
  { value: "MARKET", label: "시장가" },
  { value: "LOC",    label: "LOC(장마감)" },
];

export default function OrderAmendModal({ open, proposal, loading, canceling, error, onSave, onCancelOrder, onClose }) {
  const { theme } = useTheme();
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches
  );

  const isCrypto = proposal?.qtyDecimal != null;   // Binance 분수수량 제안
  const busy = loading || canceling;

  // ── 폼 상태 (proposal 로 초기화) ─────────────────────────────
  const [side, setSide] = useState("BUY");
  const [qty, setQty] = useState("");
  const [orderType, setOrderType] = useState("LIMIT");
  const [limitPrice, setLimitPrice] = useState("");
  const [rationale, setRationale] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    if (!proposal) return;
    setSide(proposal.side || "BUY");
    setQty(isCrypto ? String(proposal.qtyDecimal ?? "") : String(proposal.qty ?? ""));
    setOrderType(proposal.orderType || (proposal.limitPrice == null ? "MARKET" : "LIMIT"));
    setLimitPrice(proposal.limitPrice != null ? String(Number(proposal.limitPrice)) : "");
    setRationale(proposal.rationale || "");
    setConfirmCancel(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // ESC 닫기 + 스크롤 잠금
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, busy, onClose]);

  if (!open || !proposal) return null;

  const isBuy = side === "BUY";
  const priceUnit = isCrypto ? "USDT" : "USD";
  const isMarket = orderType === "MARKET";

  const qtyNum = Number(qty);
  const priceNum = Number(limitPrice);
  const estUsd = (!isMarket && qtyNum > 0 && priceNum > 0) ? qtyNum * priceNum : null;
  const qtyValid = qtyNum > 0;
  const priceValid = isMarket || priceNum > 0;
  const canSave = qtyValid && priceValid && !busy;

  const submit = () => {
    if (!canSave) return;
    const fields = { side, qty, orderType, rationale: rationale.trim() };
    if (!isMarket) fields.limitPrice = limitPrice;
    onSave(fields);
  };

  const sheet = {
    background: theme.panel,
    color: theme.text,
    boxShadow: "0 -8px 30px rgba(0,0,0,0.25)",
    paddingTop: 22, paddingRight: 22, paddingBottom: 22, paddingLeft: 22,
    width: "100%",
    boxSizing: "border-box",
    ...(isMobile
      ? {
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingBottom: "calc(22px + env(safe-area-inset-bottom))",
          maxHeight: "88vh",
          overflowY: "auto",
        }
      : {
          borderRadius: 18,
          maxWidth: 460,
          margin: "auto",
          maxHeight: "90vh",
          overflowY: "auto",
        }),
  };

  const overlay = {
    position: "fixed", inset: 0, zIndex: 9999,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: isMobile ? "flex-end" : "center",
    justifyContent: "center",
    padding: isMobile ? 0 : 16,
  };

  const labelStyle = { fontSize: 11.5, fontWeight: 700, color: theme.textMuted, display: "block", marginBottom: 6, letterSpacing: 0.2 };
  const inputStyle = {
    width: "100%", padding: "11px 13px", borderRadius: 10, border: `1.5px solid ${theme.panelBorder}`,
    fontSize: 13.5, outline: "none", color: theme.text, boxSizing: "border-box", background: theme.bg,
  };

  return (
    <div style={overlay} onClick={() => !busy && onClose()}>
      <div style={sheet} onClick={(e) => e.stopPropagation()}>
        {isMobile && (
          <div style={{ width: 40, height: 4, background: "#9CA3AF", opacity: 0.5, borderRadius: 999, margin: "0 auto 16px" }} />
        )}

        {/* 헤더 */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <Pencil size={18} style={{ marginRight: 8, color: "#6366F1" }} />
          <h2 style={{
            margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: -0.3,
            background: BRAND_GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>
            주문 정정
          </h2>
          <button onClick={onClose} disabled={busy} aria-label="닫기"
            style={{ marginLeft: "auto", background: "transparent", border: "none", cursor: busy ? "wait" : "pointer", padding: 6, color: theme.textMuted }}>
            <X size={20} />
          </button>
        </div>

        {/* 종목 (정정 불가 — 표시 전용) */}
        <div style={{
          background: theme.bg, border: `1px solid ${theme.panelBorder}`, borderRadius: 12,
          padding: "12px 14px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: theme.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>종목</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: theme.text, letterSpacing: -0.3 }}>{proposal.ticker}</div>
          </div>
          <div style={{ fontSize: 11, color: theme.textMuted, textAlign: "right", lineHeight: 1.5 }}>
            계좌 #{proposal.brokerAccountId}<br />
            {isCrypto ? "Binance · 분수수량" : "KIS · 정수주"}
          </div>
        </div>

        {/* 방향(BUY/SELL) */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>주문 방향</label>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { v: "BUY",  label: "매수",  color: "#15803D", soft: "#DCFCE7" },
              { v: "SELL", label: "매도", color: "#B91C1C", soft: "#FEE2E2" },
            ].map(({ v, label, color, soft }) => {
              const act = side === v;
              return (
                <button key={v} type="button" onClick={() => setSide(v)} disabled={busy}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 13.5, fontWeight: act ? 800 : 600,
                    border: `1.5px solid ${act ? color : theme.panelBorder}`,
                    background: act ? soft : theme.bg, color: act ? color : theme.textMuted,
                    cursor: busy ? "not-allowed" : "pointer", transition: "all 0.12s",
                  }}>{label}</button>
              );
            })}
          </div>
        </div>

        {/* 주문유형 */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>주문유형</label>
          <div style={{ display: "flex", gap: 6 }}>
            {ORDER_TYPES.map(ot => {
              const act = orderType === ot.value;
              return (
                <button key={ot.value} type="button" disabled={busy}
                  onClick={() => { setOrderType(ot.value); if (ot.value === "MARKET") setLimitPrice(""); }}
                  style={{
                    flex: 1, padding: "9px 6px", borderRadius: 9, fontSize: 12.5, fontWeight: act ? 700 : 600,
                    border: `1.5px solid ${act ? "#6366F1" : theme.panelBorder}`,
                    background: act ? "#EEF2FF" : theme.bg, color: act ? "#4338CA" : theme.textMuted,
                    cursor: busy ? "not-allowed" : "pointer", transition: "all 0.12s",
                  }}>{ot.label}</button>
              );
            })}
          </div>
        </div>

        {/* 수량 + 단가 */}
        <div style={{ display: "grid", gridTemplateColumns: isMarket ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>수량 {isCrypto ? "(분수 가능)" : "(주)"}</label>
            <input type="number" step={isCrypto ? "any" : "1"} min={isCrypto ? "0.0001" : "1"} placeholder="0"
              value={qty} onChange={(e) => setQty(e.target.value)} disabled={busy} style={inputStyle} />
          </div>
          {!isMarket && (
            <div>
              <label style={labelStyle}>단가 ({priceUnit})</label>
              <input type="number" step="any" min="0" placeholder="0.00"
                value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} disabled={busy} style={inputStyle} />
            </div>
          )}
        </div>

        {/* 예상 총액 */}
        {estUsd != null && (
          <div style={{ fontSize: 12.5, color: theme.textMuted, marginBottom: 14, marginTop: -4 }}>
            예상 총액 <b style={{ color: theme.text }}>
              {isCrypto ? `${estUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDT` : `$${estUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}`}
            </b>
          </div>
        )}

        {/* 사유 */}
        <div style={{ marginBottom: 4 }}>
          <label style={labelStyle}>사유 <span style={{ color: theme.textMuted, fontWeight: 400 }}>(선택)</span></label>
          <input placeholder="예: 진입가 정정" value={rationale} onChange={(e) => setRationale(e.target.value)} disabled={busy} style={inputStyle} />
        </div>

        {error && (
          <div style={{
            background: "#FEE2E2", color: "#B91C1C", border: "1px solid #FCA5A5",
            borderRadius: 8, padding: 10, fontSize: 12, marginTop: 12, wordBreak: "break-word",
          }}>{error}</div>
        )}

        {/* ── 하단 액션: [주문 정정](좌) · [주문 취소](우) ── */}
        <div style={{ display: "flex", gap: 8, marginTop: 18, flexDirection: isMobile ? "column" : "row" }}>
          <button onClick={submit} disabled={!canSave}
            style={{
              flex: 2, padding: "14px 16px", borderRadius: 11, border: "none",
              background: canSave ? "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)" : theme.panelBorder,
              color: canSave ? "#fff" : theme.textMuted, fontWeight: 800, fontSize: 14,
              cursor: canSave ? "pointer" : "not-allowed", minHeight: 48,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
            {loading ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}
            {loading ? "정정 중..." : "주문 정정"}
          </button>

          {confirmCancel ? (
            <button onClick={onCancelOrder} disabled={busy}
              style={{
                flex: 1, padding: "14px 12px", borderRadius: 11, border: "1.5px solid #DC2626",
                background: "#DC2626", color: "#fff", fontWeight: 800, fontSize: 13,
                cursor: busy ? "wait" : "pointer", minHeight: 48, whiteSpace: "nowrap",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              }}>
              {canceling ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />}
              {canceling ? "취소 중..." : "정말 취소"}
            </button>
          ) : (
            <button onClick={() => setConfirmCancel(true)} disabled={busy}
              style={{
                flex: 1, padding: "14px 12px", borderRadius: 11, border: "1.5px solid #FCA5A5",
                background: theme.panel, color: "#DC2626", fontWeight: 700, fontSize: 13,
                cursor: busy ? "not-allowed" : "pointer", minHeight: 48, whiteSpace: "nowrap",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              }}>
              <Trash2 size={15} /> 주문 취소
            </button>
          )}
        </div>
        {confirmCancel && (
          <div style={{ marginTop: 8, fontSize: 11.5, color: "#B91C1C", textAlign: "center" }}>
            큐에서 제거됩니다. 한 번 더 누르면 취소가 확정됩니다.
          </div>
        )}
      </div>
      <style>{`
        @keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
