import { useMemo, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff, RotateCcw, CheckCircle2, ArrowLeft } from "lucide-react";
import bannerVideo from "../assets/배너후보.mp4";
import { authApi } from "../api";

const BASE_FONT = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const GRAD = "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)";

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
        transition: "border-color 0.15s",
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

function FindPassword() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = 0.55; }, []);

  const [step, setStep] = useState(1);           // 1: 현재 비밀번호 확인 / 2: 새 비밀번호 입력 / 3: 완료
  const [loading, setLoading] = useState(false);

  // Step 1
  const [currentPw, setCurrentPw]           = useState("");
  const [showCurrentPw, setShowCurrentPw]   = useState(false);
  const [currentPwError, setCurrentPwError] = useState("");

  // Step 2
  const [newPw, setNewPw]                   = useState("");
  const [confirmPw, setConfirmPw]           = useState("");
  const [showNewPw, setShowNewPw]           = useState(false);
  const [showConfirmPw, setShowConfirmPw]   = useState(false);
  const [touchedNew, setTouchedNew]         = useState(false);
  const [touchedConfirm, setTouchedConfirm] = useState(false);

  const newPwError = useMemo(() => {
    if (!touchedNew || !newPw) return "";
    return /^(?=.*[0-9]).{8,16}$/.test(newPw) ? "" : "영문 8~16자, 숫자 포함이어야 합니다";
  }, [newPw, touchedNew]);

  const confirmPwError = useMemo(() => {
    if (!touchedConfirm || !confirmPw) return "";
    return confirmPw !== newPw ? "비밀번호가 일치하지 않습니다" : "";
  }, [confirmPw, newPw, touchedConfirm]);

  const step2Valid = newPw && confirmPw && !newPwError && !confirmPwError && /^(?=.*[0-9]).{8,16}$/.test(newPw);

  // Step 1 — 현재 비밀번호 검증
  const handleVerify = async () => {
    if (!currentPw) { setCurrentPwError("현재 비밀번호를 입력해 주세요."); return; }
    setLoading(true);
    setCurrentPwError("");
    try {
      await authApi.verifyPassword(currentPw);
      setStep(2);
    } catch (e) {
      setCurrentPwError(e?.response?.data?.message || "현재 비밀번호가 일치하지 않습니다.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — 비밀번호 변경
  const handleChange = async () => {
    setTouchedNew(true);
    setTouchedConfirm(true);
    if (!step2Valid) return;
    setLoading(true);
    try {
      await authApi.changePassword(currentPw, newPw);
      setStep(3);
    } catch (e) {
      alert(e?.response?.data?.message || "비밀번호 변경에 실패했습니다.");
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

      {/* 카드 */}
      <div style={{
        flex: 1, display: "flex", justifyContent: "center", alignItems: "center",
        position: "relative", zIndex: 2, padding: "40px 20px",
      }}>
        <div style={{
          width: "100%", maxWidth: 460, background: "white",
          borderRadius: 24, padding: "36px 40px 32px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        }}>

          {/* ── Step 1: 현재 비밀번호 확인 ── */}
          {step === 1 && (
            <>
              <h1 style={{ textAlign: "center", fontSize: 24, fontWeight: 900, color: "#111", margin: "0 0 6px" }}>
                <span style={{
                  background: GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                  fontFamily: "'Inter Tight', sans-serif", fontWeight: 500, letterSpacing: -0.3,
                }}>
                  ALPHA-HELIX
                </span>{" "}비밀번호 변경
              </h1>
              <p style={{ textAlign: "center", fontSize: 13, color: "#9CA3AF", margin: "0 0 32px", fontWeight: 500 }}>
                현재 비밀번호를 입력해 주세요
              </p>

              <PwField
                label="현재 비밀번호"
                value={currentPw}
                onChange={v => { setCurrentPw(v); setCurrentPwError(""); }}
                show={showCurrentPw}
                onToggle={() => setShowCurrentPw(v => !v)}
                placeholder="현재 사용 중인 비밀번호"
                error={currentPwError}
              />

              <button
                onClick={handleVerify}
                disabled={!currentPw || loading}
                style={{
                  width: "100%", height: 54, borderRadius: 14, border: "none",
                  background: currentPw && !loading ? GRAD : "#E5E7EB",
                  color: currentPw && !loading ? "white" : "#9CA3AF",
                  fontSize: 15, fontWeight: 700, fontFamily: BASE_FONT,
                  cursor: currentPw && !loading ? "pointer" : "not-allowed",
                  marginTop: 8, transition: "all 0.2s",
                }}
              >
                {loading ? "확인 중…" : "다음 →"}
              </button>

              <button onClick={() => navigate(-1)} style={{
                display: "flex", alignItems: "center", gap: 6, margin: "20px auto 0",
                background: "none", border: "1.5px solid #D1D5DB", borderRadius: 10,
                color: "#374151", fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: BASE_FONT, padding: "9px 20px",
                transition: "border-color 0.15s, color 0.15s",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#3B82F6"; e.currentTarget.style.color = "#3B82F6"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#D1D5DB"; e.currentTarget.style.color = "#374151"; }}
              >
                <ArrowLeft size={14} /> 뒤로가기
              </button>
            </>
          )}

          {/* ── Step 2: 새 비밀번호 입력 ── */}
          {step === 2 && (
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
                onClick={handleChange}
                disabled={loading}
                style={{
                  width: "100%", height: 54, borderRadius: 14, border: "none",
                  background: step2Valid && !loading ? GRAD : "#E5E7EB",
                  color: step2Valid && !loading ? "white" : "#9CA3AF",
                  fontSize: 15, fontWeight: 700, fontFamily: BASE_FONT,
                  cursor: step2Valid && !loading ? "pointer" : "not-allowed",
                  marginTop: 8, transition: "all 0.2s",
                }}
              >
                {loading ? "변경 중…" : "변경 완료"}
              </button>

              <button onClick={() => setStep(1)} style={{
                display: "flex", alignItems: "center", gap: 6, margin: "20px auto 0",
                background: "none", border: "1.5px solid #D1D5DB", borderRadius: 10,
                color: "#374151", fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: BASE_FONT, padding: "9px 20px",
                transition: "border-color 0.15s, color 0.15s",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#3B82F6"; e.currentTarget.style.color = "#3B82F6"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#D1D5DB"; e.currentTarget.style.color = "#374151"; }}
              >
                <ArrowLeft size={14} /> 이전 단계
              </button>
            </>
          )}

          {/* ── Step 3: 완료 ── */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0 8px" }}>
              <CheckCircle2 size={56} color="#3B82F6" strokeWidth={1.5} style={{ marginBottom: 20 }} />
              <h1 style={{ fontSize: 22, fontWeight: 900, color: "#111", margin: "0 0 10px", textAlign: "center" }}>
                비밀번호 변경 완료
              </h1>
              <p style={{ fontSize: 13, color: "#6B7280", textAlign: "center", lineHeight: 1.7, margin: "0 0 32px" }}>
                비밀번호가 성공적으로 변경되었습니다.<br />
                현재 로그인은 그대로 유지됩니다.
              </p>
              <button
                onClick={() => navigate("/mypage")}
                style={{
                  width: "100%", height: 54, borderRadius: 14, border: "none",
                  background: GRAD, color: "white",
                  fontSize: 15, fontWeight: 700, fontFamily: BASE_FONT, cursor: "pointer",
                }}
              >
                마이페이지로 돌아가기
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

export default FindPassword;
