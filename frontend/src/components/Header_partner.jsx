import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Bell } from "lucide-react";
import mainLogo from "../assets/main_logo.png";
import heroDefault from "../assets/hero_default.png";
import useStore from "../store/useStore";
import { profileApi } from "../api/profile.api";
import { authApi } from "../api/auth.api";
import { useLanguage } from "../i18n/LanguageContext";
import LanguageSwitcher from "./LanguageSwitcher";

const PRIMARY_GRAD = "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)";

const NAV_PATHS = [
  { key: "registerProject", path: "/project_register" },
  { key: "findProject",     path: "/project_search" },
  { key: "findClient",      path: "/client_search" },
  { key: "findPartner",     path: "/partner_search" },
  { key: "portfolio",       path: "/partner_portfolio" },
  { key: "solutionMarket",  path: "/solution_market" },
  { key: "usageGuide",      path: "/usage_guide" },
];

const BASE_FONT = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

function DropMenuItem({ label, onClick, color }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "10px 16px",
        fontSize: 14, fontWeight: 500,
        color: color || (hovered ? "#111827" : "#374151"),
        cursor: "pointer",
        backgroundColor: hovered ? "#F9FAFB" : "transparent",
        transition: "background 0.15s, color 0.15s",
        fontFamily: BASE_FONT,
      }}
    >
      {label}
    </div>
  );
}

function DropMenuSubItem({ label, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "9px 16px 9px 28px",
        fontSize: 13, fontWeight: 500,
        color: hovered ? "#111827" : "#6B7280",
        cursor: "pointer",
        backgroundColor: hovered ? "#F9FAFB" : "transparent",
        transition: "background 0.15s, color 0.15s",
        display: "flex", alignItems: "center", gap: 8,
        fontFamily: BASE_FONT,
      }}
    >
      <span style={{
        width: 5, height: 5, borderRadius: "50%",
        backgroundColor: "#D1D5DB", flexShrink: 0,
      }} />
      {label}
    </div>
  );
}

function NavItem({ item, onClickOverride }) {
  const [hovered, setHovered] = useState(false);
  const { pathname } = useLocation();
  const isActive = pathname === item.path;
  if (onClickOverride) {
    return (
      <button
        onClick={onClickOverride}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex", alignItems: "center", gap: 3,
          padding: "7px 9px", borderRadius: 6,
          fontSize: 14,
          fontWeight: (hovered || isActive) ? 600 : 500,
          color: (hovered || isActive) ? "#0EA5E9" : "#374151",
          textDecoration: "none", whiteSpace: "nowrap",
          backgroundColor: (hovered || isActive) ? "#E0F2FE" : "transparent",
          transition: "all 0.15s ease",
          border: "none", cursor: "pointer", fontFamily: BASE_FONT,
        }}
      >
        {item.label}
      </button>
    );
  }
  return (
    <Link
      to={item.path}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 3,
        padding: "7px 9px", borderRadius: 6,
        fontSize: 14,
        fontWeight: (hovered || isActive) ? 600 : 500,
        color: (hovered || isActive) ? "#0EA5E9" : "#374151",
        textDecoration: "none", whiteSpace: "nowrap",
        backgroundColor: (hovered || isActive) ? "#E0F2FE" : "transparent",
        transition: "all 0.15s ease",
      }}
    >
      {item.label}
    </Link>
  );
}

