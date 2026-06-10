import React, { useMemo, useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import ReactDOM from "react-dom";
import { BRAND_GRADIENT } from "../ThemeContext";

// ──────────────────────────────────────────────
// 공통 툴팁 아이콘 — portal 로 body 에 마운트해 transform/overflow 완전 우회
// ──────────────────────────────────────────────
export function TooltipIcon({ hint, width = 220 }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState(null);
  const anchorRef = useRef(null);
  const tooltipRef = useRef(null);

  const updatePosition = useCallback(() => {
    if (!anchorRef.current || !tooltipRef.current) return;
    const gap = 8;
    const pad = 8;
    const a = anchorRef.current.getBoundingClientRect();
    const t = tooltipRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // 오른쪽 먼저, 안 맞으면 왼쪽
    let left = a.right + gap;
    if (left + t.width > vw - pad) left = a.left - t.width - gap;
    left = Math.max(pad, Math.min(left, vw - t.width - pad));

    // 아이콘 수직 중앙 정렬
    let top = a.top + a.height / 2 - t.height / 2;
    top = Math.max(pad, Math.min(top, vh - t.height - pad));

    setPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!visible) return;

    updatePosition();
    const rafId = window.requestAnimationFrame(updatePosition);

    const handleViewportChange = () => updatePosition();
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [visible, updatePosition, hint, width]);

  const onEnter = () => setVisible(true);
  const onLeave = () => {
    setVisible(false);
    setPos(null);
  };

  const tooltipWidth = Math.max(160, Math.min(width, window.innerWidth - 24));
  const tooltip = visible && ReactDOM.createPortal(
    <div
      ref={tooltipRef}
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        background: "#ffffff",
        borderRadius: 10,
        padding: "10px 14px",
        zIndex: 99999,
        boxShadow: "0 6px 24px rgba(99,102,241,0.16), 0 0 0 1px #E0E7FF",
        width: tooltipWidth,
        boxSizing: "border-box",
        pointerEvents: "none",
        opacity: pos ? 1 : 0,
        transition: "opacity 0.12s ease",
      }}>
      <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "keep-all" }}>
        {hint}
      </div>
    </div>,
    document.body
  );

  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      <span
        ref={anchorRef}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onFocus={onEnter}
        onBlur={onLeave}
        tabIndex={0}
        aria-label={typeof hint === "string" ? hint : "도움말"}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 14, height: 14, borderRadius: "50%",
          background: "#22c55e", color: "white",
          fontSize: 8, fontWeight: 900, cursor: "help", flexShrink: 0,
          outline: "none",
        }}>!</span>
      {tooltip}
    </span>
  );
}

// ──────────────────────────────────────────────
// 기본 프리미티브
// ──────────────────────────────────────────────
export function Card({ title, children, theme, action, badge, titleSize = 13 }) {
  return (
    <div style={{
      background: theme.panel, border: `1px solid ${theme.panelBorder}`,
      borderRadius: 12, padding: 16, marginBottom: 12, backdropFilter: "blur(8px)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: titleSize, fontWeight: 800, color: theme.text }}>
          {title}{badge && <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 999, background: theme.accent, color: "white", fontSize: 10 }}>{badge}</span>}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export function Empty({ msg, theme }) {
  return <p style={{ fontSize: 12, color: theme.textMuted, margin: 0, fontStyle: "italic" }}>{msg}</p>;
}

export function Json({ value, theme }) {
  return (
    <pre style={{
      margin: 0, padding: 10, background: theme.codeBg, color: theme.code,
      borderRadius: 6, fontSize: 11, overflow: "auto", maxHeight: 400, lineHeight: 1.5,
    }}>{typeof value === "string" ? value : JSON.stringify(value, null, 2)}</pre>
  );
}

export function Stat({ label, value, unit = "", theme, positive, negative, hint }) {
  const v = typeof value === "number" ? value.toFixed(2) : (value ?? "—");
  let color = theme.text;
  if (positive && typeof value === "number" && value > 0) color = theme.success;
  if (negative && typeof value === "number" && value < 0) color = theme.danger;
  return (
    <div style={{ padding: 10, background: theme.codeBg, borderRadius: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted, display: "flex", alignItems: "center", gap: 3, marginBottom: 2 }}>
        {label}
        {hint && <TooltipIcon hint={hint} />}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{v}{unit}</div>
    </div>
  );
}

export function Row({ k, v, theme }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: theme.textMuted }}>{k}</span>
      <b style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{v}</b>
    </div>
  );
}

export function SubScoreBar({ label, value, theme }) {
  const KO = {
    generalization: "일반화 (OOS 일관성)",
    regime_robustness: "시장국면 견고성",
    parameter_stability: "파라미터 안정성",
    risk_control: "리스크 통제",
    statistical_confidence: "통계적 유의성",
  };
  const HINT = {
    generalization: "Walk-Forward 검증에서 과거 구간(In-Sample) 성과가 미래 구간(Out-of-Sample)에서도 유지되는지 측정합니다.\n\n과거에만 잘 맞춰진 과적합 전략일수록 점수가 낮아집니다. OOS Sharpe가 IS Sharpe와 가까울수록 높은 점수입니다.",
    regime_robustness: "상승·하락·횡보·고변동 4가지 시장 국면 중 '가장 안 좋은 국면'의 Sharpe로 평가합니다.\n\n특정 국면에만 강한 전략은 낮게 나옵니다. 모든 국면에서 고르게 방어적인 전략이 높은 점수를 받습니다.",
    parameter_stability: "주요 파라미터를 ±10% 흔들었을 때 Sharpe가 얼마나 안정적인지 측정합니다.\n\n파라미터 변화에 민감하면 운 좋은 설계일 가능성이 높아 낮은 점수를 받습니다.",
    risk_control: "목표 MDD 대비 실제 MDD 비율로 평가합니다.\n\n목표보다 손실이 작으면 높은 점수, 목표 MDD를 초과하면 낮은 점수를 받습니다.",
    statistical_confidence: "일별 수익률 평균이 0과 통계적으로 유의하게 다른지 t-statistic으로 측정합니다.\n\n시운(운)이 아닌 실증적 우위성이 있어야 높은 점수를 받습니다.",
  };
  const hint = HINT[label] || "";
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: theme.text, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
          {KO[label] || label}
          {hint && <TooltipIcon hint={hint} width={240} />}
        </span>
        <b style={{ fontSize: 13, fontWeight: 700, color: theme.accent }}>{value}/100</b>
      </div>
      <div style={{ height: 6, background: theme.codeBg, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: theme.accent, transition: "width 0.4s" }} />
      </div>
    </div>
  );
}

