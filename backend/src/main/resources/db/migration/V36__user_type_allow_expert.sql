-- user_type CHECK 제약에 'EXPERT' 추가.
-- User.UserType enum 에는 EXPERT 가 있으나 DB CHECK 제약(users_chk_1)이 PREMIUM/FREE/STANDARD 만 허용해
-- Expert(39,900) 결제 시 activatePro 의 user_type='EXPERT' 저장이 제약위반으로 롤백 → 모든 유저의 Expert 구독이 실패하던 버그 수정.
ALTER TABLE users DROP CHECK users_chk_1;
ALTER TABLE users ADD CONSTRAINT users_chk_1 CHECK (user_type IN ('FREE', 'STANDARD', 'PREMIUM', 'EXPERT'));
