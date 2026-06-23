ALTER TABLE alpha_workspace
    ADD COLUMN last_improve_at DATETIME(6) NULL COMMENT '마지막 개선 제안서 생성 시각 (1시간 쿨다운용)';
