import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import useStore from "../store/useStore";
import { authApi } from "../api";
import {
  User, Users, CreditCard, Building2,
  Wifi, Monitor, GitMerge,
  Link2, FileUp, Hash, Plus, ChevronDown,
} from "lucide-react";
import mainLogo from "../assets/main_logo.png";
import homeBg from "../assets/home.png";

const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const PRIMARY = "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)";
const DISABLED_BTN = { background: "#E5E7EB", color: "#9CA3AF", boxShadow: "none", cursor: "not-allowed" };
const ACTIVE_BTN   = { background: PRIMARY,   color: "white",   boxShadow: "0 4px 16px rgba(99,102,241,0.32)", cursor: "pointer" };

const STEP_INFO = [
  { title: "파트너 유형 선택",      sub: "파트너 등록의 첫 단계를 시작해요" },
  { title: "기술 스택 & 희망 연봉", sub: "Define your expertise and work preferences" },
  { title: "Career & Portfolio",   sub: "Github, 블로그, Youtube .. 링크 자산과 포트폴리오 파일이 있다면 꼭 업로드 해주세요. 😊" },
  { title: "자기소개",             sub: "자신의 업무 스타일과 강점을 들려주세요. 나와 꼭 맞는 최고의 팀과 프로젝트를 찾아드릴게요." },
];

/* ── StepHeader ─────────────────────────────────────────── */
function StepHeader({ step }) {
  const { title, sub } = STEP_INFO[step - 1];
  return (
    <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: "1px solid #F1F5F9" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 10 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0F172A", margin: "0 0 5px", fontFamily: F }}>{title}</h2>
          <p  style={{ fontSize: 13, color: "#94A3B8", margin: 0, fontFamily: F }}>{sub}</p>
        </div>
        <div style={{
          padding: "5px 13px", borderRadius: 999,
          background: "#EEF2FF", color: "#6366F1",
          fontSize: 11, fontWeight: 700, letterSpacing: "0.07em",
          fontFamily: F, flexShrink: 0, whiteSpace: "nowrap",
          alignSelf: "flex-start",
        }}>
          STEP {step} OF 4
        </div>
      </div>
      <div style={{ height: 5, borderRadius: 999, backgroundColor: "#E2E8F0", overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 999,
          background: "linear-gradient(90deg, #60a5fa, #6366f1)",
          width: `${step * 25}%`, transition: "width 0.45s ease",
        }} />
      </div>
    </div>
  );
}

/* ── 공통 컴포넌트 ───────────────────────────────────────── */
function SLabel({ children }) {
  if (typeof children === "string" && children.endsWith(" *")) {
    return (
      <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 10px", fontFamily: F }}>
        {children.slice(0, -2)}<span style={{ color: "#EF4444", marginLeft: 2 }}>*</span>
      </p>
    );
  }
  return <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 10px", fontFamily: F }}>{children}</p>;
}

function Chip({ label, selected, onToggle, dot }) {
  return (
    <button onClick={onToggle} style={{
      padding: "8px 16px", borderRadius: 999,
      border: selected ? "2px solid #3B82F6" : "1.5px solid #E2E8F0",
      background: selected ? "linear-gradient(135deg,#EFF6FF,#DBEAFE)" : "white",
      color: selected ? "#2563EB" : "#374151",
      fontSize: 13, fontWeight: selected ? 700 : 500,
      cursor: "pointer", fontFamily: F,
      display: "flex", alignItems: "center", gap: 6,
      transition: "all 0.15s",
    }}>
      {dot && <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, backgroundColor: selected ? "#10B981" : "#D1D5DB" }} />}
      {label}
    </button>
  );
}

function PillBtn({ label, selected, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "10px 22px", borderRadius: 12,
      border: selected ? "2px solid #3B82F6" : "1.5px solid #E2E8F0",
      background: selected ? "linear-gradient(135deg,#EFF6FF,#DBEAFE)" : "white",
      color: selected ? "#2563EB" : "#374151",
      fontSize: 13, fontWeight: selected ? 700 : 500,
      cursor: "pointer", fontFamily: F, transition: "all 0.15s",
    }}>
      {label}
    </button>
  );
}

