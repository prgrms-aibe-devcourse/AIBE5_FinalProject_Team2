import { useState, useRef, useEffect } from "react";
import { Pencil, ChevronDown as ChDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import useStore from "../store/useStore";
import { profileApi } from "../api/profile.api";
import heroDefault from "../assets/hero_default.png";
import mainLogo from "../assets/main_logo.png";
import { openResumePrintWindow } from "../lib/generateResumeHtml";

const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/* ── 경력 레벨 변환 ─────────────────────────────────────────── */
function getDevLevelKorean(devLevel) {
  const levelMap = {
    'JUNIOR_1_3Y': '주니어',
    'MIDDLE_3_5Y': '미들',
    'SENIOR_5_7Y': '시니어',
    'EXPERT_7Y_PLUS': '엑스퍼트',
  };
  return levelMap[devLevel] || '주니어';
}

/* ── 드롭다운 칩 ─────────────────────────────────────────────
   PartnerDashboard 기준 디자인 (pill shape, borderRadius 99)
   ─────────────────────────────────────────────────────────── */
function DropdownChip({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "7px 14px 7px 13px", borderRadius: 99,
          border: "1.5px solid #D1D5DB", background: "white",
          color: "#1E293B", fontSize: 13, fontWeight: 600,
          cursor: "pointer", fontFamily: F,
          transition: "border-color 0.15s",
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = "#93C5FD"}
        onMouseLeave={e => e.currentTarget.style.borderColor = "#D1D5DB"}
      >
        {value} <ChDown size={13} strokeWidth={2.5} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "110%", left: 0,
          background: "white", border: "1px solid #E5E7EB",
          borderRadius: 10, padding: "4px 0", zIndex: 99,
          minWidth: 120, boxShadow: "0 4px 14px rgba(0,0,0,0.10)",
        }}>
          {options.map(op => (
            <div
              key={op}
              onClick={() => { onChange(op); setOpen(false); }}
              style={{
                padding: "9px 16px", fontSize: 13,
                color: op === value ? "#3B82F6" : "#374151",
                fontWeight: op === value ? 700 : 500,
                cursor: "pointer", fontFamily: F,
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >{op}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── 티어 프로그레스 헬퍼 ─────────────────────────────────── */
const TIER_THRESHOLDS = { silver: 25, gold: 45, platinum: 70 };
const TIER_NEXT_LABEL = { silver: "TO GOLD", gold: "TO PLATINUM", platinum: "TO DIAMOND", diamond: "DIAMOND" };
const TIER_COLOR = { silver: "#64748B", gold: "#F59E0B", platinum: "#8B5CF6", diamond: "#3B82F6" };
const CIRCUMFERENCE = 107; // 2π×17 ≈ 106.8
function computeTierProgress(grade, completedProjects = 0, rating = 0) {
  const tier = (grade || "silver").toLowerCase();
  if (tier === "diamond") return { pct: 100, dashLen: CIRCUMFERENCE, label: "DIAMOND", color: TIER_COLOR.diamond };
  const threshold = TIER_THRESHOLDS[tier] || 25;
  const pct = Math.min(99, Math.round((completedProjects / threshold) * 60 + (rating / 5) * 40));
  return { pct, dashLen: Math.round((pct / 100) * CIRCUMFERENCE * 10) / 10, label: TIER_NEXT_LABEL[tier] || "TO GOLD", color: TIER_COLOR[tier] || TIER_COLOR.silver };
}

/* ── 파트너 배너 카드 ──────────────────────────────────────────
   activePage: "dashboard" | "portfolio" | "profile"
   ─────────────────────────────────────────────────────────── */
export default function PartnerBannerCard({ activePage, viewMode = false, partnerData = null }) {
  const navigate = useNavigate();
  const store = useStore();
  const {
    loginUser, user,
    //partnerSubTitle, setPartnerSubTitle,
    partnerDropdowns, setPartnerDropdown,
    partnerBannerBg, setPartnerBannerBg,
    partnerProfile,
    //partnerProfileDetail,
    profileRefreshTrigger,
    bumpProfileRefresh,
    dbId,
    userRole,
  } = store;

  // 이력서 다운로드 모달 (편집 모드 전용)
  const [showResumeModal, setShowResumeModal] = useState(false);
  const handleGenerateResume = (lang) => {
    setShowResumeModal(false);
    const logoUrl = window.location.origin + mainLogo;
    // 편집 모드: dbData(본인 데이터) 사용. partnerData는 null이므로 dbData로 대체
    const resumeData = viewMode ? partnerData : (dbData || {});
    openResumePrintWindow(resumeData, lang, logoUrl);
  };

  // 자유 미팅 시작 버튼 핸들러 (viewMode 전용)
  const [startingFreeMeeting, setStartingFreeMeeting] = useState(false);
  const handleStartFreeMeeting = async () => {
    const targetUserId = partnerData?.userId || partnerData?.id;
    if (!dbId) { alert("로그인 정보를 불러올 수 없어요. 다시 로그인해주세요."); return; }
    if (!targetUserId) { alert("상대방 정보를 불러올 수 없어요."); return; }
    if (Number(dbId) === Number(targetUserId)) { alert("본인과는 자유 미팅을 시작할 수 없어요."); return; }
    setStartingFreeMeeting(true);
    try {
      const token = localStorage.getItem("accessToken");
      const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const res = await fetch(`/api/chat/rooms/dm?userId=${dbId}`, {
        method: "POST", headers,
        body: JSON.stringify({ targetUserId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const dashboardPath = userRole === "client" ? "/client_dashboard" : "/partner_dashboard";
      navigate(`${dashboardPath}?tab=free_meeting&dm=${targetUserId}`);
    } catch (err) {
      console.error("[FreeMeeting] DM 생성 실패:", err);
      alert("자유 미팅 시작에 실패했어요.");
    } finally {
      setStartingFreeMeeting(false);
    }
  };

  // 본인/타인 모두 안정적 표시 필드는 username (회원가입 시 입력한 로그인 핸들) 으로 통일
  // - viewMode (타인 프로필 보기): partnerData.username
  // - 본인: store user.username → localStorage.username → 이메일 prefix(최후 안전망)
  const storedUsername = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
  const displayName = viewMode
    ? (partnerData?.username ? `@${partnerData.username}` : "@파트너")
    : (user?.username ? `@${user.username}` : (storedUsername ? `@${storedUsername}` : (loginUser ? `@${loginUser.split("@")[0]}` : "@Yeon_Eden")));

  const [editingSubTitle, setEditingSubTitle] = useState(false);
  const [subTitleDraft, setSubTitleDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [dbData, setDbData] = useState(null);
  const bannerFileRef = useRef(null);

  const subTitle = viewMode 
    ? (partnerData?.slogan || partnerData?.sloganSub || "") 
    : (dbData?.slogan || "");
  const drops = viewMode
    ? { category: partnerData?.serviceField || "개발", type: partnerData?.level || "주니어", location: "서울", workStyle: partnerData?.workPref || "외주선호" }
    : { 
        category: user?.serviceField || partnerProfile?.serviceField || partnerDropdowns.category, 
        type: partnerDropdowns.type, 
        location: partnerDropdowns.location, 
        workStyle: partnerDropdowns.workStyle 
      };
  const bannerBg = viewMode ? null : partnerBannerBg;

  /* 티어 프로그레스 계산 */
  const tierGrade = viewMode ? (partnerData?.grade) : (dbData?.grade || partnerProfile?.grade);
  const tierCompleted = viewMode ? (partnerData?.completedProjects ?? 0) : (dbData?.completedProjects ?? partnerProfile?.completedProjects ?? 0);
  const tierRating = viewMode ? (partnerData?.rating ?? 0) : (dbData?.rating ?? partnerProfile?.rating ?? 0);
  const tierProgress = computeTierProgress(tierGrade, tierCompleted, tierRating);

  // DB에서 최신 데이터 가져오기 (viewMode가 아닐 때만, profileRefreshTrigger 바뀌면 재조회)
  useEffect(() => {
    if (!viewMode) {
      const fetchData = async () => {
        try {
          const data = await profileApi.getMyDetail();
          console.log("✅ PartnerBannerCard - DB 데이터 로드:", data);
          console.log("   📌 slogan:", data?.slogan);
          console.log("   📌 shortBio:", data?.shortBio);
          console.log("   📌 profileImageUrl:", data?.profileImageUrl);
          setDbData(data);
        } catch (err) {
          console.error("프로필 데이터 로드 실패:", err);
        }
      };
      fetchData();
    }
  }, [viewMode, profileRefreshTrigger]);

  const handleBannerFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setPartnerBannerBg(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  /* 우측 버튼 3개 — activePage인 버튼만 primary 강조 */
  const navButtons = [
    { key: "profile",   label: "내 파트너 프로필 관리", route: "/partner_profile" },
    { key: "portfolio", label: "마이 포트폴리오",         route: "/partner_portfolio" },
    { key: "dashboard", label: "관리 대시보드",           route: "/partner_dashboard" },
  ];

  return (
    <div style={{
      background: bannerBg
        ? `url(${bannerBg}) center/cover no-repeat`
        : "linear-gradient(135deg, #EEF2FF 0%, #E0F2FE 50%, #F5F3FF 100%)",
      borderRadius: 24, padding: "20px 40px",
      display: "flex", alignItems: "center", gap: 32,
      marginBottom: 24,
      ...(viewMode ? {} : { marginLeft: -38, marginRight: -38 }),
      border: "1.5px solid #C7D2FE",
      boxShadow: "0 2px 10px rgba(99,102,241,0.10)",
      position: "relative",
      minHeight: viewMode ? 280 : undefined,
    }}>
      {/* 프로필 아바타 */}
      <div style={{
        width: 180, height: 180, borderRadius: "50%",
        background: "white",
        border: "4px solid white",
        boxShadow: "0 6px 24px rgba(59,130,246,0.20)",
        overflow: "hidden", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <img
          src={(() => {
            const raw = viewMode
              ? (partnerData?.profileImageUrl)
              : (dbData?.profileImageUrl || user?.heroImage);
            if (!raw || /cdn\.Alpha-Helix\.com/i.test(raw)) return heroDefault;
            return raw;
          })()}
          alt="avatar"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={(e) => { e.currentTarget.src = heroDefault; }}
        />
      </div>

      {/* 메인 정보 */}
      <div style={{ flex: 1 }}>
        {/* 이름 + 인증 배지 + 부제목 — 반투명 흰색 블러 배경 */}
        <div style={{
          display: "inline-block",
          background: "rgba(255,255,255,0.72)",
          borderRadius: 14, padding: "14px 20px 14px 16px",
          marginBottom: 14,
          backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          maxWidth: "100%",
        }}>
          {/* 이름 + 인증 배지 */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
            <span style={{ fontSize: 30, fontWeight: 800, color: "#1E293B", fontFamily: F }}>{displayName}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 99, padding: "3px 10px", fontSize: 12, fontWeight: 700, color: "#7C3AED", fontFamily: F }}>
              🏷️ {viewMode ? (partnerData?.devLevel ? getDevLevelKorean(partnerData.devLevel) : drops.type) : drops.type}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 99, padding: "3px 10px", fontSize: 12, fontWeight: 600, color: "#3B82F6", fontFamily: F }}>
              🎖️ 학력 인증 완료
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, background: "#F0FFF4", border: "1px solid #BBF7D0", borderRadius: 99, padding: "3px 10px", fontSize: 12, fontWeight: 600, color: "#16A34A", fontFamily: F }}>
              🎖️ 경력 인증 완료
            </span>
          </div>
          {/* 부제목 */}
          {!viewMode && editingSubTitle ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                value={subTitleDraft}
                onChange={e => setSubTitleDraft(e.target.value)}
                autoFocus
                onKeyDown={async e => {
                  if (e.key === "Enter") {
                    setSaving(true);
                    try {
                      console.log("🔵 슬로건 저장 시작 (Enter):", subTitleDraft);
                      await profileApi.updateBasicInfo({ slogan: subTitleDraft });
                      console.log("✅ 슬로건 저장 완료");
                      const freshData = await profileApi.getMyDetail();
                      console.log("📥 저장 후 DB 데이터:", freshData);
                      console.log("   slogan:", freshData?.slogan);
                      setDbData(freshData);
                      bumpProfileRefresh();
                      setEditingSubTitle(false);
                    } catch (err) {
                      console.error("❌ 슬로건 저장 실패:", err);
                      alert("슬로건 저장에 실패했습니다.");
                    } finally {
                      setSaving(false);
                    }
                  }
                  if (e.key === "Escape") setEditingSubTitle(false);
                }}
                style={{ flex: 1, fontSize: 15, color: "#475569", fontFamily: F, padding: "8px 12px", border: "1.5px solid #93C5FD", borderRadius: 10, outline: "none", background: "white" }}
              />
              <button
                onClick={async () => {
                  setSaving(true);
                  try {
                    console.log("🔵 슬로건 저장 시작:", subTitleDraft);
                    await profileApi.updateBasicInfo({ slogan: subTitleDraft });
                    console.log("✅ 슬로건 저장 완료");
                    const freshData = await profileApi.getMyDetail();
                    console.log("📥 저장 후 DB 데이터:", freshData);
                    console.log("   slogan:", freshData?.slogan);
                    setDbData(freshData);
                    bumpProfileRefresh();
                    setEditingSubTitle(false);
                  } catch (err) {
                    console.error("❌ 슬로건 저장 실패:", err);
                    alert("슬로건 저장에 실패했습니다.");
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)", color: "white", fontSize: 12, fontWeight: 700, fontFamily: F, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}
              >{saving ? "저장중..." : "저장"}</button>
              <button onClick={() => setEditingSubTitle(false)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #E2E8F0", background: "white", color: "#64748B", fontSize: 12, fontWeight: 600, fontFamily: F, cursor: "pointer" }}>취소</button>
            </div>
          ) : (
            <p style={{ fontSize: 15, color: "#475569", fontFamily: F, margin: 0, lineHeight: 1.6 }}>
              {subTitle || <span style={{ color: "#94A3B8", fontStyle: "italic" }}>부제목을 입력하려면 연필 아이콘을 클릭하세요</span>}
            </p>
          )}
          {/* 한줄 자기소개 */}
          <p style={{ fontSize: 13, color: "#64748B", fontFamily: F, margin: "8px 0 0 0", lineHeight: 1.5 }}>
            {viewMode ? (partnerData?.shortBio || "") : (dbData?.shortBio || "")}
          </p>
        </div>

        {/* 태그 칩 */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
          {viewMode ? (
            <>
              {[drops.category, drops.type, drops.location, drops.workStyle].map((v, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 14px", borderRadius: 99, background: "rgba(255,255,255,0.82)", border: "1.5px solid #C7D2FE", fontSize: 13, fontWeight: 600, color: "#3730A3", fontFamily: "'Pretendard', sans-serif" }}>{v}</span>
              ))}
            </>
          ) : (
            <>
              <DropdownChip
                options={["AI", "커머스", "웹사이트", "디자인/기획", "유지보수", "핀테크", "SaaS", "모바일", "클라우드"]}
                value={dbData?.serviceField || partnerProfile?.serviceField || drops.category}
                onChange={async v => {
                  try {
                    const cur = await profileApi.getMyDetail().catch(() => ({}));
                    await profileApi.saveMyDetail({ ...(cur || {}), serviceField: v });
                    setDbData(prev => ({ ...(prev || {}), serviceField: v }));
                    bumpProfileRefresh();
                  } catch (e) { console.error("serviceField 저장 실패:", e); }
                }}
              />
              <DropdownChip options={["주니어", "미들", "시니어", "엑스퍼트"]}          value={drops.type}      onChange={v => setPartnerDropdown("type",      v)} />
              <DropdownChip options={["서울", "경기권", "수도권", "지방"]}  value={drops.location}  onChange={v => setPartnerDropdown("location",  v)} />
              <DropdownChip options={["외주선호", "상주선호"]}              value={drops.workStyle} onChange={v => setPartnerDropdown("workStyle", v)} />
            </>
          )}
        </div>

        {/* 티어 프로그레스 */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.72)", borderRadius: 14, padding: "10px 16px", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
          <svg width={42} height={42} viewBox="0 0 42 42">
            <circle cx="21" cy="21" r="17" fill="none" stroke="#E2E8F0" strokeWidth="4" />
            <circle cx="21" cy="21" r="17" fill="none" stroke={tierProgress.color} strokeWidth="4" strokeDasharray={`${tierProgress.dashLen} ${CIRCUMFERENCE}`} strokeLinecap="round" transform="rotate(-90 21 21)" />
            <text x="21" y="26" textAnchor="middle" fontSize="10" fontWeight="700" fill={tierProgress.color} fontFamily={F}>{tierProgress.pct}%</text>
          </svg>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.1em", fontFamily: F }}>TIER PROGRESS</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#1E293B", fontFamily: F }}>{tierProgress.label}</div>
          </div>
          {/* 연필 버튼 - 부제목 수정 (편집 모드에서만) */}
          {!viewMode && (
            <button
              onClick={() => { setSubTitleDraft(dbData?.slogan || ""); setEditingSubTitle(true); }}
              title="부제목 수정"
              style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #D1D5DB", background: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "background 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#EFF6FF"; e.currentTarget.style.borderColor = "#93C5FD"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "white"; e.currentTarget.style.borderColor = "#D1D5DB"; }}
            >
              <Pencil size={14} color="#9CA3AF" />
            </button>
          )}
          {/* 카메라 버튼 - 배너 배경 변경 (편집 모드에서만) */}
          {!viewMode && (
            <>
              <button
                onClick={() => bannerFileRef.current.click()}
                title="배너 이미지 변경"
                style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #D1D5DB", background: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "background 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#FEF9C3"; e.currentTarget.style.borderColor = "#FDE047"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "white"; e.currentTarget.style.borderColor = "#D1D5DB"; }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                  <circle cx="12" cy="13" r="2" fill="#9CA3AF" stroke="none"/>
                </svg>
              </button>
              <input ref={bannerFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleBannerFileChange} />
            </>
          )}
        </div>
      </div>

      {/* 우측 버튼 그룹 - 편집 모드에서만 */}
      {!viewMode && <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0, minWidth: 196, alignSelf: "stretch", justifyContent: "flex-end" }}>
        {navButtons.map(btn => {
          const isActive = btn.key === activePage;
          return isActive ? (
            <button
              key={btn.key}
              style={{ padding: "10px 20px", borderRadius: 99, border: "none", background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: F, boxShadow: "0 3px 10px rgba(99,102,241,0.30)", whiteSpace: "nowrap", transition: "opacity 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >{btn.label}</button>
          ) : (
            <button
              key={btn.key}
              onClick={() => navigate(btn.route)}
              style={{ padding: "10px 20px", borderRadius: 99, border: "1.5px solid #D1D5DB", background: "white", color: "#374151", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: F, whiteSpace: "nowrap", transition: "background 0.15s, color 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#FEF9C3"; e.currentTarget.style.color = "#713f12"; e.currentTarget.style.borderColor = "#FDE047"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "white"; e.currentTarget.style.color = "#374151"; e.currentTarget.style.borderColor = "#D1D5DB"; }}
            >{btn.label}</button>
          );
        })}
        {/* 이력서 다운로드 버튼 - navButtons 아래 */}
        <div style={{ marginTop: "auto" }}>
          <div style={{ fontSize: 10, color: "#94A3B8", fontFamily: F, fontWeight: 500, textAlign: "center", marginBottom: 4 }}>이력서+포트폴리오가 합쳐진</div>
          <button
            onClick={() => setShowResumeModal(true)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              padding: "10px 14px", borderRadius: 99, border: "none",
              background: "linear-gradient(135deg, #BAE6FD 0%, #C4B5FD 100%)",
              color: "#1e3a5f", fontSize: 13, fontWeight: 700,
              cursor: "pointer", fontFamily: F,
              boxShadow: "0 3px 10px rgba(167,139,250,0.28)",
              transition: "opacity 0.15s",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            ALPHA-HELIX 이력서 다운로드
          </button>
        </div>
      </div>}

      {/* 언어 선택 모달 (편집 모드 전용) */}
      {!viewMode && showResumeModal && (
        <div
          onClick={() => setShowResumeModal(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "white", borderRadius: 20, padding: "32px 36px", width: 340, boxShadow: "0 24px 80px rgba(0,0,0,0.22)", position: "relative" }}
          >
            <button onClick={() => setShowResumeModal(false)} style={{ position: "absolute", top: 14, right: 16, background: "none", border: "none", fontSize: 20, color: "#94A3B8", cursor: "pointer", lineHeight: 1 }}>✕</button>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <img src={mainLogo} alt="ALPHA-HELIX" style={{ height: 28, objectFit: "contain" }} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: "#1E293B", fontFamily: F, marginBottom: 6 }}>이력서 언어 선택</h3>
            <p style={{ fontSize: 13, color: "#64748B", fontFamily: F, marginBottom: 22, lineHeight: 1.6 }}>포트폴리오가 포함된 ALPHA-HELIX 이력서를<br/>인쇄하거나 PDF로 저장할 수 있어요.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => handleGenerateResume("ko")}
                style={{ flex: 1, padding: "13px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #BAE6FD 0%, #C4B5FD 100%)", color: "#1e3a5f", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: F, boxShadow: "0 2px 8px rgba(167,139,250,0.25)", transition: "opacity 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
                onMouseLeave={e => e.currentTarget.style.opacity = "1"}
              >🇰🇷 한국어</button>
              <button
                onClick={() => handleGenerateResume("en")}
                style={{ flex: 1, padding: "13px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #BAE6FD 0%, #C4B5FD 100%)", color: "#1e3a5f", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: F, boxShadow: "0 2px 8px rgba(167,139,250,0.25)", transition: "opacity 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
                onMouseLeave={e => e.currentTarget.style.opacity = "1"}
              >🇺🇸 English</button>
            </div>
          </div>
        </div>
      )}

      {/* 우측 버튼 - 뷰 모드에서 자유 미팅 시작 (우측 하단 고정) */}
      {viewMode && (
        <div style={{
          position: "absolute",
          right: 32,
          bottom: 24,
          display: "flex", flexDirection: "column", gap: 10,
          alignItems: "stretch", justifyContent: "center",
          minWidth: 196,
        }}>
          <button
            onClick={handleStartFreeMeeting}
            disabled={startingFreeMeeting}
            style={{
              padding: "14px 22px", borderRadius: 14, border: "none",
              background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)",
              color: "white", fontSize: 15, fontWeight: 700, cursor: startingFreeMeeting ? "wait" : "pointer",
              fontFamily: F, boxShadow: "0 6px 18px rgba(99,102,241,0.35)",
              whiteSpace: "nowrap", transition: "transform 0.15s, box-shadow 0.15s",
              opacity: startingFreeMeeting ? 0.7 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
            onMouseEnter={e => { if (!startingFreeMeeting) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 22px rgba(99,102,241,0.45)"; } }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 6px 18px rgba(99,102,241,0.35)"; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            {startingFreeMeeting ? "연결 중..." : "자유 미팅 시작"}
          </button>
        </div>
      )}
    </div>
  );
}
