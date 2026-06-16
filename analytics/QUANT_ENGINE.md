# Alpha-Helix 퀀트 엔진 (Python / Analytics) — 완전 레퍼런스

> `analytics/` FastAPI 서비스 전체 문서. 데이터 수집 → 백테스트 → ML 시그널 → 강건성(Trust) 분석 → Lean(QuantConnect) 엔진까지 한 곳에 정리.
> 코드 규모: **약 30,000 LOC** (그중 `app/lean/` 의 kis_backtest 프레임워크가 ~22,800 LOC).
> 작성 기준: `C:\Alpha_Helix\analytics` (실제 가동 본). 포트 **:8001**.

---

## 목차

1. [개요 & 아키텍처](#1-개요--아키텍처)
2. [실행 / 환경 변수](#2-실행--환경-변수)
3. [디렉터리 맵](#3-디렉터리-맵)
4. [설정 (`app/config.py`)](#4-설정-appconfigpy)
5. [데이터 레이어 (`app/data/`)](#5-데이터-레이어-appdata)
6. [백테스트 엔진 (`app/backtest/`)](#6-백테스트-엔진-appbacktest)
7. [ML 시그널 (`app/models/`, `app/explain/`)](#7-ml-시그널-appmodels-appexplain)
8. [성과 지표 (`app/metrics/`)](#8-성과-지표-appmetrics)
9. [강건성·신뢰도 분석 (`app/robust/`)](#9-강건성신뢰도-분석-approbust)
10. [Lean 백테스트 엔진 (`app/lean/`)](#10-lean-백테스트-엔진-applean)
11. [코드 생성 (`app/codegen/`)](#11-코드-생성-appcodegen)
12. [REST API 전체 레퍼런스](#12-rest-api-전체-레퍼런스)
13. [핵심 상수 & 매직넘버](#13-핵심-상수--매직넘버)
14. [데이터 흐름 요약](#14-데이터-흐름-요약)
15. [용어집](#15-용어집)

---

## 1. 개요 & 아키텍처

Analytics 는 Spring Boot 백엔드의 **사이드카**로 동작하는 FastAPI 서비스다. 백엔드가 `ANALYTICS_INTERNAL_TOKEN` 헤더로 호출하며, 외부에 직접 노출되지 않는다(`/reports/*.html` 정적 서빙만 공개).

```
Frontend (React :5173)
    ↕ REST / JWT
Backend (Spring Boot :9091)
    ↕ HTTP + X-Internal-Token
Analytics (FastAPI :8001)   ← 이 문서의 대상
    ├─ 시장 데이터 수집/캐시 (yfinance·Polygon·Binance·FRED·KIS → MySQL/TimescaleDB)
    ├─ vectorbt 백테스트 (6 기본전략 + 무한매수법·VR·모멘텀로테이션·선물)
    ├─ XGBoost 일일 시그널 + SHAP 설명
    ├─ Trust Score (Walk-Forward + Regime HMM + 파라미터 섭동 + DSR)
    ├─ QuantStats HTML Tearsheet
    └─ Lean(QuantConnect) Docker 백테스트 + kis_backtest 전략빌더 DSL
```

**핵심 설계 원칙**
- 모든 백테스트는 동일한 비용모델: **수수료 0.25% + 슬리피지 0.1%** (KIS 해외주식 실수수료 기준). 선물은 0.04% + 펀딩비.
- 가짜 데이터 금지 — 데이터/모델이 부족하면 `None` 반환하거나 룰베이스로 폴백하고 그 사실을 응답에 표기(`method`, `hmm_fallback` 등).
- FastAPI lifespan 에서 스케줄러 2종 기동: XGBoost 재학습(22:30 KST) + 시장데이터 수집.

**기술 스택**: Python 3.11 · FastAPI 0.115 · vectorbt 0.26 · quantstats · xgboost 2.1 · SHAP · hmmlearn · pandas/numpy · SQLAlchemy(MySQL) · Docker(quantconnect/lean).

---

## 2. 실행 / 환경 변수

### 실행
```bash
cd analytics
python -m venv .venv && .venv\Scripts\activate   # (Windows)
pip install -r requirements.txt
uvicorn app.main:app --port 8001 --reload
```
> ⚠️ 로컬에서 `--reload` 가 실제로 안 먹는 경우가 있다(`app/*.py` 편집 미반영). Python 엔진 변경 후엔 uvicorn **수동 재시작** 필요.

### 인증
- 모든 엔드포인트(`/health`, `/reports/*` 제외)는 헤더 `X-Internal-Token: <ANALYTICS_INTERNAL_TOKEN>` 필요. 불일치 시 **401**.

### 환경 변수 전체

| 변수 | 기본값 | 용도 |
|---|---|---|
| `ANALYTICS_INTERNAL_TOKEN` | `dev-internal-token-change-me` | BE→analytics 인증 토큰 |
| `PRICE_CACHE_TTL_MIN` | `60` | 가격 parquet 캐시 TTL(분) |
| `ANALYTICS_OFFLINE_CACHE` | `0` | `1`이면 캐시 전용(네트워크 미사용) |
| `DISABLE_RETRAIN_SCHEDULER` | `0` | `1`이면 lifespan 스케줄러 비활성 |
| `POLYGON_API_KEY` | `""` | Polygon.io US 주식(미설정 시 yfinance 폴백) |
| `FRED_API_KEY` | `""` | FRED 매크로 지표 |
| `BINANCE_API_KEY` / `BINANCE_API_SECRET` | `""` | Binance 주문/잔고(공개 데이터는 불필요) |
| `BINANCE_TESTNET` | `0` | `1`이면 testnet |
| `BINANCE_BASE_URL` | `https://api.binance.us` | 엔드포인트(`.us`/`.com`) |
| `KIS_APP_KEY` / `KIS_APP_SECRET` | `""` | KIS 국내주식 데이터 |
| `KIS_BASE_URL` | `https://openapi.koreainvestment.com:9443` | KIS 엔드포인트 |
| `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USERNAME`/`DB_PASSWORD` | localhost/3306/… | 시장 데이터 DB |
| `TIMESCALEDB_URL` | `postgresql://…:5432/devbridge_ts` | (선택) TimescaleDB 마이그레이션 대상 |
| `LEAN_BIN` | (PATH 탐색) | lean CLI 바이너리 경로 override |

---

## 3. 디렉터리 맵

```
analytics/
├── app/
│   ├── main.py                 FastAPI 앱 · 24개 엔드포인트 · lifespan 스케줄러 (1335 LOC)
│   ├── config.py               경로·토큰·기본 유니버스·수수료/슬리피지 기본값
│   ├── data/                   시장 데이터 (1663 LOC)
│   │   ├── yf_client.py        yfinance/Polygon 가격 + parquet 캐시 (메인 게이트웨이)
│   │   ├── binance_client.py   Binance 현물/선물 REST (OHLCV·오더북·펀딩·주문)
│   │   ├── kis_client.py       KIS 국내주식 일봉 (OAuth 토큰 23h 캐시)
│   │   ├── polygon_client.py   Polygon.io 미국주식 일봉/분봉/시세
│   │   ├── fred_client.py      FRED 매크로 지표
│   │   ├── catalog.py          데이터셋 카탈로그(QC 스타일, live 플래그)
│   │   ├── collector.py        스케줄 수집기(UTC 시각 트리거)
│   │   └── market_db.py        MySQL OHLCV/매크로 저장·조회
│   ├── backtest/               백테스트 엔진 (1921 LOC)
│   │   ├── vbt_engine.py       vectorbt 6 기본전략 + 통계
│   │   ├── infinite_buying.py  무한매수법(laoer/yeona)
│   │   ├── value_rebalancing.py 밸류 리밸런싱(VR)
│   │   ├── momentum_rotation.py 멀티자산 모멘텀 로테이션
│   │   ├── futures_engine.py    Binance 선물(레버리지·펀딩·SL/TP)
│   │   └── enrich.py            결과 보강(드로다운/월수익/PSR 등)
│   ├── models/                 ML (434 LOC)
│   │   ├── xgb_signal.py        XGBoost 시그널(21 피처)
│   │   └── retrain_scheduler.py 22:30 KST 재학습 스케줄러
│   ├── explain/shap_explainer.py  SHAP 기여도 + 한국어 요약
│   ├── metrics/quantstats_report.py  QuantStats 지표 계산
│   ├── robust/                 강건성 분석 (1333 LOC)
│   │   ├── walkforward.py       Walk-Forward OOS 검증
│   │   ├── regime.py            5-state 시장국면(룰/HMM)
│   │   └── trust_score.py       0~100 신뢰도 종합점수
│   ├── codegen/portfolio_codegen.py  엔진→독립 .py 코드 생성
│   └── lean/                   Lean 백테스트 (22823 LOC)
│       ├── runner.py            오케스트레이션 진입점
│       ├── jobs.py             백그라운드 잡(폴링)
│       ├── credentials.py / kis_auth.py  KIS 인증
│       └── kis_backtest/       전략빌더 DSL + 코드젠 + Docker 실행 + 리포트
│           ├── core/  dsl/  models/  file/  codegen/
│           ├── strategies/{registry,base,preset/*,risk}
│           ├── providers/kis/{auth,brokerage,data,websocket,constants}
│           ├── lean/{executor,project_manager,data_converter,result_formatter,optimizer}
│           ├── report/{generator,components,themes}
│           └── portfolio/{analyzer,rebalance,visualizer}
├── migrate_timescaledb.py      MySQL→TimescaleDB 마이그레이션 도구
├── parse_hmm.py                HMM 결과 파싱 유틸
├── verify_yeona_may.py         연아무한매수법 5월 실거래 검증 스크립트
└── requirements.txt
```

---

## 4. 설정 (`app/config.py`)

| 상수 | 값 | 의미 |
|---|---|---|
| `ROOT_DIR` | `analytics/` | 루트 경로 |
| `CACHE_DIR` | `ROOT/cache` | 가격 parquet 캐시 |
| `REPORTS_DIR` | `ROOT/reports` | QuantStats HTML 출력(공개 서빙) |
| `MODEL_DIR` | `ROOT/models_cache` | XGBoost 모델 저장 |
| `INTERNAL_TOKEN` | env | 내부 인증 토큰 |
| `PRICE_CACHE_TTL_MIN` | 60 | 캐시 TTL |
| `DEFAULT_INITIAL_CAPITAL` | 10,000 USD | 백테스트 기본 자본 |
| `DEFAULT_FEES` | 0.0025 | 0.25% 수수료 |
| `DEFAULT_SLIPPAGE` | 0.001 | 0.10% 슬리피지 |
| `DEFAULT_UNIVERSE` | 23종목 | 시그널 기본 유니버스 |

**`DEFAULT_UNIVERSE`** (3x 레버리지 ETF 중심):
`DFEN, FAS, FNGU, LABU, MIDU, NAIL, RETL, SOXL, TECL, TNA, TPOR, TQQQ, UPRO, WANT, WEBL` (3x) · `QLD, QQQ, SPY` (2x/벤치) · `SCHD, SHY, TLT, GLD` (방어) · `^VIX, BTC-USD, ETH-USD`.

---

## 5. 데이터 레이어 (`app/data/`)

### 5.1 가격 게이트웨이 — `yf_client.get_history()`
모든 백테스트/시그널의 가격 진입점. **폴백 체인**:
1. 신선한 parquet 캐시 (`{ticker}_{interval}_{period}.parquet`, mtime < TTL)
2. Polygon.io 일봉 (`POLYGON_API_KEY` 있고 `interval=1d`일 때, 분할조정)
3. yfinance (`yf.download` → `Ticker.history`, 2회 재시도·0.5s 백오프, 분할+배당조정)
4. **stale 캐시** (모든 소스 실패 시 최후의 보루)
5. 교차 period 캐시 (다른 타임프레임 parquet 재활용)

반환: `DataFrame[Open, High, Low, Close, Volume]`, tz-naive DatetimeIndex. period 매핑 `1d/5y/max` 등. 보조: `get_latest_close(ticker)`, `get_multiple(tickers, period)`.

### 5.2 소스별 클라이언트

| 클라이언트 | 소스 | 핵심 함수 | 비고 |
|---|---|---|---|
| `binance_client` | Binance REST v3/선물 | `get_klines(_full)`, `get_orderbook`, `get_ticker_24h`, `get_funding_rate`, `place_spot_order`, `place_futures_order` | 공개 데이터 무인증, 1200 req/min. 주문은 HMAC-SHA256 서명. 페이지네이션 0.1s sleep, 타임아웃 20s |
| `kis_client` | KIS OpenAPI | `get_domestic_daily(_full)` | TR `FHKST03010100`. OAuth 토큰 23h 메모리캐시. 90일 청크·0.12s sleep |
| `polygon_client` | Polygon.io | `get_daily_bars`, `get_intraday_bars`, `get_latest_quote` | 최대 50000 bar/콜, ET→tz-naive |
| `fred_client` | FRED | `get_series`, `get_macro_bundle` | 9종 매크로(FEDFUNDS·DGS10·DGS2·T10Y2Y·VIXCLS·CPIAUCSL·UNRATE·DCOILWTICO). T10Y2Y 없으면 DGS10-DGS2 로 계산 |

각 클라이언트는 `available()`/`ping()` 으로 키 존재·헬스를 게이트한다.

### 5.3 저장 — `market_db.py` (MySQL, utf8mb4)
테이블 3종: **`market_ohlcv`**(symbol·source·tf·ts 유니크, `INSERT … ON DUPLICATE KEY UPDATE` 멱등), **`market_macro`**(series_id·ts), **`market_data_log`**(감사). 주요 함수: `upsert_ohlcv`, `query_ohlcv`, `latest_close`, `upsert_macro`, `query_macro`, `get_collection_stats`. 커넥션 풀 `pool_pre_ping`, `pool_recycle=3600`.

### 5.4 수집 스케줄러 — `collector.py` (UTC 트리거, 60s 폴링)

| 시각(UTC) | 작업 | 심볼 | days_back |
|---|---|---|---|
| 06:00 | US OHLCV | `US_SYMBOLS`(TQQQ·SOXL·UPRO·QLD·TNA·LABU·SPY·QQQ·TLT·GLD…) | 3 |
| 06:00 | Crypto OHLCV | `CRYPTO_SYMBOLS`(BTC·ETH·SOL·BNB·DOGE USDT) | 3 |
| 07:00 | Macro(FRED) | `FRED_SERIES`(8종) | 7 |
| 09:00 | KIS OHLCV | `KIS_DOMESTIC_SYMBOLS`(삼성전자 등 10종) | 3 |
| 매시 | Crypto 1h | `CRYPTO_SYMBOLS` | 1 |

`full_initial_load(years_back=5)` 는 기동 시 5년치 백필(소스별 병렬 스레드). `start_scheduler()`/`stop_scheduler()`.

### 5.5 카탈로그 — `catalog.py`
QC Datasets 스타일 데이터셋 목록. `live=True` 는 커넥터가 실데이터를 줄 때만(yfinance·Binance 상시, FRED·Polygon 은 키 유무에 따라 런타임 결정). 로드맵(stooq·tiingo·coingecko·sec_edgar 등)은 `live=False`.

### 5.6 TimescaleDB 마이그레이션 — `migrate_timescaledb.py`
MySQL → TimescaleDB(PG16) 전환 도구. 하이퍼테이블(30일 청크), 90일 압축정책(zstd), 주간 연속집계(`market_ohlcv_weekly`), `ohlcv_recent()` 함수. CLI: `--dry-run / --export-only / --import-only`.

---

## 6. 백테스트 엔진 (`app/backtest/`)

> 공통 비용모델: 진입가 `price×(1+slippage)`, 청산가 `price×(1-slippage)`, 양다리 수수료 `fees`. 모든 엔진은 `_strategy_returns`(일별 수익률 Series)를 반환해 QuantStats·enrich 가 재사용한다.

### 6.1 vectorbt 엔진 — `vbt_engine.py` (6 기본전략)

`BacktestParams` 주요 필드: `strategy, sma_fast=20, sma_slow=60, rsi_period=14, rsi_low=30, rsi_high=70, macd_fast=12/slow=26/signal=9, momentum_long_days=252, momentum_short_days=21, vix_threshold=25.0, initial_capital=10000, fees=0.0025, slippage=0.001`.

| 전략 | 진입 | 청산 |
|---|---|---|
| `buy_and_hold` | 0일차 1회 | 없음(끝까지 보유) |
| `sma_cross` | SMA(fast) ↗ SMA(slow) 골든크로스 | SMA(fast) ↘ SMA(slow) 데드크로스 |
| `rsi_meanrev` | RSI < rsi_low(과매도) | RSI > rsi_high(과매수) |
| `macd` | MACD선 ↗ 시그널선 | MACD선 ↘ 시그널선 |
| `momentum_12_1` | `pct_change(252) − pct_change(21) > 0` 진입전환 | score ≤ 0 전환 |
| `vix_risk_off` | VIX ≤ threshold(위험선호) | VIX > threshold(안전선호) — `^VIX` 시리즈 필요 |

시그널은 **look-ahead 방지**로 1봉 시프트 후 `vbt.Portfolio.from_signals(close, entries, exits, init_cash, fees, slippage, freq="1D")` 에 투입.

**stats 딕셔너리**(공통): `total_return_pct, annualized_return_pct, max_drawdown_pct, sharpe(×√252), sortino(하방편차), calmar(CAGR/|MDD|), win_rate_pct, trades, start, end, holdings_value_end, cash_end, unrealized_pnl`. 추가로 `equity_curve/holdings_curve/cash_curve/exposure_curve`, `orders/trades` 리스트.

보조: `latest_signal(close, p)` → `{signal: BUY|SELL|HOLD, reason, last_close, last_date}` (최근 5봉 이벤트 기반).

### 6.2 무한매수법 — `infinite_buying.py`

`InfiniteBuyingParams`: `split=40, take_profit_pct=10, loc_offset_pct=15, initial_capital, fees=0.0025, slippage=0.001, leave_shares=0, compound=True, ticker_weights=None, variant="laoer", restart_buy_fraction=0.0, xgb_overlay=False, xgb_skip_threshold=0.38`.

**일일 로직**(종목별 상태 `_AssetState`: cash_alloc·qty·cost_basis·avg_price·cycle_idx·cycle_budget·realized_pnl):
1. **익절**: `high(또는 close) ≥ avg×(1+tp/100)` 이면 `qty−leave_shares` 매도 → cycle 리셋, `cycles_completed++`. `compound=True` 면 잔여현금 재분할. `restart_buy_fraction>0`(연아) 이면 익절 직후 보통가로 `cycle_budget×fraction` 즉시 재매수(평단 재기준 = 사다리타기).
2. **매수**(`cycle_idx < split`): `close ≤ avg`(또는 초기) → **loc_avg**(1.0 분할); `close ≤ avg×(1+loc_offset/100)` → **loc_large**(0.5 분할, XGBoost 하락확률 높으면 skip); 그 외 매수 없음. 매수액 `cycle_budget×fraction`(현금 한도).
3. **MTM**: `equity = cash_alloc + qty×close`.

**variant 비교**: `laoer`=익절 시 전량 매도(leave_shares=0, compound=True). `yeona`=`leave_shares=1, compound=False, restart_buy_fraction=0.5, take_profit_pct=13, loc_offset_pct=10, split=40` (main.py `YEONA_DEFAULTS`). TQQQ:SOXL 가중 미지정 시 실거래 검증값 73:27 자동 적용.

멀티종목 자본배분: `ticker_weights` 있으면 가중, 없으면 균등(`initial_capital/N`). stats 에 `realized_pnl_total, estimated_monthly_cashflow, cycles_completed` 포함. 보조 `latest_order_plan()` → 익일 주문계획(`reason: loc_avg|loc_large|take_profit`).

### 6.3 밸류 리밸런싱(VR) — `value_rebalancing.py`

`ValueRebalancingParams`: `rebalance_days=10, expected_return=0.02, band_pct=0.20, pool_target_pct=0.50, initial_pool_pct=0.50, biweekly_contrib=0, initial_capital, fees, slippage`.

V-band 평균회귀: 목표가치 `V`가 매 cycle `V_next = V×(1+expected_return)+contrib` 로 상승. 일일 `port_value = shares×close` 가 **하단밴드**(`V×(1−band)`) 밑이면 중심값까지 매수(Pool 한도), **상단밴드**(`V_next×(1+band)`) 위면 매도(단, Pool ≤ `port×pool_target_pct` 캡). `rebalance_days`마다 V 갱신. **정수주 only**. stats·per_ticker(V, V_next, rebalances)·`latest_vr_plan()`(`reason: vr_lower|vr_upper|hold`).

### 6.4 모멘텀 로테이션 — `momentum_rotation.py`

`MomentumRotationParams`: `lookback_days=252, skip_recent_days=21, top_n=3, rebalance_days=21, abs_momentum_gate=True, cash_asset="BIL", …`.

12-1 모멘텀 `mom = close[i−skip]/close[i−look] − 1`(look-ahead free). 리밸런스일에 위험자산 모멘텀 랭킹 → 상위 `top_n` 균등보유. **절대모멘텀 게이트**: 음수 모멘텀 슬롯은 `cash_asset`(또는 현금)로 회피. 매도(rot_exit/trim)→매수(rot_enter) 순. stats·per_ticker(momentum, in_portfolio).

### 6.5 선물 엔진 — `futures_engine.py`

`FuturesParams`: `symbol="BTCUSDT", strategy(sma_cross|rsi_reversal|momentum|funding_arb), leverage=5(최대 20 제한), fees=0.0004, slippage=0.001, max_position_pct=0.5, stop_loss_pct=0.05, take_profit_pct=0.15, period="1y"`.

데이터: DB→Binance→yfinance(지오차단 시 BTCUSDT→BTC-USD 매핑) 폴백. 시그널 1/−1/0. **펀딩비** 일일 차감(롱은 지불·숏은 수취). 청산: SL/TP/시그널반전. stats 에 `funding_cost_total_usd`. 보조 `get_futures_signal()` → 현재 신호 + suggested_order.

### 6.6 결과 보강 — `enrich.py`

`enrich_result(result, close)` 가 추가하는 시계열: `drawdown_curve`(언더워터), `returns_daily`, `monthly_returns`(히트맵), `benchmark_curve`(매수보유 비교). 추가 stats(멱등 setdefault): `net_profit(_pct), volatility_pct, best/worst_day_pct, avg_win/loss_pct, positive/negative_days, profit_factor, expectancy_pct, benchmark_return_pct`, 그리고 **PSR(Probabilistic Sharpe Ratio)** — Bailey & López de Prado, 왜도·첨도 보정한 `P(SR>0)`. `orders_trades_from_pf(pf)` 로 vectorbt Portfolio → 주문/체결 JSON 변환(`total_fees`, `volume`).

---

## 7. ML 시그널 (`app/models/`, `app/explain/`)

### 7.1 XGBoost — `xgb_signal.py`
**21 피처(v2)** = v1 13개 + v2 8개:
- v1: `ret_1/5/20, sma_20/60/200_ratio, vol_20/60, rsi_14, macd, macd_signal_diff, range_pct, vol_ratio_20`
- v2: `above_ma50, above_ma200, trend_strength(MA50/MA200−1, [−0.5,0.5] clip), vol_ratio_5/60, atr_14_pct, bear_pressure((H−C)/(H−L)), mom_60`

**라벨** `y_next_up = (close.shift(-1) > close)`. 학습: 5-fold `TimeSeriesSplit` CV(폴드1~4 표준, 폴드5 early stopping) + 최종 80/20 split. 하이퍼파라미터: `max_depth=4, lr=0.03~0.05, n_estimators=200~400, subsample/colsample≈0.85~0.9, early_stopping_rounds=30, eval_metric=logloss, random_state=42`.

저장: `MODEL_DIR/xgb_{TICKER}.joblib` = `{model, features, version:2}`.

- `train_model(df, ticker)` → `{ticker, samples, cv_avg{accuracy,precision,recall}, model_path, n_features, best_iteration}`.
- `predict_proba_up(df, ticker)` → `{proba_up, as_of, model_version, n_features}` 또는 데이터/모델 부족 시 **None**(v1/v2 피처 교집합 자동 호환).
- `predict_signal_for_yeona(df, ticker, strong_down_threshold=0.38)` → `NO_MODEL | SKIP_LOC_LARGE | ALLOW_LOC_LARGE` (무한매수법 XGBoost 오버레이 게이트).

### 7.2 재학습 스케줄러 — `retrain_scheduler.py`
매일 **22:30 KST**(=13:30 UTC, 미장 마감 ~30분 후). 대상 = 기존 모델 보유 종목 ∪ `PRIORITY_TICKERS`(TQQQ·SOXL·QQQ·SPY·QLD·TECL·UPRO·SCHD·TLT·GLD), `^VIX/BTC/ETH` 제외. API fetch 는 `_fetch_lock`+13s 간격(Polygon 쿼터 보호), 학습은 `ThreadPoolExecutor(max_workers=3)` 병렬. `_retrain_lock`+날짜비교로 **하루 1회 멱등**(`force=True` 우회). `start_scheduler()`, `retrain_all(force)` → `{status, date, total, success, elapsed_sec, results{...}}`.

### 7.3 SHAP 설명 — `shap_explainer.py`
`explain_latest(df, ticker, top_n=5)` → `{ticker, as_of, predicted_direction(UP|DOWN, SHAP 합 부호), top_contributions[{feature, value, shap}], human_summary}`. 한국어 라벨 매핑(`ret_1`→"1일 수익률" 등)으로 사람이 읽는 근거 문장 생성. shap 미설치/모델없음/데이터부족 시 **None**.

---

## 8. 성과 지표 (`app/metrics/`)

`quantstats_report.compute_metrics(returns, benchmark=None)` — 모듈 import 시 `matplotlib.use("Agg")`. 반환(4자리 반올림, NaN/Inf→None):

- **항상**: `cagr_pct, sharpe, sortino, calmar, max_drawdown_pct, volatility_pct, win_rate_pct, best/worst_day_pct, var_95_pct, cvar_95_pct`
- **벤치마크 제공 시**: `alpha, beta`(qs.stats.greeks), `information_ratio` (계산 실패 시 키 생략).

`/report/full` 은 `quantstats.reports.html(returns, benchmark, output, title)` 로 풀 Tearsheet HTML 을 `REPORTS_DIR` 에 쓰고 `/reports/{file}.html` URL 반환.

---

## 9. 강건성·신뢰도 분석 (`app/robust/`)

### 9.1 Walk-Forward — `walkforward.py`
롤링 `train_window=252 / test_window=63`. 두 모드:
- `reoptimize=False`(기본): 고정 파라미터로 각 구간 OOS 일관성 측정.
- `reoptimize=True`: train 구간에서 `WF_REOPT_GRID`(전략별 ±20% 그리드) IS Sharpe 최적화 → test 구간 OOS 평가(파라미터 과최적화 붕괴 탐지).

반환: `folds[{fold, test_start/end, stats{sharpe,total_return_pct,max_drawdown_pct,win_rate_pct}, chosen_params}]` + `summary{n_folds, n_valid, avg_sharpe, avg_total_return_pct, avg_max_drawdown_pct, avg_win_rate_pct}`(유효 폴드 평균, 0개면 None).

### 9.2 시장국면 — `regime.py`
**5-state**: `bull_quiet`(상승·안정), `bull_volatile`(상승·불안정), `bear`(하락), `sideways`(횡보), `high_vol_unstable`(고변동·불안정).

- **rule**(기본·빠름): MA200(+10-span EWM 평활)·MA200 기울기·Vol60(×√252)·확장 백분위(Q75/Q80). 웜업 구간([0,120))은 가짜 라벨 대신 **NaN**.
- **hmm**: `hmmlearn.GaussianHMM(covariance="full")`, 피처 `[ret, vol20, mom60]` 표준화. `causal=True`(확장창 재학습, look-ahead 제거, 웜업 252) / `causal=False`(전체표본, 빠름). 상태→라벨 매핑은 상태별 평균수익·변동성으로. **폴백**: `len(features) < n_states×30` 또는 fit 실패 시 rule 로, 응답에 `method`(실제)·`method_requested`·`hmm_fallback`·`hmm_causal` 표기.

후처리: **Viterbi 식 minimum-run 필터**(`smoothing`/min_run, 짧은 국면 흡수). 국면별 Sharpe 는 **베이지안 수축** `effective_sharpe = sharpe×T/(T+60)` 로 단기표본 신뢰도 보정.

`per_regime_stats()` → `{per_regime{label:{days,label_ko,cumulative/annualized_return_pct,sharpe,effective_sharpe,sample_weight,max_drawdown_pct,win_rate_pct}}, weak_regime, current_regime(_ko), headline, method(_requested), hmm_fallback, hmm_causal, smoothing, n_states, regime_distribution, regime_timeline}`. `_HMM_CACHE`(최대 64, FIFO).

### 9.3 Trust Score — `trust_score.py` (0~100 종합)
**5 서브점수 + 과최적화 패널티.** 기본 가중치:

| 서브점수 | 가중 | 산식 요지 |
|---|---|---|
| `generalization`(일반화) | 0.25 | `clip01((OOS/IS Sharpe + 0.5)/2.0)` (IS≤0.1 이면 절대 OOS 폴백) |
| `regime_robustness`(국면견고) | 0.20 | `clip01((worst_eff_sharpe + floor)/span)`, 레버리지별 (floor,span): 1x(−1,3)·2x(−2,5)·3x(−3,7) |
| `parameter_stability`(파라미터안정) | 0.15 | ±5%·±10% 섭동 Sharpe `std` → `clip01(1−std)`. buy_and_hold 는 0.5 고정 |
| `risk_control`(리스크통제) | 0.20 | `clip01(1 − max(0,|MDD|−target)/50)` |
| `statistical_confidence`(통계유의) | 0.20 | **DSR(Deflated Sharpe Ratio)** — 시도횟수·왜도·첨도 보정 |

- **MDD target 자동분류**(`mdd_target_pct=None`): etf_index 25 / 2x 50 / 3x 75 / single_stock 35 / unknown 30. `classify_asset(ticker)` 가 3x·2x·인덱스ETF·개별주 판별 + underlying 매핑(TQQQ→QQQ 등).
- **과최적화 패널티**: `gap = max(0, IS−OOS Sharpe)`, `penalty = −min(overfit_penalty_max(=15), gap×15)`.
- **최종**: `trust_score = clip(0,100, Σ(sub_100×weight) + penalty)`. 등급 75+우수 / 60+양호 / 45+보통 / 0+주의.

DSR: `Φ((SR−SR0)·√(T−1)/√denom)`, `SR0 = sr_std·[(1−γ)Z(1−1/N)+γZ(1−1/(Ne))]`(γ=오일러-마스케로니, N=시도횟수, Acklam 역정규CDF). 반환 객체는 `trust_score, base_score, overfitting_penalty, sub_scores, sub_reasons, weights, config{asset_class,leverage,underlying,n_folds…}, details{walk_forward,regime,parameter,risk,statistical 블록}, narrative`.

---

## 10. Lean 백테스트 엔진 (`app/lean/`)

vectorbt 와 **병행**하는 QuantConnect Lean(Docker) 기반 엔진 + KRX/미국 전략빌더 DSL(`kis_backtest`, KIS open-trading-api 에서 파생).

### 10.1 오케스트레이션 — `runner.py`
`app/lean/__init__.py` 가 `kis_backtest` 를 `sys.path` 에 주입 → `from kis_backtest… import` 가능.

`LeanBacktestRequest`: `strategy_id, symbols, start_date, end_date, initial_capital=1e8, market("us"|"krx"), param_overrides, commission_rate=0.00015, tax_rate=0, slippage=0`.

`run_lean_backtest(request, progress_cb)` **단계**:
1. import + `StrategyRegistry.build(_with_params)` 로 전략 정의 해석
2. `_fetch_ohlcv` (yf_client) 로 종목별 가격 (KRX 는 아직 미구현)
3. `LeanProjectManager.create_project` → `.lean-workspace/{lean.json(더미 org-id), data/, projects/{run_id}/}`
4. `DataConverter.export` → `data/equity/{usa|krx}/daily/{symbol}.csv`(헤더없음 `YYYYMMDD,O,H,L,C,V`; KRX 정수원, US 2소수)
5. `LeanCodeGenerator.generate` → `main.py`(QCAlgorithm Python)
6. `LeanExecutor.run`(Docker, timeout 600s)
7. `ResultFormatter.to_api_response` 정규화 + `extra_charts`(benchmark/margin/exposure/turnover)

`LeanBacktestResult`: `success, run_id({id}-{uuid8}), statistics, equity_curve, trades_count, raw_json_path, error, elapsed_seconds, extra_charts`.

### 10.2 Docker 실행 — `kis_backtest/lean/executor.py`
- 이미지 `LEAN_IMAGE = quantconnect/lean:latest`. CLI: `lean backtest projects/{run_id} --output {result}` (cwd=workspace).
- 점검: `check_docker()`(docker info)·`check_lean_cli()`·`check_image()`·`get_lean_version()`·`pull_image()`.
- **로그인 회피**: `lean.json` 의 더미 org-id(`"0"×32`).
- **per-run 컨테이너 명명**: `lean_{nickname}_{YYYYMMDD-HHMMSS}` (데몬 스레드가 새 컨테이너 리네임 → `docker ps` 추적).
- 실시간 로그: `Popen(stdout=PIPE, encoding=utf-8, errors=replace, bufsize=1)` + reader 스레드 → `on_line` 콜백. timeout 시 kill + RuntimeError.

`/lean/health` 는 docker/lean_cli/image 점검을 **30s TTL 캐시**(매 호출 ~5.6s 방지).

### 10.3 백그라운드 잡 — `jobs.py`
`LeanJob`(thread-safe): `status(running|done|error), phase, logs(최대 2000), result, error`. `create_job/get_job`, `set_phase/log/finish_ok/finish_err`, `snapshot(since)`(증분 로그 커서). 전역 `_JOBS`(최대 64, 완료분 GC).

### 10.4 전략빌더 DSL — `kis_backtest/`
**단일 진리원천 `StrategySchema`** 로 DSL/YAML/Python preset 모두 정규화 → `LeanCodeGenerator` → Lean Python.

- **DSL**(`dsl/builder.py`): `RuleBuilder("name").buy_when((SMA(5)>SMA(20)) & (RSI(14)<70)).sell_when(...).stop_loss(5).take_profit(10).trailing_stop(3).max_position(80).build()`. 연산자 오버로딩(`>,<,&,|`, `crosses_above/below`, `between`).
- **인디케이터 카탈로그**(`core/indicator.py`, 70+종): 이동평균 14종(SMA·EMA·DEMA·TEMA·HMA·KAMA·ALMA…), 오실레이터 20종(RSI·Stochastic·MACD·CCI·Williams%R·TSI…), 추세 12종(ADX·Ichimoku·SAR·SuperTrend·Vortex…), 거래량 8종(OBV·MFI·CMF·VWAP…), 변동성 10종(ATR·Bollinger·Keltner·Donchian…), 기타/커스텀(IBS·Pivot·Disparity·Consecutive…). 다중출력(MACD: value/signal/histogram).
- **캔들 패턴**(`core/candlestick.py`, 65종): doji·hammer·engulfing·morning_star·three_white_soldiers… 신호 `bullish/bearish/detected`.
- **연산자**(`OperatorType`): greater/less(_equal), cross_above/below, equal, not_equal, breaks, between (+별칭 `>,gte,crossover…` 정규화).
- **리스크**(`core/risk.py`): `stop_loss_pct, take_profit_pct, trailing_stop_pct, max_position_size(0~1)`.
- **모델 enum**(`models/enums.py`): Resolution, OrderSide, OrderType, OrderStatus, TimeInForce(DAY/GTC/IOC/FOK). 시장데이터(`Bar, Quote, StockInfo, FinancialData`).
- **파일 I/O**: `.kis.yaml` 로드/세이브, `$param_name` 치환(`ParamResolver`). `python_exporter` DSL→Python.
- **코드젠 검증**(`codegen/validator.py`): 파라미터 범위 검사 + 인디케이터별 워밍업 산출(SMA=period+1, MACD=slow+signal, ADX=period×2…).
- **한국시장 유틸**(`utils/korean_market.py`): 가격대별 호가단위(`get_tick_size`), `round_to_tick(up|down|nearest)`.

### 10.5 Preset 전략 10종 (`strategies/preset/`)

| id | 카테고리 | 진입 / 청산 | 주요 파라미터(기본) |
|---|---|---|---|
| `sma_crossover` | trend | 골든크로스 / 데드크로스 | fast=5, slow=20, SL=5, TP=10 |
| `volatility_breakout` | volatility | ATR 스퀴즈 + ROC 급등 / 급락·SL | atr_period=10, lookback=20, breakout_pct=3 |
| `momentum` | momentum | ROC(lookback) > thr / < −thr | lookback=60, threshold=0, SL=10 |
| `week52_high` | trend | 종가 ↗ 252일 최고 / SL·TP | lookback=252, SL=5, TP=15 |
| `false_breakout` | trend | N일 최고 돌파 / M일내 되돌림 | lookback=20, exit_days=3, SL=3 |
| `consecutive_moves` | momentum | N일 연속상승 / N일 연속하락 | up_days=5, down_days=5, SL=5 |
| `ma_divergence` | mean_reversion | close/SMA < buy_ratio / > sell_ratio | period=20, buy=0.9, sell=1.1 |
| `short_term_reversal` | mean_reversion | close<SMA×(1−thr) / >SMA×(1+thr) | period=5, threshold_pct=3, SL=5 |
| `strong_close` | momentum | IBS ≥ min_ratio / IBS < 1−min_ratio | min_close_ratio=0.8, SL=5 |
| `trend_filter_signal` | composite | close>SMA & ROC>0 / close<SMA & ROC<0 | trend_period=60, SL=5, TP=10 |

각 전략은 `PARAM_DEFINITIONS`(default·min·max·type·desc)로 UI 노출. `StrategyRegistry`(데코레이터 등록) → `build/get/list_all_with_params`. `risk/position_sizer.py` 5방식: EQUAL_WEIGHT·ATR_BASED·KELLY·INVERSE_VOLATILITY·FIXED_FRACTION.

### 10.6 KIS 프로바이더 (`providers/kis/`)
실거래용 데이터/브로커리지(라이브 트레이딩 — 백테스트와 별개). `auth.py`(OAuth, `APIResp` 래퍼), `data.py`(일/분봉·시세·실시간, EGW00201 레이트리밋 시 61s 재시도), `brokerage.py`(submit/cancel/modify_order·포지션·잔고·체결), `websocket.py`(H0STCNT0 시세·H0STCNI0/9 체결). `constants.py` TR ID(주문 `TTTC0802U`/모의 `VTTC0802U` 등)·호가구분(00지정가~04최우선).

### 10.7 리포트 & 포트폴리오 (`report/`, `portfolio/`)
- `KISReportGenerator`(plotly): summary·equity_curve·monthly_heatmap·trades. KIS 테마(상승=빨강/하락=파랑 한국관습).
- `PortfolioAnalyzer.analyze(prices, weights)` → 상관행렬·변동성·Sharpe·분산투자비율·리스크기여·효율적프론티어. `RebalanceSimulator.simulate(period)` 리밸런싱 vs 매수보유 비교(턴오버·거래비용). `PortfolioVisualizer`(히트맵·파이·프론티어).

### 10.8 최적화 (`lean/optimizer.py`)
`ParameterSpec(min/max/step)`·`ParameterGrid`(itertools.product, `sample(n)` 랜덤). `ParallelExecutor.run_grid/run_random`. `ResultAggregator.find_best(target="sharpe_ratio")`, `to_dataframe`, `summary_statistics`.

---

## 11. 코드 생성 (`app/codegen/`)

`portfolio_codegen.generate_portfolio_strategy(strategy, config, market)` → 라이브 엔진과 1:1 동일 로직의 **독립 실행 가능한 .py 문자열**(numpy/pandas 만 의존). 무한매수법·VR 지원. 테스트 `test_codegen_engine_parity.py` 가 엔진-코드젠 동치성 강제. (Quant Developer IDE 가 워크스페이스 전략을 내려받는 데 사용.)

---

## 12. REST API 전체 레퍼런스

> 모든 엔드포인트 `X-Internal-Token` 필요(`/health`·`/reports/*` 제외).

| Method | Path | 설명 |
|---|---|---|
| GET | `/health` | 헬스(무인증) |
| GET | `/price/latest?ticker=` | 최신 종가 |
| POST | `/backtest` | vectorbt 6 기본전략 백테스트(+enrich·QuantStats·SPY 벤치·capacity) |
| POST | `/signals/today` | 종목별 룰시그널 + XGBoost proba + SHAP (BE 22:30 스케줄러용) |
| POST | `/models/train` | 단일 종목 XGBoost 학습 |
| POST | `/models/retrain?force=` | 전체 재학습 트리거 |
| POST | `/robust/walk-forward` | Walk-Forward OOS 검증 |
| POST | `/regime` | 시장국면(rule|hmm, smoothing, n_states, start/end) |
| POST | `/trust` | Trust Score(mdd_target, weights, asset_class, leverage…) |
| POST | `/backtest/infinite-buying` | 무한매수법(laoer/yeona, ticker_weights…) |
| POST | `/orders/infinite-buying/plan` | 무한매수법 익일 주문계획 |
| POST | `/backtest/infinite-buying/sizing` | **시드 역산**(목표 월수익 → 필요시드, 종목별 분할금액) |
| POST | `/backtest/value-rebalancing` | VR 백테스트 |
| POST | `/orders/value-rebalancing/plan` | VR 익일 계획 |
| POST | `/backtest/momentum-rotation` | 모멘텀 로테이션 |
| POST | `/report/full` | QuantStats 풀 Tearsheet HTML → `report_url` |
| GET | `/reports/{file}.html` | Tearsheet 정적 서빙(무인증 공개) |
| GET | `/data/status` | 수집 현황(소스 가용성·심볼·통계) |
| GET | `/data/ohlcv?symbol&tf&source&start&end&limit` | DB OHLCV(없으면 실시간 fetch→저장) |
| GET | `/data/macro?series&start&end` | 매크로 팩터 |
| GET | `/data/orderbook/{symbol}` | Binance 오더북 |
| GET | `/data/ticker/{symbol}` | 실시간 시세(코인=Binance, 주식=Polygon) |
| GET | `/data/funding/{symbol}` | Binance 펀딩레이트 |
| GET | `/datasets/catalog` | 데이터셋 카탈로그 |
| GET | `/datasets/preview?id&symbol&…` | 데이터셋 실데이터 미리보기 |
| POST | `/data/collect` | 수동 수집(백그라운드) |
| POST | `/data/collect/initial` | 5년치 초기 수집(백그라운드) |
| POST | `/futures/backtest` | Binance 선물 백테스트 |
| GET | `/futures/signal` | 선물 현재 신호 |
| GET | `/lean/strategies` | Lean preset 목록 + 파라미터 |
| POST | `/lean/backtest` | Lean Docker 백테스트(동기) |
| POST | `/lean/backtest/start` | Lean 백테스트 잡 시작 → job_id |
| GET | `/lean/backtest/status/{job_id}?since=` | 잡 진행/증분로그/결과 |
| GET | `/lean/health` | Docker/lean CLI/이미지 준비상태(30s 캐시) |

### 시드 역산(`/backtest/infinite-buying/sizing`) 상세
실현 현금흐름은 시드에 선형비례 → 참조시드(`REFERENCE_SEED_USD=100,000`)로 1회 측정 후 `목표÷측정` 배수로 역산. `target_monthly_usd|krw`(+`fx=1380`) 입력. 짧은 구간(2~6mo)·직접지정 구간은 120일 워밍업 포함 측정창. 반환: `feasible, required_seed_usd/krw, per_ticker{seed, daily_buy}, scale_factor, measured_monthly, caveat(MDD 경고)`. 익절 없으면 `feasible:false`.

---

## 13. 핵심 상수 & 매직넘버

| 구분 | 값 | 위치/의미 |
|---|---|---|
| 수수료 / 슬리피지 | 0.25% / 0.10% | 모든 주식·ETF 백테스트 기본(선물 0.04%+펀딩) |
| 가격 캐시 TTL | 60분 | `PRICE_CACHE_TTL_MIN` |
| KIS 토큰 캐시 | 23h | `kis_client` |
| Walk-Forward | train 252 / test 63 | 1년 / 1분기 |
| Regime Sharpe 수축 prior | 60일 | `T/(T+60)` |
| HMM 폴백 트리거 | `len < n_states×30` | 표본부족 |
| HMM 웜업(causal) | 252일 | look-ahead 제거 |
| Trust 가중 | 0.25/0.20/0.15/0.20/0.20 | gen/regime/param/risk/stat |
| Trust 과최적화 패널티 | 최대 15점 | `gap×15` |
| MDD target(1x/2x/3x/주식) | 25/50/75/35% | 자산분류 자동 |
| 파라미터 섭동 | ±5%, ±10% | 안정성 측정 |
| XGBoost 재학습 | 22:30 KST | 미장 마감 후 |
| XGBoost 피처 | 21개(v2) | `FEATURE_COLS` |
| 무한매수 split / TP / offset | 40 / 10% / 15% | laoer 기본 |
| 연아 프리셋 | split40·TP13·offset10·leave1·restart0.5 | `YEONA_DEFAULTS` |
| Lean 이미지 / timeout | quantconnect/lean:latest / 600s | Docker |
| Lean 더미 org-id | `"0"×32` | 로그인 회피 |
| Lean 잡 한도 | logs 2000 / jobs 64 | `jobs.py` |
| 시드역산 참조시드 | 100,000 USD | 선형 상쇄 |

---

## 14. 데이터 흐름 요약

```
[수집] collector(UTC 스케줄) → yfinance/Polygon/Binance/FRED/KIS → market_db(MySQL) ─┐
                                                                                      │
[가격] yf_client.get_history (캐시→Polygon→yfinance→stale) ───────────────────────────┤
                                                                                      ▼
[백테스트] /backtest, /backtest/infinite-buying, /value-rebalancing, /momentum-rotation
   close → 엔진(vbt/IB/VR/MR) → stats + _strategy_returns
        → enrich(drawdown·monthly·PSR) → compute_metrics(QuantStats, +SPY 벤치)
        → (선택) /report/full → QuantStats HTML

[시그널] /signals/today → latest_signal(룰) + predict_proba_up(XGBoost) + explain_latest(SHAP)
   ↑ 매일 22:30 KST retrain_scheduler 가 모델 갱신(models_cache/xgb_*.joblib)

[강건성] /trust → walk_forward(OOS) + per_regime_stats(국면) + 파라미터섭동 + DSR
   → 5 서브점수 가중합 − 과최적화패널티 = trust_score(0~100)

[Lean] /lean/backtest → StrategyRegistry → DataConverter(CSV) → LeanCodeGenerator(main.py)
   → LeanExecutor(Docker quantconnect/lean) → ResultFormatter → statistics·equity·charts
```

---

## 15. 용어집

| 용어 | 의미 |
|---|---|
| OHLCV | 시가·고가·저가·종가·거래량 |
| `_strategy_returns` | 엔진이 반환하는 수수료/슬리피지 반영 **일별 전략수익률** Series(매수보유 아님) |
| MDD (Max Drawdown) | 최고점 대비 최대 낙폭 |
| Sharpe / Sortino / Calmar | 변동성 / 하방편차 / MDD 대비 위험조정수익 |
| PSR | Probabilistic Sharpe Ratio — 왜도·첨도 보정한 `P(SR>0)` |
| DSR | Deflated Sharpe Ratio — 시도횟수까지 보정(과최적화 디플레이션) |
| Walk-Forward | 롤링 학습/검증으로 OOS 일반화 측정 |
| Regime | 시장국면(상승·하락·횡보·고변동) 5-state |
| HMM | Gaussian Hidden Markov Model(국면 추정) |
| Trust Score | 5개 강건성 축을 종합한 0~100 신뢰도 |
| 무한매수법(IB) | 자본을 split 분할해 사다리식 매수·익절 누적 전략 |
| VR | Value Rebalancing — 목표가치 밴드 평균회귀 |
| LOC | Limit-On-Close(장마감 지정가) 주문 |
| Lean | QuantConnect 백테스트 엔진(Docker) |
| kis_backtest | KIS open-trading-api 파생 전략빌더 DSL + 코드젠 프레임워크 |
| Tearsheet | QuantStats 가 생성하는 성과 분석 HTML 리포트 |
| capacity_usd | 일평균 거래대금 × 1% 참여율(근사 수용용량) |

---

*문서 생성: Claude Code 멀티에이전트 코드 스윕(7개 서브에이전트 병렬 분석) 기반. 코드 변경 시 본 문서도 함께 갱신할 것.*
