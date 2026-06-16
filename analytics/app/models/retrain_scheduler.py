"""
XGBoost 모델 자동 재학습 스케줄러.

실행 방식:
  1) FastAPI lifespan 이벤트로 백그라운드 스레드에서 실행 (기본)
  2) 독립 실행: python -m app.models.retrain_scheduler

스케줄:
  - 매일 22:30 KST (13:30 UTC) — 미국 장 마감(22:00) 이후 30분 뒤
  - 주말/공휴일 관계없이 실행 (데이터 변화 없으면 joblib 캐시 재사용)

재학습 대상:
  - MODEL_DIR에 존재하는 모든 xgb_*.joblib 파일 (기존 학습 티커)
  - 항상 기본 우주(DEFAULT_UNIVERSE)의 주요 종목도 포함

병렬화 전략 (ai_opt 브랜치):
  - ThreadPoolExecutor(max_workers=3) 으로 XGBoost 학습 병렬화
  - API 페치는 _fetch_lock 으로 순서를 직렬화 (13초 간격 유지 → Polygon 5콜/분 준수)
  - 페치 직후 학습은 lock 해제 후 CPU 멀티스레드로 병렬 실행
  - 효과: 10종목 기준 ~230s → ~130s (학습 시간 오버랩)
"""
from __future__ import annotations
import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta

from app.config import MODEL_DIR, DEFAULT_UNIVERSE
from app.data.yf_client import get_history
from app.models.xgb_signal import train_model

log = logging.getLogger("alpha-helix.retrain")

KST = timezone(timedelta(hours=9))

PRIORITY_TICKERS = [
    "TQQQ", "SOXL", "QQQ", "SPY", "QLD",
    "TECL", "UPRO", "SCHD", "TLT", "GLD",
]

_POLL_INTERVAL_SEC = 60
_FETCH_INTERVAL_SEC = 13   # Polygon 무료 5콜/분 = 12s/call → 13s 여유
_MAX_WORKERS = 3           # API 직렬 + 학습 병렬 (fetch_lock이 실질 동시성 제어)

_last_retrain_date: str | None = None
_retrain_lock = threading.Lock()   # 하루 1회 중복 방지
_fetch_lock = threading.Lock()     # API 페치 순서 직렬화 (rate limit)


def _get_trained_tickers() -> list[str]:
    tickers = []
    for p in MODEL_DIR.glob("xgb_*.joblib"):
        ticker = p.stem.replace("xgb_", "")
        tickers.append(ticker)
    return list(set(PRIORITY_TICKERS + tickers))


def _retrain_one(ticker: str) -> tuple[str, dict]:
    """
    단일 티커 페치 + 학습.

    API 페치는 _fetch_lock 보유 중에 실행하고 13초 sleep 후 해제.
    → 전역 API 호출 속도를 1콜/13s 로 유지하면서
      lock 해제 후 train_model()은 다른 스레드의 페치와 병렬 실행.
    """
    # 1) API 페치 (직렬, rate-limited)
    with _fetch_lock:
        try:
            df = get_history(ticker, period="5y", interval="1d", force_refresh=True)
            log.debug("fetched %s (%d rows)", ticker, len(df))
        except Exception as e:
            log.error("fetch failed %s: %s", ticker, e)
            time.sleep(_FETCH_INTERVAL_SEC)
            return ticker, {"error": f"fetch: {e}"}
        time.sleep(_FETCH_INTERVAL_SEC)  # lock 보유 중 sleep → 다음 스레드의 페치를 13s 뒤로 밀기

    # 2) XGBoost 학습 (병렬 — lock 해제 후)
    try:
        result = train_model(df, ticker)
        log.info("retrained %s — samples=%d cv_acc=%.3f best_iter=%s",
                 ticker, result.get("samples", 0),
                 result.get("cv_avg", {}).get("accuracy", 0),
                 result.get("best_iteration"))
        return ticker, result
    except Exception as e:
        log.error("train failed %s: %s", ticker, e)
        return ticker, {"error": f"train: {e}"}


def retrain_all(force: bool = False) -> dict:
    """
    대상 티커 전체 재학습 (병렬).
    force=False면 오늘 이미 재학습한 경우 skip.
    """
    global _last_retrain_date
    today = datetime.now(KST).strftime("%Y-%m-%d")

    with _retrain_lock:
        if not force and _last_retrain_date == today:
            log.info("retrain skip — already done today (%s)", today)
            return {"status": "skipped", "reason": "already_done_today", "date": today}

        tickers = [
            t for t in _get_trained_tickers()
            if t not in ("^VIX", "BTC-USD", "ETH-USD")
        ]
        log.info("XGBoost retrain START — %d tickers, workers=%d: %s",
                 len(tickers), _MAX_WORKERS, tickers)

        results: dict = {}
        t_start = time.monotonic()

        with ThreadPoolExecutor(max_workers=_MAX_WORKERS, thread_name_prefix="xgb-retrain") as pool:
            futures = {pool.submit(_retrain_one, ticker): ticker for ticker in tickers}
            for future in as_completed(futures):
                ticker, result = future.result()
                results[ticker] = result

        elapsed = time.monotonic() - t_start
        _last_retrain_date = today
        success = sum(1 for v in results.values() if "error" not in v)
        log.info("XGBoost retrain DONE — %d/%d success, elapsed=%.0fs", success, len(results), elapsed)
        return {
            "status": "done",
            "date": today,
            "total": len(results),
            "success": success,
            "elapsed_sec": round(elapsed, 1),
            "results": results,
        }


def _should_retrain_now() -> bool:
    now = datetime.now(KST)
    return now.hour == 22 and 30 <= now.minute <= 31


def _scheduler_loop():
    log.info("XGBoost retrain scheduler started (polls every %ds)", _POLL_INTERVAL_SEC)
    while True:
        try:
            if _should_retrain_now():
                retrain_all()
        except Exception as e:
            log.error("scheduler loop error: %s", e)
        time.sleep(_POLL_INTERVAL_SEC)


def start_scheduler():
    t = threading.Thread(target=_scheduler_loop, daemon=True, name="xgb-retrain")
    t.start()
    log.info("retrain scheduler thread started")
    return t


if __name__ == "__main__":
    import sys
    import json
    logging.basicConfig(level=logging.INFO)
    force = "--force" in sys.argv
    result = retrain_all(force=force)
    print(json.dumps(result, ensure_ascii=False, indent=2))
