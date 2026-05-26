-- ============================================================
-- hyleeyou(파트너) + client_hylee(클라이언트)
-- 완료한 프로젝트 3건의 마일스톤·에스크로·첨부파일·모듈 시드
--
-- 프로젝트 ID를 이름으로 동적 조회하므로 하드코딩 없이 안전하게 실행 가능.
-- MySQL Workbench에서 전체 선택(Ctrl+A) 후 실행(Ctrl+Shift+Enter).
-- ============================================================
USE devbridge_db;

-- ─────────────────────────────────────────
-- 사용자 ID 동적 조회
-- ─────────────────────────────────────────
SET @partner_id = (SELECT id FROM users WHERE username = 'hyleeyou'   LIMIT 1);
SET @client_id  = (SELECT id FROM users WHERE username = 'client_hylee' LIMIT 1);

SELECT CONCAT('파트너 ID: ', IFNULL(@partner_id, '없음'), ' / 클라이언트 ID: ', IFNULL(@client_id, '없음')) AS 사용자_확인;

-- ─────────────────────────────────────────
-- 프로젝트 ID 동적 조회
-- ─────────────────────────────────────────
SET @pid_festory  = (
  SELECT DISTINCT p.id FROM projects p
  JOIN project_application pa ON pa.project_id = p.id
  WHERE pa.partner_user_id = @partner_id
    AND pa.status = 'COMPLETED'
    AND p.title LIKE '%Festory%'
  LIMIT 1
);
SET @pid_alpha    = (
  SELECT DISTINCT p.id FROM projects p
  JOIN project_application pa ON pa.project_id = p.id
  WHERE pa.partner_user_id = @partner_id
    AND pa.status = 'COMPLETED'
    AND (p.title LIKE '%Alpha%' OR p.title LIKE '%Helix%' OR p.title LIKE '%단백질%')
  LIMIT 1
);
SET @pid_devbridge = (
  SELECT DISTINCT p.id FROM projects p
  JOIN project_application pa ON pa.project_id = p.id
  WHERE pa.partner_user_id = @partner_id
    AND pa.status = 'COMPLETED'
    AND (p.title LIKE '%DevBridge%' OR p.title LIKE '%개발자 매칭%')
  LIMIT 1
);

SELECT
  CONCAT('Festory ID: ',    IFNULL(@pid_festory,   '없음')) AS Festory,
  CONCAT('Alpha-Helix ID: ', IFNULL(@pid_alpha,     '없음')) AS Alpha_Helix,
  CONCAT('DevBridge ID: ',  IFNULL(@pid_devbridge, '없음')) AS DevBridge;

-- ─────────────────────────────────────────
-- 기존 자식 데이터 정리 (멱등 보장)
-- ─────────────────────────────────────────
DELETE FROM project_milestones
  WHERE project_id IN (@pid_festory, @pid_alpha, @pid_devbridge)
    AND project_id IS NOT NULL;

DELETE FROM project_escrows
  WHERE project_id IN (@pid_festory, @pid_alpha, @pid_devbridge)
    AND project_id IS NOT NULL;

DELETE FROM project_attachments
  WHERE project_id IN (@pid_festory, @pid_alpha, @pid_devbridge)
    AND project_id IS NOT NULL;

DELETE FROM PROJECT_MODULES
  WHERE project_id IN (@pid_festory, @pid_alpha, @pid_devbridge)
    AND project_id IS NOT NULL;

-- ══════════════════════════════════════════════════════
-- 1. Festory — 전국 축제 정보 통합 플랫폼
-- ══════════════════════════════════════════════════════

INSERT INTO project_milestones
  (project_id, seq, title, description, completion_criteria, amount,
   start_date, end_date, status,
   submitted_at, submission_note, submission_file_url, approved_at,
   created_at, updated_at)
SELECT @pid_festory, 1,
  '기획 및 요구사항 분석',
  '서비스 기획서 작성, 사용자 스토리 정의, UI/UX 와이어프레임 초안 제작',
  '① 요구사항 정의서 PDF 납품 ② 와이어프레임 Figma 링크 공유 ③ 클라이언트 검토 완료',
  8000000, '2025-08-01', '2025-08-20',
  'APPROVED',
  '2025-08-18 10:30:00',
  '기획서 및 와이어프레임 최종본 제출드립니다. Figma 링크 첨부했습니다.',
  'https://drive.google.com/file/d/festory-planning-v1',
  '2025-08-20 14:00:00',
  NOW(), NOW()
