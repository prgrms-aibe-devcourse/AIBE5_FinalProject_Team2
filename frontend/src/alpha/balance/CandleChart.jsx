/**
 * 증권사 mobile 스타일 캔들 차트 (stock_chart 레퍼런스 기반)
 *  - 캔들(상승=빨강·하락=파랑, 한국 컨벤션) + 거래량 서브패널
 *  - 이동평균 MA5/20/60 + 볼린저밴드(20,2)
 *  - 크로스헤어 + OHLC·등락·MA·거래량 툴팁
 *  - 기간 토글(3M/6M/1Y/전체)
 * data: [{date, open, high, low, close, volume}] (시간 오름차순)
 */
import { useMemo, useState } from "react";
import { calcSMA, calcBollinger } from "../tabs/helpers";

const UP = "#e5484d", DOWN = "#2f6feb", MUT = "#94a3b8", BRD = "rgba(255,255,255,0.07)";

export default function CandleChart({ data, height = 230 }) {
  const [range, setRange] = useState("6M");
  const [hi, setHi] = useState(null);

  const full = useMemo(() => (data || []).filter(d => d && d.close != null), [data]);
  const sliced = useMemo(() => {
    const n = { "3M": 63, "6M": 126, "1Y": 252, "ALL": full.length }[range] || full.length;
    return full.slice(Math.max(0, full.length - n));
  }, [full, range]);

  const closes = useMemo(() => sliced.map(d => Number(d.close)), [sliced]);
  const ma5 = useMemo(() => calcSMA(closes, 5), [closes]);
  const ma20 = useMemo(() => calcSMA(closes, 20), [closes]);
  const ma60 = useMemo(() => calcSMA(closes, 60), [closes]);
  const bb = useMemo(() => (closes.length >= 20 ? calcBollinger(closes, 20, 2) : null), [closes]);

  if (sliced.length < 2) return <div style={{ padding: 30, textAlign: "center", color: MUT, fontSize: 12 }}>차트 데이터를 불러올 수 없습니다.</div>;

  const W = 720, PADL = 4, PADR = 52, PADT = 8, volH = 46, gap = 8;
  const priceH = height - volH - gap;
  const N = sliced.length;
  let lo = Infinity, hiP = -Infinity;
  sliced.forEach(d => { lo = Math.min(lo, Number(d.low)); hiP = Math.max(hiP, Number(d.high)); });
  if (bb) bb.upper.forEach(v => { if (v != null) hiP = Math.max(hiP, v); });
  if (bb) bb.lower.forEach(v => { if (v != null) lo = Math.min(lo, v); });
  const pad = (hiP - lo) * 0.06 || 1; lo -= pad; hiP += pad;
  const maxVol = Math.max(...sliced.map(d => Number(d.volume) || 0), 1);

  const plotW = W - PADL - PADR;
  const cw = plotW / N;
  const xAt = (i) => PADL + i * cw + cw / 2;
  const yAt = (v) => PADT + (1 - (v - lo) / (hiP - lo)) * priceH;
  const vyAt = (v) => PADT + priceH + gap + (1 - v / maxVol) * volH;
  const path = (arr) => arr.map((v, i) => v == null ? null : `${arr[i - 1] == null ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`).filter(Boolean).join(" ");

  const fmt = (v) => v == null ? "—" : Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const onMove = (e) => { const r = e.currentTarget.getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width) * W; setHi(Math.max(0, Math.min(N - 1, Math.floor((x - PADL) / cw)))); };
  const hd = hi != null ? sliced[hi] : null;
  const chg = hd && hi > 0 ? ((Number(hd.close) / Number(sliced[hi - 1].close) - 1) * 100) : (hd ? ((Number(hd.close) / Number(hd.open) - 1) * 100) : 0);

  const yTicks = 4;
  const btn = (r) => ({ padding: "3px 9px", borderRadius: 6, border: "none", fontSize: 10.5, fontWeight: 700, cursor: "pointer", background: range === r ? "#1f2733" : "transparent", color: range === r ? "#e2e8f0" : MUT });

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 2, background: "#0d1117", borderRadius: 8, padding: 2 }}>
          {["3M", "6M", "1Y", "ALL"].map(r => <button key={r} onClick={() => setRange(r)} style={btn(r)}>{r === "ALL" ? "전체" : r}</button>)}
        </div>
        <div style={{ display: "flex", gap: 9, fontSize: 9.5, fontWeight: 700 }}>
          <span style={{ color: "#fbbf24" }}>BB(20,2)</span><span style={{ color: "#f97316" }}>MA5</span><span style={{ color: "#22c55e" }}>MA20</span><span style={{ color: "#a78bfa" }}>MA60</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" style={{ display: "block", cursor: "crosshair" }} onMouseMove={onMove} onMouseLeave={() => setHi(null)}>
        {/* price grid */}
        {Array.from({ length: yTicks + 1 }, (_, k) => { const v = lo + (hiP - lo) * k / yTicks; const y = yAt(v); return <g key={k}><line x1={PADL} x2={W - PADR} y1={y} y2={y} stroke={BRD} strokeWidth={0.5} /><text x={W - PADR + 4} y={y + 3} fontSize={9} fill={MUT}>{fmt(v)}</text></g>; })}
        {/* Bollinger */}
        {bb && <><path d={path(bb.upper)} fill="none" stroke="#fbbf24" strokeWidth={0.9} opacity={0.7} strokeDasharray="3 2" /><path d={path(bb.lower)} fill="none" stroke="#fbbf24" strokeWidth={0.9} opacity={0.7} strokeDasharray="3 2" /></>}
        {/* candles */}
        {sliced.map((d, i) => {
          const o = Number(d.open), c = Number(d.close), h = Number(d.high), l = Number(d.low);
          const up = c >= o, col = up ? UP : DOWN;
          const bx = xAt(i), bodyW = Math.max(1, cw * 0.6);
          const yo = yAt(o), yc = yAt(c);
          return <g key={i}>
            <line x1={bx} x2={bx} y1={yAt(h)} y2={yAt(l)} stroke={col} strokeWidth={0.8} />
            <rect x={bx - bodyW / 2} y={Math.min(yo, yc)} width={bodyW} height={Math.max(0.8, Math.abs(yc - yo))} fill={col} />
          </g>;
        })}
        {/* MAs */}
        <path d={path(ma5)} fill="none" stroke="#f97316" strokeWidth={1} opacity={0.9} />
        <path d={path(ma20)} fill="none" stroke="#22c55e" strokeWidth={1} opacity={0.9} />
        <path d={path(ma60)} fill="none" stroke="#a78bfa" strokeWidth={1} opacity={0.9} />
        {/* volume */}
        {sliced.map((d, i) => { const up = Number(d.close) >= Number(d.open); const v = Number(d.volume) || 0; const y = vyAt(v); return <rect key={i} x={xAt(i) - Math.max(1, cw * 0.6) / 2} y={y} width={Math.max(1, cw * 0.6)} height={Math.max(0.4, (PADT + priceH + gap + volH) - y)} fill={up ? UP : DOWN} opacity={0.45} />; })}
        {/* crosshair */}
        {hi != null && <line x1={xAt(hi)} x2={xAt(hi)} y1={PADT} y2={height} stroke="#cbd5e1" strokeDasharray="3 3" strokeWidth={0.7} opacity={0.6} />}
      </svg>
      {hd && (() => {
        const lp = (xAt(hi) / W) * 100, flip = lp > 55;
        const at = (arr) => arr[hi];
        return (
          <div style={{ position: "absolute", top: 26, left: `${lp}%`, transform: flip ? "translateX(-100%) translateX(-10px)" : "translateX(10px)", background: "#111827", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, padding: "8px 11px", fontSize: 10.5, lineHeight: 1.6, pointerEvents: "none", zIndex: 5, minWidth: 150, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
            <div style={{ fontWeight: 800, marginBottom: 4, color: "#fff" }}>{String(hd.date).slice(0, 10)}</div>
            <Row k="시가" v={fmt(hd.open)} /><Row k="고가" v={fmt(hd.high)} c="#fca5a5" /><Row k="저가" v={fmt(hd.low)} c="#93c5fd" />
            <Row k="종가" v={fmt(hd.close)} c={chg >= 0 ? "#fca5a5" : "#93c5fd"} />
            <Row k="등락" v={`${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`} c={chg >= 0 ? "#fca5a5" : "#93c5fd"} />
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", margin: "4px 0" }} />
            <Row k="MA5" v={fmt(at(ma5))} c="#f97316" /><Row k="MA20" v={fmt(at(ma20))} c="#22c55e" /><Row k="MA60" v={fmt(at(ma60))} c="#a78bfa" />
            <Row k="거래량" v={(Number(hd.volume) || 0).toLocaleString()} c="#cbd5e1" />
          </div>
        );
      })()}
    </div>
  );
}

function Row({ k, v, c = "#e5e7eb" }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}><span style={{ color: "#94a3b8" }}>{k}</span><b style={{ color: c, fontVariantNumeric: "tabular-nums" }}>{v}</b></div>;
}
