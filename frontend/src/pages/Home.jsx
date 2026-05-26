import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Palette, Search } from "lucide-react";
import heroImg from "../assets/home.png";
import useStore from "../store/useStore";
import { useLanguage } from "../i18n/LanguageContext";
import translations from "../i18n/translations";

const TEAL = "#0CA5A0";
const NAVY = "#0F2C52";
const BLUE = "#2563EB";

const CATEGORIES_STYLE = [
  { key: "itService",   emoji: "🖥️",  dbValue: "SaaS",        bg: "#FFF8F8", color: "#E87A7A", glow: "#FFB3B3" },
  { key: "design",      Icon: Palette, dbValue: "디자인/기획", bg: "#FFFAF5", color: "#F5A623", glow: "#FFD699" },
  { key: "fintech",     emoji: "💳",  dbValue: "핀테크",      bg: "#F7FFF2", color: "#7BC67E", glow: "#B8F0B0" },
  { key: "website",     emoji: "🌐",  dbValue: "웹사이트",    bg: "#F0F9FF", color: "#5BA8F5", glow: "#A8D4FF" },
  { key: "ai",          emoji: "🤖",  dbValue: "AI",          bg: "#F8F6FF", color: "#8B7BF5", glow: "#C4BBFF" },
  { key: "commerce",    emoji: "🛍️", dbValue: "커머스",      bg: "#F0FFF9", color: "#4DBBA0", glow: "#A0F0D8" },
  { key: "cloud",       emoji: "☁️",  dbValue: "클라우드",    bg: "#F8F8FF", color: "#A0A0CC", glow: "#D0D0FF" },
  { key: "mobile",      emoji: "📱",  dbValue: "모바일",      bg: "#F5F0FF", color: "#8C6BF0", glow: "#C8B3FF" },
  { key: "maintenance", emoji: "🛠️",  dbValue: "유지보수",    bg: "#FFF6FA", color: "#E873A0", glow: "#FFB3D1" },
];

const PROJECTS_IMAGES = [
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&q=80",
  "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80",
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80",
];
const PROJECTS_TAGS = [
  ["#React", "#Node.js", "#AI"],
  ["#Flutter", "#Firebase", "#UI/UX"],
  ["#Vue.js", "#AWS", "#Spring"],
];

const PARTNERS = ["Google", "Apple", "Microsoft", "Amazon", "Meta", "NVIDIA", "Tesla", "Samsung", "TSMC", "Oracle", "SAP", "Salesforce", "Adobe", "Intel", "IBM", "Cisco", "Qualcomm", "Netflix", "Spotify", "Shopify", "Stripe", "Uber", "Airbnb", "LinkedIn", "GitHub", "Slack", "Zoom", "Notion", "Figma", "Vercel", "TOSS", "Coupang", "HYPERCONNECT", "FASTFIVE", "yanolja", "SOCAR", "zigbang", "MyRealTrip"];

const BASE_FONT = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

