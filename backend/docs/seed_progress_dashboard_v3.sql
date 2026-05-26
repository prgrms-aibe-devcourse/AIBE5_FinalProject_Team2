-- ===========================================================================
-- 진행 프로젝트 시드 v3 (동적 ID)
--   client_hylee(클라이언트) ↔ hyleeyou(파트너)
--   대상 프로젝트: insert_test_data.sql 이 만든 3개 진행 프로젝트
--     · "AI 기반 개인 자산 관리 플랫폼 개발"
--     · "결제 시스템 고도화"
--     · "모바일 뱅킹 앱 리뉴얼"
--
-- 사전 조건: insert_test_data.sql 이 먼저 실행되어 있어야 함.
-- 멱등: 프로젝트별 자식 데이터 정리 후 재삽입.
-- ===========================================================================

USE devbridge_db;

SET SQL_SAFE_UPDATES = 0;

-- ─────────────────────────────────────────
-- 사용자 ID 동적 조회
-- ─────────────────────────────────────────
SET @client_id  = (SELECT id FROM users WHERE username = 'client_hylee' LIMIT 1);
SET @partner_id = (SELECT id FROM users WHERE username = 'hyleeyou'     LIMIT 1);

SELECT CONCAT('파트너: ', IFNULL(@partner_id,'없음'), ' / 클라이언트: ', IFNULL(@client_id,'없음')) AS 사용자_확인;

-- ─────────────────────────────────────────
-- 프로젝트 ID 동적 조회 (소유자 = client_hylee)
-- ─────────────────────────────────────────
SET @pid_asset = (
  SELECT id FROM projects
  WHERE user_id = @client_id
    AND title LIKE '%개인 자산 관리%'
  ORDER BY created_at DESC LIMIT 1
);
SET @pid_payment = (
  SELECT id FROM projects
  WHERE user_id = @client_id
    AND title LIKE '%결제 시스템%'
  ORDER BY created_at DESC LIMIT 1
);
SET @pid_mobile = (
  SELECT id FROM projects
  WHERE user_id = @client_id
    AND (title LIKE '%모바일 뱅킹%' OR title LIKE '%모바일 뱅크%')
  ORDER BY created_at DESC LIMIT 1
);

SELECT
  CONCAT('AI자산관리 ID: ', IFNULL(@pid_asset,   '없음')) AS P1,
  CONCAT('결제시스템  ID: ', IFNULL(@pid_payment, '없음')) AS P2,
  CONCAT('모바일뱅킹  ID: ', IFNULL(@pid_mobile,  '없음')) AS P3;

-- ─────────────────────────────────────────
-- 0) 기존 자식 데이터 정리 (멱등)
-- ─────────────────────────────────────────
DELETE FROM project_milestones
  WHERE project_id IN (@pid_asset, @pid_payment, @pid_mobile)
    AND project_id IS NOT NULL;

DELETE FROM project_escrows
  WHERE project_id IN (@pid_asset, @pid_payment, @pid_mobile)
    AND project_id IS NOT NULL;

DELETE FROM project_attachments
  WHERE project_id IN (@pid_asset, @pid_payment, @pid_mobile)
    AND project_id IS NOT NULL;

DELETE FROM project_meetings
  WHERE project_id IN (@pid_asset, @pid_payment, @pid_mobile)
    AND project_id IS NOT NULL;

DELETE FROM project_application
  WHERE project_id IN (@pid_asset, @pid_payment, @pid_mobile)
    AND partner_user_id = @partner_id
    AND project_id IS NOT NULL;

-- ─────────────────────────────────────────
-- 1) budget_amount KRW 단위 정상화
--    insert_test_data.sql 에서 만원 단위로 잘못 입력됨
-- ─────────────────────────────────────────
UPDATE projects SET budget_amount = 65000000  WHERE id = @pid_asset    AND @pid_asset IS NOT NULL;
UPDATE projects SET budget_amount = 50000000  WHERE id = @pid_payment  AND @pid_payment IS NOT NULL;
UPDATE projects SET budget_amount = 120000000 WHERE id = @pid_mobile   AND @pid_mobile IS NOT NULL;

