-- ========================================
-- DevBridge 테스트 데이터 삽입
-- hylee132@gmail.com (파트너) - username: hyleeyou
-- yeonalee.researcher@gmail.com (클라이언트) - username: client_hylee
-- ========================================

USE devbridge_db;

-- MySQL Workbench safe update mode 해제 (서브쿼리 DELETE 허용)
SET SQL_SAFE_UPDATES = 0;

-- ========================================
-- 기존 테스트 데이터 삭제 (재실행 시 중복 방지)
-- ========================================

-- 사용자 ID 조회 (삭제 전에 필요)
SET @hylee_user_id = (SELECT id FROM users WHERE email = 'hylee132@gmail.com');
SET @client_hylee_user_id = (SELECT id FROM users WHERE email = 'yeonalee.researcher@gmail.com');
-- FK 체크 비활성화 → 순서 무관하게 안전하게 삭제
SET FOREIGN_KEY_CHECKS = 0;

-- ⚠️ hyleeyou(파트너) / client_hylee(클라이언트) 관련 데이터 깨끗히 정리
-- (orphan 프로젝트가 남아있으면 PROJECT_MODULES 중복 에러 발생함)

-- 🔒 [2026-04-24] partner_portfolios DELETE 영구 비활성화
--    사용자가 직접 저장한 포트폴리오(id 68/69/70 등)가 사라지는 사고 방지를 위해 주석 처리.
--    재실행 시 같은 source_key 로 INSERT 가 발생하면 unique 제약 위반이 날 수 있으니
--    아래쪽 INSERT INTO partner_portfolios 블록도 함께 주석/조건부 처리해야 함.
-- DELETE FROM partner_portfolios        WHERE user_id = @hylee_user_id;
-- DELETE FROM partner_portfolios        WHERE source_project_id IN (SELECT id FROM projects WHERE user_id IN (@hylee_user_id, @client_hylee_user_id));
-- DELETE FROM partner_portfolios        WHERE source_project_id IN (
--     SELECT id FROM projects WHERE title IN (
--         'AI 기반 개인 자산 관리 플랫폼 개발',
--         '결제 시스템 고도화',
--         '모바일 뱅킹 앱 리뉴얼',
--         'Festory - 축제 정보 통합 플랫폼',
--         'Alpha-Helix - AI 단백질 구조 분석 시스템',
--         'DevBridge - 개발자 매칭 플랫폼'
--     )
-- );

DELETE FROM project_milestones        WHERE project_id IN (SELECT id FROM projects WHERE user_id IN (@hylee_user_id, @client_hylee_user_id));
DELETE FROM project_milestones        WHERE project_id IN (
    SELECT id FROM projects WHERE title IN (
        'AI 기반 개인 자산 관리 플랫폼 개발',
        '결제 시스템 고도화',
        '모바일 뱅킹 앱 리뉴얼',
        'Festory - 축제 정보 통합 플랫폼',
        'Alpha-Helix - AI 단백질 구조 분석 시스템',
        'DevBridge - 개발자 매칭 플랫폼'
    )
);

DELETE FROM project_escrows           WHERE project_id IN (SELECT id FROM projects WHERE user_id IN (@hylee_user_id, @client_hylee_user_id));
DELETE FROM project_escrows           WHERE project_id IN (
    SELECT id FROM projects WHERE title IN (
        'AI 기반 개인 자산 관리 플랫폼 개발',
        '결제 시스템 고도화',
        '모바일 뱅킹 앱 리뉴얼',
        'Festory - 축제 정보 통합 플랫폼',
        'Alpha-Helix - AI 단백질 구조 분석 시스템',
        'DevBridge - 개발자 매칭 플랫폼'
    )
);

DELETE FROM project_attachments       WHERE project_id IN (SELECT id FROM projects WHERE user_id IN (@hylee_user_id, @client_hylee_user_id) OR title IN (
    'AI 기반 개인 자산 관리 플랫폼 개발',
    '결제 시스템 고도화',
    '모바일 뱅킹 앱 리뉴얼',
    'Festory - 축제 정보 통합 플랫폼',
    'Alpha-Helix - AI 단백질 구조 분석 시스템',
    'DevBridge - 개발자 매칭 플랫폼'
));
DELETE FROM PROJECT_MODULES           WHERE project_id IN (
    SELECT id FROM projects WHERE user_id IN (@hylee_user_id, @client_hylee_user_id) OR title IN (
        'AI 기반 개인 자산 관리 플랫폼 개발',
        '결제 시스템 고도화',
        '모바일 뱅킹 앱 리뉴얼',
        'Festory - 축제 정보 통합 플랫폼',
        'Alpha-Helix - AI 단백질 구조 분석 시스템',
        'DevBridge - 개발자 매칭 플랫폼'
    )
);

DELETE FROM client_review             WHERE client_profile_id IN (SELECT id FROM client_profile WHERE user_id = @client_hylee_user_id) OR reviewer_user_id IN (@hylee_user_id, @client_hylee_user_id);
DELETE FROM partner_review            WHERE partner_profile_id IN (SELECT id FROM partner_profile WHERE user_id = @hylee_user_id) OR reviewer_user_id IN (@hylee_user_id, @client_hylee_user_id);
DELETE FROM project_application       WHERE partner_user_id = @hylee_user_id;
DELETE FROM project_application       WHERE project_id IN (SELECT id FROM projects WHERE user_id IN (@hylee_user_id, @client_hylee_user_id));
DELETE FROM project_skill_mapping     WHERE project_id IN (SELECT id FROM projects WHERE user_id IN (@hylee_user_id, @client_hylee_user_id));
DELETE FROM project_tags              WHERE project_id IN (SELECT id FROM projects WHERE user_id IN (@hylee_user_id, @client_hylee_user_id));
DELETE FROM user_interest_projects    WHERE user_id IN (@hylee_user_id, @client_hylee_user_id);
DELETE FROM user_interest_projects    WHERE project_id IN (SELECT id FROM projects WHERE user_id IN (@hylee_user_id, @client_hylee_user_id));
DELETE FROM user_interest_partners    WHERE user_id IN (@hylee_user_id, @client_hylee_user_id) OR partner_profile_id IN (SELECT id FROM partner_profile WHERE user_id = @hylee_user_id);
DELETE FROM partner_profile_stats     WHERE partner_profile_id IN (SELECT id FROM partner_profile WHERE user_id = @hylee_user_id);
DELETE FROM client_profile_stats      WHERE client_profile_id IN (SELECT id FROM client_profile WHERE user_id = @client_hylee_user_id);
DELETE FROM partner_skill             WHERE partner_profile_id IN (SELECT id FROM partner_profile WHERE user_id = @hylee_user_id);
DELETE FROM partner_profile           WHERE user_id = @hylee_user_id;
DELETE FROM client_profile            WHERE user_id = @client_hylee_user_id;
DELETE FROM projects                  WHERE user_id IN (@hylee_user_id, @client_hylee_user_id);
DELETE FROM projects                  WHERE title IN (
    'AI 기반 개인 자산 관리 플랫폼 개발',
    '결제 시스템 고도화',
    '모바일 뱅킹 앱 리뉴얼',
    'Festory - 축제 정보 통합 플랫폼',
    'Alpha-Helix - AI 단백질 구조 분석 시스템',
    'DevBridge - 개발자 매칭 플랫폼'
);
DELETE FROM user_career               WHERE user_id IN (@hylee_user_id, @client_hylee_user_id);

-- ⚠️ users 테이블은 절대 DELETE 하지 않음 (계정/로그인 토큰 유지를 위해)
--    이메일은 UNIQUE KEY이므로 ON DUPLICATE KEY UPDATE로 안전하게 갱신됨

-- FK 체크 재활성화
SET FOREIGN_KEY_CHECKS = 1;

