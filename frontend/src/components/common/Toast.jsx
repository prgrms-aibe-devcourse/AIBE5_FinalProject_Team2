import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const ICONS = {
  success: "✅",
  error:   "🔴",
  order:   "📋",
  briefing:"📰",
  backtest:"📊",
  system:  "🔔",
};

const F = "'Inter','Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

const STYLES = `
  @keyframes toastIn {
    0%   { opacity: 0; transform: translateX(-50%) translateY(-18px) scale(0.94); }
    60%  { opacity: 1; transform: translateX(-50%) translateY(3px)   scale(1.01); }
    100% { opacity: 1; transform: translateX(-50%) translateY(0)     scale(1);    }
  }
  @keyframes toastOut {
    0%   { opacity: 1; transform: translateX(-50%) translateY(0)     scale(1);    }
    100% { opacity: 0; transform: translateX(-50%) translateY(-14px) scale(0.95); }
  }
  @keyframes toastProgress {
    from { width: 100%; }
    to   { width: 0%;   }
  }
`;

export default function Toast({ title, body, type = "success", onClose, duration = 3500 }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const exitDelay = duration - 280;
    const exitTimer   = setTimeout(() => setLeaving(true), exitDelay > 0 ? exitDelay : 0);
    const closeTimer  = setTimeout(onClose, duration);
    return () => { clearTimeout(exitTimer); clearTimeout(closeTimer); };
  }, [onClose, duration]);

  const icon = ICONS[type] ?? ICONS.system;

  return createPortal(
    <>
      <style>{STYLES}</style>
      <div
        onClick={onClose}
        style={{
          position: "fixed", top: 28, left: "50%",
          zIndex: 9999, backgroundColor: "#111827", color: "white",
          padding: "13px 22px 0", borderRadius: 14, cursor: "pointer",
          fontSize: 14, fontWeight: 600, fontFamily: F,
          boxShadow: "0 8px 28px rgba(0,0,0,0.28)",
          display: "flex", flexDirection: "column",
          maxWidth: 360, overflow: "hidden",
          animation: leaving
            ? "toastOut 0.28s cubic-bezier(0.4,0,1,1) forwards"
            : "toastIn  0.38s cubic-bezier(0.22,1,0.36,1) forwards",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 13 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span>{title}</span>
            {body && (
              <span style={{
                fontWeight: 400, fontSize: 12, color: "#9CA3AF",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 280,
              }}>
                {body}
              </span>
            )}
          </div>
        </div>
        <div style={{ height: 3, background: "rgba(255,255,255,0.12)", marginLeft: -22, marginRight: -22 }}>
          <div style={{
            height: "100%",
            background: type === "error" ? "#f87171" : "#34d399",
            animation: `toastProgress ${duration}ms linear forwards`,
          }} />
        </div>
      </div>
    </>,
    document.body
  );
}
