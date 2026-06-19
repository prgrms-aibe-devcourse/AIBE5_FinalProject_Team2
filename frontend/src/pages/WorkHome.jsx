import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, TrendingUp, ArrowRight, Pencil, Check, X, CircleUser, BarChart3, Award, Layers, Target, BookOpenText } from "lucide-react";
import { listWorkspaces, getWorkspace, createWorkspace } from "../alpha/alphaApi";
import CreateWorkspaceModal from "../alpha/CreateWorkspaceModal";
import { useTheme } from "../alpha/ThemeContext";
import { useLanguage } from "../i18n/useLanguage";
import useStore from "../store/useStore";
import { profileApi } from "../api/profile.api";
import heliFace from "../assets/heli_face.webp";
import { getCurrentHeroSrc } from "../alpha/heroAssets";

const F = "'Pretendard', 'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const TONE_BADGE = {
  "보수적": { label: "보수", emoji: "🛡️", color: "#1E40AF", bg: "#DBEAFE", border: "#93C5FD" },
  "보수":   { label: "보수", emoji: "🛡️", color: "#1E40AF", bg: "#DBEAFE", border: "#93C5FD" },
  "중립":   { label: "중립", emoji: "⚖️",  color: "#78350F", bg: "#FEF3C7", border: "#FCD34D" },
  "공격적": { label: "공격", emoji: "🔥",  color: "#991B1B", bg: "#FEE2E2", border: "#FCA5A5" },
  "공격":   { label: "공격", emoji: "🔥",  color: "#991B1B", bg: "#FEE2E2", border: "#FCA5A5" },
  "conservative": { label: "보수", emoji: "🛡️", color: "#1E40AF", bg: "#DBEAFE", border: "#93C5FD" },
  "moderate":     { label: "중립", emoji: "⚖️",  color: "#78350F", bg: "#FEF3C7", border: "#FCD34D" },
  "aggressive":   { label: "공격", emoji: "🔥",  color: "#991B1B", bg: "#FEE2E2", border: "#FCA5A5" },
};

function ToneBadge({ tone }) {
  const t = TONE_BADGE[tone];
  if (!t) return null;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, color: t.color,
      background: t.bg, border: `1px solid ${t.border}`,
      padding: "2px 8px", borderRadius: 6, flexShrink: 0,
    }}>{t.emoji} {t.label}</span>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// 오늘의 말씀 — 잠언·시편을 섞어, 계정별로 다른 순서로 매일 한 구절씩 순환.
