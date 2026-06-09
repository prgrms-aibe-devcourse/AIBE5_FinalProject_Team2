"""
Market data client — Polygon.io 우선, yfinance 폴백.

POLYGON_API_KEY 설정 시 Polygon 데이터를 사용하고,
미설정 또는 오류 시 yfinance로 자동 폴백합니다.
"""
from __future__ import annotations
import logging
import os
from datetime import datetime, timedelta, date
from pathlib import Path
from typing import Optional

import time

import pandas as pd
import yfinance as yf

from app.config import CACHE_DIR, PRICE_CACHE_TTL_MIN

log = logging.getLogger(__name__)

OFFLINE_MODE = bool(int(os.getenv("ANALYTICS_OFFLINE_CACHE", "0")))


def _cache_path(ticker: str, interval: str, period: str = "max") -> Path:
    return CACHE_DIR / f"{ticker.upper()}_{interval}_{period}.parquet"


def _is_fresh(path: Path, ttl_min: int) -> bool:
    if not path.exists():
        return False
    mtime = datetime.fromtimestamp(path.stat().st_mtime)
    return (datetime.now() - mtime) < timedelta(minutes=ttl_min)


def _read_cache(path: Path, ticker: str) -> Optional[pd.DataFrame]:
    if not path.exists():
        return None
    try:
        df = pd.read_parquet(path)
        log.info("cache hit %s (%d rows)", ticker, len(df))
        return df
    except Exception as e:
        log.warning("cache read failed %s: %s", ticker, e)
        return None


def _period_to_dates(period: str) -> tuple[str, str]:
    """'5y' → (from_date, to_date) ISO 문자열 반환."""
    to_dt = date.today()
    mapping = {"1d": 1, "5d": 5, "1mo": 30, "2mo": 60, "3mo": 90, "6mo": 180,
               "1y": 365, "2y": 730, "5y": 1825, "10y": 3650,
               "15y": 5475, "20y": 7300, "25y": 9125, "30y": 10950,
               "ytd": 365, "max": 10950}
    days = mapping.get(period, 1825)
    from_dt = to_dt - timedelta(days=days)
    return from_dt.isoformat(), to_dt.isoformat()


def _fetch_polygon(ticker: str, period: str) -> Optional[pd.DataFrame]:
    """Polygon.io에서 일봉 OHLCV를 가져와 표준 포맷으로 반환."""
    try:
        from app.data.polygon_client import get_daily_bars, available
        if not available():
            return None
        from_date, to_date = _period_to_dates(period)
        raw = get_daily_bars(ticker, from_date, to_date)
        if raw.empty:
            log.warning("Polygon returned empty for %s", ticker)
            return None
        # polygon 컬럼 → 표준 OHLCV 포맷
        df = raw.rename(columns={
            "open": "Open", "high": "High", "low": "Low",
            "close": "Close", "volume": "Volume",
        })
        df = df.set_index("date")[["Open", "High", "Low", "Close", "Volume"]].copy()
        df.index = pd.to_datetime(df.index)
        df.dropna(inplace=True)
        log.info("Polygon fetch OK %s (%d rows)", ticker, len(df))
        return df
    except Exception as e:
        log.warning("Polygon fetch failed %s: %s — fallback to yfinance", ticker, e)
        return None


def _normalize_yf(df: pd.DataFrame) -> Optional[pd.DataFrame]:
    """yfinance 결과를 표준 OHLCV 포맷으로 정리. 실패 시 None 반환."""
    if df is None or df.empty:
        return None
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    cols = ["Open", "High", "Low", "Close", "Volume"]
    if any(c not in df.columns for c in cols):
        return None
    df.index = df.index.tz_localize(None) if getattr(df.index, "tz", None) else df.index
    out = df[cols].copy()
    out.dropna(inplace=True)
    return out if not out.empty else None


def _fetch_yfinance(ticker: str, period: str, interval: str) -> Optional[pd.DataFrame]:
    """yfinance에서 OHLCV를 가져와 표준 포맷으로 반환.
    download() 실패 시 Ticker.history() 경로로 재시도한다.
    """
    # 1) yf.download — 가장 빠른 경로
    try:
        raw = yf.download(
            ticker,
            period=period,
            interval=interval,
            auto_adjust=True,
            progress=False,
            threads=False,
        )
        n = _normalize_yf(raw)
        if n is not None:
            log.info("yfinance(download) OK %s (%d rows)", ticker, len(n))
            return n
    except Exception as e:
        log.warning("yfinance(download) failed %s: %s", ticker, e)

    # 2) Ticker.history — JSONDecodeError 등 download 버그 우회
    for attempt in range(2):
        try:
            tk = yf.Ticker(ticker)
            raw2 = tk.history(period=period, interval=interval, auto_adjust=True)
            n2 = _normalize_yf(raw2)
            if n2 is not None:
                log.info("yfinance(history) OK %s (%d rows)", ticker, len(n2))
                return n2
        except Exception as e:
            log.warning("yfinance(history) failed %s (try %d): %s", ticker, attempt + 1, e)
        time.sleep(0.5)

    return None


