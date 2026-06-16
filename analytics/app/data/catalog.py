"""
오픈소스 데이터셋 카탈로그 — QuantConnect Datasets 스타일 브라우저용.

원칙(정직성):
- live=True  : 현재 코드에 커넥터가 연결돼 *즉시 실데이터 미리보기* 가능한 소스.
- live=False : 로드맵(커넥터 예정) — '준비중' 으로 정직하게 표기(가짜 데이터 없음).
조건부 소스(FRED/Polygon)의 live 는 키 설정 여부에 따라 런타임에 결정한다(main.py).
"""
from __future__ import annotations

# preview_via: main.py datasets_preview 가 라우팅할 커넥터 키
CATALOG = [
    {
        "id": "yf_us_equity", "name": "US Equities & ETF (Daily)", "source": "Yahoo Finance",
        "asset_class": "주식·ETF", "market": "US", "interval": "1d", "coverage": "1970~현재",
        "license": "개인·연구 무료", "live": True, "preview_via": "yf",
        "sample_symbols": ["AAPL", "TQQQ", "SOXL", "SPY", "QLD"],
        "description": "미국 주식·ETF 일봉 OHLCV(조정종가 포함). 백테스트 기본 소스.",
    },
    {
        "id": "yf_global_equity", "name": "Global Equities (Daily)", "source": "Yahoo Finance",
        "asset_class": "주식", "market": "Global", "interval": "1d", "coverage": "상장~현재",
        "license": "개인·연구 무료", "live": True, "preview_via": "yf",
        "sample_symbols": ["005930.KS", "000660.KS", "7203.T", "BABA", "NVDA"],
        "description": "한국(.KS)·일본(.T) 등 글로벌 주식 일봉. yfinance 심볼 규칙 사용.",
    },
    {
        "id": "yf_crypto", "name": "Crypto (Daily)", "source": "Yahoo Finance",
        "asset_class": "암호화폐", "market": "Global", "interval": "1d", "coverage": "2014~현재",
        "license": "무료", "live": True, "preview_via": "yf",
        "sample_symbols": ["BTC-USD", "ETH-USD", "SOL-USD"],
        "description": "암호화폐 일봉(USD 기준). 심볼 접미사 -USD.",
    },
    {
        "id": "binance_crypto", "name": "Binance Crypto (1m~1d)", "source": "Binance",
        "asset_class": "암호화폐", "market": "Global", "interval": "1m·1h·1d", "coverage": "2017~현재",
        "license": "무료(공개 API)", "live": True, "preview_via": "binance",
        "sample_symbols": ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
        "description": "Binance 현물 OHLCV(분봉 지원) + 펀딩비. 키 불필요(공개 REST).",
    },
    {
        "id": "fred_macro", "name": "Macro Indicators", "source": "FRED (St. Louis Fed)",
        "asset_class": "거시지표", "market": "US/Global", "interval": "일·주·월", "coverage": "수십년",
        "license": "공개(무료)", "live": False, "preview_via": "fred",
        "sample_symbols": ["DGS10", "CPIAUCSL", "UNRATE", "VIXCLS", "FEDFUNDS"],
        "description": "금리·물가·실업률·VIX 등 거시 시계열. FRED_API_KEY 필요.",
    },
    {
        "id": "polygon_us", "name": "US Equities (Polygon)", "source": "Polygon.io",
        "asset_class": "주식·ETF", "market": "US", "interval": "1m·1d", "coverage": "2003~현재",
        "license": "무료티어/유료", "live": False, "preview_via": "yf",
        "sample_symbols": ["AAPL", "SPY", "MSFT"],
        "description": "기관급 US 주식 데이터(분봉). POLYGON_API_KEY 설정 시 백테스트 1순위 소스.",
    },
    # ── 로드맵(커넥터 준비중) — 정직하게 live=False ──
    {
        "id": "stooq", "name": "Global EOD (Stooq)", "source": "Stooq",
        "asset_class": "주식·지수·FX", "market": "Global", "interval": "1d", "coverage": "장기",
        "license": "무료", "live": False, "preview_via": None,
        "sample_symbols": ["^spx", "eurusd", "cl.f"],
        "description": "무료 글로벌 EOD(지수·FX·원자재 포함). 커넥터 준비중.",
    },
    {
        "id": "tiingo", "name": "EOD + Fundamentals (Tiingo)", "source": "Tiingo",
        "asset_class": "주식·펀더멘털", "market": "US/Global", "interval": "1d", "coverage": "장기",
        "license": "무료티어", "live": False, "preview_via": None,
        "sample_symbols": ["AAPL", "GOOGL"],
        "description": "조정 EOD + 재무 펀더멘털. 무료티어 키. 커넥터 준비중.",
    },
    {
        "id": "coingecko", "name": "Crypto Market Data (CoinGecko)", "source": "CoinGecko",
        "asset_class": "암호화폐", "market": "Global", "interval": "1d·시총", "coverage": "2013~현재",
        "license": "무료", "live": False, "preview_via": None,
        "sample_symbols": ["bitcoin", "ethereum"],
        "description": "코인 시세·시가총액·도미넌스. 키 불필요. 커넥터 준비중.",
    },
    {
        "id": "sec_edgar", "name": "Filings & Fundamentals (SEC EDGAR)", "source": "SEC EDGAR",
        "asset_class": "재무·공시", "market": "US", "interval": "분기·연", "coverage": "1993~현재",
        "license": "공개(무료)", "live": False, "preview_via": None,
        "sample_symbols": ["0000320193"],
        "description": "10-K/10-Q 재무제표·공시 원문(CIK 기준). 커넥터 준비중.",
    },
    {
        "id": "nasdaq_data_link", "name": "Econ & Alternative (Nasdaq Data Link)", "source": "Nasdaq Data Link",
        "asset_class": "거시·대체데이터", "market": "Global", "interval": "다양", "coverage": "장기",
        "license": "무료티어/유료", "live": False, "preview_via": None,
        "sample_symbols": ["WIKI/AAPL"],
        "description": "경제·대체 데이터셋 마켓(구 Quandl). 무료티어 키. 커넥터 준비중.",
    },
    {
        "id": "alpha_vantage", "name": "Equities & FX (Alpha Vantage)", "source": "Alpha Vantage",
        "asset_class": "주식·FX·지표", "market": "Global", "interval": "1m~1d", "coverage": "20년+",
        "license": "무료티어", "live": False, "preview_via": None,
        "sample_symbols": ["IBM", "EURUSD"],
        "description": "주식·FX·기술지표 API. 무료티어(분당 호출 제한). 커넥터 준비중.",
    },
]


def get(dataset_id: str):
    return next((d for d in CATALOG if d["id"] == dataset_id), None)
