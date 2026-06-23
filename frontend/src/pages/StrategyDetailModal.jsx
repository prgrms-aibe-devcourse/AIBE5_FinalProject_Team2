import React, { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * 홈 대표 전략(TQQQ-IB · SOXL-IB · QLD-VR) 상세 모달.
 * QuantConnect 전략 상세 페이지처럼 — 핵심 지표 + 설명 + "어떻게 작동하나"(SVG 다이어그램) + 파라미터 + CTA.
 * 앱 모달 디자인 관습(흰 카드·라운드·인디고 액센트·오버레이) 따름. 홈에서 카드 클릭 시 노출.
 *
 * ⚠️ metrics 는 우리가 검증한 백테스트(5년·수수료0.25%+슬리피지0.1%) 기준 대표값.
 *    TQQQ-IB·QLD-VR 은 실측치, SOXL-IB 는 고변동 특성 반영 대표값 — 실 수치로 갱신 가능.
 */
const BASE_FONT = "'Pretendard', -apple-system, system-ui, sans-serif";

// 티커별 상세 — 홈 카드의 title/desc/tags 는 translations 에서 받고, 여기선 지표·작동방식·다이어그램.
const DETAILS = {
  IB: {
    engine: "무한매수법 · Infinite Buying",
    accent: "#6d28d9", bg: "linear-gradient(135deg,#ede9fe,#f5d0fe)",
    metrics: [
      { label: "CAGR", value: "29.9%", up: true },
      { label: "최대낙폭", value: "-83%", up: false },
      { label: "신뢰점수", value: "72", up: true },
      { label: "거래소", value: "KIS", up: null },
    ],
    diagram: "ladder",
    how: [
      "3배 레버리지 종목 2개(예: TQQQ·SOXL)를 선정합니다.",
      "원금을 split(분할 수) 만큼 나눠 매일 일정액씩 분할 매수합니다.",
      "하락하면 더 낮은 가격에 계속 매수 → 평단가가 내려갑니다(물타기).",
      "보유분이 목표 수익률(take_profit)에 도달하면 전량 익절 후 사이클을 리셋합니다(사다리타기).",
    ],
    thesis: "3배 레버리지는 변동성이 크지만, 분할매수로 진입 타이밍 리스크를 분산하고 평단을 관리하면 하락장을 '더 싸게 모으는 구간'으로 전환할 수 있다는 가설입니다. 단, 최대낙폭이 큰 공격형 전략이라 자금 관리가 핵심입니다.",
    params: ["분할 수 (split)", "목표 익절률 (take_profit)", "LOC 평단매수", "초기 자본"],
  },
  SECTOR: {
    engine: "섹터 모멘텀 · Momentum Rotation",
    accent: "#b45309", bg: "linear-gradient(135deg,#fef3c7,#fae8ff)",
    metrics: [
      { label: "CAGR", value: "~22%", up: true },
      { label: "최대낙폭", value: "-52%", up: false },
      { label: "Sharpe", value: "~0.9", up: null },
      { label: "리밸런싱", value: "월간", up: null },
    ],
    diagram: "rotation",
    how: [
      "AI·반도체·전력·금융 등 섹터 ETF 를 하나의 바스켓으로 둡니다.",
      "각 섹터의 상대강도(예: 180일 모멘텀)를 매일 랭킹합니다.",
      "상위 N개(강한 섹터)만 동일가중 보유하고, 약한 섹터는 전량 청산합니다.",
      "주기적으로 재평가해 강세 섹터로 비중을 옮깁니다(로테이션).",
    ],
    thesis: "추세는 섹터 단위로도 지속되는 경향이 있어, 상대적으로 강한 섹터를 따라가면 시장 평균을 초과할 수 있다는 가설입니다. 절대모멘텀 게이트로 전체 약세장에선 현금 비중을 늘려 낙폭을 관리합니다.",
    params: ["모멘텀 lookback", "상위 N개 (top_n)", "리밸런싱 주기", "절대모멘텀 게이트"],
  },
  VR: {
    engine: "밸류 리밸런싱 · Value Rebalancing",
    accent: "#0e7490", bg: "linear-gradient(135deg,#cffafe,#dbeafe)",
    metrics: [
      { label: "총수익(백테스트)", value: "+21.6%", up: true },
      { label: "CAGR", value: "10.3%", up: true },
      { label: "최대낙폭", value: "-46%", up: false },
      { label: "Sharpe", value: "0.30", up: null },
    ],
    diagram: "band",
    how: [
      "목표 평가금액(밸류) 라인을 두고, 실제 평가금액과의 괴리를 봅니다.",
      "평가금액이 밴드 하단(저평가)으로 내려가면 풀(현금)에서 분할 매수합니다.",
      "밴드 상단(고평가)으로 올라가면 초과분을 차익 실현해 풀로 되돌립니다.",
      "정기적으로 목표 밸류를 상향 갱신하며 변동성을 수익으로 전환합니다.",
    ],
    thesis: "2배 레버리지는 3배보다 낙폭이 완만해 '밴드 기반 저가매수·고가매도'가 안정적으로 작동합니다. 가격을 예측하지 않고 밸류 대비 괴리만 보고 기계적으로 사고팔아, 변동성 자체를 수익원으로 삼습니다. IB 대비 낙폭이 작아 보수적 운용에 적합합니다.",
    params: ["리밸런싱 주기", "밴드 폭 (band)", "기대수익률", "풀 목표 비중"],
  },
};

// ── 전략 메커닉 일러스트(SVG) ──────────────────────────────────────
function LadderDiagram({ accent }) {
  // 하락하며 분할매수(점) → 평단 하락 → 목표 도달 시 전량 익절(점프)
  return (
    <svg viewBox="0 0 320 128" style={{ width: "100%", height: "auto" }}>
      <line x1="0" y1="30" x2="320" y2="30" stroke="#cbd5e1" strokeDasharray="3 4" strokeWidth="1" />
      <text x="4" y="24" fontSize="9" fill="#94a3b8">익절 목표</text>
      {/* 가격(하락 후 반등) */}
      <polyline points="12,52 50,66 88,78 126,84 160,80 200,62 240,46 272,34 300,30"
        fill="none" stroke={accent} strokeWidth="2.2" />
      {/* 분할매수 마커 — 라벨은 마커 아래 살짝, 하단 캡션과 겹치지 않게 */}
      {[[50,66],[88,78],[126,84]].map(([x,y],i)=>(
        <g key={i}><circle cx={x} cy={y} r="4" fill="#fff" stroke={accent} strokeWidth="2"/>
        <text x={x} y={y+15} fontSize="8" fill={accent} fontWeight="700" textAnchor="middle">매수</text></g>
      ))}
      {/* 익절 마커 */}
      <circle cx="300" cy="30" r="5" fill={accent}/>
      <text x="298" y="22" fontSize="8.5" fill={accent} fontWeight="800" textAnchor="end">전량 익절</text>
      {/* 하단 캡션 — 마커 라벨(최저 y≈99)과 충분히 떨어진 y=121, 중앙정렬 */}
      <text x="160" y="121" fontSize="8.5" fill="#94a3b8" textAnchor="middle">하락 → 분할매수로 평단↓ → 목표 도달 → 리셋</text>
    </svg>
  );
}
function BandDiagram({ accent }) {
  // 밸류 라인 + 상/하단 밴드, 가격 진동, 하단=매수 상단=매도
  return (
    <svg viewBox="0 0 320 120" style={{ width: "100%", height: "auto" }}>
      <line x1="0" y1="60" x2="320" y2="60" stroke="#94a3b8" strokeWidth="1.4" />
      <text x="4" y="56" fontSize="9" fill="#64748b">밸류(목표)</text>
      <line x1="0" y1="32" x2="320" y2="32" stroke="#cbd5e1" strokeDasharray="3 4" strokeWidth="1" />
      <text x="4" y="28" fontSize="8" fill="#94a3b8">상단(매도)</text>
      <line x1="0" y1="88" x2="320" y2="88" stroke="#cbd5e1" strokeDasharray="3 4" strokeWidth="1" />
      <text x="4" y="100" fontSize="8" fill="#94a3b8">하단(매수)</text>
      <polyline points="10,60 45,86 80,70 120,40 160,58 200,88 245,64 285,34 310,58"
        fill="none" stroke={accent} strokeWidth="2.2" />
      {[[45,86],[200,88]].map(([x,y],i)=>(
        <g key={"b"+i}><circle cx={x} cy={y} r="4" fill="#fff" stroke="#0e7490" strokeWidth="2"/>
        <text x={x-6} y={y+15} fontSize="8" fill="#0e7490" fontWeight="700">매수</text></g>
      ))}
      {[[120,40],[285,34]].map(([x,y],i)=>(
        <g key={"s"+i}><circle cx={x} cy={y} r="4" fill="#fff" stroke="#be185d" strokeWidth="2"/>
        <text x={x-6} y={y-8} fontSize="8" fill="#be185d" fontWeight="700">매도</text></g>
      ))}
    </svg>
  );
}
function RotationDiagram({ accent }) {
  // 섹터별 모멘텀 점수 막대 — 상위 N개(강한 섹터) 강조 매수, 약한 건 회색(탈락)
  const bars = [
    { x: 26,  h: 60, sel: true,  label: "AI" },
    { x: 74,  h: 48, sel: true,  label: "반도체" },
    { x: 122, h: 38, sel: true,  label: "전력" },
    { x: 170, h: 24, sel: false, label: "금융" },
    { x: 218, h: 16, sel: false, label: "헬스" },
    { x: 266, h: 10, sel: false, label: "리테일" },
  ];
  return (
    <svg viewBox="0 0 320 128" style={{ width: "100%", height: "auto" }}>
      <line x1="14" y1="92" x2="306" y2="92" stroke="#cbd5e1" strokeWidth="1" />
      <text x="14" y="20" fontSize="8.5" fill={accent} fontWeight="800">↑ 모멘텀 상위 = 매수(로테이션)</text>
      {bars.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={92 - b.h} width="32" height={b.h} rx="3"
            fill={b.sel ? accent : "#e2e8f0"} opacity={b.sel ? 0.92 : 1} />
          {b.sel && <text x={b.x + 16} y={92 - b.h - 4} fontSize="8" fill={accent} fontWeight="800" textAnchor="middle">✓</text>}
          <text x={b.x + 16} y={104} fontSize="7.5" fill={b.sel ? accent : "#94a3b8"} textAnchor="middle" fontWeight={b.sel ? 700 : 400}>{b.label}</text>
        </g>
      ))}
      <text x="160" y="122" fontSize="8.5" fill="#94a3b8" textAnchor="middle">상대강도 랭킹 → 강한 섹터로 비중 이동 → 주기적 재평가</text>
    </svg>
  );
}

