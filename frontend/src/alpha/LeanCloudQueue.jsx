import React, { useEffect, useRef, useState, useCallback } from "react";
import { Cloud, Play, Loader, RefreshCw, Code2 } from "lucide-react";
import { leanV2Submit, leanV2Job, leanV2Jobs, leanListStrategies } from "./alphaApi";

// 터미널(폴링 종료) 상태
const TERMINAL = new Set(["DONE", "ERROR"]);

// 상태 배지 색상 — QUEUED 회색 · DISPATCHED/RUNNING 파랑 · DONE 초록 · ERROR 빨강
function statusStyle(status) {
  switch (status) {
    case "DONE":       return { bg: "rgba(34,197,94,0.15)",  fg: "#4ade80" };
    case "ERROR":      return { bg: "rgba(239,68,68,0.15)",  fg: "#f87171" };
    case "RUNNING":
    case "DISPATCHED": return { bg: "rgba(96,165,250,0.15)", fg: "#60a5fa" };
    case "QUEUED":
    default:           return { bg: "rgba(148,163,184,0.15)", fg: "#94a3b8" };
  }
}

function StatusBadge({ status }) {
  const s = statusStyle(status);
  return (
    <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: s.bg, color: s.fg, letterSpacing: "0.03em" }}>
      {status || "—"}
    </span>
  );
}

// statistics 의 키는 백엔드 응답 그대로(문자열 값). 주요 5개만 우선 표시.
const STAT_ROWS = [
  ["Net Profit", "Net Profit"],
  ["Compounding Annual Return", "CAGR"],
  ["Sharpe Ratio", "Sharpe"],
  ["Drawdown", "Drawdown"],
  ["Total Orders", "Total Orders"],
];