WHERE @pid_festory IS NOT NULL;

INSERT INTO project_milestones
  (project_id, seq, title, description, completion_criteria, amount,
   start_date, end_date, status,
   submitted_at, submission_note, submission_file_url, approved_at,
   created_at, updated_at)
SELECT @pid_festory, 2,
  '핵심 기능 개발',
  '행사 등록/조회/신청 API 구현, 파트너 매칭 알고리즘, 결제 연동',
  '① API 문서(Swagger) 제공 ② 단위 테스트 커버리지 75% 이상 ③ 스테이징 서버 배포',
  15000000, '2025-08-21', '2025-09-30',
  'APPROVED',
  '2025-09-28 17:00:00',
  '핵심 API 개발 완료 및 테스트 리포트 첨부했습니다.',
  'https://drive.google.com/file/d/festory-api-report',
  '2025-09-30 11:00:00',
  NOW(), NOW()
WHERE @pid_festory IS NOT NULL;

INSERT INTO project_milestones
  (project_id, seq, title, description, completion_criteria, amount,
   start_date, end_date, status,
   submitted_at, submission_note, submission_file_url, approved_at,
   created_at, updated_at)
SELECT @pid_festory, 3,
  '최종 테스트 및 배포',
  'QA 전체 테스트, 성능 최적화, 프로덕션 배포, 운영 가이드 문서화',
  '① 버그 0건(Critical) ② 로딩속도 3초 이내 ③ 운영 가이드 문서 납품',
  7000000, '2025-10-01', '2025-10-20',
  'APPROVED',
  '2025-10-18 09:00:00',
  'QA 완료 및 프로덕션 배포 완료했습니다. 운영 가이드 문서 첨부합니다.',
  'https://drive.google.com/file/d/festory-deploy-guide',
  '2025-10-20 16:30:00',
  NOW(), NOW()
WHERE @pid_festory IS NOT NULL;

-- Festory 에스크로
SET @f1 = (SELECT id FROM project_milestones WHERE project_id=@pid_festory AND seq=1 LIMIT 1);
SET @f2 = (SELECT id FROM project_milestones WHERE project_id=@pid_festory AND seq=2 LIMIT 1);
SET @f3 = (SELECT id FROM project_milestones WHERE project_id=@pid_festory AND seq=3 LIMIT 1);

INSERT INTO project_escrows
  (project_id, milestone_id, amount, payer_user_id, payee_user_id,
   status, payment_method, deposited_at, released_at, created_at, updated_at)
SELECT @pid_festory, @f1, 8000000, @client_id, @partner_id,
  'RELEASED', 'CARD', '2025-08-01 10:00:00', '2025-08-20 14:00:00', NOW(), NOW()
WHERE @pid_festory IS NOT NULL AND @f1 IS NOT NULL;

INSERT INTO project_escrows
  (project_id, milestone_id, amount, payer_user_id, payee_user_id,
   status, payment_method, deposited_at, released_at, created_at, updated_at)
SELECT @pid_festory, @f2, 15000000, @client_id, @partner_id,
  'RELEASED', 'CARD', '2025-08-21 10:00:00', '2025-09-30 11:00:00', NOW(), NOW()
WHERE @pid_festory IS NOT NULL AND @f2 IS NOT NULL;

INSERT INTO project_escrows
  (project_id, milestone_id, amount, payer_user_id, payee_user_id,
   status, payment_method, deposited_at, released_at, created_at, updated_at)
SELECT @pid_festory, @f3, 7000000, @client_id, @partner_id,
  'RELEASED', 'CARD', '2025-10-01 10:00:00', '2025-10-20 16:30:00', NOW(), NOW()
WHERE @pid_festory IS NOT NULL AND @f3 IS NOT NULL;

-- Festory 첨부파일
INSERT INTO project_attachments (project_id, kind, name, url, uploader_user_id, created_at)
SELECT @pid_festory, 'FILE', '요구사항_정의서_v2.pdf',
  'https://drive.google.com/file/d/festory-req-doc', @partner_id, '2025-08-18 10:30:00'
WHERE @pid_festory IS NOT NULL;

