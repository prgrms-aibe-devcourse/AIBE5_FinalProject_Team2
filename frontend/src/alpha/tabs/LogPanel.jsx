import React, { useEffect, useMemo, useRef, useState } from "react";
import { fetchDecisionTimeline } from "../alphaApi";
import { PanelHeader } from "./helpers";

/* ───────── 데모 데이터 (실제 기록이 없을 때 표시) ───────── */
const DEMO_ROWS = [
  {
    id: "demo-1",
    title: "리밸런싱 비율 조정",
    createdAt: "2025-05-28T09:00:00",
    category: "국내 주식 포트폴리오",
    status: "ACCEPTED", statusLabel: "수락",
    actor: "AI",
    aiReason: "최근 30일 변동성이 18.2%로 상승하여 목표 MDD 한계(−15%)에 근접 중(현재 −14.8%). SPY 대비 상관계수 0.91로 분산 효과 약화. 방어형 자산(채권·현금) 비중을 현재 12%→25%로 확대 시 MDD −9.4%, 변동성 13.5%로 개선 예상. 추세 지속 시 추가 하락 여지 있어 선제 조정 권고.",
    options: [
      { label: "기존 유지",   key: "keep",       metrics: { return_pct: 12.3, mdd_pct: -14.8, vol_pct: 18.2 } },
      { label: "안정형 조정", key: "stable",     metrics: { return_pct: 10.1, mdd_pct:  -9.4, vol_pct: 13.5 } },
      { label: "공격형 조정", key: "aggressive", metrics: { return_pct: 15.7, mdd_pct: -19.2, vol_pct: 22.1 } },
    ],
    userChoice: "안정형 조정",
    userNote: "MDD 개선이 더 중요",
  },
  {
    id: "demo-2",
    title: "해외 ETF 편입 제안",
    createdAt: "2025-05-14T11:30:00",
    category: "글로벌 분산 전략",
    status: "HOLD", statusLabel: "보류",
    actor: "AI",
    aiReason: "국내 시장 집중도 87%로 분산 효과 부족 (헝커리 지수 0.78). 미국 S&P500·유럽 STOXX50 ETF 30% 편입 시 포트폴리오 상관계수 0.62 → 0.41로 낮아져 동일 기대수익 대비 변동성 −18% 완화 기대. 환율 헤지 비용(연 0.8%) 감안해도 샤프 비율 +0.12 개선 전망.",
    options: [],
    userChoice: "보류",
    userNote: "환율 리스크 추가 검토 후 결정",
  },
  {
    id: "demo-3",
    title: "손절 기준선 하향",
    createdAt: "2025-04-30T14:00:00",
    category: "리스크 관리 파라미터",
    status: "ACCEPTED", statusLabel: "수락",
    actor: "USER",
    aiReason: null, options: [],
    userChoice: "일부 반영",
    userNote: "-8% → -10%로 절충",
  },
];

/* ───────── 상수 ───────── */
const STATUS_MAP = {
  ACCEPTED: { bg: "#DCFCE7", fg: "#166534", label: "수락" },
  HOLD:     { bg: "#FEF3C7", fg: "#92400E", label: "보류" },
  REJECTED: { bg: "#FEE2E2", fg: "#991B1B", label: "거절" },
  PENDING:  { bg: "#F1F5F9", fg: "#475569", label: "대기" },
  NONE:     { bg: "#F1F5F9", fg: "#475569", label: "-" },
};

const ACTOR_DOT = { USER: "#10B981", AI: "#6366F1", SYSTEM: "#F59E0B" };
const SHOW_METRICS = ["return_pct", "mdd_pct", "vol_pct"];

const PRESETS = [
  { key: "1w", label: "1주일", days: 7 },
  { key: "1m", label: "1달",   days: 30 },
  { key: "3m", label: "3달",   days: 90 },
  { key: "6m", label: "6달",   days: 180 },
  { key: "1y", label: "1년",   days: 365 },
];

const metricLabel = (k) =>
  ({ return_pct: "수익률", mdd_pct: "MDD", vol_pct: "변동성", sharpe: "샤프", win_rate_pct: "승률", trades: "거래수" }[k] ?? k);

