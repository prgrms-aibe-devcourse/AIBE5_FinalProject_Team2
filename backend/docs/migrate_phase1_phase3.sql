-- ============================================================
-- Phase 1: Market Data Tables 마이그레이션
-- 실행: mysql -u devbridge -p devbridge_db < migrate_phase1_market_data.sql
--
-- 신규 테이블:
--   market_ohlcv    — OHLCV 시계열 (Polygon/Binance/yfinance)
--   market_macro    — FRED 매크로 팩터
--   market_data_log — 수집 로그
-- ============================================================

-- market_ohlcv
CREATE TABLE IF NOT EXISTS market_ohlcv (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    ts          DATETIME(3)     NOT NULL COMMENT '봉 종료 시각 (UTC)',
    symbol      VARCHAR(32)     NOT NULL,
    source      VARCHAR(32)     NOT NULL COMMENT 'polygon|binance|yfinance',
    tf          VARCHAR(8)      NOT NULL DEFAULT '1d' COMMENT '타임프레임: 1d|1h|15m',
    `open`      DOUBLE,
    high        DOUBLE,
    low         DOUBLE,
    `close`     DOUBLE,
    volume      DOUBLE,
    vwap        DOUBLE,
    quote_vol   DOUBLE          COMMENT '코인: quote asset 거래량 (USDT)',
    created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_ohlcv UNIQUE (symbol, source, tf, ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='OHLCV 시계열 (Phase 1 → TimescaleDB 전환 예정)';

CREATE INDEX IF NOT EXISTS idx_ohlcv_symbol_ts ON market_ohlcv (symbol, ts DESC);
CREATE INDEX IF NOT EXISTS idx_ohlcv_source_ts ON market_ohlcv (source, ts DESC);

-- market_macro
CREATE TABLE IF NOT EXISTS market_macro (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    ts          DATE            NOT NULL COMMENT '관측일 (FRED 기준)',
    series_id   VARCHAR(32)     NOT NULL COMMENT 'FEDFUNDS|DGS10|T10Y2Y|VIXCLS|...',
    value       DOUBLE,
    created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT uq_macro UNIQUE (series_id, ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX IF NOT EXISTS idx_macro_series ON market_macro (series_id, ts DESC);

-- market_data_log
CREATE TABLE IF NOT EXISTS market_data_log (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    ts            DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    source        VARCHAR(32)   NOT NULL,
    symbol        VARCHAR(32),
    action        VARCHAR(64)   NOT NULL,
    rows_upserted INT,
    error_msg     TEXT,
    INDEX idx_log_ts (ts DESC),
    INDEX idx_log_source (source, ts DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================================
-- Phase 3: BrokerAccount 확장 (BINANCE 지원)
-- 기존 테이블에 컬럼 추가 + UNIQUE 제약 재설정
-- ============================================================

-- broker_type 컬럼 추가
ALTER TABLE BROKER_ACCOUNT
    ADD COLUMN IF NOT EXISTS broker_type VARCHAR(16) NOT NULL DEFAULT 'KIS'
        COMMENT 'KIS | BINANCE'
        AFTER env;

-- KIS 필드를 nullable로 변경
ALTER TABLE BROKER_ACCOUNT
    MODIFY COLUMN app_key         VARCHAR(100)   NULL,
    MODIFY COLUMN app_secret_enc  TEXT           NULL,
    MODIFY COLUMN cano            VARCHAR(16)    NULL,
    MODIFY COLUMN acnt_prdt_cd    VARCHAR(4)     NULL;

-- Binance 전용 컬럼 추가
ALTER TABLE BROKER_ACCOUNT
    ADD COLUMN IF NOT EXISTS binance_api_key        VARCHAR(100)   NULL
        COMMENT 'Binance API Key'
        AFTER acnt_prdt_cd,
    ADD COLUMN IF NOT EXISTS binance_api_secret_enc TEXT           NULL
        COMMENT 'Binance API Secret (AES 암호화)',
    ADD COLUMN IF NOT EXISTS binance_mode           VARCHAR(16)    NULL DEFAULT 'SPOT'
        COMMENT 'SPOT | FUTURES';

-- 기존 UNIQUE 제약 삭제 후 재생성
-- (MariaDB는 DROP CONSTRAINT IF EXISTS 미지원 → 에러 무시하고 진행)
ALTER TABLE BROKER_ACCOUNT DROP INDEX IF EXISTS uq_broker_user_env;

-- 새 UNIQUE 제약: (user_id, broker_type, env)
ALTER TABLE BROKER_ACCOUNT
    ADD CONSTRAINT IF NOT EXISTS uq_broker_user_type_env
    UNIQUE (user_id, broker_type, env);

-- 기존 데이터 broker_type 기본값 설정 (기존 KIS 레코드)
UPDATE BROKER_ACCOUNT SET broker_type = 'KIS' WHERE broker_type IS NULL OR broker_type = '';

SELECT 'Phase 1+3 migration complete' AS result;