-- ========================================
-- 1. Users 테이블에 계정 추가 (이미 있으면 스킵)
-- hylee132@gmail.com -> 파트너
INSERT INTO users (email, phone, username, password, user_type, interests, contact_email, gender, birth_date, region, profile_image_url, bank_verified, created_at, updated_at)
VALUES ('hylee132@gmail.com', '010-1234-5678', 'hyleeyou', '$2b$10$mockHashedPassword', 'PARTNER', 'React, Spring Boot, AI', 'hylee132@gmail.com', 'FEMALE', '1995-03-15', '서울시 강남구', '/images/hero_vacation.png', false, NOW(), NOW())
-- ⚠️ 사용자가 mypage에서 저장한 이미지를 덮어쓰지 않음. NULL/빈 값일 때만 기본값 설정
ON DUPLICATE KEY UPDATE
  profile_image_url = COALESCE(NULLIF(profile_image_url, ''), '/images/hero_vacation.png'),
  updated_at = NOW();

-- yeonalee.researcher@gmail.com -> 클라이언트
INSERT INTO users (email, phone, username, password, user_type, interests, contact_email, gender, birth_date, region, profile_image_url, bank_verified, created_at, updated_at)
VALUES ('yeonalee.researcher@gmail.com', '010-8765-4321', 'client_hylee', '$2b$10$mockHashedPassword', 'CLIENT', '핑테크, AI, 커머스', 'yeonalee.researcher@gmail.com', 'FEMALE', '1993-08-20', '서울시 서초구', '/images/hero_money.png', false, NOW(), NOW())
-- ⚠️ 사용자가 mypage에서 저장한 이미지를 덮어쓰지 않음. NULL/빈 값일 때만 기본값 설정
ON DUPLICATE KEY UPDATE
  profile_image_url = COALESCE(NULLIF(profile_image_url, ''), '/images/hero_money.png'),
  updated_at = NOW();


-- 사용자 ID 조회용 변수 (실제 실행 시 조회 필요)
SET @hylee_user_id = (SELECT id FROM users WHERE email = 'hylee132@gmail.com');
SET @client_hylee_user_id = (SELECT id FROM users WHERE email = 'yeonalee.researcher@gmail.com');

-- 2. Partner Profile 추가 (hylee)
INSERT IGNORE INTO partner_profile (
    user_id, title, hero_key, service_field, work_category, job_roles, partner_type,
    preferred_project_type, work_available_hours, communication_channels,
    dev_level, dev_experience, work_preference, slogan, short_bio, strength_desc, bio,
    avatar_color, salary_hour, salary_month, github_url, grade
)
VALUES (
    @hylee_user_id,
    '풀스택 개발자 & AI 엔지니어',
    'hero_default.png',
    'AI',
    'DEVELOP',
    '["프론트엔드", "백엔드", "AI/ML"]',
    'INDIVIDUAL',
    'FREELANCE',
    '["평일 오전", "평일 오후"]',
    '["슬랙", "디스코드", "카카오톡"]',
    'SENIOR_5_7Y',
    'EXP_3_5Y',
    'HYBRID',
    'React + Spring Boot + AI로 혁신적인 솔루션 제공',
    '6년차 풀스택 개발자, AI/ML 통합 전문가입니다.',
    '주요 기술: React, Spring Boot, Python | 하이브리드 | 6년 경력',
    'AI 기반 웹 애플리케이션 개발에 강점이 있습니다. 특히 LLM 통합과 실시간 데이터 처리에 전문성을 보유하고 있습니다.',
    '#60A5FA',
    50000,
    8000000,
    'https://github.com/hylee132',
    'DIAMOND'
);

SET @hylee_partner_profile_id = (SELECT id FROM partner_profile WHERE user_id = @hylee_user_id);

-- Partner Skills 추가 (AWS, C/C++, Docker, FastAPI, GCP, React, Spring Boot)
-- skill_master에 이미 존재하는 스킬들의 ID를 찾아서 연결
INSERT IGNORE INTO partner_skill (partner_profile_id, skill_id)
SELECT @hylee_partner_profile_id, id FROM skill_master WHERE name IN ('AWS', 'C/C++', 'Docker', 'FastAPI', 'GCP', 'React', 'Spring Boot', 'Python')
AND @hylee_partner_profile_id IS NOT NULL;

-- 3. Client Profile 추가 (client_hylee)
INSERT IGNORE INTO client_profile (
    user_id, client_type, slogan, short_bio, industry, grade, bio, strength_desc,
    preferred_levels, preferred_work_type, budget_min, budget_max, avg_project_budget, avatar_color, hero_key
)
VALUES (
    @client_hylee_user_id,
    'TEAM',
    '혁신적인 AI 솔루션을 만들어갑니다',
    '10년차 금융 기획자, AI 도메인 전문가입니다.',
    'AI',
    'GOLD',
    '금융 도메인에서 10년 이상의 경험을 바탕으로 혁신적인 서비스를 기획합니다.',
    'AI 기반 금융 서비스 전문',
    '["미들", "시니어"]',
    0,
    5000000,
    15000000,
    10000000,
    '#4BAA7B',
    'hero_check.png'
);

SET @client_hylee_profile_id = (SELECT id FROM client_profile WHERE user_id = @client_hylee_user_id);

-- 4. 프로젝트 3개 생성
-- 프로젝트 1: 공동 진행 (client_hylee가 의뢰, hylee가 참여)
INSERT INTO projects (
    user_id, project_type, title, slogan, slogan_sub, `desc`, service_field, grade,
    work_scope, category, visibility, budget_min, budget_max, budget_amount,
    is_partner_free, start_date_negotiable, start_date, duration_months,
    schedule_negotiable, detail_content, meeting_type, meeting_freq, meeting_tools,
    deadline, gov_support, req_tags, it_exp, collab_planning, collab_design,
    collab_publishing, collab_dev, status, avatar_color, created_at, updated_at
)
VALUES (
    @client_hylee_user_id,
    'OUTSOURCE',
    'AI 기반 개인 자산 관리 플랫폼 개발',
    '똑똑한 자산관리, AI가 도와드립니다',
    'AI 기반 개인 맞춤 투자 추천 서비스',
    'OpenAI API를 활용한 개인 맞춤형 자산 관리 및 투자 추천 서비스입니다. 사용자의 소비 패턴을 분석하여 최적의 저축 및 투자 전략을 제안합니다.',
    'AI',
    'GOLD',
    '["기획", "디자인", "개발", "배포"]',
    '["AI", "핀테크", "웹"]',
    'PUBLIC',
    5000,
    8000,
    6500,
    false,
    false,
    '2025-01-15',
    6,
    false,
    '- React + Vite 프론트엔드\n- Spring Boot 백엔드\n- OpenAI GPT-4 통합\n- 실시간 주식 데이터 연동\n- 사용자 맞춤 추천 알고리즘',
    'ONLINE',
    'WEEKLY',
    '["슬랙", "줌", "노션"]',
    '2025-07-15',
    false,
    '["AI", "핀테크", "React", "Spring Boot", "머신러닝"]',
    true,
    80,
    20,
    0,
    100,
    'IN_PROGRESS',
    '#3B82F6',
    '2024-12-01 10:00:00',
    NOW()
);

-- 프로젝트 2: client_hylee의 다른 프로젝트 (진행중)
INSERT INTO projects (
    user_id, project_type, title, slogan, `desc`, service_field, grade,
    budget_min, budget_max, budget_amount, start_date, duration_months,
    status, avatar_color, created_at, updated_at
)
VALUES (
    @client_hylee_user_id,
    'OUTSOURCE',
    '결제 시스템 고도화',
    '안전하고 빠른 결제 경험',
    '기존 결제 시스템의 보안 및 성능 개선 프로젝트입니다.',
    '핀테크',
    'GOLD',
    4000,
    6000,
    5000,
    '2025-02-01',
    4,
    'IN_PROGRESS',
    '#10B981',
    '2025-01-10 14:30:00',
    NOW()
);

-- 프로젝트 3: client_hylee의 또 다른 프로젝트 (진행중)
INSERT INTO projects (
    user_id, project_type, title, slogan, `desc`, service_field, grade,
    budget_min, budget_max, budget_amount, start_date, duration_months,
    status, avatar_color, created_at, updated_at
)
VALUES (
    @client_hylee_user_id,
    'OUTSOURCE',
    '모바일 뱅킹 앱 리뉴얼',
    '새로운 모바일 뱅킹 경험',
    'UI/UX 전면 개편 및 신규 기능 추가',
    '모바일',
    'PLATINUM',
    10000,
    15000,
    12000,
    '2025-03-01',
    8,
    'IN_PROGRESS',
    '#8B5CF6',
    '2025-02-15 09:00:00',
    NOW()
);