function Header_partner() {
  const navigate = useNavigate();
  const { user, loginUser, clearUser, clearLogin } = useStore();
  const { t } = useLanguage();
  const [dbHero, setDbHero] = useState(null);

  const navItems = NAV_PATHS.map(item => ({
    ...item,
    label: t(`nav.${item.key}`),
  }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await profileApi.getMyDetail();
        if (!cancelled) setDbHero(data?.profileImageUrl || null);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const [profileDropOpen, setProfileDropOpen] = useState(false);
  const [showPartnerModal, setShowPartnerModal] = useState(false);

  const profileTimer = useRef(null);
  const profileRef = useRef(null);

  const openProfile = () => {
    if (profileTimer.current) clearTimeout(profileTimer.current);
    setProfileDropOpen(true);
  };
  const closeProfileDelayed = () => {
    profileTimer.current = setTimeout(() => setProfileDropOpen(false), 150);
  };

  const _getUserInitial = () => {
    if (user?.name) return user.name[0];
    if (loginUser) return (loginUser[0] || "U").toUpperCase();
    return "U";
  };

  const getUserAvatar = () => {
    const heroImage = dbHero || user?.heroImage || user?.profileImage || user?.picture;
    if (heroImage && /cdn\.devbridge\.com/i.test(heroImage)) return heroDefault;
    return heroImage || null;
  };

  const handleLogout = async () => {
    // 백엔드 쿠키 만료 요청 → 실패해도 클라 정리는 계속
    await authApi.logout();
    // 레거시 토큰/식별자 정리
    localStorage.removeItem("accessToken");
    localStorage.removeItem("dbId");
    localStorage.removeItem("username");
    localStorage.removeItem("userType");
    clearUser();
    clearLogin();
    navigate("/home");
  };

  useEffect(() => {
    function handleClick(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileDropOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <>
      {/* 파트너 프로젝트 등록 모달 */}
      {showPartnerModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          backdropFilter: "blur(8px)",
          backgroundColor: "rgba(0,0,0,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
          onClick={() => setShowPartnerModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "white", borderRadius: 24,
              padding: "44px 48px 36px",
              boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
              textAlign: "center", maxWidth: 440, width: "90vw",
              position: "relative",
            }}
          >
            <button
              onClick={() => setShowPartnerModal(false)}
              style={{
                position: "absolute", top: 16, right: 16,
                width: 32, height: 32, borderRadius: "50%",
                border: "none", background: "#F3F4F6",
                color: "#6B7280", fontSize: 18, lineHeight: 1,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#E5E7EB"; e.currentTarget.style.color = "#111827"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#F3F4F6"; e.currentTarget.style.color = "#6B7280"; }}
            >×</button>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🤝</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: "0 0 14px", fontFamily: BASE_FONT, lineHeight: 1.4 }}>
              {t("partnerModal.title").split("\n").map((line, i) => (
                <span key={i}>{line}{i === 0 && <br />}</span>
              ))}
            </h2>
            <p style={{ fontSize: 14, color: "#6B7280", margin: "0 0 32px", fontFamily: BASE_FONT, lineHeight: 1.8 }}>
              {t("partnerModal.desc").split("\n").map((line, i, arr) => (
                <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
              ))}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={() => { setShowPartnerModal(false); navigate("/project_register?free=1"); }}
                style={{
                  width: "100%", padding: "14px", borderRadius: 12, border: "none",
                  background: PRIMARY_GRAD, color: "white",
                  fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: BASE_FONT,
                  boxShadow: "0 4px 18px rgba(99,102,241,0.35)",
                }}
              >
                {t("partnerModal.register")}
              </button>
              <button
                onClick={() => { setShowPartnerModal(false); navigate("/project_search"); }}
                style={{
                  width: "100%", padding: "13px", borderRadius: 12,
                  border: "1.5px solid #E5E7EB", background: "white",
                  color: "#374151", fontSize: 15, fontWeight: 600,
                  cursor: "pointer", fontFamily: BASE_FONT,
                }}
              >
                {t("partnerModal.find")}
              </button>
            </div>
          </div>
        </div>
      )}

      <header style={{
      position: "sticky", top: 0, zIndex: 50,
      backgroundColor: "white",
      borderBottom: "1px solid #E5E7EB",
      fontFamily: BASE_FONT,
    }}>
      <div style={{
        maxWidth: 1200, margin: "0 auto",
        padding: "0 20px",
        display: "flex", alignItems: "center",
        height: 58, gap: 14,
      }}>
        {/* 로고 */}
        <Link to="/partner_home" style={{
          display: "flex", alignItems: "center", gap: 8,
          textDecoration: "none", flexShrink: 0,
          marginRight: 20, marginLeft: -8,
        }}>
          <img src={mainLogo} alt="logo" style={{ height: 32, width: "auto", objectFit: "contain" }} />
          <span style={{
            fontSize: 20.7, fontWeight: 900,
            background: "linear-gradient(90deg, #7DD3FC 0%, #38BDF8 25%, #818CF8 65%, #93C5FD 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            fontFamily: BASE_FONT, letterSpacing: "-0.3px",
          }}>Alpha-Helix</span>
        </Link>

        {/* Navigation */}
        <nav style={{ display: "flex", gap: 4, flex: 1 }}>
          {navItems.map(item => (
            <NavItem
              key={item.key}
              item={item}
              onClickOverride={item.key === "registerProject" ? () => setShowPartnerModal(true) : undefined}
            />
          ))}
        </nav>

        {/* 우측: [언어] [벨] [프로필] [배지] */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>

          {/* 언어 드롭다운 */}
          <LanguageSwitcher variant="light" />

          {/* 벨 아이콘 */}
          <div style={{ position: "relative", cursor: "pointer", padding: "4px 2px" }}>
            <Bell size={20} color="#6B7280" />
          </div>

          {/* 프로필 이미지 드롭다운 */}
          <div
            ref={profileRef}
            style={{ position: "relative" }}
            onMouseEnter={openProfile}
            onMouseLeave={closeProfileDelayed}
          >
            <div style={{
              width: 38, height: 38, borderRadius: "50%",
              overflow: "hidden", cursor: "pointer",
              border: "2px solid #E5E7EB",
              display: "flex", alignItems: "center", justifyContent: "center",
              backgroundColor: "#F3F4F6", flexShrink: 0,
            }}>
              <img
                src={getUserAvatar() || heroDefault}
                alt="profile"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => { e.currentTarget.src = heroDefault; }}
              />
            </div>

            {profileDropOpen && (
              <div
                onMouseEnter={openProfile}
                onMouseLeave={closeProfileDelayed}
                style={{
                  position: "absolute", top: "calc(100% + 2px)", right: 0,
                  backgroundColor: "white", borderRadius: 14,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                  border: "1px solid #F3F4F6",
                  padding: "8px 0",
                  minWidth: 190,
                  zIndex: 200,
                }}>
                {[
                  { labelKey: "nav.dashboard",     path: "/partner_dashboard" },
                  { labelKey: "nav.myPortfolio",   path: "/partner_portfolio" },
                  { labelKey: "nav.partnerProfile",path: "/partner_profile" },
                  { labelKey: "nav.myPage",         path: "/mypage" },
                ].map(item => (
                  <DropMenuItem
                    key={item.labelKey} label={t(item.labelKey)}
                    onClick={() => { navigate(item.path); setProfileDropOpen(false); }}
                  />
                ))}

                <div style={{ height: 1, backgroundColor: "#F3F4F6", margin: "8px 0" }} />

                <DropMenuItem
                  label={t("nav.logout")}
                  onClick={handleLogout}
                  color="#EF4444"
                />
              </div>
            )}
          </div>

          {/* PARTNER 배지 */}
          <div style={{
            background: "linear-gradient(135deg, #BBF7D0 0%, #86EFAC 50%, #BAE6FD 100%)",
            padding: "6px 16px",
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 700,
            color: "#14532D",
            letterSpacing: "0.5px",
            boxShadow: "0 2px 8px rgba(134,239,172,0.45)",
            userSelect: "none",
          }}>
            PARTNER
          </div>

        </div>
      </div>
    </header>
    </>
  );
}

export default Header_partner;
