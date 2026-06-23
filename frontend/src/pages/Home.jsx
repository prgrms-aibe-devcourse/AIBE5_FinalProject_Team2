import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  MessageSquare, FlaskConical,
  ShieldCheck, TrendingUp, ArrowRight,
  BarChart3, Brain, Zap, Check, Sparkles, Code2,
} from "lucide-react";
import bannerVideo from "../assets/배너후보.mp4";
import heliTqqqSoxl from "../assets/heli_tqqq_soxl.png";  // 무한매수법(IB) — TQQQ·SOXL
import heliVrQld from "../assets/heli_vr_qld.png";        // 밸류 리밸런싱(VR) — QLD
import heliSector from "../assets/heli_sector.png";       // 섹터 모멘텀 로테이션
import { useLanguage } from "../i18n/useLanguage";
import translations from "../i18n/translations";
import LoginRequiredModal from "../components/shell/LoginRequiredModal";
import CreateWorkspaceModal from "../alpha/CreateWorkspaceModal";
import StrategyDetailModal from "./StrategyDetailModal";
import { createWorkspace } from "../alpha/alphaApi";
import useTutorialStore from "../store/useTutorialStore";

const BASE_FONT = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const REVEAL_THRESHOLD = 0.12;

function useReveal() {
  const ref  = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setOn(true); obs.disconnect(); } },
      { threshold: REVEAL_THRESHOLD }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, on];
}