const metricFmt = (k, v) => {
  if (v == null || Number.isNaN(Number(v))) return "-";
  if (["return_pct", "mdd_pct", "vol_pct", "win_rate_pct"].includes(k)) return `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(1)}%`;
  if (k === "trades") return String(v);
  return Number(v).toFixed(2);
};

const metricColor = (k, v) => {
  const n = Number(v);
  if (Number.isNaN(n)) return "#64748B";
  if (k === "mdd_pct") { const a = Math.abs(n); return a <= 15 ? "#059669" : a <= 25 ? "#D97706" : "#DC2626"; }
  if (k === "vol_pct") return n <= 0 ? "#059669" : "#DC2626";
  return n >= 0 ? "#059669" : "#DC2626";
};

/* YYYY-MM-DD — Jackson LocalDateTime 배열 [y,m,d,...] 포맷도 처리 */
function toDateStr(date) {
  if (!date) return "";
  if (Array.isArray(date)) {
    const [y, m, d] = date;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const d = new Date(date);
  if (isNaN(d)) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* 오늘 기준 N일 전 YYYY-MM-DD */
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateStr(d);
}

/* ───────── 커스텀 달력 ───────── */
const WEEKDAYS = ["일","월","화","수","목","금","토"];

function LogDatePicker({ value, onChange, minDate, maxDate, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const today = toDateStr(new Date());
  const max = maxDate || today;

  const parsed = value ? new Date(value + "T00:00:00") : null;
  const [viewYear, setViewYear]   = useState(parsed?.getFullYear() || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed ? parsed.getMonth() : new Date().getMonth());

  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const dim = (y, m) => new Date(y, m + 1, 0).getDate();
  const fd  = new Date(viewYear, viewMonth, 1).getDay();
  const total = Math.ceil((fd + dim(viewYear, viewMonth)) / 7) * 7;

  const minY = minDate ? parseInt(minDate.slice(0, 4), 10) : 0;
  const minM = minDate ? parseInt(minDate.slice(5, 7), 10) - 1 : 0;
  const canPrevM = !minDate || viewYear > minY || (viewYear === minY && viewMonth > minM);

  const prevM = () => {
    if (!canPrevM) return;
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1);
  };
  const nextM = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  const pick = (dateStr) => { onChange(dateStr); setOpen(false); };

  const monthLabel = `${viewYear}년 ${viewMonth + 1}월`;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "4px 10px", borderRadius: 8, cursor: "pointer",
          border: "1.5px solid #E2E8F0", background: "#fff",
          fontSize: 12, color: value ? "#0F172A" : "#94A3B8",
          fontWeight: value ? 600 : 400, whiteSpace: "nowrap",
          userSelect: "none", minWidth: 104,
        }}
      >
        <span style={{ fontSize: 13 }}>🗓️</span>
        {value || placeholder || "날짜 선택"}
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 400,
          background: "#fff", borderRadius: 14,
          boxShadow: "0 8px 30px rgba(0,0,0,0.14)", border: "1px solid #E5E7EB",
          padding: "12px 10px", width: 228,
          fontFamily: "'Inter','Pretendard',sans-serif",
        }}>
          {/* 헤더 */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button onClick={prevM} style={{ background: "none", border: "none", fontSize: 16, cursor: canPrevM ? "pointer" : "default", color: canPrevM ? "#374151" : "#D1D5DB", padding: "2px 6px" }}>‹</button>
            <span style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>{monthLabel}</span>
            <button onClick={nextM} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "#374151", padding: "2px 6px" }}>›</button>
          </div>

          {/* 요일 헤더 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 2 }}>
            {WEEKDAYS.map((d, i) => (
              <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, padding: "3px 0",
                color: i === 0 ? "#EF4444" : i === 6 ? "#3B82F6" : "#9CA3AF" }}>{d}</div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 1 }}>
            {Array.from({ length: total }, (_, idx) => {
              const d = idx - fd + 1;
              const valid = d >= 1 && d <= dim(viewYear, viewMonth);
              if (!valid) return <div key={idx} />;
              const mm = String(viewMonth + 1).padStart(2, "0");
              const dd = String(d).padStart(2, "0");
              const dateStr = `${viewYear}-${mm}-${dd}`;
              const disabled = (minDate && dateStr < minDate) || (max && dateStr > max);
              const isSel = value === dateStr;
              const dow = idx % 7;
              return (
                <div key={idx}
                  onClick={() => !disabled && pick(dateStr)}
                  style={{
                    textAlign: "center", padding: "5px 1px", borderRadius: 7, fontSize: 12,
                    fontWeight: isSel ? 700 : 500,
                    cursor: disabled ? "default" : "pointer",
                    color: disabled ? "#D1D5DB" : isSel ? "white" : dow === 0 ? "#EF4444" : dow === 6 ? "#3B82F6" : "#111827",
                    background: isSel ? "#3B82F6" : "transparent",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => { if (!disabled && !isSel) e.currentTarget.style.background = "#EFF6FF"; }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
                >{d}</div>
              );
            })}
          </div>

          {/* 하단 버튼 */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, borderTop: "1px solid #F3F4F6", paddingTop: 8 }}>
            <button onClick={() => { onChange(""); setOpen(false); }}
              style={{ background: "none", border: "none", fontSize: 12, color: "#EF4444", cursor: "pointer" }}>
              초기화
            </button>
            <button onClick={() => { if (!minDate || today >= minDate) pick(today); }}
              style={{ background: "none", border: "none", fontSize: 12, color: "#3B82F6", cursor: "pointer" }}>
              오늘
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── 옵션 카드 ───────── */
function OptionCard({ opt, selected }) {
  const metrics = opt?.metrics && typeof opt.metrics === "object" ? opt.metrics : {};
  const keys = SHOW_METRICS.filter((k) => metrics[k] != null);
  const label = opt.label || opt.key || "옵션";

  return (
    <div style={{
      flex: "1 1 150px",
      border: selected ? "2px solid #0D9488" : "1px solid #E2E8F0",
      borderRadius: 10,
      padding: "10px 12px",
      background: selected ? "#F0FDFA" : "#FFFFFF",
      minWidth: 0,
    }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: selected ? "#0D9488" : "#334155", marginBottom: 8 }}>
        {selected ? `${label} ✓` : label}
      </div>
      {keys.length === 0 && <div style={{ fontSize: 12, color: "#94A3B8" }}>지표 없음</div>}
      {keys.map((k) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
          <span style={{ color: "#64748B", fontWeight: 600 }}>{metricLabel(k)}</span>
          <span style={{ color: metricColor(k, metrics[k]), fontWeight: 800 }}>{metricFmt(k, metrics[k])}</span>
        </div>
      ))}
    </div>
  );
}

