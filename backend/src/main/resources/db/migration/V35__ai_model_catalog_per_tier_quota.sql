-- V35: AI 모델 카탈로그에 구독 티어별(STANDARD/PREMIUM/EXPERT) 쿼터 컬럼 추가.
-- 기존 free_quota/pro_quota 는 그대로 유지 (하위 호환).
ALTER TABLE AI_MODEL_CATALOG
    ADD COLUMN standard_quota BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN premium_quota  BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN expert_quota   BIGINT NOT NULL DEFAULT 0;

-- gemini-2.5-flash: STANDARD 이상 무제한(-1)
UPDATE AI_MODEL_CATALOG SET standard_quota=-1, premium_quota=-1, expert_quota=-1 WHERE model_id='gemini-2.5-flash';
-- gemini-2.5-pro: STANDARD 300k, PREMIUM/EXPERT 무제한
UPDATE AI_MODEL_CATALOG SET standard_quota=300000, premium_quota=-1, expert_quota=-1 WHERE model_id='gemini-2.5-pro';
-- claude-sonnet-4: PREMIUM 이상만, STANDARD 차단
UPDATE AI_MODEL_CATALOG SET standard_quota=0, premium_quota=-1, expert_quota=-1 WHERE model_id='claude-sonnet-4';
-- claude-opus-4: EXPERT 전용
UPDATE AI_MODEL_CATALOG SET standard_quota=0, premium_quota=0, expert_quota=-1 WHERE model_id='claude-opus-4';
-- gpt-4o-mini: STANDARD 이상 무제한
UPDATE AI_MODEL_CATALOG SET standard_quota=-1, premium_quota=-1, expert_quota=-1 WHERE model_id='gpt-4o-mini';
-- gpt-4o: STANDARD 200k, PREMIUM/EXPERT 무제한
UPDATE AI_MODEL_CATALOG SET standard_quota=200000, premium_quota=-1, expert_quota=-1 WHERE model_id='gpt-4o';
