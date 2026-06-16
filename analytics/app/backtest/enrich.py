"""
백테스트 결과 보강(enrich) — QuantConnect 급 대시보드용 차트 시리즈 + 파생 스탯.

모든 백테스트 경로(SMA/지표·무한매수(IB)·밸류리밸런싱(VR))가 공통으로 반환하는
equity_curve + _strategy_returns(pd.Series) 로부터 *진짜* 파생값을 계산한다.
가짜 값 없음: 계산 불가 항목은 생략(None)한다. 모든 추가는 멱등(setdefault)이다.

추가 필드:
  drawdown_curve   : [{date, dd_pct}]      에쿼티 고점 대비 낙폭(%)
  returns_daily    : [{date, ret_pct}]     일별 수익률(%) — 막대/분포용
  monthly_returns  : [{year, month, ret_pct}]  월별 수익률 히트맵
  benchmark_curve  : [{date, value}]       동일 종목 Buy&Hold (init_cash 스케일)
  orders/trades    : pf 에서 추출(표준 경로) — orders_trades_from_pf
  stats.* 파생      : start/end_equity, net_profit(_pct), total_fees, volume,
                      best/worst_day_pct, avg_win/loss_pct, profit_factor,
                      positive/negative_days, expectancy_pct, psr_pct,
                      benchmark_return_pct
"""
from __future__ import annotations
import numpy as np
import pandas as pd

from app.config import DEFAULT_INITIAL_CAPITAL


def _f(x):
    try:
        v = float(x)
        return None if (np.isnan(v) or np.isinf(v)) else round(v, 4)
    except Exception:
        return None


def _dstr(d):
    try:
        return str(d.date())
    except Exception:
        return str(d)[:10]


