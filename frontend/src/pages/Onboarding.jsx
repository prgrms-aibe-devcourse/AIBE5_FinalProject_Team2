import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, ArrowRight, Check, Sparkles, TrendingUp, Award, Shield } from "lucide-react";
import Header_partner from "../components/Header_partner";
import Header_client from "../components/Header_client";
import useStore from "../store/useStore";
import heroDefault from "../assets/hero_default.png";
import heroCheck from "../assets/hero_check.png";
import heroStudent from "../assets/hero_student.png";
import heroTeacher from "../assets/hero_teacher.png";
import heroMeeting from "../assets/hero_meeting.png";
import heroMoney from "../assets/hero_money.png";
import heroVacation from "../assets/hero_vacation.png";
import hero from "../assets/hero.png";
import { useLanguage } from "../i18n/LanguageContext";
import translations from "../i18n/translations";

const F = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const PRIMARY = "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)";

const TIERS = [
  {
    key: "seed",
    name: "Seed",
    emoji: "🌱",
    color: "#22C55E",
    bg: "#F0FDF4",
    border: "#BBF7D0",
    requirements: ["신규 가입자", "기본 프로필 등록"],
    benefits: [
      { label: "플랫폼 수수료", value: "10%" },
      { label: "Hero 이미지", value: "1종 (기본)" },
      { label: "프로필 커스텀", value: "기본 테마" },
      { label: "상단 노출", value: "—" },
    ],
    heroes: [heroDefault],
  },
  {
    key: "bronze",
    name: "Bronze",
    emoji: "🥉",
    color: "#B87333",
    bg: "#FFF7ED",
    border: "#FED7AA",
    requirements: ["완료 프로젝트 3개 이상", "평균 평점 3.5 이상", "본인/계좌 인증 완료"],
    benefits: [
      { label: "플랫폼 수수료", value: "8%" },
      { label: "Hero 이미지", value: "2종" },
      { label: "프로필 커스텀", value: "테마 선택 가능" },
      { label: "상단 노출", value: "—" },
    ],
    heroes: [heroDefault, heroCheck],
  },
  {
    key: "silver",
    name: "Silver",
    emoji: "🥈",
    color: "#64748B",
    bg: "#F1F5F9",
    border: "#CBD5E1",
    requirements: ["완료 프로젝트 10개 이상", "평균 평점 4.0 이상", "프로필 완성도 80% 이상"],
    benefits: [
      { label: "플랫폼 수수료", value: "6%" },
      { label: "Hero 이미지", value: "4종" },
      { label: "프로필 커스텀", value: "배경색 변경" },
      { label: "상단 노출", value: "월 1회" },
    ],
    heroes: [heroDefault, heroCheck, heroStudent, heroTeacher],
  },
  {
    key: "gold",
    name: "Gold",
    emoji: "🥇",
    color: "#F59E0B",
    bg: "#FEF3C7",
    border: "#FCD34D",
    requirements: ["완료 프로젝트 25개 이상", "평균 평점 4.3 이상", "재계약률 30% 이상"],
    benefits: [
      { label: "플랫폼 수수료", value: "4%" },
      { label: "Hero 이미지", value: "6종" },
      { label: "프로필 커스텀", value: "배너 완전 커스텀" },
      { label: "상단 노출", value: "월 4회" },
    ],
    heroes: [heroDefault, heroCheck, heroStudent, heroTeacher, heroMeeting, heroMoney],
  },
  {
    key: "platinum",
    name: "Platinum",
    emoji: "🌙",
    color: "#8B5CF6",
    bg: "#EDE9FE",
    border: "#C4B5FD",
    requirements: ["완료 프로젝트 37개 이상", "평균 평점 4.5 이상", "재계약률 40% 이상"],
    benefits: [
      { label: "플랫폼 수수료", value: "2%" },
      { label: "Hero 이미지", value: "7종" },
      { label: "프로필 커스텀", value: "배너 + 컬러 자유 편집" },
      { label: "상단 노출", value: "월 8회" },
    ],
    heroes: [heroDefault, heroCheck, heroStudent, heroTeacher, heroMeeting, heroMoney, heroVacation],
  },
  {
    key: "diamond",
    name: "Diamond",
    emoji: "💎",
    color: "#3B82F6",
    bg: "#DBEAFE",
    border: "#93C5FD",
    requirements: ["완료 프로젝트 50개 이상", "평균 평점 4.7 이상", "재계약률 50% 이상"],
    benefits: [
      { label: "플랫폼 수수료", value: "0%" },
      { label: "Hero 이미지", value: "전체 8종" },
      { label: "프로필 커스텀", value: "완전 자유 편집" },
      { label: "상단 노출", value: "무제한 + 전담 매니저" },
    ],
    heroes: [heroDefault, heroCheck, heroStudent, heroTeacher, heroMeeting, heroMoney, heroVacation, hero],
  },
];