// (구절 수 < 365라, 1년이면 모든 구절을 여러 번 보게 된다)
const VERSES = [
  { ref: "Proverbs 3:5-6", text: "Trust in the LORD with all your heart, and do not lean on your own understanding. In all your ways acknowledge him, and he will make straight your paths." },
  { ref: "Proverbs 16:3", text: "Commit your work to the LORD, and your plans will be established." },
  { ref: "Proverbs 16:9", text: "The heart of man plans his way, but the LORD establishes his steps." },
  { ref: "Proverbs 21:5", text: "The plans of the diligent lead surely to abundance, but everyone who is hasty comes only to poverty." },
  { ref: "Proverbs 13:11", text: "Wealth gained hastily will dwindle, but whoever gathers little by little will increase it." },
  { ref: "Proverbs 24:16", text: "For the righteous falls seven times and rises again, but the wicked stumble in times of calamity." },
  { ref: "Proverbs 4:23", text: "Keep your heart with all vigilance, for from it flow the springs of life." },
  { ref: "Proverbs 19:21", text: "Many are the plans in the mind of a man, but it is the purpose of the LORD that will stand." },
  { ref: "Proverbs 22:29", text: "Do you see a man skillful in his work? He will stand before kings; he will not stand before obscure men." },
  { ref: "Proverbs 11:25", text: "Whoever brings blessing will be enriched, and one who waters will himself be watered." },
  { ref: "Proverbs 15:22", text: "Without counsel plans fail, but with many advisers they succeed." },
  { ref: "Proverbs 27:23", text: "Know well the condition of your flocks, and give attention to your herds." },
  { ref: "Psalm 23:1", text: "The LORD is my shepherd; I shall not want." },
  { ref: "Psalm 27:14", text: "Wait for the LORD; be strong, and let your heart take courage; wait for the LORD!" },
  { ref: "Psalm 37:5", text: "Commit your way to the LORD; trust in him, and he will act." },
  { ref: "Psalm 37:7", text: "Be still before the LORD and wait patiently for him." },
  { ref: "Psalm 46:1", text: "God is our refuge and strength, a very present help in trouble." },
  { ref: "Psalm 90:17", text: "Let the favor of the Lord our God be upon us, and establish the work of our hands upon us." },
  { ref: "Psalm 121:1-2", text: "I lift up my eyes to the hills. From where does my help come? My help comes from the LORD, who made heaven and earth." },
  { ref: "Psalm 126:5", text: "Those who sow in tears shall reap with shouts of joy!" },
  { ref: "Psalm 1:3", text: "He is like a tree planted by streams of water that yields its fruit in its season, and in all that he does, he prospers." },
  { ref: "Psalm 31:24", text: "Be strong, and let your heart take courage, all you who wait for the LORD!" },
  { ref: "Psalm 16:8", text: "I have set the LORD always before me; because he is at my right hand, I shall not be shaken." },
  { ref: "Psalm 28:7", text: "The LORD is my strength and my shield; in him my heart trusts, and I am helped." },
];
function _hashStr(s) {
  let h = 0;
  for (let i = 0; i < (s || "").length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function getTodayVerse(seedStr) {
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  return VERSES[(dayOfYear + _hashStr(seedStr)) % VERSES.length];
}

// 첫 번째 선물 — 투자 그루들의 명언 (계정별·날짜별로 섞여 1년간 순환).
const GURU_QUOTES = [
  { ref: "Warren Buffett", text: "Be fearful when others are greedy, and greedy when others are fearful." },
  { ref: "Warren Buffett", text: "Price is what you pay. Value is what you get." },
  { ref: "Warren Buffett", text: "The stock market is a device for transferring money from the impatient to the patient." },
  { ref: "Charlie Munger", text: "The big money is not in the buying and the selling, but in the waiting." },
  { ref: "Benjamin Graham", text: "In the short run the market is a voting machine, but in the long run it is a weighing machine." },
  { ref: "Benjamin Graham", text: "The investor's chief problem, and even his worst enemy, is likely to be himself." },
  { ref: "Peter Lynch", text: "Know what you own, and know why you own it." },
  { ref: "Peter Lynch", text: "Far more money has been lost preparing for corrections than in the corrections themselves." },
  { ref: "John Bogle", text: "Don't look for the needle in the haystack. Just buy the haystack." },
  { ref: "Philip Fisher", text: "The best time to buy a stock is when you have found a truly great company." },
  { ref: "John Templeton", text: "Bull markets are born on pessimism, grow on skepticism, mature on optimism, and die on euphoria." },
  { ref: "Howard Marks", text: "You can't do the same things others do and expect to outperform — think different, and better." },
  { ref: "Ray Dalio", text: "Pain + Reflection = Progress." },
  { ref: "Jesse Livermore", text: "It was never my thinking that made the big money. It was always my sitting." },
  { ref: "Seth Klarman", text: "Risk is not volatility; it is the possibility of permanent loss of capital." },
  { ref: "André Kostolany", text: "Buy blue chips, take sleeping pills, and wake up rich in ten years." },
];
function getTodayGuru(seedStr) {
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  return GURU_QUOTES[(dayOfYear + _hashStr(seedStr) + 7) % GURU_QUOTES.length];
}

function healthFromTrust(score) {
  if (score == null) return { key: "unmeasured", color: "#94A3B8", bg: "#F1F5F9", gradient: "linear-gradient(90deg,#CBD5E1,#E2E8F0)" };
  if (score >= 75)   return { key: "stable",     color: "#10B981", bg: "#ECFDF5", gradient: "linear-gradient(90deg,#10B981,#34D399)" };
  if (score >= 60)   return { key: "normal",     color: "#3B82F6", bg: "#EFF6FF", gradient: "linear-gradient(90deg,#3B82F6,#60A5FA)" };
  return                    { key: "caution",    color: "#F59E0B", bg: "#FFFBEB", gradient: "linear-gradient(90deg,#F59E0B,#FCD34D)" };
}

// ── KPI 카드 ──────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, positive, icon: Icon }) {
  const isPos = positive && typeof value === "string" && value.startsWith("+");
  const isNeg = positive && typeof value === "string" && value.startsWith("-");
  return (
    <div style={{
      background: "white", borderRadius: 14, padding: "18px 20px",
      border: "1px solid #E2E8F0", boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
      position: "relative", overflow: "hidden",
    }}>
      {Icon && <Icon size={88} style={{ position: "absolute", right: -10, bottom: -10, color: "#6366F1", opacity: 0.1, pointerEvents: "none" }} />}
      <div style={{ fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{
        fontSize: 36, fontWeight: 900, lineHeight: 1, marginBottom: 8,
        color: isPos ? "#16A34A" : isNeg ? "#DC2626" : "#0F172A",
      }}>{value}</div>
      <div style={{ fontSize: 12, color: "#475569" }}>{sub}</div>
    </div>
  );
}

// ── 막대 차트 ──────────────────────────────────────────────────────────────
function BtBarChart({ items }) {
  const containerRef = useRef(null);
  const [containerW, setContainerW] = useState(460);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      setContainerW(entries[0].contentRect.width || 460);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  if (!items || items.length === 0) return (
    <div ref={containerRef} style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#CBD5E1", fontSize: 13 }}>
      백테스트 결과가 없습니다
    </div>
  );

  const vals = items.map(s => s.bt?.totalReturn ?? s.bt?.cagr ?? 0);
  const CH    = 180;
  const PAD_V = 24;
  const PADL  = 16;
  const PADR  = 16;
  const SLOT  = (containerW - PADL - PADR) / items.length;
  const barW  = Math.min(SLOT * 0.60, 72); // 1~2개여도 너무 넓어지지 않도록 최대 72px 고정
  const barOffset = (SLOT - barW) / 2;
  const svgW  = containerW;
  const maxVal = Math.max(...vals, 0);
  const minVal = Math.min(...vals, 0);
  const totalSpan = (maxVal - minVal) || 1;
  const zeroY = PAD_V + (maxVal / totalSpan) * (CH - 2 * PAD_V);
  const posScale = maxVal > 0 ? (zeroY - PAD_V) / maxVal : 1;
  const negScale = minVal < 0 ? (CH - PAD_V - zeroY) / Math.abs(minVal) : 1;

  return (
    <div ref={containerRef} style={{ marginTop: 8 }}>
      <svg width={svgW} height={CH + 40}
        style={{ display: "block", fontFamily: F, overflow: "visible" }}>
        <line x1={0} y1={zeroY} x2={svgW} y2={zeroY} stroke="#E2E8F0" strokeWidth={1} strokeDasharray="4 3" />
        <text x={4} y={zeroY - 5} fontSize={9} fill="#94A3B8">0%</text>
        {items.map((s, i) => {
          const v = vals[i];
          const x = PADL + i * SLOT + barOffset;
          const barH = Math.max(Math.abs(v) * (v >= 0 ? posScale : negScale), 3);
          const barY = v >= 0 ? zeroY - barH : zeroY;
          const clr = v >= 0 ? "#22c55e" : "#ef4444";
          const lblY = v >= 0 ? barY - 5 : barY + barH + 13;
          const nm = s.name.length > 7 ? s.name.slice(0, 7) + "…" : s.name;
          return (
            <g key={s.id}>
              <rect x={x} y={barY} width={barW} height={barH} fill={clr} rx={4} opacity={0.88} />
              <text x={x + barW / 2} y={lblY} textAnchor="middle" fontSize={10} fontWeight={700} fill={clr}>
                {v >= 0 ? "+" : ""}{v.toFixed(1)}%
              </text>
              <text x={x + barW / 2} y={CH + 18} textAnchor="middle" fontSize={11} fill="#64748B">{nm}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── 전략 목록 ──────────────────────────────────────────────────────────────
function StrategyListPanel({ items, onNav, featuredId }) {
  if (!items.length) return (
    <div style={{ color: "#CBD5E1", fontSize: 13, padding: "20px 0" }}>전략이 없습니다</div>
  );
  const sorted = featuredId
    ? [...items].sort((a, b) => (a.id === featuredId ? -1 : b.id === featuredId ? 1 : 0))
    : items;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {sorted.map((s, i) => {
        const isFeatured = s.id === featuredId;
        const v = s.bt?.totalReturn ?? s.bt?.cagr;
        const vStr = v != null ? `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(1)}%` : "—";
        const vColor = v != null ? (Number(v) >= 0 ? "#16A34A" : "#DC2626") : "#94A3B8";
        let badge, bColor, bBg;
        if (s.bt)                    { badge = "백테스트 완료"; bColor = "#16A34A"; bBg = "#F0FDF4"; }
        else if (s.status === "LIVE") { badge = "실행 중";     bColor = "#2563EB"; bBg = "#EFF6FF"; }
        else                          { badge = "미시작";      bColor = "#94A3B8"; bBg = "#F8FAFC"; }
        return (
          <div key={s.id} onClick={() => onNav(s.id)} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "11px 8px", cursor: "pointer",
            borderBottom: i < sorted.length - 1 ? "1px solid #F1F5F9" : "none",
            borderRadius: 8,
            background: isFeatured ? "#F5F3FF" : "transparent",
            transition: "background 0.1s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = isFeatured ? "#EDE9FE" : "#F8FAFC"}
          onMouseLeave={e => e.currentTarget.style.background = isFeatured ? "#F5F3FF" : "transparent"}
          >
            <span style={{ fontSize: 13, color: isFeatured ? "#4338CA" : "#475569", flexShrink: 0 }}>•</span>
            <span style={{
              flex: 1, fontSize: 14, fontWeight: isFeatured ? 700 : 600,
              color: isFeatured ? "#4F46E5" : "#0F172A",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0,
            }}>{s.name}</span>
            {isFeatured && (
              <span style={{ fontSize: 10, fontWeight: 800, color: "#6366F1", background: "#EDE9FE", border: "1px solid #C4B5FD", padding: "1px 7px", borderRadius: 6, flexShrink: 0 }}>대표</span>
            )}
            {s.riskTone && <ToneBadge tone={s.riskTone} size="sm" />}
            <span style={{ fontSize: 14, fontWeight: 700, color: vColor, flexShrink: 0 }}>{vStr}</span>
            <span style={{
              fontSize: 11.5, fontWeight: 700, color: bColor, background: bBg,
              padding: "2px 9px", borderRadius: 6, flexShrink: 0,
            }}>{badge}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── 최고 전략 지표 ──────────────────────────────────────────────────────────
function BestStrategyMetrics({ s }) {
  const bt = s.bt;
  if (!bt) return null;
  const fp = (v) => v != null ? `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(1)}%` : "—";
  const fn = (v) => v != null ? Number(v).toFixed(2) : "—";
  const rows = [
    { label: "총 수익률",    value: fp(bt.totalReturn ?? bt.cagr),   color: (bt.totalReturn ?? bt.cagr ?? 0) >= 0 ? "#16A34A" : "#DC2626" },
    { label: "연환산(CAGR)", value: fp(bt.cagr),                     color: (bt.cagr ?? 0) >= 0 ? "#16A34A" : "#DC2626" },
    { label: "MDD",          value: fp(bt.mdd),                     color: (() => { const a = Math.abs(Number(bt.mdd)); return a <= 15 ? "#16A34A" : a <= 25 ? "#D97706" : "#DC2626"; })() },
    { label: "샤프 비율",    value: fn(bt.sharpe),                   color: "#0F172A" },
    { label: "승률",         value: bt.winRate != null ? `${Number(bt.winRate).toFixed(1)}%` : "—", color: "#0F172A" },
  ];
  return (
    <div>
      {rows.map(r => (
        <div key={r.label} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "9px 0", borderBottom: "1px solid #F1F5F9",
        }}>
          <span style={{ fontSize: 13, color: "#64748B" }}>{r.label}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: r.color }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── 수익 곡선 미니 차트 ────────────────────────────────────────────────────
function EquityCurveChart({ data }) {
  if (!data || data.length < 2) return (
    <div style={{ height: 150, display: "flex", alignItems: "center", justifyContent: "center", color: "#CBD5E1", fontSize: 13 }}>
      수익 곡선 데이터 없음
    </div>
  );
  const base = Number(data[0].value) || 1;
  // 시작값 대비 수익률(%) 로 변환
  const pcts = data.map(d => ((Number(d.value) - base) / base) * 100);
  const minP = Math.min(...pcts);
  const maxP = Math.max(...pcts);
  const range = maxP - minP || 1;
  const W = 480, H = 150;
  const PAD = { t: 14, r: 10, b: 24, l: 42 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;
  const pts = pcts.map((p, i) => {
    const x = PAD.l + (i / (pcts.length - 1)) * iW;
    const y = PAD.t + (1 - (p - minP) / range) * iH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const fillPts = `${PAD.l},${PAD.t + iH} ` + pts + ` ${PAD.l + iW},${PAD.t + iH}`;
  const sd = data[0]?.date?.slice(0, 7) || "";
  const ed = data[data.length - 1]?.date?.slice(0, 7) || "";
  // Y축 눈금 3개: 최대·중간·최소 (소수점 1자리 %)
  const yTicks = [maxP, (maxP + minP) / 2, minP];
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id="ecGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366F1" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {yTicks.map((p, i) => {
        const y = PAD.t + (i / 2) * iH;
        const label = `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`;
        return (
          <g key={i}>
            <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="#F1F5F9" strokeWidth={1} />
            <text x={PAD.l - 5} y={y + 4} fontSize={9} fill="#94A3B8" textAnchor="end">{label}</text>
          </g>
        );
      })}
      <polygon points={fillPts} fill="url(#ecGrad)" />
      <polyline points={pts} fill="none" stroke="#6366F1" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <text x={PAD.l} y={H - 5} fontSize={9} fill="#94A3B8">{sd}</text>
      <text x={W - PAD.r} y={H - 5} fontSize={9} fill="#94A3B8" textAnchor="end">{ed}</text>
    </svg>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────
export default function WorkHome() {
  const nav = useNavigate();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { clientProfileDetail } = useStore();
  const username = (typeof window !== "undefined" && (localStorage.getItem("username") || localStorage.getItem("dbName"))) || "trader";

  const isValidProfileSrc = (s) => {
    if (!s || typeof s !== "string") return false;
    if (/cdn\.devbridge\.com/i.test(s)) return false;
    return /^(data:|blob:|https?:\/\/|\/)/i.test(s);
  };

  const hasApiImage = useRef(false);
  const [profileImage, setProfileImage] = useState(
    isValidProfileSrc(clientProfileDetail?.heroImage) ? clientProfileDetail.heroImage : getCurrentHeroSrc()
  );

  useEffect(() => {
    profileApi.getMyDetail()
      .then(d => {
        if (isValidProfileSrc(d?.profileImageUrl)) {
          setProfileImage(d.profileImageUrl);
          hasApiImage.current = true;
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onHeroChange = () => {
      if (!hasApiImage.current) setProfileImage(getCurrentHeroSrc());
    };
    window.addEventListener("alpha:hero-change", onHeroChange);
    return () => window.removeEventListener("alpha:hero-change", onHeroChange);
  }, []);
  const [strategies, setStrategies] = useState([]);
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      if (!localStorage.getItem("dbId")) { setLoading(false); return; }
      setLoading(true);
      try {
        const list = await listWorkspaces();
        const fulls = await Promise.all(list.map(w => getWorkspace(w.id).catch(() => null)));
        const items = fulls.filter(Boolean).map(w => {
          const trust = (w.lastTrust && typeof w.lastTrust === "object") ? (w.lastTrust.trust_score ?? null) : null;
          const h = healthFromTrust(trust);
          const goal = (w.goalProfile && typeof w.goalProfile === "object")
            ? (w.goalProfile.목표 || w.goalProfile.goal || w.goalProfile.summary || null) : null;
          const btStats = (w.lastBacktest && typeof w.lastBacktest === "object") ? w.lastBacktest.stats : null;
          const cands = Array.isArray(w.strategyConfig?.candidates) ? w.strategyConfig.candidates : [];
          const selId = w.strategyConfig?.selectedId || cands[0]?.id;
          const selCand = cands.find(c => c.id === selId) || cands[0];
          const riskTone = selCand?.risk_tone || null;
          return {
            id: w.id, name: w.name, trust, status: w.status,
            healthKey: h.key, color: h.color, bg: h.bg, gradient: h.gradient, goal, riskTone,
            bt: btStats ? {
              totalReturn: btStats.total_return_pct ?? null,
              cagr: btStats.annualized_return_pct ?? null,
              sharpe: btStats.sharpe ?? null,
              mdd: btStats.max_drawdown_pct ?? null,
              winRate: btStats.win_rate_pct ?? null,
            } : null,
            equityCurve: w.lastBacktest?.equity_curve ?? [],
          };
        });
        setStrategies(items);
        if (items.length > 0) {
          try {
            const cached = localStorage.getItem(`alpha.briefing.cache.${items[0].id}`);
            if (cached) setBriefing(JSON.parse(cached));
          } catch (_) {}
        }
      } catch (e) {
        setErr(e?.response?.data?.error || e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const firstGoal = strategies.find(s => s.goal)?.goal;
  const [slogan, setSlogan] = useState("");
  const [editGoal, setEditGoal] = useState(false);
  const [draft, setDraft] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalName, setCreateModalName] = useState("");
  const [createModalError, setCreateModalError] = useState("");
  const [creating, setCreating] = useState(false);

  const startEdit = () => { setDraft(slogan || firstGoal || ""); setEditGoal(true); };
  const saveEdit = () => { setSlogan(draft.trim()); setEditGoal(false); };

  const onNewWs = () => { setCreateModalName(""); setCreateModalError(""); setCreateModalOpen(true); };
  const onConfirmCreate = async () => {
    const trimmed = createModalName.trim();
    if (!trimmed) return;
    const duplicate = strategies.some(s => s.name?.trim().toLowerCase() === trimmed.toLowerCase());
    if (duplicate) { setCreateModalError("같은 이름의 워크스페이스가 이미 있어요."); return; }
    setCreateModalError("");
    setCreateModalOpen(false);
    setCreating(true);
    try {
      const w = await createWorkspace(trimmed);
      nav(`/alpha/w/${w.id}`);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message;
      if (e?.response?.status === 409) { setCreateModalOpen(true); setCreateModalError(msg); }
      else alert("생성 실패: " + msg);
    } finally { setCreating(false); }
  };

  // ── 대시보드 집계 ──────────────────────────────────────────────────────
  const testedItems = strategies.filter(s => s.bt);
  const recentTestedItems = [...testedItems].sort((a, b) => b.id - a.id).slice(0, 5);
  const testedCount = testedItems.length;
  const activeCount = strategies.filter(s => s.status === "LIVE").length;
  const untestedCount = strategies.filter(s => !s.bt && s.status !== "LIVE").length;
  const bestStrategy = testedItems.reduce((best, s) => {
    const v = s.bt.totalReturn ?? s.bt.cagr ?? -Infinity;
    const bv = best ? (best.bt.totalReturn ?? best.bt.cagr ?? -Infinity) : -Infinity;
    return v > bv ? s : best;
  }, null);
  const bestReturnVal = bestStrategy?.bt?.totalReturn ?? bestStrategy?.bt?.cagr;
  const bestReturnStr = bestReturnVal != null
    ? `${Number(bestReturnVal) >= 0 ? "+" : ""}${Number(bestReturnVal).toFixed(1)}%`
    : "—";
  const validSharpes = testedItems.filter(s => s.bt.sharpe != null).map(s => s.bt.sharpe);
  const avgSharpe = validSharpes.length > 0
    ? validSharpes.reduce((a, b) => a + b, 0) / validSharpes.length : null;
  const avgSharpeStr = avgSharpe != null ? Number(avgSharpe).toFixed(2) : "—";
  const quoteRef = useRef(null);
  const [quoteW, setQuoteW] = useState(320);
  useEffect(() => {
    if (!quoteRef.current) return;
    const ro = new ResizeObserver(entries => {
      setQuoteW(entries[0].contentRect.width || 320);
    });
    ro.observe(quoteRef.current);
    return () => ro.disconnect();
  }, []);

  const [primaryWsId, setPrimaryWsId] = useState(() => {
    const v = localStorage.getItem("alpha.primaryWsId");
    return v ? Number(v) : null;
  });
  useEffect(() => {
    const handler = (e) => setPrimaryWsId(e?.detail?.id ?? null);
    window.addEventListener("alpha:primary-change", handler);
    return () => window.removeEventListener("alpha:primary-change", handler);
  }, []);
  const featuredStrategy =
    (primaryWsId && strategies.find(s => s.id === primaryWsId)) ||
    strategies[0] ||
    null;

  // 최근 워크스페이스 목록 정렬: 대표(1개) → LIVE → 최근순, 최대 5개
  const recentWorkspaces = (() => {
    const primary = primaryWsId ? strategies.find(s => s.id === primaryWsId) : null;
    const lives = strategies
      .filter(s => s.status === "LIVE" && s.id !== (primary?.id ?? -1))
      .sort((a, b) => b.id - a.id);
    const rest = strategies
      .filter(s => s.id !== (primary?.id ?? -1) && s.status !== "LIVE")
      .sort((a, b) => b.id - a.id);
    return [...(primary ? [primary] : []), ...lives, ...rest].slice(0, 5);
  })();

  return (
    <div style={{ padding: "36px 40px 80px", background: "#F8FAFC", minHeight: "calc(100vh - 44px)", fontFamily: F, color: "#0F172A" }}>

      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
            background: "#EEF2FF",
            boxShadow: "0 6px 20px rgba(99,102,241,0.32)",
            border: "2.5px solid white",
          }}>
            <img src={profileImage} alt="profile"
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getCurrentHeroSrc(); }}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
          <div>
            <h1 style={{ margin: 0, lineHeight: 1.2, display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "0 6px" }}>
              <span style={{
                fontSize: 26, fontWeight: 800, lineHeight: 1.15,
                background: "linear-gradient(90deg,#3b82f6 0%,#6366f1 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                {greeting()},
              </span>
              <span style={{ fontSize: 26, fontWeight: 700, color: "#0F172A", whiteSpace: "nowrap" }}>
                {username}
              </span>
            </h1>
            <p style={{ margin: "5px 0 0", fontSize: 13, color: "#64748B", fontWeight: 500 }}>
              {t("workhome.subtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* 상단: Freedom Goal · Living Briefing(높이 맞춤) + 오늘의 말씀 포스트잇(붙여준 느낌) */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr", gap: 20, marginBottom: 36, alignItems: "stretch" }}>
        {/* Freedom Goal Card */}
        <section style={{
          background: "white", border: "1px solid #E2E8F0",
          borderRadius: 14, padding: "22px 22px 20px",
          display: "flex", flexDirection: "column", position: "relative", overflow: "hidden",
          boxSizing: "border-box", height: "100%",
        }}>
          <Target size={96} style={{ position: "absolute", right: -12, bottom: -12, color: "#6366F1", opacity: 0.1, pointerEvents: "none" }} />
          {/* 헤더 */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: theme.accentGradient, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 10px rgba(99,102,241,0.25)", flexShrink: 0 }}>
                <Target size={17} color="white" />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6366F1", letterSpacing: 1.5, textTransform: "uppercase" }}>Freedom Goal</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 2, background: theme.accentGradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>내 자유 목표</div>
              </div>
            </div>
            {!editGoal && (
              <button onClick={startEdit} title={t("common.edit")} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", cursor: "pointer" }}>
                <Pencil size={12} />
              </button>
            )}
          </div>
          {/* 목표 텍스트 */}
          {editGoal ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              <input value={draft} onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.nativeEvent.isComposing) return; if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditGoal(false); }}
                style={{ padding: "10px 12px", borderRadius: 9, border: "1.5px solid #C7D2FE", fontSize: 14, color: "#0F172A", outline: "none", background: "white" }}
                autoFocus />
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={saveEdit} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", background: "#6366F1", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{t("common.save")}</button>
                <button onClick={() => setEditGoal(false)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid #CBD5E1", background: "#F1F5F9", color: "#64748B", fontSize: 12, cursor: "pointer" }}>{t("common.cancel")}</button>
              </div>
            </div>
          ) : (
            <p style={{ margin: "0 0 18px", fontSize: 15.5, fontWeight: 700, color: "#0F172A", lineHeight: 1.6, letterSpacing: -0.2, flex: 1 }}>
              {slogan || firstGoal || (loading ? t("workhome.loading") : t("workhome.sloganEmpty"))}
            </p>
          )}
          <button onClick={() => nav("/vision_board")} style={{ background: "transparent", border: "none", color: "#6366F1", fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: 4 }}>
            {t("workhome.visionBoard")} <ArrowRight size={13} />
          </button>
        </section>

        {/* Today's Living Briefing */}
        <section
          onClick={() => nav("/briefing")}
          style={{
            background: "linear-gradient(145deg,#EEF2FF 0%,#F5F3FF 100%)",
            border: `1.5px solid ${briefing ? "#818CF8" : "#C7D2FE"}`,
            borderRadius: 14, padding: "20px 20px 18px",
            display: "flex", flexDirection: "column", cursor: "pointer",
            transition: "border-color 0.18s, box-shadow 0.18s",
            height: "100%", boxSizing: "border-box",
            boxShadow: briefing ? "0 4px 18px rgba(99,102,241,0.13)" : "none",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "#818CF8"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(99,102,241,0.2)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = briefing ? "#818CF8" : "#C7D2FE"; e.currentTarget.style.boxShadow = briefing ? "0 4px 18px rgba(99,102,241,0.13)" : "none"; }}
        >
          {/* 헤더 */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: theme.accentGradient, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 10px rgba(99,102,241,0.3)", flexShrink: 0 }}>
                <BookOpenText size={17} color="white" />
              </div>
              <div>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#6366F1", letterSpacing: 1.5, textTransform: "uppercase" }}>Today's Briefing</span>
                <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 2, background: theme.accentGradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>라이브 시장 브리핑</div>
              </div>
            </div>
            {briefing ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "#EF4444", borderRadius: 20, padding: "3px 9px" }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "white", display: "inline-block" }} />
                <span style={{ fontSize: 10, fontWeight: 800, color: "white", letterSpacing: 0.6 }}>NEW</span>
              </span>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(99,102,241,0.1)", borderRadius: 20, padding: "3px 9px" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366F1", display: "inline-block", boxShadow: "0 0 0 2.5px rgba(99,102,241,0.25)" }} />
                <span style={{ fontSize: 10, fontWeight: 800, color: "#6366F1", letterSpacing: 0.6 }}>LIVE</span>
              </span>
            )}
          </div>

          {/* 도착 메시지 */}
          <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, margin: "0 0 14px", flex: 1, whiteSpace: "pre-line" }}>
            {briefing
              ? "오늘의 브리핑이 도착했습니다.\n지금 바로 확인해보세요."
              : loading
              ? "브리핑 생성 중…"
              : "아직 브리핑이 없습니다.\n클릭해서 지금 바로 생성해보세요."}
          </p>

          {/* 하단: 도착 시간 + 읽기 CTA */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "#94A3B8" }}>
              {briefing?.generatedAt ? (() => {
                const d = new Date(typeof briefing.generatedAt === "number" ? briefing.generatedAt : Date.parse(briefing.generatedAt));
                return `오늘 ${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")} 도착`;
              })() : "브리핑 미생성"}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#6366F1", display: "inline-flex", alignItems: "center", gap: 3 }}>
              브리핑 읽기 <ArrowRight size={12} />
            </span>
          </div>
        </section>

        {/* 오른쪽 — 오늘의 선물 포스트잇 (붙여준 것처럼 위로 솟음): 투자 그루 명언 + 성경 한 절 */}
        {(() => { const g = getTodayGuru(username); const v = getTodayVerse(username);
          const qScale = Math.min(1, quoteW / 320);
          return (
          <div ref={quoteRef} style={{ position: "relative", alignSelf: "stretch" }}>
          <section style={{
            position: "absolute", left: 0, right: 0, bottom: 0,
            background: "linear-gradient(165deg,#FCF6CC 0%,#F7EEB2 100%)",
            borderRadius: 14,
            padding: "20px 18px 22px",
            boxShadow: "0 14px 30px rgba(168,146,46,0.3), inset 0 1px 0 rgba(255,255,255,0.55)",
            fontFamily: "'Nanum Pen Script', 'Gaegu', cursive",
            overflow: "hidden",
          }}>
            {/* 선물 ① 투자 그루의 명언 (영어 원문 · Caveat 손글씨) */}
            <p style={{ margin: "2px 0 0", fontFamily: "'Caveat', cursive", fontSize: 23 * qScale, fontWeight: 500, lineHeight: 1.18, color: "#3f3a14" }}>"{g.text}"</p>
            <p style={{ margin: "1px 0 0", fontFamily: "'Caveat', cursive", fontSize: 17 * qScale, color: "#9b8a2a", textAlign: "right" }}>— {g.ref}</p>
            <div style={{ height: 1, background: "rgba(155,138,42,0.32)", margin: "9px 2px" }} />
            {/* 선물 ② 성경 한 절 (영어 · Caveat 손글씨, 명언과 통일) */}
            <p style={{ margin: "0", fontFamily: "'Caveat', cursive", fontSize: 21 * qScale, fontWeight: 500, lineHeight: 1.2, color: "#3f3a14" }}>"{v.text}"</p>
            <p style={{ margin: "1px 0 0", fontFamily: "'Caveat', cursive", fontSize: 16 * qScale, color: "#9b8a2a", textAlign: "right" }}>— {v.ref}</p>
            {/* 받는 사람 */}
            <p style={{ margin: "12px 0 0", fontSize: 18.5 * qScale, color: "#1d4ed8", textAlign: "right", lineHeight: 1.1 }}>{username}에게</p>
          </section>
          </div>
        ); })()}
      </div>

      {/* ── ① 내 워크스페이스 현황 KPI 4칸 ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "#0F172A" }}>내 워크스페이스 현황</h2>
          <button onClick={onNewWs} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: theme.accentGradient || theme.accent, color: "white", border: "none",
            padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700,
            cursor: "pointer", boxShadow: "0 4px 12px rgba(59,130,246,0.22)",
          }}>
            <Plus size={15} /> 새 워크스페이스
          </button>
        </div>
        {err && (
          <div style={{ padding: 14, background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA", borderRadius: 10, fontSize: 13, marginBottom: 12 }}>
            {t("workhome.loadFailed", { err })}
          </div>
        )}
        {loading && strategies.length === 0 ? (
          <div style={{ color: "#94A3B8", fontSize: 13, padding: "10px 0" }}>{t("workhome.loading")}</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
            <KpiCard
              label="보유 워크스페이스 수"
              value={String(strategies.length)}
              sub={`실행 중 ${activeCount} / 미시작 ${untestedCount}`}
              icon={Layers}
            />
            <KpiCard
              label="백테스트 완료"
              value={`${testedCount}회`}
              sub={`전략 ${testedCount}개`}
              icon={BarChart3}
            />
            <KpiCard
              label="최고 수익률 전략"
              value={bestReturnStr}
              sub={bestStrategy ? `${bestStrategy.name} (연환산)` : "없음"}
              positive
              icon={TrendingUp}
            />
            <KpiCard
              label="평균 샤프 비율"
              value={avgSharpeStr}
              sub={testedCount > 0 ? `전략 ${testedCount}개 평균` : "백테스트 없음"}
              icon={Award}
            />
          </div>
        )}
      </div>

      {/* ── ② 차트 + ③ 전략 목록 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 18, marginBottom: 18 }}>
        <div style={panelCard}>
          <h3 style={panelTitle}>워크스페이스별 백테스트 수익률 비교</h3>
          <BtBarChart items={recentTestedItems} />
        </div>
        <div style={panelCard}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h3 style={{ ...panelTitle, margin: 0 }}>최근 워크스페이스 목록</h3>
            <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500 }}>최대 5개</span>
          </div>
          {strategies.length === 0 && !loading ? (
            <div style={{ color: "#CBD5E1", fontSize: 13, padding: "16px 0" }}>
              아직 워크스페이스가 없습니다. 새로 만들어보세요.
            </div>
          ) : (
            <StrategyListPanel items={recentWorkspaces} onNav={(id) => nav(`/alpha/w/${id}`)} featuredId={primaryWsId} />
          )}
        </div>
      </div>

      {/* ── ④ 대표 워크스페이스 지표 + 수익 곡선 ── */}
      {featuredStrategy && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
          <div style={panelCard}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <h3 style={{ ...panelTitle, margin: 0 }}>대표 워크스페이스 주요 지표</h3>
              <span style={{ fontWeight: 500, color: "#6366F1", fontSize: 13 }}>· {featuredStrategy.name}</span>
              {featuredStrategy.riskTone && <ToneBadge tone={featuredStrategy.riskTone} />}
            </div>
            <BestStrategyMetrics s={featuredStrategy} />
          </div>
          <div style={panelCard}>
            <h3 style={panelTitle}>대표 워크스페이스 수익 곡선 <span style={{ fontWeight: 500, color: "#6366F1", fontSize: 13 }}>· {featuredStrategy.name}</span></h3>
            <EquityCurveChart data={featuredStrategy.equityCurve} />
          </div>
        </div>
      )}

      <CreateWorkspaceModal
        open={createModalOpen}
        name={createModalName}
        onChange={v => { setCreateModalName(v); setCreateModalError(""); }}
        onConfirm={onConfirmCreate}
        onClose={() => { setCreateModalOpen(false); setCreateModalError(""); }}
        error={createModalError}
      />
    </div>
  );
}

const cardStyle = { background: "white", border: "1px solid #E2E8F0", borderRadius: 14, padding: "22px 24px" };
const cardHeader = { display: "flex", alignItems: "center", gap: 10, marginBottom: 4 };
const cardTitle = { fontSize: 17, fontWeight: 700, margin: 0, color: "#0F172A" };
const iconBubble = { width: 28, height: 28, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center" };
const iconBtn = (color) => ({ width: 26, height: 26, borderRadius: 6, border: "1px solid #E2E8F0", background: "white", color, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 });
const panelCard = { background: "white", borderRadius: 14, padding: "20px 22px", border: "1px solid #E2E8F0", boxShadow: "0 1px 4px rgba(15,23,42,0.05)" };
const panelTitle = { fontSize: 15, fontWeight: 700, margin: "0 0 14px", color: "#0F172A" };
