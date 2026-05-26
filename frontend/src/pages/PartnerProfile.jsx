import { useState, useRef, useEffect } from "react";
import { ChevronDown as ChDown, GraduationCap, Pencil, Trash2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Header_partner from "../components/Header_partner";
import aiBird from "../assets/hero_check.png";
import PartnerBannerCard from "../components/PartnerBannerCard";
import useStore from "../store/useStore";
import { profileApi } from "../api/profile.api";
import { projectsApi } from "../api/projects.api";
import { applicationsApi } from "../api/applications.api";
import { applyVerifiedSchool } from "../lib/schoolMatch";
import { useLanguage } from "../i18n/LanguageContext";

const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/* ── 탭 목록 ─────────────────────────────────────────────── */
const TABS = [
  { key: "profile_menu",  label: "프로필 메뉴 관리" },
  { key: "intro",         label: "파트너로서 자기소개" },
  { key: "skills",        label: "보유 기술" },
  { key: "career",        label: "경력" },
  { key: "education",     label: "학력" },
  { key: "certificates",  label: "자격증" },
  { key: "awards",        label: "수상이력" },
  { key: "reviews",       label: "클라이언트 평가" },
  { key: "projects",      label: "진행하는 프로젝트" },
];

/* ── 프로필 메뉴 관리 항목 ──────────────────────────────── */
const MENU_ITEMS = [
  { key: "profile_menu",  icon: "⚙️",  iconBg: "#EEF2FF", iconColor: "#6366F1", title: "프로필 메뉴 관리",     desc: "전체 프로필 메뉴의 구성을 설정합니다",         initOn: true  },
  { key: "intro",         icon: "👤",  iconBg: "#EFF6FF", iconColor: "#3B82F6", title: "파트너로서 자기소개",  desc: "강점과 협업 스타일을 보여주는 자기소개",        initOn: true  },
  { key: "skills",        icon: "</>", iconBg: "#ECFDF5", iconColor: "#10B981", title: "보유 기술",            desc: "숙련된 기술 스택 및 툴 목록",                  initOn: true  },
  { key: "career",        icon: "💼",  iconBg: "#FFF7ED", iconColor: "#F97316", title: "경력",                 desc: "이전 직장 및 프로젝트 수행 이력",              initOn: true  },
  { key: "education",     icon: "🎓",  iconBg: "#EFF6FF", iconColor: "#3B82F6", title: "학력",                 desc: "최종 학력 및 전공 정보",                       initOn: true  },
  { key: "certificates",  icon: "🏅",  iconBg: "#FFFBEB", iconColor: "#D97706", title: "자격증",               desc: "보유하고 있는 국가 공인 및 민간 자격증",       initOn: true  },
  { key: "awards",        icon: "🏆",  iconBg: "#FFF7ED", iconColor: "#F97316", title: "수상 이력",            desc: "대회 수상 기록 및 대외 활동 성과",             initOn: true  },
  { key: "portfolio",     icon: "📋",  iconBg: "#EFF6FF", iconColor: "#3B82F6", title: "포트폴리오",           desc: "완료한 주요 프로젝트 상세 내용",               initOn: true  },
  { key: "reviews",       icon: "⭐",  iconBg: "#FFF0F3", iconColor: "#F43F5E", title: "클라이언트 평가",      desc: "프로젝트 종료 후 받은 평점 및 후기",           initOn: true  },
  { key: "projects",      icon: "🔄",  iconBg: "#ECFDF5", iconColor: "#10B981", title: "진행하는 프로젝트",    desc: "현재 참여 중인 프로젝트 현황",                 initOn: true  },
];

/* ── 토글 스위치 ─────────────────────────────────────────── */
function Toggle({ on, onChange }) {
  return (
    <div
      onClick={onChange}
      style={{
        width: 52, height: 28, borderRadius: 14,
        background: on ? "#3B82F6" : "#CBD5E1",
        position: "relative", cursor: "pointer",
        transition: "background 0.25s", flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute", top: 3,
        left: on ? "calc(100% - 25px)" : 3,
        width: 22, height: 22, borderRadius: "50%",
        background: "white",
        boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
        transition: "left 0.25s",
      }} />
    </div>
  );
}

/* ── 드롭다운 칩 ───────────────────────────────────────────── */
/* ── 프로필 메뉴 관리 탭 콘텐츠 ─────────────────────────── */
function ProfileMenuTab() {
  const { partnerProfileDetail, updatePartnerProfileDetail } = useStore();
  const { t } = useLanguage();
  const initState = Object.fromEntries(MENU_ITEMS.map(m => [m.key, true]));
  const [toggles, setToggles] = useState(
    { ...initState, ...(partnerProfileDetail?.profileMenuToggles || {}) }
  );
  const [saved, setSaved] = useState(false);

  const flip = (key) => setToggles(prev => ({ ...prev, [key]: !prev[key] }));
  const handleSave = () => {
    updatePartnerProfileDetail({ profileMenuToggles: toggles });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <h2 style={{ fontSize: 27, fontWeight: 900, background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", margin: "0 0 8px", fontFamily: F }}>
        {t("partnerProfile.menuManage.title")}
      </h2>
      <p style={{ fontSize: 14, color: "#64748B", margin: "0 0 32px", fontFamily: F, lineHeight: 1.7 }}>
        {t("partnerProfile.menuManage.desc")}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {MENU_ITEMS.map(item => (
          <div
            key={item.key}
            style={{
              display: "flex", alignItems: "center", gap: 16,
              padding: "16px 20px", borderRadius: 14,
              border: "1.5px solid #F1F5F9", background: "#FAFBFC",
              transition: "border-color 0.15s",
            }}
          >
            {/* 아이콘 박스 */}
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: item.iconBg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: item.icon === "</>" ? 12 : 20, fontWeight: 800,
              color: item.iconColor, flexShrink: 0, fontFamily: F,
            }}>
              {item.icon}
            </div>
            {/* 텍스트 */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1E293B", fontFamily: F }}>
                {item.title}
              </div>
              <div style={{ fontSize: 13, color: "#94A3B8", fontFamily: F, marginTop: 2 }}>
                {item.desc}
              </div>
            </div>
            {/* 토글 */}
            <Toggle on={toggles[item.key]} onChange={() => flip(item.key)} />
          </div>
        ))}
      </div>

      {/* 저장 버튼 */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 28 }}>
        <button
          type="button"
          onClick={handleSave}
          style={{
            padding: "14px 32px", borderRadius: 12, border: "none",
            background: saved
              ? "linear-gradient(135deg, #34D399 0%, #10B981 100%)"
              : "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)",
            color: "white", fontSize: 15, fontWeight: 700,
            cursor: "pointer", fontFamily: F,
            boxShadow: "0 4px 14px rgba(59,130,246,0.35)",
            transition: "background 0.3s",
          }}
        >
          {saved ? t("partnerProfile.menuManage.saved") : t("partnerProfile.menuManage.saveBtn")}
        </button>
      </div>
    </div>
  );
}

/* ── 파트너로서 자기소개 탭 ──────────────────────────────── */
const MAX_INTRO = 5000;
const MAX_SHORT_BIO = 200;

function IntroFieldLabel({ text }) {
  return (
    <div style={{ fontSize: 15, fontWeight: 700, color: "#1E293B", fontFamily: F, marginBottom: 10 }}>
      {text}<span style={{ color: "#EF4444", marginLeft: 3 }}>*</span>
    </div>
  );
}

function ShortBioInput({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value.slice(0, MAX_SHORT_BIO))}
      placeholder={placeholder}
      style={{
        width: "100%", boxSizing: "border-box",
        padding: "14px 16px", border: "1.5px solid #E2E8F0", borderRadius: 12,
        fontSize: 14, color: "#1E293B", fontFamily: F, outline: "none",
        transition: "border-color 0.15s",
      }}
      onFocus={e => e.target.style.borderColor = "#3B82F6"}
      onBlur={e => e.target.style.borderColor = "#E2E8F0"}
    />
  );
}

function ShortBioCounter({ value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, marginBottom: 28 }}>
      <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: F }}>200자 이내</span>
      <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: F }}>{value.length}/{MAX_SHORT_BIO}</span>
    </div>
  );
}

function IntroTextArea({ value, onChange, placeholder }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value.slice(0, MAX_INTRO))}
      placeholder={placeholder}
      style={{
        width: "100%", boxSizing: "border-box",
        height: 180, padding: "16px", resize: "vertical",
        border: "1.5px solid #E2E8F0", borderRadius: 12,
        fontSize: 14, color: "#1E293B", fontFamily: F,
        lineHeight: 1.7, outline: "none",
        transition: "border-color 0.15s",
        display: "block",
      }}
      onFocus={e => e.target.style.borderColor = "#3B82F6"}
      onBlur={e => e.target.style.borderColor = "#E2E8F0"}
    />
  );
}

function IntroCounter({ value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, marginBottom: 28 }}>
      <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: F }}>5000자 이내</span>
      <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: F }}>{value.length}/{MAX_INTRO}</span>
    </div>
  );
}

function IntroTab() {
  const { partnerProfileDetail, updatePartnerProfileDetail, syncProfileDetailToServer, bumpProfileRefresh } = useStore();
  const { t } = useLanguage();
  const [shortBio, setShortBio] = useState(partnerProfileDetail?.shortBio || "");
  const [slogan, setSlogan] = useState(partnerProfileDetail?.slogan || "");
  const [intro, setIntro] = useState(partnerProfileDetail?.bio || "");
  const [strength, setStrength] = useState(partnerProfileDetail?.strengthDesc || "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // 마운트 시 서버에서 슬로건 로드 (UpdateUserBasicInfoRequest는 GET이 아니므로 getMyDetail 사용)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await profileApi.getMyDetail();
        if (!alive) return;
        if (data?.shortBio !== undefined && data.shortBio !== null) setShortBio(data.shortBio || "");
        if (data?.slogan !== undefined && data.slogan !== null) setSlogan(data.slogan || "");
        if (data?.bio !== undefined && data.bio !== null) setIntro(data.bio || "");
        if (data?.strengthDesc !== undefined && data.strengthDesc !== null) setStrength(data.strengthDesc || "");
      } catch (e) {
        console.warn("[IntroTab] 초기 로드 실패:", e?.message);
      }
    })();
    return () => { alive = false; };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1) UserProfileDetail / 레거시 PartnerProfile.shortBio 저장
      updatePartnerProfileDetail({ shortBio, bio: intro, strengthDesc: strength });
      await syncProfileDetailToServer('partner');
      // 2) 슬로건은 PartnerProfile.slogan 컬럼이라 updateBasicInfo로 별도 저장
      if (slogan !== undefined) {
        await profileApi.updateBasicInfo({ slogan });
      }
      // 3) BannerCard 등 다른 컴포넌트 자동 갱신
      bumpProfileRefresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("저장 실패:", err);
      alert("저장에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: 27, fontWeight: 900, background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", margin: "0 0 8px", fontFamily: F }}>
        {t("partnerProfile.intro.title")}
      </h2>
      <p style={{ fontSize: 14, color: "#64748B", margin: "0 0 32px", fontFamily: F, lineHeight: 1.7 }}>
        {t("partnerProfile.intro.desc")}
      </p>

      <IntroFieldLabel text={t("partnerProfile.intro.slogan")} />
      <ShortBioInput value={slogan} onChange={setSlogan} placeholder={t("partnerProfile.intro.sloganPlaceholder")} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, marginBottom: 28 }}>
        <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: F }}>{t("partnerProfile.intro.sloganPlaceholder")}</span>
        <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: F }}>{slogan.length}/{MAX_SHORT_BIO}</span>
      </div>

      <IntroFieldLabel text={t("partnerProfile.intro.tagline")} />
      <ShortBioInput value={shortBio} onChange={setShortBio} placeholder={t("partnerProfile.intro.taglinePlaceholder")} />
      <ShortBioCounter value={shortBio} />

      <IntroFieldLabel text={t("partnerProfile.intro.about")} />
      <IntroTextArea value={intro} onChange={setIntro} placeholder={t("partnerProfile.intro.aboutPlaceholder")} />
      <IntroCounter value={intro} />

      <IntroFieldLabel text={t("partnerProfile.intro.strengths")} />
      <IntroTextArea value={strength} onChange={setStrength} placeholder={t("partnerProfile.intro.strengthsPlaceholder")} />
      <IntroCounter value={strength} />

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "14px 36px", borderRadius: 12, border: "none",
            background: saved
              ? "linear-gradient(135deg, #34D399 0%, #10B981 100%)"
              : "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)",
            color: "white", fontSize: 15, fontWeight: 700,
            cursor: saving ? "not-allowed" : "pointer", fontFamily: F,
            opacity: saving ? 0.7 : 1,
            boxShadow: "0 4px 14px rgba(59,130,246,0.35)",
            transition: "background 0.3s",
          }}
        >
          {saving ? t("partnerProfile.intro.saving") : (saved ? t("partnerProfile.intro.saved") : t("partnerProfile.intro.saveBtn"))}
        </button>
      </div>
    </div>
  );
}

/* ── 보유 기술 탭 ──────────────────────────────────────────── */
const SKILL_OPTIONS = [
  "React", "Vue.js", "Angular", "Node.js", "Python", "Django",
  "Spring Boot", "Java", "Go", "Rust", "TypeScript", "AWS",
  "Docker", "Kubernetes", "Figma", "Unity", "Flutter",
];
const PROFICIENCY_OPTIONS = ["전문가 (Expert)", "고급 (Advanced)", "중급 (Intermediate)", "초급 (Beginner)"];
const EXPERIENCE_OPTIONS = ["1년 미만", "1~3년", "3~5년", "5년 이상"];

const SKILL_COLOR_MAP = {
  "React": "#61DAFB", "Vue.js": "#42B883", "Angular": "#DD0031",
  "Node.js": "#68A063", "Python": "#3776AB", "Django": "#092E20",
  "Spring Boot": "#6DB33F", "Java": "#F89820", "Go": "#00ADD8",
  "Rust": "#DEA584", "TypeScript": "#3178C6", "AWS": "#FF9900",
  "Docker": "#2496ED", "Kubernetes": "#326CE5", "Figma": "#F24E1E",
  "Unity": "#475569", "Flutter": "#54C5F8",
};

const selectStyle = {
  width: "100%", padding: "10px 14px",
  border: "1.5px solid #E2E8F0", borderRadius: 10,
  fontSize: 14, color: "#1E293B", fontFamily: F,
  background: "white", cursor: "pointer",
  outline: "none", appearance: "none",
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2394A3B8' stroke-width='1.8' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  paddingRight: 36,
  boxSizing: "border-box",
};

