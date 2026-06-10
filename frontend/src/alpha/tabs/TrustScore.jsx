import React, { useRef, useState } from "react";
import { Award, Wrench, AlertTriangle } from "lucide-react";
import { TooltipIcon } from "./helpers";

const METRIC_HINTS = {
  generalization:         "Walk-Forward 검증에서 과거 구간(In-Sample) 성과가 미래 구간(Out-of-Sample)에서도 유지되는지 측정합니다.\n\n과거에만 잘 맞춰진 과적합 전략일수록 점수가 낮아집니다. OOS Sharpe가 IS Sharpe와 가까울수록 높은 점수입니다.",
  regime_robustness:      "상승·하락·횡보·고변동 4가지 시장 국면 중 '가장 안 좋은 국면'의 Sharpe로 평가합니다.\n\n특정 국면에만 강한 전략은 낮게 나옵니다. 모든 국면에서 고르게 방어적인 전략이 높은 점수를 받습니다.",
  parameter_stability:    "주요 파라미터를 ±10% 흔들었을 때 Sharpe가 얼마나 안정적인지 측정합니다.\n\n파라미터 변화에 민감하면 운 좋은 설계일 가능성이 높아 낮은 점수를 받습니다.",
  risk_control:           "목표 MDD 대비 실제 MDD 비율로 평가합니다.\n\n목표보다 손실이 작으면 높은 점수, 목표 MDD를 초과하면 낮은 점수를 받습니다.",
  statistical_confidence: "일별 수익률 평균이 0과 통계적으로 유의하게 다른지 t-statistic으로 측정합니다.\n\n시운(운)이 아닌 실증적 우위성이 있어야 높은 점수를 받습니다.",
};

function getScoreColor(score) {
  if (score >= 80) return "#10B981";
  if (score >= 50) return "#3B82F6";
  if (score >= 20) return "#F59E0B";
  return "#DC2626";
}

// ─── 원형 게이지 (Regime 도넛과 동일한 크기/두께) ────────────────
function CircleGauge({ score }) {
  const SIZE = 120, SW = 12;
  const r = (SIZE - SW) / 2;
  const cx = SIZE / 2, cy = SIZE / 2;
  const C = 2 * Math.PI * r;
  const color = getScoreColor(score);
  const filled = (score / 100) * C;

  return (
    <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} fill="none">
        <circle cx={cx} cy={cy} r={r} stroke="#E2E8F0" strokeWidth={SW} fill="none" />
        <circle
          cx={cx} cy={cy} r={r} stroke={color} strokeWidth={SW} fill="none"
          strokeDasharray={`${filled} ${C - filled}`}
          strokeDashoffset={0}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, lineHeight: 1 }}>점수</span>
        <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1, color: "#0f172a" }}>{score}</span>
        <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, lineHeight: 1 }}>/100</span>
      </div>
    </div>
  );
}

// ─── 세부 메트릭 카드 (Regime 범례 스타일 + 툴팁) ────────────────
function MetricCard({ item }) {
  const color = getScoreColor(item.score);
  const hint = METRIC_HINTS[item.key] || "";
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: "#F9FAFB" }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0, display: "inline-block" }} />
        <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>{item.label}</span>
        {hint && <TooltipIcon hint={hint} width={240} />}
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color, fontVariantNumeric: "tabular-nums" }}>{item.score}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#9ca3af" }}>/100</span>
      </div>
      <div style={{ height: 14, background: "#E5E7EB", borderRadius: 7, overflow: "hidden" }}>
        <div style={{ width: `${item.score}%`, height: "100%", background: color, borderRadius: 7, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

// ─── 강점/보완 카드 (Regime 최고/최저 카드 스타일) ───────────────
function StrengthWeaknessCard({ card }) {
  const isStrength = card.type === "strength";
  const color     = isStrength ? "#15803d" : "#dc2626";
  const barColor  = isStrength ? "#22c55e" : "#ef4444";
  const bg        = isStrength ? "#f0fdf4" : "#fef2f2";
  const border    = isStrength ? "#86efac" : "#fca5a5";
  const Icon      = isStrength ? Award : Wrench;

  const [desc, evidence] = (() => {
    const idx = card.body.indexOf("근거:");
    if (idx === -1) return [card.body.trim(), null];
    return [card.body.slice(0, idx).trim(), card.body.slice(idx + 3).trim()];
  })();

  return (
    <div style={{ padding: "16px 18px", borderRadius: 12, border: `2px solid ${border}`, background: bg }}>
      <div style={{ fontSize: 12, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <Icon size={13} color={color} />
        {isStrength ? "강점" : "보완 필요"} · {card.title}
      </div>
      <div style={{ display: "flex", gap: 20, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 3 }}>점수</div>
          <div style={{ fontSize: 30, fontWeight: 700, color, lineHeight: 1 }}>{card.score}</div>
        </div>
      </div>
      {desc && <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.65, marginBottom: evidence ? 10 : 0 }}>{desc}</div>}
      {evidence && (
        <div style={{ borderTop: `1px dashed ${border}`, paddingTop: 8, marginTop: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 3 }}>근거</div>
          <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>{evidence}</div>
        </div>
      )}
    </div>
  );
}

// ─── 메인 ────────────────────────────────────────────────────────
export default function TrustScore({ score, grade, penaltyLabel, description, cards, metrics, alertMessage }) {
  const gradeColor = score >= 75 ? "#10b981" : score >= 60 ? "#3b82f6" : score >= 45 ? "#f59e0b" : "#ef4444";
  const gradeBg    = score >= 75 ? "#d1fae5" : score >= 60 ? "#dbeafe" : score >= 45 ? "#fef3c7" : "#fee2e2";

  return (
    <div className="flex flex-col gap-4">

      {/* ① 게이지 + 요약 (Regime 도넛 카드와 동일 구조) */}
      <div className="grid gap-5 items-center bg-white border border-gray-200 rounded-xl px-6 py-5"
        style={{ gridTemplateColumns: "auto 1fr" }}>
        <CircleGauge score={score} />
        <div className="flex flex-col gap-2.5">
          <div className="flex gap-2 flex-wrap items-center">
            <span style={{ fontSize: 13, fontWeight: 700, padding: "3px 12px", borderRadius: 999, background: gradeBg, color: gradeColor, border: `1px solid ${gradeColor}40` }}>
              {grade}
            </span>
            {penaltyLabel && (
              <span className="flex items-center gap-1" style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: "#FEF3C7", color: "#92400E" }}>
                <AlertTriangle size={11} /> {penaltyLabel}
              </span>
            )}
          </div>
          <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.7, margin: 0 }}>{description}</p>
        </div>
      </div>

      {/* ② 강점/보완 카드 */}
      {cards.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5">
          {cards.map((card, i) => <StrengthWeaknessCard key={i} card={card} />)}
        </div>
      )}

      {/* ③ 세부 메트릭 바 */}
      {metrics.length > 0 && (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${metrics.length}, 1fr)` }}>
          {metrics.map((m) => <MetricCard key={m.key} item={m} />)}
        </div>
      )}

      {/* ④ 경고 */}
      {alertMessage && (
        <div className="flex gap-2.5 items-start rounded-lg px-3.5 py-2.5"
          style={{ background: "#FEF3C7", border: "1px solid #FCD34D" }}>
          <AlertTriangle size={15} color="#92400E" className="flex-shrink-0 mt-0.5" />
          <p style={{ fontSize: 13, lineHeight: 1.65, margin: 0, color: "#92400E" }}>{alertMessage}</p>
        </div>
      )}
    </div>
  );
}
