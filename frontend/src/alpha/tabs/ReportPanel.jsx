import React, { useMemo, useState } from "react";
import { useTheme } from "../ThemeContext";
import { runBacktest } from "../alphaApi";
import { Play } from "lucide-react";
import { PanelHeader, Card, Stat, TrendLineChart, calcSMA, Empty, Json, primaryBtn } from "./helpers";

export default function ReportPanel({ id, ws, onChange }) {
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);
  const [period, setPeriod] = useState("5y");
  const onRun = async () => {
    if (busy) return;
    setBusy(true);
    try { await runBacktest(id, period); onChange(); }
    catch (e) { alert("백테스트 실패: " + (e?.response?.data?.error || e.message)); }
    finally { setBusy(false); }
  };
  const bt = ws.lastBacktest;
  const trendSeries = useMemo(() => {
    const eq = bt?.equity_curve;
    if (!Array.isArray(eq) || eq.length < 5) return null;
    const points = eq.map((p) => ({ x: p.date ? new Date(p.date) : null, y: Number(p.value) }));
    const values = points.map((p) => p.y);
    const sma20 = calcSMA(values, 20);
    const sma50 = calcSMA(values, 50);
    const sma200 = calcSMA(values, 200);
    const mk = (arr, name, color, width) => ({
      name, color, width,
      points: points.map((p, i) => ({ x: p.x, y: arr[i] })),
    });
    return [
      { name: "에쿼티 곡선", color: "#3b82f6", width: 2, points },
      ...(values.length >= 20 ? [mk(sma20, "SMA 20", "#10b981", 1.4)] : []),
      ...(values.length >= 50 ? [mk(sma50, "SMA 50", "#f59e0b", 1.4)] : []),
      ...(values.length >= 200 ? [mk(sma200, "SMA 200", "#ef4444", 1.4)] : []),
    ];
  }, [bt]);
  return (
    <div style={{ maxWidth: 1100 }}>
      <PanelHeader
        icon="📊"
        title="Easy Performance Report"
        description="Strategy Config가 정형화되면 vectorbt deterministic engine으로 실행한 백테스트 결과입니다."
        theme={theme}
        action={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select value={period} onChange={(e) => setPeriod(e.target.value)} disabled={busy}
              title="백테스트 기간"
              style={{
                padding: "8px 10px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: `1px solid ${theme.panelBorder}`, background: theme.panel, color: theme.text,
              }}>
              <option value="1y">최근 1년</option>
              <option value="2y">최근 2년</option>
              <option value="5y">최근 5년</option>
              <option value="10y">최근 10년</option>
              <option value="max">최대 (yfinance 기본)</option>
            </select>
            <button onClick={onRun} disabled={!ws.strategyConfig || busy} style={primaryBtn(theme, busy)}>
              <Play size={14} /> {busy ? "실행 중…" : "백테스트 실행"}
            </button>
          </div>
        }
      />
      {!bt && <Empty msg="Strategy Config가 정형화되면 vectorbt deterministic engine으로 백테스트 실행" theme={theme} />}
      {bt && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 16 }}>
            <Stat label="총 수익률" value={bt.stats?.total_return_pct} unit="%" theme={theme} positive />
            <Stat label="연환산 수익" value={bt.stats?.annualized_return_pct} unit="%" theme={theme} />
            <Stat label="MDD" value={bt.stats?.max_drawdown_pct} unit="%" theme={theme} negative />
            <Stat label="Sharpe" value={bt.stats?.sharpe} theme={theme} />
            <Stat label="Sortino" value={bt.stats?.sortino} theme={theme} />
            <Stat label="Calmar" value={bt.stats?.calmar} theme={theme} />
            <Stat label="승률" value={bt.stats?.win_rate_pct} unit="%" theme={theme} />
            <Stat label="거래 수" value={bt.stats?.trades} unit="회" theme={theme} />
          </div>
          {trendSeries && (
            <Card title="📈 에쿼티 추세 & 이동평균선" theme={theme}>
              <p style={{ margin: "0 0 10px", fontSize: 12, color: theme.textMuted, lineHeight: 1.55 }}>
                전략의 자산 가치 변동(파란선)과 함께 <b>SMA 20/50/200</b> 추세선을 표시합니다.
                차트 위에 마우스를 올리면 해당 시점의 값을 볼 수 있어요.
              </p>
              <TrendLineChart series={trendSeries} theme={theme} height={260} />
            </Card>
          )}
          {bt.risk_metrics && (
            <Card title="📐 위험지표 상세 (QuantStats)" theme={theme}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
                <Stat label="CAGR" value={bt.risk_metrics.cagr_pct} unit="%" theme={theme} />
                <Stat label="변동성" value={bt.risk_metrics.volatility_pct} unit="%" theme={theme} />
                <Stat label="VaR(95%)" value={bt.risk_metrics.var_95} unit="%" theme={theme} />
                <Stat label="CVaR(95%)" value={bt.risk_metrics.cvar_95} unit="%" theme={theme} />
                <Stat label="최고일" value={bt.risk_metrics.best_day} unit="%" theme={theme} />
                <Stat label="최악일" value={bt.risk_metrics.worst_day} unit="%" theme={theme} />
              </div>
            </Card>
          )}
          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: "pointer", color: theme.accent, fontSize: 12 }}>raw JSON 보기</summary>
            <Json value={bt} theme={theme} />
          </details>
        </>
      )}
    </div>
  );
}
