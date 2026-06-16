import { useMemo, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, CheckCircle2, ArrowLeft } from "lucide-react";
import bannerVideo from "../assets/배너후보.mp4";
import { authApi } from "../api";

const BASE_FONT = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const GRAD = "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)";

function InputField({ icon: Icon, value, onChange, placeholder, type = "text", error, onBlur, suffix }) {
  return (
    <div style={{ marginBottom: error ? 4 : 16 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        border: `1.5px solid ${error ? "#EF4444" : "#E5E7EB"}`, borderRadius: 14,
        padding: "0 18px", height: 54, backgroundColor: "#fff",
      }}>
        <Icon size={17} color="#9CA3AF" strokeWidth={1.8} />
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          style={{
            flex: 1, border: "none", outline: "none", fontSize: 14,
            color: "#111", backgroundColor: "transparent", fontFamily: BASE_FONT,
          }}
        />
        {suffix}
      </div>
      {error && <p style={{ fontSize: 11, color: "#EF4444", margin: "4px 0 0 4px" }}>{error}</p>}
    </div>
  );
}

function PwField({ label, value, onChange, show, onToggle, placeholder, error, onBlur }) {
  return (
    <div style={{ marginBottom: error ? 4 : 16 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
        {label}
      </label>
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        border: `1.5px solid ${error ? "#EF4444" : "#E5E7EB"}`, borderRadius: 14,
        padding: "0 18px", height: 54, backgroundColor: "#fff",
      }}>
        <Lock size={17} color="#9CA3AF" strokeWidth={1.8} />
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          style={{
            flex: 1, border: "none", outline: "none", fontSize: 14,
            color: "#111", backgroundColor: "transparent", fontFamily: BASE_FONT,
          }}
        />
        <button type="button" onClick={onToggle}
          style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, display: "flex" }}>
          {show ? <EyeOff size={17} color="#9CA3AF" /> : <Eye size={17} color="#9CA3AF" />}
        </button>
      </div>
      {error && <p style={{ fontSize: 11, color: "#EF4444", margin: "4px 0 0 4px" }}>{error}</p>}
    </div>
  );
}