function IconCard({ Icon, label, selected, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "20px 8px 16px", borderRadius: 14,
      border: selected ? "2.5px solid #3B82F6" : "1.5px solid #E2E8F0",
      background: selected ? "linear-gradient(135deg,#EFF6FF,#DBEAFE)" : "white",
      cursor: "pointer", fontFamily: F,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      transition: "all 0.15s",
    }}>
      <Icon size={22} color={selected ? "#3B82F6" : "#94A3B8"} strokeWidth={1.8} />
      <span style={{ fontSize: 13, fontWeight: selected ? 700 : 500, color: selected ? "#2563EB" : "#374151" }}>
        {label}
      </span>
    </button>
  );
}

function SelectField({ value, onChange, options, placeholder }) {
  return (
    <div style={{ position: "relative" }}>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        width: "100%", padding: "12px 36px 12px 14px",
        borderRadius: 10, border: "1.5px solid #E2E8F0",
        fontSize: 14, fontWeight: 500,
        color: value ? "#111827" : "#9CA3AF",
        backgroundColor: "white", fontFamily: F,
        appearance: "none", cursor: "pointer", outline: "none",
        boxSizing: "border-box",
      }}>
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={15} color="#9CA3AF" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
    </div>
  );
}

function FileZone({ file, onFile }) {
  const ref = useRef(null);
  return (
    <div onClick={() => ref.current?.click()}
      style={{
        border: "2px dashed #BFDBFE", borderRadius: 14,
        padding: "36px 20px", cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        backgroundColor: "#F8FAFF", transition: "background 0.15s",
      }}
      onMouseEnter={e => e.currentTarget.style.background = "#EFF6FF"}
      onMouseLeave={e => e.currentTarget.style.background = "#F8FAFF"}
    >
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <FileUp size={22} color="#3B82F6" />
      </div>
      {file
        ? <p style={{ fontSize: 13, fontWeight: 600, color: "#3B82F6", margin: 0, fontFamily: F }}>{file.name}</p>
        : <>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#374151", margin: 0, fontFamily: F }}>Drag and drop your file here</p>
            <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0, fontFamily: F }}>PDF, DOCX up to 10MB</p>
          </>
      }
      <input ref={ref} type="file" accept=".pdf,.docx" onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} style={{ display: "none" }} />
    </div>
  );
}

