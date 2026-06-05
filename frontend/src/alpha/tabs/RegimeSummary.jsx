import React, { useState } from "react";

const REGIME_KO = {
  bull_quiet:        "상승장(안정)",
  bull_volatile:     "상승장(불안정)",
  bear:              "하락장",
  sideways:          "횡보장",
  high_vol_unstable: "고변동 불안정장",
};

const REGIME_COLOR = {
  bull_quiet:        { bar: "#22c55e", bg: "#f0fdf4", border: "#86efac", text: "#15803d", icon: "↗" },
  bull_volatile:     { bar: "#86efac", bg: "#f0fdf4", border: "#bbf7d0", text: "#166534", icon: "↗" },
  bear:              { bar: "#ef4444", bg: "#fef2f2", border: "#fca5a5", text: "#dc2626", icon: "↘" },
  sideways:          { bar: "#94a3b8", bg: "#f8fafc", border: "#e2e8f0", text: "#475569", icon: "→" },
  high_vol_unstable: { bar: "#f97316", bg: "#fffbeb", border: "#fde68a", text: "#b45309", icon: "⚡" },
};

function parseCurrentAdvice(narrative) {
  if (!narrative) return "";
  const m = narrative.match(/💡 현재 국면[^—]*— (.+)/s);
  return m ? m[1].trim() : "";
}

const KNOWN_KO = [
  { ko: "상승장(안정)",       key: "bull_quiet" },
  { ko: "상승장(불안정)",     key: "bull_volatile" },
  { ko: "고변동성 불안정장",  key: "high_vol_unstable" },
  { ko: "하락장",             key: "bear" },
  { ko: "횡보장",             key: "sideways" },
];

function parseNarrativeDist(narrative) {
  if (!narrative) return null;
  const result = {};
  for (const { ko, key } of KNOWN_KO) {
    const escaped = ko.replace(/[()]/g, "\\$&");
    const m = narrative.match(new RegExp(escaped + "\\((\\d+)일,\\s*(\\d+)%\\)"));
    if (m) result[key] = { days: parseInt(m[1]), pct: parseInt(m[2]) };
  }
  return Object.keys(result).length > 0 ? result : null;
}

