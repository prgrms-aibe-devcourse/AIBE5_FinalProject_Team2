"""
밸류 리밸런싱 (Value Rebalancing / VR) — V값 밴드 기반 분할 매매 시뮬레이션.

핵심 규칙 (사용자 정의 · frontend lib/backtest.js 의 검증된 알고리즘을 서버로 정규화):
  - 시작: 원금의 initial_pool_pct 만큼 Pool(현금) 보유, 나머지로 시초가 매수.
  - V값: 첫 V = 초기 투자금. 매 rebalance_days(영업일)마다
            V_next = V * (1 + expected_return) + biweekly_contrib
  - 밴드: 하단 = V * (1 - band_pct),  상단 = V_next * (1 + band_pct)
  - 평가금(보유주식 가치)이 하단 미만  → Pool 에서 꺼내 밴드 중심 (V+V_next)/2 까지 추가 매수
  - 평가금이 상단 초과            → 중심까지 매도. 단 매도 후 Pool 이 평가금×pool_target_pct 를
                                     넘으면 그 한도까지만 (현금 과다 방지).
  - 밴드 안 → 관망. biweekly_contrib 는 Pool 에 적립.

현업 정규화 (JS 프로토타입 대비 개선):
  - 정수 주(株) 매매 (소수주 금지 — 실거래 정합)
  - 수수료 0.25% + 슬리피지 0.10% 양방향 반영 (KIS 해외주식)
  - 평단가/실현손익 추적, infinite_buying.run_infinite_buying 과 100% 동일한 반환 dict 형태
    (stats / per_ticker / equity_curve / recent_trades / _strategy_returns) → 프론트 ReportPanel 무수정 호환

지원: 단일 티커(VR 표준) + 멀티 티커(자본 균등분할, 각자 독립 VR).
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd


@dataclass
class ValueRebalancingParams:
    rebalance_days: int = 10        # 리밸런싱 주기 (영업일, 2주)
    expected_return: float = 0.02   # 주기당 기대수익률 (V 성장률)
    band_pct: float = 0.20          # 밴드 폭 ±20%
    pool_target_pct: float = 0.50   # Pool 은 평가금의 이 비율을 넘지 않음
    initial_pool_pct: float = 0.50  # 시작 시 Pool 비중 (나머지는 시초가 매수)
    biweekly_contrib: float = 0.0   # 주기마다 추가 적립 (USD)
    initial_capital: float = 10_000.0  # USD (KRW 환산 후 주입)
    fees: float = 0.0025            # 0.25%
    slippage: float = 0.001         # 0.10%


@dataclass
class _AssetState:
    pool: float = 0.0               # 현금(Pool)
    shares: int = 0                 # 보유 수량 (정수)
    cost_basis: float = 0.0         # 누적 매수 원가 (수수료 포함)
    V: float = 0.0                  # 현재 V값
    V_next: float = 0.0             # 다음 V값
    days_since_rebalance: int = 0
    realized_pnl: float = 0.0
    rebalances: int = 0
    trades: list = field(default_factory=list)

    @property
    def avg_price(self) -> float:
        return self.cost_basis / self.shares if self.shares > 0 else 0.0


def _round(x, n=4):
    try:
        v = float(x)
        return None if (np.isnan(v) or np.isinf(v)) else round(v, n)
    except Exception:
        return None


def run_value_rebalancing(
    closes: dict[str, pd.Series],
    p: ValueRebalancingParams,
) -> dict:
    """
    closes: {ticker: pd.Series of daily close (DatetimeIndex)}.
    """
    tickers = list(closes.keys())
    if not tickers:
        raise ValueError("at least one ticker required")

    df = pd.concat({t: closes[t] for t in tickers}, axis=1).sort_index().ffill().dropna(how="all")
    per_asset_capital = p.initial_capital / len(tickers)

    states: dict[str, _AssetState] = {}
    # 초기화: 시초가 매수
    first_row = df.iloc[0]
    for t in tickers:
        s = _AssetState()
        px0 = first_row.get(t)
        s.pool = per_asset_capital
        if px0 is not None and not pd.isna(px0) and px0 > 0:
            invest = per_asset_capital * (1.0 - p.initial_pool_pct)
            buy_price = float(px0) * (1.0 + p.slippage)
            qty = int(invest // (buy_price * (1.0 + p.fees)))
            if qty > 0:
                cost = qty * buy_price
                fee = cost * p.fees
                s.shares = qty
                s.cost_basis = cost + fee
                s.pool = per_asset_capital - (cost + fee)
                s.trades.append({
                    "date": str(df.index[0].date()), "ticker": t, "side": "BUY",
                    "price": _round(buy_price), "qty": qty, "amount": _round(cost + fee),
                    "reason": "init",
                })
            s.V = s.cost_basis  # 첫 V = 실제 투자금(수수료 포함)
        s.V_next = s.V * (1.0 + p.expected_return) + p.biweekly_contrib
        states[t] = s

    equity_history: list[tuple[pd.Timestamp, float]] = []
    holdings_history: list[float] = []   # per-bar 보유 평가액 합 (QC Holdings/Exposure)
    cash_history: list[float] = []       # per-bar Pool(현금) 합

    for i, (ts, row) in enumerate(df.iterrows()):
        for t in tickers:
            price = row.get(t)
            if price is None or pd.isna(price) or price <= 0:
                continue
            price = float(price)
            s = states[t]
            port_value = s.shares * price
            lower = s.V * (1.0 - p.band_pct)
            upper = s.V_next * (1.0 + p.band_pct)
            center = (s.V + s.V_next) / 2.0

            if i > 0 and port_value < lower:
                # 밴드 하단 이탈 → Pool 에서 중심까지 추가 매수 (정수주)
                need = center - port_value
                budget = max(0.0, min(need, s.pool))
                buy_price = price * (1.0 + p.slippage)
                qty = int(budget // (buy_price * (1.0 + p.fees)))
                if qty > 0:
                    cost = qty * buy_price
                    fee = cost * p.fees
                    if cost + fee <= s.pool:
                        s.shares += qty
                        s.cost_basis += cost + fee
                        s.pool -= cost + fee
                        s.trades.append({
                            "date": str(ts.date()), "ticker": t, "side": "BUY",
                            "price": _round(buy_price), "qty": qty, "amount": _round(cost + fee),
                            "reason": "vr_lower",
                        })
            elif i > 0 and port_value > upper and s.shares > 0:
                # 밴드 상단 돌파 → 중심까지 매도. 단 Pool 이 (매도후평가금 × pool_target_pct) 초과 금지.
                sell_amt = port_value - center
                new_port = port_value - sell_amt
                pool_cap = new_port * p.pool_target_pct
                allowed_pool = min(s.pool + sell_amt, s.pool + pool_cap)
                real_sell = max(0.0, allowed_pool - s.pool)
                sell_price = price * (1.0 - p.slippage)
                qty = int(min(real_sell // sell_price, s.shares))
                if qty > 0:
                    avg = s.avg_price
                    proceeds = qty * sell_price
                    fee = proceeds * p.fees
                    net = proceeds - fee
                    s.realized_pnl += net - avg * qty
                    s.cost_basis -= avg * qty
                    s.shares -= qty
                    s.pool += net
                    s.trades.append({
                        "date": str(ts.date()), "ticker": t, "side": "SELL",
                        "price": _round(sell_price), "qty": qty, "amount": _round(net),
                        "reason": "vr_upper",
                    })

            # V 갱신 (리밸런싱 주기)
            if s.days_since_rebalance >= p.rebalance_days:
                s.V = s.V_next
                s.V_next = s.V * (1.0 + p.expected_return) + p.biweekly_contrib
                s.pool += p.biweekly_contrib
                s.rebalances += 1
                s.days_since_rebalance = 0
            else:
                s.days_since_rebalance += 1

        total_hold = sum(states[t].shares * float(row.get(t, 0) or 0) for t in tickers)
        total_cash = sum(states[t].pool for t in tickers)
        total_eq = total_hold + total_cash
        equity_history.append((ts, total_eq))
        holdings_history.append(total_hold)
        cash_history.append(total_cash)

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

    # 실현 매도 기준 승률 (VR 은 매도가 실현 이벤트) — 매도 없으면 상승일 비율로 폴백
    sell_pnls = []
    for s in states.values():
        for tr in s.trades:
            if tr["side"] == "SELL":
                sell_pnls.append(tr)
    if sell_pnls:
        # 매도 시점 실현손익 부호는 realized 추적이 자산단위라, 자산별 realized_pnl>0 비율로 근사
        wins = sum(1 for s in states.values() if s.realized_pnl > 0)
        win_rate = wins / max(1, sum(1 for s in states.values() if any(t["side"] == "SELL" for t in s.trades))) * 100.0
    else:
        win_rate = (daily_ret > 0).sum() / max(1, (daily_ret != 0).sum()) * 100.0

    total_trades = sum(len(s.trades) for s in states.values())
    total_rebalances = sum(s.rebalances for s in states.values())
    realized_total = sum(s.realized_pnl for s in states.values())
    months = max(1.0, days / 30.4375)
    monthly_cashflow = realized_total / months

    step = max(1, len(eq_series) // 365)
    eq_points = [{"date": str(d.date()), "value": _round(v)} for d, v in eq_series.iloc[::step].items()]

    # 보유/현금/노출 시계열 + 종목별 거래대금 (QC Holdings/Exposure/Treemap)
    hold_series = pd.Series(holdings_history, index=eq_series.index)
    cash_series = pd.Series(cash_history, index=eq_series.index)
    holdings_curve = [{"date": str(d.date()), "value": _round(v)} for d, v in hold_series.iloc[::step].items()]
    cash_curve = [{"date": str(d.date()), "value": _round(v)} for d, v in cash_series.iloc[::step].items()]
    exposure_curve = [
        {"date": str(d.date()), "exposure_pct": _round((float(h) / float(ev) * 100.0) if ev else 0.0)}
        for (d, h), ev in zip(hold_series.iloc[::step].items(), eq_series.iloc[::step].values)
    ]
    assets_volume = []
    for t in tickers:
        buy = sum(tr["amount"] for tr in states[t].trades if tr.get("side") == "BUY")
        sell = sum(tr["amount"] for tr in states[t].trades if tr.get("side") == "SELL")
        assets_volume.append({"ticker": t, "buy": _round(buy), "sell": _round(sell), "total": _round(buy + sell)})
    assets_volume.sort(key=lambda x: x["total"], reverse=True)
    holdings_value_end = float(hold_series.iloc[-1]) if len(hold_series) else 0.0
    cash_end = float(cash_series.iloc[-1]) if len(cash_series) else 0.0
    unrealized_pnl = holdings_value_end - sum(states[t].cost_basis for t in tickers)

    all_trades = []
    for s in states.values():
        all_trades.extend(s.trades)
    all_trades.sort(key=lambda x: x["date"])
    recent_trades = all_trades[-50:]

    per_ticker_summary = {
        t: {
            "qty_open": states[t].shares,
            "avg_price": _round(states[t].avg_price),
            "pool_remaining": _round(states[t].pool),
            "V": _round(states[t].V),
            "V_next": _round(states[t].V_next),
            "rebalances": states[t].rebalances,
            "realized_pnl": _round(states[t].realized_pnl),
            "trade_count": len(states[t].trades),
        }
        for t in tickers
    }

    return {
        "strategy": "value_rebalancing",
        "tickers": tickers,
        "params": {
            "rebalance_days": p.rebalance_days,
            "expected_return": p.expected_return,
            "band_pct": p.band_pct,
            "pool_target_pct": p.pool_target_pct,
            "initial_pool_pct": p.initial_pool_pct,
            "biweekly_contrib": p.biweekly_contrib,
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
            "cycles_completed": total_rebalances,
            "start": str(eq_series.index[0].date()),
            "end": str(eq_series.index[-1].date()),
            "final_equity": _round(eq_series.iloc[-1]),
            "realized_pnl_total": _round(realized_total),
            "estimated_monthly_cashflow": _round(monthly_cashflow),
            "holdings_value_end": _round(holdings_value_end),
            "cash_end": _round(cash_end),
            "unrealized_pnl": _round(unrealized_pnl),
        },
        "per_ticker": per_ticker_summary,
        "equity_curve": eq_points,
        "holdings_curve": holdings_curve,
        "cash_curve": cash_curve,
        "exposure_curve": exposure_curve,
        "assets_volume": assets_volume,
        "recent_trades": recent_trades,
        "_strategy_returns": daily_ret,
    }


def latest_vr_plan(closes: dict[str, pd.Series], p: ValueRebalancingParams) -> dict:
    """전체 히스토리 재생 후 다음날 VR 주문 계획(BUY/SELL/HOLD)."""
    result = run_value_rebalancing(closes, p)
    last_date = result["stats"]["end"]
    plans = []
    for t, summary in result["per_ticker"].items():
        last_close = float(closes[t].iloc[-1])
        shares = summary["qty_open"] or 0
        V = summary["V"] or 0.0
        V_next = summary["V_next"] or 0.0
        pool = summary["pool_remaining"] or 0.0
        port_value = shares * last_close
        lower = V * (1.0 - p.band_pct)
        upper = V_next * (1.0 + p.band_pct)
        center = (V + V_next) / 2.0
        side, reason, amount = None, "hold", 0.0
        if port_value < lower:
            side, reason = "BUY", "vr_lower"
            amount = max(0.0, min(center - port_value, pool))
        elif port_value > upper and shares > 0:
            side, reason = "SELL", "vr_upper"
            amount = port_value - center
        if side:
            plans.append({
                "ticker": t, "side": side, "order_type": "LOC",
                "price": _round(last_close), "amount": _round(amount),
                "qty": _round(amount / last_close if last_close > 0 else 0, 6) if side == "BUY" else shares,
                "reason": reason, "scheduled_for": last_date,
            })
    return {"as_of": last_date, "plans": plans, "summary": result["per_ticker"]}
