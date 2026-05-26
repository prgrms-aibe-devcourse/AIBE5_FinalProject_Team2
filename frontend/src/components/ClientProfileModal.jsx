import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import heroCheck from "../assets/hero_check.png";
import heroStudent from "../assets/hero_student.png";
import heroMoney from "../assets/hero_money.png";
import heroDefault from "../assets/hero_default.png";
import { profileApi } from "../api/profile.api";
import { portfolioApi } from "../api/portfolio.api";
import { reviewsApi } from "../api/reviews.api";

const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const PRIMARY_GRAD = "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)";

/* ClientProfileView 와 동일한 섹션 제목 컴포넌트 (아이콘 + 그라데이션 텍스트) */
function SectionTitle({ icon, title }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10, background: "#EFF6FF",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: icon === "</>" ? 11 : 16, fontWeight: 800, color: "#3B82F6",
        flexShrink: 0, fontFamily: F,
      }}>{icon}</div>
      <h2 style={{
        fontSize: 18, fontWeight: 900,
        background: PRIMARY_GRAD,
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
        margin: 0, fontFamily: F,
      }}>{title}</h2>
    </div>
  );
}

const GRADE_BADGE = {
  diamond: { label: "💎 다이아몬드", color: "#1E3A8A", bg: "#DBEAFE", border: "#93C5FD" },
  platinum: { label: "🌙 플래티넘",  color: "#4C1D95", bg: "#EDE9FE", border: "#C4B5FD" },
  gold:     { label: "🥇 골드",      color: "#78350F", bg: "#FEF3C7", border: "#FCD34D" },
  silver:   { label: "🥈 실버",      color: "#374151", bg: "#F1F5F9", border: "#CBD5E1" },
};

const SKILL_COLOR_MAP = {
  "React": "#61DAFB", "Vue": "#4FC08D", "Angular": "#DD0031",
  "TypeScript": "#3178C6", "JavaScript": "#F39C12", "Node.js": "#339933",
  "Python": "#3776AB", "Java": "#007396", "Spring": "#6DB33F",
  "MySQL": "#4479A1", "MongoDB": "#47A248", "AWS": "#FF9900",
  "Docker": "#2496ED", "Kubernetes": "#326CE5", "Figma": "#F24E1E",
  "Flutter": "#02569B", "Swift": "#FA7343", "Kotlin": "#7F52FF",
  "Go": "#00ADD8", "PHP": "#777BB4", "C#": "#239120", "C++": "#00599C",
  "AI/ML": "#A855F7", "GraphQL": "#E535AB", "TensorFlow": "#FF6F00",
};

// 빈 fallback — 라이브 데이터가 없으면 섹션이 비어있게 두고, 가짜 정보 노출 금지.
const EMPTY_FALLBACK = [];

const PORTFOLIO_IMGS = [heroCheck, heroStudent, heroMoney];
const PORTFOLIO_BG = [
  "linear-gradient(135deg,#F97316,#EF4444)",
  "linear-gradient(135deg,#3B82F6,#6366F1)",
  "linear-gradient(135deg,#10B981,#0EA5E9)",
];

const TABS = [
  { key: "intro",     label: "소개",       icon: "👤" },
  { key: "reviews",   label: "평가",       icon: "⭐" },
  { key: "skills",    label: "기술",       icon: "</>", isCode: true },
  { key: "career",    label: "경력",       icon: "💼" },
  { key: "education", label: "학력",       icon: "🎓" },
  { key: "portfolio", label: "포트폴리오", icon: "📋" },
];

/**
 * 파트너 → 클라이언트 프로필을 풀 디자인으로 띄우는 모달.
 * PartnerProfileModal 카피 + 클라이언트 컨텍스트 매핑.
 *
 * 호환성: client 또는 partner prop 둘 다 받음 (사용처에 따라).
 */
