import React, { useEffect, useMemo, useState } from "react";
import { fetchDecisionTimeline } from "../alphaApi";

/* ───────── 데모 데이터 (실제 기록이 없을 때 표시) ───────── */
const DEMO_ROWS = [
  {
    id: "demo-1",
    title: "리밸런싱 비율 조정",
    createdAt: "2025-05-28T09:00:00",
    category: "국내 주식 포트폴리오",
    status: "ACCEPTED", statusLabel: "수락",
    actor: "AI",
    aiReason: "최근 30일 변동성이 18%로 상승하여 MDD 한계(−15%)에 근접. 방어형 자산 비중 확대를 통해 리스크 완충이 필요한 시점입니다.",
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
    aiReason: "국내 시장 집중도 87%로 분산 효과 부족. 미국·유럽 ETF 30% 편입 시 상관계수 0.62 → 0.41로 낮아져 변동성 완화 기대.",
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

/* ───────── 옵션 카드 ───────── */
function OptionCard({ opt, selected }) {
  const metrics = opt?.metrics && typeof opt.metrics === "object" ? opt.metrics : {};
  const keys = SHOW_METRICS.filter((k) => metrics[k] != null);
  const label = opt.label || opt.key || "옵션";
  const displayLabel = selected ? `${label}✓` : label;

  return (
    <div style={{
      flex: "1 1 150px",
      border: selected ? "2px solid #0D9488" : "1px solid #E2E8F0",
      borderRadius: 10,
      padding: "10px 12px",
      background: selected ? "#F0FDFA" : "#FFFFFF",
      minWidth: 0,
    }}>
      <div style={{
        fontSize: 13, fontWeight: 800,
        color: selected ? "#0D9488" : "#334155",
        marginBottom: 8,
      }}>
        {displayLabel}
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

  /* userChoice 와 옵션 label 매칭 */
  const matchChoice = (opt) => {
    if (!row.userChoice) return false;
    const lbl = (opt.label || opt.key || "").toLowerCase();
    const uc = row.userChoice.toLowerCase();
    return lbl.includes(uc) || uc.includes(lbl);
  };

  const formatDate = (iso) => {
    try {
      const d = new Date(iso);
      const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
      const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}`;
      return `${date} ${time}`;
    } catch { return iso; }
  };

  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid #E2E8F0",
      borderRadius: 14,
      padding: "16px 20px",
      boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    }}>
      {/* 카드 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#1E293B", lineHeight: 1.3 }}>
            {row.title || row.summary || "기록"}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: "#94A3B8", fontWeight: 500 }}>
            {formatDate(row.createdAt)} · {row.category || row.eventType || ""}
          </div>
        </div>
        <span style={{
          background: st.bg, color: st.fg,
          borderRadius: 999, padding: "5px 12px",
          fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0,
        }}>
          {row.statusLabel || st.label}
        </span>
      </div>

      {/* AI 추천 근거 */}
      {row.aiReason && (
        <div style={{
          marginTop: 12,
          background: "#EFF6FF",
          borderLeft: "3px solid #93C5FD",
          borderRadius: "0 8px 8px 0",
          padding: "10px 14px",
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#2563EB", marginBottom: 4 }}>AI추천근거</div>
          <div style={{ fontSize: 13, color: "#1E3A5F", lineHeight: 1.65 }}>{row.aiReason}</div>
        </div>
      )}

      {/* 백테스트 단순 메트릭 (BACKTEST_RUN) */}
      {!row.aiReason && row.payload?.metrics && (() => {
        const m = row.payload.metrics;
        const keys = SHOW_METRICS.filter((k) => m[k] != null);
        return keys.length > 0 ? (
          <div style={{
            marginTop: 12,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}>
            {keys.map((k) => (
              <div key={k} style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: 8,
                padding: "6px 14px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                minWidth: 70,
              }}>
                <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>{metricLabel(k)}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: metricColor(k, m[k]) }}>{metricFmt(k, m[k])}</span>
              </div>
            ))}
          </div>
        ) : null;
      })()}

      {/* 옵션 비교 */}
      {options.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {options.map((opt, idx) => (
            <OptionCard key={idx} opt={opt} selected={matchChoice(opt)} />
          ))}
        </div>
      )}

      {/* 사용자 선택 */}
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


/* ───────── 날짜 입력 헬퍼 ───────── */
function toInputValue(date) {
  if (!date) return "";
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const dd   = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* ───────── 메인 패널 ───────── */
export default function LogPanel({ id }) {
  const [timeline, setTimeline] = useState(null);
  const [error, setError]       = useState(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");

  const load = () => {
    setError(null);
    fetchDecisionTimeline(id, "all")
      .then((data) => setTimeline(data || { counts: {}, items: [] }))
      .catch((e) => setError(e?.response?.data?.error || e.message || "조회 실패"));
  };

  useEffect(() => { load(); }, [id]); // eslint-disable-line

  const realRows = timeline?.items || [];
  const isDemo   = timeline != null && realRows.length === 0;
  const baseRows = isDemo ? DEMO_ROWS : realRows;

  /* 날짜 범위 필터 (클라이언트) */
  const rows = useMemo(() => {
    if (!dateFrom && !dateTo) return baseRows;
    const from = dateFrom ? new Date(dateFrom).getTime()           : -Infinity;
    const to   = dateTo   ? new Date(dateTo + "T23:59:59.999").getTime() : Infinity;
    return baseRows.filter((r) => {
      const t = new Date(r.createdAt).getTime();
      return t >= from && t <= to;
    });
  }, [baseRows, dateFrom, dateTo]);

  const totalCount = isDemo ? DEMO_ROWS.length : (timeline?.counts?.all ?? 0);

  return (
    <div style={{ maxWidth: 860, fontFamily: "'Pretendard', 'Inter', sans-serif" }}>
      {/* ── 헤더 ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#0F172A" }}>디시전 로그</div>
          <div style={{ marginTop: 3, fontSize: 13, color: "#94A3B8", fontWeight: 500 }}>
            전략 변경 이력 · 총 {totalCount}건 {rows.length !== totalCount && `(필터 ${rows.length}건)`}
            {isDemo && (
              <span style={{
                marginLeft: 8, fontSize: 11, fontWeight: 700,
                color: "#6366F1", background: "#EEF2FF",
                borderRadius: 99, padding: "2px 8px",
              }}>예시</span>
            )}
          </div>
        </div>

        {/* ── 날짜 필터 ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>기간</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={DATE_INPUT_STYLE}
          />
          <span style={{ fontSize: 12, color: "#94A3B8" }}>~</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={DATE_INPUT_STYLE}
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              style={{
                border: "1px solid #E2E8F0", background: "#F8FAFC",
                color: "#64748B", borderRadius: 8, padding: "5px 10px",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >초기화</button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 12, color: "#B91C1C", fontSize: 12, fontWeight: 700, padding: "8px 12px", background: "#FEF2F2", borderRadius: 8 }}>
          {error}
        </div>
      )}

      {/* ── 타임라인 ── */}
      {!timeline && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#94A3B8", fontSize: 14 }}>불러오는 중...</div>
      )}

      {timeline && rows.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#94A3B8", fontSize: 14 }}>
          {dateFrom || dateTo ? "선택한 기간에 해당하는 기록이 없습니다" : "기록이 없습니다"}
        </div>
      )}

      {timeline && rows.length > 0 && (
        <div style={{ position: "relative", paddingLeft: 28 }}>
          {/* 수직선 */}
          <div style={{
            position: "absolute", left: 8, top: 6, bottom: 28,
            width: 2, background: "#E2E8F0",
          }} />

          {rows.map((row) => (
            <div key={row.id} style={{ position: "relative", marginBottom: 14 }}>
              {/* 타임라인 점 */}
              <div style={{
                position: "absolute", left: -28, top: 10,
                width: 12, height: 12, borderRadius: "50%",
                background: ACTOR_DOT[row.actor] || "#94A3B8",
                border: "2px solid #FFFFFF",
                boxShadow: "0 0 0 2px " + (ACTOR_DOT[row.actor] || "#94A3B8") + "33",
              }} />
              <DecisionCard row={row} />
            </div>
          ))}

          {/* 스크롤 힌트 아이콘 */}
          <div style={{ textAlign: "center", paddingTop: 4 }}>
            <span style={{ fontSize: 18, color: "#CBD5E1" }}>↓</span>
          </div>
        </div>
      )}

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
