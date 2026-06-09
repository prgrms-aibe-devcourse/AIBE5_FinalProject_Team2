"""
북극성 검증: codegen 생성코드 실행 결과 == 라이브 엔진 결과.

generate_portfolio_strategy(config) 로 만든 독립 .py 를 exec 해 run() 을 얻고,
같은 closes/highs/params 로 엔진(run_infinite_buying)을 돌려 stats·equity_curve 가
완전 일치하는지 검증한다(같은 알고리즘 미러링이므로 rtol≈0).
"""
from __future__ import annotations
import pandas as pd

from app.backtest.infinite_buying import run_infinite_buying, InfiniteBuyingParams
from app.codegen import generate_portfolio_strategy


def _exec_generated(code: str):
    ns: dict = {}
    exec(compile(code, "<gen_ib>", "exec"), ns)
    return ns["run"]


def _ib_parity(close: pd.Series, high: pd.Series):
    params = InfiniteBuyingParams(split=40, take_profit_pct=10.0, loc_offset_pct=12.0,
                                  initial_capital=10_000.0, fees=0.0025, slippage=0.001)
    eng = run_infinite_buying({"T": close}, params, highs={"T": high})

    config = {"tickers": ["T"], "split": 40, "take_profit_pct": 10.0, "loc_offset_pct": 12.0,
              "initial_capital": 10_000.0, "fees": 0.0025, "slippage": 0.001}
    code = generate_portfolio_strategy("infinite_buying", config)
    gen_run = _exec_generated(code)
    gen = gen_run({"T": close}, highs={"T": high})

    es, gs = eng["stats"], gen["stats"]
    for k in ("final_equity", "total_return_pct", "max_drawdown_pct", "sharpe",
              "volatility_pct", "win_rate_pct", "trades", "cycles_completed"):
        assert es[k] == gs[k], f"stats mismatch {k}: engine={es[k]} gen={gs[k]}"

    ec, gc = eng["equity_curve"], gen["equity_curve"]
    assert len(ec) == len(gc), f"equity_curve len {len(ec)} vs {len(gc)}"
    for a, b in zip(ec, gc):
        assert a["date"] == b["date"] and a["value"] == b["value"], f"equity point {a} vs {b}"
    return es, gs


def test_ib_parity_synthetic():
    """네트워크 없는 결정적 검증(합성 가격)."""
    import numpy as np
    rng = np.random.RandomState(11)
    idx = pd.bdate_range("2016-01-01", periods=1800)
    close = pd.Series(np.cumprod(1 + rng.normal(0.0005, 0.02, len(idx))) * 70, index=idx)
    high = close * (1 + np.abs(rng.normal(0, 0.01, len(idx))))
    es, gs = _ib_parity(close, high)
    assert gs["trades"] > 0


if __name__ == "__main__":
    # 실데이터(TQQQ) parity — Polygon 키 필요
    from app.data.yf_client import get_history
    df = get_history("TQQQ", period="10y")
    es, gs = _ib_parity(df["Close"], df["High"])
    print("TQQQ IB parity OK — engine == generated")
    print("  final_equity:", es["final_equity"], "| return%:", es["total_return_pct"],
          "| trades:", es["trades"], "| cycles:", es["cycles_completed"], "| sharpe:", es["sharpe"])
    test_ib_parity_synthetic()
    print("synthetic IB parity OK")
    print("=== P5 codegen↔engine PARITY PASS ===")
