import { useEffect } from "react";

const ICONS = {
  success: "✅",
  error:   "🔴",
  order:   "📋",
  briefing:"📰",
  backtest:"📊",
  system:  "🔔",
};

const F = "'Inter','Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

export default function Toast({ title, body, type = "success", onClose, duration = 3500 }) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [onClose, duration]);

  const icon = ICONS[type] ?? ICONS.system;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", top: 28, left: "50%", transform: "translateX(-50%)",
        zIndex: 9999, backgroundColor: "#111827", color: "white",
        padding: "13px 22px", borderRadius: 14, cursor: "pointer",
        fontSize: 14, fontWeight: 600, fontFamily: F,
        boxShadow: "0 8px 28px rgba(0,0,0,0.22)",
        display: "flex", alignItems: "center", gap: 10,
        maxWidth: 360, animation: "fadeInDown 0.22s ease",
      }}
    >
      <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span>{title}</span>
        {body && (
          <span style={{ fontWeight: 400, fontSize: 12, color: "#9CA3AF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 280 }}>
            {body}
          </span>
        )}
      </div>
    </div>
  );
}