def _slice_to_period(df: pd.DataFrame, period: str) -> pd.DataFrame:
    """캐시에서 읽은 데이터를 요청 period에 맞게 자르는 안전장치."""
    if period in ("max",):
        return df
    try:
        from_str, _ = _period_to_dates(period)
        cutoff = pd.to_datetime(from_str)
        sliced = df[df.index >= cutoff]
        return sliced if not sliced.empty else df
    except Exception:
        return df


def get_history(
    ticker: str,
    period: str = "5y",
    interval: str = "1d",
    force_refresh: bool = False,
) -> pd.DataFrame:
    """
    OHLCV DataFrame 반환 (columns: Open, High, Low, Close, Volume).
    Index는 timezone-naive DatetimeIndex.

    데이터 우선순위:
      1) 캐시 (신선한 경우)
      2) Polygon.io (POLYGON_API_KEY 설정 시)
      3) yfinance (폴백)
      4) 오래된 캐시 (오류 시 최후 수단)

    조정(adjustment) 컨벤션:
      - Polygon = 분할(split) 조정.  yfinance 폴백 = 분할+배당(총수익) 조정.
      - 레버리지 ETF(TQQQ/SOXL/QLD 등 배당 ~0%)는 둘의 차이가 무시할 수준이라
        혼용해도 백테스트 영향 미미. (배당주는 P1 후속에서 총수익 단일화 검토)
      - 실가격 정합성은 tests/test_golden_prices.py 로 검증(source sanity + 결정성 + 교차대조).
    """
    ticker = ticker.upper()
    path = _cache_path(ticker, interval, period)

    # OFFLINE_MODE: 캐시만 사용
    if OFFLINE_MODE:
        df = _read_cache(path, ticker)
        if df is not None and not df.empty:
            return _slice_to_period(df, period)
        raise ValueError(f"No cached data for ticker {ticker} (offline mode)")

    # 신선한 캐시가 있으면 바로 반환
    if not force_refresh and _is_fresh(path, PRICE_CACHE_TTL_MIN):
        df = _read_cache(path, ticker)
        if df is not None and not df.empty:
            return _slice_to_period(df, period)

    # 1순위: Polygon (일봉만 지원)
    df = None
    fetched_fresh = False
    if interval == "1d":
        df = _fetch_polygon(ticker, period)
        if df is not None and not df.empty:
            fetched_fresh = True

    # 2순위: yfinance
    if df is None or df.empty:
        df = _fetch_yfinance(ticker, period, interval)
        if df is not None and not df.empty:
            fetched_fresh = True

    # 신선 fetch 성공 → 반환 '전에' 캐시에 저장 (이전엔 return 뒤라 영영 실행 안 됐던 버그).
    # 오래된/교차 캐시 재사용분은 다시 쓰지 않는다(원본 vintage 보존).
    if fetched_fresh and df is not None and not df.empty:
        try:
            CACHE_DIR.mkdir(parents=True, exist_ok=True)
            df.to_parquet(path)
            log.info("cache write %s → %s (%d rows)", ticker, path.name, len(df))
        except Exception as e:
            log.warning("cache write failed %s: %s", ticker, e)
        return df

    # 3순위: 오래된 캐시 (요청 period 기준)
    if df is None or df.empty:
        log.warning("all sources failed for %s — trying stale cache", ticker)
        df = _read_cache(path, ticker)

    # 4순위: 다른 period 캐시 재사용 (SCHD 등 yfinance 일시 장애 시 구제)
    if (df is None or df.empty) and interval == "1d":
        for p in sorted(CACHE_DIR.glob(f"{ticker}_{interval}_*.parquet"),
                        key=lambda x: x.stat().st_mtime, reverse=True):
            candidate = _read_cache(p, ticker)
            if candidate is not None and not candidate.empty:
                log.warning("using cross-period stale cache %s for %s", p.name, ticker)
                df = _slice_to_period(candidate, period)
                break

    if df is not None and not df.empty:
        return df
    raise ValueError(f"No data for ticker {ticker}")


def get_latest_close(ticker: str) -> float:
    df = get_history(ticker, period="5d", interval="1d")
    return float(df["Close"].iloc[-1])


def get_multiple(tickers: list[str], period: str = "5y") -> dict[str, pd.DataFrame]:
    """Bulk-fetch (sequential, cached)."""
    return {t: get_history(t, period=period) for t in tickers}
