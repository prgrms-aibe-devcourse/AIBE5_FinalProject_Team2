import React, { useEffect, useState } from "react";
import { X, XCircle, Loader2 } from "lucide-react";
import { useTheme } from "./ThemeContext";

/**
 * 주문 제안 거절 확인 모달.
 *
 * Props:
 *   open: boolean
 *   proposal: { id, ticker, side, qty, qtyDecimal, limitPrice }
 *   loading: boolean
 *   error: string|null
 *   onConfirm(reason: string): Promise<void>
 *   onClose(): void
 */
export default function OrderRejectModal({ open, proposal, loading, error, onConfirm, onClose }) {
  const { theme } = useTheme();
  const [reason, setReason] = useState("");
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // 모달 열릴 때 reason 초기화
  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  // ESC 닫기 + 스크롤 잠금
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape" && !loading) onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, loading, onClose]);

  if (!open || !proposal) return null;

  const isBuy = proposal.side === "BUY";
  const isCrypto = proposal.qtyDecimal != null;
  const qtyLabel = isCrypto
    ? `${proposal.qtyDecimal} ${proposal.ticker}`
    : `${proposal.qty}주 · ${proposal.ticker}`;

  const sheet = {
    background: theme.panel,
    color: theme.text,
    boxShadow: "0 -8px 30px rgba(0,0,0,0.25)",
    paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
    width: "100%",
    boxSizing: "border-box",
    overflow: "hidden",
    ...(isMobile
      ? {
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          maxHeight: "85vh",
          overflowY: "auto",
        }
      : {
          borderRadius: 20,
          maxWidth: 440,
          margin: "auto",
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

  return (
    <div style={overlay} onClick={() => !loading && onClose()}>
      <div style={sheet} onClick={(e) => e.stopPropagation()}>
        {/* 모바일 핸들 */}
        {isMobile && (
          <div style={{
            width: 40, height: 4, background: "#9CA3AF", opacity: 0.5,
            borderRadius: 999, margin: "16px auto 0",
          }} />
        )}

        {/* 헤더 */}
        <div style={{
          padding: "24px 28px 20px",
          background: "linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)",
          borderBottom: `1px solid ${theme.panelBorder}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14, flexShrink: 0,
              background: "linear-gradient(135deg, #f87171, #dc2626)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(220,38,38,0.3)",
            }}>
              <XCircle size={20} color="white" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#7f1d1d" }}>제안 거절</h2>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#b91c1c" }}>
                큐에서 제거되며 되돌릴 수 없습니다
              </p>
            </div>
          </div>
          <button onClick={onClose} disabled={loading} style={{
            width: 30, height: 30, borderRadius: "50%", border: "1px solid #FECACA",
            background: "white", cursor: loading ? "wait" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#dc2626", flexShrink: 0,
          }}>
            <X size={14} />
          </button>
        </div>

        {/* 본문 */}
        <div style={{ padding: "20px 28px 24px" }}>
          {/* 제안 요약 */}
          <div style={{
            background: theme.bg, border: `1px solid ${theme.panelBorder}`,
            borderRadius: 12, padding: "12px 16px", marginBottom: 18,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                display: "inline-block",
                background: isBuy ? "#DCFCE7" : "#FEE2E2",
                color: isBuy ? "#15803D" : "#B91C1C",
                padding: "3px 10px", borderRadius: 999,
                fontSize: 11, fontWeight: 800,
              }}>
                {isBuy ? "매수 BUY" : "매도 SELL"}
              </span>
              <span style={{ fontSize: 17, fontWeight: 900, letterSpacing: -0.4, color: theme.text }}>
                {qtyLabel}
              </span>
            </div>
            {proposal.limitPrice && (
              <div style={{ marginTop: 6, fontSize: 13, color: theme.textMuted }}>
                지정가 {isCrypto
                  ? `${Number(proposal.limitPrice)} USDT`
                  : `$${Number(proposal.limitPrice).toFixed(2)}`}
              </div>
            )}
          </div>

          {/* 거절 사유 */}
          <label style={{
            fontSize: 12, fontWeight: 700, color: "#374151",
            display: "block", marginBottom: 8,
          }}>
            거절 사유 <span style={{ fontWeight: 400, color: "#94A3B8" }}>(선택)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading}
            placeholder="예: 시장 상황 변화로 진입 시점 재검토"
            rows={3}
            style={{
              width: "100%", padding: "11px 13px", borderRadius: 10,
              border: "1.5px solid #FCA5A5", fontSize: 13.5, outline: "none",
              boxSizing: "border-box", color: theme.text, background: theme.panel,
              resize: "none", lineHeight: 1.6, fontFamily: "inherit",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => { e.target.style.borderColor = "#ef4444"; }}
            onBlur={(e) => { e.target.style.borderColor = "#FCA5A5"; }}
          />

          {error && (
            <div style={{
              marginTop: 10, background: "#FEE2E2", color: "#B91C1C",
              border: "1px solid #FCA5A5", borderRadius: 8,
              padding: "9px 12px", fontSize: 12, wordBreak: "break-word",
            }}>
              {error}
            </div>
          )}

          {/* 버튼 */}
          <div style={{
            display: "flex", gap: 8, marginTop: 18,
            flexDirection: isMobile ? "column-reverse" : "row",
          }}>
            <button onClick={onClose} disabled={loading} style={{
              flex: 1, padding: "13px 16px", borderRadius: 10,
              background: theme.panel, color: "#374151", fontWeight: 700, fontSize: 13,
              border: `1px solid ${theme.panelBorder}`,
              cursor: loading ? "wait" : "pointer", minHeight: 46,
            }}>
              취소
            </button>
            <button
              onClick={() => onConfirm(reason.trim())}
              disabled={loading}
              style={{
                flex: 1, padding: "13px 16px", borderRadius: 10, border: "none",
                background: loading
                  ? "#FCA5A5"
                  : "linear-gradient(135deg, #f87171 0%, #dc2626 100%)",
                color: "#fff", fontWeight: 800, fontSize: 13,
                cursor: loading ? "wait" : "pointer", minHeight: 46,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                boxShadow: loading ? "none" : "0 3px 10px rgba(220,38,38,0.3)",
              }}>
              {loading
                ? <><Loader2 size={15} className="rej-spin" /> 처리 중...</>
                : <><XCircle size={15} /> 거절 확정</>}
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes rej-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        .rej-spin { animation: rej-spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
