import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Loader2, Heart } from "lucide-react";
import AppHeader from "../components/AppHeader";
import { CONTRACT_MODAL_BY_KEY } from "../components/ContractModals";
import { projectsApi, applicationsApi } from "../api";
import useStore from "../store/useStore";
import { matchApi } from "../api/match.api";
import { renderProjectOverview } from "../lib/projectMarkdown.jsx";
import { useLanguage } from "../i18n/LanguageContext";
import translations from "../i18n/translations";

const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const PRIMARY = "#3B82F6";
const TEAL = "#0CA5A0";

const SERVICE_FIELDS = ["AI", "커머스", "웹사이트", "디자인/기획", "유지보수", "핀테크", "SaaS", "모바일", "클라우드"];
const PRIMARY_GRAD = "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)";


const GRADE_BADGE = {
  diamond: { labelKey: "projectSearch.filter.grades.diamond", color: "#1E3A8A", bg: "#DBEAFE", border: "#93C5FD" },
  platinum: { labelKey: "projectSearch.filter.grades.platinum", color: "#4C1D95", bg: "#EDE9FE", border: "#C4B5FD" },
  gold:     { labelKey: "projectSearch.filter.grades.gold",     color: "#78350F", bg: "#FEF3C7", border: "#FCD34D" },
  silver:   { labelKey: "projectSearch.filter.grades.silver",   color: "#374151", bg: "#F1F5F9", border: "#CBD5E1" },
  bronze:   { labelKey: "projectSearch.filter.grades.bronze",   color: "#92400E", bg: "#FFF7ED", border: "#FED7AA" },
  seed:     { labelKey: "projectSearch.filter.grades.seed",     color: "#166534", bg: "#F0FDF4", border: "#BBF7D0" },
};

const GRADE_LIST = [
  { key: "diamond", labelKey: "projectSearch.filter.grades.diamond", icon: "💎" },
  { key: "platinum", labelKey: "projectSearch.filter.grades.platinum", icon: "🌙" },
  { key: "gold",    labelKey: "projectSearch.filter.grades.gold",    icon: "🥇" },
  { key: "silver",  labelKey: "projectSearch.filter.grades.silver",  icon: "🥈" },
  { key: "seed",    labelKey: "projectSearch.filter.grades.seed",    icon: "🌱" },
  { key: "bronze",  labelKey: "projectSearch.filter.grades.bronze",  icon: "🥉" },
];

const CLIENT_VERIF_LIST = [
  { key: "본인인증 완료",   labelKey: "projectSearch.filter.verif.identity", icon: "✅" },
  { key: "사업자등록 완료", labelKey: "projectSearch.filter.verif.business", icon: "🏢" },
  { key: "평가 우수",       labelKey: "projectSearch.filter.verif.excellence", icon: "🏅" },
];

const LEVEL_OPTIONS = ["all", "junior", "middle", "senior"];
const PAGE_SIZE_OPTIONS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
const matchColor = (n) => n >= 90 ? "#10B981" : n >= 70 ? "#3B82F6" : "#F59E0B";

