-- ============================================================
-- V29: 자동 시그널 제안 멱등성 — source_signal_id 유니크 제약
--
-- DailySignalGenerator 가 같은 시그널(source_signal_id)로 PENDING 제안을 중복 생성하지
-- 못하도록 DB 레벨에서 "정확히 한 번"을 보장한다(DDIA 7장 멱등성).
-- 앱의 EXISTS 체크는 빠른 경로일 뿐, 진짜 보장은 이 제약이다.
--
-- NULL 주의: source_signal_id 는 수동 제안(MANUAL)에서 NULL 이다. MySQL/InnoDB 는
--   UNIQUE 인덱스에서 다중 NULL 을 허용하므로 수동 제안에는 아무 영향이 없다.
-- ============================================================

-- 1) 기존 중복 정리 — UNIQUE 추가 전 필수(과거 check-then-act 레이스로 생겼을 수 있는 중복 제거).
--    같은 source_signal_id 그룹에서 "가장 중요한 상태" 1건만 남기고 삭제한다.
--    우선순위: EXECUTED > APPROVED > PENDING > EXEC_FAILED > EXPIRED > REJECTED, 동률이면 최신(id 큼).
--    → 실제 주문이 나간 EXECUTED 행은 절대 삭제하지 않는다(감사 무결성).
DELETE FROM order_proposal
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY source_signal_id
                   ORDER BY FIELD(status, 'EXECUTED','APPROVED','PENDING','EXEC_FAILED','EXPIRED','REJECTED'),
                            id DESC
               ) AS rn
        FROM order_proposal
        WHERE source_signal_id IS NOT NULL
    ) dups
    WHERE dups.rn > 1
);

-- 2) 멱등 유니크 인덱스 — 같은 시그널로 최대 1건만 존재 가능(NULL=수동 제안 다중 허용).
CREATE UNIQUE INDEX uq_op_source_signal ON order_proposal (source_signal_id);