function SkillEditCard({ skill, onSave, onRemove }) {
  const [techName, setTechName] = useState(skill.techName || "");
  const [customTech, setCustomTech] = useState(skill.customTech || "");
  const [proficiency, setProficiency] = useState(skill.proficiency || "");
  const [experience, setExperience] = useState(skill.experience || "");
  const { t } = useLanguage();

  const canSave = (techName || customTech.trim()) && proficiency && experience;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      techName: customTech.trim() || techName,
      proficiency,
      experience,
    });
  };

  return (
    <div style={{
      border: "1.5px solid #E2E8F0", borderRadius: 14,
      padding: "24px 24px 20px",
      background: "white", position: "relative",
      marginBottom: 12,
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    }}>
      {/* X 닫기 버튼 */}
      <button
        onClick={onRemove}
        style={{
          position: "absolute", top: 14, right: 16,
          background: "none", border: "none",
          fontSize: 20, color: "#94A3B8", cursor: "pointer",
          lineHeight: 1, padding: "2px 6px",
          borderRadius: 6, transition: "color 0.15s",
        }}
        onMouseEnter={e => e.currentTarget.style.color = "#EF4444"}
        onMouseLeave={e => e.currentTarget.style.color = "#94A3B8"}
      >
        ×
      </button>

      {/* 3칸 그리드: 기술명 | 숙련도 | 경험 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#475569", fontFamily: F, display: "block", marginBottom: 8 }}>
            {t("partnerProfile.skills.skillName")}
          </label>
          <select value={techName} onChange={e => setTechName(e.target.value)} style={selectStyle}>
            <option value="">{t("partnerProfile.skills.skillDefault")}</option>
            {SKILL_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#475569", fontFamily: F, display: "block", marginBottom: 8 }}>
            {t("partnerProfile.skills.proficiency")}
          </label>
          <select value={proficiency} onChange={e => setProficiency(e.target.value)} style={selectStyle}>
            <option value="">{t("partnerProfile.skills.profDefault")}</option>
            {PROFICIENCY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#475569", fontFamily: F, display: "block", marginBottom: 8 }}>
            {t("partnerProfile.skills.experience")}
          </label>
          <select value={experience} onChange={e => setExperience(e.target.value)} style={selectStyle}>
            <option value="">{t("partnerProfile.skills.expDefault")}</option>
            {EXPERIENCE_OPTIONS.map(ex => <option key={ex} value={ex}>{ex}</option>)}
          </select>
        </div>
      </div>

      {/* 직접 기술명 기입하기 */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 12, color: "#94A3B8", fontFamily: F, display: "block", marginBottom: 6 }}>
          {t("partnerProfile.skills.customLabel")}
        </label>
        <input
          type="text"
          value={customTech}
          onChange={e => setCustomTech(e.target.value)}
          placeholder={t("partnerProfile.skills.customPlaceholder")}
          style={{
            width: 260, padding: "9px 14px",
            border: "1.5px solid #E2E8F0", borderRadius: 10,
            fontSize: 13, color: "#1E293B", fontFamily: F,
            outline: "none", boxSizing: "border-box",
            transition: "border-color 0.15s",
          }}
          onFocus={e => e.target.style.borderColor = "#3B82F6"}
          onBlur={e => e.target.style.borderColor = "#E2E8F0"}
        />
      </div>

      {/* 저장 버튼 */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          style={{
            padding: "10px 32px", borderRadius: 10, border: "none",
            background: canSave
              ? "linear-gradient(135deg, #A5F3FC 0%, #22D3EE 60%, #5EEAD4 100%)"
              : "#F1F5F9",
            color: canSave ? "#164E63" : "#94A3B8",
            fontSize: 14, fontWeight: 700,
            cursor: canSave ? "pointer" : "default",
            fontFamily: F,
            boxShadow: canSave ? "0 3px 10px rgba(34,211,238,0.3)" : "none",
            transition: "all 0.2s",
          }}
        >
          {t("partnerProfile.skills.save")}
        </button>
      </div>
    </div>
  );
}

function SavedSkillCard({ skill, onEdit, onDelete }) {
  const color = SKILL_COLOR_MAP[skill.techName] || "#6366F1";
  const initials = skill.techName.length <= 3
    ? skill.techName.toUpperCase()
    : skill.techName.substring(0, 2).toUpperCase();
  const [delHov, setDelHov] = useState(false);
  const [editHov, setEditHov] = useState(false);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16,
      padding: "14px 20px", borderRadius: 12,
      border: "1.5px solid #E2E8F0", background: "white",
      marginBottom: 10,
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      {/* 기술 아이콘 뱃지 */}
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: color + "18",
        border: `1.5px solid ${color}44`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 800, color: color,
        flexShrink: 0, fontFamily: F, letterSpacing: "-0.02em",
      }}>
        {initials}
      </div>

      {/* 기술 정보 */}
      <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: "#1E293B", fontFamily: F }}>
        {skill.techName}
        <span style={{ color: "#CBD5E1", fontWeight: 400, margin: "0 8px" }}>|</span>
        <span style={{ color: "#475569", fontWeight: 500 }}>{skill.proficiency}</span>
        <span style={{ color: "#CBD5E1", fontWeight: 400, margin: "0 8px" }}>|</span>
        <span style={{ color: "#475569", fontWeight: 500 }}>{skill.experience}</span>
      </div>

      {/* 삭제 버튼 */}
      {onDelete && (
        <button
          onMouseEnter={() => setDelHov(true)}
          onMouseLeave={() => setDelHov(false)}
          onClick={onDelete}
          aria-label="삭제"
          style={{
            width: 33, height: 33, borderRadius: 8, border: "none",
            background: delHov ? "#FEE2E2" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", transition: "background 0.2s", flexShrink: 0,
          }}
        >
          <Trash2 size={14} color={delHov ? "#EF4444" : "#94A3B8"} />
        </button>
      )}

      {/* 수정 버튼 */}
      <button
        onMouseEnter={() => setEditHov(true)}
        onMouseLeave={() => setEditHov(false)}
        onClick={onEdit}
        aria-label="수정"
        style={{
          width: 33, height: 33, borderRadius: 8, border: "none",
          background: editHov ? "#DBEAFE" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", transition: "background 0.2s", flexShrink: 0,
        }}
      >
        <Pencil size={14} color={editHov ? "#3B82F6" : "#94A3B8"} />
      </button>
    </div>
  );
}

function SkillsTab() {
  const { partnerProfileDetail, updatePartnerProfileDetail, syncProfileDetailToServer } = useStore();
  const { t } = useLanguage();
  // hydration 시 id 누락/중복 방지 — undefined·null 또는 중복이면 인덱스 기반 보강.
  const initSkills = (partnerProfileDetail?.skills || []).length > 0
    ? (() => {
        const seen = new Set();
        return partnerProfileDetail.skills.map((s, i) => {
          let id = s.id;
          if (id == null || seen.has(id)) id = `skill-${Date.now()}-${i}`;
          seen.add(id);
          return { ...s, id, mode: "saved" };
        });
      })()
    : [{ id: 1, mode: "edit", techName: "", customTech: "", proficiency: "", experience: "" }];
  const [skills, setSkills] = useState(initSkills);
  const [globalSaved, setGlobalSaved] = useState(false);

  const addSkill = () => {
    setSkills(prev => [
      ...prev,
      { id: Date.now(), mode: "edit", techName: "", customTech: "", proficiency: "", experience: "" },
    ]);
  };

  const removeSkill = (id) => setSkills(prev => prev.filter(s => s.id !== id));

  const saveSkill = (id, data) => {
    setSkills(prev => prev.map(s => s.id === id ? { ...s, ...data, mode: "saved" } : s));
  };

  const editSkill = (id) => {
    setSkills(prev => prev.map(s => s.id === id ? { ...s, mode: "edit" } : s));
  };

  const handleGlobalSave = async () => {
    const toSave = skills.filter(s => s.mode === "saved").map(({ mode: _mode, ...rest }) => rest);
    updatePartnerProfileDetail({ skills: toSave });
    await syncProfileDetailToServer('partner');
    setGlobalSaved(true);
    setTimeout(() => setGlobalSaved(false), 2000);
  };

  return (
    <div>
      <h2 style={{ fontSize: 27, fontWeight: 900, background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", margin: "0 0 8px", fontFamily: F }}>
        {t("partnerProfile.skills.title")}
      </h2>
      <p style={{ fontSize: 14, color: "#64748B", margin: "0 0 28px", fontFamily: F, lineHeight: 1.7 }}>
        {t("partnerProfile.skills.desc")}
      </p>

      {/* 기술 카드 목록 */}
      {skills.map(skill =>
        skill.mode === "edit" ? (
          <SkillEditCard
            key={skill.id}
            skill={skill}
            onSave={(data) => saveSkill(skill.id, data)}
            onRemove={() => removeSkill(skill.id)}
          />
        ) : (
          <SavedSkillCard
            key={skill.id}
            skill={skill}
            onEdit={() => editSkill(skill.id)}
            onDelete={() => removeSkill(skill.id)}
          />
        )
      )}

      {/* + 보유기술 추가 버튼 */}
      <button
        onClick={addSkill}
        style={{
          width: "100%", padding: "16px",
          border: "2px dashed #CBD5E1", borderRadius: 14,
          background: "none", color: "#64748B",
          fontSize: 14, fontWeight: 600, cursor: "pointer",
          fontFamily: F, marginTop: 8, marginBottom: 28,
          transition: "border-color 0.15s, color 0.15s, background 0.15s",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = "#3B82F6";
          e.currentTarget.style.color = "#3B82F6";
          e.currentTarget.style.background = "#EFF6FF";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = "#CBD5E1";
          e.currentTarget.style.color = "#64748B";
          e.currentTarget.style.background = "none";
        }}
      >
        {t("partnerProfile.skills.addBtn")}
      </button>

      {/* 전체 설정 저장하기 */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleGlobalSave}
          style={{
            padding: "14px 32px", borderRadius: 12, border: "none",
            background: globalSaved
              ? "linear-gradient(135deg, #34D399 0%, #10B981 100%)"
              : "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)",
            color: "white", fontSize: 15, fontWeight: 700,
            cursor: "pointer", fontFamily: F,
            boxShadow: "0 4px 14px rgba(59,130,246,0.35)",
            transition: "background 0.3s",
          }}
        >
          {globalSaved ? t("partnerProfile.skills.savedAll") : t("partnerProfile.skills.saveAllBtn")}
        </button>
      </div>
    </div>
  );
}

/* ── 경력 탭 ─────────────────────────────────────────────────────────────────────────────────────── */
const CAREER_TYPE_OPTIONS = ["정규직", "계약직", "프리랜서", "인턴"];
const CAREER_ROLE_OPTIONS = ["기획", "디자인", "개발", "운영/PM"];
const CAREER_LEVEL_OPTIONS = ["신입", "주니어 (1~3년)", "미들 (4~7년)", "시니어 (8년 이상)"];

const inputStyle = {
  width: "100%", padding: "11px 14px",
  border: "1.5px solid #E2E8F0", borderRadius: 10,
  fontSize: 14, color: "#1E293B", fontFamily: F,
  outline: "none", boxSizing: "border-box",
  transition: "border-color 0.15s", background: "white",
};

const careerSelectStyle = {
  ...selectStyle,
  width: "100%",
};

function FieldLabel({ text, required }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", fontFamily: F, marginBottom: 8 }}>
      {text}{required && <span style={{ color: "#EF4444", marginLeft: 3 }}>*</span>}
    </div>
  );
}

function ProjectSubCard({ project, onRemove, onChange }) {
  return (
    <div style={{
      border: "1.5px solid #E2E8F0", borderRadius: 12,
      padding: "20px 20px 16px", background: "#FAFBFC",
      marginBottom: 10, position: "relative",
    }}>
      {/* X 버튼 */}
      <button
        onClick={onRemove}
        style={{
          position: "absolute", top: 12, right: 14,
          background: "none", border: "none",
          fontSize: 18, color: "#CBD5E1", cursor: "pointer",
          lineHeight: 1, padding: "2px 5px", borderRadius: 6,
          transition: "color 0.15s",
        }}
        onMouseEnter={e => e.currentTarget.style.color = "#EF4444"}
        onMouseLeave={e => e.currentTarget.style.color = "#CBD5E1"}
      >×</button>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
        <div>
          <FieldLabel text="프로젝트명" />
          <input
            type="text"
            value={project.name}
            placeholder="프로젝트 제목"
            onChange={e => onChange({ ...project, name: e.target.value })}
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = "#3B82F6"}
            onBlur={e => e.target.style.borderColor = "#E2E8F0"}
          />
        </div>
        <div>
          <FieldLabel text="수행 기간" />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="month"
              value={project.startDate}
              onChange={e => onChange({ ...project, startDate: e.target.value })}
              style={{ ...inputStyle, width: "calc(50% - 12px)", paddingRight: 8 }}
              onFocus={e => e.target.style.borderColor = "#3B82F6"}
              onBlur={e => e.target.style.borderColor = "#E2E8F0"}
            />
            <span style={{ color: "#94A3B8", fontWeight: 500 }}>~</span>
            <input
              type="month"
              value={project.endDate}
              onChange={e => onChange({ ...project, endDate: e.target.value })}
              style={{ ...inputStyle, width: "calc(50% - 12px)", paddingRight: 8 }}
              onFocus={e => e.target.style.borderColor = "#3B82F6"}
              onBlur={e => e.target.style.borderColor = "#E2E8F0"}
            />
          </div>
        </div>
      </div>

      <div>
        <FieldLabel text="주요 역할 및 성과" />
        <textarea
          value={project.description}
          onChange={e => onChange({ ...project, description: e.target.value })}
          placeholder="본인이 기여한 구체적인 역할과 기술적 성과를 입력해 주세요."
          style={{
            ...inputStyle,
            height: 100, resize: "vertical", display: "block", lineHeight: 1.7,
          }}
          onFocus={e => e.target.style.borderColor = "#3B82F6"}
          onBlur={e => e.target.style.borderColor = "#E2E8F0"}
        />
      </div>
    </div>
  );
}

