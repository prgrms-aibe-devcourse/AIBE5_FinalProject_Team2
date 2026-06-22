ALTER TABLE alpha_workspace
    ADD COLUMN last_briefing_at DATETIME(6) NULL COMMENT '마지막 브리핑 생성 시각 (3시간 쿨다운용)';
