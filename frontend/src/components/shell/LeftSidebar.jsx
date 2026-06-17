import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Home, Layers, BarChart3, Activity, ShieldCheck,
  ScrollText, Sparkles, BookOpenText, Wallet, Inbox, Image as ImageIcon, Bell,
  Globe, Settings, MoreHorizontal, Palette, UserCircle, ChevronRight, Check, LogOut, BookOpen,
  Laptop, FileCode, Database, TerminalSquare, FolderOpen, CreditCard,
  PenLine, ChevronLeft, ChevronDown, PanelLeftOpen, CircleDollarSign, CircleHelp,
} from "lucide-react";
import logoIcon from "../../assets/main_logo.webp";
import { HEROES, getCurrentHeroKey, getCurrentHeroSrc, setCurrentHeroKey } from "../../alpha/heroAssets";
import { listWorkspaces, createWorkspace } from "../../alpha/alphaApi";
import LoginRequiredModal from "./LoginRequiredModal";
import CreateWorkspaceModal from "../../alpha/CreateWorkspaceModal";
import SettingsModal from "./SettingsModal";
const SubscriptionModal = lazy(() => import("./SubscriptionModal"));
import { useLanguage } from "../../i18n/useLanguage";
import { useTheme } from "../../alpha/ThemeContext";
import { authApi } from "../../api/auth.api";
import useStore from "../../store/useStore";
import { useNotificationStore } from "../../store/useNotificationStore";
import Toast from "../common/Toast";

const THEME_PRESETS = [
  { key: "heli",  name: "Heli (기본)",   swatch: "linear-gradient(135deg,#BFDBFE,#A5B4FC,#C4B5FD)" },
  { key: "sky",   name: "Sky (브랜드)",  swatch: "linear-gradient(135deg,#60a5fa,#6366f1)" },
  { key: "alpha", name: "Alpha (노을)",  swatch: "linear-gradient(135deg,#FCA5A5,#F59E0B)" },
  { key: "dev",   name: "Dev (Dracula)", swatch: "linear-gradient(135deg,#FF79C6,#BD93F9)" },
];

const LANGS = [
  { code: "ko", label: "한국어" },
  { code: "en", label: "English" },
  { code: "jp", label: "日本語" },
  { code: "zh", label: "中文" },
];

const WS_SUBMENUS = [
  { key: "config",  tKey: "nav.configSub",  Icon: Layers },
  { key: "report",  tKey: "nav.reportSub",  Icon: BarChart3 },
  { key: "regime",  tKey: "nav.regime",     Icon: Activity },
  { key: "trust",   tKey: "nav.trust",      Icon: ShieldCheck },
  { key: "log",     tKey: "nav.log",        Icon: ScrollText },
];

const DEV_SUBMENUS = [
  { key: "explorer", tKey: "nav.dev_explorer", Icon: FolderOpen },
  { key: "code",     tKey: "nav.dev_code",     Icon: FileCode },
  { key: "data",     tKey: "nav.dev_data",     Icon: Database },
  { key: "report",   tKey: "nav.dev_report",   Icon: BarChart3 },
  { key: "console",  tKey: "nav.dev_console",  Icon: TerminalSquare },
];

const EASE = "cubic-bezier(0.4,0,0.2,1)";

