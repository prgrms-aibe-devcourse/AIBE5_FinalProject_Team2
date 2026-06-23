"""
프리셋(vbt 6전략) 엔진-매칭 '다음 거래일 주문' plan.

백테스트한 전략의 **최신 시그널(마지막 봉 transition) + 현재 보유**로 다음 거래일 BUY/SELL/HOLD 를 산출.
IB/VR 전용엔진 plan(latest_order_plan / latest_vr_plan)의 프리셋 버전.
실제 KIS 주문 제안이라 정확성 우선 — 애매하면 주문을 만들지 않는다(HOLD).

설계 근거(워크플로 wytxkduwu + 실측):
- vbt _signals 가 존재하는 6전략만 = 엔진 매칭 가능. 나머지(Lean 전용 등)는 미지원.
- SELL qty = 백테스트 종료일 보유 주식수. 실측 검증: open-trade Size 합 == pf.asset_value()/close == pf.assets()
  (TQQQ sma_cross 5y 에서 1,572,631.29 로 3경로 정확히 일치). open-trade Size 합을 1순위(enrich.py 검증 경로).
- entries/exits 는 transition(엣지). 마지막 봉만 보고(5봉 fallback 폐기 — 과거 시그널 신규발주 방지).
"""
from __future__ import annotations
from typing import Optional

import pandas as pd
import vectorbt as vbt

from app.backtest.vbt_engine import _signals, BacktestParams

# vbt _signals 가 있는 6전략만(엔진 매칭 가능). 그 외는 미지원(라우팅에서 차단).
ALLOWED_PRESETS = {"buy_and_hold", "sma_cross", "rsi_meanrev", "macd", "momentum_12_1", "vix_risk_off"}


def _round(v, n: int = 4):
    try:
        if v is None:
            return None
        return round(float(v), n)
    except (TypeError, ValueError):
        return None


def _min_lookback(p: BacktestParams) -> int:
    """전략별 최소 데이터 길이(시그널 산출 가능 최소 + 여유 5봉)."""
    s = p.strategy
    if s == "sma_cross":     return p.sma_slow + 5
    if s == "rsi_meanrev":   return p.rsi_period + 5
    if s == "macd":          return p.macd_slow + p.macd_signal + 5
    if s == "momentum_12_1": return p.momentum_long_days + 5
    if s == "vix_risk_off":  return 5
    return 2  # buy_and_hold


def _final_shares(pf, close) -> float:
    """종료일 보유 주식수. 실측 검증된 경로(pf.assets() 대신 open-trade Size 합 1순위, asset_value/close 폴백)."""
    try:
        tr = pf.trades.records_readable
        if "Status" in tr.columns and "Size" in tr.columns:
            return float(tr.loc[tr["Status"].astype(str).str.lower() == "open", "Size"].astype(float).sum())
    except Exception:
        pass
    try:
        av = float(pf.asset_value().iloc[-1])
        lc = float(close.iloc[-1])
        return av / lc if lc > 0 else 0.0
    except Exception:
        return 0.0


def latest_preset_plan(closes: dict, p: BacktestParams, vix: Optional[pd.Series] = None) -> dict:
    """
    closes: {ticker: Close Series}. 종목별 독립 백테스트(자본 균등배분)로 다음 거래일 주문 산출.
    반환: {as_of, plans:[{ticker,side,order_type,price,amount,qty,reason,scheduled_for}], summary, errors, skipped_subunit}
      - side: BUY(미보유+진입엣지) / SELL(보유+청산엣지). HOLD 는 plans 에서 제외.
    """
    if p.strategy not in ALLOWED_PRESETS:
        raise ValueError(f"preset plan 미지원 전략: {p.strategy}")

    n = max(1, len(closes))
    budget = p.initial_capital / n   # 종목 균등 배분
    plans, summary, errors, skipped = [], {}, [], []
    as_of = None

    for t, close in closes.items():
        try:
            close = close.dropna()
            if len(close) < _min_lookback(p):
                errors.append({"ticker": t, "error": "insufficient_data"})
                continue

            entries, exits = _signals(close, p, vix=vix)
            # 백테스트와 동일하게 fshift(1) anti-look-ahead 로 포트폴리오를 돌려 '현재 보유'를 얻는다.
            en = entries.vbt.fshift(1).fillna(False).astype(bool)
            ex = exits.vbt.fshift(1).fillna(False).astype(bool)
            pf = vbt.Portfolio.from_signals(
                close, en, ex, init_cash=p.initial_capital,
                fees=p.fees, slippage=p.slippage, freq="1D",
            )
            held = _final_shares(pf, close)
            last_close = float(close.iloc[-1])
            last_date = str(close.index[-1].date())
            as_of = as_of or last_date
            # 다음 거래일 주문은 '마지막 봉의 raw 시그널'(=T 신호→T+1 발주)로 판단. shift 안 함.
            entry_now = bool(entries.iloc[-1])
            exit_now = bool(exits.iloc[-1])

            summary[t] = {
                "held_qty": _round(held, 6), "last_close": _round(last_close),
                "entry_today": entry_now, "exit_today": exit_now,
            }

            side = reason = None
            amount = 0.0
            if entry_now and held <= 1e-9 and last_close > 0:      # 미보유 + 진입엣지 → 신규매수
                side, reason, amount = "BUY", f"{p.strategy}_entry", budget
            elif exit_now and held > 1e-9:                         # 보유 + 청산엣지 → 전량매도
                side, reason, amount = "SELL", f"{p.strategy}_exit", held * last_close
            # else HOLD → 주문 없음 (buy_and_hold 는 첫날 이후 항상 여기)

            if side and last_close > 0:
                qty = (budget / last_close) if side == "BUY" else held
                if side == "SELL" and held <= 1e-9:                # 방어: 보유0 매도 금지
                    continue
                if qty < 1:                                         # 1주 미만 — 백엔드 floor 가 스킵하나 명시 표기
                    skipped.append({"ticker": t, "side": side, "qty": _round(qty, 6)})
                plans.append({
                    "ticker": t, "side": side, "order_type": "LIMIT",  # last_close 지정가(다음거래일). MOCK/REAL 공통 안전.
                    "price": _round(last_close), "amount": _round(amount),
                    "qty": _round(qty, 6), "reason": reason, "scheduled_for": last_date,
                })
        except Exception as e:
            errors.append({"ticker": t, "error": str(e)})   # per-ticker 격리

    return {"as_of": as_of, "plans": plans, "summary": summary,
            "errors": errors, "skipped_subunit": skipped}