INSERT INTO project_attachments (project_id, kind, name, url, uploader_user_id, created_at)
SELECT @pid_festory, 'FILE', 'QA_테스트_리포트_최종.xlsx',
  'https://drive.google.com/file/d/festory-qa-report', @partner_id, '2025-10-18 09:00:00'
WHERE @pid_festory IS NOT NULL;

INSERT INTO project_attachments (project_id, kind, name, url, uploader_user_id, created_at)
SELECT @pid_festory, 'LINK', 'Figma 와이어프레임',
  'https://figma.com/file/festory-wireframe', @partner_id, '2025-08-10 14:00:00'
WHERE @pid_festory IS NOT NULL;

INSERT INTO project_attachments (project_id, kind, name, url, uploader_user_id, created_at)
SELECT @pid_festory, 'LINK', '프로덕션 서비스 URL',
  'https://festory.io', @partner_id, '2025-10-20 16:30:00'
WHERE @pid_festory IS NOT NULL;

-- Festory 계약 모듈
INSERT INTO PROJECT_MODULES (project_id, module_key, status, data, last_modifier_id, last_modifier_name)
SELECT @pid_festory, 'scope', '협의완료',
  '{"text":"사용자 위치 기반 축제 추천 시스템, React 프론트엔드 + Node.js 백엔드 + 외부 축제 데이터 연동 API. 지도 기반 UI, 실시간 업데이트, 즐겨찾기 기능 포함."}',
  @client_id, 'client_hylee'
WHERE @pid_festory IS NOT NULL;

INSERT INTO PROJECT_MODULES (project_id, module_key, status, data, last_modifier_id, last_modifier_name)
SELECT @pid_festory, 'deliverable', '협의완료',
  '{"text":"GitHub 소스코드 저장소(main 브랜치), 배포된 웹 서비스 URL, Swagger API 문서, 운영 가이드 PDF, ERD 문서."}',
  @client_id, 'client_hylee'
WHERE @pid_festory IS NOT NULL;

INSERT INTO PROJECT_MODULES (project_id, module_key, status, data, last_modifier_id, last_modifier_name)
SELECT @pid_festory, 'schedule', '협의완료',
  '{"text":"1단계 기획·설계: 2025.08.01~08.20 / 2단계 핵심 개발: 08.21~09.30 / 3단계 테스트·배포: 10.01~10.20. 총 12주."}',
  @client_id, 'client_hylee'
WHERE @pid_festory IS NOT NULL;

INSERT INTO PROJECT_MODULES (project_id, module_key, status, data, last_modifier_id, last_modifier_name)
SELECT @pid_festory, 'payment', '협의완료',
  '{"text":"총 계약금액 30,000,000원. ① M1 기획 8,000,000원 ② M2 개발 15,000,000원 ③ M3 배포 7,000,000원. 마일스톤별 정산."}',
  @client_id, 'client_hylee'
WHERE @pid_festory IS NOT NULL;

INSERT INTO PROJECT_MODULES (project_id, module_key, status, data, last_modifier_id, last_modifier_name)
SELECT @pid_festory, 'revision', '협의완료',
  '{"text":"납품 후 14일 이내 발견된 버그 수정 무상 제공. 기능 추가 및 변경은 별도 견적 협의. 디자인 수정 1회 무상 포함."}',
  @client_id, 'client_hylee'
WHERE @pid_festory IS NOT NULL;

INSERT INTO PROJECT_MODULES (project_id, module_key, status, data, last_modifier_id, last_modifier_name)
SELECT @pid_festory, 'completion', '협의완료',
  '{"text":"핵심 기능(위치 기반 추천, 검색, 상세 페이지) 정상 작동. Lighthouse 성능 점수 80점 이상. 크로스 브라우저 호환성 확인."}',
  @client_id, 'client_hylee'
WHERE @pid_festory IS NOT NULL;

INSERT INTO PROJECT_MODULES (project_id, module_key, status, data, last_modifier_id, last_modifier_name)
SELECT @pid_festory, 'terms', '협의완료',
  '{"text":"개발 완료 후 소스코드 전체 클라이언트 이관. 1개월 무상 유지보수 포함. 외부 API 키는 클라이언트 측 발급 및 적용 책임."}',
  @client_id, 'client_hylee'
WHERE @pid_festory IS NOT NULL;


-- ══════════════════════════════════════════════════════
-- 2. Alpha-Helix — AI 단백질 구조 분석 플랫폼
-- ══════════════════════════════════════════════════════