const STEP_CARDS = [
  {
    icon: "📝",
    title: "프로필 완성",
    desc: "본인 인증, GitHub 연동, 포트폴리오 업로드로 프로필 완성도 80%를 달성하세요.",
  },
  {
    icon: "🔍",
    title: "프로젝트 찾기 / 등록",
    desc: "AI 매칭으로 나에게 맞는 프로젝트를 추천받거나 직접 등록하세요.",
  },
  {
    icon: "🤝",
    title: "계약 & 진행",
    desc: "ALPHA-HELIX 안심 계약으로 에스크로 결제와 분쟁 조정을 제공합니다.",
  },
  {
    icon: "⭐",
    title: "평가 & 레벨업",
    desc: "프로젝트 완료 후 상호 평가를 통해 티어를 올리고 혜택을 누리세요.",
  },
];

function TierCard({ tier, active, onClick }) {
  const { t } = useLanguage();
  return (
    <div
      onClick={onClick}
      style={{
        background: active ? tier.bg : "white",
        border: `2px solid ${active ? tier.color : "#E2E8F0"}`,
        borderRadius: 16,
        padding: "20px 18px",
        cursor: "pointer",
        transition: "all 0.2s",
        boxShadow: active ? `0 8px 24px ${tier.color}30` : "0 2px 8px rgba(0,0,0,0.04)",
        transform: active ? "translateY(-4px)" : "none",
      }}
    >
      <div style={{ fontSize: 36, textAlign: "center", marginBottom: 6 }}>{tier.emoji}</div>
      <div style={{
        fontSize: 18, fontWeight: 800, color: tier.color, textAlign: "center",
        fontFamily: F, letterSpacing: "0.05em", marginBottom: 10,
      }}>{tier.name.toUpperCase()}</div>
      <div style={{
        fontSize: 11, fontWeight: 700, color: "#94A3B8", textAlign: "center",
        fontFamily: F, textTransform: "uppercase", letterSpacing: "0.08em",
      }}>
        {t("onboarding.tier.labels.fee")} <span style={{ color: tier.color, fontSize: 14 }}>{tier.benefits[0].value}</span>
      </div>
    </div>
  );
}