function RegimeDonut({ items }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const SIZE = 120, SW = 12;
  const r = (SIZE - SW) / 2;
  const cx = SIZE / 2, cy = SIZE / 2;
  const C = 2 * Math.PI * r;
  const totalDays = items.reduce((s, it) => s + it.days, 0) || 1;

  let offset = 0;
  const slices = items.map((it) => {
    const dash = (it.days / totalDays) * C;
    const off = -offset;
    offset += dash;
    return { dash, off };
  });

  const hovered = hoverIdx != null ? items[hoverIdx] : null;

  return (
    <div className="grid gap-5 items-center bg-white border border-gray-200 rounded-xl px-6 py-5"
      style={{ gridTemplateColumns: "auto 1fr" }}>

      {/* 도넛 */}
      <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} fill="none">
          <circle cx={cx} cy={cy} r={r} stroke="#E2E8F0" strokeWidth={SW} fill="none" />
          {items.map((it, i) => {
            const { dash, off } = slices[i];
            return (
              <circle key={it.key}
                cx={cx} cy={cy} r={r} fill="none"
                stroke={it.color} strokeWidth={SW}
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={off}
                transform={`rotate(-90 ${cx} ${cy})`}
                opacity={hoverIdx != null && hoverIdx !== i ? 0.22 : 1}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                style={{ cursor: "pointer", transition: "opacity 0.15s ease" }}
              />
            );
          })}
        </svg>
        {/* 중앙 텍스트: "총 N일" */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, lineHeight: 1 }}>총</span>
          <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1, color: "#0f172a" }}>{totalDays}</span>
          <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, lineHeight: 1 }}>일</span>
        </div>
        {/* 호버 툴팁 */}
        {hovered && (
          <div className="absolute pointer-events-none z-20"
            style={{
              bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
              background: "#111827", color: "#fff", borderRadius: 9,
              padding: "8px 13px", fontSize: 12, lineHeight: 1.65,
              whiteSpace: "nowrap", boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}>
            <div className="flex items-center gap-1.5 mb-1">
              <span style={{ width: 8, height: 8, borderRadius: 2, background: hovered.color, flexShrink: 0, display: "inline-block" }} />
              <span className="font-bold">{hovered.label}</span>
            </div>
            <span className="text-white font-bold">{hovered.days}일</span>
            {" · "}
            <span className="text-white font-bold">{hovered.pct}%</span>
          </div>
        )}
      </div>

      {/* 우측: 누적 바 + 범례 */}
      <div className="flex flex-col gap-3">
        {/* 누적 가로 바 */}
        <div style={{ height: 14, borderRadius: 7, overflow: "hidden", display: "flex", width: "100%" }}>
          {items.map((it, i) => (
            <div key={it.key}
              style={{
                flex: it.days, height: "100%", background: it.color,
                opacity: hoverIdx != null && hoverIdx !== i ? 0.3 : 1,
                transition: "opacity 0.15s ease", cursor: "pointer",
              }}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            />
          ))}
        </div>
        {/* 범례 목록 */}
        <div className="flex flex-col gap-1.5">
          {items.map((it, i) => (
            <div key={it.key}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5"
              style={{
                background: hoverIdx === i ? it.bg : "transparent",
                cursor: "pointer", transition: "background 0.12s",
                opacity: hoverIdx != null && hoverIdx !== i ? 0.45 : 1,
              }}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: it.color, flexShrink: 0, display: "inline-block" }} />
              <span style={{ flex: 1, fontSize: 12, color: "#6b7280", fontWeight: 600 }}>{it.label}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: it.color, fontVariantNumeric: "tabular-nums" }}>{it.days}일</span>
              <span style={{ fontSize: 12, color: "#9ca3af", minWidth: 34, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{it.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function RegimeSummary({ data, theme }) {
  if (!data) return null;

  const perRegime = data.per_regime || {};
  const currentKey = data.current_regime;
  const currentKo = data.current_regime_ko || REGIME_KO[currentKey] || currentKey;
  const advice = parseCurrentAdvice(data.narrative);

  const narrativeDist = parseNarrativeDist(data.narrative);
  const donutItems = narrativeDist
    ? Object.entries(narrativeDist)
        .sort((a, b) => b[1].days - a[1].days)
        .map(([k, v]) => ({
          key: k,
          label: REGIME_KO[k] || k,
          days: v.days,
          pct: v.pct,
          color: REGIME_COLOR[k]?.bar || "#94a3b8",
          bg: REGIME_COLOR[k]?.bg || "#f8fafc",
          border: REGIME_COLOR[k]?.border || "#e2e8f0",
        }))
    : [];

  const validRegimes = Object.entries(perRegime).filter(([, v]) => v && !v.note && v.sharpe != null);
  const sorted = [...validRegimes].sort((a, b) =>
    (a[1].effective_sharpe ?? a[1].sharpe ?? 0) - (b[1].effective_sharpe ?? b[1].sharpe ?? 0)
  );
  const [worstKey, worstV] = sorted[0] || [];
  const [bestKey, bestV]   = sorted[sorted.length - 1] || [];
  const currentC = REGIME_COLOR[currentKey] || REGIME_COLOR.sideways;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ① 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 14px", borderRadius: 10,
        background: theme.codeBg, border: `1px solid ${theme.panelBorder}`,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8, flexShrink: 0,
          background: theme.accentSoft,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
        }}>📡</div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: theme.text }}>
            {data.ticker && <span>{data.ticker} </span>}시장 국면 분석 결과
          </div>
          <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
            MA200 + 60일 변동성 기준 · 5가지 국면 자동 분류
          </div>
        </div>
      </div>

      {/* ② 현재 국면 배너 */}
      {currentKey && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 12,
          padding: "14px 16px", borderRadius: 10,
          background: currentC.bg, border: `2px solid ${currentC.border}`,
        }}>
          <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{currentC.icon}</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: currentC.text, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
              현재 국면
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: currentC.text, marginBottom: advice ? 6 : 0 }}>
              {currentKo}
            </div>
            {advice && (
              <div style={{ fontSize: 14, color: theme.text, lineHeight: 1.7 }}>{advice}</div>
            )}
          </div>
        </div>
      )}

      {/* ③ 분석 기간 국면 분포 — 도넛 */}
      {donutItems.length > 0 && (
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", letterSpacing: 0.3, margin: "0 0 8px" }}>분석 기간 국면 분포</p>
          <RegimeDonut items={donutItems} />
        </div>
      )}

      {/* ④ 국면별 성과 (최고/최저) */}
      {(bestKey || worstKey) && (
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", letterSpacing: 0.3, margin: "0 0 8px" }}>국면별 성과</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>

            {/* 최고 카드 */}
            {bestKey && (() => {
              const c = REGIME_COLOR[bestKey] || REGIME_COLOR.bull_quiet;
              return (
                <div style={{
                  padding: "16px 18px", borderRadius: 12,
                  border: `2px solid ${c.bar}`,
                  background: c.bg,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.text, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
                    <span>{c.icon}</span> 최고 · {REGIME_KO[bestKey] || bestKey}
                  </div>
                  <div style={{ display: "flex", gap: 20, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 3 }}>Sharpe</div>
                      <div style={{ fontSize: 30, fontWeight: 700, color: c.text, lineHeight: 1 }}>{bestV.sharpe?.toFixed(2) ?? "—"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 3 }}>누적 수익</div>
                      <div style={{ fontSize: 30, fontWeight: 700, color: c.text, lineHeight: 1 }}>+{bestV.cumulative_return_pct?.toFixed(1) ?? "—"}%</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 14, color: theme.text, lineHeight: 1.65 }}>
                    {perRegime[bestKey]?.note || `이 전략이 ${REGIME_KO[bestKey]} 환경에서 가장 좋은 성과를 기록했습니다.`}
                  </div>
                </div>
              );
            })()}

            {/* 최저 카드 */}
            {worstKey && (() => {
              const c = REGIME_COLOR[worstKey] || REGIME_COLOR.bear;
              const isBear = worstKey === "bear";
              return (
                <div style={{
                  padding: "16px 18px", borderRadius: 12,
                  border: `2px solid ${c.border}`,
                  background: isBear ? "#fef2f2" : c.bg,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.text, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
                    <span>{c.icon}</span> 최저 · {REGIME_KO[worstKey] || worstKey}
                  </div>
                  <div style={{ display: "flex", gap: 20, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 3 }}>Sharpe</div>
                      <div style={{ fontSize: 30, fontWeight: 700, color: c.text, lineHeight: 1 }}>{worstV.sharpe?.toFixed(2) ?? "—"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 3 }}>MDD</div>
                      <div style={{ fontSize: 30, fontWeight: 700, color: c.text, lineHeight: 1 }}>{worstV.max_drawdown_pct?.toFixed(1) ?? "—"}%</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 14, color: theme.text, lineHeight: 1.65 }}>
                    이 구간에서는 포지션 규모를 줄이거나 손절 기준을 강화하는 것이 도움이 됩니다.
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
