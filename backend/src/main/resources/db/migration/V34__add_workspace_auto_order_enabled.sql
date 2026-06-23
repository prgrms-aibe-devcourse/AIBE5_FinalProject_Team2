ALTER TABLE alpha_workspace
    ADD COLUMN auto_order_enabled TINYINT(1) NOT NULL DEFAULT 0
        COMMENT '자동주문 활성화 스위치. 1이면 daily auto-run이 queue-orders 단계를 실행해 PENDING 제안을 생성.';