-- ─────────────────────────────────────────
-- 2) 결제수단 (멱등)
-- ─────────────────────────────────────────
DELETE FROM payment_methods WHERE user_id IN (@client_id, @partner_id);
INSERT INTO payment_methods
  (user_id, brand, last4, holder_name, exp_month, exp_year, is_default, nickname, created_at, updated_at)
VALUES
  (@client_id,  'VISA',       '4242', 'HYUNG YEON LEE', 12, 2027, true,  '메인 카드', NOW(), NOW()),
  (@client_id,  'MASTERCARD', '5555', 'HYUNG YEON LEE',  6, 2026, false, '서브 카드', NOW(), NOW()),
  (@partner_id, 'VISA',       '4242', 'HY LEE',         11, 2028, true,  '개인 카드', NOW(), NOW());

SET @client_pm = (SELECT id FROM payment_methods WHERE user_id = @client_id AND last4 = '4242' LIMIT 1);

-- ─────────────────────────────────────────
-- 3) 파트너 매칭 (hyleeyou → 3개 프로젝트 모두 IN_PROGRESS)
-- ─────────────────────────────────────────
INSERT INTO project_application (project_id, partner_user_id, status, message, applied_at, updated_at)
SELECT @pid_asset, @partner_id, 'IN_PROGRESS',
  '핀테크 도메인 + AI 추천 경험 기반으로 4개월 안에 납품 가능합니다.',
  '2026-01-08 10:00:00', NOW()
WHERE @pid_asset IS NOT NULL;

INSERT INTO project_application (project_id, partner_user_id, status, message, applied_at, updated_at)
SELECT @pid_payment, @partner_id, 'IN_PROGRESS',
  'PG/카드/페이 연동 5건 이상 실적 보유. 안정적으로 진행하겠습니다.',
  '2026-02-10 11:00:00', NOW()
WHERE @pid_payment IS NOT NULL;

INSERT INTO project_application (project_id, partner_user_id, status, message, applied_at, updated_at)
SELECT @pid_mobile, @partner_id, 'IN_PROGRESS',
  'UI/UX 전면 개편 + 신규 기능 개발 경험 보유. 일정 내 납품 가능합니다.',
  '2026-03-01 09:30:00', NOW()
WHERE @pid_mobile IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════
-- 프로젝트 1 — AI 기반 개인 자산 관리 플랫폼 개발 (65,000,000)
--   M1 정산 완료, M2 작업 중, M3 결제 대기
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO project_milestones
  (project_id, seq, title, description, completion_criteria, amount,
   start_date, end_date, submitted_at, submission_note, submission_file_url,
   approved_at, revision_reason, status, created_at, updated_at)
SELECT @pid_asset, 1,
  '요구사항 분석 + UX 와이어프레임',
  '사용자 페르소나 정의, 자산 카테고리 분류 체계 설계, 메인/리스트/상세 와이어프레임.',
  '① 페르소나 3종 + 사용자 여정맵 / ② 정보구조도 IA / ③ Figma 와이어프레임 4화면 / ④ 클라이언트 시각 승인',
  18000000, '2026-01-10', '2026-01-25',
  '2026-01-24 18:00:00', '와이어프레임과 IA 문서 첨부했습니다.',
  'https://figma.com/file/mock-asset-wireframe-v1',
  '2026-01-25 11:30:00', NULL,
  'APPROVED', '2026-01-10 09:00:00', NOW()
WHERE @pid_asset IS NOT NULL;

INSERT INTO project_milestones
  (project_id, seq, title, description, completion_criteria, amount,
   start_date, end_date, submitted_at, submission_note, submission_file_url,
   approved_at, revision_reason, status, created_at, updated_at)
