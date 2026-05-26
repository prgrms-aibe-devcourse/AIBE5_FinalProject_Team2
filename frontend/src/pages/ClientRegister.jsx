import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useStore from "../store/useStore";
import { authApi } from "../api";
import { Building2, CreditCard, User, Users, HelpCircle } from "lucide-react";
import mainLogo from "../assets/main_logo.png";
import homeBg from "../assets/home.png";

const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const PRIMARY = "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)";
const DISABLED = { background: "#E5E7EB", color: "#9CA3AF", boxShadow: "none", cursor: "not-allowed" };
const ACTIVE   = { background: PRIMARY,   color: "white",   boxShadow: "0 4px 16px rgba(99,102,241,0.32)", cursor: "pointer" };

const STEP_INFO = [
  { step: 1, title: "클라이언트 등록", total: 1 },
];

const CLIENT_TYPES = [
  { label: "법인사업자", Icon: Building2 },
  { label: "개인 사업자", Icon: CreditCard },
  { label: "개인",       Icon: User },
  { label: "팀",         Icon: Users },
];

/* ── StepHeader ─────────────────────────────── */
function StepHeader({ step }) {
  const { title, total } = STEP_INFO[step - 1];
  const pct = Math.round((step / total) * 100);
  return (
    <div style={{ marginBottom: 28 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#6366F1", letterSpacing: "0.1em", margin: "0 0 4px", fontFamily: F }}>
        STEP {step} OF {total}
      </p>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: "#0F172A", margin: 0, fontFamily: F }}>{title}</h2>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#6366F1", whiteSpace: "nowrap", fontFamily: F }}>
          {pct}% {pct === 100 ? "Complete 🎉" : "진행중 🚀"}
        </span>
      </div>
      <div style={{ height: 5, borderRadius: 999, backgroundColor: "#E2E8F0", overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 999,
          background: "linear-gradient(90deg, #60a5fa, #6366f1)",
          width: `${pct}%`, transition: "width 0.4s ease",
        }} />
      </div>
    </div>
  );
}

/* ── 입력 필드 ─────────────────────────────── */
function Field({ label, placeholder, value, onChange, type = "text" }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      aria-label={label}
      style={{
        width: "100%", padding: "14px 16px", borderRadius: 12,
        border: "1.5px solid #E2E8F0", fontSize: 14, fontWeight: 500,
        color: "#111827", fontFamily: F, outline: "none",
        boxSizing: "border-box", backgroundColor: "#FAFAFA",
        transition: "border 0.15s",
      }}
      onFocus={e => e.target.style.border = "1.5px solid #60A5FA"}
      onBlur={e  => e.target.style.border = "1.5px solid #E2E8F0"}
    />
  );
}

/* ── TypeCard ────────────────────────────────── */
function TypeCard({ Icon, label, selected, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "16px 20px", borderRadius: 14,
      border: selected ? "2.5px solid #3B82F6" : "1.5px solid #E2E8F0",
      background: selected ? "linear-gradient(135deg,#EFF6FF,#DBEAFE)" : "white",
      cursor: "pointer", fontFamily: F, textAlign: "left", width: "100%",
      transition: "all 0.15s",
    }}>
      <Icon size={20} color={selected ? "#3B82F6" : "#94A3B8"} strokeWidth={1.8} />
      <span style={{ fontSize: 14, fontWeight: selected ? 700 : 500, color: selected ? "#2563EB" : "#374151" }}>
        {label}
      </span>
    </button>
  );
}

/* ── STEP 2 ─────────────────────────────────── */
function Step2({ form, set }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: "0 0 12px", fontFamily: F }}>
          클라이언트 형태 <span style={{ color: "#EF4444" }}>*</span>
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {CLIENT_TYPES.map(({ label, Icon }) => (
            <TypeCard key={label} label={label} Icon={Icon}
              selected={form.clientType === label}
              onClick={() => set("clientType", label)} />
          ))}
        </div>
      </div>

      <div>
        <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 4px", fontFamily: F }}>
          클라이언트 프로젝트 관리 슬로건 <span style={{ color: "#EF4444" }}>*</span>
        </p>
        <p style={{ fontSize: 13, color: "#94A3B8", margin: "0 0 12px", fontFamily: F }}>
          프로젝트 목록에서 보여질 슬로건을 입력해주세요.
        </p>
        <Field label="슬로건" placeholder="예: 세상을 바꾸는 혁신적인 서비스를 만듭니다"
          value={form.sloganTitle} onChange={v => set("sloganTitle", v)} />
      </div>

    </div>
  );
}