function ForgotPassword() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = 0.55; }, []);

  // step 1: 아이디 입력  /  step 2: 이메일 인증  /  step 3: 새 비밀번호  /  step 4: 완료
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  // Step 2 — 이메일 인증
  const [maskedEmail, setMaskedEmail] = useState("");
  const [storedEmail, setStoredEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [resending, setResending] = useState(false);

  // Step 3
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [touchedNew, setTouchedNew] = useState(false);
  const [touchedConfirm, setTouchedConfirm] = useState(false);

  const newPwError = useMemo(() => {
    if (!touchedNew || !newPw) return "";
    return /^(?=.*[0-9]).{8,16}$/.test(newPw) ? "" : "영문 8~16자, 숫자 포함이어야 합니다";
  }, [newPw, touchedNew]);

  const confirmPwError = useMemo(() => {
    if (!touchedConfirm || !confirmPw) return "";
    return confirmPw !== newPw ? "비밀번호가 일치하지 않습니다" : "";
  }, [confirmPw, newPw, touchedConfirm]);

  const step3Valid = newPw && confirmPw && !newPwError && !confirmPwError && /^(?=.*[0-9]).{8,16}$/.test(newPw);

  // Step 1 — 이메일로 사용자 찾기 + 인증코드 발송
  const handleFindUser = async () => {
    if (!email.trim()) { setEmailError("이메일을 입력해 주세요."); return; }
    setLoading(true);
    setEmailError("");
    try {
      const data = await authApi.findPassword(email.trim());
      setMaskedEmail(data.maskedEmail);
      setStoredEmail(data.email ?? email.trim());
      setCodeSent(true);
      setStep(2);
    } catch (e) {
      setEmailError(e?.response?.data?.message || "가입되지 않은 이메일입니다.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — 인증코드 재발송
  const handleResend = async () => {
    setResending(true);
    setCodeError("");
    try {
      await authApi.findPassword(storedEmail);
      setCode("");
    } catch {
      // silently ignore
    } finally {
      setResending(false);
    }
  };

  // Step 2 — 인증코드 확인
  const handleVerifyCode = async () => {
    if (!code.trim()) { setCodeError("인증번호를 입력해 주세요."); return; }
    setLoading(true);
    setCodeError("");
    try {
      // 등록된 이메일을 직접 알 수 없으므로 username으로 재요청 시 마스킹된 이메일이 있는 상태.
      // 백엔드 /verify/check-code 는 email이 필요하므로 findPassword 응답에서 email을 받아야 함.
      // 현재 auth.api.js findPassword는 maskedEmail만 반환하도록 설계되어 있으나
      // 백엔드는 실제 email도 반환함 → 여기서는 storedEmail을 Step 1에서 저장.
      await authApi.checkVerificationCode(storedEmail, code.trim());
      setStep(3);
    } catch (e) {
      setCodeError(e?.response?.data?.message || "인증번호가 올바르지 않습니다.");
    } finally {
      setLoading(false);
    }
  };

  // Step 3 — 비밀번호 재설정
  const handleReset = async () => {
    setTouchedNew(true);
    setTouchedConfirm(true);
    if (!step3Valid) return;
    setLoading(true);
    try {
      await authApi.resetPassword(storedEmail, newPw);
      setStep(4);
    } catch (e) {
      alert(e?.response?.data?.message || "비밀번호 재설정에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: BASE_FONT, position: "relative" }}>
      {/* 배경 비디오 */}
      <video
        ref={videoRef}
        src={bannerVideo}
        autoPlay loop muted playsInline
        style={{
          position: "fixed", inset: 0, zIndex: 0,
          width: "100%", height: "100%",
          objectFit: "cover",
          filter: "blur(12px) brightness(0.6)",
          transform: "scale(1.05)",
        }}
      />
      <div style={{
        position: "fixed", inset: 0, zIndex: 1,
        background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.55) 100%)",
      }} />

      <div style={{
        flex: 1, display: "flex", justifyContent: "center", alignItems: "center",
        position: "relative", zIndex: 2, padding: "40px 20px",
      }}>
        <div style={{
          width: "100%", maxWidth: 460, background: "white",
          borderRadius: 24, padding: "36px 40px 32px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        }}>

          {/* ── Step 1: 아이디 입력 ── */}
          {step === 1 && (
            <>
              <h1 style={{ textAlign: "center", fontSize: 24, fontWeight: 900, color: "#111", margin: "0 0 6px" }}>
                <span style={{ background: GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  비밀번호 찾기
                </span>
              </h1>
              <p style={{ textAlign: "center", fontSize: 13, color: "#9CA3AF", margin: "0 0 32px", fontWeight: 500 }}>
                가입 시 사용한 이메일을 입력해 주세요
              </p>

              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                이메일
              </label>
              <InputField
                icon={Mail}
                value={email}
                onChange={v => { setEmail(v); setEmailError(""); }}
                placeholder="가입한 이메일 입력"
                error={emailError}
              />

              <button
                onClick={handleFindUser}
                disabled={!email || loading}
                style={{
                  width: "100%", height: 54, borderRadius: 14, border: "none",
                  background: email && !loading ? GRAD : "#E5E7EB",
                  color: email && !loading ? "white" : "#9CA3AF",
                  fontSize: 15, fontWeight: 700, fontFamily: BASE_FONT,
                  cursor: email && !loading ? "pointer" : "not-allowed",
                  marginTop: 4, transition: "all 0.2s",
                }}
              >
                {loading ? "확인 중…" : "다음 →"}
              </button>

              <button onClick={() => navigate("/login")} style={{
                display: "flex", alignItems: "center", gap: 6, margin: "20px auto 0",
                background: "none", border: "none", color: "#9CA3AF", fontSize: 13,
                cursor: "pointer", fontFamily: BASE_FONT, transition: "color 0.15s",
              }}
                onMouseEnter={e => { e.currentTarget.style.color = "#374151"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "#9CA3AF"; }}
              >
                <ArrowLeft size={14} /> 로그인으로 돌아가기
              </button>
            </>
          )}

          {/* ── Step 2: 이메일 인증 ── */}
          {step === 2 && (
            <>
              <h1 style={{ textAlign: "center", fontSize: 24, fontWeight: 900, color: "#111", margin: "0 0 6px" }}>
                이메일 인증
              </h1>
              <p style={{ textAlign: "center", fontSize: 13, color: "#9CA3AF", margin: "0 0 8px", fontWeight: 500 }}>
                등록된 이메일로 인증번호를 발송했습니다
              </p>
              <p style={{ textAlign: "center", fontSize: 14, fontWeight: 700, color: "#3B82F6", margin: "0 0 28px" }}>
                {maskedEmail}
              </p>

              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                인증번호
              </label>
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                border: `1.5px solid ${codeError ? "#EF4444" : "#E5E7EB"}`, borderRadius: 14,
                padding: "0 18px", height: 54, backgroundColor: "#fff", marginBottom: codeError ? 0 : 16,
              }}>
                <Mail size={17} color="#9CA3AF" strokeWidth={1.8} />
                <input
                  type="text"
                  value={code}
                  onChange={e => { setCode(e.target.value); setCodeError(""); }}
                  placeholder="인증번호 6자리"
                  maxLength={6}
                  style={{
                    flex: 1, border: "none", outline: "none", fontSize: 14,
                    color: "#111", backgroundColor: "transparent", fontFamily: BASE_FONT,
                    letterSpacing: "0.12em",
                  }}
                />
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  style={{
                    border: "none", background: "transparent", cursor: resending ? "not-allowed" : "pointer",
                    fontSize: 12, color: "#6B7280", fontFamily: BASE_FONT, padding: "4px 0", whiteSpace: "nowrap",
                  }}
                >
                  {resending ? "발송 중…" : "재발송"}
                </button>
              </div>
              {codeError && <p style={{ fontSize: 11, color: "#EF4444", margin: "4px 0 12px 4px" }}>{codeError}</p>}

              <button
                onClick={handleVerifyCode}
                disabled={!code || loading}
                style={{
                  width: "100%", height: 54, borderRadius: 14, border: "none",
                  background: code && !loading ? GRAD : "#E5E7EB",
                  color: code && !loading ? "white" : "#9CA3AF",
                  fontSize: 15, fontWeight: 700, fontFamily: BASE_FONT,
                  cursor: code && !loading ? "pointer" : "not-allowed",
                  marginTop: 4, transition: "all 0.2s",
                }}
              >
                {loading ? "확인 중…" : "인증 확인 →"}
              </button>

              <button onClick={() => setStep(1)} style={{
                display: "flex", alignItems: "center", gap: 6, margin: "20px auto 0",
                background: "none", border: "none", color: "#9CA3AF", fontSize: 13,
                cursor: "pointer", fontFamily: BASE_FONT, transition: "color 0.15s",
              }}
                onMouseEnter={e => { e.currentTarget.style.color = "#374151"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "#9CA3AF"; }}
              >
                <ArrowLeft size={14} /> 이전 단계
              </button>
            </>
          )}

          {/* ── Step 3: 새 비밀번호 입력 ── */}
          {step === 3 && (
            <>
              <h1 style={{ textAlign: "center", fontSize: 24, fontWeight: 900, color: "#111", margin: "0 0 6px" }}>
                새 비밀번호 설정
              </h1>
              <p style={{ textAlign: "center", fontSize: 13, color: "#9CA3AF", margin: "0 0 32px", fontWeight: 500 }}>
                사용할 새 비밀번호를 입력해 주세요
              </p>

              <PwField
                label="새 비밀번호"
                value={newPw}
                onChange={setNewPw}
                show={showNewPw}
                onToggle={() => setShowNewPw(v => !v)}
                placeholder="영문 8~16자, 숫자 포함"
                error={newPwError}
                onBlur={() => setTouchedNew(true)}
              />

              <PwField
                label="비밀번호 확인"
                value={confirmPw}
                onChange={setConfirmPw}
                show={showConfirmPw}
                onToggle={() => setShowConfirmPw(v => !v)}
                placeholder="비밀번호를 다시 입력해 주세요"
                error={confirmPwError}
                onBlur={() => setTouchedConfirm(true)}
              />

              <button
                onClick={handleReset}
                disabled={loading}
                style={{
                  width: "100%", height: 54, borderRadius: 14, border: "none",
                  background: step3Valid && !loading ? GRAD : "#E5E7EB",
                  color: step3Valid && !loading ? "white" : "#9CA3AF",
                  fontSize: 15, fontWeight: 700, fontFamily: BASE_FONT,
                  cursor: step3Valid && !loading ? "pointer" : "not-allowed",
                  marginTop: 8, transition: "all 0.2s",
                }}
              >
                {loading ? "변경 중…" : "비밀번호 변경"}
              </button>
            </>
          )}

          {/* ── Step 4: 완료 ── */}
          {step === 4 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0 8px" }}>
              <CheckCircle2 size={56} color="#3B82F6" strokeWidth={1.5} style={{ marginBottom: 20 }} />
              <h1 style={{ fontSize: 22, fontWeight: 900, color: "#111", margin: "0 0 10px", textAlign: "center" }}>
                비밀번호 변경 완료
              </h1>
              <p style={{ fontSize: 13, color: "#6B7280", textAlign: "center", lineHeight: 1.7, margin: "0 0 32px" }}>
                비밀번호가 성공적으로 변경되었습니다.<br />
                새 비밀번호로 로그인해 주세요.
              </p>
              <button
                onClick={() => navigate("/login")}
                style={{
                  width: "100%", height: 54, borderRadius: 14, border: "none",
                  background: GRAD, color: "white",
                  fontSize: 15, fontWeight: 700, fontFamily: BASE_FONT, cursor: "pointer",
                }}
              >
                로그인하러 가기
              </button>
            </div>
          )}

          <p style={{ textAlign: "center", fontSize: 11, color: "#D1D5DB", margin: "28px 0 0", letterSpacing: "0.06em" }}>
            © 2026 ALPHA-HELIX COLLABORATIVE SYSTEMS
          </p>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