def _downsample(s: pd.Series, n: int = 365) -> pd.Series:
    if len(s) <= n:
        return s
    step = max(1, len(s) // n)
    return s.iloc[::step]


def enrich_result(result: dict, close: pd.Series | None = None) -> dict:
    """result 에 차트 시리즈 + 파생 stats 를 추가한다(멱등). _strategy_returns 는 보존(main.py 가 pop)."""
    if not isinstance(result, dict):
        return result
    rets = result.get("_strategy_returns")
    if rets is None:
        return result
    try:
        rets = pd.Series(rets).dropna()
    except Exception:
        return result
    if rets.empty:
        return result

    stats = result.setdefault("stats", {})
    params = result.get("params", {}) or {}
    init = float(params.get("initial_capital") or DEFAULT_INITIAL_CAPITAL)

    # 정규화 에쿼티(절대 스케일=init_cash). 드로다운은 스케일 무관.
    eq = (1.0 + rets).cumprod() * init
    dd = (eq / eq.cummax() - 1.0) * 100.0

    result["drawdown_curve"] = [{"date": _dstr(d), "dd_pct": _f(v)} for d, v in _downsample(dd).items()]
    result["returns_daily"] = [{"date": _dstr(d), "ret_pct": _f(v * 100)} for d, v in _downsample(rets).items()]

    # 월별 수익률(연·월 그룹 곱) — pandas resample alias 변화 회피용 groupby
    try:
        idx = rets.index
        grp = (1.0 + rets).groupby([idx.year, idx.month]).prod() - 1.0
        result["monthly_returns"] = [
            {"year": int(y), "month": int(m), "ret_pct": _f(v * 100)} for (y, m), v in grp.items()
        ]
    except Exception:
        pass

    # 벤치마크(동일 종목 Buy&Hold) — close 있을 때만
    if close is not None and len(close) > 1:
        try:
            bh = close.astype(float)
            bh = bh / float(bh.iloc[0]) * init
            result["benchmark_curve"] = [{"date": _dstr(d), "value": _f(v)} for d, v in _downsample(bh).items()]
            stats.setdefault("benchmark_return_pct", _f((float(close.iloc[-1]) / float(close.iloc[0]) - 1.0) * 100))
        except Exception:
            pass

    # 파생 스탯
    end_eq = float(eq.iloc[-1])
    stats.setdefault("start_equity", _f(init))
    stats.setdefault("end_equity", _f(end_eq))
    stats.setdefault("net_profit", _f(end_eq - init))
    stats.setdefault("net_profit_pct", _f((end_eq / init - 1.0) * 100))
    if stats.get("volatility_pct") is None:
        stats["volatility_pct"] = _f(rets.std() * np.sqrt(252) * 100)
    stats.setdefault("best_day_pct", _f(rets.max() * 100))
    stats.setdefault("worst_day_pct", _f(rets.min() * 100))
    pos, neg = rets[rets > 0], rets[rets < 0]
    stats.setdefault("avg_win_pct", _f(pos.mean() * 100) if len(pos) else None)
    stats.setdefault("avg_loss_pct", _f(neg.mean() * 100) if len(neg) else None)
    stats.setdefault("positive_days", int((rets > 0).sum()))
    stats.setdefault("negative_days", int((rets < 0).sum()))
    gp, gl = float(pos.sum()), abs(float(neg.sum()))
    stats.setdefault("profit_factor", _f(gp / gl) if gl > 1e-12 else None)
    try:
        wr = len(pos) / len(rets)
        aw = float(pos.mean()) if len(pos) else 0.0
        al = float(neg.mean()) if len(neg) else 0.0
        stats.setdefault("expectancy_pct", _f((wr * aw + (1 - wr) * al) * 100))
    except Exception:
        pass
    # Probabilistic Sharpe Ratio(SR>0 확률) — Bailey & López de Prado.
    # 주의: PSR 공식의 SR 은 *관측주기(일별) 비연환산* Sharpe 여야 한다.
    # (연환산 Sharpe + 일별 표본수 n 을 섞으면 PSR 이 비정상적으로 부풀려진다.)
    try:
        n = len(rets)
        sd = float(rets.std())
        if n > 2 and sd > 1e-12:
            from math import erf, sqrt
            sr_obs = float(rets.mean()) / sd          # per-observation Sharpe
            skew = float(rets.skew())
            kurt = float(rets.kurtosis()) + 3.0       # pandas kurtosis 는 초과첨도 → +3
            denom = sqrt(max(1e-9, 1.0 - skew * sr_obs + (kurt - 1.0) / 4.0 * sr_obs * sr_obs))
            z = sr_obs * sqrt(n - 1) / denom
            stats["psr_pct"] = _f(0.5 * (1.0 + erf(z / sqrt(2.0))) * 100)
    except Exception:
        pass

    return result


def orders_trades_from_pf(pf, ticker: str = "ASSET", cap: int = 1000) -> dict:
    """vectorbt Portfolio 에서 orders/trades 표 + total_fees/volume 추출(컬럼명 버전 견고)."""
    out = {"orders": [], "trades": [], "total_fees": None, "volume": None, "orders_truncated": False}

    def _col(row, *names):
        for nm in names:
            for k in row.keys():
                if nm.lower() in str(k).lower():
                    return row[k]
        return None

    # ── Orders ──
    try:
        recs = pf.orders.records_readable.to_dict("records")
        total_fees, volume = 0.0, 0.0
        for i, r in enumerate(recs):
            size, price, fee = _col(r, "Size"), _col(r, "Price"), _col(r, "Fees")
            side, ts = _col(r, "Side"), _col(r, "Timestamp", "Index", "Date")
            val = (float(size) * float(price)) if (size is not None and price is not None) else None
            try:
                total_fees += float(fee)
            except Exception:
                pass
            if val is not None:
                volume += abs(val)
            if i < cap:
                out["orders"].append({
                    "date": str(ts)[:19] if ts is not None else None,
                    "side": str(side).upper() if side is not None else None,
                    "ticker": ticker,
                    "qty": _f(size), "price": _f(price), "value": _f(val), "fee": _f(fee),
                })
        out["orders_truncated"] = len(recs) > cap
        out["total_fees"] = _f(total_fees)
        out["volume"] = _f(volume)
    except Exception:
        pass

    # ── Trades ──
    try:
        recs = pf.trades.records_readable.to_dict("records")
        for i, r in enumerate(recs):
            if i >= cap:
                break
            ret = _col(r, "Return")
            out["trades"].append({
                "entry_date": str(_col(r, "Entry Timestamp", "Entry Index", "Entry Date"))[:19],
                "exit_date": str(_col(r, "Exit Timestamp", "Exit Index", "Exit Date"))[:19],
                "qty": _f(_col(r, "Size")),
                "entry_price": _f(_col(r, "Avg Entry Price", "Entry Price")),
                "exit_price": _f(_col(r, "Avg Exit Price", "Exit Price")),
                "pnl": _f(_col(r, "PnL")),
                "return_pct": _f(ret * 100) if ret is not None else None,
                "status": str(_col(r, "Status")) if _col(r, "Status") is not None else None,
                "direction": str(_col(r, "Direction")) if _col(r, "Direction") is not None else None,
            })
    except Exception:
        pass

    return out