SELECT @pid_asset, 2,
  '핵심 자산 집계 API + 데이터 파이프라인',
  '오픈뱅킹 API 연동, 자산 정규화, 일일 스냅샷 배치 작업.',
  '① 오픈뱅킹 OAuth 흐름 정상 / ② 자산 5종 집계 정상 / ③ 일일 배치 스냅샷 7일 누적 / ④ P95 < 400ms',
  25000000, '2026-01-26', '2026-02-25',
  NULL, NULL, NULL, NULL, NULL,
  'IN_PROGRESS', '2026-01-26 09:00:00', NOW()
WHERE @pid_asset IS NOT NULL;

INSERT INTO project_milestones
  (project_id, seq, title, description, completion_criteria, amount,
   start_date, end_date, submitted_at, submission_note, submission_file_url,
   approved_at, revision_reason, status, created_at, updated_at)
SELECT @pid_asset, 3,
  '대시보드 UI + 리포트 PDF 생성',
  '메인 대시보드 차트 위젯 4종, 월간 리포트 PDF 자동 생성.',
  '① 차트 위젯 4종 / ② 월간 PDF 리포트 자동 생성 / ③ Lighthouse 성능 90+',
  22000000, '2026-02-26', '2026-03-30',
  NULL, NULL, NULL, NULL, NULL,
  'PENDING', '2026-01-10 09:00:00', NOW()
WHERE @pid_asset IS NOT NULL;

SET @a_m1 = (SELECT id FROM project_milestones WHERE project_id=@pid_asset AND seq=1 LIMIT 1);
SET @a_m2 = (SELECT id FROM project_milestones WHERE project_id=@pid_asset AND seq=2 LIMIT 1);
SET @a_m3 = (SELECT id FROM project_milestones WHERE project_id=@pid_asset AND seq=3 LIMIT 1);

INSERT INTO project_escrows
  (project_id, milestone_id, amount, payer_user_id, payee_user_id, status,
   payment_method, payment_method_id, payment_tx_id, deposited_at, released_at, refunded_at, created_at, updated_at)
SELECT @pid_asset, @a_m1, 18000000, @client_id, @partner_id, 'RELEASED',
  'CARD_MOCK', @client_pm, 'MOCK-A1-RELEASED',
  '2026-01-10 10:00:00', '2026-01-25 11:35:00', NULL, '2026-01-10 09:30:00', NOW()
WHERE @pid_asset IS NOT NULL AND @a_m1 IS NOT NULL;

INSERT INTO project_escrows
  (project_id, milestone_id, amount, payer_user_id, payee_user_id, status,
   payment_method, payment_method_id, payment_tx_id, deposited_at, released_at, refunded_at, created_at, updated_at)
SELECT @pid_asset, @a_m2, 25000000, @client_id, @partner_id, 'DEPOSITED',
  'CARD_MOCK', @client_pm, 'MOCK-A2-DEPOSITED',
  '2026-01-26 10:00:00', NULL, NULL, '2026-01-26 09:30:00', NOW()
WHERE @pid_asset IS NOT NULL AND @a_m2 IS NOT NULL;

INSERT INTO project_escrows
  (project_id, milestone_id, amount, payer_user_id, payee_user_id, status,
   payment_method, payment_method_id, payment_tx_id, deposited_at, released_at, refunded_at, created_at, updated_at)
SELECT @pid_asset, @a_m3, 22000000, @client_id, @partner_id, 'PENDING',
  NULL, NULL, NULL, NULL, NULL, NULL, '2026-02-26 09:30:00', NOW()
WHERE @pid_asset IS NOT NULL AND @a_m3 IS NOT NULL;

INSERT INTO project_meetings (project_id, frequency_label, next_at, location_label, agenda, created_at, updated_at)
SELECT @pid_asset, '정기: 격주 화요일', '2026-04-28 14:00:00', 'Virtual (Zoom)',
  '오픈뱅킹 API 인증 흐름 데모 + 자산 정규화 룰 확정', NOW(), NOW()