function CareerCard({ career, onRemove, onChange }) {
  const addProject = () => {
    onChange({
      ...career,
      projects: [
        ...career.projects,
        { id: Date.now(), name: "", startDate: "", endDate: "", description: "" },
      ],
    });
  };

  const removeProject = (pid) => {
    onChange({ ...career, projects: career.projects.filter(p => p.id !== pid) });
  };

  const updateProject = (pid, updated) => {
    onChange({ ...career, projects: career.projects.map(p => p.id === pid ? updated : p) });
  };

  return (
    <div style={{
      border: "1.5px solid #E2E8F0", borderRadius: 16,
      padding: "24px 24px 20px", background: "white",
      marginBottom: 16, position: "relative",
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    }}>
      {/* 삭제 버튼 (휴지통) */}
      <button
        onClick={onRemove}
        title="경력 삭제"
        style={{
          position: "absolute", top: 16, right: 18,
          background: "none", border: "none",
          fontSize: 17, color: "#CBD5E1", cursor: "pointer",
          lineHeight: 1, padding: "4px 6px", borderRadius: 6,
          transition: "color 0.15s",
        }}
        onMouseEnter={e => e.currentTarget.style.color = "#EF4444"}
        onMouseLeave={e => e.currentTarget.style.color = "#CBD5E1"}
      >🗑</button>

      {/* 1행: 회사명 / 대표 기술 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div>
          <FieldLabel text="회사명" required />
          <div style={{ position: "relative" }}>
            <input
              type="text"
              value={career.company}
              placeholder="회사명을 입력해 주세요."
              onChange={e => onChange({ ...career, company: e.target.value })}
              style={{ ...inputStyle, paddingRight: career.verifiedCompany ? 96 : inputStyle.paddingRight }}
              onFocus={e => e.target.style.borderColor = "#3B82F6"}
              onBlur={e => e.target.style.borderColor = "#E2E8F0"}
            />
            {career.verifiedCompany && (
              <span
                title={`인증된 회사 이메일: ${career.verifiedEmail || ""}`}
                style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "4px 8px", borderRadius: 999,
                  background: "#DCFCE7", color: "#15803D",
                  fontSize: 11, fontWeight: 700, fontFamily: F, pointerEvents: "auto",
                  border: "1px solid #BBF7D0",
                }}
              >✓ 인증</span>
            )}
          </div>
        </div>
        <div>
          <FieldLabel text="대표 기술" required />
          <input
            type="text"
            value={career.mainTech}
            placeholder="예: 시니어 백엔드 개발자"
            onChange={e => onChange({ ...career, mainTech: e.target.value })}
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = "#3B82F6"}
            onBlur={e => e.target.style.borderColor = "#E2E8F0"}
          />
        </div>
      </div>

      {/* 2행: 재직 기간 / 경력 형태 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 10 }}>
        <div>
          <FieldLabel text="재직 기간" required />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="month"
              value={career.startDate}
              onChange={e => onChange({ ...career, startDate: e.target.value })}
              disabled={career.current}
              style={{
                ...inputStyle, width: "calc(50% - 12px)", paddingRight: 8,
                ...(career.current ? { background: "#F8FAFC", color: "#94A3B8" } : {}),
              }}
              onFocus={e => e.target.style.borderColor = "#3B82F6"}
              onBlur={e => e.target.style.borderColor = "#E2E8F0"}
            />
            <span style={{ color: "#94A3B8", fontWeight: 500 }}>~</span>
            <input
              type="month"
              value={career.endDate}
              onChange={e => onChange({ ...career, endDate: e.target.value })}
              disabled={career.current}
              style={{
                ...inputStyle, width: "calc(50% - 12px)", paddingRight: 8,
                ...(career.current ? { background: "#F8FAFC", color: "#94A3B8" } : {}),
              }}
              onFocus={e => e.target.style.borderColor = "#3B82F6"}
              onBlur={e => e.target.style.borderColor = "#E2E8F0"}
            />
          </div>
          {/* 현재 재직 중 체크박스 */}
          <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={career.current}
              onChange={e => onChange({ ...career, current: e.target.checked, endDate: "" })}
              style={{ width: 15, height: 15, accentColor: "#3B82F6", cursor: "pointer" }}
            />
            <span style={{ fontSize: 13, color: "#475569", fontFamily: F }}>현재 재직 중</span>
          </label>
        </div>
        <div>
          <FieldLabel text="경력 형태" required />
          <select
            value={career.type}
            onChange={e => onChange({ ...career, type: e.target.value })}
            style={careerSelectStyle}
          >
            <option value="">선택해 주세요</option>
            {CAREER_TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      {/* 3행: 역할 / 레벨 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div>
          <FieldLabel text="역할" required />
          <select
            value={career.role}
            onChange={e => onChange({ ...career, role: e.target.value })}
            style={careerSelectStyle}
          >
            <option value="">역할 선택</option>
            {CAREER_ROLE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <FieldLabel text="레벨" required />
          <select
            value={career.level}
            onChange={e => onChange({ ...career, level: e.target.value })}
            style={careerSelectStyle}
          >
            <option value="">레벨 선택</option>
            {CAREER_LEVEL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      {/* 주요 업무 설명 */}
      <div style={{ marginBottom: 24 }}>
        <FieldLabel text="주요 업무 설명" />
        <textarea
          value={career.description}
          onChange={e => onChange({ ...career, description: e.target.value })}
          placeholder="담당하셨던 업무에 대해 간략히 설명해 주세요."
          style={{
            ...inputStyle, height: 90, resize: "vertical",
            display: "block", lineHeight: 1.7,
          }}
          onFocus={e => e.target.style.borderColor = "#3B82F6"}
          onBlur={e => e.target.style.borderColor = "#E2E8F0"}
        />
      </div>

      {/* 수행 프로젝트 섹션 */}
      <div style={{
        background: "#F8FAFC", borderRadius: 12,
        padding: "18px 18px 14px",
        border: "1.5px solid #F1F5F9",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          marginBottom: 14, fontSize: 14, fontWeight: 700,
          color: "#475569", fontFamily: F,
        }}>
          <span>🗂</span> 수행 프로젝트
        </div>

        {career.projects.map(proj => (
          <ProjectSubCard
            key={proj.id}
            project={proj}
            onRemove={() => removeProject(proj.id)}
            onChange={(upd) => updateProject(proj.id, upd)}
          />
        ))}

        {/* + 프로젝트 추가 */}
        <button
          onClick={addProject}
          style={{
            width: "100%", padding: "13px",
            border: "1.5px dashed #3B82F6", borderRadius: 10,
            background: career.projects.length === 0 ? "#EFF6FF" : "white",
            color: "#3B82F6", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: F,
            transition: "background 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "#DBEAFE"}
          onMouseLeave={e => e.currentTarget.style.background = career.projects.length === 0 ? "#EFF6FF" : "white"}
        >
          + 프로젝트 추가
        </button>
      </div>
    </div>
  );
}

function CareerSavedCard({ career, onEdit, onDelete }) {
  const [hov, setHov] = useState(false);
  const [delHov, setDelHov] = useState(false);
  const fmt = (d) => d ? d.replace(/-/g, ".") : "";
  const period = career.current
    ? `${fmt(career.startDate)} ~ 현재`
    : [fmt(career.startDate), fmt(career.endDate)].filter(Boolean).join(" ~ ");
  const label = [career.company, career.mainTech, period].filter(Boolean).join(" | ");
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16,
      padding: "14px 20px", borderRadius: 14,
      border: "1.5px solid #F1F5F9", background: "white",
      marginBottom: 10,
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: "#FFF7ED", border: "1.5px solid #FED7AA",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20, flexShrink: 0,
      }}>💼</div>
      <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: "#1E293B", fontFamily: F }}>
        {label || "(미입력 경력)"}
      </div>
      {onDelete && (
        <button
          onMouseEnter={() => setDelHov(true)}
          onMouseLeave={() => setDelHov(false)}
          onClick={onDelete}
          aria-label="삭제"
          style={{
            width: 33, height: 33, borderRadius: 8, border: "none",
            background: delHov ? "#FEE2E2" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", transition: "background 0.2s", flexShrink: 0,
          }}
        >
          <Trash2 size={14} color={delHov ? "#EF4444" : "#94A3B8"} />
        </button>
      )}
      <button
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        onClick={onEdit}
        style={{
          width: 33, height: 33, borderRadius: 8, border: "none",
          background: hov ? "#DBEAFE" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", transition: "background 0.2s", flexShrink: 0,
        }}
      >
        <Pencil size={14} color={hov ? "#3B82F6" : "#94A3B8"} />
      </button>
    </div>
  );
}

function CareerTab() {
  const { partnerProfileDetail, updatePartnerProfileDetail, syncProfileDetailToServer } = useStore();
  const { t } = useLanguage();
  // hydration 시 id 누락/중복 방지
  const initCareers = (partnerProfileDetail?.careers || []).length > 0
    ? (() => {
        const seen = new Set();
        return partnerProfileDetail.careers.map((c, i) => {
          let id = c.id;
          if (id == null || seen.has(id)) id = `career-${Date.now()}-${i}`;
          seen.add(id);
          return { ...c, id, mode: "saved", company: c.companyName || c.company || "", mainTech: c.jobTitle || c.mainTech || "" };
        });
      })()
    : [{ id: 1, mode: "editing", company: "", mainTech: "", startDate: "", endDate: "", current: false, type: "", role: "", level: "", description: "", projects: [] }];
  const [careers, setCareers] = useState(initCareers);
  const [globalSaved, setGlobalSaved] = useState(false);

  const addCareer = () => {
    setCareers(prev => [...prev, {
      id: Date.now(),
      mode: "editing",
      company: "", mainTech: "",
      startDate: "", endDate: "", current: false,
      type: "", role: "", level: "", description: "",
      projects: [],
    }]);
  };

  const removeCareer = (id) => setCareers(prev => prev.filter(c => c.id !== id));
  const updateCareer = (id, updated) => setCareers(prev => prev.map(c => c.id === id ? updated : c));
  const startEditCareer = (id) => setCareers(prev => prev.map(c => c.id === id ? { ...c, mode: "editing" } : c));

  const handleGlobalSave = async () => {
    const next = careers.map(c => c.company.trim() ? { ...c, mode: "saved" } : c);
    setCareers(next);
    const toSave = next
      .filter(c => c.mode === "saved")
      .map(c => ({ ...c, companyName: c.company, jobTitle: c.mainTech }));
    updatePartnerProfileDetail({ careers: toSave });
    await syncProfileDetailToServer('partner');
    setGlobalSaved(true);
    setTimeout(() => setGlobalSaved(false), 2000);
  };

  return (
    <div>
      <h2 style={{ fontSize: 27, fontWeight: 900, background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", margin: "0 0 8px", fontFamily: F }}>
        {t("partnerProfile.career.title")}
      </h2>
      <p style={{ fontSize: 14, color: "#64748B", margin: "0 0 28px", fontFamily: F, lineHeight: 1.7 }}>
        {t("partnerProfile.career.desc")}
      </p>

      {careers.map(career => (
        career.mode === "saved" ? (
          <CareerSavedCard
            key={career.id}
            career={career}
            onEdit={() => startEditCareer(career.id)}
            onDelete={() => removeCareer(career.id)}
          />
        ) : (
          <CareerCard
            key={career.id}
            career={career}
            onRemove={() => removeCareer(career.id)}
            onChange={(upd) => updateCareer(career.id, upd)}
          />
        )
      ))}

      {/* + 경력 추가 */}
      <button
        onClick={addCareer}
        style={{
          width: "100%", padding: "28px 16px",
          border: "2px dashed #BFDBFE", borderRadius: 14,
          background: "#F8FBFF", color: "#3B82F6",
          cursor: "pointer", fontFamily: F,
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 10,
          marginBottom: 28,
          transition: "border-color 0.15s, background 0.15s",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "#3B82F6"; e.currentTarget.style.background = "#EFF6FF"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "#BFDBFE"; e.currentTarget.style.background = "#F8FBFF"; }}
      >
        <span style={{ fontSize: 26, lineHeight: 1 }}>⊕</span>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{t("partnerProfile.career.addBtn")}</span>
      </button>

      {/* 전체 설정 저장하기 */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleGlobalSave}
          style={{
            padding: "14px 32px", borderRadius: 12, border: "none",
            background: globalSaved
              ? "linear-gradient(135deg, #34D399 0%, #10B981 100%)"
              : "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)",
            color: "white", fontSize: 15, fontWeight: 700,
            cursor: "pointer", fontFamily: F,
            boxShadow: "0 4px 14px rgba(59,130,246,0.35)",
            transition: "background 0.3s",
          }}
        >
          {globalSaved ? t("partnerProfile.career.savedAll") : t("partnerProfile.career.saveAllBtn")}
        </button>
      </div>
    </div>
  );
}

/* ── 입학/졸업 년월 픽커 ─────────────────────────────────── */
function YearMonthPicker({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const yearListRef = useRef(null);

  const parts    = value ? value.split("-") : [];
  const selYear  = parts[0] ? parseInt(parts[0]) : null;
  const selMonth = parts[1] ? parseInt(parts[1]) : null;
  const [viewYear, setViewYear] = useState(() => selYear || new Date().getFullYear());

  const YEAR_START = 1940;
  const YEAR_END   = new Date().getFullYear() + 10;
  const YEARS = Array.from({ length: YEAR_END - YEAR_START + 1 }, (_, i) => YEAR_START + i);

  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  useEffect(() => {
    if (open && yearListRef.current) {
      const ROW_H = 34;
      yearListRef.current.scrollTop = Math.max(0, (viewYear - YEAR_START) * ROW_H - 90);
    }
  }, [open, viewYear]);

  const display   = selYear && selMonth ? `${selYear}년 ${String(selMonth).padStart(2,"0")}월` : "";
  const pickMonth = (m) => { onChange(`${viewYear}-${String(m).padStart(2,"0")}`); setOpen(false); };

  const fieldStyle = { width:"100%", padding:"11px 14px", borderRadius:10, border:"1.5px solid #E2E8F0",
    fontSize:14, fontWeight:500, color:"#1E293B", backgroundColor:disabled?"#F8FAFC":"white",
    fontFamily:F, outline:"none", boxSizing:"border-box", cursor:disabled?"default":"pointer",
    paddingRight:44 };

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <div style={{ position:"relative" }}>
        <input readOnly value={display} placeholder="----년 --월"
          onClick={() => !disabled && setOpen(o=>!o)}
          style={fieldStyle} />
        <span onClick={() => !disabled && setOpen(o=>!o)}
          style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)",
            fontSize:16, cursor:disabled?"default":"pointer", userSelect:"none", color:"#94A3B8" }}>🗓</span>
      </div>
      {open && (
        <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, zIndex:400,
          backgroundColor:"white", borderRadius:12, boxShadow:"0 8px 24px rgba(0,0,0,0.13)",
          border:"1px solid #E2E8F0", padding:"10px 8px", width:228, fontFamily:F }}>
          <div ref={yearListRef} style={{ height:148, overflowY:"auto", borderRadius:8,
            border:"1px solid #F1F5F9", marginBottom:8 }}>
            {YEARS.map(y => {
              const isSel  = y === selYear;
              const isView = y === viewYear;
              return (
                <div key={y} onClick={() => setViewYear(y)}
                  style={{ padding:"7px 12px", cursor:"pointer", fontSize:13,
                    fontWeight:isSel?700:400,
                    backgroundColor:isSel?"#3B82F6":isView&&!isSel?"#EFF6FF":"transparent",
                    color:isSel?"white":"#1E293B", transition:"background 0.1s" }}
                  onMouseEnter={e=>{if(!isSel)e.currentTarget.style.backgroundColor="#EFF6FF";}}
                  onMouseLeave={e=>{if(!isSel)e.currentTarget.style.backgroundColor=isView?"#EFF6FF":"transparent";}}>
                  {y}
                </div>
              );
            })}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:3, marginBottom:8 }}>
            {Array.from({length:12},(_,i)=>i+1).map(m => {
              const isSel = m===selMonth && viewYear===selYear;
              return (
                <div key={m} onClick={() => pickMonth(m)}
                  style={{ padding:"7px 2px", textAlign:"center", borderRadius:7, fontSize:13,
                    fontWeight:isSel?700:400,
                    backgroundColor:isSel?"#3B82F6":"transparent",
                    color:isSel?"white":"#1E293B",
                    cursor:"pointer", transition:"background 0.1s", border:"1px solid #F1F5F9" }}
                  onMouseEnter={e=>{if(!isSel)e.currentTarget.style.backgroundColor="#EFF6FF";}}
                  onMouseLeave={e=>{if(!isSel)e.currentTarget.style.backgroundColor="transparent";}}>
                  {m}
                </div>
              );
            })}
          </div>
          <div style={{ display:"flex", justifyContent:"space-between",
            borderTop:"1px solid #F1F5F9", paddingTop:6 }}>
            <button onClick={() => { onChange(""); setOpen(false); }}
              style={{ background:"none", border:"none", fontSize:12, color:"#EF4444", cursor:"pointer", fontFamily:F }}>삭제</button>
            <button onClick={() => {
              const t=new Date();
              onChange(`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}`);
              setOpen(false);
            }} style={{ background:"none", border:"none", fontSize:12, color:"#3B82F6", cursor:"pointer", fontFamily:F }}>이번 달</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 학력 입력 폼 ─────────────────────────────────────────── */
const EDU_FIELD = { width:"100%", padding:"11px 14px", borderRadius:10, border:"1.5px solid #E2E8F0",
  fontSize:14, color:"#1E293B", fontFamily:F, outline:"none", boxSizing:"border-box",
  transition:"border-color 0.15s", background:"white" };

