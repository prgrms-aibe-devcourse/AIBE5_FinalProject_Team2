import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { X, ArrowRight } from "lucide-react";
import useTutorialStore, { TUTORIAL_STEPS, TOTAL_STEPS } from "../../store/useTutorialStore";

const TOOLTIP_W = 292;
const TOOLTIP_GAP = 18;
const OUTLINE_OFFSET = 6; // outline-offset (px)

/* ── 툴팁 위치 계산 (getBoundingClientRect 기준) ── */
const TOOLTIP_APPROX_H = 280; // 대략적인 툴팁 높이 (뷰포트 하단 클램핑용)
function clampTop(top) {
  const vh = window.innerHeight;
  return Math.max(16, Math.min(vh - TOOLTIP_APPROX_H - 16, top));
}

function calcTooltipPos(rect, side, leftShift = 0, topShift = 0) {
  const vw = window.innerWidth;
  if (side === "right") {
    return {
      top: Math.max(16, clampTop(rect.top + rect.height / 2 - 110) - topShift),
      left: Math.min(vw - TOOLTIP_W - 16, rect.right + OUTLINE_OFFSET + TOOLTIP_GAP),
    };
  }
  if (side === "left") {
    return {
      top: Math.max(16, clampTop(rect.top + rect.height / 2 - 110) - topShift),
      left: Math.max(16, rect.left - TOOLTIP_W - OUTLINE_OFFSET - TOOLTIP_GAP - leftShift),
    };
  }
  if (side === "bottom-left") {
    return {
      top: Math.max(16, clampTop(rect.bottom + OUTLINE_OFFSET + TOOLTIP_GAP) - topShift),
      left: Math.max(16, Math.min(vw - TOOLTIP_W - 16, rect.right - TOOLTIP_W)),
    };
  }
  // bottom (default)
  return {
    top: Math.max(16, clampTop(rect.bottom + OUTLINE_OFFSET + TOOLTIP_GAP) - topShift),
    left: Math.max(16, Math.min(vw - TOOLTIP_W - 16, rect.left + rect.width / 2 - TOOLTIP_W / 2)),
  };
}

/* ── 말풍선 꼬리 ── */
function Arrow({ side, tooltipLeft, tooltipTop, targetRect }) {
  const base = { position: "absolute", width: 0, height: 0, border: "8px solid transparent" };
  if (side === "right" || side === "left") {
    // 타겟 요소 중심 높이로 동적 정렬
    const arrowTop = targetRect
      ? Math.max(12, Math.min(200, targetRect.top + targetRect.height / 2 - tooltipTop))
      : 22;
    if (side === "right")
      return <div style={{ ...base, left: -16, top: arrowTop, borderRightColor: "white" }} />;
    return <div style={{ ...base, right: -16, top: arrowTop, borderLeftColor: "white" }} />;
  }
  // bottom / bottom-left: 타겟 버튼 중앙을 동적으로 가리킴
  const arrowLeft = targetRect ? (targetRect.left + targetRect.width / 2) - tooltipLeft : TOOLTIP_W / 2;
  return <div style={{ ...base, top: -16, left: Math.max(12, Math.min(TOOLTIP_W - 24, arrowLeft)), borderBottomColor: "white" }} />;
}