export function primaryBtn(theme, busy) {
  return {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "10px 16px", background: theme.accentGradient || theme.accent, color: "white", border: "none",
    borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: busy ? "wait" : "pointer",
    opacity: busy ? 0.7 : 1,
    boxShadow: "0 3px 10px rgba(59,130,246,0.25)",
  };
}

/**
 * 패널 상단 통합 헤더 — 그라데이션 제목 + 설명 + 우측 액션
 */
export function PanelHeader({ icon, title, description, action, theme }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{
            margin: 0, fontSize: 26, fontWeight: 900, lineHeight: 1.25, letterSpacing: -0.5,
            background: "linear-gradient(90deg, #1d4ed8, #4338ca, #6d28d9)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            display: "inline-flex", alignItems: "center", gap: 8,
          }}>
            {icon && <span style={{ WebkitTextFillColor: "initial" }}>{icon}</span>}
            {title}
          </h2>
          {description && (
            <p style={{ margin: "6px 0 0", fontSize: 14, color: theme.textMuted, lineHeight: 1.55 }}>
              {description}
            </p>
          )}
        </div>
        {action && <div style={{ flexShrink: 0 }}>{action}</div>}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// 차트 (SVG, 외부 의존성 없음)
// ──────────────────────────────────────────────

/**
 * 도넛 차트 — items: [{label, value, color}]
 */