function TierDetail({ tier }) {
  const { t } = useLanguage();
  return (
    <div style={{
      background: "white",
      border: `2px solid ${tier.border}`,
      borderRadius: 20,
      padding: "32px 36px",
      boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
    }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 56 }}>{tier.emoji}</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#94A3B8", fontFamily: F, letterSpacing: "0.08em" }}>
            LEVEL
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: tier.color, fontFamily: F, letterSpacing: "0.02em" }}>
            {tier.name.toUpperCase()}
          </div>
        </div>
      </div>

      {/* 조건 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Award size={18} color={tier.color} />
          <span style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", fontFamily: F }}>
            {t("onboarding.tier.condition")}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tier.requirements.map((r, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", borderRadius: 10,
              background: tier.bg, border: `1px solid ${tier.border}`,
            }}>
              <Check size={16} color={tier.color} strokeWidth={3} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "#334155", fontFamily: F }}>
                {r}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 혜택 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Sparkles size={18} color={tier.color} />
          <span style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", fontFamily: F }}>
            {t("onboarding.tier.benefit")}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {tier.benefits.map((b, i) => (
            <div key={i} style={{
              padding: "14px 16px", borderRadius: 12,
              background: "white", border: "1.5px solid #F1F5F9",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", fontFamily: F, marginBottom: 4 }}>
                {b.label}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: tier.color, fontFamily: F }}>
                {b.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hero 이미지 미리보기 */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Shield size={18} color={tier.color} />
          <span style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", fontFamily: F }}>
            {t("onboarding.tier.heroImages").replace("{n}", tier.heroes.length)}
          </span>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {tier.heroes.map((src, i) => (
            <div key={i} style={{
              width: 72, height: 72, borderRadius: "50%",
              overflow: "hidden", border: `2.5px solid ${tier.color}`,
              boxShadow: `0 4px 12px ${tier.color}30`,
            }}>
              <img src={src} alt={`hero-${i}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TutorialVideo() {
  const [playing, setPlaying] = useState(false);
  const { t } = useLanguage();

  return (
    <div style={{
      background: "#0F172A",
      borderRadius: 20,
      overflow: "hidden",
      position: "relative",
      aspectRatio: "15/9",
      boxShadow: "0 12px 40px rgba(15,23,42,0.25)",
    }}>
      {playing ? (
        <iframe
          title="ALPHA-HELIX 튜토리얼"
          src="https://www.youtube.com/embed/Tn6-PIqc4UM?autoplay=1"
          style={{ width: "100%", height: "100%", border: "none" }}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <div
          onClick={() => setPlaying(true)}
          style={{
            width: "100%", height: "100%", cursor: "pointer",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 24,
            background: "radial-gradient(circle at 30% 40%, rgba(99,102,241,0.35), transparent 50%), radial-gradient(circle at 70% 60%, rgba(59,130,246,0.35), transparent 50%), #0F172A",
            color: "white",
            position: "relative",
          }}
        >
          <div style={{
            width: 96, height: 96, borderRadius: "50%",
            background: "rgba(255,255,255,0.15)",
            backdropFilter: "blur(12px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid rgba(255,255,255,0.4)",
            boxShadow: "0 8px 30px rgba(99,102,241,0.5)",
          }}>
            <Play size={42} color="white" fill="white" style={{ marginLeft: 4 }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#93C5FD", fontFamily: F, letterSpacing: "0.15em", marginBottom: 8 }}>
              — TUTORIAL —
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, fontFamily: F, letterSpacing: "-0.02em" }}>
              {t("onboarding.tutorialSection.videoTitle")}
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "#CBD5E1", fontFamily: F, marginTop: 10 }}>
              {t("onboarding.tutorialSection.videoDesc")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const userRole = useStore(s => s.userRole);
  const [activeTier, setActiveTier] = useState("silver");
  const { t, lang } = useLanguage();
  const tr = translations[lang]?.onboarding || translations.en.onboarding;

  const selectedTier = TIERS.find(tier => tier.key === activeTier) || TIERS[0];
  const HeaderComp = userRole === "client" ? Header_client : Header_partner;

  return (
    <div style={{ minHeight: "100vh", background: "#F1F5F9", fontFamily: F }}>
      <HeaderComp />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 20px 60px" }}>

        {/* ─── Hero ─── */}
        <div style={{
          background: PRIMARY,
          borderRadius: 24,
          padding: "52px 44px",
          marginBottom: 28,
          color: "white",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 12px 40px rgba(99,102,241,0.3)",
        }}>
          <div style={{
            position: "absolute", top: -60, right: -40,
            width: 280, height: 280, borderRadius: "50%",
            background: "rgba(255,255,255,0.1)",
          }} />
          <div style={{
            position: "absolute", bottom: -80, left: -20,
            width: 220, height: 220, borderRadius: "50%",
            background: "rgba(255,255,255,0.08)",
          }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{
              display: "inline-block",
              padding: "6px 14px", borderRadius: 99,
              background: "rgba(255,255,255,0.2)",
              fontSize: 12, fontWeight: 700,
              letterSpacing: "0.12em", marginBottom: 16,
            }}>
              🎓 ALPHA-HELIX ONBOARDING
            </div>
            <h1 style={{
              fontSize: 40, fontWeight: 900, margin: 0, letterSpacing: "-0.02em",
              lineHeight: 1.2, marginBottom: 14, whiteSpace: "pre-line",
            }}>
              {t("onboarding.heroTitle")}
            </h1>
            <p style={{
              fontSize: 17, fontWeight: 500, color: "rgba(255,255,255,0.9)",
              margin: 0, maxWidth: 640, lineHeight: 1.6,
            }}>
              {t("onboarding.heroSubtitle")}
            </p>
          </div>
        </div>

        {/* ─── Tutorial Video ─── */}
        <div style={{
          background: "white", borderRadius: 20,
          border: "1.5px solid #F1F5F9", boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          padding: "32px 36px", marginBottom: 28,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 20 }}>🎬</span>
            <span style={{
              fontSize: 23, fontWeight: 800, fontFamily: F,
              background: PRIMARY,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>
              {t("onboarding.tutorialSection.title")}
            </span>
          </div>
          <p style={{ fontSize: 14, color: "#64748B", margin: "0 0 22px", fontFamily: F }}>
            {t("onboarding.tutorialSection.subtitle")}
          </p>

          <TutorialVideo />

          {/* Quick steps */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginTop: 28 }}>
            {STEP_CARDS.map((s, i) => (
              <div key={i} style={{
                padding: "20px 18px", borderRadius: 14,
                background: "#F8FAFC", border: "1.5px solid #F1F5F9",
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: PRIMARY, color: "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 800, marginBottom: 12,
                }}>
                  {i + 1}
                </div>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", fontFamily: F, marginBottom: 6 }}>
                  {tr.steps[i]?.title || s.title}
                </div>
                <p style={{ fontSize: 12.5, color: "#64748B", fontFamily: F, margin: 0, lineHeight: 1.6 }}>
                  {tr.steps[i]?.desc || s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Level Up Tier System ─── */}
        <div style={{
          background: "white", borderRadius: 20,
          border: "1.5px solid #F1F5F9", boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          padding: "32px 36px", marginBottom: 28,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <TrendingUp size={22} color="#6366F1" />
            <span style={{
              fontSize: 23, fontWeight: 800, fontFamily: F,
              background: PRIMARY,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>
              {t("onboarding.tier.title")}
            </span>
          </div>
          <p style={{ fontSize: 14, color: "#64748B", margin: "0 0 28px", fontFamily: F }}>
            {t("onboarding.tier.subtitle")}
          </p>

          {/* 티어 선택 그리드 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14, marginBottom: 28 }}>
            {TIERS.map(t => (
              <TierCard key={t.key} tier={t} active={activeTier === t.key} onClick={() => setActiveTier(t.key)} />
            ))}
          </div>

          {/* 진행 바 */}
          <div style={{
            display: "flex", alignItems: "center", gap: 0,
            padding: "0 18px", marginBottom: 28,
          }}>
            {TIERS.map((t, i) => (
              <div key={t.key} style={{ display: "flex", alignItems: "center", flex: i < TIERS.length - 1 ? 1 : 0 }}>
                <div style={{
                  width: 14, height: 14, borderRadius: "50%",
                  background: t.color,
                  boxShadow: activeTier === t.key ? `0 0 0 6px ${t.color}30` : "none",
                  flexShrink: 0,
                }} />
                {i < TIERS.length - 1 && (
                  <div style={{
                    flex: 1, height: 2,
                    background: `linear-gradient(to right, ${t.color}, ${TIERS[i + 1].color})`,
                  }} />
                )}
              </div>
            ))}
          </div>

          {/* 선택된 티어 상세 */}
          <TierDetail tier={selectedTier} />
        </div>

        {/* ─── CTA ─── */}
        <div style={{
          background: PRIMARY,
          borderRadius: 20,
          padding: "32px 36px",
          color: "white",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          boxShadow: "0 8px 30px rgba(99,102,241,0.3)",
        }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>
              지금 바로 첫 프로젝트를 시작해보세요
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.9)" }}>
              Seed에서 Diamond까지, 당신의 성장을 ALPHA-HELIX가 함께합니다.
            </div>
          </div>
          <button
            onClick={() => navigate(userRole === "client" ? "/client_dashboard" : "/partner_dashboard")}
            style={{
              padding: "14px 28px", borderRadius: 14,
              border: "none", background: "white", color: "#3B82F6",
              fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: F,
              display: "flex", alignItems: "center", gap: 8,
              boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
            }}
          >
            {t("onboarding.cta.btn")} <ArrowRight size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
