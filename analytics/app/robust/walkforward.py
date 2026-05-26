"""
Walk-forward validation: train on rolling window, test on next.
Returns out-of-sample stats per fold.
"""
from __future__ import annotations
import numpy as np
import pandas as pd

from app.backtest.vbt_engine import BacktestParams, run_backtest


def walk_forward(
    close: pd.Series,
    params: BacktestParams,
    train_window: int = 252,  # 1 year trading days
    test_window: int = 63,    # 1 quarter
) -> dict:
    """
    Splits series into rolling [train | test] folds, runs backtest only on test segment.
    """
    n = len(close)
    folds = []
    start = 0
    while start + train_window + test_window <= n:
        test_slice = close.iloc[start + train_window: start + train_window + test_window]
        try:
            res = run_backtest(test_slice, params)["stats"]
        except Exception as e:
            res = {"error": str(e)}
        folds.append({
            "fold": len(folds) + 1,
            "test_start": str(test_slice.index[0].date()),
            "test_end": str(test_slice.index[-1].date()),
            "stats": res,
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
