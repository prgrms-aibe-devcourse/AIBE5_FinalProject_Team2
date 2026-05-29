import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Layers, MessageSquare, FlaskConical,
  ShieldCheck, TrendingUp, ArrowRight,
  BarChart3, Brain, Zap, Check,
} from "lucide-react";
import bannerVideo from "../assets/배너후보.mp4";
import { useLanguage } from "../i18n/LanguageContext";
import translations from "../i18n/translations";
import LoginRequiredModal from "../components/shell/LoginRequiredModal";

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

const FLOW_STEPS = [
  { icon: <MessageSquare size={22} color="#818cf8" />, step: "01", title: "자연어로 전략 입력",  desc: '"SPY에 RSI 전략으로 투자하고 싶어" — AI가 전략 파라미터를 자동 구성합니다.' },
  { icon: <FlaskConical   size={22} color="#818cf8" />, step: "02", title: "백테스트 실행",       desc: "vectorbt 엔진으로 7가지 전략을 과거 데이터로 검증. 수수료·슬리피지까지 반영합니다." },
  { icon: <ShieldCheck    size={22} color="#818cf8" />, step: "03", title: "AI 신뢰도 분석",     desc: "Walk-Forward · Regime HMM · 파라미터 섭동으로 전략의 Trust Score를 산출합니다." },
  { icon: <TrendingUp     size={22} color="#818cf8" />, step: "04", title: "실주문 연결",         desc: "KIS OpenAPI로 모의투자 → 실거래까지 원클릭. Kill-Switch 안전장치가 항상 작동합니다." },
];

const STATS = [
  { value: "7+",      label: "백테스트 전략" },
  { value: "5-State", label: "Regime HMM 분석" },
  { value: "3단계",   label: "Trust Score 검증" },
  { value: "실시간",  label: "KIS 실거래 연동" },
];

const FEATURE_TABS = [
  {
    key: "ai", Icon: Brain, label: "멀티 LLM AI 대화",
    headline: "말 한 마디로 퀀트 전략을 완성하세요",
    body: "투자 전략을 코드로 짤 필요가 없습니다. 원하는 전략을 자연어로 입력하면 AI가 파라미터를 추천하고, 대화를 이어가며 전략을 다듬을 수 있습니다. 전략 수정도 'RSI 기간을 14로 바꿔줘' 한 마디면 충분합니다.",
    points: [
      "Gemini 2.5-flash 기본 · OpenAI · Anthropic · Perplexity 자동 폴백",
      "대화 히스토리 유지 — 이전 맥락을 기억하고 전략을 단계적으로 정교화",
      "Goal Profile 자동 추출 — 투자 목표·기간·리스크 허용도를 대화에서 파악",
      "사용자별 시간당 20회 요청 제한으로 안정적인 서비스 제공",
    ],
  },
  {
    key: "backtest", Icon: BarChart3, label: "백테스트 엔진",
    headline: "7가지 검증된 전략으로 과거를 시뮬레이션",
    body: "vectorbt 기반 고성능 백테스트 엔진이 수년치 데이터를 수초 안에 검증합니다. 단순 수익률만이 아니라 MDD, 샤프 지수, 연간 변동성까지 한눈에 파악할 수 있는 QuantStats HTML 리포트를 자동으로 생성합니다.",
    points: [
      "7가지 전략 — SMA Cross · RSI · MACD · Momentum · VIX Risk-off · 무한매수법 · Buy & Hold",
      "수수료 0.25% + 슬리피지 0.1% 반영으로 현실적인 수익률 산출",
      "Walk-Forward 검증으로 과적합(overfitting) 위험 자동 탐지",
      "QuantStats HTML Tearsheet 자동 생성 — 브라우저에서 바로 열람",
    ],
  },
  {
    key: "trust", Icon: ShieldCheck, label: "Trust Score",
    headline: "전략을 믿기 전에, 먼저 검증하세요",
    body: "높은 백테스트 수익률이 실전에서도 유효하다는 보장은 없습니다. Alpha-Helix의 Trust Score는 세 가지 독립적인 관점으로 전략의 실전 신뢰도를 0~100점으로 평가합니다. 점수가 낮다면 전략을 다시 다듬을 신호입니다.",
    points: [
      "Walk-Forward 검증 — 훈련/테스트 기간을 분리해 미래 데이터 누수 차단",
      "5-State Regime HMM — bull_stable · bull_volatile · sideways · bear · high_vol_unstable 국면별 성과 분석",
      "파라미터 섭동 — 핵심 파라미터를 ±10% 변동시켜 전략의 민감도 측정",
      "XGBoost + SHAP — 오늘의 매매 시그널 근거를 변수 중요도로 시각화",
    ],
  },
  {
    key: "kis", Icon: Zap, label: "KIS 실주문 자동화",
    headline: "검증된 전략을 실거래로 연결하는 마지막 단계",
    body: "백테스트와 Trust Score로 전략이 검증됐다면, 한국투자증권 OpenAPI를 통해 실제 주문을 낼 수 있습니다. 모의투자로 먼저 연습하고, 준비가 됐을 때만 실거래로 전환할 수 있도록 이중 안전장치가 설계되어 있습니다.",
    points: [
      "모의투자 → 실거래 명시적 전환 — 실수로 실주문이 나가는 상황을 원천 차단",
      "HMAC 승인 링크 — 주문 전 이메일 확인으로 이중 본인 인증",
      "AES-GCM 암호화 — KIS API 키를 DB에 평문 저장하지 않음",
      "글로벌 Kill-Switch — 환경변수 하나로 모든 실주문 즉시 차단 가능",
    ],
  },
];