function EducationForm({ formData, onChange, onSave, onCancel }) {
  const { schoolType } = formData;
  const isHigh       = schoolType === "고등학교";
  const isUniv       = schoolType === "대학교(4년)";
  const isGrad       = schoolType === "대학원(석사)" || schoolType === "대학원(박사)";
  const isUnivOrGrad = isUniv || isGrad;

  const selStyle = (val) => ({
    ...EDU_FIELD, appearance:"none", paddingRight:36, cursor:"pointer",
    color: val ? "#1E293B" : "#94A3B8",
  });

  return (
    <div style={{ border:"1.5px solid #E2E8F0", borderRadius:16, padding:"22px 22px 18px",
      background:"white", position:"relative", marginBottom:12 }}>
      <button onClick={onCancel}
        style={{ position:"absolute", top:12, right:12, width:28, height:28, borderRadius:"50%",
          border:"none", background:"transparent", cursor:"pointer", fontSize:18,
          color:"#CBD5E1", display:"flex", alignItems:"center", justifyContent:"center" }}
        onMouseEnter={e=>{e.currentTarget.style.backgroundColor="#F1F5F9";e.currentTarget.style.color="#475569";}}
        onMouseLeave={e=>{e.currentTarget.style.backgroundColor="transparent";e.currentTarget.style.color="#CBD5E1";}}>×</button>

      {/* 학교 구분 */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom: schoolType?18:0 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:"#1E293B", fontFamily:F, marginBottom:6 }}>
            학교 구분<span style={{ color:"#EF4444" }}>*</span></div>
          <div style={{ position:"relative" }}>
            <select value={schoolType} onChange={e=>onChange("schoolType",e.target.value)} style={selStyle(schoolType)}>
              <option value="">선택</option>
              <option>고등학교</option><option>대학교(4년)</option>
              <option>대학원(석사)</option><option>대학원(박사)</option>
            </select>
            <ChDown size={15} color="#94A3B8" style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} />
          </div>
        </div>
        <div style={{ display:"flex", alignItems: schoolType?"flex-end":"center", paddingBottom: schoolType?10:0 }}>
          <span style={{ fontSize:13, color:"#94A3B8", fontFamily:F }}>학교 구분에 따라 입력 항목이 변경됩니다.</span>
        </div>
      </div>

      {!schoolType && (
        <div style={{ textAlign:"center", padding:"22px 0 4px", color:"#CBD5E1", fontSize:14, fontFamily:F }}>학교 구분을 선택해 주세요.</div>
      )}

      {isHigh && (<>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:14 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#1E293B", fontFamily:F, marginBottom:6 }}>학교명<span style={{ color:"#EF4444" }}>*</span></div>
            <input value={formData.schoolName} onChange={e=>onChange("schoolName",e.target.value)} placeholder="학교명을 입력하세요" style={EDU_FIELD}
              onFocus={e=>e.target.style.borderColor="#3B82F6"} onBlur={e=>e.target.style.borderColor="#E2E8F0"} />
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#1E293B", fontFamily:F, marginBottom:6 }}>계열/전공</div>
            <input value={formData.track} onChange={e=>onChange("track",e.target.value)} placeholder="예: 인문계, 이공계, 예체능 등" style={EDU_FIELD}
              onFocus={e=>e.target.style.borderColor="#3B82F6"} onBlur={e=>e.target.style.borderColor="#E2E8F0"} />
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16, marginBottom:8 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#1E293B", fontFamily:F, marginBottom:6 }}>졸업 상태<span style={{ color:"#EF4444" }}>*</span></div>
            <div style={{ position:"relative" }}>
              <select value={formData.status} onChange={e=>onChange("status",e.target.value)} style={selStyle(formData.status)}>
                <option value="">선택</option><option>졸업</option><option>재학</option><option>중퇴</option>
              </select>
              <ChDown size={15} color="#94A3B8" style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} />
            </div>
          </div>
          <div><div style={{ fontSize:13, fontWeight:700, color:"#1E293B", fontFamily:F, marginBottom:6 }}>입학년월</div><YearMonthPicker value={formData.admissionDate} onChange={v=>onChange("admissionDate",v)} /></div>
          <div><div style={{ fontSize:13, fontWeight:700, color:"#1E293B", fontFamily:F, marginBottom:6 }}>졸업년월</div><YearMonthPicker value={formData.graduationDate} onChange={v=>onChange("graduationDate",v)} /></div>
        </div>
      </>)}

      {isUnivOrGrad && (<>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16, marginBottom:14 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#1E293B", fontFamily:F, marginBottom:6 }}>학교명<span style={{ color:"#EF4444" }}>*</span></div>
            <input value={formData.schoolName} onChange={e=>onChange("schoolName",e.target.value)} placeholder="학교명을 입력하세요" style={EDU_FIELD}
              onFocus={e=>e.target.style.borderColor="#3B82F6"} onBlur={e=>e.target.style.borderColor="#E2E8F0"} />
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#1E293B", fontFamily:F, marginBottom:6 }}>전공명<span style={{ color:"#EF4444" }}>*</span></div>
            <input value={formData.major} onChange={e=>onChange("major",e.target.value)} placeholder="전공명을 입력하세요" style={EDU_FIELD}
              onFocus={e=>e.target.style.borderColor="#3B82F6"} onBlur={e=>e.target.style.borderColor="#E2E8F0"} />
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#1E293B", fontFamily:F, marginBottom:6 }}>학위 종류<span style={{ color:"#EF4444" }}>*</span></div>
            <div style={{ position:"relative" }}>
              <select value={formData.degreeType} onChange={e=>onChange("degreeType",e.target.value)} style={selStyle(formData.degreeType)}>
                <option value="">선택</option>
                {isUniv && <><option>학사</option><option>전문학사</option></>}
                {isGrad && <><option>석사</option><option>박사</option><option>명예박사</option></>}
              </select>
              <ChDown size={15} color="#94A3B8" style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} />
            </div>
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16, marginBottom:14 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#1E293B", fontFamily:F, marginBottom:6 }}>졸업 상태<span style={{ color:"#EF4444" }}>*</span></div>
            <div style={{ position:"relative" }}>
              <select value={formData.status} onChange={e=>onChange("status",e.target.value)} style={selStyle(formData.status)}>
                <option value="">선택</option><option>졸업</option><option>재학</option><option>중퇴</option>
              </select>
              <ChDown size={15} color="#94A3B8" style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} />
            </div>
          </div>
          <div><div style={{ fontSize:13, fontWeight:700, color:"#1E293B", fontFamily:F, marginBottom:6 }}>입학년월</div><YearMonthPicker value={formData.admissionDate} onChange={v=>onChange("admissionDate",v)} /></div>
          <div><div style={{ fontSize:13, fontWeight:700, color:"#1E293B", fontFamily:F, marginBottom:6 }}>졸업년월</div><YearMonthPicker value={formData.graduationDate} onChange={v=>onChange("graduationDate",v)} /></div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:14 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#1E293B", fontFamily:F, marginBottom:6 }}>학점 (GPA)</div>
            <input value={formData.gpa} onChange={e=>onChange("gpa",e.target.value)} placeholder="0.00" type="number" min="0" max="5" step="0.01" style={EDU_FIELD}
              onFocus={e=>e.target.style.borderColor="#3B82F6"} onBlur={e=>e.target.style.borderColor="#E2E8F0"} />
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#1E293B", fontFamily:F, marginBottom:6 }}>기준 학점</div>
            <div style={{ position:"relative" }}>
              <select value={formData.gpaScale} onChange={e=>onChange("gpaScale",e.target.value)} style={{ ...EDU_FIELD, appearance:"none", paddingRight:36, cursor:"pointer" }}>
                <option>4.5</option><option>4.3</option><option>4.0</option><option>100</option>
              </select>
              <ChDown size={15} color="#94A3B8" style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} />
            </div>
          </div>
        </div>
      </>)}

      {isGrad && (
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#1E293B", fontFamily:F, marginBottom:6 }}>연구 주제 / 논문 제목</div>
          <input value={formData.researchTopic} onChange={e=>onChange("researchTopic",e.target.value)}
            placeholder="수행한 연구 주제 또는 논문 제목을 입력하세요" style={EDU_FIELD}
            onFocus={e=>e.target.style.borderColor="#3B82F6"} onBlur={e=>e.target.style.borderColor="#E2E8F0"} />
        </div>
      )}

      {schoolType && (
        <div style={{ display:"flex", justifyContent:"flex-end", marginTop:8 }}>
          <button onClick={onSave}
            style={{ padding:"10px 28px", borderRadius:10, border:"none",
              background:"#DBEAFE", fontSize:14, fontWeight:600, color:"#1e3a5f",
              cursor:"pointer", fontFamily:F, transition:"background 0.15s" }}
            onMouseEnter={e=>e.currentTarget.style.background="#BFDBFE"}
            onMouseLeave={e=>e.currentTarget.style.background="#DBEAFE"}>저장</button>
        </div>
      )}
    </div>
  );
}

/* ── 저장된 학력 요약 행 ──────────────────────────────────── */
function EducationItem({ item, onEdit, onDelete }) {
  const [editHov, setEditHov] = useState(false);
  const [delHov,  setDelHov]  = useState(false);
  const nameStr = item.schoolName + (item.major || item.track ? ` | ${item.major||item.track}` : "");
  const meta    = [item.schoolType, item.degreeType, item.status].filter(Boolean).join(" · ");
  return (
    <div style={{ display:"flex", alignItems:"center", padding:"14px 18px",
      backgroundColor:"white", borderRadius:14, border:"1.5px solid #F1F5F9",
      boxShadow:"0 1px 4px rgba(0,0,0,0.04)", marginBottom:10 }}>
      <div style={{ width:40, height:40, borderRadius:12, backgroundColor:"#EFF6FF",
        display:"flex", alignItems:"center", justifyContent:"center", marginRight:14, flexShrink:0 }}>
        <GraduationCap size={20} color="#3B82F6" />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:15, fontWeight:700, color:"#1E293B", fontFamily:F,
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
          display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ overflow:"hidden", textOverflow:"ellipsis" }}>{nameStr}</span>
          {item.verifiedSchool && (
            <span
              title={`인증된 학교 이메일: ${item.verifiedEmail || ""}`}
              style={{
                display:"inline-flex", alignItems:"center", gap:3,
                padding:"3px 8px", borderRadius:999,
                background:"#DCFCE7", color:"#15803D",
                fontSize:11, fontWeight:700, fontFamily:F,
                border:"1px solid #BBF7D0", flexShrink:0,
              }}
            >✓ 인증</span>
          )}
        </div>
        <div style={{ fontSize:13, color:"#94A3B8", fontFamily:F, marginTop:2 }}>{meta}</div>
      </div>
      <div style={{ display:"flex", gap:3, flexShrink:0 }}>
        <button onMouseEnter={()=>setEditHov(true)} onMouseLeave={()=>setEditHov(false)} onClick={()=>onEdit(item.id)}
          style={{ width:33, height:33, borderRadius:8, border:"none", cursor:"pointer",
            backgroundColor:editHov?"#DBEAFE":"transparent",
            display:"flex", alignItems:"center", justifyContent:"center", transition:"background 0.2s" }}>
          <Pencil size={14} color={editHov?"#3B82F6":"#94A3B8"} />
        </button>
        <button onMouseEnter={()=>setDelHov(true)} onMouseLeave={()=>setDelHov(false)} onClick={()=>onDelete(item.id)}
          style={{ width:33, height:33, borderRadius:8, border:"none", cursor:"pointer",
            backgroundColor:delHov?"#FEE2E2":"transparent",
            display:"flex", alignItems:"center", justifyContent:"center", transition:"background 0.2s" }}>
          <Trash2 size={14} color={delHov?"#EF4444":"#94A3B8"} />
        </button>
      </div>
    </div>
  );
}

