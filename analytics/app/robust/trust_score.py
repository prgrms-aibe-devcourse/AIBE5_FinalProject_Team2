"""
Trust Score (0~100) — Alpha-Helix's signature signal.

Composite of 5 sub-scores + overfitting penalty:
  - Generalization (out-of-sample consistency from walk-forward)
  - Regime Robustness (worst-regime Sharpe vs best-regime Sharpe)
  - Parameter Stability (variance under small param perturbations)
  - Risk Control (max drawdown vs target)
  - Statistical Confidence (t-stat of OOS returns)
  - Overfitting Penalty (in-sample vs out-of-sample gap)

This is a research-grade composite score — useful for distinguishing strategies
that "look good in backtest" from those with broader robustness, but NOT a
guarantee of future performance.
"""
from __future__ import annotations
from typing import Dict, Any
import numpy as np
import pandas as pd

from app.backtest.vbt_engine import BacktestParams, run_backtest
from app.robust.walkforward import walk_forward
from app.robust.regime import per_regime_stats


def _clip01(x: float) -> float:
    return float(max(0.0, min(1.0, x)))


def compute_trust_score(close: pd.Series, params: BacktestParams,
                        mdd_target_pct: float = 25.0) -> Dict[str, Any]:
    # 1) full in-sample
    is_bt = run_backtest(close, params)
    is_sharpe = is_bt["stats"].get("sharpe", 0) or 0
    is_total = is_bt["stats"].get("total_return_pct", 0) or 0
    is_mdd = is_bt["stats"].get("max_drawdown_pct", 0) or 0  # negative %

    # 2) walk-forward
    wf = walk_forward(close, params, train_window=252, test_window=63)
    valid_folds = [f for f in wf["folds"] if "stats" in f and f["stats"].get("sharpe") is not None]
    if valid_folds:
        oos_sharpes = [f["stats"]["sharpe"] for f in valid_folds]
        oos_returns = [f["stats"]["total_return_pct"] for f in valid_folds]
        oos_sharpe_mean = float(np.mean(oos_sharpes))
        oos_sharpe_std = float(np.std(oos_sharpes))
        # statistical confidence: t-stat of OOS returns vs 0
        if len(oos_returns) >= 3 and np.std(oos_returns) > 0:
            tstat = float(np.mean(oos_returns) / (np.std(oos_returns) / np.sqrt(len(oos_returns))))
        else:
            tstat = 0.0
    else:
        oos_sharpe_mean = oos_sharpe_std = tstat = 0.0

    # 3) regime
    regime = per_regime_stats(close, params)
    regime_sharpes = [v["sharpe"] for v in regime["per_regime"].values() if isinstance(v, dict) and "sharpe" in v]
    if len(regime_sharpes) >= 2:
        worst = min(regime_sharpes)
        best = max(regime_sharpes)
        regime_robust = _clip01((worst + 1) / 3.0)  # worst sharpe -1→0, +2→1
    else:
        worst = best = 0
        regime_robust = 0.5

    # 4) parameter stability — 전략별 핵심 파라미터 섭동 ±5%/±10%
    # 기존: sma_slow 만 섭동 → RSI/MACD 전략에서 의미 없음
    # 개선: strategy_type에 맞는 핵심 파라미터를 섭동
    perturb_sharpes = []
    deltas = [-0.10, -0.05, 0.05, 0.10]

    def _perturb(base_params: BacktestParams, delta: float) -> BacktestParams:
        """전략별 핵심 파라미터 1개를 delta 비율로 섭동한 새 BacktestParams 반환."""
        s = base_params.strategy
        if s in ("sma_cross", "momentum_12_1", "buy_and_hold"):
            return BacktestParams(
                strategy=s,
                sma_fast=params.sma_fast,
                sma_slow=max(5, int(params.sma_slow * (1 + delta))),
                rsi_period=params.rsi_period, rsi_low=params.rsi_low, rsi_high=params.rsi_high,
                macd_fast=params.macd_fast, macd_slow=params.macd_slow, macd_signal=params.macd_signal,
            )
        elif s == "rsi_meanrev":
            # RSI 전략: rsi_period 섭동
            return BacktestParams(
                strategy=s,
                sma_fast=params.sma_fast, sma_slow=params.sma_slow,
                rsi_period=max(3, int(params.rsi_period * (1 + delta))),
                rsi_low=params.rsi_low, rsi_high=params.rsi_high,
                macd_fast=params.macd_fast, macd_slow=params.macd_slow, macd_signal=params.macd_signal,
            )
        elif s == "macd":
            # MACD 전략: macd_slow 섭동 (signal 기간이 핵심)
            return BacktestParams(
                strategy=s,
                sma_fast=params.sma_fast, sma_slow=params.sma_slow,
                rsi_period=params.rsi_period, rsi_low=params.rsi_low, rsi_high=params.rsi_high,
                macd_fast=params.macd_fast,
                macd_slow=max(params.macd_fast + 2, int(params.macd_slow * (1 + delta))),
                macd_signal=params.macd_signal,
            )
        elif s == "vix_risk_off":
            # VIX 전략: vix_threshold 섭동
            return BacktestParams(
                strategy=s,
                sma_fast=params.sma_fast, sma_slow=params.sma_slow,
                rsi_period=params.rsi_period, rsi_low=params.rsi_low, rsi_high=params.rsi_high,
                macd_fast=params.macd_fast, macd_slow=params.macd_slow, macd_signal=params.macd_signal,
                vix_threshold=max(10.0, params.vix_threshold * (1 + delta)),
            )
        else:
            return BacktestParams(
                strategy=s,
                sma_fast=params.sma_fast,
                sma_slow=max(5, int(params.sma_slow * (1 + delta))),
                rsi_period=params.rsi_period, rsi_low=params.rsi_low, rsi_high=params.rsi_high,
                macd_fast=params.macd_fast, macd_slow=params.macd_slow, macd_signal=params.macd_signal,
            )

    for delta in deltas:
        try:
            p2 = _perturb(params, delta)
            r = run_backtest(close, p2)
            perturb_sharpes.append(r["stats"].get("sharpe", 0) or 0)
        except Exception:
            pass
    if perturb_sharpes:
        param_var = float(np.std(perturb_sharpes))
        param_stability = _clip01(1.0 - param_var)  # 작은 변동 = 안정
    else:
        param_stability = 0.5

    # 5) risk control — actual MDD vs target
    risk_control = _clip01(1.0 - max(0, abs(is_mdd) - mdd_target_pct) / 50.0)

    # 6) generalization — OOS sharpe / IS sharpe ratio
    if is_sharpe > 0.1:
        gen_ratio = oos_sharpe_mean / is_sharpe
        generalization = _clip01((gen_ratio + 0.5) / 2.0)  # 1.0 ratio → 0.75
    else:
        generalization = _clip01((oos_sharpe_mean + 1) / 3.0)

    # 7) statistical confidence — |tstat| ≥ 2 → 1.0
    statistical_confidence = _clip01(abs(tstat) / 2.5)

    # 8) overfitting penalty — IS sharpe much higher than OOS
    if is_sharpe > 0.1 and oos_sharpe_mean is not None:
        gap = max(0, is_sharpe - oos_sharpe_mean)
        overfit_penalty_pts = -min(15, int(gap * 15))  # 최대 -15점
    else:
        overfit_penalty_pts = 0

    # 가중 합산 (각 0~100)
    sub = {
        "generalization": int(round(generalization * 100)),
        "regime_robustness": int(round(regime_robust * 100)),
        "parameter_stability": int(round(param_stability * 100)),
        "risk_control": int(round(risk_control * 100)),
        "statistical_confidence": int(round(statistical_confidence * 100)),
    }
    base = int(round(
        sub["generalization"] * 0.25 +
        sub["regime_robustness"] * 0.20 +
        sub["parameter_stability"] * 0.15 +
        sub["risk_control"] * 0.20 +
        sub["statistical_confidence"] * 0.20
    ))
    score = max(0, min(100, base + overfit_penalty_pts))

    # 자연어 요약
    weakest_metric = min(sub, key=sub.get)
    metric_ko = {
        "generalization": "out-of-sample 일반화",
        "regime_robustness": "시장국면 견고성",
        "parameter_stability": "파라미터 안정성",
        "risk_control": "리스크 통제",
        "statistical_confidence": "통계적 유의성",
    }
    narrative = (f"이 전략의 Trust Score는 {score}점입니다. 강점은 "
                 f"{metric_ko[max(sub, key=sub.get)]}({sub[max(sub, key=sub.get)]}점)이고, "
                 f"가장 보완이 필요한 부분은 {metric_ko[weakest_metric]}({sub[weakest_metric]}점)입니다.")
    if overfit_penalty_pts < 0:
        narrative += f" 인-샘플과 OOS 성과 격차로 과적합 패널티 {overfit_penalty_pts}점이 적용되었습니다."

    return {
        "trust_score": int(score),
        "sub_scores": sub,
        "overfitting_penalty": int(overfit_penalty_pts),
        "narrative": narrative,
        "details": {
            "in_sample_sharpe": round(float(is_sharpe), 2),
            "in_sample_total_return_pct": round(float(is_total), 2),
            "in_sample_mdd_pct": round(float(is_mdd), 2),
            "oos_sharpe_mean": round(float(oos_sharpe_mean), 2),
            "oos_sharpe_std": round(float(oos_sharpe_std), 2),
            "tstat": round(float(tstat), 2),
            "regime_worst_sharpe": round(float(worst), 2) if regime_sharpes else None,
            "regime_best_sharpe": round(float(best), 2) if regime_sharpes else None,
        },
    }