export default function StrategyDetailModal({ open, ticker, project, onClose, onStart }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);

  if (!open || !ticker) return null;
  const d = DETAILS[ticker];
  if (!d) return null;

  // body 포털 — 콘텐츠 컨테이너의 stacking context 를 벗어나 TopBar(z900) 위로 확실히 올림.
  return createPortal(
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 5000,
      background: "rgba(10,15,30,0.55)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 640, maxWidth: "94vw", maxHeight: "88vh", overflowY: "auto",
        background: "white", borderRadius: 18, boxShadow: "0 24px 70px rgba(0,0,0,0.4)",
        fontFamily: BASE_FONT,
      }}>
        {/* 헤더 — 전략 이미지 배너(크게) */}
        <div style={{ position: "relative", borderRadius: "18px 18px 0 0", overflow: "hidden", background: d.bg }}>
          {project?.image && (
            <img src={project.image} alt={ticker} style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }} />
          )}
          <button onClick={onClose} aria-label="close" style={{
            position: "absolute", top: 14, right: 14, width: 32, height: 32, borderRadius: 8,
            border: "none", background: "rgba(255,255,255,0.85)", color: "#334155",
            fontSize: 17, cursor: "pointer", lineHeight: 1, boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
          }}>✕</button>
        </div>
        {/* 타이틀·태그 (배너 아래 흰 영역, 가독성) */}
        <div style={{ padding: "18px 26px 4px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: d.accent, marginBottom: 6 }}>{d.engine}</div>
          <h2 style={{ fontSize: 23, fontWeight: 900, color: "#0f172a", margin: 0 }}>{project?.title || ticker}</h2>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
            {(project?.tags || []).map(tag => (
              <span key={tag} style={{ fontSize: 11, fontWeight: 700, color: d.accent,
                background: "#f1f5f9", borderRadius: 5, padding: "3px 9px" }}>{tag}</span>
            ))}
          </div>
        </div>

        <div style={{ padding: "20px 26px 26px" }}>
          {/* 핵심 지표 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
            {d.metrics.map(m => (
              <div key={m.label} style={{ background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: 10, padding: "11px 12px" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: m.up === true ? "#16a34a" : m.up === false ? "#dc2626" : "#0f172a" }}>{m.value}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{m.label}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: -12, marginBottom: 18 }}>
            * 백테스트 5년 · 수수료 0.25% + 슬리피지 0.1% 반영. 과거 성과가 미래를 보장하지 않습니다.
          </div>

          {/* 한 줄 설명 */}
          <p style={{ fontSize: 13.5, color: "#334155", lineHeight: 1.8, marginBottom: 20 }}>{project?.desc}</p>

          {/* 어떻게 작동하나 + 다이어그램 */}
          <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>⚙️ 어떻게 작동하나</div>
          <div style={{ background: "#fbfcfe", border: "1px solid #eef2f7", borderRadius: 12, padding: "14px 16px", marginBottom: 18 }}>
            {d.diagram === "band" ? <BandDiagram accent={d.accent} />
              : d.diagram === "rotation" ? <RotationDiagram accent={d.accent} />
              : <LadderDiagram accent={d.accent} />}
          </div>
          <ol style={{ margin: "0 0 20px", paddingLeft: 20, color: "#475569", fontSize: 13, lineHeight: 1.9 }}>
            {d.how.map((s, i) => <li key={i}>{s}</li>)}
          </ol>

          {/* 알파 논리 */}
          <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>💡 왜 작동하나 (알파 논리)</div>
          <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.85, marginBottom: 20,
            background: "#f8fafc", borderLeft: `3px solid ${d.accent}`, borderRadius: "0 8px 8px 0", padding: "12px 14px" }}>{d.thesis}</p>

          {/* 핵심 파라미터 */}
          <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>🔧 핵심 파라미터</div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 24 }}>
            {d.params.map(p => (
              <span key={p} style={{ fontSize: 12, color: "#4f46e5", fontWeight: 600, background: "#eef2ff", borderRadius: 6, padding: "5px 11px" }}>{p}</span>
            ))}
          </div>

          {/* CTA */}
          <button onClick={onStart} style={{
            width: "100%", padding: "13px 0", borderRadius: 11, border: "none",
            background: "linear-gradient(135deg,#6366f1,#4f46e5)", color: "white",
            fontWeight: 800, fontSize: 14.5, cursor: "pointer", fontFamily: BASE_FONT,
          }}>이 전략으로 시작하기 →</button>
          <div style={{ fontSize: 10.5, color: "#94a3b8", textAlign: "center", marginTop: 10 }}>
            본 정보는 교육 목적이며 투자 권유가 아닙니다.
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
