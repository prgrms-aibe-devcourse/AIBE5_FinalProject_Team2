import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Bell } from "lucide-react";
import mainLogo from "../assets/main_logo.png";
import heroCheck from "../assets/hero_check.png";
import useStore from "../store/useStore";
import { profileApi } from "../api/profile.api";
import { authApi } from "../api/auth.api";
import { useLanguage } from "../i18n/LanguageContext";
import LanguageSwitcher from "./LanguageSwitcher";

const NAV_PATHS = [
  { key: "registerProject", path: "/project_register" },
  { key: "findProject",     path: "/project_search" },
  { key: "findClient",      path: "/client_search" },
  { key: "findPartner",     path: "/partner_search" },
  { key: "portfolio",       path: "/client_portfolio" },
  { key: "solutionMarket",  path: "/solution_market" },
  { key: "usageGuide",      path: "/usage_guide" },
];

const BASE_FONT = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const BG    = "#111827";
const TEXT  = "rgba(255,255,255,0.90)";
const HOVER_COLOR = "#60A5FA";

function DropMenuItemDark({ label, onClick, danger }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "10px 16px",
        fontSize: 14, fontWeight: 500,
        color: danger ? "#F87171" : (hovered ? HOVER_COLOR : "rgba(255,255,255,0.85)"),
        cursor: "pointer",
        backgroundColor: hovered ? "rgba(96,165,250,0.10)" : "transparent",
        transition: "background 0.15s, color 0.15s",
        fontFamily: BASE_FONT,
      }}
    >
      {label}
    </div>
  );
}

function DropMenuSubItemDark({ label, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "9px 16px 9px 28px",
        fontSize: 13, fontWeight: 500,
        color: hovered ? HOVER_COLOR : "rgba(255,255,255,0.6)",
        cursor: "pointer",
        backgroundColor: hovered ? "rgba(96,165,250,0.10)" : "transparent",
        transition: "background 0.15s, color 0.15s",
        display: "flex", alignItems: "center", gap: 8,
        fontFamily: BASE_FONT,
      }}
    >
      <span style={{
        width: 5, height: 5, borderRadius: "50%",
        backgroundColor: hovered ? HOVER_COLOR : "rgba(255,255,255,0.3)",
        flexShrink: 0,
      }} />
      {label}
    </div>
  );
}

function NavItemDark({ item }) {
  const [hovered, setHovered] = useState(false);
  const { pathname } = useLocation();
  const isActive = pathname === item.path;
  return (
    <Link
      to={item.path}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center",
        padding: "7px 9px",
        fontSize: 14,
        fontWeight: (hovered || isActive) ? 600 : 500,
        color: (hovered || isActive) ? HOVER_COLOR : TEXT,
        textDecoration: "none", whiteSpace: "nowrap",
        borderBottom: (hovered || isActive) ? `2px solid ${HOVER_COLOR}` : "2px solid transparent",
        transition: "all 0.15s ease",
        lineHeight: 1,
        marginBottom: -1,
      }}
    >
      {item.label}
    </Link>
  );
}

