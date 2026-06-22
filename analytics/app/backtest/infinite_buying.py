"""
무한매수법 (Infinite Buying Method) — 분할매수 시뮬레이션.

두 가지 변형(variant)을 지원:
  • "laoer" (기본, 라오어식): 전량 익절 + 균등 자본분할 + 복리.
  • "yeonri"  (연리무한매수법): 평단×1.13 익절 후 1주만 남김 + 종목 가중분할 + 고정 일매수.

핵심 규칙 (사용자 정의):
  - 원금 capital을 split(=40) 회차로 분할 → daily_budget = (가중)자본 / split
  - 매일 종가 기준으로:
      종가 <= 평단가          → daily_budget 전액으로 매수  (LOC 평단매수 1.0회)
      평단 < 종가 <= 평단*(1+loc_offset)  → daily_budget * 0.5 매수 (LOC 큰수매수 0.5회 / 연리는 보통가)
      그 외                    → 매수 없음
  - 보유 중 종가 >= 평단 * (1 + take_profit_pct/100)  → 익절(leave_shares 남기고 매도) + 사이클 리셋
  - 마지막 날 미청산 포지션은 mark-to-market

연리무한매수법 권장 파라미터: split=40, take_profit_pct=13, loc_offset_pct=10,
  leave_shares=1, compound=False, ticker_weights={"TQQQ":0.87,"SOXL":0.13}

지원: 단일 티커 + 멀티 티커 (자본을 가중치 또는 균등 분할).
출력: vbt_engine.run_backtest 결과와 호환되는 dict (stats, equity_curve, risk_metrics 등)
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd


@dataclass
class InfiniteBuyingParams:
    split: int = 40                  # 분할 횟수 (원금/40)
    take_profit_pct: float = 10.0    # 평단 대비 익절 트리거 (%) — 연리: 13
    loc_offset_pct: float = 15.0     # 평단보다 비싸도 매수 허용 상한 (%) — 연리: 10
    initial_capital: float = 10_000.0  # USD 기본값 (사용자가 KRW 환산 후 주입)
    fees: float = 0.0025  # 0.25% KIS 해외주식 실수수료
    slippage: float = 0.001  # 0.10% 슬리피지
    # ── 연리무한매수법 옵션 ──
    leave_shares: float = 0.0        # 익절 시 남겨둘 수량 (연리: 1주). 0 = 전량 매도
    compound: bool = True            # True=익절 후 잔고로 1회분 재계산(복리), False=고정 일매수(연리)
    ticker_weights: Optional[dict] = None  # {ticker: weight} 자본 배분(미지정=균등). 연리: TQQQ 多
    variant: str = "laoer"           # "laoer"(기본) | "yeonri"(연리무한매수법) — 표시/메타용
    # 익절 직후 새 사이클 첫 매수: 0.5분할을 보통가(현재가)로 매수해 평단을 현재가에 재기준.
    # → 랠리에서 익절→재매수→익절 '사다리타기'를 재현 (연리: 0.5). 0이면 비활성(라오어).
    restart_buy_fraction: float = 0.0
    # ── XGBoost 오버레이 (ai_opt 브랜치) ──
    # xgb_overlay=True 이면 loc_large 매수 시 XGBoost 신호를 참조해 하락 예측 강할 때 스킵.
    # loc_avg(평단매수)는 연리 원칙상 항상 실행 — XGBoost 무관.
    xgb_overlay: bool = False
    xgb_ticker: str = ""              # 학습된 모델 파일명 기준 티커 (기본: tickers[0])
    xgb_skip_threshold: float = 0.38  # 상승 확률 이 미만이면 loc_large 스킵


@dataclass
class _AssetState:
    cash_alloc: float = 0.0          # 이 자산에 배정된 캐시 잔액
    qty: float = 0.0                 # 보유 수량
    cost_basis: float = 0.0          # 누적 매수 원가 (수수료 제외)
    avg_price: float = 0.0           # 평단가
    cycle_idx: int = 0               # 분할매수 회차 (split 도달 시 reset)
    cycle_budget: float = 0.0        # 현 사이클의 1회차 예산 (복리: 익절 후 재계산)
    realized_pnl: float = 0.0
    trades: list = field(default_factory=list)
    cycles_completed: int = 0


def _round(x, n=4):
    try:
        v = float(x)
        return None if (np.isnan(v) or np.isinf(v)) else round(v, n)
    except Exception:
        return None


def run_infinite_buying(
    closes: dict[str, pd.Series],
    p: InfiniteBuyingParams,
    highs: Optional[dict] = None,
    opens: Optional[dict] = None,
) -> dict:
    """
    closes: {ticker: pd.Series of daily close prices (DatetimeIndex)}.
            여러 티커일 경우 union index로 정렬 + ffill.
    highs/opens: {ticker: pd.Series} (선택). 주어지면 매도 지정가 체결을 장중 고가/시가 기준으로 정밀화:
            고가 ≥ 평단×(1+tp) 이면 그 지정가에 체결(갭상승으로 시가가 지정가보다 높으면 시가 체결).
            미지정 시 종가 기준(기존 동작). LOC 매수는 본래 종가 체결이라 종가 유지.
    """
    tickers = list(closes.keys())
    if not tickers:
        raise ValueError("at least one ticker required")

    # XGBoost 오버레이: loc_large 매수 전 신호 조회 (모델 없으면 자동 비활성)
    _xgb_skip_dates: set = set()
    if p.xgb_overlay:
        try:
            from app.models.xgb_signal import predict_signal_for_yeonri
            xgb_ticker = p.xgb_ticker or tickers[0]
            combined_close = list(closes.values())[0]
            # Volume이 없을 경우 Close만으로 데이터프레임 구성
            xgb_df = combined_close.to_frame(name="Close")
            sig = predict_signal_for_yeonri(xgb_df, xgb_ticker, strong_down_threshold=p.xgb_skip_threshold)
            if sig.get("signal") == "SKIP_LOC_LARGE" and sig.get("as_of"):
                _xgb_skip_dates.add(sig["as_of"])
        except Exception:
            pass  # 모델 없거나 오류 시 오버레이 없이 진행

    df = pd.concat(
        {t: closes[t] for t in tickers},
        axis=1,
    ).sort_index().ffill().dropna(how="all")
    df_high = (pd.concat({t: highs[t] for t in tickers if t in highs}, axis=1)
               .reindex(df.index).ffill()) if highs else None
    df_open = (pd.concat({t: opens[t] for t in tickers if t in opens}, axis=1)
               .reindex(df.index).ffill()) if opens else None

    # 자본 배분: ticker_weights 지정 시 가중(연리 TQQQ:SOXL≈400:60), 미지정 시 균등
    if p.ticker_weights:
        wsum = sum(max(0.0, p.ticker_weights.get(t, 0.0)) for t in tickers) or 1.0
        alloc = {t: p.initial_capital * (max(0.0, p.ticker_weights.get(t, 0.0)) / wsum) for t in tickers}
    else:
        alloc = {t: p.initial_capital / len(tickers) for t in tickers}
    states: dict[str, _AssetState] = {
        t: _AssetState(cash_alloc=alloc[t], cycle_budget=alloc[t] / p.split)
        for t in tickers
    }

    equity_history: list[tuple[pd.Timestamp, float]] = []
    holdings_history: list[float] = []   # per-bar 보유 평가액 합 (QC Holdings/Exposure)
    cash_history: list[float] = []       # per-bar 현금 합

    for ts, row in df.iterrows():
        for t in tickers:
            price = row.get(t)
            if price is None or pd.isna(price) or price <= 0:
                continue
            s = states[t]
            budget = s.cycle_budget
            # 장중 고가/시가 (OHLC 모드일 때만) — 매도 지정가 체결 정밀화에 사용
            day_high = price
            day_open = price
            if df_high is not None and t in df_high.columns:
                hv = df_high.loc[ts, t]
                if not pd.isna(hv) and hv > 0:
                    day_high = float(hv)
            if df_open is not None and t in df_open.columns:
                ov = df_open.loc[ts, t]
                if not pd.isna(ov) and ov > 0:
                    day_open = float(ov)

            # 1) 익절 체크 (보유 중이고 평단 대비 +take_profit_pct 이상)
            #    연리무한매수법: 평단×1.13 정규장 지정가 익절 → 1주(leave_shares)만 남기고 매도 후 사이클 재시작.
            #    OHLC 모드: 고가가 평단×1.13 도달 시 그 지정가에 체결(갭상승이면 시가). → 실현률 ≈ 정확히 +13%.
            if s.qty > 0 and s.avg_price > 0:
                trigger = s.avg_price * (1.0 + p.take_profit_pct / 100.0)
                reach = day_high if df_high is not None else price
                if reach >= trigger:
                    sell_qty = max(0.0, s.qty - p.leave_shares)
                    if sell_qty > 0:
                        frac = sell_qty / s.qty
                        # 체결가: OHLC면 지정가(trigger), 단 시가가 지정가 위로 갭상승하면 시가(더 유리). 종가모드면 종가.
                        if df_high is not None:
                            fill = max(trigger, day_open) if day_open > trigger else trigger
                        else:
                            fill = price
                        sell_price = fill * (1.0 - p.slippage)
                        proceeds = sell_qty * sell_price
                        fee = proceeds * p.fees
                        net = proceeds - fee
                        cost_of_sold = s.cost_basis * frac
                        s.realized_pnl += net - cost_of_sold
                        s.cash_alloc += net
                        s.trades.append({
                            "date": str(ts.date()), "ticker": t, "side": "SELL",
                            "price": _round(sell_price), "qty": _round(sell_qty, 6),
                            "amount": _round(net), "reason": "take_profit",
                            "realized": _round(net - cost_of_sold),
                            "tp_pct": _round((fill / s.avg_price - 1.0) * 100.0, 2),
                        })
                        s.qty -= sell_qty
                        s.cost_basis -= cost_of_sold
                        if s.qty <= 1e-9:
                            s.qty = 0.0
                            s.cost_basis = 0.0
                            s.avg_price = 0.0
                        # 남긴 1주는 기존 평단(avg_price) 유지 → 다음 매수와 블렌딩
                        s.cycle_idx = 0
                        s.cycles_completed += 1
                        # 복리(compound=True): 익절 후 남은 현금 기준으로 1회차 예산 재계산.
                        # 연리(compound=False): 일매수액 고정 — cycle_budget 그대로.
                        if p.compound and s.cash_alloc > 0:
                            s.cycle_budget = s.cash_alloc / p.split
                        # ── 연리: 익절 직후 0.5분할 보통가(현재가) 매수로 평단 재기준 ──
                        # "처음 시작할 때 0.5분할을 정규가로 사서 LOC평단을 만든다" → 새 사이클이
                        # 현재 시세에서 출발 → 랠리에서 익절→재매수→익절 사다리타기 재현.
                        if p.restart_buy_fraction > 0 and s.cash_alloc > 0:
                            seed_amt = min(s.cycle_budget * p.restart_buy_fraction, s.cash_alloc)
                            if seed_amt > 0:
                                bp = price * (1.0 + p.slippage)
                                f = seed_amt * p.fees
                                qb = (seed_amt - f) / bp
                                if qb > 0:
                                    s.cost_basis += seed_amt - f
                                    s.qty += qb
                                    s.avg_price = s.cost_basis / s.qty
                                    s.cash_alloc -= seed_amt
                                    s.cycle_idx = p.restart_buy_fraction  # 0.5분할 사용
                                    s.trades.append({
                                        "date": str(ts.date()), "ticker": t, "side": "BUY",
                                        "price": _round(bp), "qty": _round(qb, 6),
                                        "amount": _round(seed_amt), "reason": "restart_market",
                                        "avg_price_after": _round(s.avg_price),
                                        "cycle": _round(s.cycle_idx, 2),
                                    })
                        # 익절 후 사이클 리셋 → 다음 날부터 1/40 원칙대로 신규 사이클
                        continue

            # 2) 매수 결정
            if s.cycle_idx >= p.split:
                # 분할 한도 도달 + 미익절 → 추가 매수 중지 (자본 보존)
                continue

            buy_fraction = 0.0
            reason = ""
            if s.avg_price <= 0 or price <= s.avg_price:
                buy_fraction = 1.0
                reason = "loc_avg" if s.avg_price > 0 else "init_buy"
            elif price <= s.avg_price * (1.0 + p.loc_offset_pct / 100.0):
                # XGBoost 오버레이: 하락 예측 강할 때 loc_large 스킵
                if p.xgb_overlay and str(ts.date()) in _xgb_skip_dates:
                    continue
                buy_fraction = 0.5
                reason = "loc_large"
            else:
                continue

            amount = budget * buy_fraction
            if amount > s.cash_alloc:
                amount = s.cash_alloc
            if amount <= 0:
                continue

            buy_price = price * (1.0 + p.slippage)
            fee = amount * p.fees
            qty_bought = (amount - fee) / buy_price
            if qty_bought <= 0:
                continue

            new_cost = s.cost_basis + (amount - fee)
            new_qty = s.qty + qty_bought
            s.avg_price = new_cost / new_qty if new_qty > 0 else 0.0
            s.qty = new_qty
            s.cost_basis = new_cost
            s.cash_alloc -= amount
            s.cycle_idx += buy_fraction  # 0.5 또는 1.0
            s.trades.append({
                "date": str(ts.date()), "ticker": t, "side": "BUY",
                "price": _round(buy_price), "qty": _round(qty_bought, 6),
                "amount": _round(amount), "reason": reason,
                "avg_price_after": _round(s.avg_price),
                "cycle": _round(s.cycle_idx, 2),
            })

        # mark-to-market
        total_eq = 0.0
        total_hold = 0.0
        total_cash = 0.0
        for t in tickers:
            s = states[t]
            mv = s.qty * float(row.get(t, s.avg_price or 0))
            total_eq += s.cash_alloc + mv
            total_hold += mv
            total_cash += s.cash_alloc
        equity_history.append((ts, total_eq))
        holdings_history.append(total_hold)
        cash_history.append(total_cash)

    eq_series = pd.Series([v for _, v in equity_history],
                          index=[d for d, _ in equity_history])
    daily_ret = eq_series.pct_change().fillna(0.0)

    total_return_pct = (eq_series.iloc[-1] / p.initial_capital - 1.0) * 100.0
    days = (eq_series.index[-1] - eq_series.index[0]).days or 1
    years = days / 365.25
    cagr_pct = (((eq_series.iloc[-1] / p.initial_capital) ** (1.0 / years) - 1.0) * 100.0
                if years > 0 and eq_series.iloc[-1] > 0 else 0.0)
    roll_max = eq_series.cummax()
    mdd_pct = ((eq_series / roll_max) - 1.0).min() * 100.0
    vol_annual = daily_ret.std() * np.sqrt(252) * 100.0
    sharpe = (daily_ret.mean() / daily_ret.std() * np.sqrt(252)
              if daily_ret.std() > 0 else 0.0)
    downside = daily_ret[daily_ret < 0].std()
    sortino = (daily_ret.mean() / downside * np.sqrt(252)
               if downside and downside > 0 else 0.0)
    win_rate = (daily_ret > 0).sum() / max(1, (daily_ret != 0).sum()) * 100.0

    total_trades = sum(len(s.trades) for s in states.values())
    completed_cycles = sum(s.cycles_completed for s in states.values())

    # 월 평균 실현 수익 (대시보드용 현금흐름 근사)
    realized_total = sum(s.realized_pnl for s in states.values())
    months = max(1.0, days / 30.4375)
    monthly_cashflow = realized_total / months

    # equity_curve downsample
    step = max(1, len(eq_series) // 365)
    eq_points = [
        {"date": str(d.date()), "value": _round(v)}
        for d, v in eq_series.iloc[::step].items()
    ]

    # 보유/현금/노출 시계열 (QC Holdings/Exposure/Margin 대시보드용)
    hold_series = pd.Series(holdings_history, index=eq_series.index)
    cash_series = pd.Series(cash_history, index=eq_series.index)
    holdings_curve = [
        {"date": str(d.date()), "value": _round(v)} for d, v in hold_series.iloc[::step].items()
    ]
    cash_curve = [
        {"date": str(d.date()), "value": _round(v)} for d, v in cash_series.iloc[::step].items()
    ]
    exposure_curve = [
        {"date": str(d.date()), "exposure_pct": _round((float(h) / float(ev) * 100.0) if ev else 0.0)}
        for (d, h), ev in zip(hold_series.iloc[::step].items(), eq_series.iloc[::step].values)
    ]
    # 종목별 거래대금 (QC Assets Sales Volume 트리맵용)
    assets_volume = []
    for t in tickers:
        buy = sum(tr["amount"] for tr in states[t].trades if tr.get("side") == "BUY")
        sell = sum(tr["amount"] for tr in states[t].trades if tr.get("side") == "SELL")
        assets_volume.append({"ticker": t, "buy": _round(buy), "sell": _round(sell), "total": _round(buy + sell)})
    assets_volume.sort(key=lambda x: x["total"], reverse=True)
    holdings_value_end = float(hold_series.iloc[-1]) if len(hold_series) else 0.0
    cash_end = float(cash_series.iloc[-1]) if len(cash_series) else 0.0
    # 미실현 = 말일 보유평가액 − 미청산 포지션 원가(cost_basis)
    unrealized_pnl = holdings_value_end - sum(states[t].cost_basis for t in tickers)

    # 최근 거래 50건만
    all_trades = []
    for s in states.values():
        all_trades.extend(s.trades)
    all_trades.sort(key=lambda x: x["date"])
    recent_trades = all_trades[-50:]

    per_ticker_summary = {
        t: {
            "qty_open": _round(states[t].qty, 6),
            "avg_price": _round(states[t].avg_price),
            "cash_remaining": _round(states[t].cash_alloc),
            "cycles_completed": states[t].cycles_completed,
            "current_cycle_idx": _round(states[t].cycle_idx, 2),
            "realized_pnl": _round(states[t].realized_pnl),
            "trade_count": len(states[t].trades),
        }
        for t in tickers
    }

    return {
        "strategy": "infinite_buying",
        "variant": p.variant,
        "tickers": tickers,
        "params": {
            "split": p.split,
            "take_profit_pct": p.take_profit_pct,
            "loc_offset_pct": p.loc_offset_pct,
            "initial_capital": p.initial_capital,
            "fees": p.fees,
            "slippage": p.slippage,
            "leave_shares": p.leave_shares,
            "compound": p.compound,
            "ticker_weights": p.ticker_weights,
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
            "cycles_completed": completed_cycles,
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
        "_strategy_returns": daily_ret,  # internal for QuantStats
    }


def latest_order_plan(
    closes: dict[str, pd.Series],
    p: InfiniteBuyingParams,
) -> dict:
    """
    Replay full history to get current state, then compute next-day order plan.
    Used by /alpha/.../queue-orders to push BUY/SELL recommendations into mock queue.
    """
    result = run_infinite_buying(closes, p)
    last_date = result["stats"]["end"]
    tickers = list(closes.keys())
    # 자본 배분(백테스트와 동일): 가중치 지정 시 가중, 아니면 균등
    if p.ticker_weights:
        wsum = sum(max(0.0, p.ticker_weights.get(t, 0.0)) for t in tickers) or 1.0
        alloc = {t: p.initial_capital * (max(0.0, p.ticker_weights.get(t, 0.0)) / wsum) for t in tickers}
    else:
        alloc = {t: p.initial_capital / len(tickers) for t in tickers}
    plans = []
    for t, summary in result["per_ticker"].items():
        last_close = float(closes[t].iloc[-1])
        avg = summary["avg_price"] or 0.0
        qty = summary["qty_open"] or 0.0
        budget = alloc[t] / p.split
        side = None
        reason = ""
        price = last_close
        amount = 0.0

        if qty > 0 and avg > 0 and last_close >= avg * (1 + p.take_profit_pct / 100):
            side, reason = "SELL", "take_profit"
            # 연리: 1주(leave_shares) 남기고 매도
            amount = max(0.0, qty - p.leave_shares) * last_close
        elif avg <= 0 or last_close <= avg:
            side, reason = "BUY", "loc_avg"
            amount = budget
        elif last_close <= avg * (1 + p.loc_offset_pct / 100):
            side, reason = "BUY", "loc_large"
            amount = budget * 0.5

        if side:
            plans.append({
                "ticker": t,
                "side": side,
                "order_type": "LOC",
                "price": _round(price),
                "amount": _round(amount),
                "qty": _round(amount / price if price > 0 else 0, 6) if side == "BUY" else _round(max(0.0, qty - p.leave_shares), 6),
                "reason": reason,
                "scheduled_for": last_date,
            })
    return {"as_of": last_date, "plans": plans, "summary": result["per_ticker"]}
