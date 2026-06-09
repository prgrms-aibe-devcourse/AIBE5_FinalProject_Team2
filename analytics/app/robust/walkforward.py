"""
Rolling out-of-sample (OOS) validation.

두 모드:
  • reoptimize=False (기본, 하위호환): 모든 폴드가 동일 고정 params 로 test 구간만 평가. 이름은
    "walk-forward" 지만 파라미터 재최적화는 안 한다 — "시간대별 OOS 일관성"을 측정.
  • reoptimize=True (정통 워크포워드): 각 폴드의 **train 구간에서 소그리드로 파라미터를 재최적화**
    (IS Sharpe 최대화)한 뒤 그 best_params 로 **future test 구간을 평가**. train≪test 시간순서를
    지켜 진짜 OOS — 과최적화의 OOS 붕괴(IS≫OOS gap)를 포착한다.

train_window 는 (reoptimize=False)에선 단순 오프셋, (reoptimize=True)에선 직전 train 구간 길이.
"""
from __future__ import annotations
import dataclasses
from typing import Optional
import numpy as np
import pandas as pd

from app.backtest.vbt_engine import BacktestParams, run_backtest


def _scaled_params(params: BacktestParams, key: str, mult: float) -> BacktestParams:
    """params 를 복제하고 한 필드 key 를 mult 배로 스케일(타입 보존·최소값 가드)."""
    base = getattr(params, key, None)
    if base is None:
        return params
    if isinstance(base, bool):
        return params
    if isinstance(base, int):
        newval: float = max(1, int(round(base * mult)))
    else:
        newval = float(base) * mult
    try:
        return dataclasses.replace(params, **{key: newval})
    except Exception:
        return params


def _iter_grid(params: BacktestParams, param_grid: dict):
    """param_grid={key:[mult,...]} 단일축 소그리드 → [(label, params), ...]."""
    out = []
    for key, mults in param_grid.items():
        for m in mults:
            out.append((f"{key}×{m:g}", _scaled_params(params, key, m)))
    return out


def walk_forward(
    close: pd.Series,
    params: BacktestParams,
    train_window: int = 252,  # 1 year trading days
    test_window: int = 63,    # 1 quarter
    reoptimize: bool = False,
    param_grid: Optional[dict] = None,
) -> dict:
    """
    시리즈를 rolling [train_window | test_window] 폴드로 나눈다.
    reoptimize=False: 모든 폴드 동일 params 로 test 평가(오프셋=train_window).
    reoptimize=True + param_grid: 각 폴드 train 구간서 IS Sharpe 최대 params 선택→test 평가.
    """
    n = len(close)
    folds = []
    start = 0
    while start + train_window + test_window <= n:
        test_slice = close.iloc[start + train_window: start + train_window + test_window]
        eval_params = params
        chosen = None
        if reoptimize and param_grid:
            train_slice = close.iloc[start: start + train_window]
            best = None  # (sharpe, params, label)
            for label, cand in _iter_grid(params, param_grid):
                try:
                    sr = run_backtest(train_slice, cand)["stats"].get("sharpe")
                except Exception:
                    sr = None
                if sr is not None and (best is None or sr > best[0]):
                    best = (sr, cand, label)
            # train 구간 신호 0(전부 None)이면 고정 params 폴백
            if best is not None:
                eval_params = best[1]
                chosen = best[2]
        try:
            res = run_backtest(test_slice, eval_params)["stats"]
        except Exception as e:
            res = {"error": str(e)}
        folds.append({
            "fold": len(folds) + 1,
            "test_start": str(test_slice.index[0].date()),
            "test_end": str(test_slice.index[-1].date()),
            "stats": res,
            "chosen_params": chosen,   # reoptimize 시 폴드별 선택 파라미터(없으면 None)
        })
        start += test_window

    # Aggregate
    valid = [f["stats"] for f in folds if "error" not in f["stats"] and f["stats"].get("sharpe") is not None]
    if not valid:
        return {"folds": folds, "summary": None}

    def avg(key):
        vals = [s[key] for s in valid if s.get(key) is not None]
        return round(float(np.mean(vals)), 4) if vals else None

    summary = {
        "n_folds": len(folds),
        "n_valid": len(valid),
        "avg_total_return_pct": avg("total_return_pct"),
        "avg_sharpe": avg("sharpe"),
        "avg_max_drawdown_pct": avg("max_drawdown_pct"),
        "avg_win_rate_pct": avg("win_rate_pct"),
    }
    return {"folds": folds, "summary": summary}