function Home() {
  const navigate = useNavigate();
  const { loginUser, userRole } = useStore();
  const { t, lang } = useLanguage();
  const [searchValue, setSearchValue] = useState("");
  const [hoveredCat, setHoveredCat] = useState(null);
  const [hoveredProject, setHoveredProject] = useState(null);

  const tr = translations[lang]?.home || translations.en.home;
  const examples = tr.aiSection.examples;
  const highlightKeywords = tr.aiSection.highlightKeywords || [];
  const projects = tr.projectSection.projects;
  const categories = CATEGORIES_STYLE.map(cat => ({ ...cat, label: t(`home.categories.${cat.key}`) }));

  const handleSearch = () => {
    if (!searchValue.trim()) return;
    const q = searchValue.trim();
    const partnerKw = ['partner', 'developer', 'designer', 'freelancer', 'engineer', '파트너', '개발자', '디자이너', '프리랜서'];
    const clientKw = ['client', 'company', '클라이언트', '발주', '고객사'];
    if (partnerKw.some(k => q.toLowerCase().includes(k.toLowerCase()))) navigate(`/partner_search?q=${encodeURIComponent(q)}`);
    else if (clientKw.some(k => q.toLowerCase().includes(k.toLowerCase()))) navigate(`/client_search?q=${encodeURIComponent(q)}`);
    else navigate(`/project_search?q=${encodeURIComponent(q)}`);
  };

  const handlePortfolio = () => {
    if (!loginUser) {
      sessionStorage.setItem("loginRedirect", "portfolio");
      navigate("/login");
    } else {
      navigate("/partner_portfolio");
    }
  };

  const handleProjectRegister = () => {
    if (!loginUser) {
      sessionStorage.setItem("loginRedirect", "project_register");
      navigate("/login");
    } else if (userRole === "client") {
      navigate("/project_register");
    } else {
      alert(t("home.alertClientOnly"));
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#fff", fontFamily: BASE_FONT }}>

      {/* ── HERO ── */}
      <section style={{ position: "relative", width: "100%", height: 520, overflow: "hidden" }}>
        <img
          src={heroImg}
          alt="hero"
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }}
        />
        {/* 중앙 그라데이션 오버레이 */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.0001) 0%, rgba(0,0,0,0.0001) 50%, rgba(0,0,0,0.0001) 100%)",
        }} />
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "0 20px",
        }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <h1 style={{
              fontSize: 40, fontWeight: 900, color: "white",
              lineHeight: 1.25, marginBottom: 20,
              textShadow: "0 2px 16px rgba(0,0,0,0.25)",
              fontFamily: BASE_FONT,
            }}>
              {t("home.heroTitle1")}<br />{t("home.heroTitle2")}
            </h1>
            {/* 반투명 배경 pill 부제목 */}
            <div style={{
              display: "inline-flex", alignItems: "center",
              backgroundColor: "rgba(255,255,255,0.18)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 999,
              padding: "8px 20px",
              marginBottom: 28,
            }}>
              <span style={{
                fontSize: 14, color: "rgba(255,255,255,0.95)",
                fontFamily: BASE_FONT, fontWeight: 500,
              }}>
                {t("home.heroSubtitle")}
              </span>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={handlePortfolio}
                style={{
                  padding: "12px 26px", borderRadius: 8, border: "none",
                  backgroundColor: TEAL, color: "white",
                  fontWeight: 700, fontSize: 14, cursor: "pointer",
                  fontFamily: BASE_FONT, transition: "opacity 0.2s",
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
                onMouseLeave={e => e.currentTarget.style.opacity = "1"}
              >
                {t("home.btnUpgrade")}
              </button>
              <button
                onClick={handleProjectRegister}
                style={{
                  padding: "12px 26px", borderRadius: 8, border: "none",
                  backgroundColor: NAVY, color: "white",
                  fontWeight: 700, fontSize: 14, cursor: "pointer",
                  fontFamily: BASE_FONT, transition: "opacity 0.2s",
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
                onMouseLeave={e => e.currentTarget.style.opacity = "1"}
              >
                {t("home.btnRegisterProject")}
              </button>
            </div>
          </div>
        </div>
      </section>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px" }}>

        {/* ── PROJECTS (검증된 전략 템플릿) — 카테고리 섹션 제거 후 위로 이동 ── */}
        <section style={{ marginBottom: 64, paddingTop: 64 }}>
          <p style={{ color: "#6366F1", fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{t("home.projectSection.title")}</p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
            <div>
              <h2 style={{ fontSize: 23, fontWeight: 900, marginBottom: 8, fontFamily: BASE_FONT, color: "#1E293B" }}>
                <span style={{ background: "linear-gradient(90deg, #7DD3FC 0%, #38BDF8 25%, #818CF8 65%, #93C5FD 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>ALPHA-HELIX</span>{t("home.projectSection.subtitle")}
              </h2>
              <p style={{ fontSize: 14, color: "#6B7280" }}>
                {t("home.projectSection.desc")}
              </p>
            </div>
            <button
              onClick={() => navigate("/project_search")}
              style={{
                background: "none", border: "none",
                color: "#6B7280", fontSize: 14, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 2,
                whiteSpace: "nowrap", flexShrink: 0, marginLeft: 32,
                fontFamily: BASE_FONT,
              }}
            >
              {t("home.projectSection.viewAll")} <span style={{ fontSize: 16 }}>›</span>
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
            {projects.map((proj, i) => (
              <div
                key={i}
                style={{
                  borderRadius: 16, overflow: "hidden",
                  border: "1px solid #F3F4F6",
                  backgroundColor: "white",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  cursor: "pointer",
                  transform: hoveredProject === i ? "translateY(-4px)" : "translateY(0)",
                  boxShadow: hoveredProject === i ? "0 10px 28px rgba(0,0,0,0.1)" : "0 1px 4px rgba(0,0,0,0.04)",
                }}
                onMouseEnter={() => setHoveredProject(i)}
                onMouseLeave={() => setHoveredProject(null)}
              >
                <div style={{ position: "relative", height: 200, overflow: "hidden" }}>
                  <img
                    src={PROJECTS_IMAGES[i]}
                    alt={proj.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <span style={{
                    position: "absolute", top: 14, left: 14,
                    padding: "4px 12px", borderRadius: 6,
                    backgroundColor: "rgba(0,0,0,0.62)", color: "white",
                    fontSize: 11, fontWeight: 600,
                  }}>{proj.badge}</span>
                </div>
                <div style={{ padding: "20px 20px 24px" }}>
                  <h3 style={{
                    fontSize: 15, fontWeight: 800, color: "#111827",
                    marginBottom: 8, fontFamily: BASE_FONT, lineHeight: 1.4,
                  }}>
                    {proj.title}
                  </h3>
                  <p style={{
                    fontSize: 13, color: "#6B7280",
                    lineHeight: 1.7, marginBottom: 16,
                  }}>
                    {proj.desc}
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {PROJECTS_TAGS[i].map(tag => (
                      <span key={tag} style={{
                        fontSize: 12, color: TEAL, fontWeight: 600,
                      }}>{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* ── AI SEARCH (full width) ── */}
      <section style={{
        backgroundColor: "#F0F9FF",
        padding: "56px 20px",
        marginBottom: 0,
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <span style={{
            display: "inline-block",
            color: "#6366F1", fontWeight: 700, fontSize: 13,
            marginBottom: 14,
          }}>{t("home.aiSection.title")}</span>
          <h2 style={{
            fontSize: 30, fontWeight: 900,
            marginBottom: 36, lineHeight: 1.35, fontFamily: BASE_FONT,
            background: "linear-gradient(90deg, #7DD3FC 0%, #38BDF8 25%, #818CF8 65%, #93C5FD 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>
            {t("home.aiSection.subtitle")}
          </h2>

          {/* 검색창 */}
          <div style={{
            display: "flex", maxWidth: 560, margin: "0 auto 36px",
            borderRadius: 40, overflow: "hidden",
            boxShadow: "0 2px 16px rgba(0,0,0,0.09)",
            backgroundColor: "white",
          }}>
            <input
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder={t("home.aiSection.placeholder")}
              style={{
                flex: 1, padding: "16px 24px",
                border: "none", outline: "none",
                fontSize: 14, backgroundColor: "transparent",
                fontFamily: BASE_FONT, color: "#374151",
              }}
            />
            <button onClick={handleSearch} style={{
              width: 48, height: 48, margin: "6px 6px 6px 0", borderRadius: 999,
              background: "linear-gradient(135deg, #3B82F6 0%, #6366F1 50%, #8B5CF6 100%)",
              border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0,
              boxShadow: "0 4px 14px rgba(99,102,241,0.4)",
              transition: "box-shadow 0.2s, transform 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(99,102,241,0.55)"; e.currentTarget.style.transform = "scale(1.05)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 4px 14px rgba(99,102,241,0.4)"; e.currentTarget.style.transform = "scale(1)"; }}
            >
              <Search size={18} color="white" />
            </button>
          </div>

          {/* 예시 카드 3개 */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16,
            maxWidth: 880, margin: "0 auto",
          }}>
            {examples.map((ex, i) => (
              <div
                key={i}
                onClick={() => setSearchValue(ex)}
                style={{ background: "white", borderRadius: 14, padding: "18px 20px", textAlign: "left", cursor: "pointer", border: "1.5px solid #E2E8F0", boxShadow: "0 2px 10px rgba(0,0,0,0.06)", transition: "box-shadow 0.2s, border-color 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(59,130,246,0.18)"; e.currentTarget.style.borderColor = "#BFDBFE"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.06)"; e.currentTarget.style.borderColor = "#E2E8F0"; }}
              >
                <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, background: "#F1F5F9", borderRadius: 5, padding: "2px 8px", display: "inline-block", marginBottom: 10, fontFamily: BASE_FONT }}>{t("home.aiSection.exampleLabel")}</span>
                <p style={{ fontSize: 13, color: "#334155", lineHeight: 1.7, margin: 0, fontFamily: BASE_FONT }}>
                  {(() => { let txt = ex; const parts = []; const kws = highlightKeywords[i] || [];
                    kws.forEach(kw => { const idx = txt.indexOf(kw); if (idx >= 0) { if (idx > 0) parts.push(txt.slice(0, idx)); parts.push(<span key={kw} style={{ color: "#3B82F6", fontWeight: 700 }}>{kw}</span>); txt = txt.slice(idx + kw.length); } });
                    if (txt) parts.push(txt); return parts; })()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px" }}>

        {/* ── PROJECTS 섹션은 페이지 상단으로 이동됨 ── */}

      </main>

    </div>
  );
}

export default Home;
