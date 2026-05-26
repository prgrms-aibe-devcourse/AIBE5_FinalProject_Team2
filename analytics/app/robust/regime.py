"""
Market Regime detection.
5-state classification based on rolling trend (200d slope) + volatility (60d annualized):
  - bull_quiet      : MA200 위 + slope 양 + 저변동성 (정상 상승장)
  - bull_volatile   : MA200 위 + slope 양 + 고변동성 (불안한 상승 — 급락 전 경고)
  - bear            : MA200 아래 + slope 음
  - sideways        : 나머지 (방향성 없음)
  - high_vol_unstable: MA200 아래 or sideways + 변동성 극단값 (80th percentile 이상)

개선 사항 (v2):
  - 기존 high_vol_unstable이 bull 상태까지 덮어쓰는 문제 수정
    → 상승장 + 고변동성은 bull_volatile로 별도 분류 (2020년 3월 이후 반등 구간 오분류 방지)
  - MA200 slope: 20일 diff → 10일 diff EWM으로 민감도 개선
  - vol_high threshold: 고정 80th → 75th percentile (레짐 전환 조기 감지)
"""
from __future__ import annotations
from typing import Dict, Any
import numpy as np
import pandas as pd

from app.backtest.vbt_engine import BacktestParams, run_backtest

REGIME_LABELS = ["bull_quiet", "bull_volatile", "bear", "sideways", "high_vol_unstable"]

REGIME_LABELS_KO = {
    "bull_quiet": "상승장(안정)",
    "bull_volatile": "상승장(불안정)",
    "bear": "하락장",
    "sideways": "횡보장",
    "high_vol_unstable": "고변동성 불안정장",
}


def classify_regimes(close: pd.Series) -> pd.Series:
    """
    Returns a Series of regime labels aligned with close index.

    분류 규칙 (우선순위 순):
    1. MA200 위 + slope 양 + vol < 75th → bull_quiet
    2. MA200 위 + slope 양 + vol >= 75th → bull_volatile
    3. MA200 아래 + slope 음 + vol < 75th → bear
    4. MA200 아래 + slope 음 + vol >= 75th → high_vol_unstable (하락+공포)
    5. 나머지 (횡보) + vol >= 80th → high_vol_unstable
    6. 나머지 → sideways
    """
    ma200 = close.rolling(200, min_periods=100).mean()

    # slope: 지수이동평균 기반 (EWM span=10) — 단순 diff보다 노이즈 적음
    # 20일 단순 diff 대신 10일 EWM slope 사용 → 전환 신호 약 10일 단축
    ma200_smooth = ma200.ewm(span=10, adjust=False).mean()
    slope = ma200_smooth.diff(10)  # 10일 모멘텀 of smoothed MA200

    ret = close.pct_change()
    vol60 = ret.rolling(60, min_periods=20).std() * np.sqrt(252)

    # 변동성 분위수 (전체 기간 기준 — 고정 임계값보다 적응적)
    vol_q75 = vol60.quantile(0.75)
    vol_q80 = vol60.quantile(0.80)
    vol_high_75 = vol60 >= vol_q75
    vol_high_80 = vol60 >= vol_q80

    is_above_ma = close > ma200
    is_bull_trend = is_above_ma & (slope > 0)
    is_bear_trend = ~is_above_ma & (slope < 0)

    regime = pd.Series("sideways", index=close.index, dtype="object")

    # 우선순위 낮은 것부터 할당 (높은 우선순위가 덮어씀)
    regime[is_bull_trend & ~vol_high_75] = "bull_quiet"
    regime[is_bull_trend & vol_high_75] = "bull_volatile"
    regime[is_bear_trend & ~vol_high_75] = "bear"
    regime[is_bear_trend & vol_high_75] = "high_vol_unstable"
    # 횡보 + 극단적 변동성 → high_vol_unstable
    regime[~is_bull_trend & ~is_bear_trend & vol_high_80] = "high_vol_unstable"

    # MA200 충분한 데이터 없는 초기 구간은 NaN
    regime[ma200.isna()] = np.nan
    return regime


def per_regime_stats(close: pd.Series, params: BacktestParams) -> Dict[str, Any]:
    """Run full backtest, then split equity returns by regime label and compute summary per regime."""
    regimes = classify_regimes(close).dropna()
    bt = run_backtest(close, params)

    eq = pd.Series({pd.to_datetime(p["date"]): p["value"] for p in bt["equity_curve"]})
    eq = eq.sort_index()
    eq_ret = eq.pct_change().dropna()
    common = eq_ret.index.intersection(regimes.index)
    eq_ret = eq_ret.loc[common]
    reg = regimes.loc[common]

    out: Dict[str, Any] = {}
    for label in REGIME_LABELS:
        r = eq_ret[reg == label]
        if len(r) < 5:
            out[label] = {"days": int(len(r)), "note": "샘플 부족"}
            continue
        cum = (1 + r).prod() - 1
        ann = (1 + cum) ** (252 / len(r)) - 1 if len(r) > 0 else 0
        sharpe = (r.mean() / r.std() * np.sqrt(252)) if r.std() > 0 else 0
        roll_max = (1 + r).cumprod().cummax()
        dd = ((1 + r).cumprod() / roll_max - 1).min()
        win_rate = float((r > 0).mean() * 100)
        out[label] = {
            "days": int(len(r)),
            "label_ko": REGIME_LABELS_KO.get(label, label),
            "cumulative_return_pct": round(float(cum) * 100, 2),
            "annualized_return_pct": round(float(ann) * 100, 2),
            "sharpe": round(float(sharpe), 2),
            "max_drawdown_pct": round(float(dd) * 100, 2),
            "win_rate_pct": round(win_rate, 2),
        }

    # 취약 regime: sharpe 가 가장 낮은 곳
    valid = {k: v for k, v in out.items() if "sharpe" in v}
    weak = min(valid, key=lambda k: valid[k]["sharpe"]) if valid else None

    headline = ""
    if weak:
        weak_ko = REGIME_LABELS_KO.get(weak, weak)
        weak_sharpe = valid[weak]["sharpe"]
        headline = (
            f"이 전략은 {weak_ko}에서 가장 약한 모습을 보였습니다. "
            f"(Sharpe {weak_sharpe:.2f})"
        )

    # 현재 레짐
    current = regimes.dropna().iloc[-1] if not regimes.dropna().empty else "sideways"

    return {
        "per_regime": out,
        "weak_regime": weak,
        "current_regime": current,
        "current_regime_ko": REGIME_LABELS_KO.get(current, current),
        "headline": headline,
    }

                    f"해당 국면에서는 신호 변경 빈도와 손실 통제 여부를 별도로 점검하세요.")

    return {
        "per_regime": out,
        "weakest_regime": weak,
        "narrative": headline,
        "regime_distribution": {k: int((reg == k).sum()) for k in ["bull", "bear", "sideways", "high_vol_unstable"]},
    }