/* ── 메인 컴포넌트 ─────────────────────────── */
function ClientRegister() {
  const navigate = useNavigate();
  const { signupFormData, setLogin, setUserRole, setUser, clearSignupFormData } = useStore();
  const [form, setFormRaw] = useState({ clientType: "", sloganTitle: "" });

  const set = (field, value) => setFormRaw(prev => ({ ...prev, [field]: value }));
  const valid = !!form.clientType && !!form.sloganTitle.trim();

  const next = async () => {
    if (!valid) return;

    if (!signupFormData) {
      alert("기본 회원가입 정보가 없습니다. 다시 시작해주세요.");
      navigate("/signup");
      return;
    }

    const payload = {
      email: signupFormData.idEmail,
      phone: signupFormData.phone,
      username: signupFormData.username,
      password: signupFormData.pw,
      userType: "CLIENT",
      interests: signupFormData.skills,
      industry: signupFormData.industry || null,
      birthDate: signupFormData.birthdate || null,
      clientType: form.clientType,
      slogan: form.sloganTitle,
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
        role: '클라이언트'
      });
      setLogin(data.email, "local");
      setUserRole("client");
      clearSignupFormData();
      alert(data.message);
      navigate("/client_home");
    } catch (error) {
      const msg = error?.response?.data?.message || "서버와 통신 중 오류가 발생했습니다.";
      console.error("Signup error:", error);
      alert(msg);
    }
  };
  const prev = () => navigate("/signup");

  return (
    <div style={{ minHeight: "100vh", fontFamily: F }}>
      {/* 블러 배경 */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0,
        backgroundImage: `url(${homeBg})`,
        backgroundSize: "cover", backgroundPosition: "center",
        filter: "blur(20px) brightness(0.80) saturate(1.1)",
        transform: "scale(1.1)",
      }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 0, backgroundColor: "rgba(220,230,248,0.35)" }} />

      {/* 상단 바: 로고 + Help Center */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 20,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 28px",
      }}>
        <img src={mainLogo} alt="Alpha-Helix"
          style={{ height: 28, objectFit: "contain", filter: "drop-shadow(0 1px 6px rgba(0,0,0,0.22))" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.90)", fontFamily: F,
            textShadow: "0 1px 4px rgba(0,0,0,0.25)" }}>Help Center</span>
          <HelpCircle size={18} color="rgba(255,255,255,0.85)" />
        </div>
      </div>

      {/* 중앙 카드 */}
      <div style={{
        position: "relative", zIndex: 1,
        display: "flex", justifyContent: "center", alignItems: "flex-start",
        minHeight: "100vh", padding: "88px 20px 64px",
      }}>
        <div style={{
          backgroundColor: "white", borderRadius: 24,
          boxShadow: "0 12px 48px rgba(0,0,0,0.13)",
          padding: "36px 44px 32px",
          width: "100%", maxWidth: 560,
        }}>
          <StepHeader step={1} />

          <div style={{ marginBottom: 28 }}>
            <Step2 form={form} set={set} />
          </div>

          {/* 하단 버튼 */}
          <div style={{ display: "flex", gap: 12, borderTop: "1px solid #F1F5F9", paddingTop: 20 }}>
            <button onClick={prev} style={{
              flexShrink: 0, padding: "14px 26px", borderRadius: 12,
              border: "1.5px solid #E2E8F0", background: "#F1F5F9",
              fontSize: 14, fontWeight: 600, color: "#64748B",
              cursor: "pointer", fontFamily: F,
            }}>이전 단계</button>
            <button onClick={valid ? next : undefined} style={{
              flex: 1, padding: "14px 0", borderRadius: 12,
              border: "none", fontSize: 14, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.25s",
              ...(valid ? ACTIVE : DISABLED),
            }}>
              클라이언트로 시작하기 🚀
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ClientRegister;
