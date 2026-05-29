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
              <option value="max">최대 (가능한 최장)</option>
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
            <Stat label="총 수익률" value={bt.stats?.total_return_pct} unit="%" theme={theme} positive hint="백테스트 전체 기간의 누적 수익률입니다. 매수 후 보유 대비 전략의 성과를 보여줍니다." />
            <Stat label="연환산 수익" value={bt.stats?.annualized_return_pct} unit="%" theme={theme} hint="CAGR — 1년 단위로 환산했을 때의 평균 수익률. 기간이 달라도 비교 가능한 표준 지표입니다." />
            <Stat label="MDD" value={bt.stats?.max_drawdown_pct} unit="%" theme={theme} negative hint="Maximum Drawdown — 고점 대비 최대 낙폭. 이 전략을 가장 불운한 타이밍에 매수했을 때 겪을 수 있는 최대 손실입니다." />
            <Stat label="Sharpe" value={bt.stats?.sharpe} theme={theme} hint="수익률 ÷ 변동성 × √252. 1.0 이상이면 양호, 2.0 이상이면 우수. 리스크 대비 수익 효율성을 측정합니다." />
            <Stat label="Sortino" value={bt.stats?.sortino} theme={theme} hint="Sharpe와 유사하지만 하락 변동성만 페널티로 계산합니다. 상승 변동성은 좋은 것이므로 Sharpe보다 투자자에게 유리한 평가 방식입니다." />
            <Stat label="Calmar" value={bt.stats?.calmar ?? bt.risk_metrics?.calmar} theme={theme} hint="연환산 수익 ÷ |MDD|. 낙폭 대비 수익 효율성. 값이 클수록 손실 위험 대비 수익이 좋은 전략입니다." />
            <Stat label="승률" value={bt.stats?.win_rate_pct} unit="%" theme={theme} hint="전체 거래일 중 수익이 발생한 날의 비율입니다. 50% 이상이면 절반 이상의 날에 수익이 났다는 의미입니다." />
            <Stat label="거래 수" value={bt.stats?.trades} unit="회" theme={theme} hint="백테스트 기간 동안 발생한 총 매매 횟수입니다. 너무 많으면 거래 비용이 과도해질 수 있습니다." />
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
                <Stat label="CAGR" value={bt.risk_metrics.cagr_pct} unit="%" theme={theme} hint="Compound Annual Growth Rate — QuantStats로 계산한 복리 연환산 수익률입니다." />
                <Stat label="변동성" value={bt.risk_metrics.volatility_pct} unit="%" theme={theme} hint="연환산 변동성. 일별 수익률의 표준편차 × √252. 높을수록 자산 가치의 등락이 크다는 의미입니다." />
                <Stat label="VaR(95%)" value={bt.risk_metrics.var_95_pct} unit="%" theme={theme} hint="Value at Risk — 95% 신뢰수준에서 하루에 발생 가능한 최대 손실. 예: -2%면 95% 확률로 하루 손실이 2% 이내." />
                <Stat label="CVaR(95%)" value={bt.risk_metrics.cvar_95_pct} unit="%" theme={theme} hint="Conditional VaR (Expected Shortfall) — 최악의 5% 상황에서의 평균 손실. VaR보다 극단적 손실을 더 잘 반영합니다." />
                <Stat label="최고일" value={bt.risk_metrics.best_day_pct} unit="%" theme={theme} positive hint="백테스트 기간 중 가장 좋았던 하루의 수익률입니다." />
                <Stat label="최악일" value={bt.risk_metrics.worst_day_pct} unit="%" theme={theme} negative hint="백테스트 기간 중 가장 나빴던 하루의 손실률입니다. 이 수준의 손실을 감당할 수 있는지 확인하세요." />
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
