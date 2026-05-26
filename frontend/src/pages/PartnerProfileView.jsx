import { useRef, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, GraduationCap } from "lucide-react";
import AppHeader from "../components/AppHeader";
import PartnerBannerCard from "../components/PartnerBannerCard";
import { profileApi } from "../api/profile.api";
import { projectsApi, applicationsApi, portfolioApi, reviewsApi } from "../api";
import useStore from "../store/useStore";
import heroStudent from "../assets/hero_student.png";
import heroMoney from "../assets/hero_money.png";
import heroCheck from "../assets/hero_check.png";

const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const PRIMARY_GRAD = "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)";

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
};

/* 미니 평가 바 (리뷰 카드용) */
function MiniRatingBar({ label, value }) {
  const pct = (value / 5.0) * 100;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: F }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#3B82F6", fontFamily: F }}>{value.toFixed(1)}</span>
      </div>
      <div style={{ height: 4, borderRadius: 99, background: "#E2E8F0", overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 99, background: "#93C5FD", width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* 사이드바 탭 목록 — MENU_ITEMS 에서 initOn: true 항목만 */
const VIEW_TABS = [
  { key: "intro",     label: "파트너로서 자기소개",   icon: "👤" },
  { key: "home",      label: "클라이언트 평가",            icon: "⭐" },
  { key: "skills",    label: "보유 기술",             icon: "</>" },
  { key: "career",    label: "경력",                  icon: "💼" },
  { key: "education", label: "학력",                  icon: "🎓" },
  { key: "portfolio", label: "포트폴리오",            icon: "📋" },
//  { key: "reviews",   label: "클라이언트 평가",       icon: "⭐" },
  { key: "projects",  label: "진행하는 프로젝트",     icon: "🔄" },
];

/* 섹션 헤더 */
function SectionTitle({ icon, title }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: icon === "</>" ? 12 : 20, fontWeight: 800, color: "#3B82F6", flexShrink: 0, fontFamily: F }}>
        {icon}
      </div>
      <h2 style={{ fontSize: 23, fontWeight: 900, background: PRIMARY_GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", margin: 0, fontFamily: F }}>{title}</h2>
    </div>
  );
}

function StarIcon({ type, size }) {
  if (type === "full") {
    return <span style={{ fontSize: size, lineHeight: 1, display: "inline-block", flexShrink: 0 }}>⭐</span>;
  }
  if (type === "half") {
    return (
      <span style={{ position: "relative", display: "inline-block", width: size * 1.1, height: size, lineHeight: 1, flexShrink: 0, verticalAlign: "middle" }}>
        <span style={{ fontSize: size, lineHeight: 1, filter: "grayscale(1) opacity(0.22)", position: "absolute", top: 0, left: 0 }}>⭐</span>
        <span style={{ position: "absolute", top: 0, left: 0, width: "55%", overflow: "hidden", display: "block" }}>
          <span style={{ fontSize: size, lineHeight: 1, display: "block" }}>⭐</span>
        </span>
      </span>
    );
  }
  return <span style={{ fontSize: size, lineHeight: 1, display: "inline-block", flexShrink: 0, filter: "grayscale(1) opacity(0.22)" }}>⭐</span>;
}

/* 별점 */
function StarRating({ rating, size = 16 }) {
  return (
    <span style={{ display: "inline-flex", gap: 2, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map(i => {
        const diff = rating - (i - 1);
        const type = diff >= 0.85 ? "full" : diff >= 0.35 ? "half" : "empty";
        return <StarIcon key={i} type={type} size={size} />;
      })}
    </span>
  );
}

/* 평가 바 */
function RatingBar({ label, value }) {
  const pct = (value / 5.0) * 100;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 14, color: "#64748B", fontFamily: F }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#3B82F6", fontFamily: F }}>{value.toFixed(1)}</span>
      </div>
      <div style={{ height: 6, borderRadius: 99, background: "#E2E8F0", overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 99, background: "linear-gradient(90deg, #93C5FD, #3B82F6)", width: `${pct}%`, transition: "width 0.4s" }} />
      </div>
    </div>
  );
}

