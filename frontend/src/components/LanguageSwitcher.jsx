import { useEffect, useRef, useState } from "react";
import { Globe, ChevronDown } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";

const LANG_OPTIONS = [
  { code: "ko", label: "한국어", short: "KO" },
  { code: "en", label: "English", short: "EN" },
  { code: "zh", label: "中文",     short: "ZH" },
];

/**
 * Header 우측에 들어가는 언어 선택 드롭다운.
 * Footer의 setLang과 동일한 LanguageContext를 사용 → 사이트 전역 언어 즉시 전환.
 *
 * props:
 *  - variant: "light" (밝은 헤더, home/partner) | "dark" (어두운 헤더, client)
 */
export default function LanguageSwitcher({ variant = "light" }) {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const isDark = variant === "dark";
  const current = LANG_OPTIONS.find((o) => o.code === lang) ?? LANG_OPTIONS[1];

  const triggerStyle = {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "5px 9px 5px 8px",
    borderRadius: 8,
    border: isDark
      ? "1px solid rgba(255,255,255,0.18)"
      : "1px solid #E5E7EB",
    background: isDark ? "rgba(255,255,255,0.06)" : "#FFFFFF",
    color: isDark ? "#E5E7EB" : "#374151",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    lineHeight: 1,
    whiteSpace: "nowrap",
    transition: "all 0.15s ease",
  };

  const panelStyle = {
    position: "absolute",
    top: "calc(100% + 6px)",
    right: 0,
    minWidth: 130,
    background: isDark ? "#1F2937" : "#FFFFFF",
    border: isDark
      ? "1px solid rgba(255,255,255,0.08)"
      : "1px solid #E5E7EB",
    borderRadius: 10,
    boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
    padding: "6px 0",
    zIndex: 300,
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={triggerStyle}
        aria-label="Change language"
      >
        <Globe size={14} strokeWidth={2.2} />
        <span style={{ marginLeft: 2 }}>{current.short}</span>
        <ChevronDown size={13} strokeWidth={2.2} />
      </button>

      {open && (
        <div style={panelStyle}>
          {LANG_OPTIONS.map((opt) => {
            const active = opt.code === lang;
            return (
              <button
                key={opt.code}
                type="button"
                onClick={() => {
                  setLang(opt.code);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "8px 14px",
                  border: "none",
                  background: active
                    ? isDark
                      ? "rgba(96,165,250,0.18)"
                      : "#EFF6FF"
                    : "transparent",
                  color: isDark
                    ? active ? "#93C5FD" : "#E5E7EB"
                    : active ? "#1D4ED8" : "#374151",
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  if (!active)
                    e.currentTarget.style.background = isDark
                      ? "rgba(255,255,255,0.05)"
                      : "#F9FAFB";
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = "transparent";
                }}
              >
                <span>{opt.label}</span>
                <span style={{ fontSize: 11, opacity: 0.6 }}>{opt.short}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