WHERE @pid_asset IS NOT NULL;

INSERT INTO project_attachments (project_id, kind, name, url, mime_type, size_bytes, uploader_user_id, created_at)
SELECT @pid_asset, 'FILE', 'WireFrame_v1.fig', 'https://files.example.com/wf_v1.fig',
  'application/octet-stream', 18874368, @partner_id, '2026-01-22 14:10:00'
WHERE @pid_asset IS NOT NULL;

INSERT INTO project_attachments (project_id, kind, name, url, mime_type, size_bytes, uploader_user_id, created_at)
SELECT @pid_asset, 'FILE', 'IA_Document.pdf', 'https://files.example.com/ia.pdf',
  'application/pdf', 1572864, @partner_id, '2026-01-23 16:00:00'
WHERE @pid_asset IS NOT NULL;

INSERT INTO project_attachments (project_id, kind, name, url, mime_type, size_bytes, uploader_user_id, created_at)
SELECT @pid_asset, 'LINK', 'GitHub Repo', 'https://github.com/example/asset-platform',
  NULL, NULL, @partner_id, '2026-01-26 11:00:00'
WHERE @pid_asset IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════
-- 프로젝트 2 — 결제 시스템 고도화 (50,000,000)
--   M1 승인, M2 제출(검토 중), M3 결제 대기
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO project_milestones
  (project_id, seq, title, description, completion_criteria, amount,
   start_date, end_date, submitted_at, submission_note, submission_file_url,
   approved_at, revision_reason, status, created_at, updated_at)
SELECT @pid_payment, 1,
  'PG 3사 연동 (토스/카카오/네이버)',
  '결제 추상화 레이어 + 3사 SDK 연동 + 콜백 처리.',
  '① 3사 결제 sandbox 정상 / ② 부분 취소·환불 시나리오 4종 / ③ Webhook 재처리 idempotency 보장',
  18000000, '2026-02-15', '2026-03-05',
  '2026-03-04 17:00:00', '3사 sandbox 결제·취소·환불 모두 통과. 통합 테스트 리포트 첨부.',
  'https://drive.example.com/pg-test-report.pdf',
  '2026-03-05 10:00:00', NULL,
  'APPROVED', '2026-02-15 09:00:00', NOW()
WHERE @pid_payment IS NOT NULL;

INSERT INTO project_milestones
  (project_id, seq, title, description, completion_criteria, amount,
   start_date, end_date, submitted_at, submission_note, submission_file_url,
   approved_at, revision_reason, status, created_at, updated_at)
SELECT @pid_payment, 2,
  '간편결제 토큰화 + Vault 저장',
  '카드 토큰화(EMV), Vault 분리, PCI-DSS 준수 점검.',
  '① EMV 토큰화 정상 / ② Vault 컨테이너 분리(KMS 암호화) / ③ PCI-DSS SAQ-D 100%',
  17000000, '2026-03-06', '2026-04-10',
  '2026-04-09 19:00:00', 'EMV 토큰 발급/사용 테스트 + Vault 격리 환경 셋업 완료.',
  'https://drive.example.com/vault-poc-demo.mp4',
  NULL, NULL,
  'SUBMITTED', '2026-03-06 09:00:00', NOW()
WHERE @pid_payment IS NOT NULL;

INSERT INTO project_milestones
  (project_id, seq, title, description, completion_criteria, amount,
   start_date, end_date, submitted_at, submission_note, submission_file_url,
   approved_at, revision_reason, status, created_at, updated_at)
SELECT @pid_payment, 3,
  '관리자 결제 콘솔 + 정산 리포트',
  '운영자용 결제 검색/취소/환불 콘솔, 일/월 정산 리포트.',
  '① 콘솔 권한 분리(매니저/관리자) / ② 일·월 정산 CSV·PDF 자동 생성 / ③ 권한별 감사 로그',
  15000000, '2026-04-11', '2026-05-15',
  NULL, NULL, NULL, NULL, NULL,
  'PENDING', '2026-02-15 09:00:00', NOW()