/* 도넛 차트 (파트너별 데이터 기반) */
function DonutChart({ segments }) {
  const r = 72, cx = 92, cy = 92, sw = 26;
  const C = 2 * Math.PI * r;
  const segmentMeta = segments.reduce((acc, seg) => {
    const prevCum = acc.length > 0 ? acc[acc.length - 1].cumLen : 0;
    const len = (seg.pct / 100) * C;
    acc.push({ ...seg, len, offset: C - prevCum, cumLen: prevCum + len });
    return acc;
  }, []);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, width: "100%" }}>
      <svg viewBox="0 0 184 184" style={{ width: "58%", height: "auto", flexShrink: 0 }}>
        <defs>
          {segmentMeta.map(seg => (
            <linearGradient key={seg.id} id={seg.id} gradientUnits="userSpaceOnUse" x1="184" y1="0" x2="0" y2="184">
              <stop offset="0%" stopColor={seg.c1} />
              <stop offset="100%" stopColor={seg.c2} />
            </linearGradient>
          ))}
        </defs>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F1F5F9" strokeWidth={sw + 2} />
        {segmentMeta.map((seg, i) => {
          return (
            <circle key={i}
              cx={cx} cy={cy} r={r} fill="none"
              stroke={`url(#${seg.id})`} strokeWidth={sw}
              strokeDasharray={`${seg.len} ${C}`}
              strokeDashoffset={seg.offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              opacity={0.88}
            />
          );
        })}
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize={11} fontWeight={800} fill="#475569" fontFamily={F}>PROJECTS</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize={9.5} fontWeight={500} fill="#94A3B8" fontFamily={F}>분야별</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 13, flex: 1 }}>
        {segmentMeta.map(seg => (
          <div key={seg.label} style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: `linear-gradient(135deg, ${seg.c1}, ${seg.c2})`, flexShrink: 0 }} />
            <span style={{ fontSize: 13.5, color: "#475569", fontFamily: F, fontWeight: 500 }}>{seg.label} {seg.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 프로필 홈 섹션 ─────────────────────────────────────── */
function HomeSection({ partner, reviews }) {
  const rating = partner.rating ?? 4.9;
  const contractCount = partner.contractCount ?? 87;
  const completionRate = partner.completionRate ?? 98;
  const reEmployment = partner.reEmployment ?? 85;
  const rb = partner.ratingBreakdown || {
    expertise: 5.0,
    schedule: 4.8,
    communication: 4.9,
    proactivity: 4.9,
  };
  const donutSegments = partner.projectDonut || [
    { label: "AI/ML", pct: 42, id: "pv_dc_aiml", c1: "#BFDBFE", c2: "#3B82F6" },
    { label: "Web", pct: 35, id: "pv_dc_web", c1: "#DBEAFE", c2: "#60A5FA" },
    { label: "Mobile", pct: 18, id: "pv_dc_mobile", c1: "#F1F5F9", c2: "#94A3B8" },
    { label: "Others", pct: 5, id: "pv_dc_others", c1: "#F8FAFC", c2: "#CBD5E1" },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <h2 style={{ fontSize: 27, fontWeight: 900, background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", margin: "0 0 6px", fontFamily: F }}>
            클라이언트 평가
          </h2>
          <p style={{ fontSize: 14, color: "#64748B", margin: 0, fontFamily: F, lineHeight: 1.7 }}>
            클라이언트가 직접 남긴 프로젝트 평가와 생생한 후기입니다.
          </p>
        </div>
        <span style={{
          fontSize: 13, fontWeight: 600, color: "#3B82F6", fontFamily: F,
          cursor: "pointer", display: "flex", alignItems: "center", gap: 3,
          marginTop: 4, whiteSpace: "nowrap",
        }}>전체 평가 보기 &gt;</span>
      </div>

      {/* 통계 3카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, margin: "22px 0 18px" }}>
        {[
          { icon: "✅", iconBg: "#EFF6FF", label: "CONTRACT COUNT",  value: String(contractCount), unit: "건" },
          { icon: "✔",  iconBg: "#F0FFF4", label: "COMPLETION RATE", value: String(completionRate), unit: "%" },
          { icon: "🔄", iconBg: "#FFF7ED", label: "RE-EMPLOYMENT",   value: String(reEmployment), unit: "%" },
        ].map(stat => (
          <div key={stat.label} style={{
            background: "white", borderRadius: 14,
            border: "1.5px solid #F1F5F9", padding: "16px 20px",
            display: "flex", alignItems: "center", gap: 14,
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          }}>
            <div style={{
              width: 46, height: 46, borderRadius: 12,
              background: stat.iconBg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 21, flexShrink: 0,
            }}>{stat.icon}</div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", fontFamily: F, marginBottom: 4 }}>
                {stat.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#1E293B", fontFamily: F, lineHeight: 1 }}>
                {stat.value}<span style={{ fontSize: 14, color: "#64748B", marginLeft: 2, fontWeight: 600 }}>{stat.unit}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 평점 카드 + 도넛 차트 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* 평점 */}
        <div style={{
          background: "white", borderRadius: 14,
          border: "1.5px solid #F1F5F9", padding: "24px 28px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 50, fontWeight: 900, color: "#1E293B", fontFamily: F, lineHeight: 1, flexShrink: 0 }}>
              {rating.toFixed(1)}<span style={{ fontSize: 20, fontWeight: 600, color: "#94A3B8" }}> / 5.0</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 5, paddingTop: 6 }}>
              <div style={{ fontSize: 12, color: "#94A3B8", fontFamily: F, fontWeight: 500 }}>평균 평점</div>
              <StarRating rating={rating} size={22} />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <RatingBar label="전문성"   value={rb.expertise}     />
            <RatingBar label="일정 준수" value={rb.schedule}     />
            <RatingBar label="소통 능력" value={rb.communication} />
            <RatingBar label="적극성"    value={rb.proactivity}   />
          </div>
        </div>

        {/* 도넛 차트 */}
        <div style={{
          background: "white", borderRadius: 14,
          border: "1.5px solid #F1F5F9", padding: "24px 28px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          display: "flex", flexDirection: "column", justifyContent: "center",
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1E293B", fontFamily: F, marginBottom: 20 }}>
            주요 수행 프로젝트 분야
          </div>
          <DonutChart segments={donutSegments} />
        </div>
      </div>

      {/* 후기 카드 */}
      <div style={{ marginTop: 24 }}>
        {(reviews || []).slice(0, 3).map((r) => <ReviewItem key={r._id ?? r.id} review={r} />)}
      </div>
    </div>
  );
}

/* ── 자기소개 섹션 ─────────────────────────────────────── */
function IntroSection({ partner }) {
  return (
    <div>
      <SectionTitle icon="👤" title="파트너로서 자기소개" />
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ background: "#F8FAFC", borderRadius: 14, padding: "20px 24px", border: "1.5px solid #E2E8F0" }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#475569", fontFamily: F, margin: "0 0 10px" }}>자기소개</p>
          <p style={{ fontSize: 15, color: "#1E293B", fontFamily: F, lineHeight: 1.8, margin: 0 }}>
            {partner.desc || `안녕하세요, ${partner.name || "파트너"}입니다. ${partner.slogan || ""}`}
          </p>
        </div>
        <div style={{ background: "#F8FAFC", borderRadius: 14, padding: "20px 24px", border: "1.5px solid #E2E8F0" }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#475569", fontFamily: F, margin: "0 0 10px" }}>주요 업무 분야 및 강점</p>
          <p style={{ fontSize: 15, color: "#1E293B", fontFamily: F, lineHeight: 1.8, margin: 0 }}>
            {partner.sloganSub || "다양한 프로젝트 경험을 바탕으로 클라이언트의 목표를 실현합니다."}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── 보유 기술 섹션 ─────────────────────────────────────── */
function SkillsSection({ partner }) {
  const storedSkills = partner.skills || [];
  const fallbackTags = partner.tags || [];

  const renderSkillRow = (techName, proficiency, experience, idx) => {
    const color = SKILL_COLOR_MAP[techName] || "#6366F1";
    const initials = techName.length <= 3
      ? techName.toUpperCase()
      : techName.substring(0, 2).toUpperCase();
    return (
      <div key={idx} style={{
        display: "flex", alignItems: "center", gap: 16,
        padding: "14px 20px", borderRadius: 12,
        border: "1.5px solid #E2E8F0", background: "white",
        marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: color + "18", border: `1.5px solid ${color}44`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 800, color: color,
          flexShrink: 0, fontFamily: F, letterSpacing: "-0.02em",
        }}>
          {initials}
        </div>
        <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: "#1E293B", fontFamily: F }}>
          {techName}
          {proficiency && (
            <>
              <span style={{ color: "#CBD5E1", fontWeight: 400, margin: "0 8px" }}>|</span>
              <span style={{ color: "#475569", fontWeight: 500 }}>{proficiency}</span>
            </>
          )}
          {experience && (
            <>
              <span style={{ color: "#CBD5E1", fontWeight: 400, margin: "0 8px" }}>|</span>
              <span style={{ color: "#475569", fontWeight: 500 }}>{experience}</span>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <SectionTitle icon="</>" title="보유 기술" />
      <div>
        {storedSkills.length > 0
          ? storedSkills.map((skill, i) => {
              const techName = skill.techName || skill.customTech || "기타";
              return renderSkillRow(techName, skill.proficiency, skill.experience, i);
            })
          : fallbackTags.map((tag, i) => {
              const LEVELS = ["전문가", "고급", "중급", "초급"];
              const years = partner.experience ? Math.max(1, partner.experience - i * 2) : 1;
              return renderSkillRow(tag, LEVELS[Math.min(i, 3)], `${years}년`, i);
            })
        }
      </div>
    </div>
  );
}

/* ── 경력 섹션 ─────────────────────────────────────────── */
const MOCK_CAREERS_FALLBACK = [
  { companyName: "테크브릿지 (주)", jobTitle: "프론트엔드 개발팀장", startDate: "2021-03", isCurrent: true, employmentType: "정규직", description: "React 기반 SaaS 플랫폼 개발 및 팀 리딩, 성능 최적화 20% 달성" },
  { companyName: "스타트업 코리아",  jobTitle: "풀스택 개발자", startDate: "2018-07", endDate: "2021-02", isCurrent: false, employmentType: "정규직", description: "Node.js + React 스택으로 B2B 서비스 0→1 프로덕트 개발" },
];

function VerifiedBadge({ label = "인증" }) {
  return (
    <span title={`${label} 완료`} style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontSize: 10, fontWeight: 700, color: "#0EA5E9",
      background: "#E0F2FE", border: "1px solid #BAE6FD",
      borderRadius: 999, padding: "2px 8px", fontFamily: F, marginLeft: 8,
      verticalAlign: "middle", lineHeight: 1.2,
    }}>
      <span style={{ fontSize: 11 }}>✓</span>{label}
    </span>
  );
}

function CareerSection({ partner }) {
  const careers = (partner.careers || []).length > 0 ? partner.careers : MOCK_CAREERS_FALLBACK;
  const [selected, setSelected] = useState(null);
  return (
    <div>
      <SectionTitle icon="💼" title="경력" />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {careers.map((c, i) => {
          const companyName = c.companyName || c.company || "";
          const jobTitle = c.jobTitle || c.role || "";
          const period = c.startDate
            ? `${c.startDate.replace(/-/g, ".")} ~ ${c.isCurrent ? "현재" : (c.endDate || "").replace(/-/g, ".")}`
            : (c.period || "");
          const empType = c.employmentType || c.type || "";
          const desc = c.description || c.desc || "";
          const verified = !!(c.verifiedCompany || c.verifiedEmail);
          return (
            <div
              key={i}
              onClick={() => setSelected({ ...c, _companyName: companyName, _jobTitle: jobTitle, _period: period, _empType: empType, _desc: desc, _verified: verified })}
              style={{
                background: "white", borderRadius: 14, padding: "20px 24px",
                border: "1.5px solid #E2E8F0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                cursor: "pointer", transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#BFDBFE"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(59,130,246,0.10)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: desc ? 8 : 0 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#1E293B", fontFamily: F }}>
                    {companyName}{verified && <VerifiedBadge label="회사 인증" />}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#3B82F6", fontFamily: F, marginTop: 3 }}>{jobTitle}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                  <div style={{ fontSize: 12, color: "#94A3B8", fontFamily: F }}>{period}</div>
                  {empType && <span style={{ fontSize: 11, fontWeight: 600, color: "#10B981", background: "#ECFDF5", borderRadius: 5, padding: "2px 8px", fontFamily: F }}>{empType}</span>}
                </div>
              </div>
              {desc && <p style={{ fontSize: 13, color: "#475569", fontFamily: F, margin: 0, lineHeight: 1.7, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{desc}</p>}
            </div>
          );
        })}
      </div>

      {/* 경력 상세 모달 */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 20, width: "min(640px, 92vw)", maxHeight: "85vh", overflowY: "auto", position: "relative", boxShadow: "0 24px 80px rgba(0,0,0,0.22)" }}>
            <div style={{ padding: "22px 28px 16px", borderBottom: "1px solid #F1F5F9", position: "sticky", top: 0, background: "white" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                <h2 style={{ fontSize: 22, fontWeight: 900, color: "#0F172A", margin: 0, fontFamily: F, lineHeight: 1.3 }}>{selected._companyName}</h2>
                {selected._verified && <VerifiedBadge label="회사 인증" />}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#3B82F6", fontFamily: F }}>{selected._jobTitle}</div>
              <button onClick={() => setSelected(null)} style={{ position: "absolute", top: 16, right: 18, background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#94A3B8", lineHeight: 1, padding: "2px 6px" }}>✕</button>
            </div>
            <div style={{ padding: "20px 28px 28px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div style={{ background: "#F8FAFC", borderRadius: 12, padding: "12px 16px", border: "1.5px solid #E2E8F0" }}>
                  <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, fontFamily: F, marginBottom: 4 }}>근무 기간</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#1E293B", fontFamily: F }}>{selected._period || "—"}</div>
                </div>
                <div style={{ background: "#F8FAFC", borderRadius: 12, padding: "12px 16px", border: "1.5px solid #E2E8F0" }}>
                  <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, fontFamily: F, marginBottom: 4 }}>고용 형태</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#1E293B", fontFamily: F }}>{selected._empType || "—"}</div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 4, height: 18, borderRadius: 2, background: "#3B82F6" }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", fontFamily: F }}>주요 업무 설명</span>
              </div>
              {selected._desc ? (
                <p style={{ fontSize: 14, color: "#334155", margin: 0, fontFamily: F, lineHeight: 1.85, whiteSpace: "pre-wrap" }}>{selected._desc}</p>
              ) : (
                <div style={{ padding: "16px", background: "#F8FAFC", borderRadius: 10, border: "1px dashed #CBD5E1", color: "#94A3B8", fontSize: 13, textAlign: "center", fontFamily: F }}>
                  세부 업무 내용이 등록되지 않았어요.
                </div>
              )}

              {/* 수행 프로젝트 목록 */}
              {Array.isArray(selected.projects) && selected.projects.length > 0 && (
                <div style={{ marginTop: 22 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <div style={{ width: 4, height: 18, borderRadius: 2, background: "#6366F1" }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", fontFamily: F }}>🗂 수행 프로젝트</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#6366F1", background: "#EEF2FF", borderRadius: 999, padding: "2px 10px", fontFamily: F }}>{selected.projects.length}건</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {selected.projects.map((proj, pi) => {
                      const pName = proj.name || proj.projectName || "(제목 없음)";
                      const pStart = (proj.startDate || "").replace(/-/g, ".");
                      const pEnd = (proj.endDate || "").replace(/-/g, ".");
                      const pPeriod = pStart || pEnd ? `${pStart || "—"} ~ ${pEnd || "현재"}` : "";
                      const pDesc = proj.description || proj.desc || "";
                      return (
                        <div key={proj.id || pi} style={{ background: "#F8FAFC", borderRadius: 12, padding: "14px 16px", border: "1.5px solid #E2E8F0" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: pDesc ? 8 : 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", fontFamily: F, flex: 1, minWidth: 0 }}>{pName}</div>
                            {pPeriod && (
                              <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", background: "white", border: "1px solid #E2E8F0", borderRadius: 6, padding: "3px 8px", fontFamily: F, flexShrink: 0, whiteSpace: "nowrap" }}>{pPeriod}</div>
                            )}
                          </div>
                          {pDesc && (
                            <p style={{ fontSize: 13, color: "#475569", margin: 0, fontFamily: F, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{pDesc}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {selected._verified && (
                <div style={{ marginTop: 18, padding: "12px 14px", background: "#F0F9FF", borderRadius: 10, border: "1px solid #BAE6FD", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>🛡️</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0369A1", fontFamily: F }}>이 경력은 회사 이메일로 인증되었어요</div>
                    <div style={{ fontSize: 11, color: "#0EA5E9", fontFamily: F, marginTop: 2 }}>실제 재직 여부가 확인된 항목입니다.</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 학력 섹션 ─────────────────────────────────────────── */
const MOCK_EDU_FALLBACK = [
  { schoolType: "4년제 대학교", schoolName: "한국대학교 (서울)", major: "컴퓨터공학과", degree: "학사", isEnrolled: false },
];

function EducationSection({ partner }) {
  const educations = (partner.educations || []).length > 0 ? partner.educations : MOCK_EDU_FALLBACK;
  return (
    <div>
      <SectionTitle icon="🎓" title="학력" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {educations.map((e, i) => {
          const schoolName = e.schoolName || e.school || "";
          const major = e.major || e.track || "";
          const nameStr = schoolName + (major ? ` | ${major}` : "");
          const degreeType = e.degree || e.degreeType || "";
          const status = e.isEnrolled ? "재학중" : (e.status || "졸업");
          const schoolType = e.schoolType || "";
          const meta = [schoolType, degreeType, status].filter(Boolean).join(" · ");
          const verified = !!(e.verifiedSchool || e.verifiedEmail);
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", padding: "14px 18px",
              backgroundColor: "white", borderRadius: 14, border: "1.5px solid #F1F5F9",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, backgroundColor: "#EFF6FF",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginRight: 14, flexShrink: 0,
              }}>
                <GraduationCap size={20} color="#3B82F6" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1E293B", fontFamily: F, display: "flex", alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{nameStr}</span>
                  {verified && <VerifiedBadge label="학교 인증" />}
                </div>
                <div style={{ fontSize: 13, color: "#94A3B8", fontFamily: F, marginTop: 2 }}>{meta}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── 포트폴리오 섹션 ─────────────────────────────────────── */
const PORTFOLIO_BG = ["linear-gradient(135deg,#F97316,#EF4444)", "linear-gradient(135deg,#3B82F6,#6366F1)", "linear-gradient(135deg,#10B981,#0EA5E9)"];
const PORTFOLIO_IMGS = [heroCheck, heroStudent, heroMoney];
const MOCK_PORTFOLIO = [
  { title: "AI 기반 챗봇 플랫폼", category: "개발·기획·AI", tags: ["React", "FastAPI", "LLM"], rep: true },
  { title: "SaaS 관리자 대시보드 리뉴얼", category: "개발·디자인·웹", tags: ["Vue.js", "TypeScript"], rep: false },
  { title: "크로스플랫폼 모바일 앱", category: "개발·앱 제작", tags: ["React Native", "Firebase"], rep: false },
];

function PortfolioSection({ partner }) {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  
  const sourceItems = Array.isArray(partner?.portfolioItems) && partner.portfolioItems.length > 0
    ? partner.portfolioItems.map((item) => ({
        sourceKey: item.sourceKey || item.id,
        title: item.title,
        category: item.role || item.period || "포트폴리오",
        tags: Array.isArray(item.techTags) ? item.techTags : [],
        thumbnailUrl: item.thumbnailUrl || null,
        rep: false,
      }))
    : MOCK_PORTFOLIO.map((p, i) => ({ ...p, sourceKey: `mock-${i}`, thumbnailUrl: null }));
    
  const items = showAll ? sourceItems : sourceItems.slice(0, 3);
  
  const handleCardClick = (item) => {
    if (item.sourceKey && !item.sourceKey.startsWith('mock-')) {
      const rawItems = Array.isArray(partner?.portfolioItems) ? partner.portfolioItems : [];
      navigate("/portfolio_project_preview", {
        state: {
          sourceKey: item.sourceKey,
          sourceKeys: sourceItems.filter(s => !s.sourceKey.startsWith('mock-')).map(s => s.sourceKey),
          portfolioItems: rawItems,
          username: partner?.username,
        },
      });
    }
  };
  
  return (
    <div>
      {/* 헤더 행: 제목 + 전체보기 버튼 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#3B82F6", flexShrink: 0, fontFamily: F }}>📋</div>
          <h2 style={{ fontSize: 23, fontWeight: 900, background: PRIMARY_GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", margin: 0, fontFamily: F }}>포트폴리오</h2>
          <span style={{ fontSize: 13, color: "#94A3B8", fontFamily: F, fontWeight: 500 }}>{sourceItems.length}건</span>
        </div>
        <button
          onClick={() => setShowAll(v => !v)}
          style={{
            background: "#DBEAFE", color: "#1e3a5f", border: "none",
            borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: F, transition: "background 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "#BFDBFE"}
          onMouseLeave={e => e.currentTarget.style.background = "#DBEAFE"}
        >
          {showAll ? "접기 ∧" : "전체 보기 ∨"}
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        {items.map((p, i) => (
          <div 
            key={i} 
            onClick={() => handleCardClick(p)}
            style={{ 
              borderRadius: 16, 
              overflow: "hidden", 
              border: "1.5px solid #E2E8F0", 
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              cursor: p.sourceKey && !p.sourceKey.startsWith('mock-') ? "pointer" : "default",
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
            onMouseEnter={e => {
              if (p.sourceKey && !p.sourceKey.startsWith('mock-')) {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(59,130,246,0.12)";
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
            }}
          >
            {/* 썸네일 */}
            <div style={{ 
              height: 120, 
              background: p.thumbnailUrl ? "#F8FAFC" : PORTFOLIO_BG[i % PORTFOLIO_BG.length], 
              position: "relative", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              overflow: "hidden",
            }}>
              {p.thumbnailUrl ? (
                <img 
                  src={p.thumbnailUrl} 
                  alt="thumbnail" 
                  style={{ 
                    width: "100%", 
                    height: "100%", 
                    objectFit: "cover",
                  }} 
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    e.currentTarget.parentElement.style.background = PORTFOLIO_BG[i % PORTFOLIO_BG.length];
                    const fallbackImg = document.createElement('img');
                    fallbackImg.src = PORTFOLIO_IMGS[i % PORTFOLIO_IMGS.length];
                    fallbackImg.alt = "thumbnail";
                    fallbackImg.style.height = "90px";
                    fallbackImg.style.objectFit = "contain";
                    fallbackImg.style.opacity = "0.92";
                    e.currentTarget.parentElement.appendChild(fallbackImg);
                  }}
                />
              ) : (
                <img src={PORTFOLIO_IMGS[i % PORTFOLIO_IMGS.length]} alt="thumbnail" style={{ height: 90, objectFit: "contain", opacity: 0.92 }} />
              )}
              {p.rep && (
                <span style={{ position: "absolute", top: 10, left: 10, fontSize: 11, fontWeight: 800, color: "#1D4ED8", background: "white", borderRadius: 6, padding: "2px 8px", fontFamily: F }}>대표</span>
              )}
            </div>
            {/* 정보 */}
            <div style={{ padding: "14px 16px", background: "white" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#1E293B", fontFamily: F, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
              <div style={{ fontSize: 11, color: "#94A3B8", fontFamily: F, marginBottom: 8 }}>{p.category}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {p.tags.map(t => (
                  <span key={t} style={{ fontSize: 11, fontWeight: 600, color: "#3B82F6", background: "#EFF6FF", borderRadius: 5, padding: "2px 8px", fontFamily: F }}>{t}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 클라이언트 평가 섹션 ─────────────────────────────────── */
const AVATAR_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#EC4899", "#0EA5E9", "#14B8A6"];

/** API 응답(PartnerReviewResponse)을 ReviewItem props 형태로 변환 */
function mapApiToReview(r) {
  const name = r.reviewerUsername || "익명";
  return {
    _id: r.id,
    type: null,
    title: null,
    client: name.length > 1 ? name.charAt(0) + "**" : name,
    clientBg: AVATAR_COLORS[Number(r.id || 0) % AVATAR_COLORS.length],
    rating: r.rating || 0,
    date: r.createdAt ? r.createdAt.substring(0, 7).replace("-", ".") : null,
    tags: [],
    scores: null,
    budget: null,
    duration: null,
    description: null,
    review: r.content || "(내용 없음)",
  };
}
function ReviewItem({ review }) {
  return (
    <div style={{
      background: "white", borderRadius: 18,
      border: "1.5px solid #F1F5F9", padding: "24px 28px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)", marginBottom: 16,
    }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", flex: 1 }}>
          {review.type && (
            <span style={{
              padding: "3px 10px", borderRadius: 6,
              background: "#EFF6FF", border: "1px solid #BFDBFE",
              fontSize: 12, fontWeight: 700, color: "#3B82F6", fontFamily: F, flexShrink: 0,
            }}>{review.type}</span>
          )}
          {review.title && <span style={{ fontSize: 18, fontWeight: 800, color: "#1E293B", fontFamily: F }}>{review.title}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: "50%",
            background: review.clientBg || "#3B82F6",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <span style={{ fontSize: 13, color: "white", fontWeight: 700, fontFamily: F }}>{(review.client || "?").charAt(0)}</span>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#374151", fontFamily: F, whiteSpace: "nowrap" }}>{review.client}</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#1E293B", fontFamily: F }}>{(review.rating || 0).toFixed(1)}</span>
          <StarRating rating={review.rating || 0} size={15} />
          {review.date && <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: F, whiteSpace: "nowrap" }}>{review.date} 완료</span>}
        </div>
      </div>
      {/* 태그 */}
      {review.tags && review.tags.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {review.tags.map(tag => (
            <span key={tag} style={{
              padding: "4px 10px", borderRadius: 6,
              background: "#F8FAFC", border: "1px solid #E2E8F0",
              fontSize: 12, fontWeight: 500, color: "#64748B", fontFamily: F,
            }}>{tag}</span>
          ))}
        </div>
      )}
      {/* 4열 점수 바 (점수 데이터 있을 때만) */}
      {review.scores && (
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 20,
          paddingBottom: 18, marginBottom: 18, borderBottom: "1px solid #F1F5F9",
        }}>
          <MiniRatingBar label="전문성"   value={review.scores.expertise}     />
          <MiniRatingBar label="일정 준수" value={review.scores.schedule}      />
          <MiniRatingBar label="소통 능력" value={review.scores.communication} />
          <MiniRatingBar label="적극성"    value={review.scores.proactivity}   />
        </div>
      )}
      {/* 예산/기간 + 설명 (데이터 있을 때만) */}
      {(review.budget || review.duration || review.description) && (
        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 24, marginBottom: 18 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {review.budget && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.1em", fontFamily: F, marginBottom: 4 }}>BUDGET</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: "#EFF6FF", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>💰</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#1E293B", fontFamily: F }}>{review.budget}</span>
                </div>
              </div>
            )}
            {review.duration && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.1em", fontFamily: F, marginBottom: 4 }}>DURATION</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: "#F0FFF4", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>📅</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#1E293B", fontFamily: F }}>{review.duration}</span>
                </div>
              </div>
            )}
          </div>
          {review.description && <p style={{ fontSize: 14, color: "#475569", fontFamily: F, lineHeight: 1.75, margin: 0 }}>{review.description}</p>}
        </div>
      )}
      {/* 인용 후기 */}
      <div style={{ background: "#F8FAFC", borderRadius: 12, padding: "14px 20px", borderLeft: "4px solid #BFDBFE" }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: "#93C5FD", lineHeight: 0.9, marginBottom: 6, fontFamily: F }}>❝</div>
        <p style={{ fontSize: 14, color: "#475569", fontFamily: F, lineHeight: 1.75, margin: 0, fontStyle: "italic" }}>{review.review}</p>
      </div>
    </div>
  );
}

function ReviewsSection({ partner, reviews }) {
  const rating = partner.rating || (reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) : 4.8);
  const total = reviews.length;
  const countByScore = [5, 4, 3, 2, 1].map(s => ({
    label: `${s}점`,
    count: reviews.filter(r => Math.round(r.rating) === s).length,
  }));
  const bars = countByScore.map(b => ({
    ...b,
    ratio: total > 0 ? Math.round((b.count / total) * 100) : 0,
  }));

  return (
    <div>
      <SectionTitle icon="⭐" title="클라이언트 평가" />

      {/* 별점 요약 */}
      <div style={{ display: "flex", gap: 28, background: "#F8FAFC", borderRadius: 16, padding: "24px 28px", border: "1.5px solid #E2E8F0", marginBottom: 24, alignItems: "center" }}>
        <div style={{ textAlign: "center", minWidth: 80 }}>
          <div style={{ fontSize: 48, fontWeight: 900, color: "#1E293B", fontFamily: F, lineHeight: 1 }}>{typeof rating === "number" ? rating.toFixed(1) : rating}</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 3, marginTop: 6 }}>
            <StarRating rating={typeof rating === "number" ? rating : parseFloat(rating)} size={16} />
          </div>
          <div style={{ fontSize: 12, color: "#94A3B8", fontFamily: F, marginTop: 4 }}>{total}건 평가</div>
        </div>
        <div style={{ flex: 1 }}>
          {bars.map(b => (
            <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#475569", fontFamily: F, width: 24 }}>{b.label}</span>
              <div style={{ flex: 1, height: 8, background: "#E2E8F0", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ width: `${b.ratio}%`, height: "100%", borderRadius: 99, background: "#F59E0B" }} />
              </div>
              <span style={{ fontSize: 11, color: "#94A3B8", fontFamily: F, width: 16 }}>{b.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 리뷰 목록 */}
      <div>
        {total === 0 ? (
          <div style={{ background: "#F8FAFC", borderRadius: 14, padding: "40px 24px", textAlign: "center", border: "1.5px solid #E2E8F0", color: "#94A3B8", fontSize: 14, fontFamily: F }}>
            아직 후기가 없습니다.
          </div>
        ) : reviews.map((r) => <ReviewItem key={r._id ?? r.id} review={r} />)}
      </div>
    </div>
  );
}

/* ── 진행하는 프로젝트 섹션 ─────────────────────────────── */
function ProjectsSection({ partner }) {
  const navigate = useNavigate();
  const { userRole, loginUser } = useStore();
  const isPartner = userRole === "partner" || userRole === "PARTNER";
  const isOwner = loginUser && partner?.username && loginUser === partner.username;

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);

  useEffect(() => {
    // 본인 파트너 프로필일 때만 진행 중인(=ACCEPTED/CONTRACTED/IN_PROGRESS) 프로젝트 조회
    if (!isOwner || !isPartner) { setLoading(false); setProjects([]); return; }
    let alive = true;
    setLoading(true);
    applicationsApi.myList()
      .then(async (apps) => {
        const acceptedApps = (apps || []).filter((a) => {
          const s = (a.status || "").toUpperCase();
          return s === "ACCEPTED" || s === "CONTRACTED" || s === "IN_PROGRESS";
        });
        if (acceptedApps.length === 0) return [];
        const results = await Promise.all(
          acceptedApps.map((a) =>
            projectsApi.detail(a.projectId).then((p) => ({ ...p, _appStatus: a.status })).catch(() => null)
          )
        );
        return results.filter(Boolean);
      })
      .then((list) => { if (alive) setProjects(list); })
      .catch((e) => console.warn("[PartnerProfileView] 진행 프로젝트 조회 실패:", e))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [isOwner, isPartner]);

  return (
    <div>
      <SectionTitle icon="🔄" title="진행하는 프로젝트" />
      {!isOwner ? (
        <div style={{ background: "#F8FAFC", borderRadius: 14, padding: "40px 24px", textAlign: "center", border: "1.5px solid #E2E8F0", color: "#94A3B8", fontSize: 14, fontFamily: F }}>
          파트너 본인만 진행 중인 프로젝트를 확인할 수 있어요.
        </div>
      ) : loading ? (
        <div style={{ background: "#F8FAFC", borderRadius: 14, padding: "40px 24px", textAlign: "center", color: "#94A3B8", fontSize: 14, fontFamily: F }}>
          불러오는 중…
        </div>
      ) : projects.length === 0 ? (
        <div style={{ background: "#F8FAFC", borderRadius: 14, padding: "40px 24px", textAlign: "center", border: "1.5px solid #E2E8F0", color: "#94A3B8", fontSize: 14, fontFamily: F }}>
          아직 매칭되어 진행 중인 프로젝트가 없어요.
        </div>
      ) : projects.map((p) => {
        const isPaid = p.priceType === "유료";
        const status = (p._appStatus || "").toUpperCase();
        const statusLabel = status === "IN_PROGRESS" ? "진행 중" : status === "CONTRACTED" ? "계약 체결" : "매칭 완료";
        const statusColor = status === "IN_PROGRESS"
          ? { bg: "#ECFDF5", color: "#10B981", border: "#A7F3D0" }
          : status === "CONTRACTED"
          ? { bg: "#FEF3C7", color: "#D97706", border: "#FCD34D" }
          : { bg: "#EFF6FF", color: "#3B82F6", border: "#BFDBFE" };
        return (
          <div key={p.id} style={{ background: "white", borderRadius: 14, padding: "20px 24px", border: "1.5px solid #E2E8F0", marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: statusColor.color, background: statusColor.bg, border: `1px solid ${statusColor.border}`, borderRadius: 8, padding: "3px 10px", fontFamily: F, flexShrink: 0 }}>
                    {statusLabel}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "#1E293B", fontFamily: F, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title || p.slogan}</span>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700,
                    color: isPaid ? "#3B82F6" : "#10B981",
                    background: isPaid ? "#EFF6FF" : "#ECFDF5",
                    border: `1px solid ${isPaid ? "#BFDBFE" : "#A7F3D0"}`,
                    borderRadius: 6, padding: "3px 10px", fontFamily: F, flexShrink: 0,
                  }}>
                    {isPaid ? "유료" : "무료"}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#6366F1", background: "#EEF2FF", borderRadius: 6, padding: "3px 10px", fontFamily: F }}>{p.serviceField || "기타"}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#475569", background: "#F1F5F9", borderRadius: 6, padding: "3px 10px", fontFamily: F }}>기간: {p.period || "협의"}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#475569", background: "#F1F5F9", borderRadius: 6, padding: "3px 10px", fontFamily: F }}>예산: {p.price || "협의"}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedProject(p)}
                style={{
                  background: "#DBEAFE", color: "#1e3a5f", border: "none",
                  borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: F, transition: "background 0.15s", flexShrink: 0,
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#BFDBFE"}
                onMouseLeave={e => e.currentTarget.style.background = "#DBEAFE"}
              >
                상세보기
              </button>
            </div>
          </div>
        );
      })}

      {/* 상세보기 모달 */}
      {selectedProject && (() => {
        const sp = selectedProject;
        const isPaid = sp.priceType === "유료";
        const tags = Array.isArray(sp.tags) ? sp.tags : [];
        return (
        <div onClick={() => setSelectedProject(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 20, width: "min(720px, 92vw)", maxHeight: "85vh", overflowY: "auto", position: "relative", boxShadow: "0 24px 80px rgba(0,0,0,0.22)" }}>
            <div style={{ padding: "22px 28px 16px", borderBottom: "1px solid #F1F5F9", position: "sticky", top: 0, background: "white" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: isPaid ? "#EFF6FF" : "#F0FFF4", color: isPaid ? "#3B82F6" : "#16A34A", fontFamily: F }}>{isPaid ? "유료" : "무료"}</span>
                <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: "#FEF2F2", color: "#DC2626", fontFamily: F }}>{sp.workPref || "협의"}</span>
                <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: "#F0FDF4", color: "#16A34A", fontFamily: F }}>{sp.currentStatus || "진행 중"}</span>
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", margin: 0, fontFamily: F, paddingRight: 36, lineHeight: 1.3 }}>{sp.title || sp.slogan}</h2>
              <button onClick={() => setSelectedProject(null)} style={{ position: "absolute", top: 16, right: 18, background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#94A3B8", lineHeight: 1, padding: "2px 6px" }}>✕</button>
            </div>
            <div style={{ padding: "20px 28px 28px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div style={{ background: "#F8FAFC", borderRadius: 12, padding: "12px 16px", border: "1.5px solid #E2E8F0" }}>
                  <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, fontFamily: F, marginBottom: 4 }}>예상 견적</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#1E293B", fontFamily: F }}>{sp.price || "협의"}</div>
                </div>
                <div style={{ background: "#F8FAFC", borderRadius: 12, padding: "12px 16px", border: "1.5px solid #E2E8F0" }}>
                  <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, fontFamily: F, marginBottom: 4 }}>예상 기간</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#1E293B", fontFamily: F }}>{sp.period || "협의"}</div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 4, height: 18, borderRadius: 2, background: "#3B82F6" }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", fontFamily: F }}>프로젝트 개요</span>
              </div>
              <p style={{ fontSize: 14, color: "#475569", margin: "0 0 18px", fontFamily: F, lineHeight: 1.8 }}>{sp.desc || sp.sloganSub || "—"}</p>

              {tags.length > 0 && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 4, height: 18, borderRadius: 2, background: "#3B82F6" }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", fontFamily: F }}>기술 스택</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                    {tags.map((t, i) => (
                      <span key={i} style={{ fontSize: 13, fontWeight: 700, color: "#1D4ED8", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "5px 14px", fontFamily: F }}>{String(t).replace("#", "")}</span>
                    ))}
                  </div>
                </>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => navigate("/partnerdashboard")}
                  style={{ flex: 1, padding: "14px 0", borderRadius: 12, border: "none", background: PRIMARY_GRAD, color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: F }}
                >대시보드에서 관리</button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   메인 페이지
══════════════════════════════════════════════════════ */
export default function PartnerProfileView() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const basePartner = state?.partner || {};
  const [detail, setDetail] = useState(null);
  const [portfolioItems, setPortfolioItems] = useState([]);
  const [reviews, setReviews] = useState([]);
  // 검색 카드의 요약 정보 + 백엔드 detail(skills/careers/educations/certifications/awards/bio/strengthDesc) 머지
  // name 이 비어있거나 숫자만(예: "2991" 같은 ID)인 경우 표시명을 덮어쓰지 않도록 제거 → userId(@hyleeyou) 로 fallback
  const stripBadName = (obj) => {
    if (!obj) return obj;
    const o = { ...obj };
    if (typeof o.name !== "string" || !o.name.trim() || /^\d+$/.test(o.name.trim())) {
      delete o.name;
    }
    return o;
  };
  const partner = { ...stripBadName(basePartner), ...stripBadName(detail), portfolioItems };

  // state.partner가 없으면 (새로고침/직접 URL 진입) 검색 화면으로 복귀
  useEffect(() => {
    if (!state?.partner) {
      console.warn("[PartnerProfileView] partner state 없음 → /partner_search 로 이동");
      navigate("/partner_search", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // username 으로 백엔드 프로필 상세 조회 (skills/careers/educations/certifications/awards 포함)
  useEffect(() => {
    const username = basePartner?.username;
    if (!username) return;
    let alive = true;
    profileApi.getDetailByUsername(username)
      .then((d) => { if (alive) setDetail(d); })
      .catch((err) => console.warn("[PartnerProfileView] 프로필 상세 조회 실패:", err));
    return () => { alive = false; };
  }, [basePartner?.username]);

  useEffect(() => {
    const username = basePartner?.username;
    if (!username) return;
    let alive = true;
    portfolioApi.byUsername(username)
      .then((items) => { if (alive) setPortfolioItems(items || []); })
      .catch((err) => console.warn("[PartnerProfileView] 포트폴리오 조회 실패:", err));
    return () => { alive = false; };
  }, [basePartner?.username]);

  // partnerProfileId(=partner.id) 로 후기 조회
  useEffect(() => {
    const ppId = basePartner?.id;
    if (!ppId) return;
    let alive = true;
    reviewsApi.byPartner(ppId)
      .then((data) => { if (alive) setReviews((data || []).map(mapApiToReview)); })
      .catch((err) => console.warn("[PartnerProfileView] 후기 조회 실패:", err));
    return () => { alive = false; };
  }, [basePartner?.id]);

  const [activeTab, setActiveTab] = useState("intro");
  const sectionRefs = useRef({});
  const isScrollingRef = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (isScrollingRef.current) return;
      entries.forEach(entry => {
        if (entry.isIntersecting) setActiveTab(entry.target.dataset.section);
      });
    }, { rootMargin: "-100px 0px -60% 0px", threshold: 0.1 });
    Object.entries(sectionRefs.current).forEach(([key, el]) => {
      if (el) { el.dataset.section = key; observer.observe(el); }
    });
    return () => observer.disconnect();
  }, []);

  const scrollTo = (key) => {
    isScrollingRef.current = true;
    setActiveTab(key);
    const el = sectionRefs.current[key];
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top, behavior: "smooth" });
      setTimeout(() => { isScrollingRef.current = false; }, 800);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F8FAFC", fontFamily: F }}>
      <AppHeader />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 40px 60px" }}>

        {/* 뒤로가기 */}
        <button
          onClick={() => navigate(-1)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#64748B", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: F, marginBottom: 18, padding: 0 }}
          onMouseEnter={e => e.currentTarget.style.color = "#3B82F6"}
          onMouseLeave={e => e.currentTarget.style.color = "#64748B"}
        >
          <ChevronLeft size={18} /> 파트너 목록으로 돌아가기
        </button>

        {/* 배너 영역 */}
        <PartnerBannerCard viewMode={true} partnerData={partner} />

        {/* 사이드바 + 콘텐츠 */}
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

          {/* ── 왼쪽 스티키 탭 사이드바 ── */}
          <aside style={{
            width: 220, flexShrink: 0,
            position: "sticky", top: 80,
            background: "white", borderRadius: 16,
            border: "1.5px solid #E2E8F0",
            padding: "16px 12px",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            maxHeight: "calc(100vh - 100px)", overflowY: "auto",
          }}>
            {VIEW_TABS.map(tab => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => scrollTo(tab.key)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "11px 14px", borderRadius: 10, marginBottom: 4,
                    border: isActive ? "1.5px solid #BFDBFE" : "1.5px solid transparent",
                    background: isActive ? "#EFF6FF" : "transparent",
                    cursor: "pointer", fontFamily: F, textAlign: "left",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#F8FAFC"; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ fontSize: tab.icon === "</>" ? 11 : 16, fontWeight: tab.icon === "</>" ? 800 : 400, color: isActive ? "#3B82F6" : "#64748B", minWidth: 20, textAlign: "center" }}>
                    {tab.icon}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? "#1E293B" : "#475569" }}>
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </aside>

          {/* ── 콘텐츠 영역 ── */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>

            {VIEW_TABS.map(tab => (
              <section
                key={tab.key}
                ref={el => sectionRefs.current[tab.key] = el}
                style={{ background: "white", borderRadius: 20, padding: "20px 28px", border: "1.5px solid #E2E8F0", boxShadow: "0 2px 10px rgba(0,0,0,0.04)", scrollMarginTop: 90 }}
              >
                {tab.key === "home"      && <HomeSection partner={partner} reviews={reviews} />}
                {tab.key === "intro"     && <IntroSection partner={partner} />}
                {tab.key === "skills"    && <SkillsSection partner={partner} />}
                {tab.key === "career"    && <CareerSection partner={partner} />}
                {tab.key === "education" && <EducationSection partner={partner} />}
                {tab.key === "portfolio" && <PortfolioSection partner={partner} />}
                {tab.key === "reviews"   && <ReviewsSection partner={partner} reviews={reviews} />}
                {tab.key === "projects"  && <ProjectsSection partner={partner} />}
              </section>
            ))}

          </div>
        </div>
      </div>
    </div>
  );
}
