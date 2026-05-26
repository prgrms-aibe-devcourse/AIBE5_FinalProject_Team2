import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, Loader2, Heart } from "lucide-react";
import AppHeader from "../components/AppHeader";
import useStore from "../store/useStore";
import heroDefault from "../assets/hero_default.png";
import heroStudent from "../assets/hero_student.png";
import heroMoney from "../assets/hero_money.png";
import heroVacation from "../assets/hero_vacation.png";
import heroTeacher from "../assets/hero_teacher.png";
import heroCheck from "../assets/hero_check.png";
import heroMeeting from "../assets/hero_meeting.png";
import { partnersApi } from "../api";
import { matchApi } from "../api/match.api";
import { useLanguage } from "../i18n/LanguageContext";
import translations from "../i18n/translations";

const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const PRIMARY = "#3B82F6";
const TEAL = "#0CA5A0";

const HERO_MAP = {
  default: heroDefault,
  student: heroStudent,
  money: heroMoney,
  vacation: heroVacation,
  teacher: heroTeacher,
  check: heroCheck,
  meeting: heroMeeting,
};

/* ── 데이터 (백엔드 API에서 로드) ───────────────────────────────── */
// PartnerSearch 컴포넌트 내부에서 useEffect로 fetch.


const SERVICE_FIELDS = ["AI", "커머스", "웹사이트", "디자인/기획", "유지보수", "핀테크", "SaaS", "모바일", "클라우드"];
const PRIMARY_GRAD = "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)";

/* ── 등급 배지 설정 ──────────────────────────────────────── */
const GRADE_BADGE = {
  diamond: { labelKey: "partnerSearch.filter.grades.diamond", color: "#1E3A8A", bg: "#DBEAFE", border: "#93C5FD" },
  platinum: { labelKey: "partnerSearch.filter.grades.platinum", color: "#4C1D95", bg: "#EDE9FE", border: "#C4B5FD" },
  gold:     { labelKey: "partnerSearch.filter.grades.gold",     color: "#78350F", bg: "#FEF3C7", border: "#FCD34D" },
  silver:   { labelKey: "partnerSearch.filter.grades.silver",   color: "#374151", bg: "#F1F5F9", border: "#CBD5E1" },
  bronze:   { labelKey: "partnerSearch.filter.grades.bronze",   color: "#92400E", bg: "#FFF7ED", border: "#FED7AA" },
  seed:     { labelKey: "partnerSearch.filter.grades.seed",     color: "#166534", bg: "#F0FDF4", border: "#BBF7D0" },
};

/* ── 유틸 ──────────────────────────────────────────────────── */
const GRADE_LIST = [
  { key: "diamond", labelKey: "partnerSearch.filter.grades.diamond", icon: "💎" },
  { key: "platinum", labelKey: "partnerSearch.filter.grades.platinum", icon: "🌙" },
  { key: "gold",    labelKey: "partnerSearch.filter.grades.gold",     icon: "🥇" },
  { key: "silver",  labelKey: "partnerSearch.filter.grades.silver",   icon: "🥈" },
  { key: "seed",    labelKey: "partnerSearch.filter.grades.seed",     icon: "🌱" },
  { key: "bronze",  labelKey: "partnerSearch.filter.grades.bronze",   icon: "🥉" },
];
const LEVEL_OPTIONS = ["전체", "주니어", "미들", "시니어"];
const PAGE_SIZE_OPTIONS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
const matchColor = (n) => n >= 90 ? "#10B981" : n >= 70 ? "#3B82F6" : "#F59E0B";

