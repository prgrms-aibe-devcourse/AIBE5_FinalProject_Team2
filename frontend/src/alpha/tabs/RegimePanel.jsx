import React, { useState } from "react";
import { useTheme } from "../ThemeContext";
import { runRegime } from "../alphaApi";
import { Play } from "lucide-react";
import { PanelHeader, Card, Row, Empty, primaryBtn } from "./helpers";

export default function RegimePanel({ id, ws, onChange }) {
  const { theme } = useTheme();
  const [data, setData] = useState(ws?.lastRegime ?? null);
  const [busy, setBusy] = useState(false);
  const onRun = async () => {
    setBusy(true);
    try {
      const result = await runRegime(id);
      setData(result);
      if (onChange) onChange();
    }
    catch (e) { alert("Regime 분석 실패: " + (e?.response?.data?.error || e.message)); }
    finally { setBusy(false); }
  };
  const labels = { bull: "🐂 상승장", bear: "🐻 하락장", sideways: "↔ 횡보장", high_vol_unstable: "⚡ 고변동성 불안정장" };
  const ALL_KEYS = ["bull", "bear", "sideways", "high_vol_unstable"];
  return (
    <div style={{ maxWidth: 1100 }}>
      <PanelHeader
        icon="📡"
        title="Regime Analysis"
        description="시장 국면별로 전략의 강점/약점을 분석합니다 (200일 추세 + 60일 변동성 기반 4분류)."
        theme={theme}
        action={
          <button onClick={onRun} disabled={busy} style={primaryBtn(theme, busy)}>
            <Play size={14} /> {busy ? "분석 중…" : "Regime 실행"}
          </button>
        }
      />
      {!data && <Empty msg="시장 국면별로 전략의 강점/약점을 분석합니다 (200일 추세 + 60일 변동성 기반 4분류)" theme={theme} />}
      {data && (
        <>
          <Card title="🌤 자연어 요약" theme={theme}>
            <p style={{ margin: 0, fontSize: 14, color: theme.text, lineHeight: 1.6 }}>{data.narrative}</p>
          </Card>
          <Card title="ℹ️ 어떻게 계산했나요?" theme={theme}>
            <div style={{ fontSize: 12.5, color: theme.text, lineHeight: 1.75 }}>
              <p style={{ margin: "0 0 8px" }}>
                과거 가격 데이터(yfinance)에서 매일 두 가지 지표를 계산해 시장 국면을 <b>4가지</b>로 자동 분류합니다.
              </p>
              <ul style={{ margin: "0 0 10px", paddingLeft: 18 }}>
                <li><b>200일 추세</b>: 가격이 200일 이동평균보다 위 → 상승 추세, 아래 → 하락 추세</li>
                <li><b>60일 변동성</b>: 일일 수익률의 60일 표준편차 (연환산) — 높으면 불안정장으로 분류</li>
              </ul>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8, marginTop: 6 }}>
                {[
                  { k: "🐂 상승장 (bull)", v: "추세 위 + 변동성 정상" },
                  { k: "🐻 하락장 (bear)", v: "추세 아래 + 변동성 정상" },
                  { k: "↔ 횡보장 (sideways)", v: "추세 근처 횡보 + 변동성 정상" },
                  { k: "⚡ 고변동성 불안정장", v: "변동성이 평균 + 1σ 초과" },
                ].map((x) => (
                  <div key={x.k} style={{
                    padding: "8px 10px", borderRadius: 8, background: theme.codeBg || "#f8fafc",
                    border: `1px solid ${theme.panelBorder}`, fontSize: 11.5,
                  }}>
                    <div style={{ fontWeight: 700, color: theme.text }}>{x.k}</div>
                    <div style={{ color: theme.textMuted, marginTop: 2 }}>{x.v}</div>
                  </div>
                ))}
              </div>
              <p style={{ margin: "10px 0 0", fontSize: 12, color: theme.textMuted }}>
                각 국면별로 전략을 별도 백테스트해서 <b>누적 수익 / Sharpe / MDD / 승률</b>을 계산합니다.
                국면 발생 기간이 너무 짧으면(<code>n &lt; 20일</code>) "데이터 부족"으로 표시합니다.
              </p>
            </div>
          </Card>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            {ALL_KEYS.map((k) => {
              const v = data.per_regime?.[k];
              const missing = !v;
              return (
                <Card key={k} title={labels[k] || k} theme={theme}
                  badge={data.weakest_regime === k ? "취약" : null}>
                  {missing ? <Empty msg="이 국면이 분석 기간 동안 발생하지 않았습니다." theme={theme} /> :
                   v?.note ? <Empty msg={v.note} theme={theme} /> : (
                    <div style={{ fontSize: 12, lineHeight: 1.8, color: theme.text }}>
                      <Row k="기간(일)" v={v.days} theme={theme} />
                      <Row k="누적 수익" v={`${v.cumulative_return_pct}%`} theme={theme} />
                      <Row k="연환산" v={`${v.annualized_return_pct}%`} theme={theme} />
                      <Row k="Sharpe" v={v.sharpe} theme={theme} />
                      <Row k="MDD" v={`${v.max_drawdown_pct}%`} theme={theme} />
                      <Row k="승률" v={`${v.win_rate_pct}%`} theme={theme} />
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
