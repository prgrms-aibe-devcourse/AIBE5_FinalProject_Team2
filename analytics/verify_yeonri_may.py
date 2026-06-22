# -*- coding: utf-8 -*-
"""
연리무한매수법 5월 정밀 재현 검증 (직접 실행용).

실행:  cd analytics && .venv/Scripts/python.exe verify_yeonri_may.py

무엇을 검증하나:
  실제 이효연님 계좌(KIS)의 2026년 5월 해외주식 실현손익 = ₩8,026,367 (8건 매도).
  같은 종목(TQQQ/SOXL)·같은 전략(연리무한매수법)을 우리 백테스트 엔진으로 5월 구간 돌렸을 때
  같은 금액이 나오는지 = "코드로 검증되고 똑같은 결과" 의 증명.

핵심 입력값 (실제 5월 거래 29장 OCR 역산 — docs 참조):
  · 연리 활성 시드 ≈ ₩170M (= 전체계좌 ₩3.4억의 약 50%, 5월 증액상태)
  · 일매수 평균: TQQQ ~$2,000 / SOXL ~$860 (가속·재진입 포함)
  · 종목 가중 ≈ TQQQ 0.70 : SOXL 0.30
  · 규칙: 40분할, 평단×1.13 익절(1주 남김), 평단×1.10 보통가매수,
          익절후 0.5분할 보통가 재매수(사다리타기) = restart_buy_fraction
  · 엔진은 OHLC 고가/시가로 지정가 매도를 정밀 체결 (종가 과대 제거)
"""
import os, sys, io
os.environ["OFFLINE_MODE"] = "1"          # 캐시만 사용 (네트워크 불필요)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from app.data.yf_client import get_history
from app.backtest.infinite_buying import InfiniteBuyingParams, run_infinite_buying

# ── 실제값 (검증 앵커) ───────────────────────────────────────────────
FX = 1490.0
REAL_MAY_TOTAL = 8_026_367          # 실제 5월 순손익 (q1~q3 캡처)
REAL_MAY_SOXL  = 2_500_746          # 그중 SOXL
REAL_MAY_TQQQ  = 4_064_288          # 그중 TQQQ (나머지는 더보기)
ACTIVE_SEED_KRW = 170_000_000       # 연리 활성 시드 (역산값)
SEED = ACTIVE_SEED_KRW / FX         # USD 환산 ≈ $114k
W = chr(0x20a9)

# ── 검증된 연리 파라미터 (= YeonriPreset.java 와 동일 규칙) ─────────────
params = InfiniteBuyingParams(
    split=40,
    take_profit_pct=13.0,           # 평단×1.13 익절
    loc_offset_pct=10.0,            # 평단×1.10 이내 보통가 매수
    leave_shares=1.0,               # 익절 시 1주 남김
    compound=False,                 # 고정 일매수
    restart_buy_fraction=0.5,       # 익절후 0.5분할 보통가 재매수(사다리타기)
    ticker_weights={"TQQQ": 0.70, "SOXL": 0.30},
    initial_capital=SEED,
    variant="yeonri",
)

# ── 실제 데이터 로드 (5월 이전부터 = 포지션 쌓이게) + OHLC ──────────────
closes, highs, opens = {}, {}, {}
for t in ["TQQQ", "SOXL"]:
    df = get_history(t, period="1y").loc["2026-02-01":"2026-06-02"]
    closes[t], highs[t], opens[t] = df["Close"], df["High"], df["Open"]

# ── 엔진 실행 (OHLC 정밀체결) ────────────────────────────────────────
r = run_infinite_buying(closes, params, highs=highs, opens=opens)

# ── 5월 매도(익절)만 뽑아서 실제와 비교 ───────────────────────────────
sells = [tr for tr in r["recent_trades"] if tr["side"] == "SELL" and tr["date"] >= "2026-05-01"]
eng_total = sum(t.get("realized", 0) for t in sells) * FX
eng_tqqq  = sum(t.get("realized", 0) for t in sells if t["ticker"] == "TQQQ") * FX
eng_soxl  = sum(t.get("realized", 0) for t in sells if t["ticker"] == "SOXL") * FX

print(f"활성시드 {W}{ACTIVE_SEED_KRW:,} (${SEED:,.0f}) | 가중 TQQQ 0.70 : SOXL 0.30 | OHLC 정밀체결\n")
print(f"{'항목':<8} {'엔진':>14} {'실제':>14} {'배수':>7}")
print(f"{'5월 총':<8} {W}{round(eng_total):>13,} {W}{REAL_MAY_TOTAL:>13,} {eng_total/REAL_MAY_TOTAL:>6.2f}x")
print(f"{'  TQQQ':<8} {W}{round(eng_tqqq):>13,} {W}{REAL_MAY_TQQQ:>13,} {eng_tqqq/REAL_MAY_TQQQ:>6.2f}x")
print(f"{'  SOXL':<8} {W}{round(eng_soxl):>13,} {W}{REAL_MAY_SOXL:>13,} {eng_soxl/REAL_MAY_SOXL:>6.2f}x")
print(f"\n엔진 5월 익절 {len(sells)}건 (실현률은 OHLC 덕에 ≈ 정확히 +13%):")
for t in sells:
    print(f"  {t['date']} {t['ticker']:4} {t['qty']:>7.1f}주 @ ${t['price']:<8} "
          f"익절 {t['tp_pct']}% → 실현 {W}{round(t.get('realized', 0) * FX):>10,}")
print("\n[실제 8건] 05-01 SOXL·TQQQ / 05-05 SOXL / 05-08 SOXL·TQQQ / 05-26 SOXL / 05-28 TQQQ / 06-02 SOXL")
