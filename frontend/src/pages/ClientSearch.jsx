import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, Loader2 } from "lucide-react";
import AppHeader from "../components/AppHeader";
import { clientsApi } from "../api";
import { matchApi } from "../api/match.api";
import heroCheck from "../assets/hero_check.png";
import { useLanguage } from "../i18n/LanguageContext";
import translations from "../i18n/translations";

const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const PRIMARY = "#3B82F6";
const TEAL = "#0CA5A0";
const PRIMARY_GRAD = "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)";

/* ── 매칭 점수 합성 (백엔드 미제공 fallback용) ─── */
const computeMatch = (c) =>
  Math.min(99, Math.round(60 + ((c.rating || 0) * 6) + ((c.completedProjects || 0) * 0.3)));

const WORK_PREF_LABEL = { 0: "대면 선호", 1: "원격 선호", 2: "혼합 가능" };

/* ── 데이터: 백엔드 API에서 로드 ─────────────── */
// ClientSearch 컴포넌트 내부에서 useEffect로 fetch.

const SERVICE_FIELDS = ["AI", "커머스", "웹사이트", "디자인/기획", "유지보수", "핀테크", "SaaS", "모바일", "클라우드"];

/* ── 등급 배지 설정 ──────────────────────────────────── */
const GRADE_BADGE = {
  diamond: { labelKey: "clientSearch.filter.grades.diamond", color: "#1E3A8A", bg: "#DBEAFE", border: "#93C5FD" },
  platinum: { labelKey: "clientSearch.filter.grades.platinum", color: "#4C1D95", bg: "#EDE9FE", border: "#C4B5FD" },
  gold:     { labelKey: "clientSearch.filter.grades.gold",     color: "#78350F", bg: "#FEF3C7", border: "#FCD34D" },
  silver:   { labelKey: "clientSearch.filter.grades.silver",   color: "#374151", bg: "#F1F5F9", border: "#CBD5E1" },
  bronze:   { labelKey: "clientSearch.filter.grades.bronze",   color: "#92400E", bg: "#FFF7ED", border: "#FED7AA" },
  seed:     { labelKey: "clientSearch.filter.grades.seed",     color: "#166534", bg: "#F0FDF4", border: "#BBF7D0" },
};

const GRADE_LIST = [
  { key: "diamond", labelKey: "clientSearch.filter.grades.diamond", icon: "💎" },
  { key: "platinum", labelKey: "clientSearch.filter.grades.platinum", icon: "🌙" },
  { key: "gold",    labelKey: "clientSearch.filter.grades.gold",    icon: "🥇" },
  { key: "silver",  labelKey: "clientSearch.filter.grades.silver",  icon: "🥈" },
  { key: "seed",    labelKey: "clientSearch.filter.grades.seed",    icon: "🌱" },
  { key: "bronze",  labelKey: "clientSearch.filter.grades.bronze",  icon: "🥉" },
];
const LEVEL_OPTIONS = ["all", "junior", "middle", "senior"];
const PAGE_SIZE_OPTIONS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

const matchColor = (n) => n >= 90 ? "#10B981" : n >= 70 ? "#3B82F6" : "#F59E0B";

