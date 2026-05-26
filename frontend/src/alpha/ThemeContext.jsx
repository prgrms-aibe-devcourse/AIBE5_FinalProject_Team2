import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

// 통합 브랜드 그라데이션 (홈 / Alpha-Helix 공통 사용)
export const BRAND_GRADIENT = "linear-gradient(90deg, #7DD3FC 0%, #38BDF8 25%, #818CF8 65%, #93C5FD 100%)";
export const BRAND_FONT = "'Inter', 'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// 기본 테마(sky) + 보조 테마 — 모든 Alpha-Helix 화면이 이 컨텍스트만 보면 된다
const THEMES = {
  sky: {
    name: "Sky (브랜드)",
    bg: "linear-gradient(135deg, #F0F9FF 0%, #DBEAFE 45%, #E0E7FF 100%)",
    panel: "rgba(255, 255, 255, 0.92)",
    panelBorder: "rgba(147, 197, 253, 0.45)",
    sidebar: "linear-gradient(180deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)",
    sidebarHover: "rgba(255,255,255,0.18)",
    text: "#0F172A",
    textMuted: "#475569",
    accent: "#3B82F6",
    accentSoft: "#DBEAFE",
    accentGradient: BRAND_GRADIENT,
    success: "#0CA5A0",
    danger: "#DC2626",
    code: "#1E293B",
    codeBg: "#EFF6FF",
  },
  alpha: {
    name: "Alpha (노을)",
    bg: "linear-gradient(135deg, #FEF9C3 0%, #FED7AA 50%, #FCA5A5 100%)",
    panel: "rgba(255, 255, 255, 0.85)",
    panelBorder: "rgba(252, 165, 165, 0.4)",
    sidebar: "linear-gradient(180deg, #FCA5A5 0%, #F97316 50%, #C2410C 100%)",
    sidebarHover: "rgba(255,255,255,0.18)",
    text: "#7C2D12",
    textMuted: "#9A3412",
    accent: "#EA580C",
    accentSoft: "#FED7AA",
    accentGradient: "linear-gradient(90deg,#FCA5A5,#F59E0B)",
    success: "#15803D",
    danger: "#B91C1C",
    code: "#7C2D12",
    codeBg: "#FFEDD5",
  },
  helix: {
    name: "Helix (라일락)",
    bg: "linear-gradient(135deg, #DBEAFE 0%, #DDD6FE 50%, #FBCFE8 100%)",
    panel: "rgba(255, 255, 255, 0.88)",
    panelBorder: "rgba(196, 181, 253, 0.45)",
    sidebar: "linear-gradient(180deg, #A78BFA 0%, #7C3AED 50%, #DB2777 100%)",
    sidebarHover: "rgba(255,255,255,0.18)",
    text: "#1E1B4B",
    textMuted: "#4C1D95",
    accent: "#7C3AED",
    accentSoft: "#DDD6FE",
    accentGradient: "linear-gradient(90deg,#A78BFA,#F472B6)",
    success: "#0F766E",
    danger: "#BE185D",
    code: "#1E1B4B",
    codeBg: "#EDE9FE",
  },
  dev: {
    name: "Dev (Dracula)",
    bg: "#282A36",
    panel: "#383A4A",
    panelBorder: "#44475A",
    sidebar: "#21222C",
    sidebarHover: "#44475A",
    text: "#F8F8F2",
    textMuted: "#BD93F9",
    accent: "#FF79C6",
    accentSoft: "#44475A",
    accentGradient: "linear-gradient(90deg,#FF79C6,#BD93F9)",
    success: "#50FA7B",
    danger: "#FF5555",
    code: "#F8F8F2",
    codeBg: "#21222C",
  },
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  // 기존에 helix/alpha 로 저장된 사용자도 새 브랜드 sky 테마로 강제 마이그레이션
  const [themeKey, setThemeKey] = useState(() => {
    const saved = localStorage.getItem("alpha.theme");
    if (saved && THEMES[saved] && saved !== "alpha" && saved !== "helix") return saved;
    return "sky";
  });
  useEffect(() => { localStorage.setItem("alpha.theme", themeKey); }, [themeKey]);

  // LeftSidebar(또는 외부) 에서 테마 변경 시 즉시 반영
  useEffect(() => {
    const onChange = (e) => {
      const k = e?.detail?.key;
      if (k && THEMES[k]) setThemeKey(k);
    };
    window.addEventListener("alpha:theme-change", onChange);
    return () => window.removeEventListener("alpha:theme-change", onChange);
  }, []);

  const value = useMemo(() => ({
    themeKey,
    setThemeKey,
    theme: THEMES[themeKey] || THEMES.sky,
    available: Object.entries(THEMES).map(([k, v]) => ({ key: k, name: v.name })),
  }), [themeKey]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