export default function ClientProfileModal({ client, partner, onClose, onPropose, onReject }) {
  // 정규화: client 가 있으면 그것을 사용, 없으면 partner 사용
  const data = client || partner || {};
  partner = data;

  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("intro");
  const scrollRef = useRef(null);

  // 실제 백엔드 데이터로 prop 보강 (mock fallback 우선순위 낮춤)
  //  - profileApi.getDetailByUsername(username) → bio/skills/careers/educations/...
  //  - portfolioApi.byUsername(username) → 공개 포트폴리오 항목들
  //  - reviewsApi.byPartner(partnerProfileId) → 리뷰 (partnerProfileId 있을 때만)
  const [fetched, setFetched] = useState(null);
  const [fetchedPortfolio, setFetchedPortfolio] = useState(null);
  const [fetchedReviews, setFetchedReviews] = useState(null);
  useEffect(() => {
    const username = partner?.partnerUsername || partner?.username || partner?.name;
    const partnerProfileId = partner?.partnerProfileId;
    if (!username) return;
    let cancelled = false;
    (async () => {
      try {
        const detailP = profileApi.getDetailByUsername(username).catch(() => null);
        const portfolioP = portfolioApi.byUsername(username).catch(() => []);
        const reviewsP = partnerProfileId
          ? reviewsApi.byPartner(partnerProfileId).catch(() => [])
          : Promise.resolve([]);
        const [detail, portfolio, reviews] = await Promise.all([detailP, portfolioP, reviewsP]);
        if (cancelled) return;
        setFetched(detail);
        setFetchedPortfolio(Array.isArray(portfolio) ? portfolio : []);
        setFetchedReviews(Array.isArray(reviews) ? reviews : []);
      } catch {
        if (!cancelled) { setFetched(null); setFetchedPortfolio([]); setFetchedReviews([]); }
      }
    })();
    return () => { cancelled = true; };
  }, [partner?.partnerUsername, partner?.username, partner?.name, partner?.partnerProfileId]);

  // partner prop + 실제 fetch 데이터 병합 (실제 데이터가 우선)
  // portfolioItems / reviews는 별도 fetch 결과로 override
  const merged = {
    ...partner,
    ...(fetched || {}),
    ...(fetchedPortfolio && fetchedPortfolio.length > 0 ? { portfolioItems: fetchedPortfolio } : {}),
    ...(fetchedReviews && fetchedReviews.length > 0 ? { reviews: fetchedReviews } : {}),
  };
  const sectionRefs = {
    intro:     useRef(null),
    skills:    useRef(null),
    career:    useRef(null),
    education: useRef(null),
    portfolio: useRef(null),
    reviews:   useRef(null),
  };

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const keys = ["intro", "reviews", "skills", "career", "education", "portfolio"];
      let current = keys[0];
      for (const key of keys) {
        const el = sectionRefs[key].current;
        if (!el) continue;
        if (el.offsetTop - container.offsetTop - 80 <= scrollTop) {
          current = key;
        }
      }
      setActiveTab(current);
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const grade = merged.grade ? GRADE_BADGE[merged.grade] : null;
  // 실제 데이터(merged.careers 등)가 있으면 그걸 사용, 없으면 mock fallback
  const careers = merged.careers || EMPTY_FALLBACK;
  const educations = merged.educations || EMPTY_FALLBACK;
  const portfolioItems = merged.portfolioItems || EMPTY_FALLBACK;
  const reviews = merged.reviews || EMPTY_FALLBACK;
  const rating = merged.rating ?? 4.9;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 10000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "white", borderRadius: 24,
          width: "min(820px, 94vw)", height: "88vh",
          display: "flex", flexDirection: "column",
          boxShadow: "0 32px 100px rgba(15,23,42,0.28)",
          overflow: "hidden",
        }}
      >
        {/* ── 헤더 (PartnerBannerCard 스타일 — 하늘색 그라데이션 + 동그라미 hero) ─── */}
        <div style={{
          padding: "20px 28px 16px",
          borderBottom: "1px solid #C7D2FE",
          background: "linear-gradient(135deg, #EEF2FF 0%, #E0F2FE 50%, #F5F3FF 100%)",
          flexShrink: 0,
          display: "flex", alignItems: "flex-start", gap: 18,
        }}>
          {/* hero — 동그라미 + 흰 테두리 */}
          <div style={{
            width: 96, height: 96, borderRadius: "50%", flexShrink: 0,
            background: "white",
            border: "3px solid white",
            boxShadow: "0 4px 16px rgba(59,130,246,0.20)",
            overflow: "hidden",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <img
              src={(() => {
                const raw = merged.profileImageUrl;
                if (!raw || /cdn\.devbridge\.com/i.test(raw)) return heroDefault;
                return raw;
              })()}
              alt="hero"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={e => { e.currentTarget.src = heroDefault; }}
            />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* 1행: @username + 등급/인증 배지들 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: "#1E293B", fontFamily: F }}>
                @{merged.partnerUsername || merged.username || partner.name}
              </span>
              {/* clientType 배지 (개인/법인사업자/개인사업자/팀) */}
              {merged.clientType && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: "#7C3AED", background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 99, padding: "2px 8px", fontFamily: F }}>
                  🏷️ {(() => {
                    const ct = merged.clientType;
                    const map = { CORPORATION: "법인사업자", SOLE_PROPRIETOR: "개인사업자", INDIVIDUAL: "개인", TEAM: "팀" };
                    return map[ct] || ct;
                  })()}
                </span>
              )}
              {/* 학력/경력 인증 (educations / careers 배열에 데이터가 있으면 인증으로 간주) */}
              {(merged.educations || []).length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 600, color: "#3B82F6", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 99, padding: "2px 8px", fontFamily: F }}>🎖️ 학력 인증</span>
              )}
              {(merged.careers || []).length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 600, color: "#16A34A", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 99, padding: "2px 8px", fontFamily: F }}>🎖️ 경력 인증</span>
              )}
              {grade && (
                <span style={{
                  fontSize: 11, fontWeight: 700, color: grade.color,
                  background: grade.bg, border: `1px solid ${grade.border}`,
                  borderRadius: 8, padding: "2px 8px", fontFamily: F,
                }}>{grade.label}</span>
              )}
            </div>
            {/* 2행: 슬로건 (이모지 포함) */}
            {(merged.slogan || partner.slogan) && (
              <div style={{ fontSize: 13, color: "#475569", fontFamily: F, marginBottom: 4, lineHeight: 1.5 }}>
                {merged.slogan || partner.slogan}
              </div>
            )}
            {/* 3행: shortBio (잘림 없이 풀 표시) */}
            {(merged.shortBio || merged.bio) && (
              <div style={{ fontSize: 13, color: "#475569", fontFamily: F, marginBottom: 8, lineHeight: 1.6 }}>
                {merged.shortBio || (merged.bio && merged.bio.length > 200 ? merged.bio.slice(0, 200) + "…" : merged.bio)}
              </div>
            )}
            {/* 4행: 칩들 (업종/지역/근무선호) — 클라이언트는 industry 위주 */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {merged.industry && (
                <span style={{ fontSize: 11, fontWeight: 600, color: "#3730A3", background: "rgba(255,255,255,0.82)", border: "1px solid #C7D2FE", borderRadius: 99, padding: "3px 10px", fontFamily: F }}>{merged.industry}</span>
              )}
              {merged.region && (
                <span style={{ fontSize: 11, fontWeight: 600, color: "#3730A3", background: "rgba(255,255,255,0.82)", border: "1px solid #C7D2FE", borderRadius: 99, padding: "3px 10px", fontFamily: F }}>{merged.region}</span>
              )}
              {merged.workPreference && (
                <span style={{ fontSize: 11, fontWeight: 600, color: "#3730A3", background: "rgba(255,255,255,0.82)", border: "1px solid #C7D2FE", borderRadius: 99, padding: "3px 10px", fontFamily: F }}>{merged.workPreference}</span>
              )}
            </div>
            {/* 5행: 별점 (큰 ⭐ 이모지) + 완료 N건 */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>
                {Array.from({ length: 5 }, (_, i) => i < Math.round(rating) ? "⭐" : "☆").join("")}
              </span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#1E293B", fontFamily: F }}>{rating.toFixed(1)}</span>
              <span style={{ fontSize: 12, color: "#64748B", fontFamily: F }}>/5.0</span>
              {(merged.completedProjects ?? partner.contractCount) != null && (
                <span style={{ fontSize: 12, color: "#475569", fontFamily: F, marginLeft: 6, fontWeight: 600 }}>· 완료 {merged.completedProjects ?? partner.contractCount}건</span>
              )}
            </div>
          </div>

          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 24, color: "#94A3B8", lineHeight: 1,
            padding: "2px 6px", flexShrink: 0,
          }}>✕</button>
        </div>

        {/* ── 탭 바 ─────────────────────────────────── */}
        <div style={{
          display: "flex", gap: 4, padding: "12px 28px",
          borderBottom: "1px solid #F1F5F9", background: "white",
          flexShrink: 0, overflowX: "auto",
        }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  const el = sectionRefs[tab.key].current;
                  if (el && scrollRef.current) {
                    scrollRef.current.scrollTo({ top: el.offsetTop - scrollRef.current.offsetTop, behavior: "smooth" });
                  }
                }}
                style={{
                  padding: "7px 16px", borderRadius: 99, border: "none",
                  background: isActive ? "#3B82F6" : "#F1F5F9",
                  color: isActive ? "white" : "#475569",
                  fontSize: 13, fontWeight: isActive ? 700 : 500,
                  cursor: "pointer", fontFamily: F, whiteSpace: "nowrap",
                  transition: "all 0.15s", flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#E2E8F0"; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "#F1F5F9"; }}
              >
                <span style={tab.isCode ? { fontSize: 10, fontWeight: 900 } : { fontSize: 13 }}>{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── 스크롤 콘텐츠 ─────────────────────────── */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>

          {/* 소개 섹션 */}
          <div ref={sectionRefs.intro} style={{ marginBottom: 40 }}>
            <SectionTitle icon="👤" title="소개" />
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "#F8FAFC", borderRadius: 14, padding: "20px 24px", border: "1.5px solid #E2E8F0" }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#475569", fontFamily: F, margin: "0 0 10px" }}>자기소개</p>
                <p style={{ fontSize: 15, color: "#1E293B", fontFamily: F, lineHeight: 1.8, margin: 0, whiteSpace: "pre-wrap" }}>
                  {merged.bio || merged.shortBio || partner.desc || "안녕하세요. 클라이언트의 목표를 실현하는 파트너입니다."}
                </p>
              </div>
              {(merged.strengthDesc || merged.sloganSub || partner.sloganSub) && (
                <div style={{ background: "#F8FAFC", borderRadius: 14, padding: "20px 24px", border: "1.5px solid #E2E8F0" }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#475569", fontFamily: F, margin: "0 0 10px" }}>주요 업무 분야 및 강점</p>
                  <p style={{ fontSize: 15, color: "#1E293B", fontFamily: F, lineHeight: 1.8, margin: 0 }}>
                    {merged.strengthDesc || merged.sloganSub || partner.sloganSub}
                  </p>
                </div>
              )}
              {/* 주요 기술 태그 — merged.skills 또는 partner.tags */}
              {(() => {
                const tagList = (merged.skills && merged.skills.length > 0)
                  ? merged.skills.map(s => typeof s === "string" ? s : (s.techName || s.customTech)).filter(Boolean)
                  : (partner.tags || []);
                if (tagList.length === 0) return null;
                return (
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#64748B", fontFamily: F, margin: "0 0 10px" }}>주요 기술 태그</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {tagList.map(tag => {
                        const color = SKILL_COLOR_MAP[tag] || "#6366F1";
                        return (
                          <span key={tag} style={{
                            padding: "6px 14px", borderRadius: 99,
                            background: color + "18", border: `1.5px solid ${color}40`,
                            color, fontSize: 13, fontWeight: 700, fontFamily: F,
                          }}>{tag}</span>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* 기술 섹션 */}
          <div ref={sectionRefs.skills} style={{ marginBottom: 40 }}>
            <SectionTitle icon="</>" title="기술" />
            <div>
              {(merged.skills && merged.skills.length > 0 ? merged.skills : (partner.tags || [])).map((item, i) => {
                const techName = typeof item === "string" ? item : (item.techName || item.customTech || "기타");
                const proficiency = typeof item === "object" ? item.proficiency : ["전문가", "고급", "중급", "초급"][Math.min(i, 3)];
                const experience  = typeof item === "object" ? item.experience  : `${Math.max(1, (partner.experience || 3) - i)}년`;
                const color = SKILL_COLOR_MAP[techName] || "#6366F1";
                const initials = techName.length <= 3 ? techName.toUpperCase() : techName.substring(0, 2).toUpperCase();
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 16,
                    padding: "14px 20px", borderRadius: 12,
                    border: "1.5px solid #E2E8F0", background: "white",
                    marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: color + "18", border: `1.5px solid ${color}44`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 800, color, flexShrink: 0, fontFamily: F,
                    }}>{initials}</div>
                    <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: "#1E293B", fontFamily: F }}>
                      {techName}
                      {proficiency && <><span style={{ color: "#CBD5E1", margin: "0 8px" }}>|</span><span style={{ color: "#475569", fontWeight: 500 }}>{proficiency}</span></>}
                      {experience  && <><span style={{ color: "#CBD5E1", margin: "0 8px" }}>|</span><span style={{ color: "#475569", fontWeight: 500 }}>{experience}</span></>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 경력 섹션 */}
          <div ref={sectionRefs.career} style={{ marginBottom: 40 }}>
            <SectionTitle icon="💼" title="경력" />
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {careers.map((c, i) => (
                <CareerCard key={i} career={c} />
              ))}
            </div>
          </div>

          {/* 학력 섹션 */}
          <div ref={sectionRefs.education} style={{ marginBottom: 40 }}>
            <SectionTitle icon="🎓" title="학력" />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {educations.map((e, i) => {
                const schoolName = e.schoolName || e.school || "";
                const major      = e.major || e.track || "";
                const nameStr    = schoolName + (major ? ` | ${major}` : "");
                const degreeType = e.degree || e.degreeType || "";
                const status     = e.isEnrolled ? "재학중" : (e.status || "졸업");
                const schoolType = e.schoolType || "";
                const meta = [schoolType, degreeType, status].filter(Boolean).join(" · ");
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", padding: "14px 18px",
                    background: "white", borderRadius: 14,
                    border: "1.5px solid #F1F5F9", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, background: "#EFF6FF",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      marginRight: 14, flexShrink: 0,
                    }}>
                      <GraduationCap size={20} color="#3B82F6" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#1E293B", fontFamily: F }}>{nameStr}</div>
                      <div style={{ fontSize: 13, color: "#94A3B8", fontFamily: F, marginTop: 2 }}>{meta}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 포트폴리오 섹션 */}
          <div ref={sectionRefs.portfolio} style={{ marginBottom: 40 }}>
            <SectionTitle icon="📋" title="포트폴리오" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              {portfolioItems.map((p, i) => {
                // 백엔드 PortfolioItemResponse 형식: sourceKey, title, role|period, techTags[], thumbnailUrl, isRepresentative
                const sourceKey = p.sourceKey || p.id;
                const tags = Array.isArray(p.techTags) ? p.techTags : (p.tech || p.tags || []);
                const thumbnailUrl = p.thumbnailUrl || null;
                const isRep = !!(p.isRepresentative ?? p.rep);
                const handleClick = () => {
                  if (!sourceKey || String(sourceKey).startsWith("mock-")) return;
                  const items = (merged.portfolioItems || []).filter(it => it && (it.sourceKey || it.id));
                  const sourceKeys = items.map(it => it.sourceKey || it.id);
                  onClose && onClose();
                  navigate("/portfolio_project_preview", {
                    state: {
                      sourceKey,
                      sourceKeys,
                      portfolioItems: items,
                      username: merged.partnerUsername || merged.username || partner.name,
                    },
                  });
                };
                return (
                  <div
                    key={i}
                    onClick={handleClick}
                    style={{
                      borderRadius: 16, overflow: "hidden",
                      border: "1.5px solid #E2E8F0",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                      cursor: sourceKey ? "pointer" : "default",
                      transition: "transform 0.15s, box-shadow 0.15s",
                    }}
                    onMouseEnter={e => { if (sourceKey) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 22px rgba(59,130,246,0.18)"; } }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)"; }}
                  >
                    <div style={{
                      height: 130, position: "relative",
                      background: thumbnailUrl ? "#F1F5F9" : PORTFOLIO_BG[i % PORTFOLIO_BG.length],
                      display: "flex", alignItems: "center", justifyContent: "center",
                      overflow: "hidden",
                    }}>
                      {thumbnailUrl ? (
                        <img src={thumbnailUrl} alt={p.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <img src={PORTFOLIO_IMGS[i % PORTFOLIO_IMGS.length]} alt="" style={{ height: 88, objectFit: "contain", opacity: 0.9 }} />
                      )}
                      {isRep && (
                        <span style={{ position: "absolute", top: 8, left: 8, fontSize: 11, fontWeight: 800, color: "#1D4ED8", background: "white", borderRadius: 6, padding: "2px 8px", fontFamily: F }}>대표</span>
                      )}
                    </div>
                    <div style={{ padding: "12px 14px", background: "white" }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#1E293B", fontFamily: F, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                      {(p.role || p.period || p.category) && (
                        <div style={{ fontSize: 11, color: "#94A3B8", fontFamily: F, marginBottom: 6 }}>{p.role || p.period || p.category}</div>
                      )}
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                        {tags.slice(0, 6).map(t => (
                          <span key={t} style={{ fontSize: 11, fontWeight: 600, color: "#3B82F6", background: "#EFF6FF", borderRadius: 5, padding: "2px 8px", fontFamily: F }}>
                            {String(t).startsWith("#") ? t : `#${t}`}
                          </span>
                        ))}
                      </div>
                      {p.desc && <p style={{ fontSize: 12, color: "#64748B", margin: 0, fontFamily: F, lineHeight: 1.5 }}>{p.desc}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 평가 섹션 */}
          <div ref={sectionRefs.reviews} style={{ marginBottom: 16 }}>
            <SectionTitle icon="⭐" title="클라이언트 평가" />
            <div style={{ fontSize: 12, color: "#64748B", fontFamily: F, marginBottom: 14, marginTop: -8 }}>
              클라이언트가 직접 남긴 프로젝트 평가와 생생한 후기입니다.
            </div>
            <div>
              {/* 통계 3개 카드 — CONTRACT COUNT / COMPLETION RATE / RE-EMPLOYMENT */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                {[
                  { icon: "✅", iconBg: "#EFF6FF", label: "CONTRACT COUNT",  value: String(merged.completedProjects ?? partner.contractCount ?? reviews.length), unit: "건" },
                  { icon: "✔",  iconBg: "#F0FDF4", label: "COMPLETION RATE", value: String(merged.completionRate ?? 98), unit: "%" },
                  { icon: "🔄", iconBg: "#FFF7ED", label: "RE-EMPLOYMENT",   value: String(merged.reemploymentRate ?? merged.repeatRate ?? 85), unit: "%" },
                ].map((s, i) => (
                  <div key={i} style={{
                    background: "white", border: "1.5px solid #E2E8F0", borderRadius: 14,
                    padding: "14px 16px", display: "flex", alignItems: "center", gap: 10,
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, background: s.iconBg,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                    }}>{s.icon}</div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: 0.4, fontFamily: F }}>{s.label}</span>
                      <span style={{ fontSize: 18, fontWeight: 900, color: "#1E293B", fontFamily: F }}>
                        {s.value}<span style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginLeft: 2 }}>{s.unit}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 요약 카드 */}
              <div style={{
                display: "flex", alignItems: "center", gap: 28,
                background: "#F8FAFC", borderRadius: 16, padding: "20px 24px",
                border: "1.5px solid #E2E8F0", marginBottom: 20,
              }}>
                <div style={{ textAlign: "center", minWidth: 70 }}>
                  <div style={{ fontSize: 44, fontWeight: 900, color: "#1E293B", fontFamily: F, lineHeight: 1 }}>{rating.toFixed(1)}</div>
                  <div style={{ fontSize: 13, color: "#F59E0B", marginTop: 4 }}>{"★".repeat(Math.round(rating))}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", fontFamily: F, marginTop: 2 }}>{partner.contractCount ?? reviews.length}건 평가</div>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { label: "전문성",    value: partner.ratingBreakdown?.expertise     ?? 5.0 },
                    { label: "일정 준수", value: partner.ratingBreakdown?.schedule      ?? 4.8 },
                    { label: "소통 능력", value: partner.ratingBreakdown?.communication ?? 4.9 },
                    { label: "적극성",    value: partner.ratingBreakdown?.proactivity   ?? 4.9 },
                  ].map(rb => (
                    <div key={rb.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: "#64748B", fontFamily: F }}>{rb.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#3B82F6", fontFamily: F }}>{rb.value.toFixed(1)}</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 99, background: "#E2E8F0" }}>
                        <div style={{ height: "100%", borderRadius: 99, background: "linear-gradient(90deg, #93C5FD, #3B82F6)", width: `${(rb.value / 5) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 리뷰 카드 목록 */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {reviews.map((r, i) => (
                  <div key={i} style={{ background: "white", borderRadius: 14, padding: "18px 22px", border: "1.5px solid #E2E8F0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", fontFamily: F }}>
                        {r.reviewer || r.client || "클라이언트"}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 13, color: "#F59E0B", fontFamily: F }}>★ {(r.rating ?? 5).toFixed(1)}</span>
                        <span style={{ fontSize: 11, color: "#94A3B8", fontFamily: F }}>{r.date}</span>
                      </div>
                    </div>
                    <p style={{ fontSize: 13, color: "#475569", margin: 0, fontFamily: F, lineHeight: 1.6 }}>
                      {r.comment || r.review}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* ── 하단 푸터 ─────────────────────────────── */}
        <div style={{
          padding: "16px 28px", borderTop: "1px solid #F1F5F9",
          background: "white", flexShrink: 0, display: "flex", gap: 10,
        }}>
          {onReject ? (
            <button
              onClick={() => { onClose(); onReject(); }}
              style={{
                flex: 1, padding: "13px 0", borderRadius: 12,
                border: "1px solid #FECACA", background: "#FEF2F2",
                color: "#EF4444", fontSize: 14, fontWeight: 700,
                cursor: "pointer", fontFamily: F, transition: "background 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#FEE2E2"}
              onMouseLeave={e => e.currentTarget.style.background = "#FEF2F2"}
            >
              {partner?.applicationId ? "지원 거절하기" : "제안 거절하기"}
            </button>
          ) : (
            <button
              onClick={() => { onClose(); navigate("/partner_profile_view", { state: { partner } }); }}
              style={{
                flex: 1, padding: "13px 0", borderRadius: 12,
                border: "1.5px solid #BFDBFE", background: "#EFF6FF",
                color: "#1e3a5f", fontSize: 14, fontWeight: 700,
                cursor: "pointer", fontFamily: F, transition: "background 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#DBEAFE"}
              onMouseLeave={e => e.currentTarget.style.background = "#EFF6FF"}
            >
              프로필 전체 보기 →
            </button>
          )}
          <button style={{
            flex: 1, padding: "13px 0", borderRadius: 12, border: "none",
            background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)",
            color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: F,
          }} onClick={() => { onClose(); onPropose?.(partner); }}>
            {partner?.applicationId ? "지원 수락하기" : "협업 제안하기"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 경력 카드 (클릭 시 세부 내역 펼침/접기) ──────────────────────────── */
function CareerCard({ career }) {
  const [expanded, setExpanded] = useState(false);
  const companyName = career.companyName || career.company || "";
  const jobTitle    = career.jobTitle || career.role || "";
  const period = career.startDate
    ? `${career.startDate.replace(/-/g, ".")} ~ ${career.isCurrent ? "현재" : (career.endDate || "").replace(/-/g, ".")}`
    : (career.period || "");
  const empType = career.employmentType || career.type || "";
  const desc    = career.description || career.desc || "";
  const projects = career.projects || []; // 수행 프로젝트 (있다면)

  return (
    <div
      onClick={() => setExpanded(v => !v)}
      style={{
        background: "white", borderRadius: 14, padding: "20px 24px",
        border: `1.5px solid ${expanded ? "#BFDBFE" : "#E2E8F0"}`,
        boxShadow: expanded ? "0 4px 14px rgba(59,130,246,0.10)" : "0 1px 4px rgba(0,0,0,0.04)",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: desc ? 8 : 0 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#1E293B", fontFamily: F }}>{companyName}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#3B82F6", fontFamily: F, marginTop: 3 }}>{jobTitle}</div>
        </div>
        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <div style={{ fontSize: 12, color: "#94A3B8", fontFamily: F }}>{period}</div>
          {empType && <span style={{ fontSize: 11, fontWeight: 600, color: "#10B981", background: "#ECFDF5", borderRadius: 5, padding: "2px 8px", fontFamily: F }}>{empType}</span>}
          <span style={{ fontSize: 11, color: "#94A3B8", fontFamily: F, marginTop: 2 }}>{expanded ? "▴ 접기" : "▾ 자세히 보기"}</span>
        </div>
      </div>
      {desc && <p style={{ fontSize: 13, color: "#475569", fontFamily: F, margin: 0, lineHeight: 1.7 }}>{desc}</p>}

      {/* 펼침 영역 — 주요 업무 설명 + 수행 프로젝트 */}
      {expanded && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px dashed #CBD5E1" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ width: 3, height: 14, background: "#3B82F6", borderRadius: 2 }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: "#1E293B", fontFamily: F }}>주요 업무 설명</span>
          </div>
          <div style={{
            background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10,
            padding: "12px 14px", marginBottom: projects.length > 0 ? 14 : 0,
            fontSize: 13, color: "#475569", fontFamily: F, lineHeight: 1.7,
            whiteSpace: "pre-wrap",
          }}>
            {desc || <span style={{ color: "#94A3B8" }}>세부 업무 내용이 등록되지 않았어요.</span>}
          </div>

          {projects.length > 0 && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ width: 3, height: 14, background: "#3B82F6", borderRadius: 2 }} />
                <span style={{ fontSize: 13, fontWeight: 800, color: "#1E293B", fontFamily: F }}>수행 프로젝트</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#3730A3", background: "#EEF2FF", borderRadius: 99, padding: "2px 8px" }}>{projects.length}건</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {projects.map((proj, j) => (
                  <div key={j} style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", fontFamily: F }}>{proj.title || proj.name}</span>
                      {proj.period && <span style={{ fontSize: 11, color: "#94A3B8", fontFamily: F }}>{proj.period}</span>}
                    </div>
                    {proj.desc && <p style={{ fontSize: 12, color: "#475569", fontFamily: F, margin: 0, lineHeight: 1.6 }}>{proj.desc}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