function Header_client() {
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

  const [profileDropOpen, setProfileDropOpen]  = useState(false);
  const profileTimer = useRef(null);
  const profileRef   = useRef(null);

  const openProfile  = () => { clearTimeout(profileTimer.current); setProfileDropOpen(true); };
  const closeProfile = () => { profileTimer.current = setTimeout(() => setProfileDropOpen(false), 150); };

  const _getUserInitial = () => {
    if (user?.name) return user.name[0];
    if (loginUser) return (loginUser[0] || "U").toUpperCase();
    return "U";
  };
  const getUserAvatar = () => {
    const heroImage = dbHero || user?.heroImage || user?.profileImage || user?.picture;
    if (heroImage && /cdn\.devbridge\.com/i.test(heroImage)) return heroCheck;
    return heroImage || heroCheck;
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
    const fn = (e) => {
      if (profileRef.current  && !profileRef.current.contains(e.target))  setProfileDropOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const DROP_PANEL_STYLE = {
    position: "absolute", top: "calc(100% + 2px)", right: 0,
    backgroundColor: "#1F2937", borderRadius: 14,
    boxShadow: "0 8px 28px rgba(0,0,0,0.40)",
    border: "1px solid rgba(255,255,255,0.08)",
    padding: "8px 0", zIndex: 200,
  };

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50,
      backgroundColor: BG,
      borderBottom: "1px solid rgba(255,255,255,0.08)",
      fontFamily: BASE_FONT,
    }}>
      <div style={{
        maxWidth: 1200, margin: "0 auto",
        padding: "0 20px",
        display: "flex", alignItems: "center",
        height: 58, gap: 14,
      }}>
        {/* 로고 */}
        <Link to="/home" style={{
          display: "flex", alignItems: "center", gap: 8,
          textDecoration: "none", flexShrink: 0,
          marginRight: 16, marginLeft: -8,
        }}>
          <img src={mainLogo} alt="Alpha-Helix logo"
            style={{ height: 32, width: "auto", objectFit: "contain" }} />
          <span style={{
            fontSize: 21.7, fontWeight: 900,
            background: "linear-gradient(90deg, #7DD3FC 0%, #38BDF8 25%, #818CF8 65%, #93C5FD 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            fontFamily: BASE_FONT,
            letterSpacing: "-0.3px",
            userSelect: "none",
          }}>Alpha-Helix</span>
        </Link>

        {/* Navigation */}
        <nav style={{ display: "flex", gap: 4, flex: 1, alignItems: "center" }}>
          {navItems.map(item => <NavItemDark key={item.key} item={item} />)}
        </nav>

        {/* 우측 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>

          {/* 언어 드롭다운 */}
          <LanguageSwitcher variant="dark" />

          {/* 벨 아이콘 */}
          <div style={{ position: "relative", cursor: "pointer", padding: "4px 2px" }}>
            <Bell size={20} color={TEXT} />
          </div>

          {/* 프로필 */}
          <div ref={profileRef} style={{ position: "relative" }}
            onMouseEnter={openProfile} onMouseLeave={closeProfile}>
            <div style={{
              width: 38, height: 38, borderRadius: "50%",
              overflow: "hidden", cursor: "pointer",
              border: "2px solid rgba(255,255,255,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              backgroundColor: "#374151", flexShrink: 0,
            }}>
              <img
                src={getUserAvatar() || heroCheck}
                alt="profile"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => { e.currentTarget.src = heroCheck; }}
              />
            </div>

            {profileDropOpen && (
              <div onMouseEnter={openProfile} onMouseLeave={closeProfile}
                style={{ ...DROP_PANEL_STYLE, minWidth: 190 }}>
                {[
                  { labelKey: "nav.dashboard",     path: "/client_dashboard" },
                  { labelKey: "nav.myPortfolio",   path: "/client_portfolio" },
                  { labelKey: "nav.clientProfile", path: "/client_profile" },
                  { labelKey: "nav.myPage",         path: "/mypage" },
                ].map(item => (
                  <DropMenuItemDark key={item.labelKey} label={t(item.labelKey)}
                    onClick={() => { navigate(item.path); setProfileDropOpen(false); }} />
                ))}
                <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.08)", margin: "8px 0" }} />
                <DropMenuItemDark label={t("nav.logout")} danger onClick={handleLogout} />
              </div>
            )}
          </div>

          {/* CLIENT 배지 */}
          <div style={{
            background: "linear-gradient(135deg, #BAE6FD 0%, #FBCFE8 100%)",
            padding: "6px 16px",
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 700,
            color: "#1e3a8a",
            letterSpacing: "0.5px",
            boxShadow: "0 2px 8px rgba(186,230,253,0.4)",
            userSelect: "none",
          }}>
            CLIENT
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header_client;
