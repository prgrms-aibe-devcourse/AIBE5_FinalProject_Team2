import { ChevronRight, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../i18n/useLanguage";

export default function GuideDock({ open, onClose, width = 320, sidebarWidth = 52 }) {
  const nav = useNavigate();
  const { t } = useLanguage();

  const SECTIONS = [
    { title: t("guideDock.gettingStarted"), items: [
      { label: t("guide.sections.overview"), to: "/alpha_guide#overview" },
      { label: t("guide.sections.workspace"), to: "/alpha_guide#workspace" },
    ]},
    { title: t("guideDock.strategyDesign"), items: [
      { label: t("guide.sections.goalChat"), to: "/alpha_guide#goal-chat" },
      { label: t("guide.sections.config"),   to: "/alpha_guide#config" },
    ]},
    { title: t("guideDock.verifyOperate"), items: [
      { label: t("guide.sections.backtest"), to: "/alpha_guide#backtest" },
      { label: t("guide.sections.trust"),    to: "/alpha_guide#trust" },
      { label: t("guide.sections.orders"),   to: "/alpha_guide#orders" },
    ]},
    { title: t("guideDock.policy"), items: [
      { label: t("guideDock.privacy"), to: "/alpha_privacy" },
      { label: t("guideDock.terms"),   to: "/alpha_terms" },
    ]},
  ];

  const goItem = (to) => {
    window.open(to, "_blank", "noopener");
  };

  return (
    <aside style={{
      position: "fixed", left: open ? sidebarWidth : 0, top: 0, bottom: 0,
      width: open ? width : 0,
      background: "white",
      borderRight: open ? "1px solid #E2E8F0" : "none",
      boxShadow: open ? "8px 0 24px rgba(15,23,42,0.06)" : "none",
      transition: "width 0.18s ease, left 0.18s ease",
      overflow: "hidden", zIndex: 940,
      fontFamily: "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        height: 44, padding: "0 14px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid #F1F5F9",
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{t("nav.guide")}</span>
        <button onClick={onClose} title={t("guideDock.close")} style={{
          background: "transparent", border: "none", cursor: "pointer",
          color: "#94A3B8", padding: 4, borderRadius: 6,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          <ChevronRight size={18} style={{ transform: "rotate(180deg)" }} />
        </button>
      </div>

      <div style={{ padding: "12px 8px", overflowY: "auto", height: "calc(100% - 44px)" }}>
        {SECTIONS.map((sec, si) => (
          <div key={si} style={{ marginBottom: 14 }}>
            <div style={{
              padding: "4px 10px", fontSize: 11, fontWeight: 700,
              color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5,
            }}>{sec.title}</div>
            {sec.items.map((it, ii) => (
              <button key={ii} onClick={() => goItem(it.to)}
                style={{
                  width: "100%", textAlign: "left",
                  padding: "8px 10px", borderRadius: 6, border: "none",
                  background: "transparent", color: "#0F172A",
                  fontSize: 13, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#F1F5F9"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <span>{it.label}</span>
                <ExternalLink size={12} style={{ color: "#94A3B8" }} />
              </button>
            ))}
          </div>
        ))}

        <div style={{ padding: "12px 10px", borderTop: "1px solid #F1F5F9", marginTop: 8 }}>
          <button onClick={() => nav("/alpha_guide")} style={{
            width: "100%", padding: "8px 12px", borderRadius: 8,
            background: "linear-gradient(135deg, #60a5fa, #6366f1)",
            color: "white", border: "none", cursor: "pointer",
            fontSize: 12.5, fontWeight: 700,
          }}>{t("guideDock.fullGuide")}</button>
        </div>
      </div>
    </aside>
  );
}