INSERT INTO project_milestones
  (project_id, seq, title, description, completion_criteria, amount,
   start_date, end_date, status,
   submitted_at, submission_note, submission_file_url, approved_at,
   created_at, updated_at)
SELECT @pid_alpha, 1,
  '시스템 아키텍처 설계',
  'MSA 설계, DB 스키마 정의, 인프라 구성도, 기술 스택 확정',
  '① 아키텍처 설계서 납품 ② ERD 다이어그램 포함 ③ 기술 스택 문서 작성',
  12000000, '2025-06-01', '2025-06-25',
  'APPROVED',
  '2025-06-23 11:00:00',
  '시스템 아키텍처 설계 완료 및 ERD 포함 문서 제출합니다.',
  'https://drive.google.com/file/d/alpha-arch-doc',
  '2025-06-25 15:00:00',
  NOW(), NOW()
WHERE @pid_alpha IS NOT NULL;

INSERT INTO project_milestones
  (project_id, seq, title, description, completion_criteria, amount,
   start_date, end_date, status,
   submitted_at, submission_note, submission_file_url, approved_at,
   created_at, updated_at)
SELECT @pid_alpha, 2,
  '백엔드 API 구현',
  'REST API 전 구현, JWT 인증/인가, 데이터 파이프라인, CI/CD 구성',
  '① Swagger API 문서 제공 ② 통합 테스트 통과 ③ Docker 배포 완료',
  20000000, '2025-06-26', '2025-08-15',
  'APPROVED',
  '2025-08-13 16:00:00',
  'API 전체 구현 및 CI/CD 파이프라인 구성 완료했습니다.',
  'https://drive.google.com/file/d/alpha-backend-doc',
  '2025-08-15 17:00:00',
  NOW(), NOW()
WHERE @pid_alpha IS NOT NULL;

INSERT INTO project_milestones
  (project_id, seq, title, description, completion_criteria, amount,
   start_date, end_date, status,
   submitted_at, submission_note, submission_file_url, approved_at,
   created_at, updated_at)
SELECT @pid_alpha, 3,
  '프론트엔드 UI 완성',
  'React 기반 대시보드 구현, 실시간 데이터 시각화, 반응형 UI',
  '① 전체 화면 구현 완료 ② 크로스 브라우저 테스트 ③ Lighthouse 90점 이상',
  13000000, '2025-08-16', '2025-09-20',
  'APPROVED',
  '2025-09-18 14:00:00',
  'UI 전체 구현 완료 및 성능 최적화 결과 첨부합니다.',
  'https://drive.google.com/file/d/alpha-frontend-doc',
  '2025-09-20 16:00:00',
  NOW(), NOW()
WHERE @pid_alpha IS NOT NULL;

-- Alpha-Helix 에스크로
SET @a1 = (SELECT id FROM project_milestones WHERE project_id=@pid_alpha AND seq=1 LIMIT 1);
SET @a2 = (SELECT id FROM project_milestones WHERE project_id=@pid_alpha AND seq=2 LIMIT 1);
SET @a3 = (SELECT id FROM project_milestones WHERE project_id=@pid_alpha AND seq=3 LIMIT 1);

INSERT INTO project_escrows
  (project_id, milestone_id, amount, payer_user_id, payee_user_id,
   status, payment_method, deposited_at, released_at, created_at, updated_at)
SELECT @pid_alpha, @a1, 12000000, @client_id, @partner_id,
  'RELEASED', 'CARD', '2025-06-01 10:00:00', '2025-06-25 15:00:00', NOW(), NOW()
WHERE @pid_alpha IS NOT NULL AND @a1 IS NOT NULL;

INSERT INTO project_escrows
  (project_id, milestone_id, amount, payer_user_id, payee_user_id,
   status, payment_method, deposited_at, released_at, created_at, updated_at)
SELECT @pid_alpha, @a2, 20000000, @client_id, @partner_id,
  'RELEASED', 'CARD', '2025-06-26 10:00:00', '2025-08-15 17:00:00', NOW(), NOW()
WHERE @pid_alpha IS NOT NULL AND @a2 IS NOT NULL;

INSERT INTO project_escrows
  (project_id, milestone_id, amount, payer_user_id, payee_user_id,
   status, payment_method, deposited_at, released_at, created_at, updated_at)