/* ───────── 타임라인 카드 ───────── */
function DecisionCard({ row }) {
  const st = STATUS_MAP[row.status] || STATUS_MAP.NONE;
  const options = Array.isArray(row.options) ? row.options : [];

  const matchChoice = (opt) => {
    if (!row.userChoice) return false;
    const lbl = (opt.label || opt.key || "").toLowerCase();
    const uc = row.userChoice.toLowerCase();
    return lbl.includes(uc) || uc.includes(lbl);
  };

  const formatDate = (iso) => {
    try {
      const d = new Date(iso);
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} `
        + `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}`;
    } catch { return iso; }
  };

  return (
    <div style={{
      border: `1.5px solid ${row.status === "ACCEPTED" ? "#86EFAC" : row.status === "HOLD" ? "#FDE68A" : "#E2E8F0"}`,
      borderRadius: 14,
      padding: "18px 22px",
      boxShadow: row.status === "ACCEPTED" ? "0 2px 16px rgba(16,185,129,0.10)" : "0 2px 12px rgba(15,23,42,0.04)",
      background: row.status === "ACCEPTED" ? "linear-gradient(145deg,#f0fdf4,#ffffff)" : "#FFFFFF",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#1E293B", lineHeight: 1.3 }}>
            {row.title || row.summary || "기록"}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: "#94A3B8", fontWeight: 500 }}>
            {formatDate(row.createdAt)} · {row.category || row.eventType || ""}
          </div>
        </div>
        {row.status && row.status !== "NONE" && (
          <span style={{
            background: st.bg, color: st.fg,
            borderRadius: 999, padding: "5px 12px",
            fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0,
          }}>
            {row.statusLabel || st.label}
          </span>
        )}
      </div>

      {row.aiReason && (
        <div style={{
          marginTop: 12, background: "#EFF6FF",
          borderLeft: "3px solid #93C5FD",
          borderRadius: "0 8px 8px 0", padding: "10px 14px",
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#2563EB", marginBottom: 4 }}>AI추천근거</div>
          <div style={{ fontSize: 13, color: "#1E3A5F", lineHeight: 1.65 }}>{row.aiReason}</div>
        </div>
      )}

      {!row.aiReason && row.payload?.metrics && (() => {
        const m = row.payload.metrics;
        const keys = SHOW_METRICS.filter((k) => m[k] != null);
        return keys.length > 0 ? (
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {keys.map((k) => (
              <div key={k} style={{
                background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8,
                padding: "6px 14px", display: "flex", flexDirection: "column",
                alignItems: "center", gap: 2, minWidth: 70,
              }}>
                <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>{metricLabel(k)}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: metricColor(k, m[k]) }}>{metricFmt(k, m[k])}</span>
              </div>
            ))}
          </div>
        ) : null;
      })()}

      {options.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {options.map((opt, idx) => (
            <OptionCard key={idx} opt={opt} selected={matchChoice(opt)} />
          ))}
        </div>
      )}

      {(row.userChoice || row.userNote) && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #F1F5F9", fontSize: 13, color: "#64748B" }}>
          <span style={{ color: "#334155", fontWeight: 700 }}>사용자 선택</span>{" "}
          <span style={{ color: row.status === "ACCEPTED" ? "#0D9488" : row.status === "HOLD" ? "#92400E" : "#475569", fontWeight: 700 }}>
            {row.userChoice}
          </span>
          {row.userNote && <span> · <span style={{ color: "#94A3B8" }}>"{row.userNote}"</span></span>}
        </div>
      )}
    </div>
  );
}

const PAGE_INIT = 30;
const PAGE_MORE = 10;

/* ───────── 메인 패널 ───────── */
export default function LogPanel({ id, ws }) {
  const [timeline, setTimeline] = useState(null);
  const [error, setError]       = useState(null);
  const [preset, setPreset]     = useState(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_INIT);
  const [showTop, setShowTop]   = useState(false);
  const rootRef   = useRef(null);
  const scrollerRef = useRef(null);

  /* 전략 생성 시점 (워크스페이스 createdAt) — min 제한용 */
  const minDate = useMemo(() => toDateStr(ws?.createdAt), [ws?.createdAt]);

  /* 스크롤 컨테이너 탐색 + TOP 버튼 감지 */
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let scroller = el.parentElement;
    while (scroller && scroller !== document.body) {
      const ov = window.getComputedStyle(scroller).overflowY;
      if (ov === "auto" || ov === "scroll") break;
      scroller = scroller.parentElement;
    }
    if (!scroller || scroller === document.body) return;
    scrollerRef.current = scroller;
    const onScroll = () => setShowTop(scroller.scrollTop > 300);
    scroller.addEventListener("scroll", onScroll);
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () =>
    scrollerRef.current?.scrollTo({ top: 0, behavior: "smooth" });

  useEffect(() => {
    setError(null);
    fetchDecisionTimeline(id, "all")
      .then((data) => setTimeline(data || { counts: {}, items: [] }))
      .catch((e) => setError(e?.response?.data?.error || e.message || "조회 실패"));
  }, [id]);

  const realRows = timeline?.items || [];
  const isDemo   = timeline != null && realRows.length === 0;
  const baseRows = isDemo ? DEMO_ROWS : realRows;

  /* 프리셋 선택 — 시작일이 워크스페이스 생성일보다 이전이면 생성일로 클램프 */
  const applyPreset = (p) => {
    setPreset(p.key);
    const from = daysAgo(p.days);
    setDateFrom(minDate && from < minDate ? minDate : from);
    setDateTo(toDateStr(new Date()));
  };


  /* 초기화 */
  const reset = () => { setPreset(null); setDateFrom(""); setDateTo(""); setVisibleCount(PAGE_INIT); };

  /* 필터 바뀌면 페이지 리셋 */
  useEffect(() => { setVisibleCount(PAGE_INIT); }, [dateFrom, dateTo]);

  /* 클라이언트 필터 */
  const rows = useMemo(() => {
    if (!dateFrom && !dateTo) return baseRows;
    const from = dateFrom ? new Date(dateFrom).getTime()                : -Infinity;
    const to   = dateTo   ? new Date(dateTo + "T23:59:59.999").getTime() : Infinity;
    return baseRows.filter((r) => {
      const t = new Date(r.createdAt).getTime();
      return t >= from && t <= to;
    });
  }, [baseRows, dateFrom, dateTo]);

  const totalCount  = isDemo ? DEMO_ROWS.length : (timeline?.counts?.all ?? 0);
  const isFiltered  = dateFrom || dateTo;

  return (
    <div ref={rootRef}>
      <PanelHeader
        icon="📜"
        title="Decision Log"
        description={
          <>
            전략 변경 이력 · 총{" "}
            <span style={{ fontWeight: 800, color: "#1E293B" }}>{totalCount}건</span>
            {isFiltered && rows.length !== totalCount && (
              <span style={{ color: "#6366F1", fontWeight: 700 }}> (필터 {rows.length}건)</span>
            )}
            {" "}— AI 추천·사용자 결정·백테스트 실행을 타임라인으로 기록합니다.
            {isDemo && (
              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700,
                color: "#6366F1", background: "#EEF2FF", borderRadius: 99, padding: "2px 8px" }}>예시</span>
            )}
          </>
        }
        theme={{ textMuted: "#64748B" }}
      />

      {/* ── 필터 바 ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginRight: 2 }}>기간</span>
        {PRESETS.map((p) => {
          const active = preset === p.key;
          return (
            <button
              key={p.key}
              onClick={() => applyPreset(p)}
              style={{
                padding: "5px 13px",
                borderRadius: 999,
                border: active ? "1.5px solid #6366F1" : "1.5px solid #E2E8F0",
                background: active ? "#EEF2FF" : "#F8FAFC",
                color: active ? "#4F46E5" : "#64748B",
                fontSize: 12, fontWeight: active ? 700 : 600,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {p.label}
            </button>
          );
        })}

        {/* 구분선 */}
        <div style={{ width: 1, height: 20, background: "#E2E8F0", margin: "0 4px" }} />

        {/* 직접 입력 — 커스텀 달력 */}
        <LogDatePicker
          value={dateFrom}
          onChange={(v) => { setPreset(null); setDateFrom(v); }}
          minDate={minDate || undefined}
          placeholder="시작일"
        />
        <span style={{ fontSize: 12, color: "#CBD5E1" }}>~</span>
        <LogDatePicker
          value={dateTo}
          onChange={(v) => { setPreset(null); setDateTo(v); }}
          minDate={dateFrom || minDate || undefined}
          placeholder="종료일"
        />
        {isFiltered && (
          <button
            onClick={reset}
            style={{
              border: "1px solid #E2E8F0", background: "#F8FAFC",
              color: "#64748B", borderRadius: 8, padding: "5px 10px",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            초기화
          </button>
        )}
      </div>

      {error && (
        <div style={{ marginBottom: 12, color: "#B91C1C", fontSize: 12, fontWeight: 700, padding: "8px 12px", background: "#FEF2F2", borderRadius: 8 }}>
          {error}
        </div>
      )}

      {!timeline && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#94A3B8", fontSize: 14 }}>불러오는 중...</div>
      )}

      {timeline && rows.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#94A3B8", fontSize: 14 }}>
          {isFiltered ? "선택한 기간에 해당하는 기록이 없습니다" : "기록이 없습니다"}
        </div>
      )}

      {timeline && rows.length > 0 && (() => {
        const visible = rows.slice(0, visibleCount);
        const hasMore = rows.length > visibleCount;
        return (
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

            {/* ── 타임라인 ── */}
            <div style={{ flex: 1, minWidth: 0, position: "relative", paddingLeft: 28 }}>
              {visible.map((row, idx) => {
                const isLast = idx === visible.length - 1;
                const dotColor = ACTOR_DOT[row.actor] || "#94A3B8";
                return (
                  <div key={row.id} style={{ position: "relative", marginBottom: isLast && !hasMore ? 0 : 16 }}>
                    {/* 다음 카드 연결선 — 마지막 카드는 제외 */}
                    {!isLast && (
                      <div style={{
                        position: "absolute",
                        left: -21, width: 2,
                        top: 24, bottom: -33,
                        background: "#E2E8F0",
                      }} />
                    )}
                    {/* 액터 도트 — 선 위에 렌더 */}
                    <div style={{
                      position: "absolute",
                      left: -27, top: 10,
                      width: 14, height: 14, borderRadius: "50%",
                      background: dotColor,
                      border: "2.5px solid #FFFFFF",
                      boxShadow: `0 0 0 2.5px ${dotColor}44`,
                      zIndex: 1,
                    }} />
                    <DecisionCard row={row} />
                  </div>
                );
              })}
              {hasMore && (
                <div style={{ paddingTop: 8, paddingBottom: 8 }}>
                  <button
                    onClick={() => setVisibleCount((c) => c + PAGE_MORE)}
                    style={{
                      width: "100%", padding: "10px 0",
                      border: "1.5px dashed #CBD5E1", borderRadius: 10,
                      background: "#F8FAFC", color: "#64748B",
                      fontSize: 13, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    더보기 ({Math.min(PAGE_MORE, rows.length - visibleCount)}건 / 남은 {rows.length - visibleCount}건)
                  </button>
                </div>
              )}
            </div>

            {/* ── 범례 ── */}
            <div style={{
              width: 108, flexShrink: 0,
              background: "#F8FAFC", borderRadius: 12,
              border: "1px solid #E2E8F0",
              padding: "12px 13px",
              position: "sticky", top: 20,
              fontFamily: "'Inter','Pretendard',sans-serif",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", marginBottom: 10, letterSpacing: 0.3 }}>
                액터 구분
              </div>
              {[
                { actor: "AI",     label: "AI 추천" },
                { actor: "USER",   label: "사용자 결정" },
                { actor: "SYSTEM", label: "시스템" },
              ].map(({ actor, label }) => (
                <div key={actor} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                  <div style={{
                    width: 11, height: 11, borderRadius: "50%", flexShrink: 0,
                    background: ACTOR_DOT[actor],
                    border: "2px solid white",
                    boxShadow: `0 0 0 1.5px ${ACTOR_DOT[actor]}55`,
                  }} />
                  <span style={{ fontSize: 11, color: "#374151", fontWeight: 600 }}>{label}</span>
                </div>
              ))}
            </div>

          </div>
        );
      })()}

      {/* TOP 버튼 */}
      <button
        onClick={scrollToTop}
        title="맨 위로"
        style={{
          position: "fixed",
          bottom: 36,
          right: 52,
          width: 38,
          height: 38,
          borderRadius: "50%",
          border: "1.5px solid #CBD5E1",
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(6px)",
          color: "#64748B",
          fontSize: 15,
          fontWeight: 700,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 10px rgba(0,0,0,0.10)",
          opacity: showTop ? 0.75 : 0,
          pointerEvents: showTop ? "auto" : "none",
          transition: "opacity 0.25s ease",
          zIndex: 50,
          lineHeight: 1,
        }}
      >
        ↑
      </button>
    </div>
  );
}

const DATE_INPUT_STYLE = {
  border: "1.5px solid #E2E8F0",
  borderRadius: 8,
  padding: "5px 10px",
  fontSize: 12,
  fontWeight: 600,
  color: "#334155",
  outline: "none",
  cursor: "pointer",
};
