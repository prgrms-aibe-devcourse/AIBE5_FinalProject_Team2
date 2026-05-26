-- =====================================================================
-- 리뷰 평가 세부 항목 컬럼 추가 (엔티티-DB 스키마 정렬)
-- 적용 대상: partner_review, client_review
-- 추가 컬럼: expertise, schedule, communication, proactivity (모두 DOUBLE NULL)
-- 안전 (모두 nullable, 기존 데이터 영향 없음)
-- =====================================================================

-- partner_review
ALTER TABLE partner_review
  ADD COLUMN IF NOT EXISTS expertise     DOUBLE NULL,
  ADD COLUMN IF NOT EXISTS `schedule`    DOUBLE NULL,
  ADD COLUMN IF NOT EXISTS communication DOUBLE NULL,
  ADD COLUMN IF NOT EXISTS proactivity   DOUBLE NULL;

-- client_review (이미 적용되었을 수 있음 - IF NOT EXISTS 로 멱등 보장)
ALTER TABLE client_review
  ADD COLUMN IF NOT EXISTS expertise     DOUBLE NULL,
  ADD COLUMN IF NOT EXISTS `schedule`    DOUBLE NULL,
  ADD COLUMN IF NOT EXISTS communication DOUBLE NULL,
  ADD COLUMN IF NOT EXISTS proactivity   DOUBLE NULL;