SELECT @pid_alpha, @a3, 13000000, @client_id, @partner_id,
  'RELEASED', 'CARD', '2025-08-16 10:00:00', '2025-09-20 16:00:00', NOW(), NOW()
WHERE @pid_alpha IS NOT NULL AND @a3 IS NOT NULL;

-- Alpha-Helix 첨부파일
INSERT INTO project_attachments (project_id, kind, name, url, uploader_user_id, created_at)
SELECT @pid_alpha, 'FILE', '시스템_아키텍처_설계서_v1.pdf',
  'https://drive.google.com/file/d/alpha-arch-final', @partner_id, '2025-06-23 11:00:00'
WHERE @pid_alpha IS NOT NULL;

INSERT INTO project_attachments (project_id, kind, name, url, uploader_user_id, created_at)
SELECT @pid_alpha, 'FILE', 'API_명세서_Swagger_export.json',
  'https://drive.google.com/file/d/alpha-swagger', @partner_id, '2025-08-13 16:00:00'
WHERE @pid_alpha IS NOT NULL;

INSERT INTO project_attachments (project_id, kind, name, url, uploader_user_id, created_at)
SELECT @pid_alpha, 'FILE', 'Lighthouse_성능_리포트.pdf',
  'https://drive.google.com/file/d/alpha-lighthouse', @partner_id, '2025-09-18 14:00:00'
WHERE @pid_alpha IS NOT NULL;

INSERT INTO project_attachments (project_id, kind, name, url, uploader_user_id, created_at)
SELECT @pid_alpha, 'LINK', 'GitHub 레포지토리',
  'https://github.com/alpha-helix/backend', @partner_id, '2025-06-26 09:00:00'
WHERE @pid_alpha IS NOT NULL;

INSERT INTO project_attachments (project_id, kind, name, url, uploader_user_id, created_at)
SELECT @pid_alpha, 'LINK', '스테이징 서버 URL',
  'https://staging.alpha-helix.io', @partner_id, '2025-09-01 10:00:00'
WHERE @pid_alpha IS NOT NULL;

-- Alpha-Helix 계약 모듈
INSERT INTO PROJECT_MODULES (project_id, module_key, status, data, last_modifier_id, last_modifier_name)
SELECT @pid_alpha, 'scope', '협의완료',
  '{"text":"AlphaFold2 알고리즘 PyTorch 구현, 단백질 구조 예측 웹 플랫폼(React + FastAPI), 3D 시각화(Three.js). MSA 기반 아키텍처로 확장 가능하게 설계."}',
  @client_id, 'client_hylee'
WHERE @pid_alpha IS NOT NULL;

INSERT INTO PROJECT_MODULES (project_id, module_key, status, data, last_modifier_id, last_modifier_name)
SELECT @pid_alpha, 'deliverable', '협의완료',
  '{"text":"소스코드 전체(GitHub), Swagger API 문서, ERD 다이어그램, 아키텍처 설계서, Lighthouse 성능 리포트, 운영 가이드."}',
  @client_id, 'client_hylee'
WHERE @pid_alpha IS NOT NULL;

INSERT INTO PROJECT_MODULES (project_id, module_key, status, data, last_modifier_id, last_modifier_name)
SELECT @pid_alpha, 'schedule', '협의완료',
  '{"text":"1단계 설계: 2025.06.01~06.25 / 2단계 백엔드: 06.26~08.15 / 3단계 프론트엔드: 08.16~09.20. 총 16주."}',
  @client_id, 'client_hylee'
WHERE @pid_alpha IS NOT NULL;

INSERT INTO PROJECT_MODULES (project_id, module_key, status, data, last_modifier_id, last_modifier_name)
SELECT @pid_alpha, 'payment', '협의완료',
  '{"text":"총 계약금액 45,000,000원. ① M1 설계 12,000,000원 ② M2 백엔드 20,000,000원 ③ M3 프론트엔드 13,000,000원. 마일스톤별 에스크로 정산."}',
  @client_id, 'client_hylee'
WHERE @pid_alpha IS NOT NULL;

INSERT INTO PROJECT_MODULES (project_id, module_key, status, data, last_modifier_id, last_modifier_name)
SELECT @pid_alpha, 'revision', '협의완료',
  '{"text":"납품 후 30일 이내 발견된 버그 무상 수정. AI 모델 예측 정확도 개선은 별도 협의. 외부 API(PDB 데이터) 스펙 변경 재작업 제외."}',
  @client_id, 'client_hylee'