export function DonutChart({ items, size = 180, thickness = 26, centerLabel, centerValue, theme, amountOf }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const arr = (items || []).filter((x) => x && Number(x.value) > 0);
  const sum = arr.reduce((s, x) => s + Number(x.value), 0) || 1;
  const cx = size / 2, cy = size / 2, r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  const slices = useMemo(() => {
    let offset = 0;
    return arr.map((it) => {
      const frac = Number(it.value) / sum;
      const dash = frac * C;
      const off = -offset;
      offset += dash;
      return { frac, dash, off };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arr.length, sum, C, JSON.stringify(arr.map(x => x.value))]);
  const hovered = hoverIdx != null ? arr[hoverIdx] : null;
  const hoveredPct = hovered ? (Number(hovered.value) / sum) * 100 : 0;
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", position: "relative" }}>
      <div style={{ position: "relative" }}>
        <svg width={size} height={size} style={{ display: "block" }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={theme?.codeBg || "#f1f5f9"} strokeWidth={thickness} />
          {arr.map((it, i) => {
            const { frac, dash, off } = slices[i] || { frac: 0, dash: 0, off: 0 };
            const isHover = hoverIdx === i;
            const dim = hoverIdx != null && !isHover;
            return (
              <circle
                key={i}
                cx={cx} cy={cy} r={r} fill="none"
                stroke={it.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={off}
                transform={`rotate(-90 ${cx} ${cy})`}
                opacity={dim ? 0.35 : 0.88}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                style={{ transition: "opacity .15s ease, stroke-dasharray .5s ease", cursor: "pointer" }}
              >
                <title>{`${it.label} · ${((frac) * 100).toFixed(1)}%`}</title>
              </circle>
            );
          })}
          <text x={cx} y={cy - 4} textAnchor="middle" fontSize={10} fill={theme?.textMuted || "#94a3b8"} style={{ pointerEvents: "none" }}>
            {centerLabel || "배분"}
          </text>
          <text x={cx} y={cy + 12} textAnchor="middle" fontSize={10} fontWeight={800} fill={theme?.text || "#0f172a"} style={{ pointerEvents: "none" }}>
            {centerValue || `${arr.length}종`}
          </text>
        </svg>
        {hovered && (
          <div style={{
            position: "absolute", top: -8, left: "50%", transform: "translate(-50%, -100%)",
            padding: "6px 10px", borderRadius: 6, background: "rgba(15,23,42,0.92)", color: "white",
            fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", pointerEvents: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)", zIndex: 10,
          }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: hovered.color, marginRight: 6 }} />
            {hovered.label} · {hoveredPct.toFixed(1)}%{amountOf && amountOf(hoveredPct) ? ` · ${amountOf(hoveredPct)}` : ""}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 120 }}>
        {arr.map((it, i) => {
          const pct = (Number(it.value) / sum) * 100;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: it.color, flexShrink: 0 }} />
              <span style={{ color: theme?.text, fontWeight: 700, flex: 1 }}>{it.label}</span>
              <span style={{ color: theme?.textMuted, fontVariantNumeric: "tabular-nums" }}>{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 추세 라인차트 — series: [{name, color, points: [{x:Date|number, y:number}]}]
 */
export function TrendLineChart({ series, height = 240, theme, toggleable = false, initialHidden = [] }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const [hidden, setHidden] = useState(() => new Set(initialHidden));   // 토글로 숨긴 시리즈 이름
  const [zoom, setZoom] = useState(null);   // {s,e} 보이는 인덱스 구간 (null = 전체)
  const [drag, setDrag] = useState(null);   // 드래그 브러시 {x0,x1} (viewBox px)
  const svgRef = useRef(null);
  const wheelHandlerRef = useRef(null);
  const W = 720, H = height, PADL = 56, PADR = 16, PADT = 16, PADB = 32;
  const valid = (series || []).filter((s) => s && Array.isArray(s.points) && s.points.length > 1);
  if (valid.length === 0) {
    return <div style={{ padding: 20, textAlign: "center", color: theme?.textMuted, fontSize: 12 }}>표시할 데이터가 없습니다.</div>;
  }
  const base = valid[0].points;
  const N = base.length;
  // 토글로 숨긴 시리즈 제외(전부 끄면 스케일 깨지지 않게 폴백)
  const drawn = (() => { const v = valid.filter((s) => !hidden.has(s.name)); return v.length ? v : valid; })();
  // 보이는 인덱스 구간(줌). 줌하면 Y축도 해당 구간 기준으로 재스케일 → 디테일이 확대된다.
  const vs = zoom ? Math.max(0, Math.min(zoom.s, N - 2)) : 0;
  const ve = zoom ? Math.min(N - 1, Math.max(zoom.e, vs + 1)) : N - 1;
  const span = Math.max(1, ve - vs);
  let yMin = Infinity, yMax = -Infinity;
  drawn.forEach((s) => {
    for (let i = vs; i <= ve; i++) {
      const y = s.points[i]?.y;
      if (y == null || Number.isNaN(y)) continue;
      if (y < yMin) yMin = y;
      if (y > yMax) yMax = y;
    }
  });
  if (!isFinite(yMin) || !isFinite(yMax)) return null;
  const yPad = (yMax - yMin) * 0.05 || 1;
  yMin -= yPad; yMax += yPad;
  const plotW = W - PADL - PADR;
  const xAt = (i) => PADL + ((i - vs) / span) * plotW;
  const yAt = (v) => PADT + (1 - (v - yMin) / (yMax - yMin)) * (H - PADT - PADB);
  const pathFor = (pts) => {
    let d = "", move = true;
    for (let i = vs; i <= ve; i++) {
      const p = pts[i];
      if (!p || p.y == null || Number.isNaN(p.y)) { move = true; continue; }
      d += `${move ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(p.y).toFixed(1)} `;
      move = false;
    }
    return d.trim();
  };
  const xTicks = Array.from({ length: 5 }, (_, k) => Math.round(vs + (k * span) / 4));
  const yTicks = 4;

  // 휠 핸들러 ref — 클로저 스테일 없이 항상 최신 vs/ve/span/N 참조
  wheelHandlerRef.current = (e) => {
    e.preventDefault();
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vbX = ((e.clientX - rect.left) / rect.width) * W;
    const mouseIdx = Math.max(vs, Math.min(ve, Math.round(vs + ((vbX - PADL) / plotW) * span)));
    const factor = e.deltaY > 0 ? 1.3 : 0.77; // 휠 다운 = 축소, 휠 업 = 확대
    const newSpan = Math.round(span * factor);
    if (newSpan < 2) return;
    const f = span === 0 ? 0.5 : (mouseIdx - vs) / span;
    let ns = Math.round(mouseIdx - f * newSpan);
    let ne = ns + newSpan;
    if (ns < 0) { ne = Math.min(N - 1, ne - ns); ns = 0; }
    if (ne > N - 1) { ns = Math.max(0, ns - (ne - (N - 1))); ne = N - 1; }
    if (ne - ns < 2) return;
    if (ns <= 0 && ne >= N - 1) setZoom(null);
    else setZoom({ s: ns, e: ne });
  };

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handler = (e) => wheelHandlerRef.current(e);
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const toVbX = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return ((e.clientX - rect.left) / rect.width) * W;
  };
  const pxToIdx = (px) => Math.max(vs, Math.min(ve, Math.round(vs + ((px - PADL) / plotW) * span)));
  const onDown = (e) => setDrag({ x0: toVbX(e), x1: toVbX(e) });
  const onMove = (e) => {
    const px = toVbX(e);
    if (drag) setDrag((d) => (d ? { ...d, x1: px } : d));
    setHoverIdx(pxToIdx(px));
  };
  const onUp = () => {
    if (drag) {
      const a = pxToIdx(Math.min(drag.x0, drag.x1));
      const b = pxToIdx(Math.max(drag.x0, drag.x1));
      if (b - a >= 2) setZoom({ s: a, e: b });   // 최소 폭 확보(단순 클릭 오작동 방지)
      setDrag(null);
    }
  };
  const onLeave = () => { setHoverIdx(null); setDrag(null); };
  const resetZoom = () => setZoom(null);
  const zoomed = zoom != null;
  const fmt = (v) => (v == null ? "—" : v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : v.toFixed(2));
  // Y축 라벨은 큰 값(수억 단위)이 잘리지 않게 compact(K/M/B) 표기.
  const fmtAxis = (v) => {
    if (v == null || Number.isNaN(v)) return "";
    const a = Math.abs(v);
    if (a >= 1e9) return (v / 1e9).toFixed(a >= 1e10 ? 0 : 1) + "B";
    if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "M";
    if (a >= 1e3) return (v / 1e3).toFixed(a >= 1e4 ? 0 : 1) + "K";
    return v.toFixed(a < 10 ? 2 : 0);
  };
  return (
    <div style={{ position: "relative", width: "100%" }}>
      {zoomed && (
        <button onClick={resetZoom}
          title="전체 구간 보기 (더블클릭도 가능)"
          style={{
            position: "absolute", top: 2, right: 2, zIndex: 2,
            padding: "3px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer",
            background: theme?.accent || "#3b82f6", color: "#fff", border: "none", borderRadius: 6,
          }}>⤢ 전체보기</button>
      )}
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%"
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onLeave} onDoubleClick={resetZoom}
        style={{ cursor: drag ? "col-resize" : "crosshair", display: "block", userSelect: "none" }}>
        {Array.from({ length: yTicks + 1 }, (_, k) => {
          const v = yMin + ((yMax - yMin) * k) / yTicks;
          const y = yAt(v);
          return (
            <g key={k}>
              <line x1={PADL} x2={W - PADR} y1={y} y2={y} stroke={theme?.panelBorder || "#e2e8f0"} strokeWidth={0.6} />
              <text x={PADL - 6} y={y + 3} textAnchor="end" fontSize={10} fill={theme?.textMuted || "#94a3b8"}>{fmtAxis(v)}</text>
            </g>
          );
        })}
        {xTicks.map((i, ki) => {
          const lbl = base[i]?.x;
          const label = lbl instanceof Date ? `${lbl.getFullYear()}.${String(lbl.getMonth() + 1).padStart(2, "0")}` :
            (typeof lbl === "string" ? lbl.slice(0, 7) : String(lbl ?? ""));
          const anchor = ki === 0 ? "start" : ki === xTicks.length - 1 ? "end" : "middle";
          return (
            <text key={i} x={xAt(i)} y={H - 10} textAnchor={anchor} fontSize={10} fill={theme?.textMuted || "#94a3b8"}>{label}</text>
          );
        })}
        {drawn.map((s, idx) => {
          const firstIdx = s.points.findIndex(p => p.y != null && !Number.isNaN(p.y));
          const firstPt = firstIdx >= vs && firstIdx <= ve ? s.points[firstIdx] : null;
          return firstPt ? (
            <circle key={`start-${idx}`} cx={xAt(firstIdx)} cy={yAt(firstPt.y)} r={2.5} fill={s.color} />
          ) : null;
        })}
        {drawn.map((s, idx) => (
          <path key={idx} d={pathFor(s.points)} fill="none" stroke={s.color} strokeWidth={s.width || 1.8}
            strokeDasharray={s.dash || undefined} opacity={s.opacity ?? 0.95}>
            <title>{s.name}</title>
          </path>
        ))}
        {drag && Math.abs(drag.x1 - drag.x0) > 1 && (
          <rect x={Math.min(drag.x0, drag.x1)} y={PADT} width={Math.abs(drag.x1 - drag.x0)} height={H - PADT - PADB}
            fill={theme?.accent || "#3b82f6"} opacity={0.12} stroke={theme?.accent || "#3b82f6"} strokeWidth={0.5} />
        )}
        {hoverIdx != null && !drag && (
          <line x1={xAt(hoverIdx)} x2={xAt(hoverIdx)} y1={PADT} y2={H - PADB} stroke={theme?.accent || "#3b82f6"} strokeDasharray="3 3" strokeWidth={1} opacity={0.7} />
        )}
        {hoverIdx != null && !drag && drawn.map((s, idx) => {
          const p = s.points[hoverIdx];
          if (!p || p.y == null) return null;
          return <circle key={idx} cx={xAt(hoverIdx)} cy={yAt(p.y)} r={3.5} fill={s.color} stroke="white" strokeWidth={1.5} />;
        })}
      </svg>

      {/* image2 식 검정 호버 툴팁 — 그날의 날짜 + 각 라인 값 */}
      {hoverIdx != null && !drag && (() => {
        const lbl = base[hoverIdx]?.x;
        const dateStr = lbl instanceof Date ? lbl.toISOString().slice(0, 10) : String(lbl ?? "");
        const leftPct = (xAt(hoverIdx) / W) * 100;
        const flip = leftPct > 60;
        return (
          <div style={{
            position: "absolute", top: 12, left: `${leftPct}%`,
            transform: flip ? "translateX(-100%) translateX(-14px)" : "translateX(14px)",
            background: "#111827", color: "#fff", borderRadius: 9, padding: "8px 12px",
            fontSize: 11.5, lineHeight: 1.55, boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            pointerEvents: "none", zIndex: 4, minWidth: 150, border: "1px solid rgba(255,255,255,0.12)",
          }}>
            <div style={{ fontWeight: 800, marginBottom: 6, fontSize: 12.5 }}>{dateStr}</div>
            {drawn.map((s, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                <span style={{ color: "#cbd5e1" }}>{s.name}</span>
                <span style={{ marginLeft: "auto", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmt(s.points[hoverIdx]?.y)}</span>
              </div>
            ))}
          </div>
        );
      })()}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6, fontSize: 11, alignItems: "center" }}>
        {valid.map((s, idx) => {
          const off = hidden.has(s.name);
          // 값·날짜는 호버 말풍선이 보여주므로 범례엔 표시 안 함(보조선 토글 칩만 슬림하게).
          const inner = (
            <>
              <span style={{ width: 14, height: 3, background: s.color, borderRadius: 2, opacity: off ? 0.45 : 1 }} />
              <b style={{ textDecoration: off ? "line-through" : "none" }}>{s.name}</b>
            </>
          );
          if (!toggleable) {
            return <span key={idx} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: theme?.text }}>{inner}</span>;
          }
          return (
            <button key={idx} type="button"
              onClick={() => setHidden((h) => { const n = new Set(h); n.has(s.name) ? n.delete(s.name) : n.add(s.name); return n; })}
              title={off ? "표시" : "숨기기"}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, color: theme?.text,
                background: off ? "transparent" : (theme?.panelAlt || "rgba(59,130,246,0.06)"),
                border: `1px solid ${theme?.panelBorder || "#e2e8f0"}`, borderRadius: 999, padding: "3px 10px",
                cursor: "pointer", opacity: off ? 0.55 : 1, fontSize: 11, lineHeight: 1,
              }}>{inner}</button>
          );
        })}
        <span style={{ marginLeft: "auto", color: theme?.textMuted, fontSize: 10, whiteSpace: "nowrap" }}>
          {zoomed ? `🔍 ${span + 1}개 구간 확대됨 · 더블클릭/전체보기로 해제`
            : (toggleable ? "범례 클릭=보조선 토글 · 휠 확대 · 드래그 구간선택 🔍" : "휠로 확대/축소 · 드래그로 구간 선택 🔍")}
        </span>
      </div>
    </div>
  );
}