-- 프로젝트 ID 저장
SET @project1_id = (SELECT id FROM projects WHERE title = 'AI 기반 개인 자산 관리 플랫폼 개발' LIMIT 1);
SET @project2_id = (SELECT id FROM projects WHERE title = '결제 시스템 고도화' LIMIT 1);
SET @project3_id = (SELECT id FROM projects WHERE title = '모바일 뱅킹 앱 리뉴얼' LIMIT 1);

-- 5. 프로젝트 지원/매칭 (hylee가 project1, 2, 3에 모두 참여)
INSERT INTO project_application (
    project_id, partner_user_id, status, message, applied_at, updated_at
)
VALUES 
(
    @project1_id,
    @hylee_user_id,
    'ACCEPTED',
    '안녕하세요! AI 및 풀스택 개발 경험을 바탕으로 고품질 솔루션을 제공하겠습니다.',
    '2024-12-05 11:00:00',
    '2024-12-10 15:30:00'
),
(
    @project2_id,
    @hylee_user_id,
    'ACCEPTED',
    '결제 시스템 보안 및 성능 개선 경험이 풍부합니다. PG사 연동 및 트랜잭션 처리에 자신 있습니다!',
    '2025-01-12 09:00:00',
    '2025-01-15 14:00:00'
),
(
    @project3_id,
    @hylee_user_id,
    'ACCEPTED',
    '모바일 뱅킹 앱 개발 경험을 바탕으로 최고의 UX를 제공하겠습니다. React Native와 네이티브 통합에 전문성이 있습니다.',
    '2025-02-17 10:30:00',
    '2025-02-20 16:00:00'
);

-- ========================================
-- 5-1. PROJECT_MODULES 7개 항목 추가 (세부계약 협의용)
-- ========================================

-- 프로젝트 1: AI 기반 개인 자산 관리 플랫폼 개발
INSERT INTO PROJECT_MODULES (project_id, module_key, status, data, last_modifier_id, last_modifier_name)
VALUES 
(@project1_id, 'scope', '미확정', 
 '{"text":"React + Vite 프론트엔드, Spring Boot 백엔드, OpenAI GPT-4 API 통합. 사용자 소비 패턴 분석, 맞춤 투자 추천 알고리즘, 실시간 주식 데이터 연동, 자산 현황 대시보드 구현."}',
 @client_hylee_user_id, 'client_hylee'),
(@project1_id, 'deliverable', '미확정',
 '{"text":"GitHub 소스코드(프론트+백엔드), 배포된 웹 서비스 URL, OpenAPI 명세(Swagger), 사용자 가이드, ERD 및 시스템 아키텍처 문서, 테스트 케이스 문서."}',
 @client_hylee_user_id, 'client_hylee'),
(@project1_id, 'schedule', '미확정',
 '{"text":"1단계(기획/설계): 2025.01.15~02.05 / 2단계(핵심 개발): 02.06~05.10 / 3단계(AI 통합/테스트): 05.11~06.30 / 4단계(배포/안정화): 07.01~07.15. 총 6개월."}',
 @client_hylee_user_id, 'client_hylee'),
(@project1_id, 'payment', '미확정',
 '{"text":"총 계약금액 65,000,000원. ① 착수금(설계 완료 시) 15,000,000원 ② 중도금(핵심 기능 개발 완료 시) 30,000,000원 ③ 잔금(최종 배포 완료 시) 20,000,000원. 마일스톤 검수 후 지급."}',
 @client_hylee_user_id, 'client_hylee'),
(@project1_id, 'revision', '미확정',
 '{"text":"최종 납품 후 30일 이내 발견된 버그 무상 수정. 기능 추가 또는 UI 대폭 변경은 별도 견적. 경미한 UI 수정 2회까지 무상 포함."}',
 @client_hylee_user_id, 'client_hylee'),
(@project1_id, 'completion', '미확정',
 '{"text":"핵심 기능(자산 분석, AI 추천, 대시보드) 정상 작동. OpenAI API 응답 시간 5초 이내. 웹 페이지 로딩 속도 Lighthouse 85점 이상. 모바일 반응형 대응."}',
 @client_hylee_user_id, 'client_hylee'),
(@project1_id, 'terms', '미확정',
 '{"text":"개발 완료 후 소스코드 전체 클라이언트 이관. 2개월 무상 유지보수 및 기술 지원 포함. OpenAI API 키는 클라이언트 제공. 배포 서버는 클라이언트 계정으로 AWS 사용."}',
 @client_hylee_user_id, 'client_hylee');

-- 프로젝트 2: 결제 시스템 고도화
INSERT INTO PROJECT_MODULES (project_id, module_key, status, data, last_modifier_id, last_modifier_name)
VALUES 
(@project2_id, 'scope', '미확정',
 '{"text":"기존 결제 시스템 성능 개선 및 보안 강화. PG사 멀티 연동(토스페이먼츠, 나이스페이), 결제 취소/환불 로직 고도화, 트랜잭션 로그 모니터링 시스템 구축, 부정 결제 탐지 알고리즘 적용."}',
 @client_hylee_user_id, 'client_hylee'),
(@project2_id, 'deliverable', '미확정',
 '{"text":"개선된 결제 모듈 소스코드, API 명세서(Swagger), 부하 테스트 리포트(k6/JMeter), 보안 점검 리포트, 운영 매뉴얼, 장애 대응 가이드."}',
 @client_hylee_user_id, 'client_hylee'),
(@project2_id, 'schedule', '미확정',
 '{"text":"1단계(분석/설계): 2025.02.01~02.15 / 2단계(개발): 02.16~04.15 / 3단계(보안 테스트): 04.16~05.10 / 4단계(운영 이관): 05.11~05.30. 총 4개월."}',
 @client_hylee_user_id, 'client_hylee'),
(@project2_id, 'payment', '미확정',
 '{"text":"총 계약금액 50,000,000원. ① 착수금(분석 완료 시) 10,000,000원 ② 중도금(개발 완료 시) 25,000,000원 ③ 잔금(운영 이관 완료 시) 15,000,000원. 단계별 검수 후 지급."}',
 @client_hylee_user_id, 'client_hylee'),
(@project2_id, 'revision', '미확정',
 '{"text":"운영 이관 후 60일 이내 발견된 버그 및 성능 이슈 무상 수정. PG사 정책 변경으로 인한 추가 개발은 별도 협의."}',
 @client_hylee_user_id, 'client_hylee'),
(@project2_id, 'completion', '미확정',
 '{"text":"결제 성공률 99.5% 이상. 평균 결제 처리 시간 2초 이내. 동시 접속 1만 TPS 처리 가능. 보안 취약점 검사(OWASP) 통과."}',
 @client_hylee_user_id, 'client_hylee'),
(@project2_id, 'terms', '미확정',
 '{"text":"개발 완료 후 소스코드 및 DB 스키마 클라이언트 이관. 3개월 무상 유지보수 포함. PG사 계약 및 API 키는 클라이언트 직접 관리."}',
 @client_hylee_user_id, 'client_hylee');

-- 프로젝트 3: 모바일 뱅킹 앱 리뉴얼
INSERT INTO PROJECT_MODULES (project_id, module_key, status, data, last_modifier_id, last_modifier_name)
VALUES 
(@project3_id, 'scope', '미확정',
 '{"text":"React Native 기반 iOS/Android 앱 전면 리뉴얼. UI/UX 재설계(Figma), 계좌 조회/이체/결제 기능 고도화, 생체 인증(지문/얼굴인식), 푸시 알림, 보안 키패드, 앱 성능 최적화."}',
 @client_hylee_user_id, 'client_hylee'),
(@project3_id, 'deliverable', '미확정',
 '{"text":"iOS/Android 앱 바이너리(App Store/Play Store 배포용), React Native 소스코드, Figma 디자인 파일, API 연동 문서, 앱 테스트 리포트, 운영 가이드."}',
 @client_hylee_user_id, 'client_hylee'),
