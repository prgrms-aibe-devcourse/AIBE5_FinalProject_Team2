-- 동일 사용자 내 워크스페이스 이름 중복 방지
ALTER TABLE alpha_workspace
    ADD CONSTRAINT uq_workspace_user_name UNIQUE (user_id, name);