WHERE @pid_alpha IS NOT NULL;

INSERT INTO PROJECT_MODULES (project_id, module_key, status, data, last_modifier_id, last_modifier_name)
SELECT @pid_alpha, 'completion', '협의완료',
  '{"text":"단백질 구조 예측 정확도 TM-score 0.7 이상. API 응답 P95 400ms 이내. Lighthouse 성능 90점 이상. 크로스 브라우저 호환성 확인."}',
  @client_id, 'client_hylee'
WHERE @pid_alpha IS NOT NULL;

INSERT INTO PROJECT_MODULES (project_id, module_key, status, data, last_modifier_id, last_modifier_name)
SELECT @pid_alpha, 'terms', '협의완료',
  '{"text":"소스코드 전체 클라이언트 이관. AI 모델 가중치 포함. 3개월 무상 유지보수. 논문/특허 공동 저작권 보유. 비밀유지 계약 별도 체결."}',
  @client_id, 'client_hylee'
WHERE @pid_alpha IS NOT NULL;


-- ══════════════════════════════════════════════════════
-- 3. DevBridge Platform — AI 기반 개발자 매칭 플랫폼
-- ══════════════════════════════════════════════════════

INSERT INTO project_milestones
  (project_id, seq, title, description, completion_criteria, amount,
   start_date, end_date, status,
   submitted_at, submission_note, submission_file_url, approved_at,
   created_at, updated_at)
SELECT @pid_devbridge, 1,
  '플랫폼 설계 및 DB 구성',
  'AI 매칭 엔진 설계, 사용자/프로젝트/계약 DB 스키마 설계, 인증 시스템 구축',
  '① ERD 완성 및 승인 ② 인증 API(로그인/회원가입) 동작 확인 ③ 스키마 마이그레이션 스크립트 제공',
  10000000, '2025-04-01', '2025-04-30',
  'APPROVED',
  '2025-04-28 10:00:00',
  'DB 설계 완료 및 인증 API 구현 완료했습니다. ERD 문서 첨부합니다.',
  'https://drive.google.com/file/d/devbridge-erd-v1',
  '2025-04-30 17:00:00',
  NOW(), NOW()
WHERE @pid_devbridge IS NOT NULL;

INSERT INTO project_milestones
  (project_id, seq, title, description, completion_criteria, amount,
   start_date, end_date, status,
   submitted_at, submission_note, submission_file_url, approved_at,
   created_at, updated_at)
SELECT @pid_devbridge, 2,
  '핵심 매칭 알고리즘 개발',
  'AI 기반 파트너-클라이언트 매칭 로직, 프로젝트 추천 엔진, 실시간 채팅 연동',
  '① 매칭 정확도 테스트 결과 제공 ② Stream Chat 연동 완료 ③ 추천 API 문서화',
  25000000, '2025-05-01', '2025-06-30',
  'APPROVED',
  '2025-06-27 15:00:00',
  '매칭 알고리즘 및 Stream Chat 연동 완료. 테스트 결과 첨부합니다.',
  'https://drive.google.com/file/d/devbridge-matching-report',
  '2025-06-30 18:00:00',
  NOW(), NOW()
WHERE @pid_devbridge IS NOT NULL;

INSERT INTO project_milestones
  (project_id, seq, title, description, completion_criteria, amount,
   start_date, end_date, status,
   submitted_at, submission_note, submission_file_url, approved_at,
   created_at, updated_at)
SELECT @pid_devbridge, 3,
  '배포 및 운영 환경 구성',
  'AWS 인프라 구성, 모니터링 시스템, 성능 최적화, 운영 매뉴얼 작성',
  '① AWS 배포 완료 ② 모니터링 대시보드 구성 ③ 운영 매뉴얼 납품',
  15000000, '2025-07-01', '2025-07-31',
  'APPROVED',
  '2025-07-29 11:00:00',
  '배포 및 운영 환경 구성 완료. 모니터링 대시보드 및 운영 매뉴얼 첨부합니다.',
  'https://drive.google.com/file/d/devbridge-ops-manual',
  '2025-07-31 15:00:00',
  NOW(), NOW()
WHERE @pid_devbridge IS NOT NULL;