function Reveal({ children, delay = 0, y = 28, style = {} }) {
  const [ref, on] = useReveal();
  return (
    <div ref={ref} style={{
      ...style,
      opacity: on ? 1 : 0,
      transform: on ? "translateY(0)" : `translateY(${y}px)`,
      transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

/* ── 백테스트 미니 차트 ── */
function MiniBacktestChart() {
  const { t } = useLanguage();
  const pts = [0,68, 40,62, 80,55, 120,58, 160,45, 200,38, 240,28, 280,20, 300,12];
  const path = pts.reduce((acc, v, i) => i % 2 === 0 ? acc + `${i === 0 ? "M" : "L"} ${v} ` : acc + `${v} `, "");
  const area = path + `L 300 80 L 0 80 Z`;
  return (
    <div style={{ padding: "14px 16px", borderRadius: 12, background: "#F8FAFF", border: "1px solid #DBEAFE" }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "#64748b", marginBottom: 10 }}>{t("home.miniCharts.backtest.label")}</div>
      <svg width="100%" viewBox="0 0 300 80" style={{ display: "block", marginBottom: 10 }}>
        <defs>
          <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[20,40,60,80].map(y => <line key={y} x1="0" x2="300" y1={y} y2={y} stroke="#E2E8F0" strokeWidth="0.6" />)}
        <path d={area} fill="url(#eq)" />
        <path d={path} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ display: "flex", gap: 16 }}>
        {[[t("home.miniCharts.backtest.totalReturn"), "+127.4%", "#10b981"], ["Sharpe", "1.82", "#3b82f6"], [t("home.miniCharts.backtest.mdd"), "-18.3%", "#ef4444"]].map(([label, val, color]) => (
          <div key={label}>
            <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color }}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Trust Score 미니 게이지 ── */
function MiniTrustScore() {
  const { t, lang } = useLanguage();
  const score = 72;
  const r = 28, c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const metricLabels = (translations[lang]?.home?.miniCharts?.trust?.metrics) || translations.en.home.miniCharts.trust.metrics;
  const metricColors = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ec4899"];
  const metricVals   = [68, 55, 88, 79, 62];
  const metrics = metricLabels.map((label, i) => ({ label, val: metricVals[i], color: metricColors[i] }));
  return (
    <div style={{ padding: "14px 16px", borderRadius: 12, background: "#F8FAFF", border: "1px solid #D1FAE5" }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "#64748b", marginBottom: 12 }}>{t("home.miniCharts.trust.label")}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
          <svg width="72" height="72" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r={r} stroke="#E2E8F0" strokeWidth="6" fill="none" />
            <circle cx="36" cy="36" r={r} stroke="#10b981" strokeWidth="6" fill="none"
              strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
              transform="rotate(-90 36 36)" style={{ transition: "stroke-dashoffset 0.6s" }} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", lineHeight: 1 }}>{score}</span>
            <span style={{ fontSize: 9, color: "#94a3b8" }}>/ 100</span>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
          {metrics.map(m => (
            <div key={m.label}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748b", marginBottom: 2 }}>
                <span>{m.label}</span><span style={{ fontWeight: 700, color: m.color }}>{m.val}</span>
              </div>
              <div style={{ height: 3, background: "#E2E8F0", borderRadius: 2 }}>
                <div style={{ width: `${m.val}%`, height: "100%", background: m.color, borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── KIS 주문 카드 ── */
function MiniOrderCard() {
  const { t } = useLanguage();
  return (
    <div style={{ padding: "14px 16px", borderRadius: 12, background: "#F8FAFF", border: "1px solid #FEF3C7" }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "#64748b", marginBottom: 10 }}>{t("home.miniCharts.order.label")}</div>
      <div style={{ background: "white", borderRadius: 10, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{t("home.miniCharts.order.company")} <span style={{ fontSize: 10, color: "#64748b" }}>{t("home.miniCharts.order.ticker")}</span></div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>{t("home.miniCharts.order.tag")}</div>
          </div>
          <span style={{ padding: "3px 10px", borderRadius: 999, background: "#DBEAFE", color: "#1d4ed8", fontSize: 11, fontWeight: 700 }}>{t("home.miniCharts.order.orderType")}</span>
        </div>
        <div style={{ padding: "10px 14px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, borderBottom: "1px solid #F1F5F9" }}>
          {[[t("home.miniCharts.order.qty"), t("home.miniCharts.order.qtyVal")], [t("home.miniCharts.order.price"), t("home.miniCharts.order.priceVal")], [t("home.miniCharts.order.total"), t("home.miniCharts.order.totalVal")]].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 9, color: "#94a3b8", marginBottom: 2 }}>{k}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: "10px 14px", display: "flex", gap: 8 }}>
          <button style={{ flex: 1, padding: "7px", borderRadius: 7, border: "none", background: "#10b981", color: "white", fontSize: 12, fontWeight: 700, cursor: "default" }}>{t("home.miniCharts.order.approve")}</button>
          <button style={{ flex: 1, padding: "7px", borderRadius: 7, border: "1px solid #E2E8F0", background: "white", color: "#64748b", fontSize: 12, fontWeight: 600, cursor: "default" }}>{t("home.miniCharts.order.reject")}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Quant Developer IDE 미니 코드에디터 ── */
function MiniIDE() {
  const { t } = useLanguage();
  const lines = [
    [[t("home.miniCharts.ide.comment"), "#6b7280"]],
    [["TICKER", "#9cdcfe"], ["   = ", "#d4d4d4"], ["\"SPY\"", "#ce9178"]],
    [["SMA_FAST", "#9cdcfe"], [" = ", "#d4d4d4"], ["20", "#b5cea8"]],
    [["class ", "#569cd6"], ["MyStrategy", "#4ec9b0"], ["(QCAlgorithm):", "#d4d4d4"]],
    [["  def ", "#569cd6"], ["OnData", "#dcdcaa"], ["(self, data):", "#d4d4d4"]],
    [["    if ", "#c586c0"], ["fast > slow:", "#d4d4d4"]],
    [["      self.", "#9cdcfe"], ["SetHoldings", "#dcdcaa"], ["(sym, 1.0)", "#d4d4d4"]],
  ];
  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #1e293b", boxShadow: "0 4px 16px rgba(15,23,42,0.18)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0f172a", padding: "8px 12px" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "#cbd5e1", fontWeight: 600 }}>
          <Code2 size={13} color="#a78bfa" /> main.py
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: "white", background: "linear-gradient(135deg,#8b5cf6,#6366f1)", padding: "4px 9px", borderRadius: 6 }}>
          ▶ Run Backtest
        </span>
      </div>
      <div style={{ background: "#0b1120", padding: "10px 0", fontFamily: "'JetBrains Mono','Consolas',monospace", fontSize: 11, lineHeight: 1.7 }}>
        {lines.map((segs, i) => (
          <div key={i} style={{ display: "flex", padding: "0 12px" }}>
            <span style={{ width: 20, color: "#475569", flexShrink: 0, textAlign: "right", marginRight: 12, userSelect: "none" }}>{i + 1}</span>
            <span style={{ whiteSpace: "pre" }}>
              {segs.map(([txt, col], j) => <span key={j} style={{ color: col }}>{txt}</span>)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const STEP_ICONS = [
  <MessageSquare size={22} color="#818cf8" />,
  <FlaskConical  size={22} color="#818cf8" />,
  <ShieldCheck   size={22} color="#818cf8" />,
  <TrendingUp    size={22} color="#818cf8" />,
];

const TAB_META = [
  { key: "ai",       Icon: Brain,       emoji: "🧠", color: "#6366f1", soft: "#EEF2FF" },
  { key: "ide",      Icon: Code2,       emoji: "⌨️", color: "#8b5cf6", soft: "#EDE9FE", Visual: MiniIDE },
  { key: "backtest", Icon: BarChart3,   emoji: "📊", color: "#3b82f6", soft: "#DBEAFE", Visual: MiniBacktestChart },
  { key: "trust",    Icon: ShieldCheck, emoji: "🛡️", color: "#10b981", soft: "#D1FAE5", Visual: MiniTrustScore },
  { key: "kis",      Icon: Zap,         emoji: "⚡", color: "#f59e0b", soft: "#FEF3C7", Visual: MiniOrderCard },
];

const PROJECTS_TAGS = [
  ["#분할매수", "#KIS", "#실거래검증"],   // 무한매수법
  ["#상대강도", "#로테이션", "#섹터"],    // 섹터 모멘텀
  ["#밴드리밸런싱", "#Regime"],          // 밸류 리밸런싱
];

// 템플릿 카드 상단 이미지 배너(언어 무관). image 경로를 채우면 그 이미지를, 비어 있으면 그라데이션 + 티커/이모지 플레이스홀더를 보여준다.
// 실제 이미지는 public/templates/ 에 넣고 아래 image 만 채우면 됨 (예: image: "/templates/tqqq.jpg").
const PROJECT_VISUALS = [
  { ticker: "IB",     emoji: "🚀", accent: "#6d28d9", gradient: "linear-gradient(135deg, #dbeafe 0%, #ede9fe 55%, #f5d0fe 100%)", image: heliTqqqSoxl },
  { ticker: "SECTOR", emoji: "🔄", accent: "#b45309", gradient: "linear-gradient(135deg, #fef3c7 0%, #fae8ff 55%, #dbeafe 100%)", image: heliSector },
  { ticker: "VR",     emoji: "⚖️", accent: "#0e7490", gradient: "linear-gradient(135deg, #cffafe 0%, #dbeafe 55%, #ede9fe 100%)", image: heliVrQld },
];

export default function Home() {
  const navigate  = useNavigate();
  const { t, lang } = useLanguage();
  const videoRef  = useRef(null);
  const [hoveredProject, setHoveredProject] = useState(null);
  const [activeTab, setActiveTab] = useState("ai");
  const [showLogin, setShowLogin] = useState(false);
  const [newWsOpen, setNewWsOpen]   = useState(false);
  const [newWsName, setNewWsName]   = useState("");
  const [newWsError, setNewWsError] = useState("");
  const [detailIdx, setDetailIdx]   = useState(null);  // 대표 전략 상세 모달 (홈 카드 클릭)

  const isAuthed = !!localStorage.getItem("dbId");
  const startTutorial = useTutorialStore((s) => s.start);
  const tr = translations[lang]?.home || translations.en.home;
  const projects = tr.projectSection.projects;
  const FLOW_STEPS = (tr.flowSteps || []).map((s, i) => ({ ...s, icon: STEP_ICONS[i] }));
  const FEATURE_TABS = TAB_META.map(m => ({ ...m, ...(tr.featureTabs?.[m.key] || {}) }));
  const activeFeature = FEATURE_TABS.find(f => f.key === activeTab);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = 0.55;
    const onTimeUpdate = () => {
      if (v.duration && v.currentTime >= v.duration - 0.2) v.currentTime = 0;
    };
    v.addEventListener("timeupdate", onTimeUpdate);
    return () => v.removeEventListener("timeupdate", onTimeUpdate);
  }, []);

  const handleBriefing    = () => { if (!isAuthed) { setShowLogin(true); return; } navigate("/briefing"); };
  const handleNewStrategy = () => { if (!isAuthed) { setShowLogin(true); return; } setNewWsName(""); setNewWsError(""); setNewWsOpen(true); };
  const confirmNewWs = async () => {
    const trimmed = newWsName.trim();
    if (!trimmed) return;
    setNewWsError("");
    setNewWsOpen(false);
    try {
      const w = await createWorkspace(trimmed);
      navigate(`/alpha/w/${w.id}`);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      if (e?.response?.status === 409) { setNewWsOpen(true); setNewWsError(msg); }
      else alert(t("home.createFail") + msg);
    }
  };

  return (
    <>
    <style>{`
      .rp-page { min-height: 100vh; background-color: #fff; padding: 0; }
      .home-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
      .home-grid-4-stats { display: grid; grid-template-columns: repeat(4, 1fr); }
      .home-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
      .home-grid-2col { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0; }
      @media (max-width: 1024px) {
        .home-grid-4 { grid-template-columns: repeat(2, 1fr); }
        .home-grid-4-stats { grid-template-columns: repeat(2, 1fr); gap: 16px 0; }
        .home-grid-3 { grid-template-columns: 1fr; }
        .home-grid-2col { grid-template-columns: 1fr; }
        .home-feature-col { padding: 24px clamp(16px, 3vw, 32px) !important; }
      }
      @media (max-width: 640px) {
        .home-grid-4 { grid-template-columns: 1fr; }
        .home-grid-4-stats { grid-template-columns: repeat(2, 1fr); }
      }
    `}</style>
    <div className="rp-page" style={{ fontFamily: BASE_FONT }}>

      {/* ── HERO ── */}
      <section style={{ position: "relative", width: "100%", height: 580, overflow: "hidden" }}>
        <video
          ref={videoRef} src={bannerVideo} autoPlay loop muted playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }}
        />
        {/* 다크 그라데이션 */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, rgba(10,15,30,0.35) 0%, rgba(10,15,30,0.50) 100%)" }} />
        {/* 미묘한 도트 그리드 오버레이 */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }} />

        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 20px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", maxWidth: 680 }}>

            {/* 상단 태그 */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 24,
              background: "rgba(255,255,255,0.08)", backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.15)", borderRadius: 999,
              padding: "6px 18px",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#818cf8", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", fontWeight: 600, letterSpacing: 0.4 }}>{t("home.heroBadge")}</span>
            </div>

            <h1 style={{ fontSize: 48, fontWeight: 900, color: "white", lineHeight: 1.2, marginBottom: 20, textShadow: "0 2px 24px rgba(0,0,0,0.5)", fontFamily: BASE_FONT }}>
              {isAuthed
                ? <>{t("home.clientHeroTitle1")}<br />{t("home.clientHeroTitle2")}</>
                : <>{t("home.heroTitle1")}<br />{t("home.heroTitle2")}</>
              }
            </h1>

            {/* 서브타이틀 — 글라스 pill */}
            <div style={{
              background: "rgba(255,255,255,0.07)", backdropFilter: "blur(14px)",
              border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12,
              padding: "14px 28px", marginBottom: 32,
            }}>
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.82)", fontFamily: BASE_FONT, fontWeight: 400, margin: 0, lineHeight: 1.7, whiteSpace: "pre-line" }}>
                {t("home.heroDesc")}
              </p>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={handleBriefing} style={{
                padding: "13px 30px", borderRadius: 9, border: "none",
                background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer",
                fontFamily: BASE_FONT, boxShadow: "0 4px 18px rgba(99,102,241,0.45)",
                transition: "transform 0.15s, opacity 0.15s",
              }}
                onMouseEnter={e => { e.currentTarget.style.opacity = "0.9"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "none"; }}
              >
                {isAuthed ? t("home.clientBtnFind") : t("home.btnUpgrade")}
              </button>
              <button onClick={handleNewStrategy} style={{
                padding: "13px 30px", borderRadius: 9,
                border: "1px solid rgba(255,255,255,0.3)",
                background: "rgba(255,255,255,0.08)", backdropFilter: "blur(10px)",
                color: "white", fontWeight: 600, fontSize: 15, cursor: "pointer",
                fontFamily: BASE_FONT, transition: "transform 0.15s, background 0.15s",
              }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.16)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.transform = "none"; }}
              >
                {t("home.clientBtnRegister")}
              </button>
            </div>

            {/* Tutorial trigger — authenticated users only */}
            {isAuthed && (
              <button
                onClick={startTutorial}
                style={{
                  marginTop: 16,
                  padding: "10px 26px", borderRadius: 9,
                  border: "1px solid rgba(255,255,255,0.22)",
                  background: "rgba(255,255,255,0.07)", backdropFilter: "blur(10px)",
                  color: "rgba(255,255,255,0.88)", fontWeight: 600, fontSize: 13.5,
                  cursor: "pointer", fontFamily: BASE_FONT,
                  display: "inline-flex", alignItems: "center", gap: 8,
                  transition: "background 0.15s, transform 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.14)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.transform = "none"; }}
              >
                <Sparkles size={15} style={{ opacity: 0.9 }} />
                {t("home.tutorialBtn")}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{
        background: "#F0F9FF",
        backgroundImage: "linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
        padding: "80px 0",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", width: "100%", padding: "0 20px", boxSizing: "border-box" }}>
          <Reveal>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>How it works</p>
            <h2 style={{ fontSize: 30, fontWeight: 800, color: "#0f172a", margin: "0 0 12px", fontFamily: BASE_FONT }}>{t("home.howItWorks.title")}</h2>
            <p style={{ fontSize: 14, color: "#475569", maxWidth: 420, margin: "0 auto", lineHeight: 1.8, whiteSpace: "pre-line" }}>
              {t("home.howItWorks.subtitle")}
            </p>
          </div>
          </Reveal>

          <div className="home-grid-4">
            {FLOW_STEPS.map((s, i) => (
              <Reveal key={i} delay={i * 100} style={{ height: "100%" }}>
              <div style={{ position: "relative", height: "100%" }}>
                {i < FLOW_STEPS.length - 1 && (
                  <div style={{
                    position: "absolute", top: 28, right: -12, zIndex: 1,
                    width: 24, display: "flex", alignItems: "center",
                  }}>
                    <div style={{ flex: 1, height: 1, background: "rgba(99,102,241,0.25)" }} />
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#6366f1", flexShrink: 0 }} />
                  </div>
                )}
                <div style={{
                  background: "white",
                  border: "1px solid #E2E8F0",
                  borderRadius: 14, padding: "28px 22px",
                  height: "100%", boxSizing: "border-box",
                  boxShadow: "0 2px 12px rgba(99,102,241,0.06)",
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12, marginBottom: 18,
                    background: "#EEF2FF", border: "1px solid #C7D2FE",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {s.icon}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: 2, marginBottom: 8, fontFamily: BASE_FONT }}>STEP {s.step}</div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 10, fontFamily: BASE_FONT, lineHeight: 1.4 }}>{s.title}</h3>
                  <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.75, margin: 0 }}>{s.desc}</p>
                </div>
              </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section style={{
        background: "linear-gradient(90deg, #1e3a8a 0%, #1e1b4b 50%, #1e3a8a 100%)",
        borderTop: "1px solid rgba(99,102,241,0.3)",
        borderBottom: "1px solid rgba(99,102,241,0.3)",
        padding: "44px 0",
      }}>
        <div className="home-grid-4-stats" style={{ maxWidth: 860, margin: "0 auto", width: "100%", padding: "0 20px", boxSizing: "border-box" }}>
          {(tr.stats || []).map((s, i) => (
            <div key={i} style={{
              textAlign: "center",
              borderRight: i < (tr.stats || []).length - 1 ? "1px solid rgba(255,255,255,0.1)" : "none",
              padding: "0 20px",
            }}>
              <Reveal delay={i * 80} y={18}>
                <div style={{ fontSize: 34, fontWeight: 900, color: "white", fontFamily: BASE_FONT, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 8, letterSpacing: 0.3 }}>{s.label}</div>
              </Reveal>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES (탭) ── */}
      <section style={{ padding: "88px 0", background: "#F8FAFC" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 20px", boxSizing: "border-box" }}>
          <Reveal>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Features</p>
            <h2 style={{ fontSize: 30, fontWeight: 800, color: "#0f172a", margin: "0 0 12px", fontFamily: BASE_FONT }}>
              {(() => {
                const [pre, post] = t("home.featureSection.title").split("Alpha-Helix");
                return <>{pre}<span style={{ fontFamily: "'Inter Tight', sans-serif", fontWeight: 500, letterSpacing: -0.3 }}>ALPHA-HELIX</span>{post}</>;
              })()}
            </h2>
            <p style={{ fontSize: 14, color: "#64748b", maxWidth: 420, margin: "0 auto", lineHeight: 1.8 }}>
              {t("home.featureSection.subtitle")}
            </p>
          </div>
          </Reveal>

          {/* 탭 바 */}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${FEATURE_TABS.length}, 1fr)`, borderBottom: "1.5px solid #E2E8F0", marginBottom: 0 }}>
            {FEATURE_TABS.map(f => {
              const isActive = activeTab === f.key;
              return (
              <button key={f.key} onClick={() => setActiveTab(f.key)} style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "12px 6px",
                border: "none",
                background: isActive ? f.soft : "none",
                fontSize: 13.5, fontWeight: isActive ? 700 : 500,
                color: isActive ? f.color : "#64748b",
                cursor: "pointer", fontFamily: BASE_FONT,
                borderBottom: isActive ? `2px solid ${f.color}` : "2px solid transparent",
                borderTopLeftRadius: 8, borderTopRightRadius: 8,
                marginBottom: -1.5, transition: "color 0.15s, background 0.2s", whiteSpace: "nowrap",
              }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = "#374151"; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = "#64748b"; }}
              >
                <f.Icon size={15} />
                {f.label}
              </button>
              );
            })}
          </div>

          {/* 탭 콘텐츠 */}
          {activeFeature && (
            <div style={{
              background: "white",
              border: "1.5px solid #E2E8F0", borderTop: "none",
              borderRadius: "0 0 16px 16px",
              overflow: "hidden",
              boxShadow: "0 8px 32px rgba(0,0,0,0.06)",
            }}>
              {/* 상단 컬러 accent bar */}
              <div style={{ height: 4, background: `linear-gradient(90deg, ${activeFeature.color}, ${activeFeature.color}88)` }} />

              <div className="home-grid-2col">
                {/* 왼쪽: 설명 */}
                <div className="home-feature-col" style={{ padding: "36px 32px", borderRight: "1px solid #F1F5F9" }}>
                  {/* 기능 태그 */}
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16,
                    padding: "5px 12px", borderRadius: 999,
                    background: activeFeature.soft,
                    fontSize: 12, fontWeight: 700, color: activeFeature.color,
                  }}>
                    <span>{activeFeature.emoji}</span>
                    {activeFeature.label}
                  </div>

                  <h3 style={{
                    fontSize: 20, fontWeight: 800, lineHeight: 1.4, marginBottom: 16,
                    fontFamily: BASE_FONT, color: "#0f172a",
                  }}>
                    {activeFeature.headline}
                  </h3>

                  {/* 구분선 */}
                  <div style={{ width: 36, height: 3, borderRadius: 2, background: activeFeature.color, marginBottom: 16 }} />

                  {/* 말풍선 예시 */}
                  {activeFeature.quotes && (
                    <div style={{
                      marginBottom: 18, padding: "14px 16px", borderRadius: 12,
                      background: "#F8FAFF", border: "1px solid #E2E8F0",
                      display: "flex", flexDirection: "column", gap: 8,
                    }}>
                      {activeFeature.quotes.map((q, i) => (
                        <div key={i} style={{
                          display: "flex",
                          justifyContent: q.role === "user" ? "flex-end" : "flex-start",
                        }}>
                          <div style={{
                            maxWidth: "80%", padding: "7px 12px", borderRadius: q.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                            background: q.role === "user" ? activeFeature.color : "white",
                            border: q.role === "ai" ? `1px solid ${activeFeature.soft}` : "none",
                            color: q.role === "user" ? "white" : "#334155",
                            fontSize: 12.5, fontWeight: q.role === "user" ? 600 : 500,
                            lineHeight: 1.5,
                            boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
                          }}>
                            {q.role === "ai" && <span style={{ fontSize: 10, fontWeight: 700, color: activeFeature.color, display: "block", marginBottom: 2 }}>Heli AI</span>}
                            {q.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeFeature.Visual && (
                    <div style={{ marginBottom: 16 }}>
                      <activeFeature.Visual />
                    </div>
                  )}

                  <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.9, margin: 0 }}>
                    {activeFeature.body}
                  </p>
                </div>

                {/* 오른쪽: 포인트 */}
                <div className="home-feature-col" style={{ padding: "36px 32px", background: "#FAFBFF", display: "flex", flexDirection: "column", gap: 12, justifyContent: "center" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                    {t("home.featureSection.keyFeatures")}
                  </div>
                  {activeFeature.points.map((pt, i) => {
                    const [title, ...rest] = pt.split(" — ");
                    const desc = rest.join(" — ");
                    return (
                      <div key={i} style={{
                        display: "flex", alignItems: "flex-start", gap: 12,
                        padding: "12px 14px", borderRadius: 10,
                        background: "white", border: "1px solid #E2E8F0",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                          background: activeFeature.soft,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 800, color: activeFeature.color, marginTop: 1,
                        }}>
                          {i + 1}
                        </div>
                        <div>
                          {desc ? (
                            <>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a", lineHeight: 1.4 }}>{title}</div>
                              <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6, marginTop: 2 }}>{desc}</div>
                            </>
                          ) : (
                            <div style={{ fontSize: 12.5, color: "#1e293b", lineHeight: 1.6 }}>{pt}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── 전략 템플릿 ── */}
      <section style={{ padding: "80px 0", background: "white" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", width: "100%", padding: "0 20px", boxSizing: "border-box" }}>
          <Reveal>
          <div style={{ marginBottom: 40 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Templates</p>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <h2 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", margin: 0, fontFamily: BASE_FONT }}>{t("home.projectSection.title")}</h2>
              <span style={{
                fontSize: 12, fontWeight: 800, padding: "4px 13px", borderRadius: 999,
                background: "linear-gradient(135deg, #bfdbfe 0%, #ddd6fe 55%, #f5d0fe 100%)",
                color: "#4338ca", letterSpacing: 0.3, whiteSpace: "nowrap",
                boxShadow: "0 2px 10px rgba(129,140,248,0.30)",
              }}>{lang === "en" ? "Free" : lang === "zh" ? "免费提供" : "무료 제공"}</span>
            </div>
            <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>{t("home.templatesSection.subtitle")}</p>
          </div>
          </Reveal>

          <div className="home-grid-3">
            {projects.map((proj, i) => {
              const vis = PROJECT_VISUALS[i] || {};
              return (
              <Reveal key={i} delay={i * 100}>
              <div onClick={() => setDetailIdx(i)} style={{
                borderRadius: 14, overflow: "hidden",
                border: hoveredProject === i ? "1.5px solid #c7d2fe" : "1.5px solid #F1F5F9",
                backgroundColor: "white", cursor: "pointer",
                display: "flex", flexDirection: "column",
                transform: hoveredProject === i ? "translateY(-4px)" : "translateY(0)",
                boxShadow: hoveredProject === i ? "0 16px 40px rgba(99,102,241,0.12)" : "0 2px 8px rgba(0,0,0,0.05)",
                transition: "all 0.2s",
              }}
                onMouseEnter={() => setHoveredProject(i)}
                onMouseLeave={() => setHoveredProject(null)}
              >
                {/* 이미지 배너 — public/templates/ 에 이미지를 넣고 PROJECT_VISUALS[i].image 경로만 채우면 교체됨. 비어 있으면 그라데이션 + 티커/이모지 플레이스홀더. */}
                <div style={{
                  height: 188, flexShrink: 0, position: "relative", overflow: "hidden",
                  background: vis.image ? `#0f172a url(${vis.image}) center/cover no-repeat` : vis.gradient,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {!vis.image && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: 40, lineHeight: 1, filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.12))" }}>{vis.emoji}</span>
                      <span style={{ fontSize: 26, fontWeight: 900, letterSpacing: 1.5, color: vis.accent, fontFamily: BASE_FONT, opacity: 0.92 }}>{vis.ticker}</span>
                    </div>
                  )}
                </div>
                <div style={{ padding: "18px 20px 22px", display: "flex", flexDirection: "column", flex: 1 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 8, fontFamily: BASE_FONT, lineHeight: 1.4 }}>{proj.title}</h3>
                  <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.75, marginBottom: 14, minHeight: 88 }}>{proj.desc}</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: "auto" }}>
                    {[...proj.badge.split(" "), ...PROJECTS_TAGS[i]].map(tag => (
                      <span key={tag} style={{
                        fontSize: 11, color: "#4f46e5", fontWeight: 600,
                        background: "#EEF2FF", borderRadius: 4, padding: "2px 8px",
                      }}>{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
              </Reveal>
            );})}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{
        background: "#080d18",
        backgroundImage: "radial-gradient(ellipse 80% 50% at 50% 100%, rgba(99,102,241,0.15) 0%, transparent 70%)",
        padding: "96px 0", textAlign: "center",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 20px", boxSizing: "border-box" }}>
          <Reveal>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: "white", lineHeight: 1.3, marginBottom: 14, fontFamily: BASE_FONT }}>
            {t("home.cta.title")}
          </h2>
          <p style={{ fontSize: 14, color: "#4b5563", lineHeight: 1.8, marginBottom: 36, whiteSpace: "pre-line" }}>
            {t("home.cta.desc")}
          </p>
          <button onClick={handleNewStrategy} style={{
            padding: "14px 36px", borderRadius: 10, border: "none",
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            color: "white", fontWeight: 700, fontSize: 15,
            cursor: "pointer", fontFamily: BASE_FONT,
            boxShadow: "0 4px 20px rgba(99,102,241,0.4)",
            transition: "transform 0.15s, opacity 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.opacity = "0.9"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "none"; }}
          >
            {t("home.cta.btn")}
          </button>
          </Reveal>
        </div>
      </section>

    </div>

    <LoginRequiredModal open={showLogin} onClose={() => setShowLogin(false)} />

    <CreateWorkspaceModal
      open={newWsOpen}
      name={newWsName}
      onChange={v => { setNewWsName(v); setNewWsError(""); }}
      onConfirm={confirmNewWs}
      onClose={() => { setNewWsOpen(false); setNewWsError(""); }}
      error={newWsError}
    />

    <StrategyDetailModal
      open={detailIdx !== null}
      ticker={detailIdx !== null ? (PROJECT_VISUALS[detailIdx]?.ticker) : null}
      project={detailIdx !== null ? {
        title: projects[detailIdx]?.title,
        desc: projects[detailIdx]?.desc,
        tags: [...(projects[detailIdx]?.badge?.split(" ") || []), ...(PROJECTS_TAGS[detailIdx] || [])],
        image: PROJECT_VISUALS[detailIdx]?.image,
      } : null}
      onClose={() => setDetailIdx(null)}
      onStart={() => { setDetailIdx(null); navigate("/alpha?lib=1"); }}
    />
    </>
  );
}
