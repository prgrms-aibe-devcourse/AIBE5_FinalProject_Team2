ALTER TABLE AI_USAGE_LOG
    ADD COLUMN feature VARCHAR(100) NULL COMMENT '호출 기능 식별자 (helix_chat/briefing_fallback/improve_proposal/workspace_chat/ai_extract)';