export default function ClientSearch() {
  const { t, lang } = useLanguage();
  const tr = translations[lang]?.clientSearch || translations.en.clientSearch;
  // ===== 백엔드 API 데이터 =====
  const [allClients, setAllClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let mounted = true;
    clientsApi.list({ limit: 999 })
      .then((data) => {
        if (!mounted) return;
        // 백엔드가 match/workPrefLabel/remote를 이미 계산해 보내지만,
        // 누락 시 클라이언트 fallback으로 보강.
        const mapped = data.map(c => ({
          ...c,
          match: c.match ?? computeMatch(c),
          remote: c.remote ?? (c.preferredWorkType === 1),
          workPrefLabel: c.workPrefLabel ?? (WORK_PREF_LABEL[c.preferredWorkType] ?? "대면 선호"),
        }));
        setAllClients(mapped);
        setLoadError(null);
      })
      .catch((err) => {
        console.error("[ClientSearch] 클라이언트 로딩 실패:", err);
        if (mounted) setLoadError("클라이언트 데이터를 불러오지 못했습니다.");
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const didAutoSearch = useRef(false);
  const [query, setQuery]           = useState(initialQuery); // 상단 AI 검색용
  const [nameQuery, setNameQuery]   = useState("");           // 사이드바: 클라이언트명 키워드 검색
  const [typeFilter, setTypeFilter] = useState({ 개인: false, 개인사업자: false, 법인사업자: false, 팀: false });
  const [fields, setFields]         = useState([]);
  const [budget, setBudget]         = useState(5000);
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

  const [applied, setApplied] = useState(null);

  /* AI 매칭 점수 */
  const [aiScores, setAiScores] = useState({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  const applyFilters = () => {
    const snapshot = { typeFilter, fields, budget, grades, level, techs, remoteOnly, query, nameQuery };
    setApplied(snapshot);
    setPage(1);

    const trimmed = (query || "").trim();
    if (!trimmed) { setAiScores({}); setAiError(null); return; }
    const candidates = allClients.filter(c => matchesFilter(c, snapshot));
    if (candidates.length === 0) { setAiScores({}); return; }
    // 신규(id 큰 것) 우선으로 50개 cap → 방금 등록한 계정도 AI 후보에 포함되게
    const candidateIds = [...candidates].sort((a, b) => b.id - a.id).slice(0, 50).map(c => c.id);

    setAiLoading(true); setAiError(null);
    const minDelay = new Promise(resolve => setTimeout(resolve, 5000));
    Promise.all([matchApi.clients(trimmed, candidateIds), minDelay])
      .then(([arr]) => {
        const map = {};
        arr.forEach(s => { map[s.id] = { matchScore: s.matchScore, reasons: s.reasons || [] }; });
        setAiScores(map);
        if (Object.keys(map).length > 0) setSort("ai");
      })
      .catch((err) => {
        console.error("[ClientSearch] AI 매칭 실패:", err);
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
    if (allClients.length > 0 && initialQuery && !didAutoSearch.current) {
      didAutoSearch.current = true;
      applyFilters();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allClients.length]);

  const resetFilters = () => {
    setTypeFilter({ 개인: false, 개인사업자: false, 법인사업자: false, 팀: false });
    setFields([]); setBudget(5000);
    setGrades([]); setLevel("all"); setTechs([]); setTechInput("");
    setRemoteOnly(false); setNameQuery(""); setApplied(null); setPage(1);
    setAiScores({}); setAiError(null);
  };

  const toggleField = (f) => setFields(p => p.includes(f) ? p.filter(x => x !== f) : [...p, f]);
  const toggleGrade = (g) => setGrades(p => p.includes(g) ? p.filter(x => x !== g) : [...p, g]);
  const addTech = (e) => {
    if (e.key === "Enter" && techInput.trim()) {
      setTechs(p => [...new Set([...p, techInput.trim()])]);
      setTechInput("");
    }
  };
  const removeTech = (t) => setTechs(p => p.filter(x => x !== t));

  /* 1차 필터 (재사용 가능). 자연어 query는 AI에 위임하므로 키워드 매칭은 생략. */
  const matchesFilter = (c, applied) => {
    if (!applied) return true;
    const { typeFilter: tf, fields: fds, grades: gs, level: lv, techs: ts, budget: bg, remoteOnly: ro, nameQuery: nq } = applied;
    const nqTrim = (nq || "").trim().toLowerCase();
    if (nqTrim) {
      const hay = `${c.name || ""} ${c.username || ""}`.toLowerCase();
      if (!hay.includes(nqTrim)) return false;
    }
    const anyType = Object.values(tf).some(Boolean);
    if (anyType && !tf[c.clientType]) return false;
    if (fds.length && !fds.some(f => (c.industry || "").toLowerCase().includes(f.toLowerCase()))) return false;
    if (gs.length && !gs.includes(c.grade)) return false;
    if (lv !== "all" && !(c.preferredLevels || []).includes(lv)) return false;
    if (ts.length && !ts.every(t => (c.preferredSkills || []).some(s => s.toLowerCase().includes(t.toLowerCase())))) return false;
    // 예산 비교: bg는 만원 단위, budgetMax는 원 단위 → 만원 단위로 변환하여 비교
    if (((c.budgetMax || 0) / 10000) > bg) return false;
    if (ro && !c.remote) return false;
    return true;
  };

  /* 필터링 */
  const filtered = allClients.filter(c => matchesFilter(c, applied));

  const effectiveMatch = (c) => {
    const ai = aiScores[c.id];
    return ai ? ai.matchScore : (c.match ?? 0);
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
            {t("clientSearch.heroTitle")}
          </h1>
          <p style={{ fontSize: 15, color: "#64748B", margin: "0 0 32px", fontFamily: F, fontWeight: 600 }}>
            {t("clientSearch.heroTip")}
          </p>

          {/* 검색창 */}
          <div style={{ position: "relative", maxWidth: 680, margin: "0 auto 24px" }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && applyFilters()}
              placeholder={t("clientSearch.placeholder")}
              style={{ width: "100%", height: 62, borderRadius: 999, border: "1.5px solid #E2E8F0", padding: "0 74px 0 32px", fontSize: 16, fontFamily: F, outline: "none", boxSizing: "border-box", boxShadow: "0 4px 24px rgba(0,0,0,0.10)", color: "#334155", backgroundColor: "white" }}
            />
            <button
              onClick={applyFilters}
              disabled={aiLoading}
              title={aiLoading ? "AI가 찾는 중..." : "검색"}
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
            {tr.examples.map((ex, i) => (
              <div
                key={i}
                onClick={() => { setQuery(ex); }}
                style={{ background: "white", borderRadius: 14, padding: "18px 20px", textAlign: "left", cursor: "pointer", border: "1.5px solid #E2E8F0", boxShadow: "0 2px 10px rgba(0,0,0,0.06)", transition: "box-shadow 0.2s, border-color 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(59,130,246,0.18)"; e.currentTarget.style.borderColor = "#BFDBFE"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.06)"; e.currentTarget.style.borderColor = "#E2E8F0"; }}
              >
                <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, background: "#F1F5F9", borderRadius: 5, padding: "2px 8px", display: "inline-block", marginBottom: 10, fontFamily: F }}>{t("clientSearch.exampleLabel")}</span>
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

      {/* ── 메인 콘텐츠 (필터 + 리스트) ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 40px", display: "flex", gap: 28, alignItems: "flex-start" }}>

        {/* ── 왼쪽 필터 패널 ── */}
        <aside style={{ width: 280, flexShrink: 0, background: "white", borderRadius: 16, border: "1.5px solid #E2E8F0", padding: "28px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: "#1E293B", fontFamily: F }}>{t("clientSearch.filter.title")}</span>
            <button
              onClick={applyFilters}
              style={{ background: PRIMARY_GRAD, color: "white", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: F, boxShadow: "0 2px 10px rgba(99,102,241,0.30)", transition: "box-shadow 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 20px rgba(99,102,241,0.55)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "0 2px 10px rgba(99,102,241,0.30)"}
              onMouseDown={e => e.currentTarget.style.boxShadow = "0 0 0 4px rgba(99,102,241,0.35), 0 4px 20px rgba(99,102,241,0.6)"}
              onMouseUp={e => e.currentTarget.style.boxShadow = "0 4px 20px rgba(99,102,241,0.55)"}
            >
              {t("clientSearch.filter.apply")}
            </button>
          </div>

          {/* 검색어 (클라이언트명 키워드 검색 - 상단 AI 검색과 별개) */}
          <FilterSection label={t("clientSearch.filter.keyword")}>
            <div style={{ position: "relative" }}>
              <input
                value={nameQuery}
                onChange={e => setNameQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && applyFilters()}
                placeholder={t("clientSearch.filter.keywordPlaceholder")}
                style={{ width: "100%", height: 38, borderRadius: 8, border: "1.5px solid #E2E8F0", padding: "0 36px 0 12px", fontSize: 13, fontFamily: F, outline: "none", boxSizing: "border-box" }}
              />
              <Search size={15} color="#94A3B8" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }} />
            </div>
          </FilterSection>

          <FilterSection label={t("clientSearch.filter.clientType")}>
            {(() => {
              const TYPE_LABEL_KEYS = { 개인: "individual", 개인사업자: "soleProprietor", 법인사업자: "corporation", 팀: "team" };
              return Object.keys(typeFilter).map(typeKey => (
                <label key={typeKey} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#334155", cursor: "pointer", marginBottom: 8, fontFamily: F }}>
                  <input
                    type="checkbox"
                    checked={typeFilter[typeKey]}
                    onChange={() => setTypeFilter(p => ({ ...p, [typeKey]: !p[typeKey] }))}
                    style={{ width: 16, height: 16, accentColor: PRIMARY, cursor: "pointer" }}
                  />
                  {t(`clientSearch.filter.${TYPE_LABEL_KEYS[typeKey] || typeKey}`)}
                </label>
              ));
            })()}
          </FilterSection>

          <FilterSection label={t("clientSearch.filter.projectField")}>
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

          <FilterSection label={t("clientSearch.filter.budgetMax")}>
            <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 13, color: TEAL, fontWeight: 700, fontFamily: F, marginBottom: 8 }}>{t("clientSearch.filter.upTo").replace("{n}", `${budget.toLocaleString()}만원`)}</div>
            <input
              type="range" min={100} max={10000} step={100}
              value={budget}
              onChange={e => setBudget(Number(e.target.value))}
              style={{ width: "100%", accentColor: PRIMARY, cursor: "pointer" }}
            />
          </FilterSection>

          <FilterSection label={t("clientSearch.filter.grade")}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {GRADE_LIST.map((gl) => (
                <button
                  key={gl.key}
                  onClick={() => toggleGrade(gl.key)}
                  style={{ padding: "8px 0", borderRadius: 8, border: `1.5px solid ${grades.includes(gl.key) ? PRIMARY : "#E2E8F0"}`, background: grades.includes(gl.key) ? "#EFF6FF" : "white", color: grades.includes(gl.key) ? PRIMARY : "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: F, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                >
                  {gl.icon} {t(gl.labelKey)}
                </button>
              ))}
            </div>
          </FilterSection>

          <FilterSection label={t("clientSearch.filter.partnerLevel")}>
            <select
              value={level}
              onChange={e => setLevel(e.target.value)}
              style={{ width: "100%", height: 38, borderRadius: 8, border: "1.5px solid #E2E8F0", padding: "0 12px", fontSize: 14, fontFamily: F, outline: "none", cursor: "pointer", backgroundColor: "white", color: "#334155" }}
            >
              {LEVEL_OPTIONS.map(l => <option key={l} value={l}>{t(`clientSearch.filter.level.${l}`)}</option>)}
            </select>
          </FilterSection>

          {/* 선호 기술 스택 */}
          <FilterSection label={t("clientSearch.filter.techStack")}>
            <input
              value={techInput}
              onChange={e => setTechInput(e.target.value)}
              onKeyDown={addTech}
              placeholder={t("clientSearch.filter.techPlaceholder")}
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

          {/* 원격 선호만 보기 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <span style={{ fontSize: 14, color: "#334155", fontFamily: F }}>{t("clientSearch.filter.remoteOnly")}</span>
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
            {t("clientSearch.filter.reset")}
          </button>
        </aside>

        {/* ── 오른쪽 클라이언트 리스트 ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 헤더 행 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 21.3, fontWeight: 900, fontFamily: F, background: PRIMARY_GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{t("clientSearch.list.title")} </span>
              <span style={{ fontSize: 14, color: "#94A3B8", fontFamily: F }}>{t("clientSearch.list.total").replace("{count}", sorted.length.toLocaleString())}</span>
              {aiLoading && (
                <span style={{ marginLeft: 12, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#3B82F6", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 999, padding: "4px 12px", fontFamily: F }}>
                  <Loader2 size={12} className="animate-spin" /> {t("clientSearch.list.searching")}
                </span>
              )}
              {!aiLoading && Object.keys(aiScores).length > 0 && (
                <span style={{ marginLeft: 12, fontSize: 12, fontWeight: 700, color: "#0F766E", background: "#CCFBF1", border: "1px solid #5EEAD4", borderRadius: 999, padding: "4px 12px", fontFamily: F }}>{t("clientSearch.list.matched")}</span>
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
                  {itemsPerPage} {t("common.perPage")} ∨
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
                        {n} {t("common.perPage")}
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
                  {t("common.sort")}: {t(`clientSearch.list.sort${sort.charAt(0).toUpperCase() + sort.slice(1)}`)} ∨
                </button>
                {sortOpen && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: "white", border: "1.5px solid #E2E8F0", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50, minWidth: 140 }}>
                    {["ai", "latest", "filter"].map(s => (
                      <div
                        key={s}
                        onClick={() => { setSort(s); setSortOpen(false); }}
                        style={{ padding: "11px 16px", fontSize: 14, fontFamily: F, color: sort === s ? PRIMARY : "#334155", fontWeight: sort === s ? 700 : 500, cursor: "pointer", background: sort === s ? "#EFF6FF" : "transparent" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                        onMouseLeave={e => e.currentTarget.style.background = sort === s ? "#EFF6FF" : "transparent"}
                      >
                        {t(`clientSearch.list.sort${s.charAt(0).toUpperCase() + s.slice(1)}`)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 클라이언트 카드 목록 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8", fontSize: 16, fontFamily: F }}>
                {t("clientSearch.errors.loading")}
              </div>
            ) : loadError ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#EF4444", fontSize: 15, fontFamily: F }}>
                {loadError}
              </div>
            ) : pageItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8", fontSize: 16, fontFamily: F }}>
                {t("clientSearch.errors.noResult")}
              </div>
            ) : pageItems.map(c => {
              const ai = aiScores[c.id];
              const merged = ai
                ? { ...c, match: ai.matchScore, aiReasons: ai.reasons || [] }
                : c;
              return <ClientCard key={c.id} data={merged} />;
            })}
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (() => {
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

/* ── 클라이언트 카드 ──────────────────────────────────────── */
function ClientCard({ data }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [hovered, setHovered] = useState(false);
  const g = GRADE_BADGE[data.grade] || GRADE_BADGE.silver;
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
              {data.match}% {t("clientSearch.list.sortAi")}
            </span>
          )}
        </div>

        {/* 부제목 - 한줄 자기소개 */}
        <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6, margin: "0 0 24px", fontFamily: F }}>
          {data.shortBio || data.strengthDesc || data.sloganSub}
        </p>

        {/* AI 매칭 이유 (AI 검색 실제 수행될 때만) */}
        {Array.isArray(data.aiReasons) && (() => {
          const reasons = data.aiReasons.length > 0
            ? data.aiReasons
            : [
                `AI 매칭 점수 ${data.match}%`,
                ...(Array.isArray(data.preferredSkills) && data.preferredSkills.length > 0 ? [`선호 기술: ${data.preferredSkills.slice(0, 2).join(", ")}`] : []),
                ...(data.industry ? [`${data.industry} 산업 적합`] : []),
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

        {/* 선호 기술 태그 */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {(data.preferredSkills || []).slice(0, 6).map(skill => (
            <span key={skill} style={{ fontSize: 12, fontWeight: 600, color: "#475569", background: "#F1F5F9", borderRadius: 6, padding: "4px 10px", fontFamily: F }}>{skill}</span>
          ))}
        </div>

        {/* 클라이언트 유형 · 분야 · 근무 선호 — 빈 값(미입력)은 chip으로 렌더하지 않음 */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[data.clientType, data.industry, data.workPrefLabel]
            .filter(c => c != null && String(c).trim() !== "")
            .map((chip, i) => (
              <span key={i} style={{
                fontSize: 11, fontWeight: 600, color: "#6366F1",
                background: "#EEF2FF", borderRadius: 999, padding: "3px 10px", fontFamily: F,
              }}>{chip}</span>
            ))}
        </div>

      </div>

      {/* 오른쪽 영역 */}
      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 180 }}>
        {/* 아바타 */}
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: "white",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "2px solid #E2E8F0", flexShrink: 0,
          overflow: "hidden",
        }}>
          <img src={data.profileImageUrl || data.heroImage || data.heroImg || heroCheck} alt="avatar" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.currentTarget.src = heroCheck; }} />
        </div>
        {/* 이름 */}
        <span style={{ fontSize: 13, fontWeight: 700, color: "#475569", fontFamily: F, textAlign: "center" }}>@{data.username || data.name || "신규"}</span>
        {/* 상세보기 */}
          <button
          onClick={() => navigate("/client_profile_view", { state: { partner: data } })}
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

/* ── 필터 섹션 래퍼 ─────────────────────────────────────── */
function FilterSection({ label, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: "#334155", margin: "0 0 12px", fontFamily: F }}>{label}</p>
      {children}
    </div>
  );
}

/* ── 페이지네이션 버튼 ─────────────────────────────────── */
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