-- DevBridge 에스크로
SET @d1 = (SELECT id FROM project_milestones WHERE project_id=@pid_devbridge AND seq=1 LIMIT 1);
SET @d2 = (SELECT id FROM project_milestones WHERE project_id=@pid_devbridge AND seq=2 LIMIT 1);
SET @d3 = (SELECT id FROM project_milestones WHERE project_id=@pid_devbridge AND seq=3 LIMIT 1);

INSERT INTO project_escrows
  (project_id, milestone_id, amount, payer_user_id, payee_user_id,
   status, payment_method, deposited_at, released_at, created_at, updated_at)
SELECT @pid_devbridge, @d1, 10000000, @client_id, @partner_id,
  'RELEASED', 'CARD', '2025-04-01 10:00:00', '2025-04-30 17:00:00', NOW(), NOW()
WHERE @pid_devbridge IS NOT NULL AND @d1 IS NOT NULL;

INSERT INTO project_escrows
  (project_id, milestone_id, amount, payer_user_id, payee_user_id,
   status, payment_method, deposited_at, released_at, created_at, updated_at)
SELECT @pid_devbridge, @d2, 25000000, @client_id, @partner_id,
  'RELEASED', 'CARD', '2025-05-01 10:00:00', '2025-06-30 18:00:00', NOW(), NOW()
WHERE @pid_devbridge IS NOT NULL AND @d2 IS NOT NULL;

INSERT INTO project_escrows
  (project_id, milestone_id, amount, payer_user_id, payee_user_id,
   status, payment_method, deposited_at, released_at, created_at, updated_at)
SELECT @pid_devbridge, @d3, 15000000, @client_id, @partner_id,
  'RELEASED', 'CARD', '2025-07-01 10:00:00', '2025-07-31 15:00:00', NOW(), NOW()
WHERE @pid_devbridge IS NOT NULL AND @d3 IS NOT NULL;

-- DevBridge 첨부파일
INSERT INTO project_attachments (project_id, kind, name, url, uploader_user_id, created_at)
SELECT @pid_devbridge, 'FILE', 'ERD_다이어그램_최종본.pdf',
  'https://drive.google.com/file/d/devbridge-erd-final', @partner_id, '2025-04-28 10:00:00'
WHERE @pid_devbridge IS NOT NULL;

INSERT INTO project_attachments (project_id, kind, name, url, uploader_user_id, created_at)
SELECT @pid_devbridge, 'FILE', 'AI_매칭_테스트_결과_리포트.pdf',
  'https://drive.google.com/file/d/devbridge-match-result', @partner_id, '2025-06-27 15:00:00'
WHERE @pid_devbridge IS NOT NULL;

INSERT INTO project_attachments (project_id, kind, name, url, uploader_user_id, created_at)
SELECT @pid_devbridge, 'FILE', '운영_매뉴얼_v1.0.pdf',
  'https://drive.google.com/file/d/devbridge-ops-v1', @partner_id, '2025-07-29 11:00:00'
WHERE @pid_devbridge IS NOT NULL;

INSERT INTO project_attachments (project_id, kind, name, url, uploader_user_id, created_at)
SELECT @pid_devbridge, 'LINK', 'GitHub — DevBridge Backend',
  'https://github.com/devbridge/backend', @partner_id, '2025-05-01 09:00:00'
WHERE @pid_devbridge IS NOT NULL;

INSERT INTO project_attachments (project_id, kind, name, url, uploader_user_id, created_at)
SELECT @pid_devbridge, 'LINK', '프로덕션 서비스',
  'https://devbridge.io', @partner_id, '2025-07-31 15:00:00'
WHERE @pid_devbridge IS NOT NULL;

INSERT INTO project_attachments (project_id, kind, name, url, uploader_user_id, created_at)
SELECT @pid_devbridge, 'LINK', 'AWS CloudWatch 대시보드',
  'https://cloudwatch.aws/devbridge-prod', @partner_id, '2025-07-31 16:00:00'
WHERE @pid_devbridge IS NOT NULL;

-- DevBridge 계약 모듈
INSERT INTO PROJECT_MODULES (project_id, module_key, status, data, last_modifier_id, last_modifier_name)
SELECT @pid_devbridge, 'scope', '협의완료',
  '{"text":"AI 기반 개발자-클라이언트 매칭 플랫폼. 회원가입/로그인, 프로젝트 등록, AI 추천 엔진, 실시간 채팅(Stream Chat), 계약 관리, 에스크로 결제 시스템 포함."}',
  @client_id, 'client_hylee'