/**
 * 단순 이동평균. null/NaN은 건너뜀.
 */
export function calcSMA(values, window) {
  const out = new Array(values.length).fill(null);
  let sum = 0, cnt = 0;
  const buf = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v != null && !Number.isNaN(v)) { sum += v; buf.push(v); cnt++; } else { buf.push(null); }
    if (buf.length > window) {
      const old = buf.shift();
      if (old != null) { sum -= old; cnt--; }
    }
    if (buf.length === window && cnt >= window * 0.7) out[i] = sum / cnt;
  }
  return out;
}

/** 지수 이동평균(EMA). window 만큼 단순평균으로 시드 후 가중. */
export function calcEMA(values, window) {
  const out = new Array(values.length).fill(null);
  const k = 2 / (window + 1);
  let ema = null, seedSum = 0, seeded = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null || Number.isNaN(v)) { out[i] = ema; continue; }
    if (ema == null) {
      seedSum += v; seeded++;
      if (seeded >= window) { ema = seedSum / seeded; out[i] = ema; }
    } else {
      ema = v * k + ema * (1 - k);
      out[i] = ema;
    }
  }
  return out;
}

/** 볼린저밴드: 중간=SMA(window), 상/하 = ±mult·표준편차. {mid, upper, lower} 반환. */
export function calcBollinger(values, window = 20, mult = 2) {
  const mid = calcSMA(values, window);
  const upper = new Array(values.length).fill(null);
  const lower = new Array(values.length).fill(null);
  for (let i = 0; i < values.length; i++) {
    if (mid[i] == null) continue;
    let sum = 0, cnt = 0;
    for (let j = Math.max(0, i - window + 1); j <= i; j++) {
      const v = values[j];
      if (v == null || Number.isNaN(v)) continue;
      sum += (v - mid[i]) ** 2; cnt++;
    }
    if (cnt > 1) {
      const sd = Math.sqrt(sum / cnt);
      upper[i] = mid[i] + mult * sd;
      lower[i] = mid[i] - mult * sd;
    }
  }
  return { mid, upper, lower };
}

/** RSI(Wilder). values 는 종가/에쿼티 값. 0~100. */
export function calcRSI(values, period = 14) {
  const out = new Array(values.length).fill(null);
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i < values.length; i++) {
    const a = values[i], b = values[i - 1];
    if (a == null || b == null || Number.isNaN(a) || Number.isNaN(b)) { out[i] = out[i - 1]; continue; }
    const ch = a - b, g = ch > 0 ? ch : 0, l = ch < 0 ? -ch : 0;
    if (i <= period) {
      avgGain += g; avgLoss += l;
      if (i === period) { avgGain /= period; avgLoss /= period; out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss); }
    } else {
      avgGain = (avgGain * (period - 1) + g) / period;
      avgLoss = (avgLoss * (period - 1) + l) / period;
      out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
  }
  return out;
}

