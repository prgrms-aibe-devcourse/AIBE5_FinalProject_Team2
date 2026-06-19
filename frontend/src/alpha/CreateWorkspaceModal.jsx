import { Layers, X } from "lucide-react";

export default function CreateWorkspaceModal({ open, name, onChange, onConfirm, onClose, error }) {
  if (!open) return null;
  return (
    <div data-tutorial-modal-root onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 3000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "white", borderRadius: 20, width: "100%", maxWidth: 460,
        boxShadow: "0 24px 64px rgba(0,0,0,0.22)", overflow: "hidden",
      }} data-tutorial-id="tutorial-create-workspace-modal">
        {/* 헤더 */}
        <div style={{
          padding: "24px 28px 20px",
          background: "linear-gradient(135deg,#eff6ff 0%,#e0e7ff 100%)",
          borderBottom: "1px solid #E2E8F0",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14, flexShrink: 0,
              background: "linear-gradient(135deg,#60a5fa,#6366f1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
            }}>
              <Layers size={20} color="white" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1e3a8a" }}>새 워크스페이스</h2>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#475569" }}>삶의 목표를 투자 전략으로 변환합니다</p>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: "50%", border: "1px solid #C7D2FE",
            background: "white", cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center", color: "#475569", flexShrink: 0,
          }}><X size={14} /></button>
        </div>

        {/* 본문 */}
        <div style={{ padding: "24px 28px" }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 8 }}>
            워크스페이스 이름
          </label>
          <input
            autoFocus
            data-tutorial-id="tutorial-create-workspace-name-input"
            value={name}
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter") onConfirm();
              if (e.key === "Escape") onClose();
            }}
            placeholder="예: 5년 후 월 300만원 현금흐름"
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 10,
              border: `1.5px solid ${error ? "#f87171" : "#C7D2FE"}`, fontSize: 14, outline: "none",
              boxSizing: "border-box", color: "#0F172A",
              transition: "border-color 0.15s",
            }}
            onFocus={e => e.target.style.borderColor = error ? "#ef4444" : "#6366f1"}
            onBlur={e => e.target.style.borderColor = error ? "#f87171" : "#C7D2FE"}
          />
          {error
            ? <p style={{ margin: "8px 0 0", fontSize: 12, color: "#ef4444", fontWeight: 600 }}>⚠️ {error}</p>
            : <p style={{ margin: "10px 0 0", fontSize: 12, color: "#94A3B8", lineHeight: 1.6 }}>
                이름은 나중에 AI와 대화하면서 자동으로 목표에 맞게 구체화됩니다.
              </p>
          }
        </div>

        {/* 푸터 */}
        <div style={{ padding: "0 28px 24px", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "10px 20px", borderRadius: 10,
            border: "1px solid #E2E8F0", background: "white", color: "#374151",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>취소</button>
          <button onClick={onConfirm} disabled={!name.trim()} style={{
            padding: "10px 20px", borderRadius: 10, border: "none",
            background: name.trim()
              ? "linear-gradient(135deg,#60a5fa 0%,#3b82f6 50%,#6366f1 100%)"
              : "#E2E8F0",
            color: name.trim() ? "white" : "#94A3B8",
            fontSize: 13, fontWeight: 700,
            cursor: name.trim() ? "pointer" : "not-allowed",
            boxShadow: name.trim() ? "0 3px 10px rgba(99,102,241,0.3)" : "none",
          }}>워크스페이스 생성</button>
        </div>
      </div>
    </div>
  );
}