export default function ProjectSearch() {
  const { t, lang } = useLanguage();
  const tr = translations[lang]?.projectSearch || translations.en.projectSearch;
  const [allProjects, setAllProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const loadInterests = useStore(s => s.loadInterests);

  // 마운트 시 찜 목록 동기화 (하트 초기 상태용)
  useEffect(() => { loadInterests(); }, [loadInterests]);

  useEffect(() => {
    let mounted = true;
    projectsApi.list({ limit: 999 })
      .then((data) => {
        if (!mounted) return;
        const normalized = data.map((project) => ({
          ...project,
          avatarColor: project.avatarColor || "#60A5FA",
          clientId: project.clientId || `client_${project.id}`,
          slogan: project.slogan || project.title || "프로젝트",
          sloganSub: project.sloganSub || `${project.serviceField || "기타"} 프로젝트`,
          desc: project.desc || "",
          tags: Array.isArray(project.tags) ? project.tags : [],
          serviceField: project.serviceField || "기타",
          workPref: project.workPref || "협의",
          priceType: project.priceType || "유료",
          remote: Boolean(project.remote),
          level: project.level || "전체",
          grade: project.grade || "silver",
          match: project.match ?? 0,
          price: project.price || "협의",
          period: project.period || "협의",
          verifications: Array.isArray(project.verifications) ? project.verifications : [],
        }));
        setAllProjects(normalized);
        setLoadError(null);
      })
      .catch((err) => {
        console.error("[ProjectSearch] 프로젝트 로딩 실패:", err);
        if (mounted) setLoadError("프로젝트 데이터를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const [searchParams] = useSearchParams();
  const initialField = searchParams.get("field");
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery]               = useState(initialQuery); // 상단 AI 검색용
  const [nameQuery, setNameQuery]       = useState("");           // 사이드바: 프로젝트명 키워드 검색
  // 예산 슬라이더 최대값. 이 값이면 "무제한" 으로 간주하여 필터를 적용하지 않음.
  const BUDGET_MAX = 30000;
  const didAutoSearch = useRef(false);
  const [fields, setFields]             = useState(initialField ? [initialField] : []);
  const [budget, setBudget]             = useState(30000);
  const [priceType, setPriceType]       = useState([]);
  const [grades, setGrades]             = useState([]);
  const [clientVerifs, setClientVerifs] = useState([]);
  const [level, setLevel]               = useState("all");
  const [techInput, setTechInput]       = useState("");
  const [techs, setTechs]               = useState([]);
  const [remoteOnly, setRemoteOnly]     = useState(false);
  const [sort, setSort]                 = useState("latest");
  const [sortOpen, setSortOpen]         = useState(false);
  const [page, setPage]                 = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [pageSizeOpen, setPageSizeOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [applied, setApplied]           = useState(
    initialField ? { fields: [initialField], budget: 30000, priceType: [], grades: [], clientVerifs: [], level: "all", techs: [], remoteOnly: false, query: "" } : null
  );

  /* AI 매칭 점수 */
  const [aiScores, setAiScores] = useState({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  const applyFilters = () => {
    const snapshot = { fields, budget, priceType, grades, clientVerifs, level, techs, remoteOnly, query, nameQuery };
    setApplied(snapshot);
    setPage(1);

    const trimmed = (query || "").trim();
    if (!trimmed) { setAiScores({}); setAiError(null); return; }
    const candidates = allProjects.filter(p => matchesFilter(p, snapshot));
    if (candidates.length === 0) { setAiScores({}); return; }
    // 신규(id 큰 것) 우선으로 50개 cap → 방금 등록한 프로젝트도 AI 후보에 포함되게
    const candidateIds = [...candidates].sort((a, b) => b.id - a.id).slice(0, 50).map(p => p.id);

    setAiLoading(true); setAiError(null);
    const minDelay = new Promise(resolve => setTimeout(resolve, 5000));
    Promise.all([matchApi.projects(trimmed, candidateIds), minDelay])
      .then(([arr]) => {
        const map = {};
        arr.forEach(s => { map[s.id] = { matchScore: s.matchScore, reasons: s.reasons || [] }; });
        setAiScores(map);
        if (Object.keys(map).length > 0) setSort("ai");
      })
      .catch((err) => {
        console.error("[ProjectSearch] AI 매칭 실패:", err);
        const message = err?.code === "ECONNABORTED"
          ? "AI 응답이 지연되고 있어요. 잠시 후 다시 시도해주세요."
          : !err?.response
            ? "네트워크 연결이 불안정해요. 잠시 후 다시 시도해주세요."
            : "AI 매칭에 실패했어요. 잠시 후 다시 시도해주세요.";
        setAiError(message);
        setAiScores({});
      })
      .finally(() => setAiLoading(false));
  };

  useEffect(() => {
    if (allProjects.length > 0 && initialQuery && !didAutoSearch.current) {
      didAutoSearch.current = true;
      applyFilters();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProjects.length]);

  const resetFilters = () => {
    setFields([]); setBudget(30000); setPriceType([]);
    setGrades([]); setClientVerifs([]); setLevel("all"); setTechs([]); setTechInput("");
    setRemoteOnly(false); setNameQuery(""); setApplied(null); setPage(1);
    setAiScores({}); setAiError(null);
  };

  const toggleField  = (f) => setFields(p => p.includes(f) ? p.filter(x => x !== f) : [...p, f]);
  const toggleGrade  = (g) => setGrades(p => p.includes(g) ? p.filter(x => x !== g) : [...p, g]);
  const toggleVerif  = (v) => setClientVerifs(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  const addTech = (e) => {
    if (e.key === "Enter" && techInput.trim()) {
      setTechs(p => [...new Set([...p, techInput.trim()])]);
      setTechInput("");
    }
  };
  const removeTech = (t) => setTechs(p => p.filter(x => x !== t));
  const togglePrice = (pt) => setPriceType(p => p.includes(pt) ? p.filter(x => x !== pt) : [...p, pt]);

  /* 1차 필터 (재사용 가능). 자연어 query는 AI에 위임. */
  const matchesFilter = (p, applied) => {
    if (!applied) return true;
    const { fields: fs, grades: gs, clientVerifs: cvs, level: lv, techs: ts, budget: bg, remoteOnly: ro, priceType: pt, nameQuery: nq } = applied;
    const nqTrim = (nq || "").trim().toLowerCase();
    if (nqTrim) {
      const hay = `${p.title || ""} ${p.slogan || ""} ${p.clientId || ""}`.toLowerCase();
      if (!hay.includes(nqTrim)) return false;
    }
    if (fs.length && !fs.includes(p.serviceField)) return false;
    if (gs.length && !gs.includes(p.grade)) return false;
    if (cvs.length && !cvs.every(v => p.verifications.includes(v))) return false;
    if (lv !== "all" && p.level !== lv) return false;
    if (ts.length && !ts.every(t => p.tags.some(tag => tag.toLowerCase().includes(t.toLowerCase())))) return false;
    const priceMin = p.budgetMin ?? NaN;
    // bg 가 슬라이더 최대값(=무제한)이면 예산 필터 미적용
    if (bg < BUDGET_MAX && !isNaN(priceMin) && priceMin > bg) return false;
    if (ro && !p.remote) return false;
    if (pt.length) {
      const isPaid = p.priceType === "유료";
      const wantFree = pt.includes("무료/팀모임");
      const wantPaid = pt.includes("유료");
      if (wantFree && !wantPaid && isPaid) return false;
      if (wantPaid && !wantFree && !isPaid) return false;
    }
    return true;
  };

  const filtered = allProjects.filter(p => matchesFilter(p, applied));

  const effectiveMatch = (p) => {
    const ai = aiScores[p.id];
    return ai ? ai.matchScore : (p.match ?? 0);
  };

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

      <section style={{ background: "linear-gradient(160deg, #EFF6FF 0%, #E0F2FE 35%, #F0F9FF 65%, #FAF5FF 100%)", padding: "56px 20px 48px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", textAlign: "center" }}>
          <h1 style={{
            fontSize: 38, fontWeight: 900, margin: "0 0 10px", fontFamily: F,
            background: "linear-gradient(90deg, #7DD3FC 0%, #38BDF8 25%, #818CF8 65%, #93C5FD 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>{t("projectSearch.heroTitle")}</h1>
          <p style={{ fontSize: 15, color: "#64748B", margin: "0 0 32px", fontFamily: F, fontWeight: 600 }}>
            {t("projectSearch.heroTip")}
          </p>
          <div style={{ position: "relative", maxWidth: 680, margin: "0 auto 24px" }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && applyFilters()}
              placeholder={t("projectSearch.placeholder")}
              style={{ width: "100%", height: 62, borderRadius: 999, border: "1.5px solid #E2E8F0", padding: "0 74px 0 32px", fontSize: 16, fontFamily: F, outline: "none", boxSizing: "border-box", boxShadow: "0 4px 24px rgba(0,0,0,0.10)", color: "#334155", backgroundColor: "white" }}
            />
            <button
              onClick={applyFilters}
              disabled={aiLoading}
              title={aiLoading ? "AI가 찾는 중..." : "검색"}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", width: 46, height: 46, borderRadius: "50%", border: "none", background: PRIMARY_GRAD, cursor: aiLoading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(99,102,241,0.40)", transition: "transform 0.15s ease, box-shadow 0.15s ease" }}
              onMouseEnter={e => { if (!aiLoading) { e.currentTarget.style.transform = "translateY(-50%) scale(1.08)"; e.currentTarget.style.boxShadow = "0 6px 22px rgba(99,102,241,0.55)"; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(-50%)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(99,102,241,0.40)"; }}
            >{aiLoading
              ? <Loader2 size={20} color="white" className="animate-spin" />
              : <Search size={20} color="white" />}</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, maxWidth: 860, margin: "0 auto" }}>
            {tr.examples.map((ex, i) => (
              <div key={i} onClick={() => setQuery(ex)}
                style={{ background: "white", borderRadius: 14, padding: "18px 20px", textAlign: "left", cursor: "pointer", border: "1.5px solid #E2E8F0", boxShadow: "0 2px 10px rgba(0,0,0,0.06)", transition: "box-shadow 0.2s, border-color 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(59,130,246,0.18)"; e.currentTarget.style.borderColor = "#BFDBFE"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.06)"; e.currentTarget.style.borderColor = "#E2E8F0"; }}
              >
                <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, background: "#F1F5F9", borderRadius: 5, padding: "2px 8px", display: "inline-block", marginBottom: 10, fontFamily: F }}>{t("projectSearch.exampleLabel")}</span>
                <p style={{ fontSize: 13, color: "#334155", lineHeight: 1.7, margin: 0, fontFamily: F }}>
                  {(() => { let txt = ex; const parts = []; const kws = (tr.highlightKeywords || [])[i] || [];
                    kws.forEach(kw => { const idx = txt.indexOf(kw); if (idx >= 0) { if (idx > 0) parts.push(txt.slice(0, idx)); parts.push(<span key={kw} style={{ color: PRIMARY, fontWeight: 700 }}>{kw}</span>); txt = txt.slice(idx + kw.length); } });
                    if (txt) parts.push(txt); return parts; })()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 40px", display: "flex", gap: 28, alignItems: "flex-start" }}>

        {/* 필터 패널 */}
        <aside style={{ width: 280, flexShrink: 0, background: "white", borderRadius: 16, border: "1.5px solid #E2E8F0", padding: "28px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: "#1E293B", fontFamily: F }}>{t("projectSearch.filter.title")}</span>
            <button onClick={applyFilters}
              style={{ background: PRIMARY_GRAD, color: "white", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: F, boxShadow: "0 2px 10px rgba(99,102,241,0.30)", transition: "box-shadow 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 20px rgba(99,102,241,0.55)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "0 2px 10px rgba(99,102,241,0.30)"}
            >{t("projectSearch.filter.apply")}</button>
          </div>

          <FilterSection label={t("projectSearch.filter.keyword")}>
            <div style={{ position: "relative" }}>
              <input value={nameQuery} onChange={e => setNameQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && applyFilters()} placeholder={t("projectSearch.filter.keywordPlaceholder")}
                style={{ width: "100%", height: 38, borderRadius: 8, border: "1.5px solid #E2E8F0", padding: "0 36px 0 12px", fontSize: 13, fontFamily: F, outline: "none", boxSizing: "border-box" }} />
              <Search size={15} color="#94A3B8" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }} />
            </div>
          </FilterSection>

          <FilterSection label={t("projectSearch.filter.serviceField")}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SERVICE_FIELDS.map(f => (
                <button key={f} onClick={() => toggleField(f)}
                  style={{ padding: "5px 12px", borderRadius: 6, border: `1.5px solid ${fields.includes(f) ? PRIMARY : "#E2E8F0"}`, background: fields.includes(f) ? PRIMARY : "white", color: fields.includes(f) ? "white" : "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: F, transition: "all 0.15s" }}>
                  {f}
                </button>
              ))}
            </div>
          </FilterSection>

          <FilterSection label={t("projectSearch.filter.budgetMax")}>
            <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 13, color: TEAL, fontWeight: 700, fontFamily: F, marginBottom: 8 }}>{budget >= BUDGET_MAX ? t("projectSearch.filter.unlimited") : `${t("projectSearch.filter.upTo")} ${budget.toLocaleString()}`}</div>
            <input type="range" min={100} max={BUDGET_MAX} step={100} value={budget}
              onChange={e => setBudget(Number(e.target.value))}
              style={{ width: "100%", accentColor: PRIMARY, cursor: "pointer" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {[{ key: "무료/팀모임", labelKey: "projectSearch.filter.free" }, { key: "유료", labelKey: "projectSearch.filter.paid" }].map(pt => (
                <button key={pt.key} onClick={() => togglePrice(pt.key)}
                  style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `1.5px solid ${priceType.includes(pt.key) ? PRIMARY : "#E2E8F0"}`, background: priceType.includes(pt.key) ? "#EFF6FF" : "white", color: priceType.includes(pt.key) ? PRIMARY : "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: F, transition: "all 0.15s" }}>
                  {t(pt.labelKey)}
                </button>
              ))}
            </div>
          </FilterSection>

          <FilterSection label={t("projectSearch.filter.grade")}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {GRADE_LIST.map((gl) => (
                <button key={gl.key} onClick={() => toggleGrade(gl.key)}
                  style={{ padding: "8px 0", borderRadius: 8, border: `1.5px solid ${grades.includes(gl.key) ? PRIMARY : "#E2E8F0"}`, background: grades.includes(gl.key) ? "#EFF6FF" : "white", color: grades.includes(gl.key) ? PRIMARY : "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: F, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  {gl.icon} {t(gl.labelKey)}
                </button>
              ))}
            </div>
          </FilterSection>

          <FilterSection label={t("projectSearch.filter.clientVerif")}>
            {CLIENT_VERIF_LIST.map(({ key, icon, labelKey }) => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#334155", cursor: "pointer", marginBottom: 10, fontFamily: F }}>
                <input type="checkbox" checked={clientVerifs.includes(key)} onChange={() => toggleVerif(key)}
                  style={{ width: 16, height: 16, accentColor: PRIMARY, cursor: "pointer" }} />
                {icon} {t(labelKey)}
              </label>
            ))}
          </FilterSection>

          <FilterSection label={t("projectSearch.filter.level")}>
            <select value={level} onChange={e => setLevel(e.target.value)}
              style={{ width: "100%", height: 38, borderRadius: 8, border: "1.5px solid #E2E8F0", padding: "0 12px", fontSize: 14, fontFamily: F, outline: "none", cursor: "pointer", backgroundColor: "white", color: "#334155" }}>
              {LEVEL_OPTIONS.map(l => <option key={l} value={l}>{t(`projectSearch.filter.level.${l}`)}</option>)}
            </select>
          </FilterSection>

          <FilterSection label={t("projectSearch.filter.techStack")}>
            <input value={techInput} onChange={e => setTechInput(e.target.value)} onKeyDown={addTech}
              placeholder={t("projectSearch.filter.techPlaceholder")}
              style={{ width: "100%", height: 38, borderRadius: 8, border: "1.5px solid #E2E8F0", padding: "0 12px", fontSize: 13, fontFamily: F, outline: "none", boxSizing: "border-box" }} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {techs.map(t => (
                <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#EFF6FF", color: PRIMARY, borderRadius: 6, padding: "3px 8px", fontSize: 12, fontWeight: 600, fontFamily: F }}>
                  {t}<span onClick={() => removeTech(t)} style={{ cursor: "pointer", fontWeight: 900, color: "#94A3B8" }}>×</span>
                </span>
              ))}
            </div>
          </FilterSection>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <span style={{ fontSize: 14, color: "#334155", fontFamily: F }}>{t("projectSearch.filter.remoteOnly")}</span>
            <div onClick={() => setRemoteOnly(p => !p)}
              style={{ width: 44, height: 24, borderRadius: 999, background: remoteOnly ? PRIMARY : "#CBD5E1", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
              <div style={{ position: "absolute", top: 3, left: remoteOnly ? 22 : 2, width: 18, height: 18, borderRadius: "50%", background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.2)", transition: "left 0.2s" }} />
            </div>
          </div>

          <button onClick={resetFilters}
            style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "1.5px solid #E2E8F0", background: "white", color: "#64748B", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: F }}>
            {t("projectSearch.filter.reset")}
          </button>
        </aside>

        {/* 프로젝트 리스트 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 21.3, fontWeight: 900, fontFamily: F, background: PRIMARY_GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{t("projectSearch.list.title")} </span>
              <span style={{ fontSize: 14, color: "#94A3B8", fontFamily: F }}>{t("projectSearch.list.total").replace("{n}", sorted.length.toLocaleString())}</span>
              {aiLoading && (
                <span style={{ marginLeft: 12, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#3B82F6", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 999, padding: "4px 12px", fontFamily: F }}>
                  <Loader2 size={12} className="animate-spin" /> {t("projectSearch.list.searching")}
                </span>
              )}
              {!aiLoading && Object.keys(aiScores).length > 0 && (
                <span style={{ marginLeft: 12, fontSize: 12, fontWeight: 700, color: "#0F766E", background: "#CCFBF1", border: "1px solid #5EEAD4", borderRadius: 999, padding: "4px 12px", fontFamily: F }}>{t("projectSearch.list.matched")}</span>
              )}
              {aiError && (
                <span style={{ marginLeft: 12, fontSize: 12, color: "#EF4444", fontFamily: F }}>{aiError}</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* 페이지당 개수 드롭다운 */}
              <div style={{ position: "relative" }}>
                <button onClick={() => { setPageSizeOpen(p => !p); setSortOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 4, background: "white", border: "1.5px solid #E2E8F0", borderRadius: 8, padding: "8px 10px", fontSize: 14, fontWeight: 600, color: "#475569", cursor: "pointer", fontFamily: F }}>
                  {itemsPerPage} {t("common.perPage")} ∨
                </button>
                {pageSizeOpen && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: "white", border: "1.5px solid #E2E8F0", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50, minWidth: 120 }}>
                    {PAGE_SIZE_OPTIONS.map(n => (
                      <div key={n} onClick={() => { setItemsPerPage(n); setPage(1); setPageSizeOpen(false); }}
                        style={{ padding: "11px 16px", fontSize: 14, fontFamily: F, color: itemsPerPage === n ? PRIMARY : "#334155", fontWeight: itemsPerPage === n ? 700 : 500, cursor: "pointer", background: itemsPerPage === n ? "#EFF6FF" : "transparent" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                        onMouseLeave={e => e.currentTarget.style.background = itemsPerPage === n ? "#EFF6FF" : "transparent"}>
                        {n} {t("common.perPage")}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* 정렬 드롭다운 */}
              <div style={{ position: "relative" }}>
                <button onClick={() => { setSortOpen(p => !p); setPageSizeOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "white", border: "1.5px solid #E2E8F0", borderRadius: 8, padding: "8px 14px", fontSize: 14, fontWeight: 600, color: PRIMARY, cursor: "pointer", fontFamily: F }}>
                  {t("common.sort")}: {sort === "ai" ? t("projectSearch.list.sortAi") : sort === "latest" ? t("projectSearch.list.sortLatest") : t("projectSearch.list.sortFilter")} ∨
                </button>
                {sortOpen && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: "white", border: "1.5px solid #E2E8F0", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50, minWidth: 140 }}>
                    {[{ key: "ai", labelKey: "projectSearch.list.sortAi" }, { key: "latest", labelKey: "projectSearch.list.sortLatest" }, { key: "filter", labelKey: "projectSearch.list.sortFilter" }].map(s => (
                      <div key={s.key} onClick={() => { setSort(s.key); setSortOpen(false); }}
                        style={{ padding: "11px 16px", fontSize: 14, fontFamily: F, color: sort === s.key ? PRIMARY : "#334155", fontWeight: sort === s.key ? 700 : 500, cursor: "pointer", background: sort === s.key ? "#EFF6FF" : "transparent" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                        onMouseLeave={e => e.currentTarget.style.background = sort === s.key ? "#EFF6FF" : "transparent"}>
                        {t(s.labelKey)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {selectedProject ? (
            <ProjectDetail project={selectedProject} onBack={() => setSelectedProject(null)} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {loading ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8", fontSize: 16, fontFamily: F }}>
                  {t("projectSearch.errors.loading")}
                </div>
              ) : loadError ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#EF4444", fontSize: 15, fontFamily: F }}>
                  {loadError}
                </div>
              ) : pageItems.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8", fontSize: 16, fontFamily: F }}>
                  {t("projectSearch.errors.noResult")}
                </div>
              ) : pageItems.map(p => {
                const ai = aiScores[p.id];
                const merged = ai
                  ? { ...p, match: ai.matchScore, aiReasons: ai.reasons || [] }
                  : p;
                return <ProjectCard key={p.id} data={merged} onSelect={setSelectedProject} />;
              })}
            </div>
          )}

          {!selectedProject && totalPages > 1 && (() => {
            const half = 5;
            let s = Math.max(1, page - half);
            let e = Math.min(totalPages, s + 9);
            if (e - s < 9) s = Math.max(1, e - 9);
            const visPages = Array.from({ length: e - s + 1 }, (_, i) => s + i);
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

/* ── 프로젝트 카드 ─────────────────────────────────────────── */
function ProjectCard({ data, onSelect }) {
  const { t } = useLanguage();
  const [hovered, setHovered] = useState(false);
  const g = GRADE_BADGE[data.grade] || GRADE_BADGE.silver;
  const initials = data.clientId.slice(0, 2).toUpperCase();
  const isPaid = data.priceType === "유료";
  const priceTag = isPaid
    ? { labelKey: "projectSearch.priceType.paid", color: "#1D4ED8", bg: "#DBEAFE", border: "#93C5FD" }
    : { labelKey: "projectSearch.priceType.free", color: "#065F46", bg: "#D1FAE5", border: "#6EE7B7" };

  // 찜 상태 (useStore 연동)
  const isLiked = useStore(s => s.interestedProjectIds.includes(data.id));
  const toggleLike = useStore(s => s.toggleProjectInterest);
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
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.4, color: g.color, background: g.bg, border: `1px solid ${g.border}`, borderRadius: 6, padding: "3px 10px", fontFamily: F, whiteSpace: "nowrap", flexShrink: 0 }}>
            {t(g.labelKey)}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: priceTag.color, background: priceTag.bg, border: `1px solid ${priceTag.border}`, borderRadius: 6, padding: "3px 10px", fontFamily: F, whiteSpace: "nowrap", flexShrink: 0 }}>
            {t(priceTag.labelKey)}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#374151", background: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: 6, padding: "3px 10px", fontFamily: F, whiteSpace: "nowrap", flexShrink: 0 }}>
            {data.workPref}
          </span>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#1E293B", fontFamily: F, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {data.title || data.slogan}
          </span>
        </div>

        <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6, margin: "0 0 12px", fontFamily: F }}>
          {data.slogan && data.slogan !== (data.title || "") ? data.slogan : data.sloganSub}
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
                }}>✨ {r}</span>
              ))}
            </div>
          );
        })()}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {data.tags.map(tag => (
            <span key={tag} style={{ fontSize: 12, fontWeight: 600, color: "#475569", background: "#F1F5F9", borderRadius: 6, padding: "4px 10px", fontFamily: F }}>{tag}</span>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#6366F1", background: "#EEF2FF", borderRadius: 999, padding: "4px 10px", fontFamily: F }}>{data.serviceField}</span>
          {data.verifications.map((v, i) => (
            <span key={i} style={{ fontSize: 12, fontWeight: 600, color: "#059669", background: "#ECFDF5", borderRadius: 999, padding: "4px 10px", fontFamily: F }}>{v}</span>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: data.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "white", fontFamily: F, flexShrink: 0 }}>
            {initials}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#475569", fontFamily: F }}>@{data.clientId}</span>
        </div>
      </div>

      <div style={{ flexShrink: 0, textAlign: "right", width: 220, position: "relative", alignSelf: "stretch", display: "flex", flexDirection: "column" }}>
        {/* 찜 하트 */}
        <button
          onClick={handleLikeClick}
          title={isLiked ? "찜 해제" : "찜하기"}
          style={{
            position: "absolute", top: -4, right: -4,
            width: 34, height: 34, borderRadius: "50%",
            background: isLiked ? "#FEE2E2" : "#F8FAFC",
            border: `1.5px solid ${isLiked ? "#FCA5A5" : "#E2E8F0"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", transition: "all 0.15s", padding: 0,
            zIndex: 1,
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.08)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
        >
          <Heart size={16} color={isLiked ? "#EF4444" : "#94A3B8"} fill={isLiked ? "#EF4444" : "none"} strokeWidth={2.2} />
        </button>
        {Array.isArray(data.aiReasons) && (
          <div style={{ fontSize: 14, fontWeight: 800, color: matchColor(data.match), marginBottom: 6, fontFamily: F, paddingRight: 42 }}>
            {data.match}% AI Match
          </div>
        )}
        <div style={{ fontSize: 22, fontWeight: 900, color: "#3B82F6", fontFamily: F, marginBottom: 4, paddingRight: 42, whiteSpace: "nowrap" }}>
          {data.price}
        </div>
        <div style={{ fontSize: 12, color: "#94A3B8", fontFamily: F, paddingRight: 42 }}>
          {t("projectSearch.period")}: {data.period}
        </div>
        <button
          onClick={() => onSelect(data)}
          style={{ width: "100%", padding: "13px 0", borderRadius: 10, border: "none", background: "#EFF6FF", color: "#3B82F6", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: F, transition: "background 0.15s", marginTop: "auto" }}
          onMouseEnter={e => e.currentTarget.style.background = "#DBEAFE"}
          onMouseLeave={e => e.currentTarget.style.background = "#EFF6FF"}
        >
          {t("common.viewDetail")}
        </button>
      </div>
    </div>
  );
}

function FilterSection({ label, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: "#334155", margin: "0 0 12px", fontFamily: F }}>{label}</p>
      {children}
    </div>
  );
}

function PagBtn({ label, onClick, active, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ width: 38, height: 38, borderRadius: 8, border: `1.5px solid ${active ? PRIMARY : "#E2E8F0"}`, background: active ? PRIMARY : "white", color: active ? "white" : disabled ? "#CBD5E1" : "#334155", fontSize: 14, fontWeight: active ? 700 : 500, cursor: disabled ? "not-allowed" : "pointer", fontFamily: F, transition: "all 0.15s" }}>
      {label}
    </button>
  );
}

/* ── 섹션 타이틀 (ProjectDetail 외부에 선언) ───────────────── */
function SectionTitle({ children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <div style={{ width: 4, height: 22, background: PRIMARY_GRAD, borderRadius: 2 }} />
      <h2 style={{ fontSize: 18, fontWeight: 800, color: "#1E293B", margin: 0, fontFamily: F }}>{children}</h2>
    </div>
  );
}

/* ── 프로젝트 상세 ─────────────────────────────────────────── */
function ProjectDetail({ project: p, onBack }) {
  const { t } = useLanguage();
  const { userRole } = useStore();
  const isPartner = userRole === "partner" || userRole === "PARTNER";
  const [showConfirm, setShowConfirm] = useState(false);
  const [applied, setApplied] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 서버에서 내 지원 내역을 가져와 이미 지원한 프로젝트인지 확인
  useEffect(() => {
    if (!isPartner || !p?.id) return;
    let alive = true;
    applicationsApi.myList()
      .then((list) => {
        if (!alive) return;
        const found = (list || []).some((a) => Number(a.projectId) === Number(p.id));
        setApplied(found);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [p?.id, isPartner]);

  const handleApply = async () => {
    if (!isPartner) {
      alert(t("projectSearch.apply.needPartner"));
      return;
    }
    try {
      setSubmitting(true);
      await applicationsApi.apply(p.id, message?.trim() || null);
      setApplied(true);
      setShowConfirm(false);
      setMessage("");
    } catch (e) {
      alert(e?.response?.data?.message || e?.message || "지원 실패");
    } finally {
      setSubmitting(false);
    }
  };
  const g = GRADE_BADGE[p.grade] || GRADE_BADGE.silver;
  const initials = p.clientId.slice(0, 2).toUpperCase();

  // workPref에 따른 파생 데이터
  const isOutsource = p.workPref === "외주";

  const requirements = [
    `${p.tags.slice(0, 2).join("/")} 등 관련 기술 실무 경험 ${p.level === "시니어" ? "3년 이상" : p.level === "미들" ? "2년 이상" : "1년 이상"}`,
    `${p.serviceField} 도메인 프로젝트 수행 경험 우대`,
    "원활한 커뮤니케이션 능력 보유자",
  ];
  const headcount = isOutsource
    ? "1명 (파트너)"
    : "2명 (프론트엔드 1, 백엔드 1)";
  const workStyle = p.remote
    ? (isOutsource ? "원격 외주 (온라인 협업)" : "원격 근무 (주 1회 오프라인 미팅 권장)")
    : (isOutsource ? "대면 외주 (방문 협의 포함)" : "상주 근무 (주 5일 현장 출근)");
  const deadline = "2026.04.30";

  // 외주 전용 추가 섹션
  const outsourceDetails = [
    `${p.slogan}을 위한 핵심 기능 설계 및 구현`,
    "납품 기준: 기능 명세서 기반 검수 후 최종 승인",
    "최소 1회 이상 수정 반영 포함",
  ];

  // 상주(기간제) 전용 추가 섹션
  const fulltimeDetails = [
    "팀 협업 도구(Slack, Notion, Jira) 사용 환경",
    "주간 스프린트 리뷰 및 회고 참여",
    "계약 만료 후 연장 협의 가능",
  ];

  const divider = <div style={{ borderTop: "1px solid #F1F5F9", margin: "24px 0" }} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 뒤로가기 */}
      <button onClick={onBack}
        style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#64748B", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: F, padding: 0 }}
        onMouseEnter={e => e.currentTarget.style.color = PRIMARY}
        onMouseLeave={e => e.currentTarget.style.color = "#64748B"}
      >
      ← {t("projectSearch.back")}
      </button>

      {/* 단일 블록 */}
      <div style={{ background: "white", borderRadius: 16, border: "1.5px solid #E2E8F0", padding: "30px 32px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>

        {/* ① 배지 + 버튼 */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: g.color, background: g.bg, border: `1px solid ${g.border}`, borderRadius: 6, padding: "3px 10px", fontFamily: F }}>{t(g.labelKey)}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: matchColor(p.match), background: matchColor(p.match) === "#10B981" ? "#D1FAE5" : matchColor(p.match) === "#3B82F6" ? "#DBEAFE" : "#FEF3C7", borderRadius: 6, padding: "3px 10px", fontFamily: F }}>{p.match}% AI Match</span>
          </div>
          {applied ? (
            <button disabled style={{
              padding: "10px 24px", borderRadius: 10, border: "none",
              background: "#D1FAE5", color: "#065F46", fontSize: 14, fontWeight: 700,
              cursor: "default", fontFamily: F, whiteSpace: "nowrap"
            }}>
              ✓ {t("projectSearch.applied")}
            </button>
          ) : (
            <button onClick={() => setShowConfirm(true)} style={{
              padding: "10px 24px", borderRadius: 10, border: "none",
              background: PRIMARY_GRAD, color: "white", fontSize: 14, fontWeight: 700,
              cursor: "pointer", fontFamily: F, boxShadow: "0 4px 14px rgba(99,102,241,0.3)", whiteSpace: "nowrap"
            }}>
              {t("projectSearch.apply.button")}
            </button>
          )}
        </div>

        {/* 지원 확인 모달 */}
        {showConfirm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setShowConfirm(false)}>
            <div style={{ background: "white", borderRadius: 20, padding: "36px 32px", maxWidth: 420, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", fontFamily: F }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 28, textAlign: "center", marginBottom: 12 }}>📋</div>
              <h2 style={{ fontSize: 18, fontWeight: 900, color: "#0F172A", margin: "0 0 8px", textAlign: "center" }}>{t("projectSearch.applyModal.title")}</h2>
              <p style={{ fontSize: 14, color: "#475569", textAlign: "center", lineHeight: 1.7, margin: "0 0 16px" }}>
                <strong style={{ color: "#1E293B" }}>{p.slogan}</strong><br />
                {t("projectSearch.applyModal.confirm")}
              </p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("projectSearch.applyModal.messagePlaceholder")}
                rows={4}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 10,
                  border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: F,
                  resize: "vertical", marginBottom: 18, boxSizing: "border-box",
                  color: "#0F172A", outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowConfirm(false)} disabled={submitting} style={{
                  flex: 1, padding: "11px 0", borderRadius: 10, border: "1.5px solid #E5E7EB",
                  background: "white", color: "#64748B", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: F,
                  opacity: submitting ? 0.5 : 1,
                }}>{t("common.cancel")}</button>
                <button onClick={handleApply} disabled={submitting} style={{
                  flex: 1, padding: "11px 0", borderRadius: 10, border: "none",
                  background: PRIMARY_GRAD, color: "white", fontSize: 14, fontWeight: 700,
                  cursor: submitting ? "not-allowed" : "pointer", fontFamily: F,
                  boxShadow: "0 4px 14px rgba(99,102,241,0.3)", opacity: submitting ? 0.7 : 1,
                }}>{submitting ? t("projectSearch.applying") : t("projectSearch.applyAction")}</button>
              </div>
            </div>
          </div>
        )}

        {/* ② 제목 */}
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0F172A", margin: "0 0 16px", fontFamily: F }}>{p.slogan}</h1>

        {/* ③ 견적·기간 박스 */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
          {[
            { label: t("projectSearch.detail.estimatedCost"), value: p.price, big: true },
            { label: t("projectSearch.detail.estimatedPeriod"), value: p.period, big: false },
          ].map(({ label, value, big }) => (
            <div key={label} style={{ background: "#F8FAFC", borderRadius: 10, border: "1px solid #E2E8F0", padding: "14px 24px", flex: "1 1 120px" }}>
              <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, marginBottom: 4, fontFamily: F }}>{label}</div>
              <div style={{ fontSize: big ? 22 : 18, fontWeight: 900, color: "#1E293B", fontFamily: F }}>{value}</div>
            </div>
          ))}
        </div>

        {divider}

        {/* ④ 프로젝트 개요 */}
        <SectionTitle>{t("projectSearch.detail.overview")}</SectionTitle>
        {renderProjectOverview(p.desc)}

        {divider}

        {/* ⑤ 필요 기술 스택 */}
        <SectionTitle>{t("projectSearch.detail.techStack")}</SectionTitle>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {p.tags.map(t => (
            <span key={t} style={{ fontSize: 13, fontWeight: 700, color: "#1D4ED8", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "5px 14px", fontFamily: F }}>{t}</span>
          ))}
        </div>

        {divider}

        {/* ⑥ 상세 요구사항 */}
        <SectionTitle>{isOutsource ? t("projectSearch.detail.requirements") : t("projectSearch.detail.workEnv")}</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(isOutsource ? outsourceDetails : fulltimeDetails).map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ color: PRIMARY, fontWeight: 900, marginTop: 1, flexShrink: 0 }}>✔</span>
              <span style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, fontFamily: F }}>{item}</span>
            </div>
          ))}
        </div>

        {divider}

        {/* ⑦ 근무 환경 및 모집 요건 */}
        <SectionTitle>{t("projectSearch.detail.recruitInfo")}</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
          {[
            { label: t("projectSearch.detail.headcount"), value: headcount },
            { label: t("projectSearch.detail.workType"), value: workStyle },
            { label: t("projectSearch.detail.contractPeriod"), value: p.period },
            { label: t("projectSearch.detail.deadline"), value: <span style={{ color: "#EF4444", fontWeight: 700 }}>{deadline}</span> },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, marginBottom: 4, fontFamily: F }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", fontFamily: F }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 10, fontFamily: F }}>자격 요건</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {requirements.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ color: "#94A3B8", flexShrink: 0 }}>·</span>
              <span style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, fontFamily: F }}>{r}</span>
            </div>
          ))}
        </div>

        {divider}

        {/* ⑦.5 7가지 세부 협의사항 — 등록 시 입력한 내용이 있으면 탭으로 노출 */}
        <ContractTermsTabs terms={p.contractTerms} />

        {divider}

        {/* ⑧ 클라이언트 정보 */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: p.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 900, color: "white", fontFamily: F, flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", fontFamily: F }}>@{p.clientId}</div>
            <div style={{ fontSize: 12, color: "#94A3B8", fontFamily: F, marginTop: 2 }}>{t("projectSearch.detail.clientTrust")} 4.9/5.0</div>
            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              {p.verifications.map((v, i) => (
                <span key={i} style={{ fontSize: 11, fontWeight: 600, color: "#059669", background: "#ECFDF5", borderRadius: 999, padding: "3px 10px", fontFamily: F }}>{v}</span>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   7가지 세부 협의사항 탭 뷰 (read-only)
   - 등록 시 입력했던 contractTerms JSON 을 7개 탭으로 노출
───────────────────────────────────────────────────────── */
// DB(project_modules.module_key) 표준 키와 일치시킴.
const CONTRACT_TABS = [
  { key: "scope" },
  { key: "deliverable" },
  { key: "schedule" },
  { key: "payment" },
  { key: "revision" },
  { key: "completion" },
  { key: "terms" },
];

// 프로젝트 등록 폼은 일부 키를 다른 이름으로 보냄 (deliverables=복수, specialTerms).
// project_modules 테이블의 표준 키(deliverable/terms)와 호환시키기 위한 alias.
const TAB_KEY_ALIAS = {
  deliverable: ["deliverable", "deliverables"],
  terms: ["terms", "specialTerms"],
};
function pickTermData(terms, key) {
  if (!terms) return undefined;
  const candidates = TAB_KEY_ALIAS[key] || [key];
  for (const k of candidates) {
    if (terms[k] != null) return terms[k];
  }
  return undefined;
}

function ContractTermsTabs({ terms }) {
  const [active, setActive] = useState("scope");
  const { lang, t } = useLanguage();
  const tabLabels = (translations[lang] || translations.en)?.projectSearch?.detail?.contractTabLabels
    || ("1. Scope,2. Deliverables,3. Schedule,4. Payment,5. Revisions,6. Completion,7. Special Terms").split(",");
  if (!terms || typeof terms !== "object" || Object.keys(terms).length === 0) {
    return (
      <div>
        <SectionTitle>{t("projectSearch.detail.contractTermsTitle")}</SectionTitle>
        <div style={{
          padding: "20px 24px", background: "#F8FAFC", border: "1px dashed #CBD5E1",
          borderRadius: 12, fontSize: 13, color: "#64748B", fontFamily: F, textAlign: "center",
        }}>
          {t("projectSearch.detail.contractTermsEmpty")}
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle>{t("projectSearch.detail.contractTermsTitle")}</SectionTitle>

      {/* 탭 헤더 */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14, borderBottom: "1px solid #E2E8F0", paddingBottom: 0 }}>
        {CONTRACT_TABS.map((tab, idx) => {
          const has = pickTermData(terms, tab.key) != null;
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              style={{
                padding: "9px 14px", border: "none", background: "none",
                borderBottom: isActive ? "2.5px solid #3B82F6" : "2.5px solid transparent",
                color: isActive ? "#1D4ED8" : has ? "#475569" : "#CBD5E1",
                fontSize: 13, fontWeight: isActive ? 800 : 600, fontFamily: F,
                cursor: "pointer", marginBottom: -1,
              }}
            >{tabLabels[idx]}{!has && " ·"}</button>
          );
        })}
      </div>

      {/* 탭 본문 — 세부협의 모달을 inline + readOnly 로 렌더링 (세부협의미팅과 동일 디자인, 수정/수락 버튼만 제거) */}
      <div style={{
        background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12,
        padding: "18px 22px", minHeight: 80, fontFamily: F,
      }}>
        <ContractTermInlineModal termKey={active} data={pickTermData(terms, active)} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   ContractTermInlineModal
   - 세부협의 모달(ContractModals)을 inline + readOnly 로 임베드.
   - DB 의 contractTerms[key] 데이터를 그대로 모달의 value 로 전달.
   - data 가 줄글({text}) 만 있는 구버전이면 줄글로 fallback.
───────────────────────────────────────────────────────── */
function ContractTermInlineModal({ termKey, data }) {
  const Comp = CONTRACT_MODAL_BY_KEY[termKey];
  const { t } = useLanguage();
  if (!data) {
    return <div style={{ fontSize: 13, color: "#94A3B8" }}>{t("projectSearch.detail.contractTermsNoData")}</div>;
  }
  // 모듈에서 사용 가능한 구조화된 키가 하나라도 있으면 모달로 렌더, 아니면 줄글 fallback
  const structuredKeys = ["included","excluded","memo","deliverables","formats","delivery","notes","phases","milestones","total","payments","freeItems","paidItems","items","steps","terms"];
  const hasStructured = data && typeof data === "object" && structuredKeys.some(k => data[k] != null);
  if (!Comp || !hasStructured) {
    if (data && typeof data === "object" && data.text) {
      return <Prose text={String(data.text)} />;
    }
    return <div style={{ fontSize: 13, color: "#94A3B8" }}>{t("projectSearch.detail.contractTermsNoData")}</div>;
  }
  return (
    <Comp
      inline
      readOnly
      showHeaderStatusBadge={false}
      value={data}
      onClose={() => {}}
      onSubmit={null}
      onChange={null}
    />
  );
}

function ContractTermContent({ termKey, data }) {
  if (!data) {
    return <div style={{ fontSize: 13, color: "#94A3B8" }}>이 항목은 아직 입력되지 않았어요.</div>;
  }
  switch (termKey) {
    case "scope":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {data.text && <Prose text={data.text} />}
          {Array.isArray(data.included) && <ListBlock title="포함 작업" items={data.included} dotColor="#3B82F6" />}
          {Array.isArray(data.excluded) && <ListBlock title="제외 작업" items={data.excluded} dotColor="#9CA3AF" muted />}
          {data.memo && <Memo text={data.memo} />}
        </div>
      );
    case "deliverable":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {data.text && <Prose text={data.text} />}
          {Array.isArray(data.deliverables) && (
            <div>
              <BlockTitle>전달물 목록</BlockTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.deliverables.map((d, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#374151" }}>
                    <span style={{ fontSize: 18 }}>{d.icon}</span>
                    <span>{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {Array.isArray(data.formats) && <ListBlock title="파일 형식" items={data.formats} dotColor="#10B981" />}
          {Array.isArray(data.delivery) && <ListBlock title="전달 방법" items={data.delivery} dotColor="#3B82F6" />}
          {Array.isArray(data.notes) && <ListBlock title="유의사항" items={data.notes} dotColor="#F59E0B" />}
        </div>
      );
    case "schedule":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {data.text && <Prose text={data.text} />}
          {Array.isArray(data.phases) && (
            <div>
              <BlockTitle>마일스톤</BlockTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.phases.map((ph, i) => (
                  <div key={i} style={{ padding: "10px 14px", background: "white", border: "1px solid #E2E8F0", borderRadius: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#3B82F6", marginBottom: 4 }}>{ph.num} · {ph.title}</div>
                    <div style={{ fontSize: 13, color: "#374151", marginBottom: 4 }}>{ph.desc}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>완료 예정: {ph.date} · {ph.weeks}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, color: "#475569" }}>
            {data.startDate && <span>시작: <b>{data.startDate}</b></span>}
            {data.endDate && <span>종료: <b>{data.endDate}</b></span>}
            {data.launchDate && <span>런칭: <b>{data.launchDate}</b></span>}
          </div>
          {Array.isArray(data.reviewRules) && (
            <div>
              <BlockTitle>검토/피드백 규칙</BlockTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {data.reviewRules.map((r, i) => (
                  <div key={i} style={{ fontSize: 13, color: "#374151" }}>
                    <b style={{ color: "#1E293B" }}>{r.label}</b> — {r.value}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    case "payment":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {data.text && <Prose text={data.text} />}
          {data.total && (
            <div style={{ padding: "12px 16px", background: "white", border: "1px solid #E2E8F0", borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 4 }}>총 결제 금액 {data.vatNote ? `(${data.vatNote})` : ""}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#0F172A" }}>₩{data.total}</div>
            </div>
          )}
          {Array.isArray(data.stages) && (
            <div>
              <BlockTitle>결제 단계</BlockTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.stages.map((s, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "white", border: "1px solid #E2E8F0", borderRadius: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>{s.label}</div>
                      <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{s.desc}</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#3B82F6" }}>{s.amount}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {data.bankName && (
            <div style={{ fontSize: 12, color: "#64748B" }}>
              <b style={{ color: "#1E293B" }}>입금 계좌</b>: {data.bankName} {data.bankNote && `· ${data.bankNote}`}
            </div>
          )}
          {Array.isArray(data.extraPolicies) && <ListBlock title="추가 정책" items={data.extraPolicies} dotColor="#F59E0B" />}
        </div>
      );
    case "revision":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {data.text && <Prose text={data.text} />}
          {Array.isArray(data.freeItems) && <ListBlock title="무상 수정 범위" items={data.freeItems} dotColor="#10B981" />}
          {Array.isArray(data.paidItems) && <ListBlock title="유상 수정 기준" items={data.paidItems} dotColor="#EF4444" />}
          {data.memo && <Memo text={data.memo} />}
        </div>
      );
    case "completion":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {data.text && <Prose text={data.text} />}
          {Array.isArray(data.steps) && (
            <div>
              <BlockTitle>완료 절차</BlockTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.steps.map((s, i) => (
                  <div key={i} style={{ padding: "10px 14px", background: "white", border: "1px solid #E2E8F0", borderRadius: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#3B82F6", marginBottom: 3 }}>STEP {s.n}. {s.title}</div>
                    <div style={{ fontSize: 13, color: "#475569" }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {Array.isArray(data.criteria) && <ListBlock title="검수 기준" items={data.criteria} dotColor="#3B82F6" />}
          {Array.isArray(data.categories) && (
            <div>
              <BlockTitle>최종 산출물 카테고리</BlockTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {data.categories.map((c, i) => (
                  <div key={i} style={{ fontSize: 13, color: "#374151" }}>
                    <b style={{ color: "#1E293B" }}>{c.n}. {c.title}</b> — {c.desc}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    case "terms":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {data.text && <Prose text={data.text} />}
          {data.intro && (
            <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.7 }}>{data.intro}</div>
          )}
          {Array.isArray(data.terms) && data.terms.map((t, i) => (
            <div key={i} style={{
              padding: "12px 14px", background: "white",
              border: `1px solid ${t.enabled ? "#BFDBFE" : "#E2E8F0"}`,
              borderRadius: 10, opacity: t.enabled ? 1 : 0.6,
            }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: t.enabled ? "#1D4ED8" : "#94A3B8", marginBottom: 6 }}>
                {t.icon} {t.title} {t.enabled ? "" : "(미적용)"}
              </div>
              {Array.isArray(t.items) && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {t.items.map((it, j) => (
                    <div key={j} style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>• {it}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    default:
      return <pre style={{ fontSize: 12, color: "#475569", whiteSpace: "pre-wrap" }}>{JSON.stringify(data, null, 2)}</pre>;
  }
}

function BlockTitle({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 800, color: "#1E40AF", marginBottom: 8, fontFamily: F }}>{children}</div>;
}
function ListBlock({ title, items, dotColor = "#3B82F6", muted = false }) {
  return (
    <div>
      <BlockTitle>{title}</BlockTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, marginTop: 7, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: muted ? "#6B7280" : "#374151", lineHeight: 1.55, fontFamily: F }}>{it}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function Memo({ text }) {
  return (
    <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "12px 14px" }}>
      {String(text).split("\n").map((line, i) => (
        <div key={i} style={{ fontSize: 13, color: "#92400E", lineHeight: 1.6, fontFamily: F }}>• {line}</div>
      ))}
    </div>
  );
}
function Prose({ text }) {
  return (
    <div style={{ fontSize: 13.5, color: "#1E293B", lineHeight: 1.75, fontFamily: F, whiteSpace: "pre-wrap" }}>{text}</div>
  );
}