/** MACD = EMA(fast)-EMA(slow), signal=EMA(macd), hist=macd-signal. */
export function calcMACD(values, fast = 12, slow = 26, signalP = 9) {
  const ef = calcEMA(values, fast), es = calcEMA(values, slow);
  const macd = values.map((_, i) => (ef[i] != null && es[i] != null) ? ef[i] - es[i] : null);
  const signal = calcEMA(macd.map((v) => (v == null ? NaN : v)), signalP);
  const hist = macd.map((v, i) => (v != null && signal[i] != null) ? v - signal[i] : null);
  return { macd, signal, hist };
}

/** Stochastic — 단일 값 시리즈라 롤링 min/max 를 저/고가 대용으로. {k,d}, 0~100. */
export function calcStochastic(values, kPeriod = 14, dPeriod = 3) {
  const k = new Array(values.length).fill(null);
  for (let i = kPeriod - 1; i < values.length; i++) {
    let lo = Infinity, hi = -Infinity, ok = true;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      const v = values[j];
      if (v == null || Number.isNaN(v)) { ok = false; break; }
      if (v < lo) lo = v; if (v > hi) hi = v;
    }
    if (ok) k[i] = hi === lo ? 50 : ((values[i] - lo) / (hi - lo)) * 100;
  }
  const d = calcSMA(k.map((v) => (v == null ? NaN : v)), dPeriod);
  return { k, d };
}

/**
 * 하단 보조지표 패널(RSI / MACD / Stochastic) — 메인 차트와 같은 x축 폭, 자체 호버 툴팁.
 * 삼성 mPOP 식 서브패널. kind: "rsi" | "macd" | "stoch".
 */
export function SubIndicatorChart({ kind, values, dates, theme, height = 104 }) {
  const [hi, setHi] = useState(null);
  const W = 720, PADL = 56, PADR = 16, PADT = 12, PADB = 18;
  const N = (values || []).length;
  if (N < 3) return null;

  let lines = [], bars = null, guides = [], zero = false, yMin = 0, yMax = 100, title = "";
  if (kind === "rsi") {
    lines = [{ name: "RSI(14)", color: "#a78bfa", data: calcRSI(values, 14) }];
    guides = [30, 50, 70]; title = "RSI";
  } else if (kind === "stoch") {
    const { k, d } = calcStochastic(values, 14, 3);
    lines = [{ name: "%K", color: "#3b82f6", data: k }, { name: "%D", color: "#f59e0b", data: d }];
    guides = [20, 50, 80]; title = "Stochastic";
  } else {
    const { macd, signal, hist } = calcMACD(values, 12, 26, 9);
    lines = [{ name: "MACD", color: "#3b82f6", data: macd }, { name: "Signal", color: "#f59e0b", data: signal }];
    bars = hist; zero = true; title = "MACD";
    let lo = Infinity, hr = -Infinity;
    [macd, signal, hist].forEach((a) => a.forEach((v) => { if (v != null && !Number.isNaN(v)) { if (v < lo) lo = v; if (v > hr) hr = v; } }));
    if (!isFinite(lo)) { lo = -1; hr = 1; }
    const pad = (hr - lo) * 0.1 || 1; yMin = lo - pad; yMax = hr + pad;
  }
  const plotW = W - PADL - PADR, plotH = height - PADT - PADB;
  const xAt = (i) => PADL + (N <= 1 ? 0 : (i / (N - 1)) * plotW);
  const yAt = (v) => PADT + (1 - (v - yMin) / (yMax - yMin)) * plotH;
  const pathFor = (arr) => { let d = "", m = true; for (let i = 0; i < N; i++) { const v = arr[i]; if (v == null || Number.isNaN(v)) { m = true; continue; } d += `${m ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)} `; m = false; } return d.trim(); };
  const onMove = (e) => { const r = e.currentTarget.getBoundingClientRect(); const vx = ((e.clientX - r.left) / r.width) * W; setHi(Math.max(0, Math.min(N - 1, Math.round(((vx - PADL) / plotW) * (N - 1))))); };
  const fmt = (v) => (v == null || Number.isNaN(v) ? "—" : Number(v).toFixed(2));
  const bw = Math.max(0.6, (plotW / N) * 0.6);
  const dateStr = (i) => { const dx = dates?.[i]; return dx instanceof Date ? dx.toISOString().slice(0, 10) : String(dx ?? ""); };

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: theme?.textMuted, margin: "2px 0 1px 2px" }}>{title}</div>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" onMouseMove={onMove} onMouseLeave={() => setHi(null)}
        style={{ cursor: "crosshair", display: "block" }}>
        {guides.map((g) => (
          <g key={g}>
            <line x1={PADL} x2={W - PADR} y1={yAt(g)} y2={yAt(g)} stroke={theme?.panelBorder || "#e2e8f0"} strokeWidth={0.6} strokeDasharray={g === 50 ? "" : "3 3"} />
            <text x={PADL - 5} y={yAt(g) + 3} textAnchor="end" fontSize={9} fill={theme?.textMuted || "#94a3b8"}>{g}</text>
          </g>
        ))}
        {zero && <line x1={PADL} x2={W - PADR} y1={yAt(0)} y2={yAt(0)} stroke={theme?.panelBorder || "#e2e8f0"} strokeWidth={0.8} />}
        {bars && bars.map((v, i) => (v == null || Number.isNaN(v)) ? null : (
          <rect key={i} x={xAt(i) - bw / 2} y={Math.min(yAt(0), yAt(v))} width={bw} height={Math.abs(yAt(v) - yAt(0))}
            fill={v >= 0 ? "#10b981" : "#ef4444"} opacity={0.5} />
        ))}
        {lines.map((ln, idx) => <path key={idx} d={pathFor(ln.data)} fill="none" stroke={ln.color} strokeWidth={1.4} opacity={0.95} />)}
        {hi != null && <line x1={xAt(hi)} x2={xAt(hi)} y1={PADT} y2={height - PADB} stroke={theme?.accent || "#3b82f6"} strokeDasharray="3 3" strokeWidth={1} opacity={0.6} />}
        {hi != null && lines.map((ln, idx) => (ln.data[hi] == null || Number.isNaN(ln.data[hi])) ? null : (
          <circle key={idx} cx={xAt(hi)} cy={yAt(ln.data[hi])} r={3} fill={ln.color} stroke="#fff" strokeWidth={1.2} />
        ))}
      </svg>
      {hi != null && (() => {
        const leftPct = (xAt(hi) / W) * 100, flip = leftPct > 60;
        return (
          <div style={{
            position: "absolute", top: 14, left: `${leftPct}%`,
            transform: flip ? "translateX(-100%) translateX(-12px)" : "translateX(12px)",
            background: "#111827", color: "#fff", borderRadius: 8, padding: "6px 10px", fontSize: 11, lineHeight: 1.5,
            boxShadow: "0 6px 18px rgba(0,0,0,0.4)", pointerEvents: "none", zIndex: 4, minWidth: 120, border: "1px solid rgba(255,255,255,0.12)",
          }}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>{dateStr(hi)}</div>
            {lines.map((ln, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: ln.color }} />
                <span style={{ color: "#cbd5e1" }}>{ln.name}</span>
                <span style={{ marginLeft: "auto", fontWeight: 700 }}>{fmt(ln.data[hi])}</span>
              </div>
            ))}
            {bars && <div style={{ marginTop: 2, color: "#94a3b8" }}>Hist: <b style={{ color: bars[hi] >= 0 ? "#10b981" : "#ef4444" }}>{fmt(bars[hi])}</b></div>}
          </div>
        );
      })()}
    </div>
  );
}