WHERE @pid_devbridge IS NOT NULL;

INSERT INTO PROJECT_MODULES (project_id, module_key, status, data, last_modifier_id, last_modifier_name)
SELECT @pid_devbridge, 'deliverable', '협의완료',
  '{"text":"소스코드 전체(GitHub), ERD 다이어그램, AI 매칭 테스트 결과 리포트, Swagger API 문서, AWS 배포 완료 서비스, 운영 매뉴얼 v1.0."}',
  @client_id, 'client_hylee'
WHERE @pid_devbridge IS NOT NULL;

INSERT INTO PROJECT_MODULES (project_id, module_key, status, data, last_modifier_id, last_modifier_name)
SELECT @pid_devbridge, 'schedule', '협의완료',
  '{"text":"1단계 설계·DB: 2025.04.01~04.30 / 2단계 매칭·채팅: 05.01~06.30 / 3단계 배포·운영: 07.01~07.31. 총 4개월."}',
  @client_id, 'client_hylee'
WHERE @pid_devbridge IS NOT NULL;

INSERT INTO PROJECT_MODULES (project_id, module_key, status, data, last_modifier_id, last_modifier_name)
SELECT @pid_devbridge, 'payment', '협의완료',
  '{"text":"총 계약금액 50,000,000원. ① M1 설계 10,000,000원 ② M2 개발 25,000,000원 ③ M3 배포 15,000,000원. 마일스톤별 에스크로 정산 완료."}',
  @client_id, 'client_hylee'
WHERE @pid_devbridge IS NOT NULL;

INSERT INTO PROJECT_MODULES (project_id, module_key, status, data, last_modifier_id, last_modifier_name)
SELECT @pid_devbridge, 'revision', '협의완료',
  '{"text":"납품 후 30일 이내 발견된 버그 무상 수정. 신규 기능 추가는 별도 계약. AI 모델 재학습은 데이터 제공 조건부 협의."}',
  @client_id, 'client_hylee'
WHERE @pid_devbridge IS NOT NULL;

INSERT INTO PROJECT_MODULES (project_id, module_key, status, data, last_modifier_id, last_modifier_name)
SELECT @pid_devbridge, 'completion', '협의완료',
  '{"text":"핵심 기능 전체 정상 작동. 매칭 추천 정확도 85% 이상. API 응답 P95 500ms 이내. 결제/에스크로 오류 없음. Lighthouse 성능 90점 이상."}',
  @client_id, 'client_hylee'
WHERE @pid_devbridge IS NOT NULL;

INSERT INTO PROJECT_MODULES (project_id, module_key, status, data, last_modifier_id, last_modifier_name)
SELECT @pid_devbridge, 'terms', '협의완료',
  '{"text":"소스코드 전체 클라이언트 이관. AI 모델 가중치 포함. 3개월 무상 유지보수. 상표권/특허는 클라이언트 소유. 비밀유지 계약 별도 체결."}',
  @client_id, 'client_hylee'
WHERE @pid_devbridge IS NOT NULL;


-- ─────────────────────────────────────────
-- 결과 확인
-- ─────────────────────────────────────────
SELECT '===== 마일스톤 삽입 결과 =====' AS result;
SELECT p.title, COUNT(m.id) AS 마일스톤_수,
       SUM(m.amount) AS 총_금액,
       GROUP_CONCAT(m.title ORDER BY m.seq SEPARATOR ' → ') AS 마일스톤_목록
FROM project_milestones m
JOIN projects p ON p.id = m.project_id
WHERE m.project_id IN (@pid_festory, @pid_alpha, @pid_devbridge)
GROUP BY p.id, p.title;

SELECT '===== 첨부파일 삽입 결과 =====' AS result;
SELECT p.title, a.kind, a.name
FROM project_attachments a
JOIN projects p ON p.id = a.project_id
WHERE a.project_id IN (@pid_festory, @pid_alpha, @pid_devbridge)
ORDER BY p.title, a.kind;

SELECT '===== 계약 모듈 삽입 결과 =====' AS result;
SELECT p.title, m.module_key, m.status
FROM PROJECT_MODULES m
JOIN projects p ON p.id = m.project_id
WHERE m.project_id IN (@pid_festory, @pid_alpha, @pid_devbridge)
ORDER BY p.title, m.module_key;