/* ── STEP 1 ──────────────────────────────────────────────── */
function Step1({ form, set }) {
  const JOB_CATEGORIES = ["개발", "기획", "디자인", "배포"];
  const JOB_TYPES = ["pm/기획", "UI/UX 디자인", "프론트엔드", "백엔드", "QA", "ML/AI", "유지보수", "클라우드"];
  const CHANNELS  = ["카카오톡", "전화", "디스코드", "슬랙", "데브브릿지 DM"];
  const PARTNER_CARDS = [
    { label: "개인",      Icon: User },
    { label: "팀",        Icon: Users },
    { label: "개인사업자", Icon: CreditCard },
    { label: "법인사업자", Icon: Building2 },
  ];

  const toggleArr = (key, val) =>
    set(key, form[key].includes(val) ? form[key].filter(v => v !== val) : [...form[key], val]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <SLabel>업무 카테고리 *</SLabel>
        <div style={{ display: "flex", gap: 8 }}>
          {JOB_CATEGORIES.map(c => (
            <PillBtn key={c} label={c} selected={form.jobCategory === c} onClick={() => set("jobCategory", c)} />
          ))}
        </div>
      </div>

      <div>
        <SLabel>직종 선택 *</SLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {JOB_TYPES.map(j => (
            <Chip key={j} label={j} selected={form.jobTypes.includes(j)} onToggle={() => toggleArr("jobTypes", j)} />
          ))}
        </div>
      </div>

      <div>
        <SLabel>파트너 형태 *</SLabel>
        <div style={{ display: "flex", gap: 10 }}>
          {PARTNER_CARDS.map(({ label, Icon }) => (
            <IconCard key={label} Icon={Icon} label={label}
              selected={form.partnerType === label}
              onClick={() => set("partnerType", label)} />
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
        <div>
          <SLabel>선호 프로젝트 형태 *</SLabel>
          <div style={{ display: "flex", gap: 8 }}>
            {["외주", "기간제 근무"].map(v => (
              <PillBtn key={v} label={v} selected={form.projectType === v} onClick={() => set("projectType", v)} />
            ))}
          </div>
        </div>
        <div>
          <SLabel>작업 가능 시간 *</SLabel>
          <div style={{ display: "flex", gap: 8 }}>
            {["오전", "오후", "심야"].map(v => (
              <PillBtn key={v} label={v} selected={form.workTimes.includes(v)} onClick={() => toggleArr("workTimes", v)} />
            ))}
          </div>
        </div>
      </div>

      <div>
        <SLabel>소통 채널 *</SLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {CHANNELS.map(c => (
            <Chip key={c} label={c} dot selected={form.channels.includes(c)} onToggle={() => toggleArr("channels", c)} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── STEP 2 ──────────────────────────────────────────────── */
function Step2({ form, set }) {
  const [addingSkill, setAddingSkill] = useState(false);
  const [newSkill, setNewSkill]       = useState("");

  const DEV_LEVELS = ["Junior (0-2 years)", "Mid-level (2-5 years)", "Senior (5-7 years)", "Senior (7+ years)", "Lead / Principal"];
  const YEARS      = ["< 1 year", "1-2 years", "3-5 years", "5-7 years", "7+ years"];
  const WORK_STYLES = [
    { label: "Remote",  Icon: Wifi },
    { label: "On-site", Icon: Monitor },
    { label: "Hybrid",  Icon: GitMerge },
  ];

  const toggleSkill = s =>
    set("skills", form.skills.includes(s) ? form.skills.filter(x => x !== s) : [...form.skills, s]);

  const addSkill = () => {
    const t = newSkill.trim();
    if (t && !form.allSkills.includes(t)) {
      set("allSkills", [...form.allSkills, t]);
      set("skills", [...form.skills, t]);
    } else if (t && !form.skills.includes(t)) {
      set("skills", [...form.skills, t]);
    }
    setNewSkill(""); setAddingSkill(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div>
        <SLabel>핵심 기술 & 프레임워크 *</SLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {form.allSkills.map(s => {
            const sel = form.skills.includes(s);
            return (
              <button key={s} onClick={() => toggleSkill(s)} style={{
                padding: "8px 16px", borderRadius: 999,
                border: sel ? "none" : "1.5px solid #E2E8F0",
                background: sel ? PRIMARY : "white",
                color: sel ? "white" : "#374151",
                fontSize: 13, fontWeight: sel ? 700 : 500,
                cursor: "pointer", fontFamily: F,
                boxShadow: sel ? "0 2px 8px rgba(99,102,241,0.28)" : "none",
                transition: "all 0.15s",
              }}>{s}</button>
            );
          })}
          {addingSkill
            ? <div style={{ display: "flex", gap: 6 }}>
                <input value={newSkill} onChange={e => setNewSkill(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addSkill()} autoFocus
                  style={{ padding: "8px 12px", borderRadius: 999, border: "1.5px solid #3B82F6", fontSize: 13, fontFamily: F, outline: "none", width: 100 }} />
                <button onClick={addSkill} style={{ padding: "8px 12px", borderRadius: 999, background: PRIMARY, color: "white", border: "none", fontSize: 13, cursor: "pointer", fontFamily: F }}>추가</button>
              </div>
            : <button onClick={() => setAddingSkill(true)} style={{ padding: "8px 14px", borderRadius: 999, border: "1.5px dashed #CBD5E1", background: "white", color: "#9CA3AF", fontSize: 13, cursor: "pointer", fontFamily: F, display: "flex", alignItems: "center", gap: 4 }}>
                <Plus size={13} /> Add
              </button>
          }
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <div>
          <SLabel>전반적인 프로 개발자 레벨 *</SLabel>
          <SelectField value={form.devLevel} onChange={v => set("devLevel", v)} options={DEV_LEVELS} placeholder="레벨을 선택해주세요" />
        </div>
        <div>
          <SLabel>핵심 기술 경력 연수 *</SLabel>
          <SelectField value={form.yearsForSkills} onChange={v => set("yearsForSkills", v)} options={YEARS} placeholder="경력 연수를 선택해주세요" />
        </div>
      </div>

      <div>
        <SLabel>희망 연봉 (KRW)</SLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          {[
            { key: "hourlyRate",  label: "시간당",   placeholder: "45,000" },
            { key: "monthlyBase", label: "월급",  placeholder: "7,000,000" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", margin: "0 0 6px", fontFamily: F, letterSpacing: "0.05em" }}>{label}</p>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#6B7280", fontFamily: F }}>₩</span>
                <input value={form[key]} onChange={e => set(key, e.target.value.replace(/[^0-9,]/g, ""))}
                  placeholder={placeholder}
                  style={{ width: "100%", padding: "12px 12px 12px 28px", borderRadius: 10, border: "1.5px solid #E2E8F0", fontSize: 14, fontWeight: 500, color: "#111827", fontFamily: F, outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SLabel>근무 스타일 선호</SLabel>
        <div style={{ display: "flex", gap: 12 }}>
          {WORK_STYLES.map(({ label, Icon }) => (
            <IconCard key={label} Icon={Icon} label={label}
              selected={form.workStyle === label}
              onClick={() => set("workStyle", label)} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── STEP 3 ──────────────────────────────────────────────── */
function Step3({ form, set }) {
  const LINKS = [
    { field: "githubUrl",  label: "GitHub URL",        placeholder: "https://github.com/username" },
    { field: "blogUrl",    label: "Blog URL",           placeholder: "https://medium.com/@username" },
    { field: "youtubeUrl", label: "YouTube URL",        placeholder: "https://youtube.com/@username" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Link2 size={15} color="#3B82F6" />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#111827", fontFamily: F }}>Professional Links</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {LINKS.map(({ field, label, placeholder }) => (
            <div key={field}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 6px", fontFamily: F }}>{label}</p>
              <input type="url" value={form[field] || ""} onChange={e => set(field, e.target.value)}
                placeholder={placeholder}
                style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #E2E8F0", fontSize: 13, color: "#111827", fontFamily: F, outline: "none", boxSizing: "border-box" }} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <FileUp size={15} color="#3B82F6" />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#111827", fontFamily: F }}>Portfolio File</span>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 12, color: "#EF4444", margin: "0 0 2px", fontFamily: F }}>이미 있다면 꼭 넣어주세요! 🐥</p>
            <p style={{ fontSize: 12, color: "#3B82F6", margin: 0, fontFamily: F }}>AI 매니저가 🌿 당신의 포트폴리오를 강점을 돋보이게 도와줄수 있어요</p>
          </div>
        </div>
        <FileZone file={form.portfolioFile} onFile={f => set("portfolioFile", f)} />
      </div>
    </div>
  );
}

/* ── STEP 4 ──────────────────────────────────────────────── */
function Step4({ form, set }) {
  const [addingTag, setAddingTag] = useState(false);
  const [newTag, setNewTag]       = useState("");

  const toggleTag = (tag) =>
    set("hashtags", form.hashtags.includes(tag)
      ? form.hashtags.filter(t => t !== tag)
      : [...form.hashtags, tag]);

  const addTag = () => {
    const t = newTag.trim().startsWith("#") ? newTag.trim() : `#${newTag.trim()}`;
    if (t !== "#" && !form.allHashtags.includes(t)) {
      set("allHashtags", [...form.allHashtags, t]);
      set("hashtags", [...form.hashtags, t]);
    } else if (t !== "#" && !form.hashtags.includes(t)) {
      set("hashtags", [...form.hashtags, t]);
    }
    setNewTag(""); setAddingTag(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 16 }}>🎒</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#111827", fontFamily: F }}>
            내가 생각하는 나의 슬로건<span style={{ color: "#EF4444", marginLeft: 2 }}>*</span>
          </span>
        </div>
        <textarea value={form.slogan} onChange={e => set("slogan", e.target.value)}
          placeholder="예: 유연한 원격 근무와 대면 협업이 조화로운 환경을 선호합니다..." rows={3}
          style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "1.5px solid #E2E8F0", fontSize: 13, color: "#111827", fontFamily: F, outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.7 }} />
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Hash size={15} color="#3B82F6" />
          <span style={{ fontSize: 14, fontWeight: 700, color: "#111827", fontFamily: F }}>
            나를 소개하는 Hash Tag<span style={{ color: "#EF4444", marginLeft: 2 }}>*</span>
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {form.allHashtags.map(tag => {
            const sel = form.hashtags.includes(tag);
            return (
              <button key={tag} onClick={() => toggleTag(tag)} style={{
                padding: "8px 16px", borderRadius: 999,
                border: sel ? "none" : "1.5px solid #E2E8F0",
                background: sel ? PRIMARY : "white",
                color: sel ? "white" : "#374151",
                fontSize: 13, fontWeight: sel ? 700 : 500,
                cursor: "pointer", fontFamily: F,
                boxShadow: sel ? "0 2px 8px rgba(99,102,241,0.28)" : "none",
                transition: "all 0.15s",
              }}>{tag}</button>
            );
          })}
          {addingTag
            ? <div style={{ display: "flex", gap: 6 }}>
                <input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === "Enter" && addTag()} autoFocus placeholder="#keyword"
                  style={{ padding: "7px 12px", borderRadius: 999, border: "1.5px solid #3B82F6", fontSize: 13, fontFamily: F, outline: "none", width: 110 }} />
                <button onClick={addTag} style={{ padding: "7px 12px", borderRadius: 999, background: PRIMARY, color: "white", border: "none", fontSize: 13, cursor: "pointer", fontFamily: F }}>추가</button>
              </div>
            : <button onClick={() => setAddingTag(true)} style={{ padding: "7px 14px", borderRadius: 999, border: "1.5px dashed #CBD5E1", background: "white", color: "#9CA3AF", fontSize: 13, cursor: "pointer", fontFamily: F, display: "flex", alignItems: "center", gap: 4 }}>
                <Plus size={13} /> Add Keywords
              </button>
          }
        </div>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <User size={15} color="#3B82F6" />
          <span style={{ fontSize: 14, fontWeight: 700, color: "#111827", fontFamily: F }}>자기소개서</span>
        </div>
        <textarea value={form.selfIntro} onChange={e => set("selfIntro", e.target.value)}
          placeholder="나는 어떤 사람인지 간략하게 적어주시면 포트폴리오 완성도를 더 높여줄게요 😊" rows={5}
          style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "1.5px solid #E2E8F0", fontSize: 13, color: "#111827", fontFamily: F, outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.7 }} />
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <FileUp size={15} color="#3B82F6" />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#111827", fontFamily: F }}>자기소개서 File</span>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 12, color: "#EF4444", margin: "0 0 2px", fontFamily: F }}>이미 있다면 꼭 넣어주세요! 🐥</p>
            <p style={{ fontSize: 12, color: "#3B82F6", margin: 0, fontFamily: F }}>AI 매니저가 🌿 당신의 포트폴리오를 강점을 돋보이게 도와줄수 있어요</p>
          </div>
        </div>
        <FileZone file={form.selfIntroFile} onFile={f => set("selfIntroFile", f)} />
      </div>
    </div>
  );
}

/* ── 메인 컴포넌트 ───────────────────────────────────────── */
function PartnerRegister() {
  const navigate = useNavigate();
  const { signupFormData, setLogin, setUserRole, setUser, setPartnerProfile, clearSignupFormData } = useStore();
  const [step, setStep] = useState(1);
  const [form, setFormState] = useState({
    // step 1
    jobCategory: "",
    jobTypes:    [],
    partnerType: "",
    projectType: "",
    workTimes:   [],
    channels:    [],
    // step 2
    skills:       ["React", "Node.js"],
    allSkills:    ["React", "Vue.js", "Node.js", "Flutter", "Python", "Swift"],
    devLevel:     "Senior (7+ years)",
    yearsForSkills: "3-5 years",
    hourlyRate:   "45,000",
    monthlyBase:  "7,000,000",
    workStyle:    "Remote",
    // step 3
    githubUrl:    "",
    blogUrl:      "",
    websiteUrl:   "",
    portfolioFile: null,
    // step 4
    slogan:       "",
    allHashtags:  ["#Agile", "#Collaborative", "#Fast-paced", "#Structured", "#Innovative", "#Reliable", "#Creative", "#Analytical", "#Remote-friendly", "#Team-player", "#Problem-solver"],
    hashtags:     [],
    selfIntro:    "",
    selfIntroFile: null,
  });

  const set = (field, value) => setFormState(prev => ({ ...prev, [field]: value }));

  const isValid = s => {
    if (s === 1) return !!form.jobCategory && form.jobTypes.length > 0 && !!form.partnerType && !!form.projectType && form.workTimes.length > 0 && form.channels.length > 0;
    if (s === 2) return form.skills.length > 0 && !!form.devLevel && !!form.yearsForSkills && !!form.workStyle;
    if (s === 3) return true;
    if (s === 4) return form.slogan.trim().length > 0 && form.hashtags.length > 0;
    return false;
  };

  const valid = isValid(step);

  const nextStep = async () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      if (!signupFormData) {
        alert("기본 회원가입 정보가 없습니다. 다시 시작해주세요.");
        navigate("/signup");
        return;
      }
      // 파트너 최종 회원가입 수행
      const payload = {
        email: signupFormData.idEmail,
        phone: signupFormData.phone,
        username: signupFormData.username,
        password: signupFormData.pw,
        userType: "PARTNER",
        interests: signupFormData.skills,
        industry: signupFormData.industry || null,
        birthDate: signupFormData.birthdate || null,

        workCategory: form.jobCategory,
        jobRoles: JSON.stringify(form.jobTypes),
        partnerType: form.partnerType,
        preferredProjectType: form.projectType,
        workAvailableHours: JSON.stringify(form.workTimes),
        communicationChannels: JSON.stringify(form.channels),
        devLevel: form.devLevel,
        devExperience: form.yearsForSkills,
        workPreference: form.workStyle,
        salaryHour: parseInt(form.hourlyRate.replace(/,/g, "") || "0"),
        salaryMonth: parseInt(form.monthlyBase.replace(/,/g, "") || "0"),
        githubUrl: form.githubUrl,
        blogUrl: form.blogUrl,
        youtubeUrl: form.websiteUrl,
        hashtags: JSON.stringify(form.hashtags),
        slogan: form.slogan,
        bio: form.selfIntro,
        skills: form.skills
      };

      try {
        const data = await authApi.signup(payload);
        // JWT 토큰은 HttpOnly 쿠키로 백엔드가 자동 set (XSS 방어). 잔존 레거시 토큰만 정리.
        localStorage.removeItem('accessToken');
        if (data.userId != null) {
          localStorage.setItem('dbId', String(data.userId));     // PK (비민감)
          localStorage.setItem('username', data.username ?? '');  // 핸들
          localStorage.setItem('userType', data.userType ?? '');
        }
        // store에 user 정보 저장
        setUser({
          email: data.email,
          username: data.username,   // 로그인 핸들 (표시용)
          dbId: data.userId,         // DB PK (API 호출용)
          phone: data.phone,
          birthdate: data.birthDate,
          role: '파트너'
        });
        setPartnerProfile(form);
        setLogin(data.email, "local");
        setUserRole("partner");
        clearSignupFormData();
        alert(data.message);
        navigate("/client_home");
      } catch (error) {
        const msg = error?.response?.data?.message || "서버와 통신 중 오류가 발생했습니다.";
        console.error("Partner Signup error:", error);
        alert(msg);
      }
    }
  };
  const prevStep = () => { if (step > 1) setStep(step - 1); else navigate("/signup"); };

  return (
    <div style={{ minHeight: "100vh", fontFamily: F }}>
      {/* 블러 배경 */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0,
        backgroundImage: `url(${homeBg})`,
        backgroundSize: "cover", backgroundPosition: "center",
        filter: "blur(16px) brightness(0.85) saturate(1.15)",
        transform: "scale(1.1)",
      }} />
      {/* 몽환적 색 오버레이 */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, backgroundColor: "rgba(220, 232, 255, 0.38)" }} />

      {/* 로고 */}
      <div style={{ position: "fixed", top: 20, left: 24, zIndex: 20, cursor: "pointer" }}
        onClick={() => navigate("/home")}>
        <img src={mainLogo} alt="Alpha-Helix"
          style={{ height: 32, width: "auto", objectFit: "contain", filter: "drop-shadow(0 1px 6px rgba(0,0,0,0.22))" }} />
      </div>

      {/* 스크롤 영역 */}
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", justifyContent: "center", alignItems: "flex-start",
        minHeight: "100vh", padding: "68px 20px 64px",
      }}>
        {/* 카드 */}
        <div style={{
          backgroundColor: "white", borderRadius: 24,
          boxShadow: "0 12px 48px rgba(0,0,0,0.13)",
          padding: "36px 44px 32px",
          width: "100%", maxWidth: 590,
        }}>
          <StepHeader step={step} />

          <div style={{ marginBottom: 28 }}>
            {step === 1 && <Step1 form={form} set={set} />}
            {step === 2 && <Step2 form={form} set={set} />}
            {step === 3 && <Step3 form={form} set={set} />}
            {step === 4 && <Step4 form={form} set={set} />}
          </div>

          {/* 하단 버튼 */}
          <div style={{ display: "flex", gap: 12, borderTop: "1px solid #F1F5F9", paddingTop: 20, marginTop: 4 }}>
            <button onClick={prevStep} style={{
              flexShrink: 0, padding: "14px 26px", borderRadius: 12,
              border: "1.5px solid #E2E8F0", background: "#F8FAFC",
              fontSize: 14, fontWeight: 600, color: "#64748B",
              cursor: "pointer", fontFamily: F,
            }}>
              ← 이전 단계
            </button>
            <button onClick={valid ? nextStep : undefined} style={{
              flex: 1, padding: "14px 0", borderRadius: 12,
              border: "none", transition: "all 0.25s",
              fontSize: 14, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              ...(valid ? ACTIVE_BTN : DISABLED_BTN),
            }}>
              {step === 4 ? "등록 완료! 🚀" : "다음 단계 →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PartnerRegister;