/* ── 툴팁 카드 ── */
function TooltipCard({ rect, stepData, step, onNext, onStop }) {
  const pos = calcTooltipPos(rect, stepData.side, stepData.leftShift || 0, stepData.topShift || 0);
  const progress = ((step + 1) / TOTAL_STEPS) * 100;

  return (
    <div style={{
      position: "fixed",
      top: pos.top,
      left: pos.left,
      width: TOOLTIP_W,
      zIndex: 9010,
      background: "white",
      borderRadius: 16,
      padding: "20px 22px 18px",
      boxShadow: "0 24px 64px rgba(0,0,0,0.22), 0 4px 16px rgba(99,102,241,0.14)",
      border: "1px solid rgba(99,102,241,0.18)",
      animation: "_tut_card_in 0.22s ease",
    }}>
      <Arrow side={stepData.side} tooltipLeft={pos.left} tooltipTop={pos.top} targetRect={rect} />

      {/* 단계 배지 + 진행바 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{
          fontSize: 10, fontWeight: 800, color: "#6366f1", letterSpacing: 0.8,
          background: "#EEF2FF", padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap",
        }}>
          STEP {step + 1} / {TOTAL_STEPS}
        </span>
        <div style={{ flex: 1, height: 3, background: "#E2E8F0", borderRadius: 2 }}>
          <div style={{
            height: "100%", width: `${progress}%`, borderRadius: 2,
            background: "linear-gradient(90deg,#6366f1,#818cf8)",
            transition: "width 0.4s ease",
          }} />
        </div>
      </div>

      <div style={{
        fontSize: 15, fontWeight: 800, lineHeight: 1.3, marginBottom: 8,
        background: "linear-gradient(90deg,#3b82f6,#6366f1)",
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
      }}>
        {stepData.title}
      </div>

      <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.65, marginBottom: 16 }}>
        {stepData.desc}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={onStop} style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 11.5, color: "#94a3b8", padding: 0,
        }}>
          건너뛰기
        </button>

        {stepData.isLast ? (
          <button onClick={onStop} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 18px", borderRadius: 9, border: "none",
            background: "linear-gradient(90deg,#6366f1,#818cf8)",
            color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 3px 10px rgba(99,102,241,0.35)",
          }}>
            완료! 🎉
          </button>
        ) : stepData.manualNext ? (
          <button onClick={onNext} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 18px", borderRadius: 9, border: "none",
            background: "linear-gradient(90deg,#6366f1,#818cf8)",
            color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 3px 10px rgba(99,102,241,0.35)",
          }}>
            다음 <ArrowRight size={13} />
          </button>
        ) : (
          <span style={{ fontSize: 12, color: "#6366f1", fontWeight: 700 }}>
            위 요소를 클릭하세요
          </span>
        )}
      </div>
    </div>
  );
}

/* ── 메인 오버레이 ── */
export default function TutorialOverlay() {
  const { active, step, next, stop } = useTutorialStore();
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  const advancedRef = useRef(false);
  const rafRef = useRef(null);
  const [tooltipRect, setTooltipRect] = useState(null);
  const lastRectKey = useRef("");

  const stepData = TUTORIAL_STEPS[step];

  /* ── CSS 주입: 링은 타겟 요소에 outline으로 직접 → 좌표 계산 불필요, 픽셀 완벽 ── */
  useEffect(() => {
    const styleId = "__tut_ring_css";
    const cleanup = () => { document.getElementById(styleId)?.remove(); };

    if (!active || !stepData) { cleanup(); return; }
    cleanup(); // 이전 스텝 스타일 제거

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @keyframes _tut_ring_glow {
        0%,100% {
          box-shadow: 0 0 0 0 rgba(99,102,241,0.55), 0 0 0 3px rgba(99,102,241,0.25);
          outline-color: #6366f1;
        }
        50% {
          box-shadow: 0 0 0 12px rgba(99,102,241,0), 0 0 20px rgba(99,102,241,0.65);
          outline-color: #818cf8;
        }
      }
      @keyframes _tut_card_in {
        from { opacity:0; transform:scale(.95) translateY(4px); }
        to   { opacity:1; transform:scale(1)   translateY(0);   }
      }

      /* 타겟 요소에 outline 링 직접 적용 */
      [data-tutorial-id="${stepData.targetId}"] {
        outline: 2px solid #6366f1 !important;
        outline-offset: ${OUTLINE_OFFSET}px !important;
        animation: _tut_ring_glow 1.8s ease infinite !important;
        position: relative !important;
        z-index: 9005 !important;
      }

      /* 사이드바 스텝: 사이드바 전체 stacking context를 overlay 위로 올림 */
      ${stepData.raiseSidebar ? "[data-tut-sidebar] { z-index: 9005 !important; }" : ""}
    `;
    document.head.appendChild(style);
    return cleanup;
  }, [active, step]); // eslint-disable-line

  /* ── RAF: 툴팁 위치만 추적 (링은 CSS가 처리) ── */
  useEffect(() => {
    if (!active || !stepData) { setTooltipRect(null); return; }

    const tick = () => {
      const el = document.querySelector(`[data-tutorial-id="${stepData.targetId}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          const key = `${r.top.toFixed(1)},${r.left.toFixed(1)},${r.width.toFixed(1)},${r.height.toFixed(1)}`;
          if (key !== lastRectKey.current) {
            lastRectKey.current = key;
            setTooltipRect({ top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height });
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [active, step]); // eslint-disable-line

  /* 스텝 변경 시 초기화 */
  useEffect(() => {
    advancedRef.current = false;
    lastRectKey.current = "";
    setTooltipRect(null);
  }, [step]);

  /* 경로 변경 → 자동 다음 단계 (checkAdvance 스텝) */
  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = location.pathname;
    if (!active || !stepData?.checkAdvance || advancedRef.current) return;
    if (prev !== location.pathname && stepData.checkAdvance(location.pathname)) {
      advancedRef.current = true;
      setTimeout(() => next(), 350);
    }
  }, [location.pathname]); // eslint-disable-line

  /* 타겟 요소 클릭 → 자동 다음 단계 (checkAdvance·manualNext 없는 스텝) */
  useEffect(() => {
    if (!active || !stepData || stepData.checkAdvance || stepData.manualNext) return;

    const handler = (e) => {
      if (!e.target.closest(`[data-tutorial-id="${stepData.targetId}"]`)) return;
      if (advancedRef.current) return;
      advancedRef.current = true;
      setTimeout(() => {
        if (stepData.isLast) stop();
        else next();
      }, 200);
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [active, step]); // eslint-disable-line

  if (!active || !stepData) return null;

  return createPortal(
    <>
      {/* 어두운 배경 */}
      <div style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 9000, pointerEvents: "none",
      }} />

      {/* 툴팁 */}
      {tooltipRect && (
        <TooltipCard
          rect={tooltipRect}
          stepData={stepData}
          step={step}
          onNext={next}
          onStop={stop}
        />
      )}

      {/* 닫기 버튼 */}
      <button onClick={stop} style={{
        position: "fixed", top: 16, right: 16,
        zIndex: 9010,
        background: "white", border: "1px solid #E2E8F0",
        borderRadius: 8, padding: "7px 14px",
        fontSize: 12, color: "#64748b", cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 5,
        boxShadow: "0 4px 12px rgba(0,0,0,0.10)",
      }}>
        <X size={13} /> 튜토리얼 닫기
      </button>
    </>,
    document.body
  );
}