export default function LeftSidebar({ expanded = true, onToggleExpanded, onToggleGuide, guideOpen, topCollapsed, onExpandTop }) {
  const nav = useNavigate();
  const loc = useLocation();
  const { theme, themeKey, setThemeKey } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const notifications      = useNotificationStore((s) => s.notifications);
  const unreadCount        = notifications.filter((n) => !n.read).length;
  const fetchNotifications = useNotificationStore((s) => s.fetch);

  const [showLogin, setShowLogin]     = useState(false);
  const [langOpen, setLangOpen]       = useState(false);
  const [gearOpen, setGearOpen]       = useState(false);
  const [themeSubOpen, setThemeSubOpen] = useState(false);
  // 접힘 상태에서 aside 바깥 fixed 플라이아웃의 하단 앵커(버튼 위치 기준)
  const [langFlyBottom, setLangFlyBottom] = useState(12);
  const [gearFlyBottom, setGearFlyBottom] = useState(12);
  const [gearFlyTop,    setGearFlyTop]    = useState(null);
  const [gearFlyLeft,   setGearFlyLeft]   = useState(58);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [subOpen, setSubOpen]         = useState(false);
  const [heroOpen, setHeroOpen]       = useState(false);
  const [heroKey, setHeroKey]         = useState(() => getCurrentHeroKey());
  const [sidebarHover, setSidebarHover] = useState(false);
  const [logoHover, setLogoHover] = useState(false);
  const [newStrategyOpen, setNewStrategyOpen] = useState(false);
  const [newStrategyName, setNewStrategyName] = useState("");

  // Workspace flyout (collapsed only)
  const [wsMenuOpen, setWsMenuOpen]   = useState(false);
  const [wsTabSel, setWsTabSel]       = useState(null);
  const [wsBtnTop, setWsBtnTop]       = useState(100);
  const [workspaces, setWorkspaces]   = useState([]);

  // Developer flyout (collapsed only)
  const [devMenuOpen, setDevMenuOpen] = useState(false);
  const [devBtnTop, setDevBtnTop]     = useState(160);

  const seenIdsRef      = useRef(null); // null = 초기 로드 전
  const [notiToast, setNotiToast] = useState(null);

  const langRef         = useRef(null);
  const gearRef         = useRef(null);
  const langFlyoutRef   = useRef(null);
  const gearFlyoutRef   = useRef(null);
  const heroRef         = useRef(null);
  const heroFlyoutRef   = useRef(null);
  const wsBtnRef     = useRef(null);
  const wsFlyoutRef  = useRef(null);
  const devBtnRef    = useRef(null);
  const devFlyoutRef = useRef(null);
  const wsOpenTimer  = useRef(null);
  const wsCloseTimer = useRef(null);
  const devOpenTimer = useRef(null);
  const devCloseTimer = useRef(null);
  const themeCloseTimer = useRef(null);

  const isAuthed = !!localStorage.getItem("dbId");
  const inAlpha    = loc.pathname === "/alpha" || loc.pathname.startsWith("/alpha/w/");
  const inDeveloper = loc.pathname === "/alpha/developer" || loc.pathname.startsWith("/alpha/developer/");

  // Developer IDE 페이지에서 nav 섹션 기본 접기
  // (navCollapsed 제거됨 — DeveloperLab 툴바의 [|>] 버튼으로 전체 사이드바 토글)

  /* ── 미읽은 알림 배지: 앱 시작 시 즉시 fetch + 30초 폴링 ── */
  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  /* ── 새 알림 도착 감지 → 토스트 ── */
  useEffect(() => {
    if (notifications.length === 0) return;
    if (seenIdsRef.current === null) {
      seenIdsRef.current = new Set(notifications.map((n) => n.id));
      return;
    }
    const newOnes = notifications.filter((n) => !seenIdsRef.current.has(n.id));
    if (newOnes.length === 0) return;
    newOnes.forEach((n) => seenIdsRef.current.add(n.id));
    const latest = newOnes[0];
    setNotiToast({
      title: latest.title + (newOnes.length > 1 ? ` 외 ${newOnes.length - 1}개` : ""),
      body: latest.body,
      type: latest.type,
    });
  }, [notifications]);

  /* ── load workspaces ── */
  const loadWorkspaces = () =>
    listWorkspaces()
      .then(r => setWorkspaces(Array.isArray(r) ? r : (r?.content || [])))
      .catch(() => setWorkspaces([]));

  useEffect(() => {
    if (expanded && isAuthed) loadWorkspaces();
  }, [expanded]);

  useEffect(() => {
    if (wsMenuOpen && isAuthed && workspaces.length === 0) loadWorkspaces();
  }, [wsMenuOpen]);

  /* ── global click-outside / event listeners ── */
  useEffect(() => {
    const onDoc = (e) => {
      const inLang = langRef.current?.contains(e.target) || langFlyoutRef.current?.contains(e.target);
      if (!inLang) setLangOpen(false);
      const inGear = gearRef.current?.contains(e.target) || gearFlyoutRef.current?.contains(e.target);
      if (!inGear) { setGearOpen(false); setThemeSubOpen(false); }
      const inHero = heroRef.current?.contains(e.target) || heroFlyoutRef.current?.contains(e.target);
      if (!inHero) setHeroOpen(false);
      const inWsBtn = wsBtnRef.current?.contains(e.target);
      const inWsFly = wsFlyoutRef.current?.contains(e.target);
      if (!inWsBtn && !inWsFly) { setWsMenuOpen(false); setWsTabSel(null); }
      const inDevBtn = devBtnRef.current?.contains(e.target);
      const inDevFly = devFlyoutRef.current?.contains(e.target);
      if (!inDevBtn && !inDevFly) setDevMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    const onHero = (e) => setHeroKey(e?.detail?.key || getCurrentHeroKey());
    window.addEventListener("alpha:hero-change", onHero);
    const onOpenSub = () => setSubOpen(true);
    window.addEventListener("alpha:open-subscription", onOpenSub);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("alpha:hero-change", onHero);
      window.removeEventListener("alpha:open-subscription", onOpenSub);
      [wsOpenTimer, wsCloseTimer, devOpenTimer, devCloseTimer, themeCloseTimer]
        .forEach(r => { if (r.current) clearTimeout(r.current); });
    };
  }, []);

  /* ── workspace flyout hover helpers ── */
  const onWsBtnEnter = () => {
    if (wsCloseTimer.current) { clearTimeout(wsCloseTimer.current); wsCloseTimer.current = null; }
    if (!isAuthed || wsMenuOpen) return;
    const rect = wsBtnRef.current?.getBoundingClientRect();
    if (rect) setWsBtnTop(rect.top);
    wsOpenTimer.current = setTimeout(() => setWsMenuOpen(true), 500);
  };
  const onWsAreaEnter = () => {
    if (wsCloseTimer.current) { clearTimeout(wsCloseTimer.current); wsCloseTimer.current = null; }
  };
  const onWsAreaLeave = () => {
    if (wsOpenTimer.current) { clearTimeout(wsOpenTimer.current); wsOpenTimer.current = null; }
    wsCloseTimer.current = setTimeout(() => setWsMenuOpen(false), 200);
  };

  /* ── developer flyout hover helpers ── */
  const onDevBtnEnter = () => {
    if (devCloseTimer.current) { clearTimeout(devCloseTimer.current); devCloseTimer.current = null; }
    if (!isAuthed || devMenuOpen) return;
    const rect = devBtnRef.current?.getBoundingClientRect();
    if (rect) setDevBtnTop(rect.top);
    devOpenTimer.current = setTimeout(() => setDevMenuOpen(true), 500);
  };
  const onDevAreaEnter = () => {
    if (devCloseTimer.current) { clearTimeout(devCloseTimer.current); devCloseTimer.current = null; }
  };
  const onDevAreaLeave = () => {
    if (devOpenTimer.current) { clearTimeout(devOpenTimer.current); devOpenTimer.current = null; }
    devCloseTimer.current = setTimeout(() => setDevMenuOpen(false), 200);
  };

  /* ── theme submenu ── */
  const openThemeSub = () => {
    if (themeCloseTimer.current) { clearTimeout(themeCloseTimer.current); themeCloseTimer.current = null; }
    setThemeSubOpen(true);
  };
  const scheduleCloseThemeSub = () => {
    if (themeCloseTimer.current) clearTimeout(themeCloseTimer.current);
    themeCloseTimer.current = setTimeout(() => setThemeSubOpen(false), 220);
  };

  const applyTheme = (k) => {
    setThemeKey(k);
    try {
      localStorage.setItem("alpha.theme", k);
      window.dispatchEvent(new CustomEvent("alpha:theme-change", { detail: { key: k } }));
    } catch (_) {}
    setThemeSubOpen(false);
    setGearOpen(false);
  };

  /* ── navigation ── */
  const go = (route) => {
    if (!isAuthed) { setShowLogin(true); return; }
    nav(route);
  };

  /* ── empty sidebar space click → expand ── */
  const handleAsideClick = (e) => {
    if (!expanded && !e.target.closest("button") && !e.target.closest("[data-no-expand]")) {
      onToggleExpanded();
    }
  };

  /* ── new workspace ── */
  const handleNewStrategy = () => {
    if (!isAuthed) { setShowLogin(true); return; }
    setNewStrategyName("");
    setNewStrategyOpen(true);
  };

  const handleConfirmNewStrategy = async () => {
    if (!newStrategyName.trim()) return;
    setNewStrategyOpen(false);
    try {
      const w = await createWorkspace(newStrategyName.trim());
      setWorkspaces(prev => [{ id: w.id, name: w.name }, ...prev]);
      nav(`/alpha/w/${w.id}`);
    } catch (e) {
      alert("생성 실패: " + (e?.response?.data?.error || e.message));
    }
  };

  /* ─────────────────────────────────────────────────── */
  /* Flyout sub-components                               */
  /* ─────────────────────────────────────────────────── */
  const GearFlyoutContent = () => (
    <>
      <div style={{ position: "relative" }} onMouseEnter={openThemeSub} onMouseLeave={scheduleCloseThemeSub}>
        <MenuItem icon={<Palette size={15} />} label="Theme 팔레트"
          right={<ChevronRight size={14} style={{ color: "#94A3B8" }} />}
          onClick={() => setThemeSubOpen(s => !s)} />
        {themeSubOpen && (
          <div onMouseEnter={openThemeSub} onMouseLeave={scheduleCloseThemeSub}
            style={{ position: "absolute", left: "100%", bottom: 0, paddingLeft: 8, zIndex: 1101, minWidth: 208 }}>
            <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 10, boxShadow: "0 12px 30px rgba(0,0,0,0.18)", padding: 6 }}>
              <div style={{ padding: "4px 10px 8px", fontSize: 11, color: "#64748B", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>Alpha-Helix 테마</div>
              {THEME_PRESETS.map(tp => (
                <button key={tp.key} onClick={() => applyTheme(tp.key)}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "7px 10px", borderRadius: 6, border: "none",
                    background: themeKey === tp.key ? "#EFF6FF" : "transparent", color: themeKey === tp.key ? "#1d4ed8" : "#0F172A",
                    fontSize: 13, fontWeight: themeKey === tp.key ? 700 : 500, cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={e => { if (themeKey !== tp.key) e.currentTarget.style.background = "#F8FAFC"; }}
                  onMouseLeave={e => { if (themeKey !== tp.key) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ width: 18, height: 18, borderRadius: 4, background: tp.swatch, border: "1px solid rgba(0,0,0,0.1)", flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{tp.name}</span>
                  {themeKey === tp.key && <Check size={14} />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <MenuItem icon={<Settings size={15} />} label="설정" hint="Ctrl+,"
        onClick={() => { setGearOpen(false); setSettingsOpen(true); }} />
    </>
  );

  const HeroFlyoutContent = ({ onClose, flyLeft = false }) => (
    <>
      <MenuItem icon={<Wallet size={15} />} label="계좌 관리" onClick={() => { onClose(); nav("/alpha/account"); }} />
      <MenuItem icon={<CreditCard size={15} />} label="구독 관리" onClick={() => { onClose(); setSubOpen(true); }} />
      <MenuItem icon={<UserCircle size={15} />} label="마이페이지 이동" onClick={() => { onClose(); nav("/mypage"); }} />
      <div style={{ padding: "6px 10px 4px", fontSize: 11, color: "#64748B", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 4, borderTop: "1px solid #F1F5F9" }}>
        Hero 이미지 변경
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, padding: 6 }}>
        {HEROES.map(h => (
          <button key={h.key} onClick={() => { setCurrentHeroKey(h.key); setHeroKey(h.key); }} title={h.label}
            style={{ width: 44, height: 44, padding: 2, borderRadius: 8,
              background: heroKey === h.key ? "#EFF6FF" : "transparent",
              border: heroKey === h.key ? "2px solid #6366f1" : "1px solid #E2E8F0",
              cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <img src={h.src} alt={h.label} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </button>
        ))}
      </div>
      <div style={{ borderTop: "1px solid #F1F5F9", marginTop: 4, paddingTop: 4 }}>
        <MenuItem icon={<LogOut size={15} />} label="로그아웃" danger onClick={async () => {
          onClose();
          try { await authApi.logout(); } catch (_) {}
          ["accessToken","dbId","username","userType"].forEach(k => { try { localStorage.removeItem(k); } catch (_) {} });
          try { useStore.getState().clearUser?.(); } catch (_) {}
          try { useStore.getState().clearLogin?.(); } catch (_) {}
          nav("/home");
        }} />
      </div>
    </>
  );

  const LangFlyout = ({ above = false }) => (
    <div style={{
      position: "absolute",
      ...(above ? { bottom: "calc(100% + 4px)" } : { top: "calc(100% + 4px)" }),
      left: expanded ? 0 : 44,
      background: "white", border: "1px solid #E2E8F0", borderRadius: 10,
      boxShadow: "0 12px 30px rgba(0,0,0,0.15)", padding: 6, zIndex: 1100, minWidth: 140,
    }}>
      {LANGS.map(L => (
        <button key={L.code} onClick={() => { setLang(L.code); setLangOpen(false); }}
          style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 6, border: "none",
            background: lang === L.code ? "#EFF6FF" : "transparent", color: lang === L.code ? "#1d4ed8" : "#0F172A",
            fontSize: 13, fontWeight: lang === L.code ? 700 : 500, cursor: "pointer" }}
          onMouseEnter={e => { if (lang !== L.code) e.currentTarget.style.background = "#F8FAFC"; }}
          onMouseLeave={e => { if (lang !== L.code) e.currentTarget.style.background = "transparent"; }}
        >
          {lang === L.code && "✓ "}{L.label}
        </button>
      ))}
    </div>
  );

  /* ─────────────────────────────────────────────────── */
  /* RENDER                                              */
  /* ─────────────────────────────────────────────────── */
  return (
    <>
      {notiToast && (
        <Toast
          title={notiToast.title}
          body={notiToast.body}
          type={notiToast.type}
          onClose={() => setNotiToast(null)}
        />
      )}
      <aside
        data-tut-sidebar
        style={{
          position: "fixed", top: 0, left: 0, bottom: 0,
          width: expanded ? 240 : 52,
          background: theme.sidebar,
          borderRight: "1px solid rgba(255,255,255,0.08)",
          display: "flex", flexDirection: "column",
          zIndex: 1000, overflow: "hidden",
          transition: `width 0.26s ${EASE}`,
          fontFamily: "'Inter','Pretendard',-apple-system,BlinkMacSystemFont,sans-serif",
          cursor: !expanded ? "pointer" : "default",
        }}
        onMouseEnter={() => setSidebarHover(true)}
        onMouseLeave={() => setSidebarHover(false)}
        onClick={handleAsideClick}
      >
        {/* ── 1. Logo row ─────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", height: 52, padding: "0 7px", flexShrink: 0, gap: 6 }}>
          {/* Logo / expand icon */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpanded(); }}
            title={expanded ? "사이드바 축소" : "사이드바 확장"}
            onMouseEnter={() => setLogoHover(true)}
            onMouseLeave={() => setLogoHover(false)}
            style={{
              position: "relative",
              width: 36, height: 36, borderRadius: 9, border: "none",
              background: "white", cursor: "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              padding: 0, overflow: "hidden", flexShrink: 0,
              boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
            }}
          >
            {/* Logo image */}
            <img src={logoIcon} alt="α" style={{
              position: "absolute", top: 0, left: 0,
              width: "100%", height: "100%", objectFit: "cover",
              transition: `opacity 0.18s, transform 0.18s ${EASE}`,
              opacity: (logoHover || (!expanded && sidebarHover)) ? 0 : 1,
              transform: (logoHover || (!expanded && sidebarHover)) ? "scale(0.7) rotate(-10deg)" : "scale(1) rotate(0deg)",
            }} />
            {/* Expand/collapse icon overlay */}
            <span style={{
              position: "absolute", top: 0, left: 0,
              width: "100%", height: "100%",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: "#6366f1",
              transition: `opacity 0.18s, transform 0.18s ${EASE}`,
              opacity: (logoHover || (!expanded && sidebarHover)) ? 1 : 0,
              transform: (logoHover || (!expanded && sidebarHover)) ? "scale(1)" : "scale(0.6)",
            }}>
              <PanelLeftOpen size={20} />
            </span>
          </button>

          {/* Brand name — slides in, clicks to home */}
          <button
            onClick={(e) => { e.stopPropagation(); nav("/home"); }}
            style={{
              fontSize: 15, fontWeight: 500, fontFamily: "'Inter Tight', sans-serif", color: "white", letterSpacing: -0.3,
              whiteSpace: "nowrap", overflow: "hidden",
              maxWidth: expanded ? 140 : 0,
              opacity: expanded ? 1 : 0,
              transition: `max-width 0.26s ${EASE}, opacity 0.2s`,
              background: "transparent", border: "none", cursor: "pointer", padding: 0,
            }}
          >
            ALPHA-HELIX
          </button>

          {/* Collapse button — fades in when expanded */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpanded(); }}
            title="사이드바 축소"
            style={{
              width: 26, height: 26, borderRadius: 6, border: "none",
              background: "transparent", color: "rgba(255,255,255,0.6)", cursor: "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              marginLeft: "auto", flexShrink: 0,
              opacity: expanded ? 1 : 0,
              pointerEvents: expanded ? "auto" : "none",
              transition: `opacity 0.2s`,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.18)"; e.currentTarget.style.color = "white"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
          >
            <ChevronLeft size={16} />
          </button>

          {/* Nav 섹션 접기/펼치기 버튼 제거됨 — DeveloperLab 툴바의 [|>] 버튼으로 전체 사이드바 토글 */}
        </div>

        {/* ── 상단바 펼치기 (개발자 IDE 등 상단바 접힌 상태에서만 노출) ── */}
        {topCollapsed && (
          <button
            onClick={(e) => { e.stopPropagation(); onExpandTop && onExpandTop(); }}
            title="상단 검색·AI 바 펼치기"
            style={{
              margin: "0 8px 4px", height: 30, flexShrink: 0,
              borderRadius: 8, border: "1px dashed rgba(255,255,255,0.28)",
              background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.72)",
              cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", gap: 6, overflow: "hidden",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.14)"; e.currentTarget.style.color = "white"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.72)"; }}
          >
            <ChevronDown size={16} style={{ flexShrink: 0 }} />
            {expanded && <span style={{ fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap" }}>상단바 펼치기</span>}
          </button>
        )}

        {/* ── 2. Expanded-only: 새 전략 / 검색 ────────── */}
        <div style={{
          padding: "2px 8px", flexShrink: 0,
          overflow: "hidden",
          maxHeight: expanded ? 90 : 0,
          opacity: expanded ? 1 : 0,
          transition: `max-height 0.26s ${EASE}, opacity 0.2s`,
        }}>
          <WideBtn icon={<PenLine size={15} />} label="새 워크스페이스" onClick={handleNewStrategy} />
        </div>

        {/* ── 3. Divider ───────────────────────────────── */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.15)", margin: "5px 10px", flexShrink: 0 }} />

        {/* ── 4. Main nav items ─────────────────────────── */}
        <div style={{ padding: "2px 7px", flexShrink: 0 }}>
          {/* Home */}
          <NavItem
            expanded={expanded}
            icon={<Home size={24} strokeWidth={loc.pathname === "/workhome" ? 2.4 : 1.9} />}
            label="홈"
            active={loc.pathname === "/workhome"}
            onClick={() => go("/workhome")}
          />

          {/* Workspace */}
          <div ref={wsBtnRef}
            onMouseEnter={() => { if (!expanded) onWsBtnEnter(); }}
            onMouseLeave={() => { if (!expanded) onWsAreaLeave(); }}
          >
            <NavItem
              expanded={expanded}
              icon={<Layers size={24} strokeWidth={inAlpha ? 2.4 : 1.9} />}
              label="워크스페이스"
              active={inAlpha}
              tutorialId="tutorial-sidebar-ws"
              onClick={() => go("/alpha")}
            />
          </div>

          {/* Briefing */}
          <NavItem
            expanded={expanded}
            icon={<BookOpenText size={24} strokeWidth={loc.pathname === "/briefing" ? 2.4 : 1.9} />}
            label="브리핑"
            active={loc.pathname === "/briefing"}
            onClick={() => go("/briefing")}
          />

          {/* Vision Board */}
          <NavItem
            expanded={expanded}
            icon={<ImageIcon size={24} strokeWidth={loc.pathname.startsWith("/vision_board") ? 2.4 : 1.9} />}
            label="비전 보드"
            active={loc.pathname.startsWith("/vision_board")}
            tutorialId="tutorial-sidebar-vision"
            onClick={() => go("/vision_board")}
          />

          {/* 종합 계좌 잔고 */}
          <NavItem
            expanded={expanded}
            icon={<CircleDollarSign size={24} strokeWidth={loc.pathname === "/alpha/balance_account" ? 2.4 : 1.9} />}
            label="종합 계좌 잔고"
            active={loc.pathname === "/alpha/balance_account"}
            tutorialId="tutorial-sidebar-account"
            onClick={() => go("/alpha/balance_account")}
          />

          {/* 제안서 */}
          <NavItem
            expanded={expanded}
            icon={<Inbox size={24} strokeWidth={loc.pathname === "/alpha/proposals" ? 2.4 : 1.9} />}
            label="주문 제안"
            active={loc.pathname === "/alpha/proposals"}
            tutorialId="tutorial-sidebar-proposals"
            onClick={() => go("/alpha/proposals")}
          />

          {/* Developer */}
          <div ref={devBtnRef}
            onMouseEnter={() => { if (!expanded) onDevBtnEnter(); }}
            onMouseLeave={() => { if (!expanded) onDevAreaLeave(); }}
          >
            <NavItem
              expanded={expanded}
              icon={<Laptop size={24} strokeWidth={inDeveloper ? 2.4 : 1.9} />}
              label="Quant Developer IDE"
              active={inDeveloper}
              tutorialId="tutorial-sidebar-developer"
              onClick={() => go("/alpha/developer")}
            />
          </div>

        </div>

        {/* ── 5. 최근 workspaces — expanded only ──────── */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "4px 8px 0", minHeight: 0,
          opacity: expanded ? 1 : 0,
          transition: `opacity 0.2s 0.08s`,
          pointerEvents: expanded ? "auto" : "none",
          borderTop: "1px solid rgba(255,255,255,0.12)",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.75)", padding: "10px 8px 5px", letterSpacing: 0.8, textTransform: "uppercase" }}>
            최근 워크스페이스
          </div>
          {workspaces.length === 0 ? (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", padding: "4px 8px" }}>전략 없음</div>
          ) : (
            <>
              {workspaces.slice(0, 5).map(ws => (
                <WideBtn key={ws.id} label={ws.name || `전략 #${ws.id}`} small bullet
                  active={loc.pathname === `/alpha/w/${ws.id}`}
                  onClick={() => nav(`/alpha/w/${ws.id}`)} />
              ))}
              {workspaces.length > 5 && (
                <button onClick={() => nav("/alpha")} style={{
                  width: "100%", padding: "5px 8px", background: "transparent", border: "none",
                  color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  textAlign: "left", display: "flex", alignItems: "center", gap: 4,
                  borderRadius: 6,
                }}
                  onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.85)"}
                  onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.5)"}
                >
                  ··· 더보기 ({workspaces.length - 5}개)
                </button>
              )}
            </>
          )}
        </div>

        {/* ── 6. Collapsed-only: bottom spacer ─────────── */}
        {!expanded && <div style={{ flex: 1 }} />}

        {/* ── 7. Bottom row ─────────────────────────────── */}
        <div style={{
          padding: expanded ? "8px 10px 12px" : "8px 9px 10px",
          borderTop: "1px solid rgba(255,255,255,0.12)",
          display: "flex",
          flexDirection: expanded ? "row" : "column",
          alignItems: "center",
          gap: expanded ? 2 : 3,
          flexShrink: 0,
        }}>
          {/* Guide toggle */}
          <SideIconBtn title="이용 가이드" active={!!guideOpen} onClick={onToggleGuide}>
            <CircleHelp size={expanded ? 18 : 22} />
          </SideIconBtn>

          {/* Bell */}
          <SideIconBtn title="알림함" active={loc.pathname === "/notifications"}
            onClick={() => { if (!isAuthed) { setShowLogin(true); return; } nav("/notifications"); }}>
            <div style={{ position: "relative", display: "inline-flex" }}>
              <Bell size={expanded ? 18 : 22} />
              {unreadCount > 0 && (
                <span style={{ position: "absolute", top: -3, right: -3, width: 8, height: 8, borderRadius: "50%", background: "#EF4444", border: "1.5px solid transparent" }} />
              )}
            </div>
          </SideIconBtn>

          {/* Lang */}
          <div ref={langRef} style={{ position: "relative", width: 34, height: 34, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <SideIconBtn title="언어 변경" active={langOpen} onClick={() => {
              if (!expanded && langRef.current) {
                const r = langRef.current.getBoundingClientRect();
                setLangFlyBottom(Math.max(8, window.innerHeight - r.bottom));
              }
              setLangOpen(o => !o);
            }}>
              <Globe size={expanded ? 18 : 22} />
            </SideIconBtn>
            {/* 펼침: 인라인 플라이아웃 / 접힘: aside 바깥 fixed(아래에서 렌더) */}
            {expanded && langOpen && <LangFlyout above />}
          </div>

          {/* Settings */}
          <div ref={gearRef} style={{ position: "relative", width: 34, height: 34, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <SideIconBtn title="설정" active={gearOpen} onClick={() => {
              if (gearRef.current) {
                const r = gearRef.current.getBoundingClientRect();
                if (expanded) {
                  // 펼침: 버튼 바로 위에, 왼쪽 정렬
                  setGearFlyBottom(window.innerHeight - r.top + 6);
                  setGearFlyTop(null);
                  setGearFlyLeft(r.left);
                } else {
                  // 접힘: 버튼 바로 오른쪽에, 버튼 하단 기준 위로 펼침
                  setGearFlyBottom(window.innerHeight - r.bottom);
                  setGearFlyTop(null);
                  setGearFlyLeft(58);
                }
              }
              setGearOpen(o => !o); setThemeSubOpen(false);
            }}>
              <Settings size={expanded ? 18 : 22} />
            </SideIconBtn>
          </div>

          {expanded && <div style={{ flex: 1 }} />}

          {/* Hero */}
          {isAuthed && (
            <div ref={heroRef} style={{ position: "relative", width: 34, height: 34, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <button onClick={(e) => { e.stopPropagation(); setHeroOpen(o => !o); }} title="내 Hero / 마이페이지"
                style={{
                  width: 34, height: 34, borderRadius: "50%",
                  background: "white",
                  border: heroOpen ? "2px solid white" : "1.5px solid rgba(255,255,255,0.4)",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.25)", overflow: "hidden", padding: 0, flexShrink: 0,
                }}>
                <img src={getCurrentHeroSrc()} alt="me"
                  style={{ width: 30, height: 30, objectFit: "contain" }} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Hero flyout — aside 바깥 fixed (overflow:hidden 회피) */}
      {isAuthed && heroOpen && (
        <div
          ref={heroFlyoutRef}
          onMouseDown={e => e.stopPropagation()}
          style={{
            position: "fixed",
            left: expanded ? 248 : 58,
            bottom: 12,
            background: "white", border: "1px solid #E2E8F0", borderRadius: 10,
            boxShadow: "0 12px 30px rgba(0,0,0,0.18)", padding: 8, zIndex: 1200, minWidth: 240,
          }}
        >
          <HeroFlyoutContent onClose={() => setHeroOpen(false)} />
        </div>
      )}

      {/* Lang flyout (접힘) — aside 바깥 fixed (overflow:hidden 회피) */}
      {!expanded && langOpen && (
        <div ref={langFlyoutRef} onMouseDown={e => e.stopPropagation()}
          style={{
            position: "fixed", left: 58, bottom: langFlyBottom,
            background: "white", border: "1px solid #E2E8F0", borderRadius: 10,
            boxShadow: "0 12px 30px rgba(0,0,0,0.18)", padding: 6, zIndex: 1200, minWidth: 140,
          }}>
          {LANGS.map(L => (
            <button key={L.code} onClick={() => { setLang(L.code); setLangOpen(false); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 6, border: "none",
                background: lang === L.code ? "#EFF6FF" : "transparent", color: lang === L.code ? "#1d4ed8" : "#0F172A",
                fontSize: 13, fontWeight: lang === L.code ? 700 : 500, cursor: "pointer" }}
              onMouseEnter={e => { if (lang !== L.code) e.currentTarget.style.background = "#F8FAFC"; }}
              onMouseLeave={e => { if (lang !== L.code) e.currentTarget.style.background = "transparent"; }}
            >
              {lang === L.code && "✓ "}{L.label}
            </button>
          ))}
        </div>
      )}

      {/* Settings flyout — aside 바깥 fixed (overflow:hidden 회피) */}
      {gearOpen && (
        <div ref={gearFlyoutRef} onMouseDown={e => e.stopPropagation()}
          style={{
            position: "fixed",
            left: gearFlyLeft,
            ...(gearFlyTop != null ? { top: gearFlyTop } : { bottom: gearFlyBottom }),
            background: "white", border: "1px solid #E2E8F0", borderRadius: 10,
            boxShadow: "0 12px 30px rgba(0,0,0,0.18)", padding: 6, zIndex: 1200, minWidth: 200,
          }}>
          <GearFlyoutContent />
        </div>
      )}

      <LoginRequiredModal open={showLogin} onClose={() => setShowLogin(false)} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <Suspense fallback={null}>
        <SubscriptionModal open={subOpen} onClose={() => setSubOpen(false)} />
      </Suspense>

      <CreateWorkspaceModal
        open={newStrategyOpen}
        name={newStrategyName}
        onChange={setNewStrategyName}
        onConfirm={handleConfirmNewStrategy}
        onClose={() => setNewStrategyOpen(false)}
      />

      {/* Workspace flyout — collapsed only */}
      {!expanded && wsMenuOpen && (
        <div ref={wsFlyoutRef} onMouseEnter={onWsAreaEnter} onMouseLeave={onWsAreaLeave}
          style={{ position: "fixed", left: 58, top: wsBtnTop, zIndex: 1200, display: "flex", gap: 4 }}>
          <div style={{
            background: "white", border: "1px solid #E2E8F0", borderRadius: 12,
            boxShadow: "0 12px 32px rgba(0,0,0,0.18)", padding: 6, minWidth: 186,
          }}>
            <div style={{ padding: "4px 10px 8px", fontSize: 11, color: "#64748B", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>
              워크스페이스
            </div>
            {WS_SUBMENUS.map(item => {
              const active = wsTabSel === item.key;
              return (
                <button key={item.key}
                  onClick={() => setWsTabSel(prev => prev === item.key ? null : item.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 10px", borderRadius: 8,
                    border: "none", background: active ? "#EFF6FF" : "transparent",
                    color: active ? "#1d4ed8" : "#0F172A", fontSize: 13, fontWeight: active ? 700 : 500,
                    cursor: "pointer", textAlign: "left",
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#F8FAFC"; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                >
                  <item.Icon size={15} color={active ? "#1d4ed8" : "#475569"} />
                  <span style={{ flex: 1 }}>{t(item.tKey)}</span>
                  <ChevronRight size={13} color="#94A3B8" />
                </button>
              );
            })}
          </div>
          {wsTabSel && (
            <div style={{
              background: "white", border: "1px solid #E2E8F0", borderRadius: 12,
              boxShadow: "0 12px 32px rgba(0,0,0,0.18)", padding: 6, minWidth: 224,
            }}>
              <div style={{ padding: "4px 10px 8px", fontSize: 11, color: "#64748B", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>전략 선택</div>
              {workspaces.length === 0 ? (
                <div style={{ padding: "16px 10px", fontSize: 13, color: "#94A3B8", textAlign: "center" }}>워크스페이스 없음</div>
              ) : workspaces.map(ws => (
                <button key={ws.id}
                  onClick={() => { nav(`/alpha/w/${ws.id}?tab=${wsTabSel}`); setWsMenuOpen(false); setWsTabSel(null); }}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "flex-start",
                    width: "100%", padding: "9px 10px", borderRadius: 8,
                    border: "none", background: "transparent", color: "#0F172A", cursor: "pointer", textAlign: "left",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{ws.name || `전략 #${ws.id}`}</span>
                  {ws.trust != null && <span style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>Trust {ws.trust}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Developer flyout — collapsed only */}
      {!expanded && devMenuOpen && (
        <div ref={devFlyoutRef} onMouseEnter={onDevAreaEnter} onMouseLeave={onDevAreaLeave}
          style={{ position: "fixed", left: 58, top: devBtnTop, zIndex: 1200 }}>
          <div style={{
            background: "white", border: "1px solid #E2E8F0", borderRadius: 12,
            boxShadow: "0 12px 32px rgba(0,0,0,0.18)", padding: 6, minWidth: 200,
          }}>
            <div style={{ padding: "4px 10px 8px", fontSize: 11, color: "#64748B", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>
              Quant Developer IDE
            </div>
            {DEV_SUBMENUS.map(item => {
              const params = new URLSearchParams(loc.search);
              const active = inDeveloper && (params.get("panel") || "explorer") === item.key;
              return (
                <button key={item.key} onClick={() => nav(`/alpha/developer?panel=${item.key}`)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 10px", borderRadius: 8,
                    border: "none", background: active ? "#EFF6FF" : "transparent",
                    color: active ? "#1d4ed8" : "#0F172A", fontSize: 13, fontWeight: active ? 700 : 500,
                    cursor: "pointer", textAlign: "left",
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#F8FAFC"; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                >
                  <item.Icon size={15} color={active ? "#1d4ed8" : "#475569"} />
                  <span>{t(item.tKey)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

/* ─── NavItem: unified icon + sliding text ──────────── */
function NavItem({ icon, label, active = false, expanded, onClick, tutorialId }) {
  const [hover, setHover] = useState(false);
  const { theme } = useTheme();
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      data-tutorial-id={tutorialId || undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center",
        width: "100%",
        padding: expanded ? "7px 6px" : "7px 0",
        justifyContent: expanded ? "flex-start" : "center",
        gap: expanded ? 9 : 0,
        borderRadius: 8, border: "none",
        background: active
          ? "white"
          : hover ? "rgba(255,255,255,0.13)" : "transparent",
        color: active ? theme.accent : "white",
        cursor: "pointer",
        position: "relative",
        transition: `background 0.15s, padding 0.26s ${EASE}`,
        opacity: active ? 1 : 0.85,
      }}
    >
      {/* Active indicator bar (collapsed mode only) */}
      {!expanded && active && (
        <span style={{
          position: "absolute", left: -7, top: 6, bottom: 6, width: 3,
          background: "white", borderRadius: 2,
        }} />
      )}

      {/* Icon — always visible, fixed width */}
      <span style={{ flexShrink: 0, width: 22, display: "inline-flex", justifyContent: "center", alignItems: "center" }}>
        {icon}
      </span>

      {/* Label — slides in/out */}
      <span style={{
        overflow: "hidden",
        whiteSpace: "nowrap",
        maxWidth: expanded ? 160 : 0,
        opacity: expanded ? 1 : 0,
        fontSize: 13.5,
        fontWeight: active ? 700 : 450,
        transition: `max-width 0.26s ${EASE}, opacity 0.2s`,
        letterSpacing: -0.1,
      }}>
        {label}
      </span>
    </button>
  );
}

/* ─── WideBtn: expanded-only wide button ─────────────── */
function WideBtn({ icon, label, active = false, small = false, bullet = false, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 9,
        width: "100%", padding: small ? "5px 8px" : "7px 8px",
        borderRadius: 8, border: "none",
        background: active ? "rgba(255,255,255,0.22)" : hover ? "rgba(255,255,255,0.13)" : "transparent",
        color: active ? "white" : "rgba(255,255,255,0.85)",
        fontSize: small ? 12.5 : 13.5, fontWeight: active ? 600 : 450,
        cursor: "pointer", textAlign: "left", transition: "background 0.1s",
        whiteSpace: "nowrap", overflow: "hidden",
      }}
    >
      {bullet && !icon && (
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: active ? "white" : "rgba(255,255,255,0.45)", flexShrink: 0 }} />
      )}
      {icon && (
        <span style={{ color: active ? "white" : "rgba(255,255,255,0.65)", flexShrink: 0, display: "inline-flex", alignItems: "center" }}>
          {icon}
        </span>
      )}
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
    </button>
  );
}

/* ─── SideIconBtn: bottom row icon button ────────────── */
function SideIconBtn({ children, title, onClick, active = false, tutorialId }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick?.(); }} title={title}
      data-tutorial-id={tutorialId || undefined}
      style={{
        width: 34, height: 34, borderRadius: 8, border: "none",
        background: active ? "rgba(255,255,255,0.22)" : "transparent",
        color: "white", cursor: "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        position: "relative", transition: "background 0.15s",
        opacity: active ? 1 : 0.8, flexShrink: 0,
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.13)"; e.currentTarget.style.opacity = 1; } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.opacity = 0.8; } }}
    >
      {children}
    </button>
  );
}

/* ─── MenuItem: flyout popup item ────────────────────── */
function MenuItem({ icon, label, hint, right, onClick, danger = false }) {
  return (
    <button onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 10px", borderRadius: 6,
        border: "none", background: "transparent",
        color: danger ? "#DC2626" : "#0F172A",
        fontSize: 13, fontWeight: 500, cursor: "pointer", textAlign: "left",
      }}
      onMouseEnter={e => e.currentTarget.style.background = danger ? "#FEF2F2" : "#F1F5F9"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <span style={{ color: danger ? "#DC2626" : "#475569", display: "inline-flex" }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {hint && <span style={{ fontSize: 11, color: "#94A3B8", fontFamily: "monospace" }}>{hint}</span>}
      {right}
    </button>
  );
}