/* ── 학력 탭 ─────────────────────────────────────────────── */
function EducationTab() {
  const { partnerProfileDetail, updatePartnerProfileDetail, syncProfileDetailToServer } = useStore();
  const { t } = useLanguage();
  // 인증 이메일이 있으면 같은 학교의 모든 학력에 retroactive 인증 마크 적용
  // (한/영 학교명 alias 매칭 — Korea University ↔ 고려대학교 등)
  const verifiedEmailObj = partnerProfileDetail?.verifiedEmail;
  const verifiedEmailStr = typeof verifiedEmailObj === "string"
    ? verifiedEmailObj
    : (verifiedEmailObj?.email || partnerProfileDetail?.verifiedEmailValue || "");
  const verifiedType = (typeof verifiedEmailObj === "object" ? verifiedEmailObj?.type : null)
    || partnerProfileDetail?.verifiedEmailType
    || (verifiedEmailStr ? "school" : null);
  const decorated = applyVerifiedSchool(
    partnerProfileDetail?.educations || [],
    verifiedEmailStr,
    verifiedType
  );
  // hydration 시 id 누락/중복 방지
  const initEducations = decorated.map((e, i) => (
    e.id != null ? e : { ...e, id: `edu-${Date.now()}-${i}` }
  ));
  const [savedEntries, setSavedEntries] = useState(initEducations);
  const [activeForms,  setActiveForms]  = useState([{ tempId:0, originalId:null, data: INIT_EDU() }]);
  const idCounter   = useRef((partnerProfileDetail?.educations?.length || 0) + 1);
  const tempCounter = useRef(1);

  function INIT_EDU() {
    return { schoolType:"", schoolName:"", track:"", major:"", degreeType:"",
      status:"", admissionDate:"", graduationDate:"", gpa:"", gpaScale:"4.5", researchTopic:"" };
  }

  const handleFormChange = (tempId, field, val) => {
    setActiveForms(prev => prev.map(f => f.tempId===tempId ? {...f, data:{...f.data,[field]:val}} : f));
  };

  const handleFormSave = (tempId) => {
    const form = activeForms.find(f => f.tempId===tempId);
    if (!form) return;
    const { data } = form;
    if (!data.schoolType || !data.schoolName.trim() || !data.status) return;
    if (form.originalId !== null) {
      setSavedEntries(prev => prev.map(e => e.id===form.originalId ? {...e,...data} : e));
    } else {
      setSavedEntries(prev => [...prev, { id:idCounter.current++, ...data }]);
    }
    setActiveForms(prev => prev.filter(f => f.tempId!==tempId));
  };

  const handleFormCancel = (tempId) => {
    setActiveForms(prev => prev.filter(f => f.tempId!==tempId));
  };

  const handleEdit = (entryId) => {
    const entry = savedEntries.find(e => e.id===entryId);
    if (!entry || activeForms.some(f=>f.originalId===entryId)) return;
    setActiveForms(prev => [...prev, { tempId:tempCounter.current++, originalId:entryId, data:{...entry} }]);
  };

  const handleDelete = (entryId) => {
    setSavedEntries(prev => prev.filter(e => e.id!==entryId));
  };

  const handleAddForm = () => {
    setActiveForms(prev => [...prev, { tempId:tempCounter.current++, originalId:null, data:INIT_EDU() }]);
  };

  const [saved, setSaved] = useState(false);
  const handleGlobalSave = async () => {
    updatePartnerProfileDetail({ educations: savedEntries });
    await syncProfileDetailToServer('partner');
    setSaved(true); setTimeout(()=>setSaved(false), 2000);
  };

  return (
    <div>
      <h2 style={{ fontSize:27, fontWeight:900, background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", margin:"0 0 8px", fontFamily:F }}>학력 관리</h2>
      <p style={{ fontSize:14, color:"#64748B", margin:"0 0 24px", fontFamily:F, lineHeight:1.7 }}>
        귀하의 학술적 배경을 입력하여 신뢰도를 높여보세요. 학교, 전공 및 학위 정보를 추가할 수 있습니다.
      </p>

      {savedEntries.map(entry => {
        const editForm = activeForms.find(f => f.originalId===entry.id);
        if (editForm) {
          return (<EducationForm key={editForm.tempId} formData={editForm.data}
            onChange={(field,val)=>handleFormChange(editForm.tempId,field,val)}
            onSave={()=>handleFormSave(editForm.tempId)}
            onCancel={()=>handleFormCancel(editForm.tempId)} />);
        }
        return (<EducationItem key={entry.id} item={entry} onEdit={handleEdit} onDelete={handleDelete} />);
      })}

      {activeForms.filter(f=>f.originalId===null).map(form => (
        <EducationForm key={form.tempId} formData={form.data}
          onChange={(field,val)=>handleFormChange(form.tempId,field,val)}
          onSave={()=>handleFormSave(form.tempId)}
          onCancel={()=>handleFormCancel(form.tempId)} />
      ))}

      <div onClick={handleAddForm}
        style={{ padding:"16px 0", border:"2px dashed #CBD5E1", borderRadius:14,
          display:"flex", alignItems:"center", justifyContent:"center",
          gap:8, cursor:"pointer", color:"#64748B", fontSize:14, fontWeight:600,
          backgroundColor:"white", transition:"all 0.15s", marginBottom:6 }}
        onMouseEnter={e=>{
          e.currentTarget.style.borderColor="#93C5FD";
          e.currentTarget.style.color="#3B82F6";
          e.currentTarget.style.backgroundColor="#EFF6FF";
        }}
        onMouseLeave={e=>{
          e.currentTarget.style.borderColor="#CBD5E1";
          e.currentTarget.style.color="#64748B";
          e.currentTarget.style.backgroundColor="white";
        }}>
        <span style={{ fontSize:20 }}>⊕</span> {t("education.addBtn")}
      </div>

      <div style={{ display:"flex", justifyContent:"flex-end", marginTop:20 }}>
        <button onClick={handleGlobalSave}
          style={{ padding:"14px 32px", borderRadius:12, border:"none",
            background: saved
              ? "linear-gradient(135deg, #34D399 0%, #10B981 100%)"
              : "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)",
            color:"white", fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:F,
            boxShadow:"0 4px 14px rgba(59,130,246,0.35)", transition:"background 0.3s" }}>
          {saved ? t("education.savedAll") : t("education.saveAllBtn")}
        </button>
      </div>
    </div>
  );
}

/* ── 자격증 날짜 픽커 ─────────────────────────────────────── */
function CertDatePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const today = new Date();

  const parseDate = (v) => {
    if (!v) return null;
    const [y, m, d] = v.split("-").map(Number);
    return isNaN(y) ? null : { year: y, month: m, day: d };
  };

  const sel = parseDate(value);
  const [viewYear, setViewYear] = useState(() => sel?.year || today.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => sel?.month || (today.getMonth() + 1));

  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const prevMonth = () => {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); }
    else setViewMonth(m => m + 1);
  };

  const getDays = () => {
    const firstDay = new Date(viewYear, viewMonth - 1, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
    const daysInPrev = new Date(viewYear, viewMonth - 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push({ day: daysInPrev - firstDay + 1 + i, type: "prev" });
    for (let i = 1; i <= daysInMonth; i++) cells.push({ day: i, type: "cur" });
    const rem = 42 - cells.length;
    for (let i = 1; i <= rem; i++) cells.push({ day: i, type: "next" });
    return cells;
  };

  const isTodayCell = (day, type) =>
    type === "cur" && viewYear === today.getFullYear() && viewMonth === (today.getMonth() + 1) && day === today.getDate();
  const isSelectedCell = (day, type) =>
    type === "cur" && sel && viewYear === sel.year && viewMonth === sel.month && day === sel.day;

  const pickDay = (day, type) => {
    let y = viewYear, m = viewMonth;
    if (type === "prev") { m = viewMonth === 1 ? 12 : viewMonth - 1; y = viewMonth === 1 ? viewYear - 1 : viewYear; }
    else if (type === "next") { m = viewMonth === 12 ? 1 : viewMonth + 1; y = viewMonth === 12 ? viewYear + 1 : viewYear; }
    onChange(`${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    setViewYear(y); setViewMonth(m);
    setOpen(false);
  };

  const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
  const navBtnStyle = {
    width: 28, height: 28, borderRadius: 8, border: "none",
    background: "transparent", cursor: "pointer", fontSize: 14,
    color: "#475569", display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background 0.15s",
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          readOnly
          value={value || ""}
          placeholder="연도-월-일"
          onClick={() => setOpen(o => !o)}
          style={{
            width: "100%", padding: "11px 14px", paddingRight: 42,
            border: "1.5px solid #E2E8F0", borderRadius: 10,
            fontSize: 14, color: value ? "#1E293B" : "#94A3B8",
            fontFamily: F, outline: "none", boxSizing: "border-box",
            cursor: "pointer", background: "white",
            transition: "border-color 0.15s",
          }}
          onFocus={e => e.target.style.borderColor = "#3B82F6"}
          onBlur={e => e.target.style.borderColor = "#E2E8F0"}
        />
        <span
          onClick={() => setOpen(o => !o)}
          style={{
            position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
            fontSize: 15, cursor: "pointer", userSelect: "none", color: "#94A3B8",
          }}>📅</span>
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 500,
          background: "white", borderRadius: 14,
          boxShadow: "0 8px 28px rgba(0,0,0,0.14)",
          border: "1px solid #E2E8F0", padding: "14px", width: 272,
          fontFamily: F,
        }}>
          {/* 헤더 */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>
              {viewYear}년 {String(viewMonth).padStart(2, "0")}월 ▾
            </div>
            <div style={{ display: "flex", gap: 2 }}>
              <button onClick={prevMonth} style={navBtnStyle}
                onMouseEnter={e => e.currentTarget.style.background = "#F1F5F9"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>↑</button>
              <button onClick={nextMonth} style={navBtnStyle}
                onMouseEnter={e => e.currentTarget.style.background = "#F1F5F9"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>↓</button>
            </div>
          </div>

          {/* 요일 헤더 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
            {WEEKDAYS.map(w => (
              <div key={w} style={{
                textAlign: "center", fontSize: 11, fontWeight: 700,
                color: "#94A3B8", padding: "4px 0",
              }}>{w}</div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
            {getDays().map((cell, i) => {
              const isSel = isSelectedCell(cell.day, cell.type);
              const isTod = isTodayCell(cell.day, cell.type);
              return (
                <div
                  key={i}
                  onClick={() => pickDay(cell.day, cell.type)}
                  style={{
                    textAlign: "center", padding: "7px 2px",
                    borderRadius: 8, cursor: "pointer",
                    fontSize: 13, fontWeight: isSel ? 700 : 400,
                    color: isSel ? "white" : cell.type !== "cur" ? "#CBD5E1" : isTod ? "#3B82F6" : "#1E293B",
                    background: isSel ? "#3B82F6" : isTod ? "#EFF6FF" : "transparent",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "#EFF6FF"; }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = isTod ? "#EFF6FF" : "transparent"; }}
                >
                  {cell.day}
                </div>
              );
            })}
          </div>

          {/* 하단 버튼 */}
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #F1F5F9", paddingTop: 8, marginTop: 8 }}>
            <button
              onClick={() => { onChange(""); setOpen(false); }}
              style={{ background: "none", border: "none", fontSize: 12, color: "#EF4444", cursor: "pointer", fontFamily: F }}
            >삭제</button>
            <button
              onClick={() => {
                const t = new Date();
                onChange(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`);
                setViewYear(t.getFullYear()); setViewMonth(t.getMonth() + 1);
                setOpen(false);
              }}
              style={{ background: "none", border: "none", fontSize: 12, color: "#3B82F6", cursor: "pointer", fontFamily: F }}
            >오늘</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 자격증 저장된 카드 ───────────────────────────────────── */
function CertSavedCard({ cert, onEdit, onDelete }) {
  const [hov, setHov] = useState(false);
  const [delHov, setDelHov] = useState(false);
  const displayDate = cert.date ? cert.date.replace(/-/g, ".") : "";
  const label = [cert.name, cert.org, displayDate].filter(Boolean).join(" | ");
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16,
      padding: "14px 20px", borderRadius: 14,
      border: "1.5px solid #F1F5F9", background: "white",
      marginBottom: 10,
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: "#FFFBEB", border: "1.5px solid #FDE68A",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20, flexShrink: 0,
      }}>🏅</div>
      <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: "#1E293B", fontFamily: F }}>
        {label}
      </div>
      {onDelete && (
        <button
          onMouseEnter={() => setDelHov(true)}
          onMouseLeave={() => setDelHov(false)}
          onClick={onDelete}
          aria-label="삭제"
          style={{
            width: 33, height: 33, borderRadius: 8, border: "none",
            background: delHov ? "#FEE2E2" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", transition: "background 0.2s", flexShrink: 0,
          }}
        >
          <Trash2 size={14} color={delHov ? "#EF4444" : "#94A3B8"} />
        </button>
      )}
      <button
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        onClick={onEdit}
        style={{
          width: 33, height: 33, borderRadius: 8, border: "none",
          background: hov ? "#DBEAFE" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", transition: "background 0.2s", flexShrink: 0,
        }}
      >
        <Pencil size={14} color={hov ? "#3B82F6" : "#94A3B8"} />
      </button>
    </div>
  );
}