(@project3_id, 'schedule', '미확정',
 '{"text":"1단계(디자인): 2025.03.01~03.31 / 2단계(UI 구현): 04.01~06.15 / 3단계(기능 개발): 06.16~09.10 / 4단계(테스트/배포): 09.11~10.31. 총 8개월."}',
 @client_hylee_user_id, 'client_hylee'),
(@project3_id, 'payment', '미확정',
 '{"text":"총 계약금액 120,000,000원. ① 착수금(디자인 완료 시) 30,000,000원 ② 중도금 1차(UI 구현 완료 시) 40,000,000원 ③ 중도금 2차(기능 개발 완료 시) 30,000,000원 ④ 잔금(스토어 배포 완료 시) 20,000,000원."}',
 @client_hylee_user_id, 'client_hylee'),
(@project3_id, 'revision', '미확정',
 '{"text":"스토어 배포 후 90일 이내 크리티컬 버그 무상 수정. 디자인 변경 2회까지 무상. OS 버전 업데이트 대응(1년) 포함."}',
 @client_hylee_user_id, 'client_hylee'),
(@project3_id, 'completion', '미확정',
 '{"text":"핵심 기능(계좌조회, 이체, 결제, 생체인증) 정상 작동. iOS/Android 스토어 심사 통과. 앱 크래시율 0.1% 이하. 로딩 속도 3초 이내."}',
 @client_hylee_user_id, 'client_hylee'),
(@project3_id, 'terms', '미확정',
 '{"text":"개발 완료 후 소스코드 및 디자인 파일 전체 이관. 1년 무상 유지보수 및 OS 업데이트 대응 포함. 스토어 개발자 계정은 클라이언트 제공."}',
 @client_hylee_user_id, 'client_hylee');

-- ========================================
-- UNIQUE 제약 변경: 리뷰는 (대상, 리뷰어, 프로젝트) 조합으로 유니크
-- (같은 리뷰어가 여러 프로젝트에 대해 각각 리뷰 작성 가능하도록)
-- 재실행 안전: (profile_id, reviewer_user_id) 2컬럼 UNIQUE 인덱스를 동적으로 모두 drop
-- ========================================
SET @db := DATABASE();

-- partner_review: (partner_profile_id, reviewer_user_id)로만 구성된 2컬럼 UNIQUE 인덱스 찾아서 모두 drop
DROP PROCEDURE IF EXISTS _drop_partner_review_2col_unique;
DELIMITER //
CREATE PROCEDURE _drop_partner_review_2col_unique()
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE iname VARCHAR(64);
  DECLARE cur CURSOR FOR
    SELECT index_name FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'partner_review' AND non_unique = 0
       AND index_name <> 'PRIMARY'
     GROUP BY index_name
    HAVING GROUP_CONCAT(column_name ORDER BY seq_in_index) = 'partner_profile_id,reviewer_user_id';
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;
  OPEN cur;
  read_loop: LOOP
    FETCH cur INTO iname;
    IF done THEN LEAVE read_loop; END IF;
    SET @sql := CONCAT('ALTER TABLE partner_review DROP INDEX `', iname, '`');
    PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END LOOP;
  CLOSE cur;
END//
DELIMITER ;
CALL _drop_partner_review_2col_unique();
DROP PROCEDURE _drop_partner_review_2col_unique;

-- partner_review: 새 (partner_profile_id, reviewer_user_id, project_id) 인덱스 추가 (없을 때만)
SET @idx := (SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = @db AND table_name = 'partner_review'
      AND index_name = 'uk_partner_review_partner_reviewer_proj');