function ResultTable({ result }) {
  const stats = result?.statistics || {};
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
      <tbody>
        {STAT_ROWS.map(([key, label]) => (
          <tr key={key} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <td style={{ padding: "4px 6px", color: "#94a3b8" }}>{label}</td>
            <td style={{ padding: "4px 6px", color: "#e2e8f0", fontFamily: "monospace", textAlign: "right" }}>
              {stats[key] != null ? String(stats[key]) : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const inputStyle = {
  width: "100%", background: "#0d1117", border: "1px solid rgba(167,139,250,0.25)",
  borderRadius: 5, color: "#e2e8f0", fontSize: 11.5, padding: "5px 7px", boxSizing: "border-box",
};
const labelStyle = { fontSize: 10, color: "#94a3b8", fontWeight: 700, marginBottom: 3, display: "block" };

export default function LeanCloudQueue() {
  // 전략 목록(드롭다운 — 실패 시 텍스트 입력 fallback)
  const [strategies, setStrategies] = useState([]);
  const [stratLoadFailed, setStratLoadFailed] = useState(false);

  // 폼 상태
  const [strategyId, setStrategyId] = useState("");
  const [symbols, setSymbols] = useState("SPY");
  const [startDate, setStartDate] = useState("2020-01-01");
  const [endDate, setEndDate] = useState("2023-12-31");
  const [market, setMarket] = useState("us");
  const [useFreeCode, setUseFreeCode] = useState(false);
  const [mainPy, setMainPy] = useState("");

  // 제출/폴링
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [activeJob, setActiveJob] = useState(null); // 현재 폴링 중인 잡 (단건)

  // 잡 목록 + 선택된 잡 상세
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [selected, setSelected] = useState(null); // 클릭한 잡 단건 상세

  const pollRef = useRef(null);
  const mountedRef = useRef(true);

  const clearPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  // 언마운트 cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; clearPoll(); };
  }, [clearPoll]);

  // 전략 목록 1회 로드 (실패해도 텍스트 입력 fallback)
  useEffect(() => {
    leanListStrategies()
      .then(r => {
        const list = Array.isArray(r?.strategies) ? r.strategies : [];
        if (!mountedRef.current) return;
        setStrategies(list);
        if (list.length && !strategyId) setStrategyId(list[0].id);
        if (!list.length) setStratLoadFailed(true);
      })
      .catch(() => { if (mountedRef.current) setStratLoadFailed(true); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 내 잡 목록 로드(최신순)
  const loadJobs = useCallback(() => {
    setJobsLoading(true);
    leanV2Jobs()
      .then(r => {
        if (!mountedRef.current) return;
        const list = Array.isArray(r?.jobs) ? r.jobs : [];
        // createdAt 최신순 (없으면 원순서 유지)
        const sorted = [...list].sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
        setJobs(sorted);
      })
      .catch(() => { /* 오프라인 — 무시 */ })
      .finally(() => { if (mountedRef.current) setJobsLoading(false); });
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  // 단일 잡 폴링 시작 (2.5초 간격) — 터미널 도달 시 중지
  const startPolling = useCallback((jobId) => {
    clearPoll();
    const tick = () => {
      leanV2Job(jobId)
        .then(j => {
          if (!mountedRef.current) return;
          setActiveJob(j);
          // 폴링 중인 잡이 현재 선택된 잡이면 상세도 동기화
          setSelected(prev => (prev && prev.jobId === jobId ? j : prev));
          if (TERMINAL.has(j.status)) {
            clearPoll();
            loadJobs(); // 목록 갱신
          }
        })
        .catch(() => { /* 일시 오류 — 다음 tick 재시도 */ });
    };
    tick();
    pollRef.current = setInterval(tick, 2500);
  }, [clearPoll, loadJobs]);

  // 제출
  const handleSubmit = async () => {
    setSubmitError("");
    const symArr = symbols.split(",").map(s => s.trim()).filter(Boolean);
    if (!useFreeCode && !strategyId.trim()) { setSubmitError("전략을 선택하거나 입력하세요."); return; }
    if (!symArr.length) { setSubmitError("종목을 1개 이상 입력하세요."); return; }
    const paramOverrides = {};
    if (useFreeCode && mainPy.trim()) paramOverrides.main_py = mainPy;
    const body = {
      strategyId: strategyId.trim() || "raw-algo",
      symbols: symArr,
      startDate,
      endDate,
      market,
      paramOverrides,
    };
    setSubmitting(true);
    try {
      const r = await leanV2Submit(body);
      if (!mountedRef.current) return;
      setActiveJob({ jobId: r.jobId, status: r.status || "QUEUED", tier: r.tier });
      loadJobs();
      if (r.jobId) startPolling(r.jobId);
    } catch (e) {
      if (mountedRef.current) setSubmitError(e?.response?.data?.error || e?.message || "제출 실패");
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  // 잡 항목 클릭 → 단건 조회 상세
  const handleSelect = (jobId) => {
    leanV2Job(jobId)
      .then(j => { if (mountedRef.current) setSelected(j); })
      .catch(() => { /* 무시 */ });
  };

  const card = {
    background: "rgba(0,0,0,0.2)", border: "1px solid rgba(167,139,250,0.18)",
    borderRadius: 8, padding: 10, marginBottom: 8,
  };

  return (
    <div style={{ fontSize: 11.5, color: "#cbd5e1" }}>
      {/* ── 제출 폼 ── */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
          <Cloud size={13} color="#a78bfa" />
          <span style={{ fontSize: 10, color: "#a78bfa", fontWeight: 800, letterSpacing: "0.06em" }}>잡 제출</span>
        </div>

        {/* 전략 */}
        <div style={{ marginBottom: 7 }}>
          <label style={labelStyle}>전략</label>
          {stratLoadFailed ? (
            <input style={inputStyle} value={strategyId} placeholder="strategyId (예: raw-algo)"
              onChange={e => setStrategyId(e.target.value)} />
          ) : (
            <select style={{ ...inputStyle, cursor: "pointer" }} value={strategyId}
              onChange={e => setStrategyId(e.target.value)}>
              {strategies.map(s => <option key={s.id} value={s.id}>{s.name || s.id}</option>)}
            </select>
          )}
        </div>

        {/* 종목 */}
        <div style={{ marginBottom: 7 }}>
          <label style={labelStyle}>종목 (쉼표 구분)</label>
          <input style={inputStyle} value={symbols} placeholder="SPY, QQQ"
            onChange={e => setSymbols(e.target.value)} />
        </div>

        {/* 기간 + 마켓 */}
        <div style={{ display: "flex", gap: 6, marginBottom: 7 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>시작일</label>
            <input type="date" style={inputStyle} value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>종료일</label>
            <input type="date" style={inputStyle} value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div style={{ width: 72 }}>
            <label style={labelStyle}>마켓</label>
            <select style={{ ...inputStyle, cursor: "pointer" }} value={market} onChange={e => setMarket(e.target.value)}>
              <option value="us">us</option>
              <option value="krx">krx</option>
            </select>
          </div>
        </div>

        {/* 자유 코드 토글 */}
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "#94a3b8", cursor: "pointer", marginBottom: useFreeCode ? 7 : 8 }}>
          <input type="checkbox" checked={useFreeCode} onChange={e => setUseFreeCode(e.target.checked)}
            style={{ accentColor: "#a78bfa", width: 12, height: 12 }} />
          <Code2 size={12} color="#a78bfa" /> 자유 코드 (main.py) 직접 실행
        </label>
        {useFreeCode && (
          <textarea value={mainPy} onChange={e => setMainPy(e.target.value)} rows={8}
            placeholder={"# QCAlgorithm 코드를 붙여넣으세요\nfrom AlgorithmImports import *\n\nclass MyAlgo(QCAlgorithm):\n    def Initialize(self):\n        ..."}
            style={{ ...inputStyle, fontFamily: "monospace", fontSize: 10.5, lineHeight: 1.5, resize: "vertical", marginBottom: 8 }} />
        )}

        <button onClick={handleSubmit} disabled={submitting}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            background: submitting ? "rgba(124,58,237,0.25)" : "linear-gradient(135deg,#7c3aed,#6d28d9)",
            border: "none", borderRadius: 6, color: "#fff", fontSize: 11.5, fontWeight: 700,
            padding: "7px 0", cursor: submitting ? "default" : "pointer",
            boxShadow: submitting ? "none" : "0 2px 8px rgba(124,58,237,0.35)",
          }}>
          {submitting ? <><Loader size={12} style={{animation:"spin 1s linear infinite"}} /> 제출 중…</> : <><Play size={12} /> 클라우드 큐에 제출</>}
        </button>
        {submitError && <div style={{ fontSize: 10, color: "#f87171", marginTop: 6 }}>{submitError}</div>}

        {/* 현재 폴링 중인 잡 진행 표시 */}
        {activeJob && (
          <div style={{ marginTop: 9, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>
                {activeJob.jobId}
              </span>
              <StatusBadge status={activeJob.status} />
            </div>
            {/* 진행 단계 */}
            <div style={{ display: "flex", gap: 4 }}>
              {["QUEUED", "DISPATCHED", "RUNNING", activeJob.status === "ERROR" ? "ERROR" : "DONE"].map((step, i) => {
                const order = ["QUEUED", "DISPATCHED", "RUNNING", "DONE", "ERROR"];
                const reached = order.indexOf(activeJob.status) >= order.indexOf(step) || (step === "ERROR" && activeJob.status === "ERROR");
                const st = statusStyle(step);
                return (
                  <span key={i} style={{
                    flex: 1, textAlign: "center", fontSize: 8.5, fontWeight: 700, padding: "2px 0", borderRadius: 4,
                    background: reached ? st.bg : "rgba(148,163,184,0.06)", color: reached ? st.fg : "#475569",
                  }}>{step}</span>
                );
              })}
            </div>
            {activeJob.status === "ERROR" && activeJob.error && (
              <div style={{ fontSize: 10, color: "#f87171", marginTop: 6, fontFamily: "monospace", whiteSpace: "pre-wrap" }}>{activeJob.error}</div>
            )}
            {activeJob.status === "DONE" && activeJob.result && (
              <div style={{ marginTop: 7 }}><ResultTable result={activeJob.result} /></div>
            )}
          </div>
        )}
      </div>

      {/* ── 내 잡 목록 ── */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
          <span style={{ fontSize: 10, color: "#a78bfa", fontWeight: 800, letterSpacing: "0.06em" }}>내 잡 (최신순)</span>
          <button onClick={loadJobs} disabled={jobsLoading} title="새로고침"
            style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", padding: 2 }}>
            <RefreshCw size={12} style={jobsLoading ? { animation: "spin 1s linear infinite" } : undefined} />
          </button>
        </div>
        {jobs.length === 0 ? (
          <div style={{ fontSize: 10.5, color: "#64748b", padding: "6px 2px" }}>제출된 잡이 없습니다.</div>
        ) : (
          jobs.map(j => (
            <div key={j.jobId} onClick={() => handleSelect(j.jobId)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
                padding: "5px 6px", borderRadius: 5, cursor: "pointer",
                background: selected?.jobId === j.jobId ? "rgba(167,139,250,0.12)" : "transparent",
              }}
              onMouseEnter={e => { if (selected?.jobId !== j.jobId) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={e => { if (selected?.jobId !== j.jobId) e.currentTarget.style.background = "transparent"; }}>
              <span style={{ flex: 1, overflow: "hidden", minWidth: 0 }}>
                <span style={{ color: "#cbd5e1", fontSize: 11, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {j.strategyId || j.jobId}
                </span>
                <span style={{ color: "#64748b", fontSize: 9 }}>
                  {j.market || "—"}{j.tier ? ` · ${j.tier}` : ""}{j.createdAt ? ` · ${String(j.createdAt).slice(0, 16).replace("T", " ")}` : ""}
                </span>
              </span>
              <StatusBadge status={j.status} />
            </div>
          ))
        )}
      </div>

      {/* ── 선택된 잡 상세 ── */}
      {selected && (
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 170 }}>
              {selected.jobId}
            </span>
            <StatusBadge status={selected.status} />
          </div>
          <div style={{ fontSize: 9.5, color: "#64748b", marginBottom: 7 }}>
            {selected.strategyId || "—"} · {selected.market || "—"}{selected.tier ? ` · ${selected.tier}` : ""}
          </div>
          {selected.status === "ERROR" && (
            <div style={{ fontSize: 10, color: "#f87171", fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
              {selected.error || "알 수 없는 오류"}
            </div>
          )}
          {selected.status === "DONE" && selected.result && <ResultTable result={selected.result} />}
          {!TERMINAL.has(selected.status) && (
            <div style={{ fontSize: 10, color: "#94a3b8", display: "flex", alignItems: "center", gap: 5 }}>
              <Loader size={11} style={{animation:"spin 1s linear infinite"}} /> 실행 중… (목록은 자동 갱신되지 않으니 새로고침)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
