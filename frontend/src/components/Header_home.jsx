
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import mainLogo from "../assets/main_logo.png";
import { useLanguage } from "../i18n/LanguageContext";
import LanguageSwitcher from "./LanguageSwitcher";

const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif";

/* Paths that require login */
const LOGIN_REQUIRED_PATHS = new Set(["/project_register", "/partner_portfolio"]);

const NAV_PATHS = [
  { key: "registerProject", path: "/project_register" },
  { key: "findProject",     path: "/project_search" },
  { key: "findClient",      path: "/client_search" },
  { key: "findPartner",     path: "/partner_search" },
  { key: "portfolio",       path: "/partner_portfolio" },
  { key: "solutionMarket",  path: "/solution_market" },
  { key: "usageGuide",      path: "/usage_guide" },
];

/* ── Login required modal ─────────────────────────────────── */
function LoginRequiredModal({ onClose }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.38)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "0 16px",
      }}
    >
      <div style={{
        background: "white", borderRadius: 20,
        width: "100%", maxWidth: 380,
        padding: "36px 32px 28px",
        boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
        fontFamily: F, textAlign: "center",
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: "linear-gradient(135deg, #DBEAFE, #EDE9FE)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 18px", fontSize: 26,
        }}>🔒</div>

        <p style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: "0 0 10px" }}>
          {t("loginModal.title")}
        </p>
        <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.65, margin: "0 0 28px" }}>
          {t("loginModal.desc").split("\n").map((line, i) => (
            <span key={i}>{line}{i === 0 && <br />}</span>
          ))}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={() => navigate("/login")}
            style={{
              width: "100%", padding: "13px 0", borderRadius: 12, border: "none",
              background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)",
              color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer",
              fontFamily: F,
            }}
          >{t("loginModal.loginBtn")}</button>
          <button
            onClick={() => { onClose(); navigate("/home"); }}
            style={{
              width: "100%", padding: "13px 0", borderRadius: 12,
              border: "1.5px solid #E5E7EB",
              background: "white", color: "#374151",
              fontSize: 15, fontWeight: 600, cursor: "pointer",
              fontFamily: F,
            }}
          >{t("loginModal.homeBtn")}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Login button ──────────────────────────────────────────── */
function LoginBtn() {
  const [hovered, setHovered] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);
  const { t } = useLanguage();
  return (
    <Link
      to="/login"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        padding: "9px 22px",
        fontSize: 14, fontWeight: 700,
        color: pressed ? "#1e3a5f" : hovered ? "#1e3a5f" : "#1e40af",
        textDecoration: "none",
        borderRadius: 10,
        border: "none",
        background: pressed
          ? "linear-gradient(135deg, #60a5fa 0%, #818cf8 50%, #a78bfa 100%)"
          : hovered
          ? "linear-gradient(135deg, #bae6fd 0%, #c7d2fe 50%, #ddd6fe 100%)"
          : "linear-gradient(135deg, #e0f2fe 0%, #ede9fe 100%)",
        transition: "all 0.18s ease",
        display: "inline-block",
        boxShadow: hovered ? "0 2px 10px rgba(99,102,241,0.18)" : "none",
      }}
    >{t("nav.login")}</Link>
  );
}

/* ── Nav item ──────────────────────────────────────────── */
function NavItem({ item, onLoginRequired }) {
  const [hovered, setHovered] = React.useState(false);

  const handleClick = (e) => {
    if (LOGIN_REQUIRED_PATHS.has(item.path)) {
      e.preventDefault();
      onLoginRequired();
    }
  };

  return (
    <Link
      to={item.path}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 3,
        padding: "7px 9px",
        borderRadius: 6,
        fontSize: 14,
        fontWeight: hovered ? 600 : 500,
        color: hovered ? "#0EA5E9" : "#374151",
        textDecoration: "none",
        whiteSpace: "nowrap",
        backgroundColor: hovered ? "#F0F9FF" : "transparent",
        transition: "all 0.15s ease",
      }}
    >
      {item.label}
    </Link>
  );
}

/* ── Header_home ──────────────────────────────────────────── */
function Header_home() {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const { t } = useLanguage();

  const navItems = NAV_PATHS.map(item => ({
    ...item,
    label: t(`nav.${item.key}`),
  }));

  return (
    <>
      <header style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        backgroundColor: "white",
        borderBottom: "1px solid #E5E7EB",
        fontFamily: F,
      }}>
        <div style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 20px",
          display: "flex",
          alignItems: "center",
          height: 58,
          gap: 14,
        }}>
          {/* Logo */}
          <Link to="/" style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
            flexShrink: 0,
            marginRight: 20,
            marginLeft: -8,
          }}>
            <img src={mainLogo} alt="logo" style={{ height: 32, width: "auto", objectFit: "contain" }} />
            <span style={{
              fontSize: 20.7, fontWeight: 900,
              background: "linear-gradient(90deg, #7DD3FC 0%, #38BDF8 25%, #818CF8 65%, #93C5FD 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              fontFamily: F, letterSpacing: "-0.3px",
            }}>Alpha-Helix</span>
          </Link>

          {/* Navigation */}
          <nav style={{ display: "flex", gap: 4, flex: 1 }}>
            {navItems.map(item => (
              <NavItem
                key={item.key}
                item={item}
                onLoginRequired={() => setShowLoginModal(true)}
              />
            ))}
          </nav>

          {/* 우측 버튼 */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <LanguageSwitcher variant="light" />
            <LoginBtn />
          </div>
        </div>
      </header>

      {showLoginModal && (
        <LoginRequiredModal onClose={() => setShowLoginModal(false)} />
      )}
    </>
  );
}

export default Header_home;
