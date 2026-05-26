import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Palette, Search } from "lucide-react";
import homeBg from "../assets/home.png";
import { useLanguage } from "../i18n/LanguageContext";
import translations from "../i18n/translations";
import { trustScoreLabel, krwFmt } from "../mock/strategies";
import { loadHomeStrategies, seedLeveragedUniverse } from "../lib/strategiesApi";

const TEAL = "#0CA5A0";
const NAVY = "#0F2C52";

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

function renderHighlighted(text, keywords) {
  let txt = text;
  const parts = [];
  (keywords || []).forEach(kw => {
    const idx = txt.indexOf(kw);
    if (idx >= 0) {
      if (idx > 0) parts.push(txt.slice(0, idx));
      parts.push(<span key={kw} style={{ color: "#3B82F6", fontWeight: 700 }}>{kw}</span>);
      txt = txt.slice(idx + kw.length);
    }
  });
  if (txt) parts.push(txt);
  return parts;
}

function Client_Home() {
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const [searchValue, setSearchValue] = useState("");
  const [hoveredCat, setHoveredCat] = useState(null);
  const [hoveredProject, setHoveredProject] = useState(null);

  const tr = translations[lang]?.home || translations.en.home;
  const examples = tr.aiSection.examples;
  const highlightKeywords = tr.aiSection.highlightKeywords || [];
  const projects = tr.projectSection.projects;
  const categories = CATEGORIES_STYLE.map(cat => ({ ...cat, label: t(`home.categories.${cat.key}`) }));

  // ─── 백엔드 API로 전략/시그널/백테스트 요약 로드 ───
  const [btResults, setBtResults] = useState(null);
  const [btError, setBtError] = useState(null);
  const [seedingLev, setSeedingLev] = useState(false);
  useEffect(() => {
    let alive = true;
    loadHomeStrategies()
      .then(r => { if (alive) setBtResults(r); })
      .catch(e => { if (alive) setBtError(e?.response?.data?.error || e?.message || "strategies load failed"); });
    return () => { alive = false; };
  }, []);

  const handleSearch = () => {
    if (!searchValue.trim()) return;
    const q = searchValue.trim();
    const partnerKw = ['partner', 'developer', 'designer', 'freelancer', 'engineer', '파트너', '개발자', '디자이너', '프리랜서'];
    const clientKw = ['client', 'company', '클라이언트', '발주', '고객사'];
    if (partnerKw.some(k => q.toLowerCase().includes(k.toLowerCase()))) navigate(`/partner_search?q=${encodeURIComponent(q)}`);
    else if (clientKw.some(k => q.toLowerCase().includes(k.toLowerCase()))) navigate(`/client_search?q=${encodeURIComponent(q)}`);
    else navigate(`/project_search?q=${encodeURIComponent(q)}`);
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#fff", fontFamily: BASE_FONT }}>

      {/* HERO */}
      <section style={{ position: "relative", width: "100%", height: 520, overflow: "hidden" }}>
        <img src={homeBg} alt="hero" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.0001) 0%, rgba(0,0,0,0.0001) 50%, rgba(0,0,0,0.0001) 100%)" }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 20px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <h1 style={{ fontSize: 44, fontWeight: 900, color: "white", lineHeight: 1.35, marginBottom: 20, textShadow: "0 2px 16px rgba(0,0,0,0.25)", fontFamily: BASE_FONT, textAlign: "center" }}>
              {t("home.clientHeroTitle1")}<br />{t("home.clientHeroTitle2")}
            </h1>
            <div style={{ display: "inline-flex", alignItems: "center", backgroundColor: "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 999, padding: "8px 20px", marginBottom: 28 }}>
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.95)", fontFamily: BASE_FONT, fontWeight: 500 }}>
                {t("home.heroSubtitle")}
              </span>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => navigate("/partner_search")}
                style={{ padding: "12px 26px", borderRadius: 8, border: "1.5px solid rgba(255,255,255,0.3)", backgroundColor: "#0CA5A0", color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: BASE_FONT, transition: "box-shadow 0.2s, transform 0.2s, background-color 0.2s" }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = "0 0 0 4px rgba(255,255,255,0.18), 0 4px 18px rgba(12,165,160,0.45)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.backgroundColor = "#0BB8B2";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.backgroundColor = "#0CA5A0";
                }}
              >
                {t("home.clientBtnFind")}
              </button>
              <button
                onClick={() => navigate("/project_register")}
                style={{ padding: "12px 26px", borderRadius: 8, border: "1.5px solid rgba(255,255,255,0.3)", backgroundColor: "#0F2C52", color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: BASE_FONT, transition: "box-shadow 0.2s, transform 0.2s, background-color 0.2s" }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = "0 0 0 4px rgba(255,255,255,0.18), 0 4px 18px rgba(15,44,82,0.5)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.backgroundColor = "#163D70";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.backgroundColor = "#0F2C52";
                }}
              >
                {t("home.clientBtnRegister")}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORIES 섹션 제거됨 — 검증된 전략 템플릿만 노출 */}
      {/* AI SEARCH 섹션 제거됨 (상단 TopBar 검색 + AI 채팅 도크로 대체) */}
      {/* MY STRATEGIES / TODAY'S LIVING BRIEFING 섹션 제거됨 */}

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px" }}>
        {/* PROJECTS */}
        <section style={{ marginBottom: 80, paddingTop: 64 }}>
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
            <button onClick={() => navigate("/alpha?lib=1")} style={{ background: "none", border: "none", color: "#6B7280", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 2, whiteSpace: "nowrap", flexShrink: 0, marginLeft: 32, fontFamily: BASE_FONT }}>
              {t("home.projectSection.viewAll")} <span style={{ fontSize: 16 }}>›</span>
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
            {projects.map((proj, i) => (
              <div key={i}
                style={{ borderRadius: 16, overflow: "hidden", border: "1px solid #F3F4F6", backgroundColor: "white", transition: "transform 0.2s, box-shadow 0.2s", cursor: "pointer", transform: hoveredProject === i ? "translateY(-4px)" : "translateY(0)", boxShadow: hoveredProject === i ? "0 10px 28px rgba(0,0,0,0.1)" : "0 1px 4px rgba(0,0,0,0.04)" }}
                onClick={() => navigate("/alpha?lib=1")}
                onMouseEnter={() => setHoveredProject(i)} onMouseLeave={() => setHoveredProject(null)}>
                <div style={{ position: "relative", height: 200, overflow: "hidden" }}>
                  <img src={PROJECTS_IMAGES[i]} alt={proj.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <span style={{ position: "absolute", top: 14, left: 14, padding: "4px 12px", borderRadius: 6, backgroundColor: "rgba(0,0,0,0.62)", color: "white", fontSize: 11, fontWeight: 600 }}>{proj.badge}</span>
                </div>
                <div style={{ padding: "20px 20px 24px" }}>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 8, fontFamily: BASE_FONT, lineHeight: 1.4 }}>{proj.title}</h3>
                  <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.7, marginBottom: 16 }}>{proj.desc}</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {PROJECTS_TAGS[i].map(tag => (<span key={tag} style={{ fontSize: 12, color: TEAL, fontWeight: 600 }}>{tag}</span>))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

    </div>
  );
}

export default Client_Home;
