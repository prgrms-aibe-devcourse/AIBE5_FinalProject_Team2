-- Phase 3: broker_account 확장 (lowercase 테이블명)
ALTER TABLE broker_account
    ADD COLUMN IF NOT EXISTS broker_type VARCHAR(16) NOT NULL DEFAULT 'KIS'
        COMMENT 'KIS | BINANCE'
        AFTER env;

ALTER TABLE broker_account
    MODIFY COLUMN app_key         VARCHAR(100)   NULL,
    MODIFY COLUMN app_secret_enc  TEXT           NULL,
    MODIFY COLUMN cano            VARCHAR(16)    NULL,
    MODIFY COLUMN acnt_prdt_cd    VARCHAR(4)     NULL;

ALTER TABLE broker_account
    ADD COLUMN IF NOT EXISTS binance_api_key        VARCHAR(100)   NULL,
    ADD COLUMN IF NOT EXISTS binance_api_secret_enc TEXT           NULL,
    ADD COLUMN IF NOT EXISTS binance_mode           VARCHAR(16)    NULL DEFAULT 'SPOT';

ALTER TABLE broker_account DROP INDEX IF EXISTS uq_broker_user_env;

ALTER TABLE broker_account
    ADD CONSTRAINT IF NOT EXISTS uq_broker_user_type_env
    UNIQUE (user_id, broker_type, env);

UPDATE broker_account SET broker_type = 'KIS' WHERE broker_type IS NULL OR broker_type = '';

SELECT 'Phase 3 migration complete' AS result;