WHERE @pid_payment IS NOT NULL;

SET @p_m1 = (SELECT id FROM project_milestones WHERE project_id=@pid_payment AND seq=1 LIMIT 1);
SET @p_m2 = (SELECT id FROM project_milestones WHERE project_id=@pid_payment AND seq=2 LIMIT 1);
SET @p_m3 = (SELECT id FROM project_milestones WHERE project_id=@pid_payment AND seq=3 LIMIT 1);

INSERT INTO project_escrows
  (project_id, milestone_id, amount, payer_user_id, payee_user_id, status,
   payment_method, payment_method_id, payment_tx_id, deposited_at, released_at, refunded_at, created_at, updated_at)
SELECT @pid_payment, @p_m1, 18000000, @client_id, @partner_id, 'RELEASED',
  'CARD_MOCK', @client_pm, 'MOCK-P1-RELEASED',
  '2026-02-15 10:00:00', '2026-03-05 10:05:00', NULL, '2026-02-15 09:30:00', NOW()
WHERE @pid_payment IS NOT NULL AND @p_m1 IS NOT NULL;

INSERT INTO project_escrows
  (project_id, milestone_id, amount, payer_user_id, payee_user_id, status,
   payment_method, payment_method_id, payment_tx_id, deposited_at, released_at, refunded_at, created_at, updated_at)
SELECT @pid_payment, @p_m2, 17000000, @client_id, @partner_id, 'DEPOSITED',
  'CARD_MOCK', @client_pm, 'MOCK-P2-DEPOSITED',
  '2026-03-06 10:00:00', NULL, NULL, '2026-03-06 09:30:00', NOW()
WHERE @pid_payment IS NOT NULL AND @p_m2 IS NOT NULL;

INSERT INTO project_escrows
  (project_id, milestone_id, amount, payer_user_id, payee_user_id, status,
   payment_method, payment_method_id, payment_tx_id, deposited_at, released_at, refunded_at, created_at, updated_at)
SELECT @pid_payment, @p_m3, 15000000, @client_id, @partner_id, 'PENDING',
  NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-11 09:30:00', NOW()
WHERE @pid_payment IS NOT NULL AND @p_m3 IS NOT NULL;

INSERT INTO project_meetings (project_id, frequency_label, next_at, location_label, agenda, created_at, updated_at)
SELECT @pid_payment, '정기: 주 1회 목요일', '2026-04-23 15:00:00', '클라이언트 본사 회의실 A',
  'Vault PoC 데모 검토 + PCI-DSS 체크리스트 합의', NOW(), NOW()
WHERE @pid_payment IS NOT NULL;

INSERT INTO project_attachments (project_id, kind, name, url, mime_type, size_bytes, uploader_user_id, created_at)
SELECT @pid_payment, 'FILE', 'PG_Integration_Spec.pdf', 'https://files.example.com/pg_spec.pdf',
  'application/pdf', 3145728, @partner_id, '2026-02-20 11:00:00'
WHERE @pid_payment IS NOT NULL;

INSERT INTO project_attachments (project_id, kind, name, url, mime_type, size_bytes, uploader_user_id, created_at)
SELECT @pid_payment, 'FILE', 'Vault_Architecture.png', 'https://files.example.com/vault.png',
  'image/png', 524288, @partner_id, '2026-03-15 09:30:00'
WHERE @pid_payment IS NOT NULL;

INSERT INTO project_attachments (project_id, kind, name, url, mime_type, size_bytes, uploader_user_id, created_at)
SELECT @pid_payment, 'LINK', 'Notion 작업 문서', 'https://notion.so/example/payment-upgrade',
  NULL, NULL, @partner_id, '2026-02-15 10:30:00'