SET @sql := IF(@idx = 0, 'ALTER TABLE partner_review ADD UNIQUE KEY uk_partner_review_partner_reviewer_proj (partner_profile_id, reviewer_user_id, project_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- client_review: (client_profile_id, reviewer_user_id)로만 구성된 2컬럼 UNIQUE 인덱스 찾아서 모두 drop
DROP PROCEDURE IF EXISTS _drop_client_review_2col_unique;
DELIMITER //
CREATE PROCEDURE _drop_client_review_2col_unique()
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE iname VARCHAR(64);
  DECLARE cur CURSOR FOR
    SELECT index_name FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'client_review' AND non_unique = 0
       AND index_name <> 'PRIMARY'
     GROUP BY index_name
    HAVING GROUP_CONCAT(column_name ORDER BY seq_in_index) = 'client_profile_id,reviewer_user_id';
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;
  OPEN cur;
  read_loop: LOOP
    FETCH cur INTO iname;
    IF done THEN LEAVE read_loop; END IF;
    SET @sql := CONCAT('ALTER TABLE client_review DROP INDEX `', iname, '`');
    PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END LOOP;
  CLOSE cur;
END//
DELIMITER ;
CALL _drop_client_review_2col_unique();
DROP PROCEDURE _drop_client_review_2col_unique;

-- client_review: 새 (client_profile_id, reviewer_user_id, project_id) 인덱스 추가 (없을 때만)
SET @idx := (SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = @db AND table_name = 'client_review'
      AND index_name = 'uk_client_review_client_reviewer_proj');
SET @sql := IF(@idx = 0, 'ALTER TABLE client_review ADD UNIQUE KEY uk_client_review_client_reviewer_proj (client_profile_id, reviewer_user_id, project_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6. 파트너 리뷰 (client_hylee가 hylee에게) - project1만 먼저 작성, 나머지 portfolio 프로젝트 리뷰는 아래쪽에서
INSERT INTO partner_review (partner_profile_id, reviewer_user_id, project_id, rating, content, created_at)
VALUES
(@hylee_partner_profile_id, @client_hylee_user_id, @project1_id, 5.0, '정말 훌륭한 파트너였습니다! 기술력과 커뮤니케이션 모두 완벽했어요. AI 통합 부분에서 특히 전문성이 돋보였고, 일정도 철저히 지켜주셨습니다.', '2025-01-20 14:00:00');

-- 7. 클라이언트 리뷰 (hylee가 client_hylee에게) - project1만 먼저 작성
INSERT INTO client_review (client_profile_id, reviewer_user_id, project_id, rating, content, created_at)
VALUES
(@client_hylee_profile_id, @hylee_user_id, @project1_id, 5.0, '요구사항이 명확하고 의사결정이 빨라서 작업하기 좋았습니다! 도메인 지식이 풍부해 많은 도움이 되었고, 피드백도 구체적이고 건설적이었습니다.', '2025-01-21 10:00:00');

-- 8. Partner Profile Stats 업데이트
INSERT INTO partner_profile_stats (
    partner_profile_id, experience_years, rating, completed_projects,
    response_rate, repeat_rate, availability_days
)
VALUES (
    @hylee_partner_profile_id,
    6,
    4.91,
    12,
    95,
    80,
    30
)
ON DUPLICATE KEY UPDATE
    rating = 4.91,
    completed_projects = 12;

-- 9. Client Profile Stats 업데이트
INSERT INTO client_profile_stats (
    client_profile_id, rating, completed_projects, posted_projects, repeat_rate
)
VALUES (
    @client_hylee_profile_id,
    4.91,
    8,
    12,
    75
)
ON DUPLICATE KEY UPDATE
    rating = 4.91,
    completed_projects = 8,
    posted_projects = 12;

-- 완료 메시지
SELECT 'Test data inserted successfully!' AS Status;

-- ========================================
-- 완료된 프로젝트 3개 추가 (포트폴리오용)
-- client_hylee가 클라이언트, hylee가 파트너로 참여
-- ========================================

-- 프로젝트 4: Festory (완료된 프로젝트)
INSERT INTO projects (
    user_id, project_type, title, slogan, slogan_sub, `desc`, service_field, grade,
    work_scope, category, visibility, budget_min, budget_max, budget_amount,
    start_date, duration_months, status, avatar_color, created_at, updated_at
)
VALUES (
    @client_hylee_user_id,
    'OUTSOURCE',
    'Festory',
    '축제 정보 통합 플랫폼',
    '위치 기반 추천 · 실시간 업데이트',
    '전국의 축제 정보를 한 곳에서 확인하고 공유할 수 있는 통합 플랫폼입니다. 사용자 위치 기반 추천과 실시간 업데이트를 제공합니다.',
    'AI',
    'PLATINUM',
    '["기획", "디자인", "개발", "배포"]',
    '["웹", "모바일"]',
    'PUBLIC',
    5000,
    8000,
    6500,
    '2024-03-01',
    6,
    'COMPLETED',
    '#F97316',
    '2024-03-01 10:00:00',
    '2024-09-01 18:00:00'
);

SET @festory_project_id = LAST_INSERT_ID();
SET @festory_source_key = CONCAT('project-', @festory_project_id);

-- 프로젝트 5: Alpha-Helix (완료된 프로젝트)
INSERT INTO projects (
    user_id, project_type, title, slogan, slogan_sub, `desc`, service_field, grade,
    work_scope, category, visibility, budget_min, budget_max, budget_amount,
    start_date, duration_months, status, avatar_color, created_at, updated_at
)
VALUES (
    @client_hylee_user_id,
    'OUTSOURCE',
    'Alpha-Helix',
    '단백질 구조 분석 AI 플랫폼',
    'AlphaFold 기반 생명과학 연구 도구',
    'AI 기반 단백질 구조 예측 및 분석 도구입니다. AlphaFold 알고리즘을 활용하여 생명과학 연구를 지원합니다.',
    'AI',
    'DIAMOND',
    '["기획", "개발", "배포"]',
    '["AI", "바이오", "웹"]',
    'PUBLIC',
    12000,
    18000,
    15000,
    '2024-06-01',
    4,
    'COMPLETED',
    '#3B82F6',
    '2024-06-01 09:00:00',
    '2024-10-01 17:00:00'
);

SET @alpha_helix_project_id = LAST_INSERT_ID();
SET @alpha_helix_source_key = CONCAT('project-', @alpha_helix_project_id);

-- 프로젝트 6: DevBridge Platform (완료된 프로젝트)
INSERT INTO projects (
    user_id, project_type, title, slogan, slogan_sub, `desc`, service_field, grade,
    work_scope, category, visibility, budget_min, budget_max, budget_amount,
    start_date, duration_months, status, avatar_color, created_at, updated_at
)
VALUES (
    @client_hylee_user_id,
    'OUTSOURCE',
    'DevBridge Platform',
    '개발자와 클라이언트를 연결하는 매칭 플랫폼',
    'AI 매칭 · 실시간 채팅 · 포트폴리오 관리',
    'AI 기반 개발자-클라이언트 매칭 플랫폼. 프로젝트 추천, 실시간 채팅, 포트폴리오 관리 기능을 제공합니다.',
    'AI',
    'PLATINUM',
    '["기획", "디자인", "개발", "배포"]',
    '["AI", "웹", "SaaS"]',
    'PUBLIC',
    18000,
    25000,
    21000,
    '2024-09-01',
    5,
    'COMPLETED',
    '#10B981',
    '2024-09-01 10:00:00',
    '2025-02-01 18:00:00'
);

SET @devbridge_project_id = LAST_INSERT_ID();
SET @devbridge_source_key = CONCAT('project-', @devbridge_project_id);

-- ========================================
-- 프로젝트 지원 내역 추가 (hylee가 완료된 프로젝트 3개에 참여)
-- ========================================

INSERT INTO project_application (project_id, partner_user_id, status, message, applied_at, updated_at)
VALUES
(@festory_project_id, @hylee_user_id, 'COMPLETED', '축제 정보 플랫폼 개발 경험을 바탕으로 최상의 결과를 제공하겠습니다.', '2024-02-20 10:00:00', '2024-09-01 18:00:00'),
(@alpha_helix_project_id, @hylee_user_id, 'COMPLETED', 'AI/ML 전문성을 바탕으로 단백질 구조 분석 플랫폼을 구현하겠습니다.', '2024-05-15 09:00:00', '2024-10-01 17:00:00'),
(@devbridge_project_id, @hylee_user_id, 'COMPLETED', '풀스택 개발 및 AI 통합 경험으로 매칭 플랫폼을 완성하겠습니다.', '2024-08-20 14:00:00', '2025-02-01 18:00:00');

-- ========================================
-- 프로젝트 태그 추가 (각 프로젝트별 주요 기술/키워드)
-- ========================================
INSERT INTO project_tags (project_id, tag) VALUES
-- AI 자산관리
(@project1_id, '#React'), (@project1_id, '#SpringBoot'), (@project1_id, '#Python'), (@project1_id, '#OpenAI'), (@project1_id, '#ML'),
-- 결제 시스템
(@project2_id, '#Spring'), (@project2_id, '#보안'), (@project2_id, '#결제'), (@project2_id, '#핀테크'),
-- 모바일 뱅킹
(@project3_id, '#ReactNative'), (@project3_id, '#UIUX'), (@project3_id, '#모바일'), (@project3_id, '#뱅킹'),
-- Festory
(@festory_project_id, '#React'), (@festory_project_id, '#NodeJS'), (@festory_project_id, '#MongoDB'), (@festory_project_id, '#Redis'),
-- Alpha-Helix
(@alpha_helix_project_id, '#Python'), (@alpha_helix_project_id, '#TensorFlow'), (@alpha_helix_project_id, '#FastAPI'), (@alpha_helix_project_id, '#AI'),
-- DevBridge
(@devbridge_project_id, '#React'), (@devbridge_project_id, '#SpringBoot'), (@devbridge_project_id, '#MySQL'), (@devbridge_project_id, '#OpenAI'), (@devbridge_project_id, '#WebSocket');

-- ========================================
-- 완료된 프로젝트 3개의 PROJECT_MODULES 7개 항목 추가 (협의완료 상태)
-- ========================================

-- Festory
INSERT INTO PROJECT_MODULES (project_id, module_key, status, data, last_modifier_id, last_modifier_name)
VALUES 
(@festory_project_id, 'scope', '협의완료',
 '{"text":"React + Node.js 기반 전국 축제 정보 통합 플랫폼. 위치 기반 추천 시스템, 실시간 축제 정보 업데이트, 지도 기반 UI, 즐겨찾기 기능, 후기 및 사진 업로드, 외부 축제 API 연동."}',
 @client_hylee_user_id, 'client_hylee'),
(@festory_project_id, 'deliverable', '협의완료',
 '{"text":"GitHub 소스코드(프론트+백엔드), 배포된 웹 서비스 URL, API 문서(Swagger), MongoDB 스키마 문서, 운영 가이드, 사용자 매뉴얼."}',
 @client_hylee_user_id, 'client_hylee'),
(@festory_project_id, 'schedule', '협의완료',
 '{"text":"1단계(기획/설계): 2024.03.01~03.20 / 2단계(핵심 개발): 03.21~07.15 / 3단계(테스트/배포): 07.16~08.31. 총 6개월."}',
 @client_hylee_user_id, 'client_hylee'),
(@festory_project_id, 'payment', '협의완료',
 '{"text":"총 계약금액 65,000,000원. ① 착수금 15,000,000원 ② 중도금 35,000,000원 ③ 잔금 15,000,000원. 마일스톤별 검수 후 지급 완료."}',
 @client_hylee_user_id, 'client_hylee'),
(@festory_project_id, 'revision', '협의완료',
 '{"text":"납품 후 30일 이내 발견된 버그 무상 수정 완료. 경미한 UI 수정 2회 무상 포함 완료."}',
 @client_hylee_user_id, 'client_hylee'),
(@festory_project_id, 'completion', '협의완료',
 '{"text":"핵심 기능(위치 기반 추천, 검색, 상세 페이지) 정상 작동 확인. Lighthouse 성능 85점 달성. 크로스 브라우저 호환성 완료."}',
 @client_hylee_user_id, 'client_hylee'),
(@festory_project_id, 'terms', '협의완료',
 '{"text":"소스코드 전체 클라이언트 이관 완료. 2개월 무상 유지보수 완료. 외부 API 키 클라이언트 측 발급 및 적용 완료."}',
 @client_hylee_user_id, 'client_hylee');

-- Alpha-Helix
INSERT INTO PROJECT_MODULES (project_id, module_key, status, data, last_modifier_id, last_modifier_name)
VALUES 
(@alpha_helix_project_id, 'scope', '협의완료',
 '{"text":"Python + TensorFlow 기반 AI 단백질 구조 예측 플랫폼. AlphaFold 알고리즘 통합, 3D 구조 시각화(Three.js), 배치 처리 시스템, FastAPI 백엔드, React 프론트엔드."}',
 @client_hylee_user_id, 'client_hylee'),
(@alpha_helix_project_id, 'deliverable', '협의완료',
 '{"text":"GitHub 소스코드(AI 모델 + 백엔드 + 프론트), 배포된 웹 서비스, API 문서, Docker 컨테이너, GPU 서버 설정 가이드, 사용자 매뉴얼."}',
 @client_hylee_user_id, 'client_hylee'),
(@alpha_helix_project_id, 'schedule', '협의완료',
 '{"text":"1단계(설계): 2024.06.01~06.20 / 2단계(AI 모델 통합): 06.21~08.10 / 3단계(3D 시각화): 08.11~09.15 / 4단계(배포): 09.16~09.30. 총 4개월."}',
 @client_hylee_user_id, 'client_hylee'),
(@alpha_helix_project_id, 'payment', '협의완료',
 '{"text":"총 계약금액 150,000,000원. ① 착수금 40,000,000원 ② 중도금 70,000,000원 ③ 잔금 40,000,000원. 마일스톤별 검수 후 지급 완료."}',
 @client_hylee_user_id, 'client_hylee'),
(@alpha_helix_project_id, 'revision', '협의완료',
 '{"text":"납품 후 60일 이내 발견된 버그 및 성능 이슈 무상 수정 완료. AI 모델 정확도 개선 1회 무상 포함 완료."}',
 @client_hylee_user_id, 'client_hylee'),
(@alpha_helix_project_id, 'completion', '협의완료',
 '{"text":"AI 구조 예측 정확도 95% 이상 달성. 3D 렌더링 60fps 유지. GPU 서버 비동기 처리 안정화 완료."}',
 @client_hylee_user_id, 'client_hylee'),
(@alpha_helix_project_id, 'terms', '협의완료',
 '{"text":"소스코드 및 AI 모델 전체 클라이언트 이관 완료. 3개월 무상 유지보수 및 기술 지원 완료. GPU 서버는 클라이언트 계정 사용."}',
 @client_hylee_user_id, 'client_hylee');

-- DevBridge Platform
INSERT INTO PROJECT_MODULES (project_id, module_key, status, data, last_modifier_id, last_modifier_name)
VALUES 
(@devbridge_project_id, 'scope', '협의완료',
 '{"text":"React + Spring Boot 기반 개발자-클라이언트 매칭 플랫폼. OpenAI 기반 AI 매칭 알고리즘, WebSocket 실시간 채팅, 포트폴리오 관리, GitHub 연동, 프로젝트 관리, 결제 시스템."}',
 @client_hylee_user_id, 'client_hylee'),
(@devbridge_project_id, 'deliverable', '협의완료',
 '{"text":"GitHub 소스코드(프론트+백엔드), AWS 배포 환경, API 문서(Swagger), ERD 및 시스템 아키텍처 문서, Redis 설정 가이드, 운영 매뉴얼."}',
 @client_hylee_user_id, 'client_hylee'),
(@devbridge_project_id, 'schedule', '협의완료',
 '{"text":"1단계(기획/설계): 2024.09.01~09.30 / 2단계(핵심 개발): 10.01~12.20 / 3단계(AI 매칭): 12.21~01.15 / 4단계(테스트/배포): 01.16~01.31. 총 5개월."}',
 @client_hylee_user_id, 'client_hylee'),
(@devbridge_project_id, 'payment', '협의완료',
 '{"text":"총 계약금액 210,000,000원. ① 착수금 50,000,000원 ② 중도금 1차 80,000,000원 ③ 중도금 2차 50,000,000원 ④ 잔금 30,000,000원. 마일스톤별 검수 후 지급 완료."}',
 @client_hylee_user_id, 'client_hylee'),
(@devbridge_project_id, 'revision', '협의완료',
 '{"text":"배포 후 90일 이내 발견된 버그 무상 수정 완료. AI 매칭 알고리즘 개선 2회 무상 포함 완료."}',
 @client_hylee_user_id, 'client_hylee'),
(@devbridge_project_id, 'completion', '협의완료',
 '{"text":"핵심 기능(AI 매칭, 실시간 채팅, 포트폴리오 관리) 정상 작동 완료. 동시 접속 1만 명 처리 성능 달성. OpenAI API 응답 시간 3초 이내."}',
 @client_hylee_user_id, 'client_hylee'),
(@devbridge_project_id, 'terms', '협의완료',
 '{"text":"소스코드 전체 클라이언트 이관 완료. 6개월 무상 유지보수 및 AWS 인프라 관리 포함 완료. OpenAI API 키 클라이언트 제공."}',
 @client_hylee_user_id, 'client_hylee');

-- ========================================
-- 완료된 프로젝트 3개의 마일스톤 추가 (각 3개씩, APPROVED 상태)
-- ========================================

-- Festory 마일스톤 (2024.03~2024.09)
INSERT INTO project_milestones
  (project_id, seq, title, description, completion_criteria, amount,
   start_date, end_date, status,
   submitted_at, submission_note, submission_file_url, approved_at,
   created_at, updated_at)
VALUES
(@festory_project_id, 1, '기획 및 요구사항 분석',
 '서비스 기획서 작성, 사용자 스토리 정의, UI/UX 와이어프레임 초안 제작',
 '① 요구사항 정의서 PDF 납품 ② 와이어프레임 Figma 링크 공유 ③ 클라이언트 검토 완료',
 20000000, '2024-03-01', '2024-04-15',
 'APPROVED',
 '2024-04-13 10:30:00',
 'Festory 기획서 및 와이어프레임 최종본 제출드립니다. Figma 링크 첨부했습니다.',
 'https://drive.google.com/file/d/festory-planning-v1',
 '2024-04-15 14:00:00',
 NOW(), NOW()),
(@festory_project_id, 2, '핵심 기능 개발',
 '축제 정보 등록/조회 API 구현, 위치 기반 추천 알고리즘, 지도 연동, MongoDB 구축',
 '① API 문서(Swagger) 제공 ② 단위 테스트 커버리지 80% 이상 ③ 스테이징 서버 배포',
 30000000, '2024-04-16', '2024-07-31',
 'APPROVED',
 '2024-07-29 17:00:00',
 '핵심 API 개발 완료 및 테스트 리포트 첨부했습니다. 위치 기반 추천 시스템 구현 완료.',
 'https://drive.google.com/file/d/festory-api-report',
 '2024-07-31 11:00:00',
 NOW(), NOW()),
(@festory_project_id, 3, '최종 테스트 및 배포',
 'QA 전체 테스트, 성능 최적화, 프로덕션 배포, 운영 가이드 문서화',
 '① 버그 0건(Critical) ② Lighthouse 성능 85점 이상 ③ 운영 가이드 문서 납품',
 15000000, '2024-08-01', '2024-08-31',
 'APPROVED',
 '2024-08-29 09:00:00',
 'QA 완료 및 프로덕션 배포 완료했습니다. 운영 가이드 문서 첨부합니다.',
 'https://drive.google.com/file/d/festory-deploy-guide',
 '2024-08-31 16:30:00',
 NOW(), NOW());

-- Alpha-Helix 마일스톤 (2024.06~2024.10)
INSERT INTO project_milestones
  (project_id, seq, title, description, completion_criteria, amount,
   start_date, end_date, status,
   submitted_at, submission_note, submission_file_url, approved_at,
   created_at, updated_at)
VALUES
(@alpha_helix_project_id, 1, '시스템 아키텍처 설계',
 'AI 모델 아키텍처 설계, DB 스키마 정의, GPU 인프라 구성도, 기술 스택 확정',
 '① 아키텍처 설계서 납품 ② ERD 다이어그램 포함 ③ GPU 서버 설정 문서 작성',
 50000000, '2024-06-01', '2024-06-30',
 'APPROVED',
 '2024-06-28 11:00:00',
 'Alpha-Helix 시스템 아키텍처 설계 완료 및 ERD 포함 문서 제출합니다.',
 'https://drive.google.com/file/d/alpha-arch-doc',
 '2024-06-30 15:00:00',
 NOW(), NOW()),
(@alpha_helix_project_id, 2, 'AI 모델 통합 및 백엔드 API 구현',
 'AlphaFold 모델 통합, FastAPI 백엔드 구현, 배치 처리 시스템, GPU 비동기 처리',
 '① AI 모델 예측 정확도 95% 이상 ② API 문서 제공 ③ 통합 테스트 통과',
 60000000, '2024-07-01', '2024-09-15',
 'APPROVED',
 '2024-09-13 14:30:00',
 'AI 모델 통합 완료 및 백엔드 API 구현 완료. 예측 정확도 96% 달성했습니다.',
 'https://drive.google.com/file/d/alpha-api-report',
 '2024-09-15 10:00:00',
 NOW(), NOW()),
(@alpha_helix_project_id, 3, '3D 시각화 및 최종 배포',
 'Three.js 기반 3D 단백질 구조 뷰어, WebGL 최적화, 프로덕션 배포, 사용자 매뉴얼',
 '① 3D 렌더링 60fps 유지 ② 크로스 브라우저 호환성 ③ Docker 컨테이너 배포',
 40000000, '2024-09-16', '2024-10-01',
 'APPROVED',
 '2024-09-30 16:00:00',
 '3D 시각화 완료 및 프로덕션 배포 완료. 사용자 매뉴얼 첨부합니다.',
 'https://drive.google.com/file/d/alpha-deploy-guide',
 '2024-10-01 17:00:00',
 NOW(), NOW());

-- DevBridge Platform 마일스톤 (2024.09~2025.02)
INSERT INTO project_milestones
  (project_id, seq, title, description, completion_criteria, amount,
   start_date, end_date, status,
   submitted_at, submission_note, submission_file_url, approved_at,
   created_at, updated_at)
VALUES
(@devbridge_project_id, 1, '시스템 설계 및 기반 구축',
 '전체 시스템 아키텍처 설계, DB 스키마 설계, AWS 인프라 구성, 기술 스택 확정',
 '① 아키텍처 문서 납품 ② ERD 및 API 설계서 ③ AWS 인프라 구성도',
 60000000, '2024-09-01', '2024-10-15',
 'APPROVED',
 '2024-10-13 10:00:00',
 'DevBridge 시스템 설계 및 ERD 문서 제출합니다. AWS 인프라 구성 완료.',
 'https://drive.google.com/file/d/devbridge-arch-doc',
 '2024-10-15 14:00:00',
 NOW(), NOW()),
(@devbridge_project_id, 2, '핵심 기능 개발 및 AI 매칭 구현',
 'REST API 전체 구현, OpenAI 기반 AI 매칭 알고리즘, WebSocket 실시간 채팅, 포트폴리오 관리',
 '① API 문서(Swagger) 제공 ② AI 매칭 정확도 90% 이상 ③ 실시간 채팅 안정화',
 100000000, '2024-10-16', '2025-01-15',
 'APPROVED',
 '2025-01-13 15:00:00',
 '핵심 기능 개발 완료. AI 매칭 알고리즘 정확도 92% 달성. WebSocket 채팅 안정화 완료.',
 'https://drive.google.com/file/d/devbridge-api-report',
 '2025-01-15 11:00:00',
 NOW(), NOW()),
(@devbridge_project_id, 3, '통합 테스트 및 프로덕션 배포',
 '전체 통합 테스트, 성능 테스트(부하 테스트), AWS 프로덕션 배포, 운영 가이드 작성',
 '① 동시 접속 1만 명 처리 성능 ② 버그 0건(Critical) ③ 운영 매뉴얼 납품',
 50000000, '2025-01-16', '2025-02-01',
 'APPROVED',
 '2025-01-31 16:00:00',
 '통합 테스트 및 프로덕션 배포 완료. 성능 테스트 통과(동시 접속 12,000명). 운영 가이드 첨부.',
 'https://drive.google.com/file/d/devbridge-deploy-guide',
 '2025-02-01 18:00:00',
 NOW(), NOW());

-- ========================================
-- 완료된 프로젝트의 에스크로 항목 추가 (정산 완료 상태)
-- ========================================

-- Festory 에스크로 (3개 마일스톤, 모두 RELEASED 상태)
INSERT INTO project_escrows (
    project_id, milestone_id, amount, payer_user_id, payee_user_id,
    status, payment_method, payment_tx_id,
    deposited_at, released_at, created_at, updated_at
)
SELECT 
    @festory_project_id,
    pm.id,
    pm.amount,
    @client_hylee_user_id,
    @hylee_user_id,
    'RELEASED',
    'CARD_MOCK',
    CONCAT('MOCK-TX-', LPAD(pm.seq, 3, '0'), '-FESTORY'),
    DATE_ADD(pm.start_date, INTERVAL 1 DAY),
    pm.approved_at,
    pm.created_at,
    pm.updated_at
FROM project_milestones pm
WHERE pm.project_id = @festory_project_id;

-- Alpha-Helix 에스크로 (3개 마일스톤, 모두 RELEASED 상태)
INSERT INTO project_escrows (
    project_id, milestone_id, amount, payer_user_id, payee_user_id,
    status, payment_method, payment_tx_id,
    deposited_at, released_at, created_at, updated_at
)
SELECT 
    @alpha_helix_project_id,
    pm.id,
    pm.amount,
    @client_hylee_user_id,
    @hylee_user_id,
    'RELEASED',
    'CARD_MOCK',
    CONCAT('MOCK-TX-', LPAD(pm.seq, 3, '0'), '-ALPHA'),
    DATE_ADD(pm.start_date, INTERVAL 1 DAY),
    pm.approved_at,
    pm.created_at,
    pm.updated_at
FROM project_milestones pm
WHERE pm.project_id = @alpha_helix_project_id;

-- DevBridge 에스크로 (3개 마일스톤, 모두 RELEASED 상태)
INSERT INTO project_escrows (
    project_id, milestone_id, amount, payer_user_id, payee_user_id,
    status, payment_method, payment_tx_id,
    deposited_at, released_at, created_at, updated_at
)
SELECT 
    @devbridge_project_id,
    pm.id,
    pm.amount,
    @client_hylee_user_id,
    @hylee_user_id,
    'RELEASED',
    'CARD_MOCK',
    CONCAT('MOCK-TX-', LPAD(pm.seq, 3, '0'), '-DEVBRIDGE'),
    DATE_ADD(pm.start_date, INTERVAL 1 DAY),
    pm.approved_at,
    pm.created_at,
    pm.updated_at
FROM project_milestones pm
WHERE pm.project_id = @devbridge_project_id;

-- ========================================
-- 완료된 프로젝트별 리뷰 (client_hylee ↔ hylee 상호 평가)
-- ========================================

-- 파트너 리뷰 (client_hylee → hylee): festory, alpha-helix, devbridge 프로젝트별로
INSERT INTO partner_review (partner_profile_id, reviewer_user_id, project_id, rating, content, created_at)
VALUES
(@hylee_partner_profile_id, @client_hylee_user_id, @festory_project_id, 4.9, 'Festory 프로젝트에서 위치 기반 추천 알고리즘을 훌륭하게 구현해주셨습니다. MongoDB 활용 능력이 인상적이었어요.', '2024-09-05 14:00:00'),
(@hylee_partner_profile_id, @client_hylee_user_id, @alpha_helix_project_id, 5.0, 'Alpha-Helix의 AI 모델 통합 작업이 정말 완벽했습니다. 복잡한 단백질 구조 시각화도 부드럽게 동작합니다.', '2024-10-10 11:30:00'),
(@hylee_partner_profile_id, @client_hylee_user_id, @devbridge_project_id, 5.0, 'DevBridge 플랫폼 전체를 책임감 있게 완성해주셨습니다. OpenAI 매칭 알고리즘 설계가 특히 뛰어났어요.', '2025-02-10 16:00:00');

-- 클라이언트 리뷰 (hylee → client_hylee): festory, alpha-helix, devbridge 프로젝트별로
INSERT INTO client_review (client_profile_id, reviewer_user_id, project_id, rating, content, created_at)
VALUES
(@client_hylee_profile_id, @hylee_user_id, @festory_project_id, 4.8, 'Festory 기획이 명확해서 작업하기 좋았습니다. 사용자 시나리오에 대한 인사이트가 풍부했어요.', '2024-09-06 10:00:00'),
(@client_hylee_profile_id, @hylee_user_id, @alpha_helix_project_id, 5.0, 'Alpha-Helix는 도메인 지식이 깊은 클라이언트와 협업해서 최고의 결과물을 만들 수 있었습니다.', '2024-10-11 13:00:00'),
(@client_hylee_profile_id, @hylee_user_id, @devbridge_project_id, 5.0, 'DevBridge 비전을 명확히 제시해주셔서 개발에 집중할 수 있었습니다. 다음에도 꼭 함께 일하고 싶습니다!', '2025-02-12 15:30:00');

-- ========================================
-- 포트폴리오 항목 추가
-- ========================================

-- 포트폴리오 1: Festory
INSERT INTO partner_portfolios (
    user_id, source_key, source_project_id, title, period, role,
    thumbnail_url, work_content, vision, core_features, technical_challenge, solution,
    tech_tags, github_url, live_url, sections_json, is_added, is_public, created_at, updated_at
)
VALUES (
    @hylee_user_id,
    @festory_source_key,
    @festory_project_id,
    'Festory - 축제 정보 통합 플랫폼',
    '2024.03 - 2024.09 (6개월)',
    'Full-stack Developer & Tech Lead',
    '/portfolio/festory_thumb.png',
    '전국의 다양한 축제 정보를 한 곳에서 확인하고 공유할 수 있는 통합 플랫폼을 개발했습니다. 사용자 위치 기반 추천 시스템과 실시간 축제 정보 업데이트 기능을 구현하여 사용자 경험을 극대화했습니다.',
    '축제를 사랑하는 모든 사람들이 쉽게 정보를 찾고 공유할 수 있는 플랫폼을 만들고자 했습니다.',
    '[{"title":"위치 기반 추천","desc":"GPS를 활용한 주변 축제 자동 추천"},{"title":"실시간 업데이트","desc":"축제 정보 실시간 반영 및 알림"},{"title":"커뮤니티 기능","desc":"후기 공유 및 사진 업로드"}]',
    '대량의 축제 데이터를 실시간으로 처리하고, 사용자 위치 기반 최적화된 추천을 제공하는 것이 가장 큰 기술적 과제였습니다.',
    'MongoDB를 활용한 비정형 데이터 저장, Redis 캐싱으로 응답 속도 개선, Geospatial 쿼리를 통한 위치 기반 검색 최적화를 구현했습니다.',
    '["React","Node.js","MongoDB","Redis","Express","Google Maps API"]',
    'https://github.com/hylee/festory',
    'https://festory.demo.com',
    '{"workContent":true,"vision":true,"coreFeatures":true,"technicalChallenge":true,"solution":true}',
    true,
    true,
    '2024-09-15 10:00:00',
    NOW()
);

-- 포트폴리오 2: Alpha-Helix
INSERT INTO partner_portfolios (
    user_id, source_key, source_project_id, title, period, role,
    thumbnail_url, work_content, vision, core_features, technical_challenge, solution,
    tech_tags, github_url, live_url, sections_json, is_added, is_public, created_at, updated_at
)
VALUES (
    @hylee_user_id,
    @alpha_helix_source_key,
    @alpha_helix_project_id,
    'Alpha-Helix - AI 단백질 구조 분석',
    '2024.06 - 2024.10 (4개월)',
    'AI/ML Engineer & Backend Developer',
    '/portfolio/alpha_helix_thumb.png',
    'AlphaFold 알고리즘을 활용한 단백질 구조 예측 및 분석 플랫폼을 개발했습니다. 생명과학 연구자들이 쉽게 단백질 구조를 예측하고 시각화할 수 있는 웹 기반 도구를 제공합니다.',
    '복잡한 AI 모델을 웹에서 간편하게 사용할 수 있도록 하여 생명과학 연구를 가속화하고자 했습니다.',
    '[{"title":"AI 구조 예측","desc":"AlphaFold 기반 단백질 3D 구조 예측"},{"title":"3D 시각화","desc":"Three.js를 활용한 인터랙티브 구조 뷰어"},{"title":"배치 처리","desc":"다중 서열 동시 분석 지원"}]',
    '대용량 AI 모델을 웹 환경에서 효율적으로 실행하고, 복잡한 3D 구조를 브라우저에서 부드럽게 렌더링하는 것이 핵심 과제였습니다.',
    'GPU 서버에서 모델 추론을 비동기로 처리하고, WebGL 최적화를 통해 브라우저 렌더링 성능을 개선했습니다. FastAPI로 비동기 작업 큐를 구현하여 다중 요청을 효율적으로 처리했습니다.',
    '["Python","TensorFlow","React","FastAPI","Three.js","Docker","Redis"]',
    'https://github.com/hylee/alpha-helix',
    'https://alpha-helix.bio',
    '{"workContent":true,"vision":true,"coreFeatures":true,"technicalChallenge":true,"solution":true}',
    true,
    true,
    '2024-10-15 14:00:00',
    NOW()
);

-- 포트폴리오 3: DevBridge Platform
INSERT INTO partner_portfolios (
    user_id, source_key, source_project_id, title, period, role,
    thumbnail_url, work_content, vision, core_features, technical_challenge, solution,
    tech_tags, github_url, live_url, sections_json, is_added, is_public, created_at, updated_at
)
VALUES (
    @hylee_user_id,
    @devbridge_source_key,
    @devbridge_project_id,
    'DevBridge - 개발자 매칭 플랫폼',
    '2024.09 - 2025.02 (5개월)',
    'Full-stack Developer & Product Owner',
    '/portfolio/devbridge_thumb.png',
    'AI 기반 개발자-클라이언트 매칭 플랫폼을 설계하고 개발했습니다. OpenAI API를 활용한 스마트 매칭, 실시간 채팅, 포트폴리오 관리 등 종합적인 프로젝트 관리 기능을 제공합니다.',
    '개발자와 클라이언트가 더 효율적으로 만나고 협업할 수 있는 생태계를 만들고자 했습니다.',
    '[{"title":"AI 매칭 알고리즘","desc":"OpenAI 기반 개발자-프로젝트 스마트 매칭"},{"title":"실시간 채팅","desc":"WebSocket 기반 즉시 소통"},{"title":"포트폴리오 시스템","desc":"GitHub 연동 자동 포트폴리오 생성"}]',
    'AI를 활용한 정확한 매칭 알고리즘 구현과 대규모 사용자 간 실시간 통신 처리가 가장 큰 도전이었습니다.',
    'OpenAI Embeddings를 활용하여 프로젝트와 개발자 프로필의 의미적 유사도를 계산하고, Spring WebSocket과 STOMP 프로토콜로 확장 가능한 실시간 채팅을 구현했습니다. Redis Pub/Sub을 통해 다중 서버 환경에서도 메시지 동기화를 보장했습니다.',
    '["React","Spring Boot","MySQL","OpenAI API","WebSocket","Redis","Docker","AWS"]',
    'https://github.com/hylee/devbridge',
    'https://devbridge.io',
    '{"workContent":true,"vision":true,"coreFeatures":true,"technicalChallenge":true,"solution":true}',
    true,
    true,
    '2025-02-15 16:00:00',
    NOW()
);

-- 완료 메시지
SELECT 'Portfolio projects inserted successfully!' AS Status;
SELECT '===== Users =====' AS Info;
SELECT id, email, username, user_type FROM users WHERE email IN ('hylee132@gmail.com', 'yeonalee.researcher@gmail.com');
SELECT '===== Projects =====' AS Info;
SELECT id, title, status, created_at FROM projects WHERE user_id IN (@hylee_user_id, @client_hylee_user_id);
SELECT '===== Partner Reviews =====' AS Info;
SELECT COUNT(*) as review_count, AVG(rating) as avg_rating FROM partner_review WHERE partner_profile_id = @hylee_partner_profile_id;
SELECT '===== Client Reviews =====' AS Info;
SELECT COUNT(*) as review_count, AVG(rating) as avg_rating FROM client_review WHERE client_profile_id = @client_hylee_profile_id;
SELECT '===== Portfolio Items =====' AS Info;
SELECT id, title, source_key, is_added FROM partner_portfolios WHERE user_id = @hylee_user_id;
