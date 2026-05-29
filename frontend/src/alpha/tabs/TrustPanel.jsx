import React, { useState } from "react";
import { useTheme } from "../ThemeContext";
import { runTrust } from "../alphaApi";
import { Play } from "lucide-react";
import { PanelHeader, Card, SubScoreBar, Empty, TrustDetailsCard, primaryBtn } from "./helpers";

const PERIOD_OPTIONS = [
  { value: "5y", label: "5년" },
  { value: "10y", label: "10년 (권장)" },
  { value: "15y", label: "15년" },
  { value: "20y", label: "20년" },
  { value: "25y", label: "25년" },
  { value: "30y", label: "30년 (최대)" },
];

export default function TrustPanel({ id, ws, onChange }) {
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);
  const [period, setPeriod] = useState("10y");
  const trust = ws.lastTrust;
  const onRun = async () => {
    if (busy) return;
    setBusy(true);
    try { await runTrust(id, { period }); onChange(); }
    catch (e) { alert("Trust 계산 실패: " + (e?.response?.data?.error || e.message)); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ maxWidth: 900 }}>
      <PanelHeader
        icon="🛡"
        title="Trust Score & Robustness Check"
        description="Walk-Forward + Regime + Parameter Stability + Statistical Confidence를 종합한 0~100 점수."
        theme={theme}
        action={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <select
              value={period}
              onChange={e => setPeriod(e.target.value)}
              disabled={busy}
              style={{
                padding: "6px 10px", borderRadius: 8, fontSize: 13,
                border: `1px solid ${theme.panelBorder}`,
                background: theme.cardBg, color: theme.text, cursor: "pointer",
              }}
            >
              {PERIOD_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button onClick={onRun} disabled={busy} style={primaryBtn(theme, busy)}>
              <Play size={14} /> {busy ? "계산 중… (~1분)" : "Trust Score 계산"}
            </button>
          </div>
        }
      />
      {!trust && <Empty msg="Walk-Forward + Regime + Parameter Stability + Statistical Confidence를 종합한 0~100 점수" theme={theme} />}
      {trust && (
        <>
          <Card title="신뢰 점수" theme={theme}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontSize: 56, fontWeight: 900, color: theme.accent, lineHeight: 1 }}>
                {trust.trust_score}
              </span>
              <span style={{ fontSize: 16, color: theme.textMuted }}>/ 100</span>
              {trust.overfitting_penalty < 0 && (
                <span style={{ marginLeft: 12, padding: "3px 10px", background: theme.accentSoft, color: theme.danger, borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                  과적합 패널티 {trust.overfitting_penalty}
                </span>
              )}
            </div>
            <p style={{ marginTop: 12, fontSize: 13, color: theme.text, lineHeight: 1.6 }}>{trust.narrative}</p>
          </Card>
          <Card title="ℹ️ Trust Score는 어떻게 계산되나요?" theme={theme}>
            <div style={{ fontSize: 12.5, color: theme.text, lineHeight: 1.75 }}>
              <p style={{ margin: "0 0 8px" }}>
                아래 5개 세부 점수(각 0~100)에 가중치를 곱해 합산한 뒤, <b>과적합 패널티</b>(최대 -10)를 차감해 최종 0~100점을 만듭니다.
              </p>
              <pre style={{
                margin: "6px 0 10px", padding: "8px 12px", background: theme.codeBg || "#f8fafc",
                border: `1px solid ${theme.panelBorder}`, borderRadius: 8, fontSize: 12, overflowX: "auto",
              }}>{`trust = 0.30·일반화 + 0.25·국면견고성 + 0.20·파라메터안정성 + 0.15·리스크통제 + 0.10·통계적유의성 − |과적합패널티|`}</pre>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li><b>일반화 (Generalization)</b> — Walk-Forward(In-Sample→Out-of-Sample)에서 OOS Sharpe가 IS와 얼마나 일관되나. 과거에 잘되던 게 미래에도 될지 검증.</li>
                <li><b>시장국면 견고성 (Regime Robustness)</b> — 4가지 시장 국면 중 가장 안 좋은 국면의 Sharpe가 얼마나 방어적인지.</li>
                <li><b>파라메터 안정성 (Parameter Stability)</b> — 주요 파라메터를 ±10% 흔들었을 때 결과가 크게 바뀌지 않는지.</li>
                <li><b>리스크 통제 (Risk Control)</b> — 목표 MDD를 잘 지켰는지, 손실 제한이 의도대로 작동했는지.</li>
                <li><b>통계적 유의성 (Statistical Confidence)</b> — 수익 평균이 0과 유의하게 다른가 (t-stat 기반).</li>
              </ul>
              <p style={{ margin: "10px 0 0", fontSize: 11.5, color: theme.textMuted }}>
                세부 점수 항목에 마우스를 올리면 개별 설명이 풍선으로 나타나요.
              </p>
            </div>
          </Card>
          <Card title="세부 점수" theme={theme}>
            {Object.entries(trust.sub_scores || {}).map(([k, v]) => (
              <SubScoreBar key={k} label={k} value={v} theme={theme} />
            ))}
          </Card>
          {trust.details && <TrustDetailsCard details={trust.details} theme={theme} />}
        </>
      )}
    </div>
  );
}