WHERE @pid_payment IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════
-- 프로젝트 3 — 모바일 뱅킹 앱 리뉴얼 (120,000,000)
--   M1 승인, M2 작업 중, M3 수정요청
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO project_milestones
  (project_id, seq, title, description, completion_criteria, amount,
   start_date, end_date, submitted_at, submission_note, submission_file_url,
   approved_at, revision_reason, status, created_at, updated_at)
SELECT @pid_mobile, 1,
  'UI/UX 리디자인 (디자인 시스템 v1)',
  '전체 화면 재설계, 컴포넌트 라이브러리, 다크모드 지원.',
  '① Figma 전체 화면 시안 / ② 컴포넌트 라이브러리 24개+ / ③ 다크모드 적용 / ④ 클라이언트 승인',
  40000000, '2026-03-01', '2026-03-25',
  '2026-03-24 17:00:00', 'Figma 링크와 컴포넌트 라이브러리 PDF 첨부드립니다.',
  'https://figma.com/file/mobile-banking-renewal',
  '2026-03-25 11:00:00', NULL,
  'APPROVED', '2026-03-01 09:00:00', NOW()
WHERE @pid_mobile IS NOT NULL;

INSERT INTO project_milestones
  (project_id, seq, title, description, completion_criteria, amount,
   start_date, end_date, submitted_at, submission_note, submission_file_url,
   approved_at, revision_reason, status, created_at, updated_at)
SELECT @pid_mobile, 2,
  '핵심 기능 개발 (계좌/이체/조회)',
  '계좌 목록 조회, 이체, 잔액 조회, 거래 내역 API 및 화면 구현.',
  '① 핵심 API 5종 200/4xx 정상 / ② Postman 100% 통과 / ③ P95 < 300ms / ④ iOS + Android 동시 지원',
  50000000, '2026-03-26', '2026-05-10',
  NULL, NULL, NULL, NULL, NULL,
  'IN_PROGRESS', '2026-03-26 09:00:00', NOW()
WHERE @pid_mobile IS NOT NULL;

INSERT INTO project_milestones
  (project_id, seq, title, description, completion_criteria, amount,
   start_date, end_date, submitted_at, submission_note, submission_file_url,
   approved_at, revision_reason, status, created_at, updated_at)
SELECT @pid_mobile, 3,
  '인증/보안 강화 (생체인증 + OTP)',
  '지문/Face ID 연동, OTP 2단계 인증, 세션 관리.',
  '① 생체인증 정상 작동 / ② OTP 발급·검증 / ③ 세션 만료 자동 로그아웃 / ④ 단위테스트 80%',
  30000000, '2026-03-20', '2026-04-20',
  '2026-04-20 18:00:00', '인증 흐름 데모 영상과 테스트 리포트 첨부드립니다.',
  'https://drive.example.com/auth-mobile-demo.mp4',
  NULL, '지문 인식 실패 케이스 처리 누락. 테스트 커버리지 추가 요청.',
  'REVISION_REQUESTED', '2026-03-20 09:00:00', NOW()
WHERE @pid_mobile IS NOT NULL;

SET @m_m1 = (SELECT id FROM project_milestones WHERE project_id=@pid_mobile AND seq=1 LIMIT 1);
SET @m_m2 = (SELECT id FROM project_milestones WHERE project_id=@pid_mobile AND seq=2 LIMIT 1);
SET @m_m3 = (SELECT id FROM project_milestones WHERE project_id=@pid_mobile AND seq=3 LIMIT 1);

INSERT INTO project_escrows
  (project_id, milestone_id, amount, payer_user_id, payee_user_id, status,
   payment_method, payment_method_id, payment_tx_id, deposited_at, released_at, refunded_at, created_at, updated_at)
