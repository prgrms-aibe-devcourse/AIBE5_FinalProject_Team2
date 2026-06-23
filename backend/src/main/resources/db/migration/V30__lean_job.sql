-- ============================================================
-- V30: Lean 멀티테넌트 백테스트 잡 큐 (영속)
--
-- BE 스케줄러가 등급별 쿼터 안에서 공정하게 골라 무상태 워커(analytics)에 배정한다.
-- 인메모리 풀과 달리 재시작에도 살아남고, 여러 워커/호스트가 같은 큐를 공유(멀티테넌트·수평확장 토대).
-- Lifecycle: QUEUED → DISPATCHED → RUNNING → (DONE | ERROR) | CANCELLED
-- ============================================================
CREATE TABLE IF NOT EXISTS lean_job (
    id            BIGINT        NOT NULL AUTO_INCREMENT,
    user_id       BIGINT        NOT NULL,
    tier          VARCHAR(16)   NOT NULL,
    kind          VARCHAR(16)   NOT NULL DEFAULT 'BACKTEST',
    opt_id        VARCHAR(32)   NULL,
    status        VARCHAR(16)   NOT NULL DEFAULT 'QUEUED',
    worker_id     VARCHAR(64)   NULL,
    strategy_id   VARCHAR(64)   NOT NULL,
    symbols_json  TEXT          NULL,
    start_date    VARCHAR(10)   NULL,
    end_date      VARCHAR(10)   NULL,
    market        VARCHAR(8)    NOT NULL DEFAULT 'us',
    params_json   TEXT          NULL,
    result_json   LONGTEXT      NULL,
    error         VARCHAR(1000) NULL,
    created_at    DATETIME(6)   NULL,
    dispatched_at DATETIME(6)   NULL,
    started_at    DATETIME(6)   NULL,
    finished_at   DATETIME(6)   NULL,
    PRIMARY KEY (id),
    KEY idx_lj_status (status),
    KEY idx_lj_user_status (user_id, status),
    KEY idx_lj_opt (opt_id),
    KEY idx_lj_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