/**
 * hover 시 설명 툴팁이 뜨는 라벨.
 */
export function HelpLabel({ children, hint, theme }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      {children}
      {hint && <TooltipIcon hint={hint} />}
    </span>
  );
}

/**
 * Trust details — Walk-Forward / Regime / Parameter / Statistical 친화적 카드 표시
 */
export function TrustDetailsCard({ details, theme }) {
  const [activeTab, setActiveTab] = useState(null);
  if (!details || typeof details !== "object") return null;

  const wf = details.walk_forward || details.walkForward || details.wf;
  const rg = details.regime || details.regime_robustness;
  const pr = details.parameter || details.parameter_stability;
  const rk = details.risk || details.risk_control;
  const st = details.statistical || details.statistical_confidence;
  const num = (v, d = 2) => (typeof v === "number" ? v.toFixed(d) : (v ?? "-"));
  const pct = (v) => (typeof v === "number" ? `${v.toFixed(2)}%` : (v ?? "-"));

  const TAB_DESC = {
    wf: {
      summary: "\"과거에 잘됐던 전략이 미래에도 통할까?\"를 직접 확인하는 검증입니다.",
      detail: "전체 데이터를 훈련 구간(IS)과 검증 구간(OOS)으로 나눠, 훈련에 사용하지 않은 미래 데이터에서 성과를 측정합니다. IS Sharpe와 OOS Sharpe가 비슷할수록 좋고, Gap(차이)이 클수록 과거 데이터에만 과도하게 맞춰진 과적합 전략일 가능성이 높습니다.",
    },
    rg: {
      summary: "\"어떤 시장 환경에서도 버틸 수 있는 전략인가?\"를 확인합니다.",
      detail: "상승장·하락장·횡보장·고변동 4가지 국면으로 나눠 각각 백테스트합니다. 최악의 국면(취약 국면)에서의 Sharpe가 핵심 지표로, 이 값이 낮을수록 특정 장세에 쏠린 전략입니다. 국면 분산(Sharpe 표준편차)이 작을수록 모든 환경에서 고르게 작동합니다.",
    },
    pr: {
      summary: "\"설정값을 조금만 바꿔도 결과가 확 바뀌진 않나?\"를 점검합니다.",
      detail: "RSI 기간, SMA 윈도우 같은 주요 파라미터를 ±10% 범위에서 흔들어 봤을 때 Sharpe가 얼마나 변하는지 측정합니다. 민감도와 Sharpe 범위가 작을수록 특정 수치에 우연히 최적화된 게 아닌, 구조적으로 탄탄한 전략입니다.",
    },
    rk: {
      summary: "\"손실이 처음 목표한 한도 안에서 관리됐나?\"를 확인합니다.",
      detail: "목표 MDD(허용 최대 손실폭)와 실제 백테스트에서 발생한 MDD를 비교합니다. 달성 비율이 1.0 이하면 목표한 리스크 한도를 지킨 것이고, 1.0 초과면 예상보다 손실이 컸다는 의미입니다. 실제 MDD가 낮을수록 안전한 전략입니다.",
    },
    st: {
      summary: "\"이 전략의 수익이 그냥 운인지, 실력인지\"를 수치로 검증합니다.",
      detail: "일별 수익률의 평균이 0보다 유의미하게 큰지를 t-검정으로 확인합니다. t-statistic 절댓값이 2 이상이면 '통계적으로 유의한 수익'으로 봅니다. PSR(확률적 Sharpe Ratio)이 높을수록 이 수익이 우연이 아닌 진짜 전략적 우위에서 나왔을 가능성이 큽니다.",
    },
  };

  const TABS = [
    { key: "wf", emoji: "🚶", label: "Walk-Forward", color: "#3b82f6", soft: "#DBEAFE", data: wf },
    { key: "rg", emoji: "🌐", label: "시장국면",      color: "#22c55e", soft: "#D1FAE5", data: rg },
    { key: "pr", emoji: "🎛",  label: "파라미터",     color: "#f59e0b", soft: "#FEF3C7", data: pr },
    { key: "rk", emoji: "🛡",  label: "리스크",       color: "#10b981", soft: "#D1FAE5", data: rk },
    { key: "st", emoji: "📐", label: "통계",          color: "#8b5cf6", soft: "#EDE9FE", data: st },
  ].filter(t => t.data);

  const current = activeTab ?? (TABS[0]?.key || null);
  const active = TABS.find(t => t.key === current) || TABS[0];

  const kStyle = { fontSize: 12, fontWeight: 700, color: theme.textMuted, marginBottom: 2, display: "flex", alignItems: "center", gap: 4 };
  const vStyle = { fontSize: 22, fontWeight: 700, color: theme.text, lineHeight: 1.2, marginBottom: 8 };

  const renderContent = () => {
    if (!active) return null;
    const d = active.data;
    if (active.key === "wf") return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[
          { label: "IS Sharpe",   hint: "In-Sample(과거 훈련구간) Sharpe",                                           val: num(d.is_sharpe ?? d.in_sample_sharpe) },
          { label: "OOS Sharpe",  hint: "Out-of-Sample(미래 검증구간) Sharpe — 진짜 일반화 성능",                    val: num(d.oos_sharpe ?? d.out_of_sample_sharpe) },
          { label: "IS↔OOS 차이", hint: "IS와 OOS 차이. 0에 가까울수록 일반화 잘됨, 크면 과적합",                   val: num(d.gap ?? d.train_oos_gap) },
        ].map(({ label, hint, val }) => (
          <div key={label} style={{ padding: "14px 16px", borderRadius: 10, background: active.soft, border: `1px solid ${active.color}30` }}>
            <div style={kStyle}><HelpLabel hint={hint} theme={theme}>{label}</HelpLabel></div>
            <div style={{ ...vStyle, color: active.color }}>{val}</div>
          </div>
        ))}
        {d.detail && !d.oos_sharpe && <div style={{ gridColumn: "1/-1", fontSize: 13, color: theme.textMuted, lineHeight: 1.65 }}>{d.detail}</div>}
      </div>
    );
    if (active.key === "rg") return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[
          { label: "취약 국면",  hint: "4가지 국면 중 가장 약했던 국면 이름",                  val: d.weakest ?? d.weakest_regime ?? "-" },
          { label: "최약 Sharpe",hint: "가장 약한 국면의 Sharpe",                               val: num(d.weakest_sharpe ?? d.min_sharpe) },
          { label: "국면 분산",  hint: "국면 간 Sharpe 표준편차 — 작을수록 모든 시장에서 균일", val: num(d.sharpe_std ?? d.dispersion) },
        ].map(({ label, hint, val }) => (
          <div key={label} style={{ padding: "14px 16px", borderRadius: 10, background: active.soft, border: `1px solid ${active.color}30` }}>
            <div style={kStyle}><HelpLabel hint={hint} theme={theme}>{label}</HelpLabel></div>
            <div style={{ ...vStyle, color: active.color }}>{val}</div>
          </div>
        ))}
      </div>
    );
    if (active.key === "pr") return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        {[
          { label: "민감도",     hint: "파라미터 ±10% 변경 시 Sharpe 변화의 크기. 작을수록 안정",   val: num(d.sensitivity) },
          { label: "Sharpe 범위",hint: "흔든 파라미터 조합에서의 Sharpe 범위(최대-최소)",           val: num(d.sharpe_range ?? d.range) },
        ].map(({ label, hint, val }) => (
          <div key={label} style={{ padding: "14px 16px", borderRadius: 10, background: active.soft, border: `1px solid ${active.color}30` }}>
            <div style={kStyle}><HelpLabel hint={hint} theme={theme}>{label}</HelpLabel></div>
            <div style={{ ...vStyle, color: active.color }}>{val}</div>
          </div>
        ))}
      </div>
    );
    if (active.key === "rk") return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[
          { label: "실제 MDD", hint: "실제 MDD (낮을수록 좋음)",                           val: pct(d.actual_mdd ?? d.mdd) },
          { label: "목표 MDD", hint: "목표 MDD 한도",                                      val: pct(d.target_mdd) },
          { label: "달성 비율",hint: "실제/목표 비율. 1.0 이하면 목표 안에서 잘 통제",     val: num(d.ratio, 2) },
        ].map(({ label, hint, val }) => (
          <div key={label} style={{ padding: "14px 16px", borderRadius: 10, background: active.soft, border: `1px solid ${active.color}30` }}>
            <div style={kStyle}><HelpLabel hint={hint} theme={theme}>{label}</HelpLabel></div>
            <div style={{ ...vStyle, color: active.color }}>{val}</div>
          </div>
        ))}
      </div>
    );
    if (active.key === "st") return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[
          { label: "t-statistic",    hint: "일별 수익률 평균이 0과 다른지 검정한 t-통계량 (절댓값 2 이상이면 유의)",           val: num(d.t_stat ?? d.t_statistic ?? d.tstat) },
          { label: "PSR (SR>0 확률)",hint: "PSR(확률적 Sharpe Ratio) — 수익이 우연이 아닐 확률. 높을수록 실력에 의한 수익",    val: d.psr_zero != null ? `${(d.psr_zero * 100).toFixed(1)}%` : "-" },
          { label: "표본 수",        hint: "표본 수 (거래일 수)",                                                               val: d.n_samples ?? d.n ?? d.data_points ?? "-" },
        ].map(({ label, hint, val }) => (
          <div key={label} style={{ padding: "14px 16px", borderRadius: 10, background: active.soft, border: `1px solid ${active.color}30` }}>
            <div style={kStyle}><HelpLabel hint={hint} theme={theme}>{label}</HelpLabel></div>
            <div style={{ ...vStyle, color: active.color }}>{val}</div>
          </div>
        ))}
        {d.detail && <div style={{ gridColumn: "1/-1", fontSize: 13, color: theme.textMuted, lineHeight: 1.65 }}>{d.detail}</div>}
      </div>
    );
    return null;
  };

  if (!TABS.length) return null;

  return (
    <Card title="🔍 검증 상세" theme={theme} titleSize={20}>
      {/* 탭 바 — Home 헬릭스 설명 스타일 */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${TABS.length}, 1fr)`, borderBottom: "1.5px solid #E2E8F0", marginBottom: 0 }}>
        {TABS.map(t => {
          const isActive = t.key === current;
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "11px 8px", border: "none",
              background: isActive ? `linear-gradient(135deg, ${t.soft} 0%, ${t.soft}cc 100%)` : "transparent",
              fontSize: 14, fontWeight: isActive ? 700 : 500,
              color: isActive ? t.color : "#64748b",
              cursor: "pointer",
              borderBottom: `2px solid ${isActive ? t.color : "transparent"}`,
              borderTopLeftRadius: 6, borderTopRightRadius: 6,
              marginBottom: -1.5, transition: "color 0.15s, background 0.2s",
              whiteSpace: "nowrap",
            }}>
              <span>{t.emoji}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* 탭 콘텐츠 */}
      {active && (
        <div style={{
          background: "white", border: "1.5px solid #E2E8F0", borderTop: "none",
          borderRadius: "0 0 12px 12px", overflow: "hidden",
          boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
        }}>
          <div style={{ height: 3, background: `linear-gradient(90deg, ${active.color}, ${active.color}55)` }} />
          <div style={{ padding: "20px 18px" }}>
            {TAB_DESC[active.key] && (
              <div style={{ marginBottom: 18 }}>
                <p style={{
                  margin: "0 0 6px",
                  fontSize: 15, fontWeight: 700, color: "#0f172a", lineHeight: 1.5,
                }}>
                  {TAB_DESC[active.key].summary}
                </p>
                <p style={{
                  margin: 0,
                  fontSize: 13, color: "#64748b", lineHeight: 1.8, wordBreak: "keep-all",
                }}>
                  {TAB_DESC[active.key].detail}
                </p>
              </div>
            )}
            {renderContent()}
          </div>
        </div>
      )}
    </Card>
  );
}

// ──────────────────────────────────────────────
// 레짐 색상 상수 (백엔드와 동일하게 유지)
// ──────────────────────────────────────────────
export const REGIME_COLORS = {
  bull_quiet: "#22c55e",
  bull_volatile: "#86efac",
  bear: "#ef4444",
  sideways: "#94a3b8",
  high_vol_unstable: "#f97316",
};

const REGIME_KO = {
  bull_quiet: "상승장(안정)",
  bull_volatile: "상승장(불안정)",
  bear: "하락장",
  sideways: "횡보장",
  high_vol_unstable: "고변동성 불안정장",
};

/**
 * 레짐 타임라인 차트 — SVG 기반
 * timeline: [{date, regime, close}] (백엔드 regime_timeline 필드)
 */
export function RegimeTimelineChart({ timeline, theme, height = 220, ticker }) {
  const [hoverIdx, setHoverIdx] = useState(null);

  if (!timeline || timeline.length < 5) {
    return <p style={{ fontSize: 12, color: theme.textMuted, fontStyle: "italic" }}>타임라인 데이터가 없습니다.</p>;
  }

  const W = 720, H = height, PADL = 52, PADR = 16, PADT = 16, PADB = 32;
  const N = timeline.length;

  const closes = timeline.map((p) => p.close).filter((v) => v != null && isFinite(v));
  let yMin = Math.min(...closes), yMax = Math.max(...closes);
  const yPad = (yMax - yMin) * 0.06 || 1;
  yMin -= yPad; yMax += yPad;

  const xAt = (i) => PADL + (i / Math.max(1, N - 1)) * (W - PADL - PADR);
  const yAt = (val) => PADT + (1 - (val - yMin) / (yMax - yMin)) * (H - PADT - PADB);

  // 연속 같은 레짐 구간 → 배경 직사각형 세그먼트
  const segments = [];
  let segStart = 0;
  for (let i = 1; i <= N; i++) {
    if (i === N || timeline[i]?.regime !== timeline[segStart]?.regime) {
      segments.push({ start: segStart, end: i - 1, regime: timeline[segStart]?.regime });
      segStart = i;
    }
  }

  // 가격선 SVG path
  const linePath = timeline
    .map((p, i) =>
      p.close != null ? `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(p.close).toFixed(1)}` : ""
    )
    .filter(Boolean)
    .join(" ");

  const xTicks = Array.from({ length: 5 }, (_, k) => Math.round((k * (N - 1)) / 4));
  const yTicks = 4;
  const segW = (W - PADL - PADR) / Math.max(1, N - 1);

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((rel - PADL) / (W - PADL - PADR)) * (N - 1));
    setHoverIdx(Math.max(0, Math.min(N - 1, i)));
  };

  const fmt = (val) =>
    val >= 1000 ? val.toLocaleString("en-US", { maximumFractionDigits: 0 }) : val?.toFixed(2);

  const usedRegimes = [...new Set(timeline.map((p) => p.regime).filter(Boolean))];
  const hoverPt = hoverIdx != null ? timeline[hoverIdx] : null;

  return (
    <div style={{ position: "relative" }}>
      {ticker && (
        <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>
          분석 티커: <b style={{ color: theme.text }}>{ticker}</b> · 분석 기준: MA200 + Vol60
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          onMouseMove={onMove}
          onMouseLeave={() => setHoverIdx(null)}
          style={{ cursor: "crosshair", display: "block" }}
        >
          {/* 레짐별 배경 밴드 */}
          {segments.map((seg, idx) => {
            const x1 = xAt(seg.start);
            const x2 = xAt(seg.end) + segW;
            const color = REGIME_COLORS[seg.regime] || "#94a3b8";
            return (
              <rect
                key={idx}
                x={x1}
                y={PADT}
                width={Math.max(1, x2 - x1)}
                height={H - PADT - PADB}
                fill={color}
                opacity={0.18}
              />
            );
          })}

          {/* Y축 그리드 */}
          {Array.from({ length: yTicks + 1 }, (_, k) => {
            const val = yMin + ((yMax - yMin) * k) / yTicks;
            const y = yAt(val);
            return (
              <g key={k}>
                <line
                  x1={PADL}
                  x2={W - PADR}
                  y1={y}
                  y2={y}
                  stroke={theme?.panelBorder || "#e2e8f0"}
                  strokeWidth={0.5}
                />
                <text x={PADL - 6} y={y + 3} textAnchor="end" fontSize={10} fill={theme?.textMuted}>
                  {fmt(val)}
                </text>
              </g>
            );
          })}

          {/* X축 라벨 */}
          {xTicks.map((i, ki) => (
            <text
              key={i}
              x={xAt(i)}
              y={H - 10}
              textAnchor={ki === 0 ? "start" : ki === xTicks.length - 1 ? "end" : "middle"}
              fontSize={10}
              fill={theme?.textMuted}
            >
              {timeline[i]?.date?.slice(0, 7)}
            </text>
          ))}

          {/* 가격선 */}
          <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth={1.8} opacity={0.9} />

          {/* 호버 수직선 */}
          {hoverIdx != null && (
            <line
              x1={xAt(hoverIdx)}
              x2={xAt(hoverIdx)}
              y1={PADT}
              y2={H - PADB}
              stroke={theme?.accent || "#3b82f6"}
              strokeDasharray="3 3"
              strokeWidth={1}
              opacity={0.7}
            />
          )}
          {hoverPt?.close != null && hoverIdx != null && (
            <circle
              cx={xAt(hoverIdx)}
              cy={yAt(hoverPt.close)}
              r={3.5}
              fill="#3b82f6"
              stroke="white"
              strokeWidth={1.5}
            />
          )}
        </svg>
      </div>

      {/* 호버 툴팁 */}
      {hoverPt && hoverIdx != null && (
        <div
          style={{
            position: "absolute",
            top: 24,
            right: 10,
            padding: "6px 10px",
            borderRadius: 8,
            background: "rgba(15,23,42,0.92)",
            color: "white",
            fontSize: 11,
            pointerEvents: "none",
            lineHeight: 1.7,
            zIndex: 10,
          }}
        >
          <div style={{ fontWeight: 700 }}>{hoverPt.date}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: REGIME_COLORS[hoverPt.regime] || "#94a3b8",
                display: "inline-block",
              }}
            />
            {REGIME_KO[hoverPt.regime] || hoverPt.regime}
          </div>
          {hoverPt.close != null && <div>종가: {fmt(hoverPt.close)}</div>}
        </div>
      )}

      {/* 범례 */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
        {usedRegimes.map((r) => (
          <span
            key={r}
            style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: theme?.text }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: REGIME_COLORS[r] || "#94a3b8",
                flexShrink: 0,
              }}
            />
            {REGIME_KO[r] || r}
          </span>
        ))}
      </div>
    </div>
  );
}
