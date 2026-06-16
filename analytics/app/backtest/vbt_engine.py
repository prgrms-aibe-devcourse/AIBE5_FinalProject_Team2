"""
vectorbt-based backtest engine.
Strategies (6 deterministic templates):
- buy_and_hold:   첫날 매수, 마지막 날까지 보유
- sma_cross:      SMA(fast) > SMA(slow) → long
- rsi_meanrev:    RSI < low → long, > high → exit
- macd:           MACD line crosses signal line
- momentum_12_1:  12개월 누적수익률 - 1개월 누적수익률 > 0 → long
- vix_risk_off:   VIX <= threshold → long, > threshold → exit (외부 VIX 시리즈 필요)
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Literal, Optional

import numpy as np
import pandas as pd
import vectorbt as vbt

from app.config import DEFAULT_INITIAL_CAPITAL, DEFAULT_FEES, DEFAULT_SLIPPAGE


StrategyType = Literal[
    "buy_and_hold", "sma_cross", "rsi_meanrev", "macd",
    "momentum_12_1", "vix_risk_off",
    "infinite_buying", "value_rebalancing",
    "momentum_rotation",
]


@dataclass
class BacktestParams:
    strategy: StrategyType = "sma_cross"
    sma_fast: int = 20
    sma_slow: int = 60
    rsi_period: int = 14
    rsi_low: int = 30
    rsi_high: int = 70
    macd_fast: int = 12
    macd_slow: int = 26
    macd_signal: int = 9
    momentum_long_days: int = 252   # ~12개월
    momentum_short_days: int = 21   # ~1개월
    vix_threshold: float = 25.0
    initial_capital: float = DEFAULT_INITIAL_CAPITAL
    fees: float = DEFAULT_FEES
    slippage: float = DEFAULT_SLIPPAGE
    # 무한매수법(infinite_buying) 파라미터 — run_backtest 가 전용 엔진으로 디스패치
    split: int = 40
    take_profit_pct: float = 10.0
    loc_offset_pct: float = 12.0
    # 밸류 리밸런싱(value_rebalancing) 파라미터
    rebalance_days: int = 10
    expected_return: float = 0.02
    band_pct: float = 0.20
    pool_target_pct: float = 0.50
    initial_pool_pct: float = 0.50
    biweekly_contrib: float = 0.0
    # 모멘텀 로테이션(momentum_rotation) 파라미터 — run_backtest 는 1-자산 universe 로 전용 엔진에 위임
    # (Trust/Regime 단일 close 경로 = 절대모멘텀 타이밍). 멀티자산 풀 로테이션은 /backtest/momentum-rotation.
    mom_lookback_days: int = 252
    mom_skip_days: int = 21
    mom_top_n: int = 3
    mom_rebalance_days: int = 21
    mom_abs_gate: bool = True
    mom_cash_asset: str = "BIL"


def _signals(
    close: pd.Series,
    p: BacktestParams,
    vix: Optional[pd.Series] = None,
) -> tuple[pd.Series, pd.Series]:
    """Returns (entries, exits) boolean series aligned to `close`."""
    if p.strategy == "buy_and_hold":
        entries = pd.Series(False, index=close.index)
        exits = pd.Series(False, index=close.index)
        entries.iloc[0] = True
        return entries, exits

    if p.strategy == "sma_cross":
        fast = vbt.MA.run(close, p.sma_fast).ma
        slow = vbt.MA.run(close, p.sma_slow).ma
        entries = fast.vbt.crossed_above(slow)
        exits = fast.vbt.crossed_below(slow)

    elif p.strategy == "rsi_meanrev":
        rsi = vbt.RSI.run(close, p.rsi_period).rsi
        entries = rsi.vbt.crossed_below(p.rsi_low)
        exits = rsi.vbt.crossed_above(p.rsi_high)

    elif p.strategy == "macd":
        macd = vbt.MACD.run(close, p.macd_fast, p.macd_slow, p.macd_signal)
        entries = macd.macd.vbt.crossed_above(macd.signal)
        exits = macd.macd.vbt.crossed_below(macd.signal)

    elif p.strategy == "momentum_12_1":
        # 12-month return minus 1-month return (Jegadeesh-Titman 변형)
        long_ret = close.pct_change(p.momentum_long_days)
        short_ret = close.pct_change(p.momentum_short_days)
        score = long_ret - short_ret
        in_pos = score > 0
        # state-based entries/exits
        entries = in_pos & ~in_pos.shift(1).fillna(False)
        exits = ~in_pos & in_pos.shift(1).fillna(False)

    elif p.strategy == "vix_risk_off":
        if vix is None:
            raise ValueError("vix_risk_off requires `vix` series")
        v = vix.reindex(close.index).ffill()
        risk_on = v <= p.vix_threshold
        entries = risk_on & ~risk_on.shift(1).fillna(False)
        exits = ~risk_on & risk_on.shift(1).fillna(False)

    else:
        raise ValueError(f"Unknown strategy {p.strategy}")

    return entries.fillna(False), exits.fillna(False)



def run_backtest(
    close: pd.Series,
    p: BacktestParams,
    vix: Optional[pd.Series] = None,
) -> dict:
    """
    Returns dict with stats + equity curve.
    Reference: vectorbt Portfolio.from_signals — pf.stats(), pf.returns(), pf.returns_stats().
    `vix` is required for strategy='vix_risk_off'.
    """
    # 무한매수법/밸류리밸런싱 — 시그널 기반이 아닌 '상태 누적' 전략이라 vbt from_signals 로
    # 표현 불가. 전용 엔진으로 디스패치하되, 반환 dict 는 run_backtest 와 동일 계약
    # (stats/equity_curve/_strategy_returns)이므로 Trust·Regime·Walk-Forward·섭동이 그대로 통과한다.
    if p.strategy == "infinite_buying":
        from app.backtest.infinite_buying import run_infinite_buying, InfiniteBuyingParams
        return run_infinite_buying({"ASSET": close}, InfiniteBuyingParams(
            split=p.split, take_profit_pct=p.take_profit_pct, loc_offset_pct=p.loc_offset_pct,
            initial_capital=p.initial_capital, fees=p.fees, slippage=p.slippage))
    if p.strategy == "value_rebalancing":
        from app.backtest.value_rebalancing import run_value_rebalancing, ValueRebalancingParams
        return run_value_rebalancing({"ASSET": close}, ValueRebalancingParams(
            rebalance_days=p.rebalance_days, expected_return=p.expected_return, band_pct=p.band_pct,
            pool_target_pct=p.pool_target_pct, initial_pool_pct=p.initial_pool_pct,
            biweekly_contrib=p.biweekly_contrib, initial_capital=p.initial_capital,
            fees=p.fees, slippage=p.slippage))
    if p.strategy == "momentum_rotation":
        # 단일 close 경로(Trust/Regime): 1-자산 universe → 절대모멘텀 타이밍(같은 엔진·동일 계약).
        # cash_asset 가 universe 에 없으므로 절대모멘텀<=0 이면 현금 대피. 멀티자산 풀 로테이션은
        # main.py /backtest/momentum-rotation 엔드포인트가 멀티티커로 직접 호출한다.
        from app.backtest.momentum_rotation import run_momentum_rotation, MomentumRotationParams
        return run_momentum_rotation({"ASSET": close}, MomentumRotationParams(
            lookback_days=p.mom_lookback_days, skip_recent_days=p.mom_skip_days,
            top_n=max(1, p.mom_top_n), rebalance_days=p.mom_rebalance_days,
            abs_momentum_gate=p.mom_abs_gate, cash_asset="__CASH__",
            initial_capital=p.initial_capital, fees=p.fees, slippage=p.slippage))

    entries, exits = _signals(close, p, vix=vix)
    # Look-ahead bias 방지: close로 생성한 신호는 1bar shift (vectorbt docs 권장)
    # buy_and_hold는 첫날 진입이므로 shift 시 다음 날로 밀리는 게 자연스럽다.
    # fshift는 첫 위치에 NaN을 만들어 dtype을 object로 바꿈 → fillna 후 bool로 강제 캐스팅 필수
    # (Numba가 object array를 njit으로 처리 못 해 TypingError 발생)
    entries = entries.vbt.fshift(1).fillna(False).astype(bool)
    exits = exits.vbt.fshift(1).fillna(False).astype(bool)
    # buy_and_hold: shift 이후에도 최소 1개 entry는 보장
    if p.strategy == "buy_and_hold" and not entries.any():
        entries.iloc[0] = True

    pf = vbt.Portfolio.from_signals(
        close,
        entries,
        exits,
        init_cash=p.initial_capital,
        fees=p.fees,
        slippage=p.slippage,
        freq="1D",
    )
    stats = pf.stats()
    eq = pf.value()
    strat_returns = pf.returns()  # strategy daily returns (after fees/slippage)

    def _f(x):
        try:
            v = float(x)
            return None if (np.isnan(v) or np.isinf(v)) else round(v, 4)
        except Exception:
            return None

    # Calmar fallback: vbt가 None/NaN 주는 경우가 쟦아 CAGR/|MDD|로 수동 재계산
    _calmar = _f(pf.calmar_ratio())
    if _calmar is None:
        try:
            a = float(pf.annualized_return() * 100)
            m = float(stats.get("Max Drawdown [%]"))
            if not np.isnan(a) and not np.isnan(m) and abs(m) > 1e-9:
                _calmar = round(a / abs(m), 4)
        except Exception:
            _calmar = None

    result = {
        "strategy": p.strategy,
        "params": {
            "sma_fast": p.sma_fast, "sma_slow": p.sma_slow,
            "rsi_period": p.rsi_period, "rsi_low": p.rsi_low, "rsi_high": p.rsi_high,
            "macd_fast": p.macd_fast, "macd_slow": p.macd_slow, "macd_signal": p.macd_signal,
            "momentum_long_days": p.momentum_long_days, "momentum_short_days": p.momentum_short_days,
            "vix_threshold": p.vix_threshold,
            "initial_capital": p.initial_capital,
        },
        "stats": {
            "total_return_pct": _f(stats.get("Total Return [%]")),
            "annualized_return_pct": _f(pf.annualized_return() * 100),
            "max_drawdown_pct": _f(stats.get("Max Drawdown [%]")),
            "sharpe": _f(pf.sharpe_ratio()),
            "sortino": _f(pf.sortino_ratio()),
            "calmar": _calmar,
            "win_rate_pct": _f(stats.get("Win Rate [%]")),
            "trades": int(stats.get("Total Trades", 0)),
            "start": str(close.index[0].date()),
            "end": str(close.index[-1].date()),
        },
        "equity_curve": [
            {"date": str(d.date()), "value": _f(v)}
            for d, v in eq.iloc[::max(1, len(eq) // 365)].items()  # downsample to ~1y daily points
        ],
        "_strategy_returns": strat_returns,  # internal: passed to QuantStats in main.py
    }
    # orders/trades + total_fees/volume (QC 대시보드용) — pf 가 있는 표준 경로에서만
    try:
        from app.backtest.enrich import orders_trades_from_pf
        ot = orders_trades_from_pf(pf, ticker="ASSET")
        result["orders"] = ot["orders"]
        result["trades"] = ot["trades"]
        result["orders_truncated"] = ot["orders_truncated"]
        if ot["total_fees"] is not None:
            result["stats"]["total_fees"] = ot["total_fees"]
        if ot["volume"] is not None:
            result["stats"]["volume"] = ot["volume"]
    except Exception:
        pass
    # 보유/현금/노출 시계열 + 보유평가액·미실현 (QC Holdings/Exposure/Margin 대시보드용)
    try:
        av = pf.asset_value()          # 보유 평가액(시가)
        csh = pf.cash()                # 현금
        _stp = max(1, len(eq) // 365)  # equity_curve 와 동일 다운샘플
        avd = av.iloc[::_stp]
        eqd = eq.iloc[::_stp]
        result["holdings_curve"] = [
            {"date": str(d.date()), "value": _f(v)} for d, v in avd.items()
        ]
        result["cash_curve"] = [
            {"date": str(d.date()), "value": _f(v)} for d, v in csh.iloc[::_stp].items()
        ]
        result["exposure_curve"] = [
            {"date": str(d.date()), "exposure_pct": _f((float(a) / float(ev) * 100.0) if ev else 0.0)}
            for (d, a), ev in zip(avd.items(), eqd.values)
        ]
        result["stats"]["holdings_value_end"] = _f(av.iloc[-1])
        result["stats"]["cash_end"] = _f(csh.iloc[-1])
        # 미실현 손익: 미청산(Open) 트레이드 PnL 합
        try:
            tr = pf.trades.records_readable
            if "Status" in tr.columns and "PnL" in tr.columns:
                _open = tr[tr["Status"].astype(str).str.lower() == "open"]
                result["stats"]["unrealized_pnl"] = _f(_open["PnL"].sum()) if len(_open) else 0.0
            else:
                result["stats"]["unrealized_pnl"] = None
        except Exception:
            result["stats"]["unrealized_pnl"] = None
    except Exception:
        pass
    return result


def latest_signal(
    close: pd.Series,
    p: BacktestParams,
    vix: Optional[pd.Series] = None,
) -> dict:
    """
    Determine today's signal: BUY / SELL / HOLD based on most recent crossover.
    Looks at last 5 bars for entry/exit events.
    """
    entries, exits = _signals(close, p, vix=vix)
    last5_entries = entries.iloc[-5:]
    last5_exits = exits.iloc[-5:]

    signal = "HOLD"
    reason = "최근 5거래일 내 신호 없음"
    if last5_entries.iloc[-1]:
        signal = "BUY"
        reason = f"오늘 {p.strategy} 매수 시그널 발생"
    elif last5_exits.iloc[-1]:
        signal = "SELL"
        reason = f"오늘 {p.strategy} 매도 시그널 발생"
    elif last5_entries.any():
        signal = "BUY"
        reason = "최근 5일 내 매수 시그널 (포지션 진입 권장)"
    elif last5_exits.any():
        signal = "SELL"
        reason = "최근 5일 내 매도 시그널 (포지션 정리 권장)"

    return {
        "signal": signal,
        "reason": reason,
        "last_close": float(close.iloc[-1]),
        "last_date": str(close.index[-1].date()),
    }