/* ── 자격증 입력/수정 폼 ──────────────────────────────────── */
function CertEditCard({ cert, onSave, onCancel }) {
  const [name, setName] = useState(cert.name || "");
  const [org, setOrg] = useState(cert.org || "");
  const [date, setDate] = useState(cert.date || "");
  const canSave = name.trim() && org.trim() && date;

  const certInputStyle = {
    width: "100%", padding: "11px 14px",
    border: "1.5px solid #E2E8F0", borderRadius: 10,
    fontSize: 14, color: "#1E293B", fontFamily: F,
    outline: "none", boxSizing: "border-box",
    transition: "border-color 0.15s", background: "white",
  };

  return (
    <div style={{
      border: "1.5px solid #E2E8F0", borderRadius: 14,
      padding: "22px 22px 18px", background: "white",
      marginBottom: 12, position: "relative",
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    }}>
      {onCancel && (
        <button
          onClick={onCancel}
          style={{
            position: "absolute", top: 12, right: 14,
            background: "none", border: "none",
            fontSize: 20, color: "#CBD5E1", cursor: "pointer",
            lineHeight: 1, padding: "2px 6px", borderRadius: 6,
            transition: "color 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.color = "#EF4444"}
          onMouseLeave={e => e.currentTarget.style.color = "#CBD5E1"}
        >×</button>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", fontFamily: F, marginBottom: 8 }}>
            자격증명 <span style={{ color: "#EF4444" }}>*</span>
          </div>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="예: 정보처리기사"
            style={certInputStyle}
            onFocus={e => e.target.style.borderColor = "#3B82F6"}
            onBlur={e => e.target.style.borderColor = "#E2E8F0"}
          />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", fontFamily: F, marginBottom: 8 }}>
            기관명 <span style={{ color: "#EF4444" }}>*</span>
          </div>
          <input
            type="text"
            value={org}
            onChange={e => setOrg(e.target.value)}
            placeholder="예: 한국산업인력공단"
            style={certInputStyle}
            onFocus={e => e.target.style.borderColor = "#3B82F6"}
            onBlur={e => e.target.style.borderColor = "#E2E8F0"}
          />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", fontFamily: F, marginBottom: 8 }}>
            취득일 <span style={{ color: "#EF4444" }}>*</span>
          </div>
          <CertDatePicker value={date} onChange={setDate} />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => { if (canSave) onSave({ name: name.trim(), org: org.trim(), date }); }}
          disabled={!canSave}
          style={{
            padding: "10px 28px", borderRadius: 10, border: "none",
            background: canSave ? "#DBEAFE" : "#F1F5F9",
            color: canSave ? "#1e3a5f" : "#94A3B8",
            fontSize: 14, fontWeight: 600,
            cursor: canSave ? "pointer" : "default",
            fontFamily: F, transition: "background 0.15s",
          }}
          onMouseEnter={e => { if (canSave) e.currentTarget.style.background = "#BFDBFE"; }}
          onMouseLeave={e => { if (canSave) e.currentTarget.style.background = "#DBEAFE"; }}
        >저장</button>
      </div>
    </div>
  );
}

/* ── 자격증 탭 ───────────────────────────────────────────── */
function CertificatesTab() {
  const { partnerProfileDetail, updatePartnerProfileDetail, syncProfileDetailToServer } = useStore();
  const { t } = useLanguage();
  // hydration 시 id 누락/중복 방지
  const initCerts = (partnerProfileDetail?.certifications || []).length > 0
    ? (() => {
        const seen = new Set();
        return partnerProfileDetail.certifications.map((c, i) => {
          let id = c.id;
          if (id == null || seen.has(id)) id = `cert-${Date.now()}-${i}`;
          seen.add(id);
          return { id, mode: "saved", name: c.certName || c.name, org: c.issuer || c.org, date: c.acquiredDate || c.date };
        });
      })()
    : [];
  const [certs, setCerts] = useState(initCerts);
  const [forms, setForms] = useState([]);
  const idCounter = useRef(initCerts.length + 1);
  const formCounter = useRef(1);
  const [globalSaved, setGlobalSaved] = useState(false);

  const startEdit = (id) => setCerts(prev => prev.map(c => c.id === id ? { ...c, mode: "editing" } : c));
  const saveCert = (id, data) => setCerts(prev => prev.map(c => c.id === id ? { ...c, ...data, mode: "saved" } : c));
  const cancelEdit = (id) => setCerts(prev => prev.map(c => c.id === id ? { ...c, mode: "saved" } : c));
  const saveNewForm = (fid, data) => {
    setCerts(prev => [...prev, { id: idCounter.current++, mode: "saved", ...data }]);
    setForms(prev => prev.filter(f => f.id !== fid));
  };
  const removeForm = (fid) => setForms(prev => prev.filter(f => f.id !== fid));
  const addForm = () => setForms(prev => [...prev, { id: formCounter.current++ }]);
  const deleteCert = (id) => setCerts(prev => prev.filter(c => c.id !== id));
  const handleGlobalSave = async () => {
    const toSave = certs.filter(c => c.mode === "saved").map(c => ({ id: c.id, certName: c.name, issuer: c.org, acquiredDate: c.date }));
    updatePartnerProfileDetail({ certifications: toSave });
    await syncProfileDetailToServer('partner');
    setGlobalSaved(true); setTimeout(() => setGlobalSaved(false), 2000);
  };

  return (
    <div>
      <h2 style={{ fontSize: 27, fontWeight: 900, background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", margin: "0 0 8px", fontFamily: F }}>
        {t("partnerProfile.cert.title")}
      </h2>
      <p style={{ fontSize: 14, color: "#64748B", margin: "0 0 24px", fontFamily: F, lineHeight: 1.7 }}>
        {t("partnerProfile.cert.desc")}
      </p>

      {certs.map(cert =>
        cert.mode === "editing" ? (
          <CertEditCard
            key={cert.id}
            cert={cert}
            onSave={(data) => saveCert(cert.id, data)}
            onCancel={() => cancelEdit(cert.id)}
          />
        ) : (
          <CertSavedCard key={cert.id} cert={cert} onEdit={() => startEdit(cert.id)} onDelete={() => deleteCert(cert.id)} />
        )
      )}

      {forms.map(form => (
        <CertEditCard
          key={form.id}
          cert={{ name: "", org: "", date: "" }}
          onSave={(data) => saveNewForm(form.id, data)}
          onCancel={() => removeForm(form.id)}
        />
      ))}

      {/* 자격증 추가 버튼 */}
      <button
        onClick={addForm}
        style={{
          width: "100%", padding: "16px",
          border: "2px dashed #CBD5E1", borderRadius: 14,
          background: "white", color: "#64748B",
          fontSize: 14, fontWeight: 600, cursor: "pointer",
          fontFamily: F, marginBottom: 28,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          transition: "border-color 0.15s, color 0.15s, background 0.15s",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = "#3B82F6";
          e.currentTarget.style.color = "#3B82F6";
          e.currentTarget.style.background = "#EFF6FF";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = "#CBD5E1";
          e.currentTarget.style.color = "#64748B";
          e.currentTarget.style.background = "white";
        }}
      >
        <span style={{ fontSize: 18 }}>⊕</span> {t("partnerProfile.cert.addBtn")}
      </button>

      {/* 전체 설정 저장하기 */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleGlobalSave}
          style={{
            padding: "14px 32px", borderRadius: 12, border: "none",
            background: globalSaved
              ? "linear-gradient(135deg, #34D399 0%, #10B981 100%)"
              : "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)",
            color: "white", fontSize: 15, fontWeight: 700,
            cursor: "pointer", fontFamily: F,
            boxShadow: "0 4px 14px rgba(59,130,246,0.35)",
            transition: "background 0.3s",
          }}
        >
          {globalSaved ? t("partnerProfile.cert.savedAll") : t("partnerProfile.cert.saveAllBtn")}
        </button>
      </div>
    </div>
  );
}

/* ── 클라이언트 평가 탭 ───────────────────────────────────── */
const REVIEW_DATA = [
  {
    id: 1, type: "유료",
    title: "이커머스 플랫폼 모바일 앱 리뉴얼",
    tags: ["#UI/UX", "#Mobile", "#React_Native"],
    client: "Shop & Go", clientBg: "#374151",
    rating: 4.8, date: "2024.10.15",
    scores: { expertise: 4.8, schedule: 5.0, communication: 5.0, proactivity: 4.5 },
    budget: "₩8,000,000", duration: "2개월",
    description: "대규모 이커머스 플랫폼의 메인 앱 UI/UX를 전면 개편하고 성능을 최적화하는 프로젝트입니다. 사용자 행동 분석을 통한 디자인 개선이 핵심이었습니다.",
    review: "UI/UX 감각이 뛰어나시고 사용자 입장에서 많은 고민을 해주셨습니다. 일정 준수도 완벽했고 소통이 매우 원활했습니다.",
  },
  {
    id: 2, type: "유료",
    title: "메타버스 협업 툴 시각화 모듈 개발",
    tags: ["#Unity", "#3D", "#Optimization"],
    client: "Meta-Connect", clientBg: "#1E293B",
    rating: 5.0, date: "2024.09.28",
    scores: { expertise: 5.0, schedule: 5.0, communication: 5.0, proactivity: 5.0 },
    budget: "₩25,000,000", duration: "4개월",
    description: "웹 기반 메타버스 환경에서의 실시간 데이터 시각화 및 3D 렌더링 최적화 모듈을 개발하는 고난이도 기술 프로젝트입니다.",
    review: "어려운 기술적 요구사항도 척척 해결해주셨습니다. 3D 렌더링 최적화 부분에서 보여주신 실력이 정말 대단하십니다. 강력 추천합니다!",
  },
  {
    id: 3, type: "유료",
    title: "AI 기반 이상 거래 탐지 시스템 고도화",
    tags: ["#AI/ML", "#Python", "#TensorFlow"],
    client: "K-Finance Tech", clientBg: "#111827",
    rating: 5.0, date: "2024.11.20",
    scores: { expertise: 5.0, schedule: 5.0, communication: 5.0, proactivity: 5.0 },
    budget: "₩15,000,000", duration: "3개월",
    description: "실시간으로 유입되는 결제 데이터를 분석하여 이상 징후를 감지하는 딥러닝 모델 개발 및 기존 인프라 연동 프로젝트입니다. 정밀도 향상을 위한 핵심 알고리즘 튜닝이 포함되었습니다.",
    review: "전문적인 지식과 빠른 피드백 덕분에 프로젝트가 기대 이상으로 성공적으로 마무리되었습니다. 특히 AI 모델의 정확도를 기대 수치보다 15% 이상 높여주신 점이 매우 인상적입니다. 차후 고도화 작업에서도 꼭 다시 모시고 싶은 최고의 파트너입니다.",
  },
];

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

function DonutChart() {
  const r = 72, cx = 92, cy = 92, sw = 26;
  const C = 2 * Math.PI * r;
  const segments = [
    { label: "AI/ML",  pct: 42, id: "dc_aiml",   c1: "#BFDBFE", c2: "#3B82F6" },
    { label: "Web",    pct: 35, id: "dc_web",    c1: "#DBEAFE", c2: "#60A5FA" },
    { label: "Mobile", pct: 18, id: "dc_mobile", c1: "#F1F5F9", c2: "#94A3B8" },
    { label: "Others", pct:  5, id: "dc_others", c1: "#F8FAFC", c2: "#CBD5E1" },
  ];
  let cum = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, width: "100%" }}>
      <svg viewBox="0 0 184 184" style={{ width: "58%", height: "auto", flexShrink: 0 }}>
        <defs>
          {segments.map(seg => (
            <linearGradient key={seg.id} id={seg.id} gradientUnits="userSpaceOnUse" x1="184" y1="0" x2="0" y2="184">
              <stop offset="0%" stopColor={seg.c1} />
              <stop offset="100%" stopColor={seg.c2} />
            </linearGradient>
          ))}
        </defs>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F1F5F9" strokeWidth={sw + 2} />
        {segments.map((seg, i) => {
          const len = (seg.pct / 100) * C;
          const offset = C - cum;
          cum += len;
          return (
            <circle key={i}
              cx={cx} cy={cy} r={r} fill="none"
              stroke={`url(#${seg.id})`} strokeWidth={sw}
              strokeDasharray={`${len} ${C}`}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              opacity={0.88}
            />
          );
        })}
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize={11} fontWeight={800} fill="#475569" fontFamily={F}>PROJECTS</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize={9.5} fontWeight={500} fill="#94A3B8" fontFamily={F}>분야별</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 13, flex: 1 }}>
        {segments.map(seg => (
          <div key={seg.label} style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: `linear-gradient(135deg, ${seg.c1}, ${seg.c2})`, flexShrink: 0 }} />
            <span style={{ fontSize: 13.5, color: "#475569", fontFamily: F, fontWeight: 500 }}>{seg.label} {seg.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

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

function ReviewCard({ review }) {
  return (
    <div style={{
      background: "white", borderRadius: 18,
      border: "1.5px solid #F1F5F9",
      padding: "24px 28px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      marginBottom: 16,
    }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", flex: 1 }}>
          <span style={{
            padding: "3px 10px", borderRadius: 6,
            background: "#EFF6FF", border: "1px solid #BFDBFE",
            fontSize: 12, fontWeight: 700, color: "#3B82F6", fontFamily: F, flexShrink: 0,
          }}>{review.type}</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#1E293B", fontFamily: F }}>{review.title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: "50%",
            background: review.clientBg,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <span style={{ fontSize: 13, color: "white", fontWeight: 700, fontFamily: F }}>{review.client.charAt(0)}</span>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#374151", fontFamily: F, whiteSpace: "nowrap" }}>{review.client}</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#1E293B", fontFamily: F }}>{review.rating.toFixed(1)}</span>
          <StarRating rating={review.rating} size={15} />
          <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: F, whiteSpace: "nowrap" }}>{review.date} 완료</span>
        </div>
      </div>

      {/* 태그 */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {review.tags.map(tag => (
          <span key={tag} style={{
            padding: "4px 10px", borderRadius: 6,
            background: "#F8FAFC", border: "1px solid #E2E8F0",
            fontSize: 12, fontWeight: 500, color: "#64748B", fontFamily: F,
          }}>{tag}</span>
        ))}
      </div>

      {/* 4열 점수 바 */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 20,
        paddingBottom: 18, marginBottom: 18, borderBottom: "1px solid #F1F5F9",
      }}>
        <MiniRatingBar label="전문성" value={review.scores.expertise} />
        <MiniRatingBar label="일정 준수" value={review.scores.schedule} />
        <MiniRatingBar label="소통 능력" value={review.scores.communication} />
        <MiniRatingBar label="적극성" value={review.scores.proactivity} />
      </div>

      {/* 예산/기간 + 설명 */}
      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 24, marginBottom: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.1em", fontFamily: F, marginBottom: 4 }}>BUDGET</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                width: 22, height: 22, borderRadius: 6, background: "#EFF6FF",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, flexShrink: 0,
              }}>💰</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#1E293B", fontFamily: F }}>{review.budget}</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.1em", fontFamily: F, marginBottom: 4 }}>DURATION</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                width: 22, height: 22, borderRadius: 6, background: "#F0FFF4",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, flexShrink: 0,
              }}>📅</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#1E293B", fontFamily: F }}>{review.duration}</span>
            </div>
          </div>
        </div>
        <p style={{ fontSize: 14, color: "#475569", fontFamily: F, lineHeight: 1.75, margin: 0 }}>
          {review.description}
        </p>
      </div>

      {/* 인용 후기 */}
      <div style={{
        background: "#F8FAFC", borderRadius: 12,
        padding: "14px 20px",
        borderLeft: "4px solid #BFDBFE",
      }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: "#93C5FD", lineHeight: 0.9, marginBottom: 6, fontFamily: F }}>❝</div>
        <p style={{ fontSize: 14, color: "#475569", fontFamily: F, lineHeight: 1.75, margin: 0, fontStyle: "italic" }}>
          {review.review}
        </p>
      </div>
    </div>
  );
}

/* ── 수상이력 저장된 카드 ─────────────────────────────────── */
function AwardSavedCard({ award, onEdit, onDelete }) {
  const [hov, setHov] = useState(false);
  const [delHov, setDelHov] = useState(false);
  const displayDate = award.date ? award.date.replace(/-/g, ".") : "";
  const label = [award.name, award.org, displayDate].filter(Boolean).join(" | ");
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16,
      padding: "14px 20px", borderRadius: 14,
      border: "1.5px solid #F1F5F9", background: "white",
      marginBottom: 10,
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: "#FFF7ED", border: "1.5px solid #FED7AA",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20, flexShrink: 0,
      }}>🏆</div>
      <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: "#1E293B", fontFamily: F }}>
        {label}
      </div>
      {onDelete && (
        <button
          onMouseEnter={() => setDelHov(true)}
          onMouseLeave={() => setDelHov(false)}
          onClick={onDelete}
          aria-label="삭제"
          style={{
            width: 33, height: 33, borderRadius: 8, border: "none",
            background: delHov ? "#FEE2E2" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", transition: "background 0.2s", flexShrink: 0,
          }}
        >
          <Trash2 size={14} color={delHov ? "#EF4444" : "#94A3B8"} />
        </button>
      )}
      <button
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        onClick={onEdit}
        style={{
          width: 33, height: 33, borderRadius: 8, border: "none",
          background: hov ? "#DBEAFE" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", transition: "background 0.2s", flexShrink: 0,
        }}
      >
        <Pencil size={14} color={hov ? "#3B82F6" : "#94A3B8"} />
      </button>
    </div>
  );
}

