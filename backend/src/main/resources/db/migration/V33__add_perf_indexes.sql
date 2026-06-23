-- V33: 성능 인덱스 추가 (DDIA 3장 — 색인은 핫 쿼리에서 도출).
-- 로컬은 Flyway off + ddl-auto=update 라 영향 없음. 운영(validate)에서만 적용.
-- 단일 MySQL 규모에 안전한 복합 인덱스만 추가(파티셔닝/샤딩은 보류).
-- 멱등: 같은 이름의 인덱스가 이미 있으면 스킵(information_schema 가드 — MySQL 은 CREATE INDEX IF NOT EXISTS 미지원).

-- ① NOTIFICATION: 인덱스 전무였음 → 알림 목록 정렬(filesort)·안읽음 카운트 풀스캔
--    NotificationRepository.findByUserOrderByCreatedAtDesc / countByUserAndIsReadFalse
SET @x := (SELECT COUNT(*) FROM information_schema.statistics
           WHERE table_schema=DATABASE() AND table_name='NOTIFICATION' AND index_name='idx_notif_user_created');
SET @s := IF(@x=0, 'CREATE INDEX idx_notif_user_created ON NOTIFICATION (user_id, created_at)', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @x := (SELECT COUNT(*) FROM information_schema.statistics
           WHERE table_schema=DATABASE() AND table_name='NOTIFICATION' AND index_name='idx_notif_user_read');
SET @s := IF(@x=0, 'CREATE INDEX idx_notif_user_read ON NOTIFICATION (user_id, is_read)', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ② order_proposal: 일일 한도 합산이 executed_at 범위를 인덱스로 못 좁혔음
--    OrderProposalRepository.sumExecutedUsdSince* (매 주문 직전 호출)
SET @x := (SELECT COUNT(*) FROM information_schema.statistics
           WHERE table_schema=DATABASE() AND table_name='order_proposal' AND index_name='idx_op_user_status_executed');
SET @s := IF(@x=0, 'CREATE INDEX idx_op_user_status_executed ON order_proposal (user_id, status, executed_at)', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- ③ order_proposal: 전역 체결 폴링이 user_id 선행 인덱스를 못 타 풀스캔이었음
--    findFillCheckCandidates (FillReconciler 주기 실행)
SET @x := (SELECT COUNT(*) FROM information_schema.statistics
           WHERE table_schema=DATABASE() AND table_name='order_proposal' AND index_name='idx_op_status_executed');
SET @s := IF(@x=0, 'CREATE INDEX idx_op_status_executed ON order_proposal (status, executed_at)', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
