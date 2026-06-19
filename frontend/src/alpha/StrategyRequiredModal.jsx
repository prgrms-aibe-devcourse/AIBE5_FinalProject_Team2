import { useEffect } from "react";
import { Layers, X, ArrowRight } from "lucide-react";

export default function StrategyRequiredModal({ open, onClose, onGoConfig }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000,
      backdropFilter: "blur(4px)",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "white", borderRadius: 16, padding: "28px 32px",
        maxWidth: 400, width: "90%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)", position: "relative",
      }}>
        <button onClick={onClose} style={{
          position: "absolute", top: 12, right: 12, background: "none", border: "none",
          cursor: "pointer", color: "#94A3B8", padding: 6, borderRadius: 6,
        }}>
          <X size={20} />
        </button>

        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{
            width: 56, height: 56, margin: "0 auto 16px", borderRadius: "50%",
            background: "linear-gradient(135deg, #DBEAFE, #E0E7FF)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
            <Layers size={26} color="#6366F1" />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: "0 0 8px" }}>
            전략 정형화가 필요해요
          </h3>
          <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6, margin: 0 }}>
            백테스트를 실행하려면<br />먼저 전략 카드를 완성해야 해요.
          </p>
        </div>

        <div style={{
          background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10,
          padding: "10px 12px", marginBottom: 20,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
          fontSize: 11, fontWeight: 600, flexWrap: "nowrap", whiteSpace: "nowrap",
        }}>
          <span style={{ background: "#EDE9FE", color: "#7C3AED", borderRadius: 6, padding: "3px 8px" }}>전략 카드</span>
          <ArrowRight size={11} color="#94A3B8" style={{ flexShrink: 0 }} />
          <span style={{ background: "#EDE9FE", color: "#7C3AED", borderRadius: 6, padding: "3px 8px" }}>Goal Profile 설정</span>
          <ArrowRight size={11} color="#94A3B8" style={{ flexShrink: 0 }} />
          <span style={{ background: "#EDE9FE", color: "#7C3AED", borderRadius: 6, padding: "3px 8px" }}>Strategy 생성</span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "12px 18px", fontSize: 14, fontWeight: 600,
            background: "#F1F5F9", color: "#475569",
            border: "1px solid #E2E8F0", borderRadius: 10, cursor: "pointer",
          }}>닫기</button>
          <button onClick={onGoConfig} style={{
            flex: 2, padding: "12px 18px", fontSize: 14, fontWeight: 700,
            background: "linear-gradient(135deg, #60a5fa, #6366f1)",
            color: "white", border: "none", borderRadius: 10, cursor: "pointer",
          }}>전략 카드 탭으로</button>
        </div>
      </div>
    </div>
  );
}