SELECT @pid_mobile, @m_m1, 40000000, @client_id, @partner_id, 'RELEASED',
  'CARD_MOCK', @client_pm, 'MOCK-M1-RELEASED',
  '2026-03-01 10:00:00', '2026-03-25 11:05:00', NULL, '2026-03-01 09:30:00', NOW()
WHERE @pid_mobile IS NOT NULL AND @m_m1 IS NOT NULL;

INSERT INTO project_escrows
  (project_id, milestone_id, amount, payer_user_id, payee_user_id, status,
   payment_method, payment_method_id, payment_tx_id, deposited_at, released_at, refunded_at, created_at, updated_at)
SELECT @pid_mobile, @m_m2, 50000000, @client_id, @partner_id, 'DEPOSITED',
  'CARD_MOCK', @client_pm, 'MOCK-M2-DEPOSITED',
  '2026-03-26 10:00:00', NULL, NULL, '2026-03-26 09:30:00', NOW()
WHERE @pid_mobile IS NOT NULL AND @m_m2 IS NOT NULL;

INSERT INTO project_escrows
  (project_id, milestone_id, amount, payer_user_id, payee_user_id, status,
   payment_method, payment_method_id, payment_tx_id, deposited_at, released_at, refunded_at, created_at, updated_at)
SELECT @pid_mobile, @m_m3, 30000000, @client_id, @partner_id, 'PENDING',
  NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-20 09:30:00', NOW()
WHERE @pid_mobile IS NOT NULL AND @m_m3 IS NOT NULL;

INSERT INTO project_meetings (project_id, frequency_label, next_at, location_label, agenda, created_at, updated_at)
SELECT @pid_mobile, '정기: 주 1회 월요일', '2026-04-27 14:00:00', 'Virtual (Zoom)',
  'API 명세서 최종 검토 + 인증 모듈 수정사항 확인', NOW(), NOW()
WHERE @pid_mobile IS NOT NULL;

INSERT INTO project_attachments (project_id, kind, name, url, mime_type, size_bytes, uploader_user_id, created_at)
SELECT @pid_mobile, 'FILE', 'Design_System_MobileBanking.fig',
  'https://files.example.com/ds_mobile.fig',
  'application/octet-stream', 15728640, @partner_id, '2026-03-22 10:00:00'
WHERE @pid_mobile IS NOT NULL;

INSERT INTO project_attachments (project_id, kind, name, url, mime_type, size_bytes, uploader_user_id, created_at)
SELECT @pid_mobile, 'FILE', 'API_Spec_Banking.pdf',
  'https://files.example.com/api_banking.pdf',
  'application/pdf', 2516582, @partner_id, '2026-04-14 16:00:00'
WHERE @pid_mobile IS NOT NULL;

INSERT INTO project_attachments (project_id, kind, name, url, mime_type, size_bytes, uploader_user_id, created_at)
SELECT @pid_mobile, 'LINK', 'GitHub Repo (private)',
  'https://github.com/example/mobile-banking',
  NULL, NULL, @partner_id, '2026-03-26 09:50:00'
WHERE @pid_mobile IS NOT NULL;

-- ─────────────────────────────────────────
-- 결과 확인
-- ─────────────────────────────────────────
SELECT '===== 프로젝트별 마일스톤 =====' AS result;
SELECT p.title, COUNT(m.id) AS 마일스톤_수, SUM(m.amount) AS 총_금액,
  GROUP_CONCAT(m.title ORDER BY m.seq SEPARATOR ' → ') AS 마일스톤_목록
FROM project_milestones m
JOIN projects p ON p.id = m.project_id
WHERE m.project_id IN (@pid_asset, @pid_payment, @pid_mobile)
GROUP BY p.id, p.title;

SELECT '===== hyleeyou 지원 내역 =====' AS result;
SELECT p.title, pa.status
FROM project_application pa
JOIN projects p ON p.id = pa.project_id
WHERE pa.partner_user_id = @partner_id
  AND pa.project_id IN (@pid_asset, @pid_payment, @pid_mobile);