export default function PartnerSearch() {
  const { t, lang } = useLanguage();
  const tr = translations[lang]?.partnerSearch || translations.en.partnerSearch;
  const examples = tr.examples;
  const highlightKeywords = tr.highlightKeywords || [];
  // ===== 백엔드 API 데이터 =====
  const [allPartners, setAllPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const loadInterests = useStore(s => s.loadInterests);

  // 마운트 시 찜 목록 동기화
  useEffect(() => { loadInterests(); }, [loadInterests]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    partnersApi.list({ limit: 999 })
      .then((data) => {
        if (!mounted) return;
        // hero 이미지 매핑 추가
        const mapped = data.map(p => ({ ...p, heroImg: HERO_MAP[p.heroKey] || heroDefault }));
        setAllPartners(mapped);
        setLoadError(null);
      })
      .catch((err) => {
        console.error("[PartnerSearch] 파트너 로딩 실패:", err);
        if (mounted) setLoadError(t("partnerSearch.errors.loadFail"));
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const didAutoSearch = useRef(false);
  
  // AI 자연어 검색 (위의 검색창)
  const [aiQuery, setAiQuery] = useState(initialQuery);
  
  // 필터 검색어 (이름으로 필터링)
  const [nameFilter, setNameFilter] = useState("");
  
  const [typeFilter, setTypeFilter] = useState({ 개인: false, 팀: false, 기업: false });
  const [fields, setFields]         = useState([]);
  const [budget, setBudget]         = useState(5000);
  const [priceType, setPriceType]   = useState([]);       // [] | ['무료'] | ['유료'] | ['무료','유료']
  const [grades, setGrades]         = useState([]);
  const [level, setLevel]           = useState("전체");
  const [techInput, setTechInput]   = useState("");
  const [techs, setTechs]           = useState([]);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [sort, setSort]             = useState("latest");
  const [sortOpen, setSortOpen]     = useState(false);
  const [page, setPage]             = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [pageSizeOpen, setPageSizeOpen] = useState(false);

  /* 적용된 필터 (필터 적용 버튼 클릭 시) */
  const [applied, setApplied] = useState(null);

  /* AI 매칭 점수 (id -> { matchScore, reasons }) */
  const [aiScores, setAiScores] = useState({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  const applyFilters = () => {
    const snapshot = { typeFilter, fields, budget, priceType, grades, level, techs, remoteOnly, aiQuery, nameFilter };
    setApplied(snapshot);
    setPage(1);

    // 자연어 aiQuery가 있으면 AI 매칭 호출. 1차 필터로 좁힌 후보 id 배열만 보냄.
    const trimmed = (aiQuery || "").trim();
    if (!trimmed) {
      setAiScores({});
      setAiError(null);
      return;
    }
    // 1차 필터링: 동일 로직 (clientside) → 후보 id 추출
    const candidates = allPartners.filter(p => matchesFilter(p, snapshot));
    if (candidates.length === 0) {
      setAiScores({});
      return;
    }
    // 신규(id 큰 것) 우선으로 50개 cap → 방금 등록한 파트너도 AI 후보에 포함되게
    const candidateIds = [...candidates].sort((a, b) => b.id - a.id).slice(0, 50).map(p => p.id);

    setAiLoading(true);
    setAiError(null);
    const minDelay = new Promise(resolve => setTimeout(resolve, 5000));
    Promise.all([matchApi.partners(trimmed, candidateIds), minDelay])
      .then(([arr]) => {
        const map = {};
        arr.forEach(s => { map[s.id] = { matchScore: s.matchScore, reasons: s.reasons || [] }; });
        setAiScores(map);
        if (Object.keys(map).length > 0) setSort("ai");
      })
      .catch((err) => {
        console.error("[PartnerSearch] AI 매칭 실패:", err);
        const message = err?.code === "ECONNABORTED"
          ? t("partnerSearch.errors.aiDelay")
            : !err?.response
              ? t("partnerSearch.errors.networkError")
              : t("partnerSearch.errors.aiFail");
        setAiError(message);
        setAiScores({});
      })
      .finally(() => setAiLoading(false));
  };
  useEffect(() => {
    if (allPartners.length > 0 && initialQuery && !didAutoSearch.current) {
      didAutoSearch.current = true;
      applyFilters();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPartners.length]);

  const resetFilters = () => {
    setTypeFilter({ 개인: false, 팀: false, 기업: false });
    setFields([]); setBudget(5000); setPriceType([]);
    setGrades([]); setLevel("전체"); setTechs([]); setTechInput("");
    setRemoteOnly(false); setApplied(null); setPage(1);
    setAiScores({}); setAiError(null);
    setNameFilter(""); // 이름 필터 초기화
  };

  const toggleField  = (f) => setFields(p => p.includes(f) ? p.filter(x => x !== f) : [...p, f]);
  const toggleGrade  = (g) => setGrades(p => p.includes(g) ? p.filter(x => x !== g) : [...p, g]);
  const addTech = (e) => {
    if (e.key === "Enter" && techInput.trim()) {
      setTechs(p => [...new Set([...p, techInput.trim()])]);
      setTechInput("");
    }
  };
  const removeTech = (t) => setTechs(p => p.filter(x => x !== t));

  const togglePrice = (pt) => setPriceType(p => p.includes(pt) ? p.filter(x => x !== pt) : [...p, pt]);

  /* 1차 필터 (재사용 가능하게 함수로 분리) */
  const matchesFilter = (p, applied) => {
    if (!applied) return true;
    const { typeFilter: tf, grades: gs, level: lv, techs: ts, budget: bg, remoteOnly: ro, nameFilter: nf } = applied;
    
    // 이름 필터링 (username, name, title에서 검색)
    if (nf && nf.trim()) {
      const searchLower = nf.toLowerCase();
      const usernameMatch = (p.username || "").toLowerCase().includes(searchLower);
      const nameMatch = (p.name || "").toLowerCase().includes(searchLower);
      const titleMatch = (p.title || "").toLowerCase().includes(searchLower);
      if (!usernameMatch && !nameMatch && !titleMatch) return false;
    }
    
    const anyType = Object.values(tf).some(Boolean);
    if (anyType && !tf[p.partnerType]) return false;
    if (gs.length && !gs.includes(p.grade)) return false;
    if (lv !== "전체" && p.level !== lv) return false;
    if (ts.length && !ts.every(t => (p.tags || []).some(tag => tag.toLowerCase().includes(t.toLowerCase())))) return false;
    const priceNum = parseInt(String(p.price || "0").replace(/[^0-9]/g, ""), 10) * 10000;
    if (priceNum > bg * 10000) return false;
    if (ro && !p.remote) return false;
    return true;
  };

  /* 필터링 */
  const filtered = allPartners.filter(p => matchesFilter(p, applied));

  /* AI 점수가 있으면 덮어쓴 효과적 점수 계산. 없으면 원래 p.match. */
  const effectiveMatch = (p) => {
    const ai = aiScores[p.id];
    return ai ? ai.matchScore : (p.match ?? 0);
  };

  /* 정렬 */
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "ai") return effectiveMatch(b) - effectiveMatch(a);
    if (sort === "latest") return b.id - a.id;
    return effectiveMatch(b) - effectiveMatch(a);
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / itemsPerPage));
  const pageItems  = sorted.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F8FAFC", fontFamily: F }}>
      <AppHeader />

      {/* ── AI 추천 검색 배너 ── */}
      <section style={{ background: "linear-gradient(160deg, #EFF6FF 0%, #E0F2FE 35%, #F0F9FF 65%, #FAF5FF 100%)", padding: "56px 20px 48px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", textAlign: "center" }}>
          <h1 style={{ fontSize: 38, fontWeight: 900, margin: "0 0 10px", fontFamily: F,
            background: "linear-gradient(90deg, #7DD3FC 0%, #38BDF8 25%, #818CF8 65%, #93C5FD 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text"
          }}>
            {t("partnerSearch.heroTitle")}
          </h1>
          <p style={{ fontSize: 15, color: "#64748B", margin: "0 0 32px", fontFamily: F, fontWeight: 600 }}>
            {t("partnerSearch.heroTip")}
          </p>

          {/* 검색창 */}
          <div style={{ position: "relative", maxWidth: 680, margin: "0 auto 24px" }}>
            <input
              value={aiQuery}
              onChange={e => setAiQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && applyFilters()}
              placeholder={t("partnerSearch.placeholder")}
              style={{ width: "100%", height: 62, borderRadius: 999, border: "1.5px solid #E2E8F0", padding: "0 74px 0 32px", fontSize: 16, fontFamily: F, outline: "none", boxSizing: "border-box", boxShadow: "0 4px 24px rgba(0,0,0,0.10)", color: "#334155", backgroundColor: "white" }}
            />
            <button
              onClick={applyFilters}
              disabled={aiLoading}
              title={aiLoading ? t("partnerSearch.list.searching") : t("partnerSearch.placeholder")}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", width: 46, height: 46, borderRadius: "50%", border: "none", background: PRIMARY_GRAD, cursor: aiLoading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(99,102,241,0.40)", transition: "transform 0.15s ease, box-shadow 0.15s ease" }}
              onMouseEnter={e => { if (!aiLoading) { e.currentTarget.style.transform = "translateY(-50%) scale(1.08)"; e.currentTarget.style.boxShadow = "0 6px 22px rgba(99,102,241,0.55)"; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(-50%)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(99,102,241,0.40)"; }}
            >
              {aiLoading
                ? <Loader2 size={20} color="white" className="animate-spin" />
                : <Search size={20} color="white" />}
            </button>
          </div>

          {/* 예시 카드 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, maxWidth: 860, margin: "0 auto" }}>
            {examples.map((ex, i) => (
              <div
                key={i}
                onClick={() => { setAiQuery(ex); }}
                style={{ background: "white", borderRadius: 14, padding: "18px 20px", textAlign: "left", cursor: "pointer", border: "1.5px solid #E2E8F0", boxShadow: "0 2px 10px rgba(0,0,0,0.06)", transition: "box-shadow 0.2s, border-color 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(59,130,246,0.18)"; e.currentTarget.style.borderColor = "#BFDBFE"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.06)"; e.currentTarget.style.borderColor = "#E2E8F0"; }}
              >
                <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, background: "#F1F5F9", borderRadius: 5, padding: "2px 8px", display: "inline-block", marginBottom: 10, fontFamily: F }}>{t("partnerSearch.exampleLabel")}</span>
                <p style={{ fontSize: 13, color: "#334155", lineHeight: 1.7, margin: 0, fontFamily: F }}>
                  {(() => { let txt = ex; const parts = []; const kws = highlightKeywords[i] || [];
                    kws.forEach(kw => { const idx = txt.indexOf(kw); if (idx >= 0) { if (idx > 0) parts.push(txt.slice(0, idx)); parts.push(<span key={kw} style={{ color: PRIMARY, fontWeight: 700 }}>{kw}</span>); txt = txt.slice(idx + kw.length); } });
                    if (txt) parts.push(txt); return parts; })()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>


      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 40px", display: "flex", gap: 28, alignItems: "flex-start" }}>

        {/* ── 왼쪽 필터 패널 ── */}
        <aside style={{ width: 280, flexShrink: 0, background: "white", borderRadius: 16, border: "1.5px solid #E2E8F0", padding: "28px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: "#1E293B", fontFamily: F }}>{t("partnerSearch.filter.title")}</span>
            <button
              onClick={applyFilters}
              style={{ background: PRIMARY_GRAD, color: "white", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: F, boxShadow: "0 2px 10px rgba(99,102,241,0.30)", transition: "box-shadow 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 20px rgba(99,102,241,0.55)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "0 2px 10px rgba(99,102,241,0.30)"}
              onMouseDown={e => e.currentTarget.style.boxShadow = "0 0 0 4px rgba(99,102,241,0.35), 0 4px 20px rgba(99,102,241,0.6)"}
              onMouseUp={e => e.currentTarget.style.boxShadow = "0 4px 20px rgba(99,102,241,0.55)"}
            >
              {t("partnerSearch.filter.apply")}
            </button>
          </div>

          {/* 검색어 */}
          <FilterSection label={t("partnerSearch.filter.keyword")}>
            <div style={{ position: "relative" }}>
              <input
                value={nameFilter}
                onChange={e => setNameFilter(e.target.value)}
                placeholder={t("partnerSearch.filter.keywordPlaceholder")}
                style={{ width: "100%", height: 38, borderRadius: 8, border: "1.5px solid #E2E8F0", padding: "0 36px 0 12px", fontSize: 13, fontFamily: F, outline: "none", boxSizing: "border-box" }}
              />
              <Search size={15} color="#94A3B8" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }} />
            </div>
          </FilterSection>

          {/* 파트너 유형 */}
          <FilterSection label={t("partnerSearch.filter.partnerType")}>
            {(() => {
              const TYPE_LABEL_KEYS = { 개인: "individual", 팀: "team", 기업: "company" };
              return Object.keys(typeFilter).map(typeKey => (
                <label key={typeKey} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#334155", cursor: "pointer", marginBottom: 8, fontFamily: F }}>
                  <input
                    type="checkbox"
                    checked={typeFilter[typeKey]}
                    onChange={() => setTypeFilter(p => ({ ...p, [typeKey]: !p[typeKey] }))}
                    style={{ width: 16, height: 16, accentColor: PRIMARY, cursor: "pointer" }}
                  />
                  {t(`partnerSearch.filter.${TYPE_LABEL_KEYS[typeKey] || typeKey}`)}
                </label>
              ));
            })()}
          </FilterSection>

          {/* 서비스 분야 */}
          <FilterSection label={t("partnerSearch.filter.serviceField")}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SERVICE_FIELDS.map(f => (
                <button
                  key={f}
                  onClick={() => toggleField(f)}
                  style={{ padding: "5px 12px", borderRadius: 6, border: `1.5px solid ${fields.includes(f) ? PRIMARY : "#E2E8F0"}`, background: fields.includes(f) ? PRIMARY : "white", color: fields.includes(f) ? "white" : "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: F, transition: "all 0.15s" }}
                >
                  {f}
                </button>
              ))}
            </div>
          </FilterSection>

          {/* 예산 */}
          <FilterSection label={t("partnerSearch.filter.budget")}>
            <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 13, color: TEAL, fontWeight: 700, fontFamily: F, marginBottom: 8 }}>~ {budget.toLocaleString()}{lang === "en" ? "万KRW" : lang === "zh" ? "万韩元" : "만원"}</div>
            <input
              type="range" min={100} max={10000} step={100}
              value={budget}
              onChange={e => setBudget(Number(e.target.value))}
              style={{ width: "100%", accentColor: PRIMARY, cursor: "pointer" }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {[{ key: "free", label: t("partnerSearch.filter.free") }, { key: "paid", label: t("partnerSearch.filter.paid") }].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => togglePrice(key)}
                  style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `1.5px solid ${priceType.includes(key) ? PRIMARY : "#E2E8F0"}`, background: priceType.includes(key) ? "#EFF6FF" : "white", color: priceType.includes(key) ? PRIMARY : "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: F, transition: "all 0.15s" }}
                >
                  {label}
                </button>
              ))}
            </div>
          </FilterSection>

          {/* 파트너 등급 */}
          <FilterSection label={t("partnerSearch.filter.grade")}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {GRADE_LIST.map(({ key, labelKey, icon }) => (
                <button
                  key={key}
                  onClick={() => toggleGrade(key)}
                  style={{ padding: "8px 0", borderRadius: 8, border: `1.5px solid ${grades.includes(key) ? PRIMARY : "#E2E8F0"}`, background: grades.includes(key) ? "#EFF6FF" : "white", color: grades.includes(key) ? PRIMARY : "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: F, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                >
                  {icon} {t(labelKey)}
                </button>
              ))}
            </div>
          </FilterSection>

          {/* 경력 수준 */}
          <FilterSection label={t("partnerSearch.filter.level")}>
            <select
              value={level}
              onChange={e => setLevel(e.target.value)}
              style={{ width: "100%", height: 38, borderRadius: 8, border: "1.5px solid #E2E8F0", padding: "0 12px", fontSize: 14, fontFamily: F, outline: "none", cursor: "pointer", backgroundColor: "white", color: "#334155" }}
            >
              {LEVEL_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </FilterSection>

          {/* 필수 기술 스택 */}
          <FilterSection label={t("partnerSearch.filter.techStack")}>
            <input
              value={techInput}
              onChange={e => setTechInput(e.target.value)}
              onKeyDown={addTech}
              placeholder={t("partnerSearch.filter.techPlaceholder")}
              style={{ width: "100%", height: 38, borderRadius: 8, border: "1.5px solid #E2E8F0", padding: "0 12px", fontSize: 13, fontFamily: F, outline: "none", boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {techs.map(tech => (
                <span key={tech} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#EFF6FF", color: PRIMARY, borderRadius: 6, padding: "3px 8px", fontSize: 12, fontWeight: 600, fontFamily: F }}>
                  {tech}
                  <span onClick={() => removeTech(tech)} style={{ cursor: "pointer", fontWeight: 900, color: "#94A3B8" }}>×</span>
                </span>
              ))}
            </div>
          </FilterSection>

          {/* 원격 근무만 보기 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <span style={{ fontSize: 14, color: "#334155", fontFamily: F }}>{t("partnerSearch.filter.remoteOnly")}</span>
            <div
              onClick={() => setRemoteOnly(p => !p)}
              style={{ width: 44, height: 24, borderRadius: 999, background: remoteOnly ? PRIMARY : "#CBD5E1", cursor: "pointer", position: "relative", transition: "background 0.2s" }}
            >
              <div style={{ position: "absolute", top: 3, left: remoteOnly ? 22 : 2, width: 18, height: 18, borderRadius: "50%", background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.2)", transition: "left 0.2s" }} />
            </div>
          </div>

          <button
            onClick={resetFilters}
            style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "1.5px solid #E2E8F0", background: "white", color: "#64748B", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: F }}
          >
            {t("partnerSearch.filter.reset")}
          </button>
        </aside>

        {/* ── 오른쪽 파트너 리스트 ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 헤더 행 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 21.3, fontWeight: 900, fontFamily: F, background: PRIMARY_GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{t("partnerSearch.list.title")} </span>
              <span style={{ fontSize: 14, color: "#94A3B8", fontFamily: F }}>{t("partnerSearch.list.total").replace("{count}", sorted.length.toLocaleString())}</span>
              {aiLoading && (
                <span style={{ marginLeft: 12, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#3B82F6", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 999, padding: "4px 12px", fontFamily: F }}>
                  <Loader2 size={12} className="animate-spin" /> {t("partnerSearch.list.searching")}
                </span>
              )}
              {!aiLoading && Object.keys(aiScores).length > 0 && (
                <span style={{ marginLeft: 12, fontSize: 12, fontWeight: 700, color: "#0F766E", background: "#CCFBF1", border: "1px solid #5EEAD4", borderRadius: 999, padding: "4px 12px", fontFamily: F }}>{t("partnerSearch.list.matched")}</span>
              )}
              {aiError && (
                <span style={{ marginLeft: 12, fontSize: 12, color: "#EF4444", fontFamily: F }}>{aiError}</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* 페이지당 개수 드롭다운 */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => { setPageSizeOpen(p => !p); setSortOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 4, background: "white", border: "1.5px solid #E2E8F0", borderRadius: 8, padding: "8px 10px", fontSize: 14, fontWeight: 600, color: "#475569", cursor: "pointer", fontFamily: F }}
                >
                  {itemsPerPage}{t("partnerSearch.list.showCount").replace("{n}", "").replace("Show ", "") || " items"} ∨
                </button>
                {pageSizeOpen && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: "white", border: "1.5px solid #E2E8F0", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50, minWidth: 120 }}>
                    {PAGE_SIZE_OPTIONS.map(n => (
                      <div
                        key={n}
                        onClick={() => { setItemsPerPage(n); setPage(1); setPageSizeOpen(false); }}
                        style={{ padding: "11px 16px", fontSize: 14, fontFamily: F, color: itemsPerPage === n ? PRIMARY : "#334155", fontWeight: itemsPerPage === n ? 700 : 500, cursor: "pointer", background: itemsPerPage === n ? "#EFF6FF" : "transparent" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                        onMouseLeave={e => e.currentTarget.style.background = itemsPerPage === n ? "#EFF6FF" : "transparent"}
                      >
                        {n}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* 정렬 드롭다운 */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => { setSortOpen(p => !p); setPageSizeOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "white", border: "1.5px solid #E2E8F0", borderRadius: 8, padding: "8px 14px", fontSize: 14, fontWeight: 600, color: PRIMARY, cursor: "pointer", fontFamily: F }}
                >
                  {t("common.sort")}: {tr.list[sort === "ai" ? "sortAI" : sort === "latest" ? "sortLatest" : "sortFilter"]} ∨
                </button>
                {sortOpen && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: "white", border: "1.5px solid #E2E8F0", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50, minWidth: 140 }}>
                    {[{key:"ai",label:t("partnerSearch.list.sortAI")},{key:"latest",label:t("partnerSearch.list.sortLatest")},{key:"filter",label:t("partnerSearch.list.sortFilter")}].map(({ key, label }) => (
                      <div
                        key={key}
                        onClick={() => { setSort(key); setSortOpen(false); }}
                        style={{ padding: "11px 16px", fontSize: 14, fontFamily: F, color: sort === key ? PRIMARY : "#334155", fontWeight: sort === key ? 700 : 500, cursor: "pointer", background: sort === key ? "#EFF6FF" : "transparent" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                        onMouseLeave={e => e.currentTarget.style.background = sort === key ? "#EFF6FF" : "transparent"}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 파트너 카드 목록 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8", fontSize: 16, fontFamily: F }}>
                {t("partnerSearch.errors.loadFail")}
              </div>
            ) : loadError ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#EF4444", fontSize: 15, fontFamily: F }}>
                {loadError}
              </div>
            ) : pageItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8", fontSize: 16, fontFamily: F }}>
                {t("common.noResult") || "No results found."}
              </div>
            ) : pageItems.map(p => {
              const ai = aiScores[p.id];
              const merged = ai
                ? { ...p, match: ai.matchScore, aiReasons: ai.reasons || [] }
                : p;
              return <PartnerCard key={p.id} data={merged} />;
            })}
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (() => {
            const half = 5;
            let startPage = Math.max(1, page - half);
            let endPage = Math.min(totalPages, startPage + 9);
            if (endPage - startPage < 9) startPage = Math.max(1, endPage - 9);
            const visPages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
            return (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 40 }}>
                <PagBtn label="<" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} />
                {visPages.map(n => (
                  <PagBtn key={n} label={n} onClick={() => setPage(n)} active={page === n} />
                ))}
                <PagBtn label=">" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} />
              </div>
            );
          })()}
        </div>
      </div>

    </div>
  );
}

/* ── 파트너 카드 ──────────────────────────────────────────── */
function PartnerCard({ data }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [hovered, setHovered] = useState(false);
  const g = GRADE_BADGE[data.grade] || GRADE_BADGE.silver;

  // 찜 상태 (useStore 연동)
  const isLiked = useStore(s => s.interestedPartnerIds.includes(data.id));
  const toggleLike = useStore(s => s.togglePartnerInterest);
  const handleLikeClick = (e) => {
    e.stopPropagation();
    toggleLike(data.id).catch(() => {});
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "white", borderRadius: 16,
        border: `1.5px solid ${hovered ? "#BFDBFE" : "#E2E8F0"}`,
        padding: "22px 26px",
        boxShadow: hovered ? "0 6px 24px rgba(59,130,246,0.10)" : "0 2px 8px rgba(0,0,0,0.04)",
        transition: "all 0.2s", display: "flex", gap: 20, alignItems: "flex-start",
        position: "relative",
      }}
    >
      {/* 찜 하트 (카드 우상단 절대 위치) */}
      <button
        onClick={handleLikeClick}
        title={isLiked ? "찜 해제" : "찜하기"}
        style={{
          position: "absolute", top: 12, right: 14, zIndex: 2,
          width: 34, height: 34, borderRadius: "50%",
          background: isLiked ? "#FEE2E2" : "#F8FAFC",
          border: `1.5px solid ${isLiked ? "#FCA5A5" : "#E2E8F0"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", transition: "all 0.15s", padding: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.08)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
      >
        <Heart size={16} color={isLiked ? "#EF4444" : "#94A3B8"} fill={isLiked ? "#EF4444" : "none"} strokeWidth={2.2} />
      </button>
      {/* 왼쪽 콘텐츠 */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* 등급 배지 + 슬로건 + AI 추천 */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.4, color: g.color, background: g.bg, border: `1px solid ${g.border}`, borderRadius: 6, padding: "3px 10px", fontFamily: F, whiteSpace: "nowrap", flexShrink: 0 }}>
            {t(g.labelKey)}
          </span>
          <span style={{ fontSize: 16, fontWeight: 800, color: "#1E293B", fontFamily: F, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
            {data.slogan}
          </span>
          {Array.isArray(data.aiReasons) && (
            <span style={{ fontSize: 12, fontWeight: 800, color: matchColor(data.match), background: `${matchColor(data.match)}18`, borderRadius: 99, padding: "3px 10px", whiteSpace: "nowrap", flexShrink: 0, fontFamily: F }}>
              {data.match}% {t("partnerSearch.list.sortAI")}
            </span>
          )}
        </div>

        {/* 부제목 - 한줄 자기소개 */}
        <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6, margin: "0 0 24px", fontFamily: F }}>
          {data.shortBio || data.sloganSub}
        </p>

        {/* AI 매칭 이유 (AI 검색 실제 수행될 때만) */}
        {Array.isArray(data.aiReasons) && (() => {
          const reasons = data.aiReasons.length > 0
            ? data.aiReasons
            : [
                `AI 매칭 점수 ${data.match}%`,
                ...(Array.isArray(data.tags) && data.tags.length > 0 ? [`핵심 기술: ${data.tags.slice(0, 2).join(", ")}`] : []),
                ...(data.serviceField ? [`${data.serviceField} 분야 적합`] : []),
              ].slice(0, 3);
          if (reasons.length === 0) return null;
          return (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {reasons.map((r, i) => (
                <span key={i} style={{
                  fontSize: 11, fontWeight: 700, color: "#0F766E",
                  background: "#CCFBF1", border: "1px solid #5EEAD4",
                  borderRadius: 999, padding: "3px 10px", fontFamily: F,
                }}>
                  ✨ {r}
                </span>
              ))}
            </div>
          );
        })()}

        {/* 기술 태그 + 서비스 분야 chip — 한 행으로 통합해 카드 하단으로 내림 */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {/* 서비스 분야 / 파트너 유형 / 선호 방식 (빈값은 제외) */}
          {[data.serviceField, data.partnerType, data.workPref]
            .filter(c => c != null && String(c).trim() !== "")
            .map((chip, i) => (
              <span key={`f-${i}`} style={{
                fontSize: 12, fontWeight: 600, color: "#6366F1",
                background: "#EEF2FF", borderRadius: 999, padding: "4px 10px", fontFamily: F,
              }}>{chip}</span>
            ))}
          {/* 기술 태그 */}
          {data.tags.map(tag => (
            <span key={tag} style={{ fontSize: 12, fontWeight: 600, color: "#475569", background: "#F1F5F9", borderRadius: 6, padding: "4px 10px", fontFamily: F }}>{tag}</span>
          ))}
        </div>

      </div>

      {/* 오른쪽 영역 */}
      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 180 }}>
        {/* Hero 이미지 */}
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: "white",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "2px solid #E2E8F0", flexShrink: 0,
          overflow: "hidden",
        }}>
          <img src={data.profileImageUrl || data.heroImg || heroDefault} alt="avatar" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.currentTarget.src = heroDefault; }} />
        </div>
        {/* 아이디 */}
        <span style={{ fontSize: 13, fontWeight: 700, color: "#475569", fontFamily: F }}>@{data.username}</span>
        {/* 상세보기 */}
        <button
          onClick={() => navigate("/partner_profile_view", { state: { partner: data } })}
          style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "none", background: "#EFF6FF", color: "#3B82F6", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: F, transition: "background 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.background = "#DBEAFE"}
          onMouseLeave={e => e.currentTarget.style.background = "#EFF6FF"}
        >
          {t("common.viewDetail")}
        </button>
      </div>
    </div>
  );
}

/* ── 필터 섹션 래퍼 ──────────────────────────────────────── */
function FilterSection({ label, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: "#334155", margin: "0 0 12px", fontFamily: F }}>{label}</p>
      {children}
    </div>
  );
}

/* ── 페이지네이션 버튼 ──────────────────────────────────── */
function PagBtn({ label, onClick, active, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 38, height: 38, borderRadius: 8,
        border: `1.5px solid ${active ? PRIMARY : "#E2E8F0"}`,
        background: active ? PRIMARY : "white",
        color: active ? "white" : disabled ? "#CBD5E1" : "#334155",
        fontSize: 14, fontWeight: active ? 700 : 500,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: F, transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}
