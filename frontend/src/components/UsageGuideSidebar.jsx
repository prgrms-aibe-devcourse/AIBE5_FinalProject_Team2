import React from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  FileText, Users, BookOpen, CreditCard, ShieldCheck, Scale
} from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";

const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif";

const MENU_ITEMS = [
  { path: "/usage_guide",                menuKey: "howToUse",      icon: BookOpen },
  { path: "/usage_guide/portfolio",      menuKey: "portfolio",     icon: FileText },
  { path: "/usage_guide/matching",       menuKey: "matching",      icon: Users },
  { path: "/usage_guide/contract",       menuKey: "contract",      icon: CreditCard },
  { path: "/usage_guide/policy",         menuKey: "policy",        icon: ShieldCheck },
  { path: "/usage_guide/service_policy", menuKey: "servicePolicy", icon: Scale },
];

export default function UsageGuideSidebar() {
  const location = useLocation();
  const { t } = useLanguage();

  return (
    <aside style={{ width: 240, flexShrink: 0, display: "block" }}>
      <div style={{ 
        background: "white", 
        borderRadius: 16, 
        padding: "24px 16px",
        border: "1.5px solid #E5E7EB",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        position: "sticky",
        top: 100,
      }}>
        <div style={{ marginBottom: 20, padding: "0 8px" }}>
          <h3 style={{ fontSize: 13, fontWeight: 800, color: "#1E293B", marginBottom: 4, fontFamily: F }}>{t("usageGuide.sidebar.title")}</h3>
          <p style={{ fontSize: 11, color: "#94A3B8", margin: 0, fontFamily: F }}>Customer Support</p>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {MENU_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  borderRadius: 10,
                  textDecoration: "none",
                  transition: "all 0.2s",
                  background: isActive ? "#F0F9FF" : "transparent",
                  border: isActive ? "1.5px solid #3B82F6" : "1.5px solid transparent",
                }}
              >
                <Icon size={18} color={isActive ? "#3B82F6" : "#64748B"} />
                <span style={{ 
                  fontSize: 14, 
                  fontWeight: isActive ? 700 : 500, 
                  color: isActive ? "#1E40AF" : "#475569",
                  fontFamily: F 
                }}>
                  {t(`usageGuide.sidebar.menu.${item.menuKey}`)}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
