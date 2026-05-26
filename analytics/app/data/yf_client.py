"""
yfinance adapter with on-disk Parquet caching.
"""
from __future__ import annotations
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import pandas as pd
import yfinance as yf

from app.config import CACHE_DIR, PRICE_CACHE_TTL_MIN

log = logging.getLogger(__name__)


def _cache_path(ticker: str, interval: str) -> Path:
    return CACHE_DIR / f"{ticker.upper()}_{interval}.parquet"


def _is_fresh(path: Path, ttl_min: int) -> bool:
    if not path.exists():
        return False
    mtime = datetime.fromtimestamp(path.stat().st_mtime)
    return (datetime.now() - mtime) < timedelta(minutes=ttl_min)


OFFLINE_MODE = bool(int(__import__('os').getenv("ANALYTICS_OFFLINE_CACHE", "0")))


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


def get_history(
    ticker: str,
    period: str = "5y",
    interval: str = "1d",
    force_refresh: bool = False,
) -> pd.DataFrame:
    """
    Returns DataFrame with columns: Open, High, Low, Close, Volume.
    Index is timezone-naive DatetimeIndex.
    Cache strategy:
      1) OFFLINE_MODE=1  → ALWAYS read cache, never call yfinance (for EC2 where yfinance is blocked)
      2) normal: cache for PRICE_CACHE_TTL_MIN minutes, fall back to yfinance, fall back to stale cache on error
    """
    ticker = ticker.upper()
    path = _cache_path(ticker, interval)

    # Offline-first: serve cache and never hit network
    if OFFLINE_MODE:
        df = _read_cache(path, ticker)
        if df is not None and not df.empty:
            return df
        raise ValueError(f"No cached data for ticker {ticker} (offline mode)")

    if not force_refresh and _is_fresh(path, PRICE_CACHE_TTL_MIN):
        df = _read_cache(path, ticker)
        if df is not None:
            return df

    log.info("yfinance fetch %s period=%s interval=%s", ticker, period, interval)
    try:
        t = yf.Ticker(ticker)
        df = t.history(period=period, interval=interval, auto_adjust=True)
    except Exception as e:
        log.warning("yfinance error %s: %s — fallback to stale cache", ticker, e)
        df = _read_cache(path, ticker)
        if df is not None and not df.empty:
            return df
        raise ValueError(f"No data for ticker {ticker} (network failed, no cache)")

    if df.empty:
        log.warning("yfinance returned empty for %s — fallback to stale cache", ticker)
        cached = _read_cache(path, ticker)
        if cached is not None and not cached.empty:
            return cached
        raise ValueError(f"No data for ticker {ticker}")

    # Drop tz, keep OHLCV only
    df.index = df.index.tz_localize(None) if df.index.tz else df.index
    df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
    df.dropna(inplace=True)

    try:
        df.to_parquet(path)
    except Exception as e:
        log.warning("cache write failed %s: %s", ticker, e)

    return df


def get_latest_close(ticker: str) -> float:
    df = get_history(ticker, period="5d", interval="1d")
    return float(df["Close"].iloc[-1])


def get_multiple(tickers: list[str], period: str = "5y") -> dict[str, pd.DataFrame]:
    """Bulk-fetch (sequential, cached)."""
    return {t: get_history(t, period=period) for t in tickers}
