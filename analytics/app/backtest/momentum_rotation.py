"""
모멘텀 로테이션 (Momentum Rotation) — 멀티자산 상대강도 랭킹 로테이션.

핵심 규칙:
  - 매 rebalance_days(영업일)마다 각 위험자산의 12-1 모멘텀
        mom_t = price_{t-skip} / price_{t-lookback} - 1   (최근 skip일 제외 룩백 수익률)
    을 계산해 내림차순 랭킹.
  - 상위 top_n 자산을 동일가중(1/top_n) 보유, 나머지 전량 매도.
  - 절대모멘텀 게이트(abs_momentum_gate=True): 선택된 자산이라도 모멘텀<=0 이면
    그 슬롯을 현금성 자산(cash_asset, 예 BIL/SHY)으로 대피(리스크오프). 현금성 자산이
    universe 에 없으면 그 슬롯은 미배분 현금으로 남긴다.
  - 리밸런싱일 사이에는 보유 유지(관망).

현업 정규화 (infinite_buying / value_rebalancing 과 100% 동일 계약):
  - 정수 주(株) 매매 (소수주 금지), 수수료 0.25% + 슬리피지 0.10% 양방향.
  - 룩어헤드 방지: 모멘텀은 과거(>=skip일 지연) 가격만 사용 → 당일 종가 체결 무편향.
  - 반환 dict 형태 = VR/IB 와 동일 (stats / per_ticker / equity_curve / recent_trades /
    _strategy_returns) → enrich_result · Trust · Regime · Walk-Forward · 섭동이 무수정 통과.
"""
from __future__ import annotations
from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass
class MomentumRotationParams:
    lookback_days: int = 252        # 룩백 (≈12개월)
    skip_recent_days: int = 21      # 최근 제외 (≈1개월) — 12-1 모멘텀
    top_n: int = 3                  # 보유 종목 수 (동일가중)
    rebalance_days: int = 21        # 리밸런싱 주기 (영업일, 월간)
    abs_momentum_gate: bool = True  # 절대모멘텀<=0 이면 현금 대피(리스크오프)
    cash_asset: str = "BIL"         # 대피 자산 (universe 에 있으면 보유, 없으면 현금)
    initial_capital: float = 10_000.0
    fees: float = 0.0025            # 0.25%
    slippage: float = 0.001         # 0.10%


def _round(x, n=4):
    try:
        v = float(x)
        return None if (np.isnan(v) or np.isinf(v)) else round(v, n)
    except Exception:
        return None