/* ── 수상이력 입력/수정 폼 ─────────────────────────────────── */
function AwardEditCard({ award, onSave, onCancel }) {
  const [name, setName] = useState(award.name || "");
  const [org, setOrg] = useState(award.org || "");
  const [date, setDate] = useState(award.date || "");
  const [desc, setDesc] = useState(award.desc || "");
  const canSave = name.trim() && org.trim() && date;

  const awardInputStyle = {
    width: "100%", padding: "11px 14px",
    border: "1.5px solid #E2E8F0", borderRadius: 10,
    fontSize: 14, color: "#1E293B", fontFamily: F,
    outline: "none", boxSizing: "border-box",
    transition: "border-color 0.15s", background: "white",
  };

  return (
    <div style={{
      border: "1.5px solid #E2E8F0", borderRadius: 14,
      padding: "22px 22px 18px", background: "white",
      marginBottom: 12, position: "relative",
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    }}>
      {onCancel && (
        <button
          onClick={onCancel}
          style={{
            position: "absolute", top: 12, right: 14,
            background: "none", border: "none",
            fontSize: 20, color: "#CBD5E1", cursor: "pointer",
            lineHeight: 1, padding: "2px 6px", borderRadius: 6,
            transition: "color 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.color = "#EF4444"}
          onMouseLeave={e => e.currentTarget.style.color = "#CBD5E1"}
        >×</button>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", fontFamily: F, marginBottom: 8 }}>
            상훈명 <span style={{ color: "#EF4444" }}>*</span>
          </div>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="예: 00공모전 금상"
            style={awardInputStyle}
            onFocus={e => e.target.style.borderColor = "#3B82F6"}
            onBlur={e => e.target.style.borderColor = "#E2E8F0"}
          />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", fontFamily: F, marginBottom: 8 }}>
            수여기관 <span style={{ color: "#EF4444" }}>*</span>
          </div>
          <input
            type="text"
            value={org}
            onChange={e => setOrg(e.target.value)}
            placeholder="예: 00대학교"
            style={awardInputStyle}
            onFocus={e => e.target.style.borderColor = "#3B82F6"}
            onBlur={e => e.target.style.borderColor = "#E2E8F0"}
          />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", fontFamily: F, marginBottom: 8 }}>
            수상일 <span style={{ color: "#EF4444" }}>*</span>
          </div>
          <CertDatePicker value={date} onChange={setDate} />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", fontFamily: F, marginBottom: 8 }}>
          수상 내역 및 역할 (최대 500자)
        </div>
        <textarea
          value={desc}
          onChange={e => { if (e.target.value.length <= 500) setDesc(e.target.value); }}
          placeholder="수상에 기여한 역할이나 구체적인 내역을 입력해주세요."
          style={{
            ...awardInputStyle,
            minHeight: 110, resize: "vertical",
            lineHeight: 1.7, paddingTop: 12,
          }}
          onFocus={e => e.target.style.borderColor = "#3B82F6"}
          onBlur={e => e.target.style.borderColor = "#E2E8F0"}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => { if (canSave) onSave({ name: name.trim(), org: org.trim(), date, desc }); }}
          disabled={!canSave}
          style={{
            padding: "10px 28px", borderRadius: 10, border: "none",
            background: canSave ? "#DBEAFE" : "#F1F5F9",
            color: canSave ? "#1e3a5f" : "#94A3B8",
            fontSize: 14, fontWeight: 600,
            cursor: canSave ? "pointer" : "default",
            fontFamily: F, transition: "background 0.15s",
          }}
          onMouseEnter={e => { if (canSave) e.currentTarget.style.background = "#BFDBFE"; }}
          onMouseLeave={e => { if (canSave) e.currentTarget.style.background = "#DBEAFE"; }}
        >저장</button>
      </div>
    </div>
  );
}

/* ── 수상이력 탭 ──────────────────────────────────────────── */
function AwardsTab() {
  const { partnerProfileDetail, updatePartnerProfileDetail, syncProfileDetailToServer } = useStore();
  const { t } = useLanguage();
  // hydration 시 id 누락/중복 방지
  const initAwards = (partnerProfileDetail?.awards || []).length > 0
    ? (() => {
        const seen = new Set();
        return partnerProfileDetail.awards.map((a, i) => {
          let id = a.id;
          if (id == null || seen.has(id)) id = `award-${Date.now()}-${i}`;
          seen.add(id);
          return { id, mode: "saved", name: a.awardName || a.name, org: a.awarding || a.org, date: a.awardDate || a.date, desc: a.description || a.desc || "" };
        });
      })()
    : [];
  const [awards, setAwards] = useState(initAwards);
  const [forms, setForms] = useState([{ id: 1 }]);
  const idCounter = useRef(initAwards.length + 1);
  const formCounter = useRef(2);
  const [globalSaved, setGlobalSaved] = useState(false);

  const startEdit = (id) => setAwards(prev => prev.map(a => a.id === id ? { ...a, mode: "editing" } : a));
  const saveAward = (id, data) => setAwards(prev => prev.map(a => a.id === id ? { ...a, ...data, mode: "saved" } : a));
  const cancelEdit = (id) => setAwards(prev => prev.map(a => a.id === id ? { ...a, mode: "saved" } : a));
  const saveNewForm = (fid, data) => {
    setAwards(prev => [...prev, { id: idCounter.current++, mode: "saved", ...data }]);
    setForms(prev => prev.filter(f => f.id !== fid));
  };
  const removeForm = (fid) => setForms(prev => prev.filter(f => f.id !== fid));
  const addForm = () => setForms(prev => [...prev, { id: formCounter.current++ }]);
  const deleteAward = (id) => setAwards(prev => prev.filter(a => a.id !== id));
  const handleGlobalSave = async () => {
    const toSave = awards.filter(a => a.mode === "saved").map(a => ({ id: a.id, awardName: a.name, awarding: a.org, awardDate: a.date, description: a.desc }));
    updatePartnerProfileDetail({ awards: toSave });
    await syncProfileDetailToServer('partner');
    setGlobalSaved(true); setTimeout(() => setGlobalSaved(false), 2000);
  };

  return (
    <div>
      <h2 style={{ fontSize: 27, fontWeight: 900, background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", margin: "0 0 8px", fontFamily: F }}>
        {t("partnerProfile.awards.title")}
      </h2>
      <p style={{ fontSize: 14, color: "#64748B", margin: "0 0 24px", fontFamily: F, lineHeight: 1.7 }}>
        {t("partnerProfile.awards.desc")}
      </p>

      {awards.map(award =>
        award.mode === "editing" ? (
          <AwardEditCard
            key={award.id}
            award={award}
            onSave={(data) => saveAward(award.id, data)}
            onCancel={() => cancelEdit(award.id)}
          />
        ) : (
          <AwardSavedCard key={award.id} award={award} onEdit={() => startEdit(award.id)} onDelete={() => deleteAward(award.id)} />
        )
      )}

      {forms.map(form => (
        <AwardEditCard
          key={form.id}
          award={{ name: "", org: "", date: "", desc: "" }}
          onSave={(data) => saveNewForm(form.id, data)}
          onCancel={forms.length > 1 || awards.length > 0 ? () => removeForm(form.id) : null}
        />
      ))}

      {/* 수상이력 추가 버튼 */}
      <button
        onClick={addForm}
        style={{
          width: "100%", padding: "16px",
          border: "2px dashed #CBD5E1", borderRadius: 14,
          background: "white", color: "#64748B",
          fontSize: 14, fontWeight: 600, cursor: "pointer",
          fontFamily: F, marginBottom: 28,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          transition: "border-color 0.15s, color 0.15s, background 0.15s",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = "#3B82F6";
          e.currentTarget.style.color = "#3B82F6";
          e.currentTarget.style.background = "#EFF6FF";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = "#CBD5E1";
          e.currentTarget.style.color = "#64748B";
          e.currentTarget.style.background = "white";
        }}
      >
        <span style={{ fontSize: 18 }}>⊕</span> {t("partnerProfile.awards.addBtn")}
      </button>

      {/* 전체 설정 저장하기 */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleGlobalSave}
          style={{
            padding: "14px 32px", borderRadius: 12, border: "none",
            background: globalSaved
              ? "linear-gradient(135deg, #34D399 0%, #10B981 100%)"
              : "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)",
            color: "white", fontSize: 15, fontWeight: 700,
            cursor: "pointer", fontFamily: F,
            boxShadow: "0 4px 14px rgba(59,130,246,0.35)",
            transition: "background 0.3s",
          }}
        >
          {globalSaved ? t("partnerProfile.awards.savedAll") : t("partnerProfile.awards.saveAllBtn")}
        </button>
      </div>
    </div>
  );
}

/* ── 클라이언트 평가 탭 ───────────────────────────────────── */
function ReviewsTab() {
  const { t } = useLanguage();
  return (
    <div>
      {/* 타이틀 + 전체 보기 */}
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
        }}>{t("partnerProfile.reviews.viewAll")}</span>
      </div>

      {/* 통계 3카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, margin: "22px 0 18px" }}>
        {[
          { icon: "✅", iconBg: "#EFF6FF", label: "CONTRACT COUNT",  value: "87",  unit: "건" },
          { icon: "✔",  iconBg: "#F0FFF4", label: "COMPLETION RATE", value: "98",  unit: "%" },
          { icon: "🔄", iconBg: "#FFF7ED", label: "RE-EMPLOYMENT",   value: "85",  unit: "%" },
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
              4.9<span style={{ fontSize: 20, fontWeight: 600, color: "#94A3B8" }}> / 5.0</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 5, paddingTop: 6 }}>
              <div style={{ fontSize: 12, color: "#94A3B8", fontFamily: F, fontWeight: 500 }}>평균 평점</div>
              <StarRating rating={4.9} size={22} />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <RatingBar label="전문성" value={5.0} />
            <RatingBar label="일정 준수" value={4.8} />
            <RatingBar label="소통 능력" value={4.9} />
            <RatingBar label="적극성" value={4.9} />
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
          <DonutChart />
        </div>
      </div>

      {/* 개별 리뷰 카드 */}
      {REVIEW_DATA.map(review => <ReviewCard key={review.id} review={review} />)}
    </div>
  );
}

/* ── 준비 중 탭 ──────────────────────────────────────────── */
/* ── 진행하는 프로젝트 탭 ────────────────────────────────── */
/* 진행하는 프로젝트 탭 — 실제 DB 데이터 매핑 */
const STATUS_STYLE = {
  RECRUITING:  { label: "Planning",    color: "#7C3AED", bg: "#EDE9FE", progress: 10, done: false },
  IN_PROGRESS: { label: "In Progress", color: "#3B82F6", bg: "#DBEAFE", progress: 50, done: false },
  COMPLETED:   { label: "Completed",   color: "#16A34A", bg: "#DCFCE7", progress: 100, done: true  },
  CLOSED:      { label: "Closed",      color: "#EF4444", bg: "#FEE2E2", progress: 100, done: true  },
};
const APP_STATUS_STYLE = {
  APPLIED:     { label: "Applied",     color: "#0EA5E9", bg: "#E0F2FE", progress: 5,   done: false },
  ACCEPTED:    { label: "Accepted",    color: "#3B82F6", bg: "#DBEAFE", progress: 25,  done: false },
  CONTRACTED:  { label: "Contracted",  color: "#6366F1", bg: "#E0E7FF", progress: 35,  done: false },
  IN_PROGRESS: { label: "In Progress", color: "#3B82F6", bg: "#DBEAFE", progress: 60,  done: false },
  COMPLETED:   { label: "Completed",   color: "#16A34A", bg: "#DCFCE7", progress: 100, done: true  },
  REJECTED:    { label: "Rejected",    color: "#EF4444", bg: "#FEE2E2", progress: 0,   done: true  },
  WITHDRAWN:   { label: "Withdrawn",   color: "#94A3B8", bg: "#F1F5F9", progress: 0,   done: true  },
};
function fmtDate(d) {
  if (!d) return "";
  const s = String(d);
  if (s.length >= 10) return s.slice(0, 7).replace("-", ".");
  return s;
}
function fmtPeriod(start, end, durationMonths) {
  const a = fmtDate(start);
  const b = fmtDate(end);
  if (a && b) return a + " ~ " + b;
  if (a) return a + " 시작";
  if (durationMonths) return durationMonths + "개월";
  return "기간 미정";
}
function fmtBudget(p) {
  const v = p.budgetAmount ?? p.price ?? p.budgetMax ?? p.budgetMin;
  if (v == null) return "협의";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString() + " 만원";
}
function extractTags(p) {
  const tags = [];
  if (Array.isArray(p.requiredSkills)) tags.push(...p.requiredSkills);
  else if (Array.isArray(p.skills)) tags.push(...p.skills);
  if (p.serviceField) tags.unshift(p.serviceField);
  return tags.filter(Boolean).slice(0, 6).map((t) => (String(t).startsWith("#") ? String(t) : "#" + t));
}
function normalizeProjectStatus(s) {
  if (!s) return "RECRUITING";
  const u = String(s).toUpperCase();
  if (STATUS_STYLE[u]) return u;
  // 한글 레이블 → ENUM
  const map = {
    "모집중": "RECRUITING",
    "진행중": "IN_PROGRESS",
    "완료": "COMPLETED",
    "마감": "CLOSED",
  };
  return map[s] || "RECRUITING";
}
function mapProjectToHistory(p) {
  const key = normalizeProjectStatus(p.status);
  const style = STATUS_STYLE[key] || STATUS_STYLE.RECRUITING;
  return {
    id: "prj-" + p.id,
    realProjectId: p.id,
    status: style.label, statusColor: style.color, statusBg: style.bg,
    category: p.serviceField ? "#" + p.serviceField : "#Project",
    title: p.title || "제목 없음",
    desc: p.description || p.slogan || "",
    tags: extractTags(p),
    period: fmtPeriod(p.startDate, p.deadline || p.endDate, p.durationMonths),
    budget: fmtBudget(p),
    progress: style.progress,
    done: style.done,
  };
}
function mapApplicationToHistory(app) {
  // 백엔드 응답은 flat 구조 (projectTitle, projectDesc, ...) → project 객체로 합성
  const p = app.project || {
    id: app.projectId,
    title: app.projectTitle,
    description: app.projectDesc,
    slogan: app.projectSlogan,
    serviceField: app.projectServiceField,
    requiredSkills: app.projectSkills,
    startDate: app.projectStartDate,
    deadline: app.projectDeadline,
    durationMonths: app.projectDurationMonths,
    budgetMin: app.projectBudgetMin,
    budgetMax: app.projectBudgetMax,
    status: app.projectStatus,
  };
  const key = (app.status || "APPLIED").toUpperCase();
  const style = APP_STATUS_STYLE[key] || APP_STATUS_STYLE.APPLIED;
  return {
    id: "app-" + app.id,
    realProjectId: p.id,
    status: style.label, statusColor: style.color, statusBg: style.bg,
    category: p.serviceField ? "#" + p.serviceField : "#Project",
    title: p.title || "제목 없음",
    desc: p.description || p.slogan || "",
    tags: extractTags(p),
    period: fmtPeriod(p.startDate, p.deadline || p.endDate, p.durationMonths),
    budget: fmtBudget(p),
    progress: style.progress,
    done: style.done,
  };
}
function _mapProjectsToHistory(list) {
  const items = (list || []).map(mapProjectToHistory);
  items.sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1));
  return items;
}
function mergeHistoryItems(applications, myProjects) {
  const apps = (applications || []).map(mapApplicationToHistory);
  const owned = (myProjects || []).map(mapProjectToHistory);
  const seen = new Set();
  const merged = [];
  for (const it of [...apps, ...owned]) {
    const k = String(it.realProjectId || it.id);
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push(it);
  }
  merged.sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1));
  return merged;
}

