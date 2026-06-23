-- V30: 비전 보드 — 사용자별 아이템 목록(JSON) 영구 저장
CREATE TABLE vision_board (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    user_id    BIGINT       NOT NULL,
    items      LONGTEXT     NOT NULL,
    updated_at DATETIME(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_vision_board_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
