"""
KIS(한국투자증권) 시장 데이터 전용 클라이언트.

거래용 backend KisApiClient 와 별개로, analytics 자체 APP_KEY/APP_SECRET 으로
국내주식 일봉 OHLCV 를 수집합니다. 거래 기능은 없습니다.

환경변수:
  KIS_APP_KEY     - KIS OpenAPI 앱 키
  KIS_APP_SECRET  - KIS OpenAPI 앱 시크릿
  KIS_BASE_URL    - 기본값: https://openapi.koreainvestment.com:9443
"""
from __future__ import annotations
import logging
import os
import time
from datetime import date, timedelta

import pandas as pd
import requests

log = logging.getLogger(__name__)

_APP_KEY    = os.getenv("KIS_APP_KEY", "")
_APP_SECRET = os.getenv("KIS_APP_SECRET", "")
_BASE_URL   = os.getenv("KIS_BASE_URL", "https://openapi.koreainvestment.com:9443")

_token_cache: dict = {}  # {"token": str, "expires_at": float}


def available() -> bool:
    """KIS_APP_KEY, KIS_APP_SECRET 환경변수 설정 여부 확인."""
    return bool(_APP_KEY and _APP_SECRET)


def _get_token() -> str:
    """OAuth2 access token 발급 (23h 캐시)."""
    now = time.time()
    if _token_cache.get("token") and now < _token_cache.get("expires_at", 0):
        return _token_cache["token"]

    resp = requests.post(
        f"{_BASE_URL}/oauth2/tokenP",
        json={
            "grant_type": "client_credentials",
            "appkey": _APP_KEY,
            "appsecret": _APP_SECRET,
        },
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    token = data["access_token"]
    _token_cache["token"] = token
    _token_cache["expires_at"] = now + 82800  # 23h
    log.info("KIS token refreshed")
    return token


def _headers(tr_id: str) -> dict:
    return {
        "content-type": "application/json; charset=utf-8",
        "authorization": f"Bearer {_get_token()}",
        "appkey": _APP_KEY,
        "appsecret": _APP_SECRET,
        "tr_id": tr_id,
        "custtype": "P",
    }


def get_domestic_daily(
    ticker: str,
    from_date: str,
    to_date: str,
    adj: bool = True,
) -> pd.DataFrame:
    """
    국내주식 기간별 일봉 조회 (TR: FHKST03010100).

    ticker    : 종목코드 ('005930')
    from_date : 'YYYY-MM-DD'
    to_date   : 'YYYY-MM-DD'
    Returns   : DataFrame(date, symbol, source, open, high, low, close, volume)
    """
    resp = requests.get(
        f"{_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice",
        headers=_headers("FHKST03010100"),
        params={
            "FID_COND_MRKT_DIV_CODE": "J",
            "FID_INPUT_ISCD": ticker,
            "FID_INPUT_DATE_1": from_date.replace("-", ""),
            "FID_INPUT_DATE_2": to_date.replace("-", ""),
            "FID_PERIOD_DIV_CODE": "D",
            "FID_ORG_ADJ_PRC": "1" if adj else "0",
        },
        timeout=15,
    )
    resp.raise_for_status()
    rows = resp.json().get("output2") or []
    if not rows:
        return pd.DataFrame()

    records = []
    for r in rows:
        d = r.get("stck_bsop_date", "")
        if not d or len(d) != 8:
            continue
        records.append({
            "date":   f"{d[:4]}-{d[4:6]}-{d[6:]}",
            "symbol": ticker,
            "source": "kis",
            "open":   float(r.get("stck_oprc") or 0),
            "high":   float(r.get("stck_hgpr") or 0),
            "low":    float(r.get("stck_lwpr") or 0),
            "close":  float(r.get("stck_clpr") or 0),
            "volume": float(r.get("acml_vol")  or 0),
        })

    if not records:
        return pd.DataFrame()

    df = pd.DataFrame(records)
    df["date"] = pd.to_datetime(df["date"])
    return df.sort_values("date").reset_index(drop=True)


def get_domestic_daily_full(
    ticker: str,
    from_date: str,
    to_date: str,
    adj: bool = True,
    chunk_days: int = 90,
) -> pd.DataFrame:
    """
    장기간 일봉 수집 — 90일 청크로 나눠 페이지네이션.
    KIS API 는 한 번에 약 100봉 반환 → 청크 분할 필수.
    """
    start = date.fromisoformat(from_date)
    end   = date.fromisoformat(to_date)

    frames = []
    cur = start
    while cur <= end:
        chunk_end = min(cur + timedelta(days=chunk_days - 1), end)
        try:
            df_chunk = get_domestic_daily(ticker, cur.isoformat(), chunk_end.isoformat(), adj=adj)
            if not df_chunk.empty:
                frames.append(df_chunk)
        except Exception as e:
            log.warning("KIS chunk fail %s %s~%s: %s", ticker, cur, chunk_end, e)
        cur = chunk_end + timedelta(days=1)
        time.sleep(0.12)  # KIS rate limit (초당 약 20 req)

    if not frames:
        return pd.DataFrame()

    result = pd.concat(frames, ignore_index=True)
    result = result.drop_duplicates(subset=["date", "symbol"]).sort_values("date").reset_index(drop=True)
    return result