function ProjectDetailModal({ project, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.56)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 20, width: "min(640px, 92vw)", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 24px 72px rgba(0,0,0,0.22)" }}>
        <div style={{ padding: "24px 28px 18px", borderBottom: "1px solid #F1F5F9" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 700, background: project.statusBg, color: project.statusColor, fontFamily: F }}>{project.status}</span>
              <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: F }}>{project.category}</span>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#94A3B8", lineHeight: 1, padding: "0 0 0 12px" }}>✕</button>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1E293B", margin: "0 0 8px", fontFamily: F, lineHeight: 1.3 }}>{project.title}</h2>
          <p style={{ fontSize: 14, color: "#64748B", margin: 0, fontFamily: F, lineHeight: 1.7 }}>{project.desc}</p>
        </div>
        <div style={{ padding: "22px 28px 28px" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
            {project.tags.map(tag => (
              <span key={tag} style={{ padding: "4px 12px", borderRadius: 6, background: "#F8FAFC", border: "1px solid #E2E8F0", fontSize: 12, fontWeight: 500, color: "#64748B", fontFamily: F }}>{tag}</span>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            <div style={{ background: "#F8FAFC", borderRadius: 12, padding: "14px 18px", border: "1.5px solid #E2E8F0" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", fontFamily: F, letterSpacing: 1, marginBottom: 6 }}>PERIOD</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1E293B", fontFamily: F }}>📅 {project.period}</div>
            </div>
            <div style={{ background: "#F8FAFC", borderRadius: 12, padding: "14px 18px", border: "1.5px solid #E2E8F0" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", fontFamily: F, letterSpacing: 1, marginBottom: 6 }}>BUDGET</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1E293B", fontFamily: F }}>💰 {project.budget}</div>
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "#64748B", fontFamily: F, fontWeight: 600 }}>프로젝트 완료율</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#16A34A", fontFamily: F }}>{project.progress}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: "#E2E8F0", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 99, width: `${project.progress}%`, background: "#22C55E" }} />
            </div>
          </div>
          <div style={{ background: "#F0FDF4", borderRadius: 12, padding: "16px 18px", border: "1.5px solid #BBF7D0", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22 }}>✅</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#15803D", fontFamily: F }}>프로젝트 완료</div>
              <div style={{ fontSize: 12, color: "#16A34A", fontFamily: F, marginTop: 2 }}>이 프로젝트는 성공적으로 완료되었습니다.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectHistoryCard({ project, _onDetail, onDashboard }) {
  const [hov, setHov] = useState(false);
  const [btnHov, setBtnHov] = useState(false);
  const { t } = useLanguage();

  const barColor = project.done
    ? "#22C55E"
    : project.progress >= 60 ? "#3B82F6" : "#60A5FA";

  const btnBase = project.done
    ? { bg: "#DCFCE7", color: "#15803D" }
    : { bg: "#DBEAFE", color: "#1e3a5f" };
  const btnHovStyle = project.done
    ? { bg: "#BBF7D0", color: "#15803D" }
    : { bg: "#BFDBFE", color: "#1e3a5f" };

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: "white", borderRadius: 16,
        border: "1.5px solid #F1F5F9",
        padding: "22px 26px",
        display: "grid", gridTemplateColumns: "1fr 260px", gap: 28,
        alignItems: "center",
        marginBottom: 14,
        boxShadow: hov
          ? "0 8px 28px rgba(59,130,246,0.13), 0 2px 6px rgba(0,0,0,0.06)"
          : "0 1px 4px rgba(0,0,0,0.04)",
        transition: "box-shadow 0.2s",
        cursor: "default",
      }}
    >
      {/* 왼쪽: 상태/제목/설명/태그/기간+예산 */}
      <div>
        {/* 상태 배지 + 카테고리 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{
            padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 700,
            background: project.statusBg, color: project.statusColor, fontFamily: F,
          }}>{project.status}</span>
          <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: F, fontWeight: 500 }}>{project.category}</span>
        </div>

        {/* 제목 */}
        <div style={{ fontSize: 18, fontWeight: 800, color: "#1E293B", fontFamily: F, marginBottom: 5, lineHeight: 1.35 }}>
          {project.title}
        </div>
        {/* 설명 */}
        <div style={{ fontSize: 13, color: "#64748B", fontFamily: F, marginBottom: 12, lineHeight: 1.6 }}>
          {project.desc}
        </div>

        {/* 기술 태그 */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {project.tags.map(tag => (
            <span key={tag} style={{
              padding: "4px 10px", borderRadius: 6,
              background: "#F8FAFC", border: "1px solid #E2E8F0",
              fontSize: 12, fontWeight: 500, color: "#64748B", fontFamily: F,
            }}>{tag}</span>
          ))}
        </div>

        {/* 기간 + 예산 */}
        <div style={{ display: "flex", gap: 22, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#94A3B8", fontFamily: F, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 14 }}>📅</span> {project.period}
          </span>
          <span style={{ fontSize: 13, color: "#94A3B8", fontFamily: F, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 14 }}>💰</span> {project.budget}
          </span>
        </div>
      </div>

      {/* 오른쪽: 진행률 + 버튼 */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
          <span style={{ fontSize: 13, color: "#64748B", fontFamily: F, fontWeight: 600 }}>{t("partnerProfile.projects.progress")}</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: project.statusColor, fontFamily: F }}>{project.progress}%</span>
        </div>
        <div style={{ height: 7, borderRadius: 99, background: "#E2E8F0", overflow: "hidden", marginBottom: 16 }}>
          <div style={{
            height: "100%", borderRadius: 99, width: `${project.progress}%`,
            background: barColor, transition: "width 0.4s",
          }} />
        </div>
        <button
          onMouseEnter={() => setBtnHov(true)}
          onMouseLeave={() => setBtnHov(false)}
          onClick={() => onDashboard(project)}
          style={{
            width: "100%", padding: "11px 0", borderRadius: 10, border: "none",
            background: btnHov ? btnHovStyle.bg : btnBase.bg,
            color: btnHov ? btnHovStyle.color : btnBase.color,
            fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: F,
            transition: "background 0.15s",
          }}
        >
          {project.done ? t("partnerProfile.projects.completed") : t("partnerProfile.projects.viewDashboard")}
        </button>
      </div>
    </div>
  );
}

function ProjectsTab() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [detailProject, setDetailProject] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // 파트너: 내가 지원/계약/진행/완료한 프로젝트 목록 (applications) +
  //         내가 등록한 프로젝트 목록 (projectsApi.myList - 파트너도 등록 가능)
  useEffect(() => {
    let mounted = true;
    Promise.allSettled([applicationsApi.myList(), projectsApi.myList()])
      .then((results) => {
        if (!mounted) return;
        const apps = results[0].status === "fulfilled" ? (results[0].value || []) : [];
        const myProjects = results[1].status === "fulfilled" ? (results[1].value || []) : [];
        const merged = mergeHistoryItems(apps, myProjects);
        setItems(merged);
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const handleDashboard = (project) => {
    navigate("/partner_dashboard?tab=project_manage", { state: { projectId: project.realProjectId || project.id } });
  };

  return (
    <div>
      {detailProject && <ProjectDetailModal project={detailProject} onClose={() => setDetailProject(null)} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <h2 style={{ fontSize: 27, fontWeight: 900, background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", margin: "0 0 6px", fontFamily: F }}>{t("partnerProfile.projects.title")}</h2>
          <p style={{ fontSize: 14, color: "#64748B", margin: 0, fontFamily: F, lineHeight: 1.7 }}>
            {t("partnerProfile.projects.desc")}
          </p>
        </div>
        <span style={{
          fontSize: 13, fontWeight: 600, color: "#3B82F6", fontFamily: F,
          cursor: "pointer", display: "flex", alignItems: "center", gap: 3,
          marginTop: 4, whiteSpace: "nowrap",
        }}>{t("partnerProfile.projects.viewAll")}</span>
      </div>

      <div style={{ marginTop: 20 }}>
        {loading && <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontFamily: F }}>{t("partnerProfile.projects.loading")}</div>}
        {!loading && items.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontFamily: F }}>
            {t("partnerProfile.projects.noHistory")}
          </div>
        )}
        {!loading && items.map(project => (
          <ProjectHistoryCard key={project.id} project={project} onDetail={setDetailProject} onDashboard={handleDashboard} />
        ))}
      </div>
    </div>
  );
}

/* ── 포트폴리오 수정 이동 탭 ───────────────────────────────── */
const PORTFOLIO_BG_EDIT = ["linear-gradient(135deg,#F97316,#EF4444)", "linear-gradient(135deg,#3B82F6,#6366F1)", "linear-gradient(135deg,#10B981,#0EA5E9)"];
const MOCK_PORTFOLIO_EDIT = [
  { title: "AI 기반 챗봇 플랫폼", category: "개발·기획·AI", tags: ["React", "FastAPI", "LLM"], rep: true },
  { title: "SaaS 관리자 대시보드 리뉴얼", category: "개발·디자인·웹", tags: ["Vue.js", "TypeScript"], rep: false },
  { title: "크로스플랫폼 모바일 앱", category: "개발·앱 제작", tags: ["React Native", "Firebase"], rep: false },
];
function PortfolioEditTab() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [showAll, setShowAll] = useState(false);
  const items = showAll ? MOCK_PORTFOLIO_EDIT : MOCK_PORTFOLIO_EDIT.slice(0, 3);
  return (
    <div>
      {/* 포트폴리오 미리보기 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#3B82F6", flexShrink: 0 }}>📋</div>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1E293B", margin: "0 0 2px", fontFamily: F }}>{t("partnerProfile.portfolio.title")}</h2>
            <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: F }}>{t("partnerProfile.portfolio.added").replace("{n}", MOCK_PORTFOLIO_EDIT.length)}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setShowAll(v => !v)}
            style={{ background: "#DBEAFE", color: "#1e3a5f", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: F, transition: "background 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background = "#BFDBFE"}
            onMouseLeave={e => e.currentTarget.style.background = "#DBEAFE"}
          >
            {showAll ? t("partnerProfile.portfolio.collapse") : t("partnerProfile.portfolio.showAll")}
          </button>
        </div>
      </div>
      {/* 포트폴리오 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 32 }}>
        {items.map((p, i) => (
          <div key={i} style={{ borderRadius: 16, overflow: "hidden", border: "1.5px solid #E2E8F0", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ height: 120, background: PORTFOLIO_BG_EDIT[i % PORTFOLIO_BG_EDIT.length], position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src={aiBird} alt="thumbnail" style={{ height: 80, objectFit: "contain", opacity: 0.9 }} />
              {p.rep && (
                <span style={{ position: "absolute", top: 10, left: 10, fontSize: 11, fontWeight: 800, color: "#1D4ED8", background: "white", borderRadius: 6, padding: "2px 8px", fontFamily: F }}>대표</span>
              )}
            </div>
            <div style={{ padding: "12px 14px", background: "white" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#1E293B", fontFamily: F, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
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
      {/* 안내 메시지 */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 20px", background: "#F8FAFC", borderRadius: 16, border: "1.5px dashed #BFDBFE" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📝</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#1E293B", fontFamily: F, marginBottom: 8 }}>{t("partnerProfile.portfolio.hint")}</div>
        <div style={{ fontSize: 13, color: "#64748B", fontFamily: F, marginBottom: 16, textAlign: "center", lineHeight: 1.6 }}>{t("partnerProfile.portfolio.hintDesc")}</div>
        <button
          onClick={() => navigate("/partner_dashboard?tab=portfolio_add")}
          style={{ background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)", color: "white", border: "none", borderRadius: 10, padding: "11px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: F, transition: "opacity 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
        >
          {t("partnerProfile.portfolio.navBtn")}
        </button>
      </div>
    </div>
  );
}

/* ── 준비 중 탭 ──────────────────────────────────────────── */
function ComingSoonTab() {
  const { t } = useLanguage();
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "80px 20px", color: "#94A3B8",
    }}>
      <div style={{ fontSize: 44, marginBottom: 18 }}>🚧</div>
      <div style={{ fontSize: 14, color: "#94A3B8", fontFamily: F }}>{t("partnerProfile.comingSoon")}</div>
    </div>
  );
}

/* ── 메인 페이지 ─────────────────────────────────────────── */
function PartnerProfile() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { partnerProfile, partnerDropdowns, setPartnerDropdown, userRole, setPartnerProfileDetail } = useStore();
  const { t } = useLanguage();
  const activeTab = searchParams.get("tab") || "profile_menu";
  const setActiveTab = (key) => setSearchParams({ tab: key }, { replace: true });

  const isClientRole = userRole === "client";

  // DB에서 프로필 데이터 로드
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const data = await profileApi.getMyDetail();
        setPartnerProfileDetail(data);
      } catch (error) {
        console.error("프로필 데이터 로드 실패:", error);
      }
    };
    fetchProfileData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 역할별 탭 목록: 클라이언트는 "이력" 탭 추가, 탭명 변경
  const DISPLAY_TABS = isClientRole
    ? TABS
        .map(tab => ({
          ...tab,
          label: tab.key === "intro" ? t("partnerProfile.tabs.clientIntro")
               : tab.key === "reviews" ? t("partnerProfile.tabs.clientReview")
               : ({
                   profile_menu: t("partnerProfile.menu.title"),
                   skills: t("partnerProfile.menu.skills"),
                   career: t("partnerProfile.menu.career"),
                   education: t("partnerProfile.menu.education"),
                   certificates: t("partnerProfile.menu.certificate"),
                   awards: t("partnerProfile.menu.award"),
                   portfolio: t("partnerProfile.menu.portfolio"),
                   projects: t("partnerProfile.menu.ongoingProject"),
                 }[tab.key] || tab.label),
        }))
        .flatMap(tab => tab.key === "career" ? [{ key: "history", label: t("partnerProfile.tabs.history") }, tab] : [tab])
    : TABS.map(tab => ({
        ...tab,
        label: ({
          profile_menu: t("partnerProfile.menu.title"),
          intro: t("partnerProfile.menu.intro"),
          skills: t("partnerProfile.menu.skills"),
          career: t("partnerProfile.menu.career"),
          education: t("partnerProfile.menu.education"),
          certificates: t("partnerProfile.menu.certificate"),
          awards: t("partnerProfile.menu.award"),
          portfolio: t("partnerProfile.menu.portfolio"),
          reviews: t("partnerProfile.menu.review"),
          projects: t("partnerProfile.menu.ongoingProject"),
        }[tab.key] || tab.label),
      }));

  // 회원가입 시 선택한 jobCategory를 category 드롭다운 기본값으로 1회 초기화
  useEffect(() => {
    if (partnerProfile?.jobCategory && !partnerDropdowns.category) {
      setPartnerDropdown("category", partnerProfile.jobCategory);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#F1F5F9", fontFamily: F }}>
      <Header_partner />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 20px 60px" }}>

        {/* ─── 파트너 배너 카드 ─── */}
        <PartnerBannerCard activePage="profile" />

        {/* ─── AI 유입 배너 카드 ─── */}
        <div style={{
          background: "linear-gradient(135deg, #EEF2FF 0%, #E0F2FE 50%, #F5F3FF 100%)",
          borderRadius: 18, padding: "18px 32px",
          display: "flex", alignItems: "center", gap: 20,
          marginBottom: 24,
          marginLeft: -38, marginRight: -38,
          border: "1.5px solid #C7D2FE",
          boxShadow: "0 2px 10px rgba(99,102,241,0.10)",
        }}>
          <img src={aiBird} alt="AI 도움" style={{ width: 72, height: 72, objectFit: "contain", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1E293B", fontFamily: F, marginBottom: 4 }}>
              {t("partnerProfile.ai.title")}
            </div>
            <div style={{ fontSize: 13, color: "#64748B", fontFamily: F }}>
              {t("partnerProfile.ai.desc")}
            </div>
          </div>
          <button
            onClick={() => navigate("/ai_chat_profile")}
            style={{
              padding: "12px 28px", borderRadius: 12, border: "none",
              background: "linear-gradient(135deg, #93C5FD 0%, #60a5fa 40%, #818CF8 100%)",
              color: "white", fontSize: 14, fontWeight: 700,
              cursor: "pointer", fontFamily: F,
              boxShadow: "0 4px 12px rgba(99,102,241,0.25)",
              flexShrink: 0, whiteSpace: "nowrap",
              transition: "background 0.2s, box-shadow 0.2s",
            }}
            onMouseEnter={e=>{
              e.currentTarget.style.background="linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #6366f1 100%)";
              e.currentTarget.style.boxShadow="0 6px 20px rgba(99,102,241,0.45)";
            }}
            onMouseLeave={e=>{
              e.currentTarget.style.background="linear-gradient(135deg, #93C5FD 0%, #60a5fa 40%, #818CF8 100%)";
              e.currentTarget.style.boxShadow="0 4px 12px rgba(99,102,241,0.25)";
            }}
          >
            {t("partnerProfile.ai.btn")}
          </button>
        </div>

        {/* ─── 탭 + 콘텐츠 영역 ─── */}
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", marginLeft: -38, marginRight: -38 }}>

          {/* 왼쪽 탭 사이드바 */}
          <div style={{
            width: 220, flexShrink: 0,
            background: "white", borderRadius: 16,
            padding: "12px 10px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            position: "sticky", top: 84,
          }}>
            {DISPLAY_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  width: "100%", textAlign: "left",
                  padding: "11px 16px", borderRadius: 10,
                  border: "none",
                  background: activeTab === tab.key ? "#EFF6FF" : "transparent",
                  color: activeTab === tab.key ? "#3B82F6" : "#475569",
                  fontSize: 14,
                  fontWeight: activeTab === tab.key ? 700 : 500,
                  cursor: "pointer", fontFamily: F,
                  transition: "all 0.15s",
                  marginBottom: 2,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 오른쪽 콘텐츠 패널 */}
          <div style={{
            flex: 1, background: "white", borderRadius: 16,
            padding: "32px 36px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            minHeight: 520,
          }}>
            {activeTab === "profile_menu"
              ? <ProfileMenuTab />
              : activeTab === "intro"
              ? <IntroTab isClient={isClientRole} />
              : activeTab === "skills"
              ? <SkillsTab />
              : activeTab === "history"
              ? <HistoryTab />
              : activeTab === "career"
              ? <CareerTab />
              : activeTab === "education"
              ? <EducationTab />
              : activeTab === "certificates"
              ? <CertificatesTab />
              : activeTab === "awards"
              ? <AwardsTab />
              : activeTab === "reviews"
              ? <ReviewsTab isClient={isClientRole} />
              : activeTab === "projects"
              ? <ProjectsTab />
              : activeTab === "portfolio_edit"
              ? <PortfolioEditTab />
              : <ComingSoonTab />
            }
          </div>
        </div>
      </div>

    </div>
  );
}

export default PartnerProfile;