def run_momentum_rotation(closes: dict[str, pd.Series], p: MomentumRotationParams) -> dict:
    """
    closes: {ticker: pd.Series of daily close (DatetimeIndex)} — 멀티자산 유니버스.
    """
    tickers = list(closes.keys())
    if not tickers:
        raise ValueError("at least one ticker required")

    df = pd.concat({t: closes[t] for t in tickers}, axis=1).sort_index().ffill().dropna(how="all")
    if len(df) < 2:
        raise ValueError("not enough price history")

    cash_in_universe = p.cash_asset in df.columns
    risk_assets = [t for t in tickers if t != p.cash_asset] or list(tickers)

    # 12-1 모멘텀 (과거 가격만 사용 → 룩어헤드 없음)
    look = max(2, int(p.lookback_days))
    skip = max(0, min(int(p.skip_recent_days), look - 1))
    mom = (df.shift(skip) / df.shift(look)) - 1.0

    # 포트폴리오 상태
    cash = float(p.initial_capital)
    shares: dict[str, int] = {t: 0 for t in tickers}
    cost_basis: dict[str, float] = {t: 0.0 for t in tickers}
    realized: dict[str, float] = {t: 0.0 for t in tickers}
    trades: list = []
    sell_pnls: list[float] = []
    days_since_reb = 0
    rebalances = 0
    current_target: dict[str, float] = {}

    equity_history: list = []
    top_n = max(1, int(p.top_n))
    slot_w = 1.0 / top_n

    def avg_price(t: str) -> float:
        return cost_basis[t] / shares[t] if shares[t] > 0 else 0.0

    def compute_target(i: int) -> dict[str, float]:
        row_mom = mom.iloc[i]
        ranked = [(t, row_mom.get(t)) for t in risk_assets]
        ranked = [(t, float(m)) for t, m in ranked if m is not None and not pd.isna(m)]
        ranked.sort(key=lambda x: x[1], reverse=True)
        picks = ranked[:top_n]
        tgt: dict[str, float] = {}
        for t, m in picks:
            if p.abs_momentum_gate and m <= 0:
                if cash_in_universe:
                    tgt[p.cash_asset] = tgt.get(p.cash_asset, 0.0) + slot_w
                # 현금성 자산이 universe 에 없으면 그 슬롯은 미배분 현금
            else:
                tgt[t] = tgt.get(t, 0.0) + slot_w
        return tgt

    def sell(t: str, ts, price: float, qty: int, reason: str):
        nonlocal cash
        if qty <= 0:
            return
        sell_price = price * (1.0 - p.slippage)
        proceeds = qty * sell_price
        fee = proceeds * p.fees
        net = proceeds - fee
        pnl = net - avg_price(t) * qty
        realized[t] += pnl
        sell_pnls.append(pnl)
        cost_basis[t] = max(0.0, cost_basis[t] - avg_price(t) * qty)
        shares[t] -= qty
        if shares[t] <= 0:
            shares[t] = 0
            cost_basis[t] = 0.0
        cash += net
        trades.append({"date": str(ts.date()), "ticker": t, "side": "SELL",
                       "price": _round(sell_price), "qty": qty, "amount": _round(net), "reason": reason})

    def buy(t: str, ts, price: float, budget: float, reason: str):
        nonlocal cash
        buy_price = price * (1.0 + p.slippage)
        budget = min(budget, cash)
        qty = int(budget // (buy_price * (1.0 + p.fees)))
        if qty <= 0:
            return
        cost = qty * buy_price
        fee = cost * p.fees
        if cost + fee > cash:
            return
        shares[t] += qty
        cost_basis[t] += cost + fee
        cash -= cost + fee
        trades.append({"date": str(ts.date()), "ticker": t, "side": "BUY",
                       "price": _round(buy_price), "qty": qty, "amount": _round(cost + fee), "reason": reason})

    for i, (ts, row) in enumerate(df.iterrows()):
        mom_ready = bool(mom.iloc[i].dropna().shape[0])
        do_reb = mom_ready and (days_since_reb >= p.rebalance_days or not current_target)

        if do_reb:
            target = compute_target(i)
            if target:
                current_target = target
                port_value = cash + sum(shares[t] * float(row.get(t) or 0) for t in tickers)
                # 1) 목표에 없는 자산 전량 매도 (로테이션 이탈)
                for t in tickers:
                    if shares[t] > 0 and t not in target:
                        px = row.get(t)
                        if px is not None and not pd.isna(px) and px > 0:
                            sell(t, ts, float(px), shares[t], "rot_exit")
                # 2) 초과 비중 트림(매도)
                for t, wgt in target.items():
                    px = row.get(t)
                    if px is None or pd.isna(px) or px <= 0:
                        continue
                    px = float(px)
                    over = shares[t] * px - port_value * wgt
                    if over > px:
                        qty = int(min(over // (px * (1.0 - p.slippage)), shares[t]))
                        sell(t, ts, px, qty, "rot_trim")
                # 3) 부족 비중 매수
                for t, wgt in target.items():
                    px = row.get(t)
                    if px is None or pd.isna(px) or px <= 0:
                        continue
                    px = float(px)
                    need = port_value * wgt - shares[t] * px
                    if need > px:
                        buy(t, ts, px, need, "rot_enter")
                rebalances += 1
                days_since_reb = 0
            else:
                days_since_reb += 1
        else:
            days_since_reb += 1

        total_eq = cash + sum(shares[t] * float(row.get(t) or 0) for t in tickers)
        equity_history.append((ts, total_eq))

    eq_series = pd.Series([v for _, v in equity_history], index=[d for d, _ in equity_history])
    daily_ret = eq_series.pct_change().fillna(0.0)

    total_return_pct = (eq_series.iloc[-1] / p.initial_capital - 1.0) * 100.0
    days = (eq_series.index[-1] - eq_series.index[0]).days or 1
    years = days / 365.25
    cagr_pct = (((eq_series.iloc[-1] / p.initial_capital) ** (1.0 / years) - 1.0) * 100.0
                if years > 0 and eq_series.iloc[-1] > 0 else 0.0)
    roll_max = eq_series.cummax()
    mdd_pct = ((eq_series / roll_max) - 1.0).min() * 100.0
    vol_annual = daily_ret.std() * np.sqrt(252) * 100.0
    sharpe = daily_ret.mean() / daily_ret.std() * np.sqrt(252) if daily_ret.std() > 0 else 0.0
    downside = daily_ret[daily_ret < 0].std()
    sortino = daily_ret.mean() / downside * np.sqrt(252) if downside and downside > 0 else 0.0

    if sell_pnls:
        win_rate = sum(1 for x in sell_pnls if x > 0) / len(sell_pnls) * 100.0
    else:
        win_rate = (daily_ret > 0).sum() / max(1, (daily_ret != 0).sum()) * 100.0

    total_trades = len(trades)
    realized_total = sum(realized.values())
    months = max(1.0, days / 30.4375)
    monthly_cashflow = realized_total / months

    step = max(1, len(eq_series) // 365)
    eq_points = [{"date": str(d.date()), "value": _round(v)} for d, v in eq_series.iloc[::step].items()]

    trades.sort(key=lambda x: x["date"])
    recent_trades = trades[-50:]

    last_mom = mom.iloc[-1]
    per_ticker_summary = {
        t: {
            "qty_open": shares[t],
            "avg_price": _round(avg_price(t)),
            "realized_pnl": _round(realized[t]),
            "trade_count": sum(1 for tr in trades if tr["ticker"] == t),
            "momentum": _round(last_mom.get(t)),
            "in_portfolio": shares[t] > 0,
        }
        for t in tickers
    }

    return {
        "strategy": "momentum_rotation",
        "tickers": tickers,
        "params": {
            "lookback_days": p.lookback_days,
            "skip_recent_days": p.skip_recent_days,
            "top_n": p.top_n,
            "rebalance_days": p.rebalance_days,
            "abs_momentum_gate": p.abs_momentum_gate,
            "cash_asset": p.cash_asset,
            "initial_capital": p.initial_capital,
            "fees": p.fees,
            "slippage": p.slippage,
        },
        "stats": {
            "total_return_pct": _round(total_return_pct),
            "annualized_return_pct": _round(cagr_pct),
            "max_drawdown_pct": _round(mdd_pct),
            "sharpe": _round(sharpe),
            "sortino": _round(sortino),
            "win_rate_pct": _round(win_rate),
            "volatility_pct": _round(vol_annual),
            "trades": total_trades,
            "cycles_completed": rebalances,
            "start": str(eq_series.index[0].date()),
            "end": str(eq_series.index[-1].date()),
            "final_equity": _round(eq_series.iloc[-1]),
            "cash_remaining": _round(cash),
            "realized_pnl_total": _round(realized_total),
            "estimated_monthly_cashflow": _round(monthly_cashflow),
        },
        "per_ticker": per_ticker_summary,
        "equity_curve": eq_points,
        "recent_trades": recent_trades,
        "_strategy_returns": daily_ret,
    }


def latest_rotation_plan(closes: dict[str, pd.Series], p: MomentumRotationParams) -> dict:
    """전체 히스토리 재생 후, 다음 리밸런싱의 목표 포트폴리오(top-N) 계획."""
    result = run_momentum_rotation(closes, p)
    last_date = result["stats"]["end"]
    held = [{"ticker": t, "qty": s["qty_open"], "momentum": s["momentum"]}
            for t, s in result["per_ticker"].items() if s["in_portfolio"]]
    return {"as_of": last_date, "holdings": held, "summary": result["per_ticker"]}
