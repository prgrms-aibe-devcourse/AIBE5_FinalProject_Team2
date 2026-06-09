"""
실가격 골든 검증 — 백테스트가 '진짜 시장 종가'를 쓰는지 보증한다.

검증 항목 (3개 핵심 전략 자산 TQQQ/SOXL/QLD + 벤치마크):
  1) sanity   : 양수 종가 · 오름차순 날짜 · 충분한 행수 · 최신 종가가 '오늘 근처'
  2) 교차대조 : Polygon(분할조정) vs yfinance(분할+배당조정) 의 겹치는 최근 종가가
                허용오차(3%) 안에서 일치 → 두 독립 실데이터가 일치 = 가격이 실제라는 강한 증거
  3) 결정성   : 같은 요청 2회 → 동일 데이터 (캐시/소스 흔들림 없음)

실행:  python -m tests.test_golden_prices   (cwd=analytics, POLYGON_API_KEY 설정 권장)
pytest 로도 수집됨 (test_* 함수).
"""
from __future__ import annotations
import sys
from datetime import date

import pandas as pd

from app.data.yf_client import get_history

TICKERS = ["TQQQ", "SOXL", "QLD", "SPY"]
TOL = 0.03  # 교차대조 허용오차 3%


def _sanity(tk: str, df: pd.DataFrame) -> list[str]:
    errs = []
    close = df["Close"]
    if (close <= 0).any():
        errs.append("non-positive close")
    if not df.index.is_monotonic_increasing:
        errs.append("dates not ascending")
    if len(df) < 200:
        errs.append(f"too few rows ({len(df)})")
    last = df.index[-1].date()
    if (date.today() - last).days > 10:
        errs.append(f"stale last date {last}")
    return errs


def _yf_direct_last(tk: str) -> tuple[pd.Timestamp, float] | None:
    """yfinance 직접 조회(독립 소스)로 최근 종가 — 실패하면 None."""
    try:
        import yfinance as yf
        raw = yf.Ticker(tk).history(period="1mo", auto_adjust=True)
        if raw is None or raw.empty:
            return None
        raw.index = raw.index.tz_localize(None) if getattr(raw.index, "tz", None) else raw.index
        return raw.index[-1], float(raw["Close"].iloc[-1])
    except Exception as e:
        print(f"  (yfinance 교차대조 불가 {tk}: {e})")
        return None


def run() -> int:
    failures = 0
    print(f"{'TICKER':7} {'rows':>5} {'last_date':12} {'last_close':>11}  cross-check")
    for tk in TICKERS:
        try:
            df = get_history(tk, period="2y")
        except Exception as e:
            print(f"{tk:7} FETCH FAILED: {e}")
            failures += 1
            continue

        errs = _sanity(tk, df)
        last_close = float(df["Close"].iloc[-1])
        last_date = df.index[-1].date()

        # 교차대조
        xcheck = "n/a"
        yf_last = _yf_direct_last(tk)
        if yf_last is not None:
            yf_date, yf_close = yf_last
            diff = abs(last_close - yf_close) / yf_close if yf_close else 1.0
            xcheck = f"yf=${yf_close:.2f} Δ={diff*100:.2f}%"
            if diff > TOL:
                errs.append(f"cross-source mismatch {diff*100:.1f}% > {TOL*100:.0f}%")

        # 결정성
        df2 = get_history(tk, period="2y")
        if not df["Close"].tail(50).round(4).equals(df2["Close"].tail(50).round(4)):
            errs.append("non-deterministic (two fetches differ)")

        status = "OK" if not errs else "FAIL: " + "; ".join(errs)
        print(f"{tk:7} {len(df):>5} {str(last_date):12} {last_close:>11.2f}  {xcheck}  [{status}]")
        if errs:
            failures += 1

    print(f"\n{'ALL GOLDEN OK' if failures == 0 else f'{failures} TICKER(S) FAILED'}")
    return failures


# pytest 진입점
def test_golden_prices():
    assert run() == 0, "golden price verification failed"


if __name__ == "__main__":
    sys.exit(1 if run() else 0)
