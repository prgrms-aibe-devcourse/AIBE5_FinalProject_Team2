import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header_client from "../components/Header_client";
import {
  fetchAnalyticsHealth, runBacktest, fetchTodaySignals,
  trainModel, runWalkForward,
} from "../lib/analyticsApi";

const FONT = "'Inter', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const TICKERS = [
  "DFEN", "FAS", "FNGU", "LABU", "MIDU", "NAIL", "RETL", "SOXL",
  "TECL", "TNA", "TPOR", "TQQQ", "UPRO", "WANT", "WEBL",
  "QLD", "QQQ", "SPY",
];
const STRATEGIES = [
  { v: "sma_cross", label: "SMA 골든크로스 (20/60)" },
  { v: "rsi_meanrev", label: "RSI 평균회귀 (14, 30/70)" },
  { v: "macd", label: "MACD 시그널 (12/26/9)" },
];

const card = { background: "white", borderRadius: 14, border: "1px solid #E5E7EB", padding: 20, marginBottom: 16 };
const btnPrimary = {
  padding: "10px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
  background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)", color: "white",
};
const btnSec = {
  padding: "10px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
  background: "#DBEAFE", color: "#1e3a5f",
};

export default function AnalyticsLab() {
  const navigate = useNavigate();
  const [health, setHealth] = useState(null);
  const [strategy, setStrategy] = useState("sma_cross");
  const [signals, setSignals] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  // backtest panel
  const [btTicker, setBtTicker] = useState("SPY");
  const [btPeriod, setBtPeriod] = useState("5y");
  const [btResult, setBtResult] = useState(null);
  const [btLoading, setBtLoading] = useState(false);

  // walk-forward
  const [wfResult, setWfResult] = useState(null);
  const [wfLoading, setWfLoading] = useState(false);

  // train model
  const [trainTicker, setTrainTicker] = useState("SPY");
  const [trainResult, setTrainResult] = useState(null);
  const [training, setTraining] = useState(false);

  useEffect(() => { fetchAnalyticsHealth().then(setHealth).catch(e => setErr(e.message)); }, []);

  const loadSignals = async () => {
    setLoading(true); setErr(null);
    try {
      const sigs = await fetchTodaySignals({ tickers: TICKERS, strategy, include_ml: true });
      setSignals(sigs);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const doBacktest = async () => {
    setBtLoading(true); setErr(null); setBtResult(null);
    try {
      const r = await runBacktest({ ticker: btTicker, period: btPeriod, strategy });
      setBtResult(r);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setBtLoading(false);
    }
  };

  const doWalkForward = async () => {
    setWfLoading(true); setErr(null); setWfResult(null);
    try {
      const r = await runWalkForward(btTicker, strategy);
      setWfResult(r);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setWfLoading(false);
    }
  };

  const doTrain = async () => {
    setTraining(true); setErr(null); setTrainResult(null);
    try {
      const r = await trainModel(trainTicker);
      setTrainResult(r);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setTraining(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", fontFamily: FONT }}>
      <Header_client />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "30px 20px 80px" }}>
        <button onClick={() => navigate("/client_home")} style={{ background: "none", border: "none", color: "#6B7280", fontSize: 13, cursor: "pointer", padding: 0 }}>‹ 홈으로</button>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: "#0F2C52", margin: "8px 0 4px" }}>
          Alpha-Helix 분석 랩
        </h1>
        <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 8px" }}>
          금융 데이터 API · vectorbt 백테스트 · QuantStats 위험지표 · XGBoost + SHAP 설명가능 AI
        </p>
        <div style={{ marginBottom: 20, display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", background: health?.analytics === "up" ? "#DCFCE7" : "#FEE2E2", borderRadius: 999, fontSize: 11, fontWeight: 700, color: health?.analytics === "up" ? "#166534" : "#991B1B" }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: health?.analytics === "up" ? "#16a34a" : "#dc2626" }} />
          Analytics 서비스: {health?.analytics ?? "확인중…"}
        </div>

        {err && (
          <div style={{ padding: 12, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, color: "#B91C1C", fontSize: 13, marginBottom: 16 }}>
            {err}
          </div>
        )}

        {/* 전략 선택 */}
        <div style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 12px", color: "#111827" }}>전략 선택</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {STRATEGIES.map(s => (
              <button key={s.v} onClick={() => setStrategy(s.v)} style={{
                padding: "8px 14px", borderRadius: 8, border: "1px solid",
                borderColor: strategy === s.v ? "#3b82f6" : "#D1D5DB",
                background: strategy === s.v ? "#EFF6FF" : "white",
                color: strategy === s.v ? "#1e3a5f" : "#374151",
                fontWeight: 600, fontSize: 13, cursor: "pointer",
              }}>{s.label}</button>
            ))}
          </div>
        </div>

        {/* 오늘의 시그널 */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: "#111827" }}>📡 오늘의 시그널 (시장 데이터 API + vectorbt + ML)</h2>
            <button onClick={loadSignals} disabled={loading} style={btnPrimary}>
              {loading ? "분석 중…" : "시그널 조회"}
            </button>
          </div>
          {signals && (
            <div style={{ display: "grid", gap: 10 }}>
              {signals.map(s => (
                <div key={s.ticker} style={{ padding: 14, background: "#F8FAFC", borderRadius: 10, border: "1px solid #E2E8F0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div>
                      <span style={{ fontSize: 16, fontWeight: 800, color: "#0F2C52" }}>{s.ticker}</span>
                      <span style={{ marginLeft: 10, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800,
                        background: s.signal === "BUY" ? "#DCFCE7" : s.signal === "SELL" ? "#FEE2E2" : "#F1F5F9",
                        color: s.signal === "BUY" ? "#166534" : s.signal === "SELL" ? "#991B1B" : "#475569",
                      }}>{s.signal}</span>
                      {s.ml_proba_up !== undefined && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: "#6B7280" }}>
                          익일 상승확률 <b style={{ color: s.ml_proba_up > 0.5 ? "#166534" : "#991B1B" }}>{(s.ml_proba_up * 100).toFixed(1)}%</b>
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: "#6B7280" }}>${s.last_close?.toFixed(2)} · {s.last_date}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "#374151", margin: "0 0 6px" }}>{s.reason}</p>
                  {s.explanation && (
                    <details style={{ marginTop: 8 }}>
                      <summary style={{ cursor: "pointer", fontSize: 12, color: "#3b82f6", fontWeight: 600 }}>
                        🧠 SHAP 설명 보기 (왜 이 결론인가)
                      </summary>
                      <pre style={{ marginTop: 8, padding: 10, background: "#0F172A", color: "#E2E8F0", borderRadius: 6, fontSize: 11, overflow: "auto", whiteSpace: "pre-wrap" }}>
{s.explanation.human_summary}
                      </pre>
                    </details>
                  )}
                  {s.ml_note && <p style={{ fontSize: 11, color: "#B45309", margin: 0 }}>⚠ {s.ml_note}</p>}
                  {s.error && <p style={{ fontSize: 11, color: "#B91C1C", margin: 0 }}>오류: {s.error}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 백테스트 */}
        <div style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 12px", color: "#111827" }}>📊 vectorbt 백테스트</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
            <select value={btTicker} onChange={e => setBtTicker(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13 }}>
              {TICKERS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={btPeriod} onChange={e => setBtPeriod(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13 }}>
              {["1y", "2y", "5y", "10y", "max"].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <button onClick={doBacktest} disabled={btLoading} style={btnPrimary}>
              {btLoading ? "실행 중…" : "백테스트 실행"}
            </button>
            <button onClick={doWalkForward} disabled={wfLoading} style={btnSec}>
              {wfLoading ? "검증 중…" : "Walk-Forward OOS"}
            </button>
          </div>
          {btResult && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
              {[
                ["총수익률", btResult.stats.total_return_pct, "%"],
                ["연환산 수익", btResult.stats.annualized_return_pct, "%"],
                ["MDD", btResult.stats.max_drawdown_pct, "%"],
                ["Sharpe", btResult.stats.sharpe, ""],
                ["Sortino", btResult.stats.sortino, ""],
                ["Calmar", btResult.stats.calmar, ""],
                ["승률", btResult.stats.win_rate_pct, "%"],
                ["거래수", btResult.stats.trades, "회"],
              ].map(([k, v, unit]) => (
                <div key={k} style={{ padding: 10, background: "#F8FAFC", borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: "#6B7280" }}>{k}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#0F2C52" }}>{v != null ? v.toFixed?.(2) ?? v : "—"}{unit}</div>
                </div>
              ))}
            </div>
          )}
          {wfResult?.summary && (
            <div style={{ marginTop: 14, padding: 12, background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#92400E", marginBottom: 6 }}>
                🛡 Walk-Forward (Out-of-Sample) — {wfResult.summary.n_valid}/{wfResult.summary.n_folds} 폴드
              </div>
              <div style={{ fontSize: 12, color: "#78350F" }}>
                평균 수익률 <b>{wfResult.summary.avg_total_return_pct}%</b> · 평균 Sharpe <b>{wfResult.summary.avg_sharpe}</b> · 평균 MDD <b>{wfResult.summary.avg_max_drawdown_pct}%</b> · 평균 승률 <b>{wfResult.summary.avg_win_rate_pct}%</b>
              </div>
            </div>
          )}
        </div>

        {/* 모델 학습 */}
        <div style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 6px", color: "#111827" }}>🧠 XGBoost 익일방향 분류기 학습</h2>
          <p style={{ fontSize: 12, color: "#6B7280", margin: "0 0 12px" }}>
            5년치 데이터로 13개 기술적 피처를 학습합니다. TimeSeriesSplit 5-fold CV로 데이터 누수 방지. 학습 후 시그널 조회에서 SHAP 설명이 함께 표시됩니다.
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select value={trainTicker} onChange={e => setTrainTicker(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13 }}>
              {TICKERS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={doTrain} disabled={training} style={btnPrimary}>
              {training ? "학습 중…" : "모델 학습"}
            </button>
            {trainResult && (
              <span style={{ fontSize: 12, color: "#374151" }}>
                ✅ {trainResult.ticker} · {trainResult.samples} 샘플 · CV 정확도 <b>{(trainResult.cv_avg.accuracy * 100).toFixed(1)}%</b> · 정밀도 <b>{(trainResult.cv_avg.precision * 100).toFixed(1)}%</b>
              </span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