const PROJECTS_TAGS = [
  ["#SMA Cross", "#백테스트", "#KIS"],
  ["#RSI", "#TrustScore", "#Regime"],
  ["#MACD", "#무한매수법", "#AI전략"],
];

export default function Home() {
  const navigate  = useNavigate();
  const { t, lang } = useLanguage();
  const videoRef  = useRef(null);
  const [hoveredProject, setHoveredProject] = useState(null);
  const [activeTab, setActiveTab] = useState("ai");
  const [showLogin, setShowLogin] = useState(false);
  const [newWsOpen, setNewWsOpen]  = useState(false);
  const [newWsName, setNewWsName]  = useState("");

  const isAuthed = !!localStorage.getItem("dbId");
  const tr = translations[lang]?.home || translations.en.home;
  const projects = tr.projectSection.projects;
  const activeFeature = FEATURE_TABS.find(f => f.key === activeTab);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = 0.55;
  }, []);

  const handleBriefing    = () => { if (!isAuthed) { setShowLogin(true); return; } navigate("/workhome"); };
  const handleNewStrategy = () => { if (!isAuthed) { setShowLogin(true); return; } setNewWsName(""); setNewWsOpen(true); };
  const confirmNewWs      = () => { if (!newWsName.trim()) return; setNewWsOpen(false); navigate(`/alpha?new=${encodeURIComponent(newWsName.trim())}`); };

  return (
    <>
    <div style={{ minHeight: "100vh", backgroundColor: "#fff", fontFamily: BASE_FONT }}>

      {/* ── HERO ── */}
      <section style={{ position: "relative", width: "100%", height: 580, overflow: "hidden" }}>
        <video
          ref={videoRef} src={bannerVideo} autoPlay loop muted playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }}
        />
        {/* 다크 그라데이션 */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, rgba(10,15,30,0.55) 0%, rgba(10,15,30,0.75) 100%)" }} />
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
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", fontWeight: 600, letterSpacing: 0.4 }}>AI 기반 퀀트 투자 워크스페이스</span>
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
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.82)", fontFamily: BASE_FONT, fontWeight: 400, margin: 0, lineHeight: 1.7 }}>
                자연어 프롬프트 한 줄로 전략 구성부터<br />백테스트, 실주문까지 한 흐름으로 연결됩니다.
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
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{
        background: "#080d18",
        backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
        padding: "80px 20px",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <Reveal>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>How it works</p>
            <h2 style={{ fontSize: 30, fontWeight: 800, color: "white", margin: "0 0 12px", fontFamily: BASE_FONT }}>네 단계로 완성되는 퀀트 투자</h2>
            <p style={{ fontSize: 14, color: "#4b5563", maxWidth: 420, margin: "0 auto", lineHeight: 1.8 }}>
              복잡한 코딩 없이, 자연어 한 줄로 전문가 수준의<br />퀀트 전략을 구성하고 실행하세요.
            </p>
          </div>
          </Reveal>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {FLOW_STEPS.map((s, i) => (
              <Reveal key={i} delay={i * 100} style={{ height: "100%" }}>
              <div style={{ position: "relative", height: "100%" }}>
                {/* 연결선 */}
                {i < FLOW_STEPS.length - 1 && (
                  <div style={{
                    position: "absolute", top: 28, right: -12, zIndex: 1,
                    width: 24, display: "flex", alignItems: "center",
                  }}>
                    <div style={{ flex: 1, height: 1, background: "rgba(99,102,241,0.3)" }} />
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#6366f1", flexShrink: 0 }} />
                  </div>
                )}

                {/* 글라스 카드 */}
                <div style={{
                  background: "rgba(255,255,255,0.04)", backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: 14, padding: "28px 22px",
                  height: "100%", boxSizing: "border-box",
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12, marginBottom: 18,
                    background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {s.icon}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#4b5563", letterSpacing: 2, marginBottom: 8, fontFamily: BASE_FONT }}>STEP {s.step}</div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "white", marginBottom: 10, fontFamily: BASE_FONT, lineHeight: 1.4 }}>{s.title}</h3>
                  <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.75, margin: 0 }}>{s.desc}</p>
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
        padding: "44px 20px",
      }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
          {STATS.map((s, i) => (
            <div key={i} style={{
              textAlign: "center",
              borderRight: i < STATS.length - 1 ? "1px solid rgba(255,255,255,0.1)" : "none",
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
      <section style={{ padding: "88px 20px", background: "#F8FAFC" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <Reveal>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Features</p>
            <h2 style={{ fontSize: 30, fontWeight: 800, color: "#0f172a", margin: "0 0 12px", fontFamily: BASE_FONT }}>Alpha-Helix가 특별한 이유</h2>
            <p style={{ fontSize: 14, color: "#64748b", maxWidth: 420, margin: "0 auto", lineHeight: 1.8 }}>
              AI 대화부터 실주문까지, 퀀트 투자의 전 과정을 하나의 워크스페이스에서.
            </p>
          </div>
          </Reveal>

          {/* 탭 바 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderBottom: "1.5px solid #E2E8F0", marginBottom: 0 }}>
            {FEATURE_TABS.map(f => {
              const isActive = activeTab === f.key;
              return (
              <button key={f.key} onClick={() => setActiveTab(f.key)} style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "13px 12px",
                border: "none",
                background: isActive
                  ? "linear-gradient(135deg, #DBEAFE 0%, #E0E7FF 50%, #EDE9FE 100%)"
                  : "none",
                fontSize: 16, fontWeight: isActive ? 700 : 500,
                color: isActive ? "#4f46e5" : "#64748b",
                cursor: "pointer", fontFamily: BASE_FONT,
                borderBottom: isActive ? "2px solid #818cf8" : "2px solid transparent",
                borderTopLeftRadius: 8, borderTopRightRadius: 8,
                marginBottom: -1.5, transition: "color 0.15s, background 0.2s", whiteSpace: "nowrap",
              }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = "#374151"; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = "#64748b"; }}
              >
                <f.Icon size={17} />
                {f.label}
              </button>
              );
            })}
          </div>

          {/* 탭 콘텐츠 — 글라스 패널 */}
          {activeFeature && (
            <div style={{
              background: "rgba(255,255,255,0.7)", backdropFilter: "blur(16px)",
              border: "1.5px solid #E2E8F0", borderTop: "none",
              borderRadius: "0 0 16px 16px",
              padding: "44px 28px 44px 24px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.06)",
            }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.85fr) minmax(0, 1.15fr)", gap: 36 }}>
                <div>
                  <h3 style={{ fontSize: 21, fontWeight: 800, color: "#0f172a", marginBottom: 16, fontFamily: BASE_FONT, lineHeight: 1.35 }}>
                    {activeFeature.headline}
                  </h3>
                  <p style={{ fontSize: 14, color: "#1f2937", lineHeight: 1.85, margin: 0 }}>
                    {activeFeature.body}
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14, justifyContent: "center" }}>
                  {activeFeature.points.map((pt, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                        background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1,
                      }}>
                        <Check size={11} color="#4f46e5" strokeWidth={2.5} />
                      </div>
                      <p style={{ fontSize: 13, color: "#111827", lineHeight: 1.75, margin: 0 }}>{pt}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── 전략 템플릿 ── */}
      <section style={{ padding: "80px 20px", background: "white" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <Reveal>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Templates</p>
              <h2 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", margin: "0 0 8px", fontFamily: BASE_FONT }}>검증된 전략 템플릿</h2>
              <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>바로 쓸 수 있는 퀀트 전략으로 빠르게 시작하세요.</p>
            </div>
            <button onClick={() => navigate("/alpha?lib=1")} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "9px 18px", borderRadius: 8,
              border: "1.5px solid #E2E8F0", background: "white",
              color: "#374151", fontSize: 13, fontWeight: 600,
              cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
              transition: "border-color 0.15s, color 0.15s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.color = "#4f46e5"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.color = "#374151"; }}
            >
              전체 보기 <ArrowRight size={13} />
            </button>
          </div>
          </Reveal>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
            {projects.map((proj, i) => (
              <Reveal key={i} delay={i * 100}>
              <div onClick={() => navigate("/alpha?lib=1")} style={{
                borderRadius: 14, overflow: "hidden",
                border: hoveredProject === i ? "1.5px solid #c7d2fe" : "1.5px solid #F1F5F9",
                backgroundColor: "white", cursor: "pointer",
                transform: hoveredProject === i ? "translateY(-4px)" : "translateY(0)",
                boxShadow: hoveredProject === i ? "0 16px 40px rgba(99,102,241,0.12)" : "0 2px 8px rgba(0,0,0,0.05)",
                transition: "all 0.2s",
              }}
                onMouseEnter={() => setHoveredProject(i)}
                onMouseLeave={() => setHoveredProject(null)}
              >
                <div style={{ padding: "18px 20px 22px" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 8, fontFamily: BASE_FONT, lineHeight: 1.4 }}>{proj.title}</h3>
                  <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.75, marginBottom: 14 }}>{proj.desc}</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{
        background: "#080d18",
        backgroundImage: "radial-gradient(ellipse 80% 50% at 50% 100%, rgba(99,102,241,0.15) 0%, transparent 70%)",
        padding: "96px 20px", textAlign: "center",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <Reveal>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: "white", lineHeight: 1.3, marginBottom: 14, fontFamily: BASE_FONT }}>
            첫 번째 전략을 지금 만들어보세요
          </h2>
          <p style={{ fontSize: 14, color: "#4b5563", lineHeight: 1.8, marginBottom: 36 }}>
            복잡한 코드 없이도 됩니다. AI에게 원하는 전략을 말하면,<br />백테스트부터 실주문까지 Alpha-Helix가 함께합니다.
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
            전략 만들기 시작 →
          </button>
          </Reveal>
        </div>
      </section>

    </div>

    <LoginRequiredModal open={showLogin} onClose={() => setShowLogin(false)} />

    {newWsOpen && (
      <div onClick={() => setNewWsOpen(false)} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 3000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        backdropFilter: "blur(4px)",
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          background: "white", borderRadius: 20, width: "100%", maxWidth: 440,
          boxShadow: "0 24px 64px rgba(0,0,0,0.3)", overflow: "hidden",
        }}>
          <div style={{
            padding: "24px 28px 20px",
            background: "linear-gradient(135deg,#eff6ff 0%,#e0e7ff 100%)",
            borderBottom: "1px solid #E2E8F0",
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: "linear-gradient(135deg,#6366f1,#4f46e5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
            }}>
              <Layers size={20} color="white" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#1e3a8a" }}>새 전략 만들기</h2>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#475569" }}>전략 이름을 입력하고 AI와 대화를 시작하세요</p>
            </div>
          </div>
          <div style={{ padding: "24px 28px" }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 8 }}>전략 이름</label>
            <input
              autoFocus value={newWsName}
              onChange={e => setNewWsName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") confirmNewWs(); if (e.key === "Escape") setNewWsOpen(false); }}
              placeholder="예: 미국 배당 성장 전략"
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 10,
                border: "1.5px solid #C7D2FE", fontSize: 14, outline: "none",
                boxSizing: "border-box", color: "#0F172A", transition: "border-color 0.15s",
              }}
              onFocus={e => e.target.style.borderColor = "#6366f1"}
              onBlur={e => e.target.style.borderColor = "#C7D2FE"}
            />
          </div>
          <div style={{ padding: "0 28px 24px", display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setNewWsOpen(false)} style={{
              padding: "10px 20px", borderRadius: 9,
              border: "1px solid #E2E8F0", background: "white", color: "#374151",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>취소</button>
            <button onClick={confirmNewWs} disabled={!newWsName.trim()} style={{
              padding: "10px 20px", borderRadius: 9, border: "none",
              background: newWsName.trim() ? "linear-gradient(135deg,#6366f1,#4f46e5)" : "#E2E8F0",
              color: newWsName.trim() ? "white" : "#94A3B8",
              fontSize: 13, fontWeight: 700,
              cursor: newWsName.trim() ? "pointer" : "not-allowed",
              boxShadow: newWsName.trim() ? "0 3px 10px rgba(99,102,241,0.3)" : "none",
            }}>전략 생성하기</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
