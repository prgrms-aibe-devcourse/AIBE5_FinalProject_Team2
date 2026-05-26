-- =====================================================================
-- DevBridge 파트너 970명 + 프로젝트 970개 추가
-- (클라이언트 1000명은 이미 완료)
-- =====================================================================

USE devbridge_db;

DELIMITER $$

DROP PROCEDURE IF EXISTS seed_partners_projects$$

CREATE PROCEDURE seed_partners_projects()
BEGIN
  DECLARE i INT DEFAULT 1;
  DECLARE v_user_id BIGINT;
  DECLARE v_partner_profile_id BIGINT;
  DECLARE v_project_id BIGINT;
  DECLARE v_client_user_id BIGINT;
  DECLARE v_client_count INT;

  -- ============================================================
  -- Phase 1: 파트너 970명 추가 (총 1000명, 00061부터 시작)
  -- ============================================================
  SET i = 1;
  WHILE i <= 970 DO

    INSERT INTO users (
      email, phone, username, password, user_type, interests,
      contact_email, gender, birth_date, region,
      bank_name, bank_account_holder_name
    ) VALUES (
      CONCAT('partner_', LPAD(i + 60, 5, '0'), '@devbridge.com'),
      CONCAT('010-', LPAD(1000 + MOD(i * 163, 9000), 4, '0'), '-', LPAD(1000 + MOD(i * 281, 9000), 4, '0')),
      CONCAT('partner_', LPAD(i + 60, 5, '0')),
      '$2a$10$devbridge.mock.hashed.password.hash',
      'PARTNER',
      ELT(1 + MOD(i, 8), 'Spring, Java, 백엔드', 'React, TypeScript, 프론트엔드', 'Python, AI/ML, 데이터', 'Flutter, Swift, 모바일', 'AWS, Kubernetes, DevOps', 'Node.js, Express, 풀스택', 'Figma, 디자인, UI/UX', 'Go, Rust, 시스템'),
      CONCAT('partner_', LPAD(i + 60, 5, '0'), '@devbridge.com'),
      ELT(1 + MOD(i, 3), 'MALE', 'FEMALE', 'OTHER'),
      DATE_ADD('1982-01-01', INTERVAL MOD(i * 83, 5475) DAY),
      ELT(1 + MOD(i, 10), '서울시 강남구', '서울시 마포구', '서울시 성동구', '경기도 성남시', '경기도 수원시', '부산시 해운대구', '인천시 연수구', '대전시 유성구', '대구시 수성구', '광주시 북구'),
      ELT(1 + MOD(i, 6), '국민은행', '신한은행', '하나은행', '우리은행', '카카오뱅크', '토스뱅크'),
      ELT(1 + MOD(i, 15), '김민준', '이서연', '박도윤', '최지아', '정시우', '윤하은', '임주원', '오서현', '홍민재', '강예린', '조현우', '신수아', '한지호', '문서윤', '배태현')
    );

    SET v_user_id = LAST_INSERT_ID();

    INSERT INTO partner_profile (
      user_id, name, title, hero_key, service_field,
      work_category, job_roles, partner_type, preferred_project_type,
      work_available_hours, communication_channels,
      dev_level, dev_experience, work_preference,
      slogan, slogan_sub, strength_desc, avatar_color,
      salary_hour, salary_month, grade
    ) VALUES (
      v_user_id,
      ELT(1 + MOD(i, 15), '김민준', '이서연', '박도윤', '최지아', '정시우', '윤하은', '임주원', '오서현', '홍민재', '강예린', '조현우', '신수아', '한지호', '문서윤', '배태현'),
      ELT(1 + MOD(i, 10), '풀스택 개발자', '백엔드 엔지니어', '프론트엔드 개발자', 'AI/ML 엔지니어', 'DevOps 엔지니어', '모바일 개발자', '데이터 엔지니어', 'UI/UX 개발자', '클라우드 아키텍트', '보안 엔지니어'),
      ELT(1 + MOD(i, 5), 'developer', 'meeting', 'teacher', 'student', 'coding'),
      ELT(1 + MOD(i, 8), 'SaaS', '웹사이트', 'AI', '커머스', '의료', '교육', '핀테크', '모바일'),
      ELT(1 + MOD(i, 4), 'DEVELOP', 'PLANNING', 'DESIGN', 'DISTRIBUTION'),
      JSON_ARRAY(ELT(1 + MOD(i, 6), '백엔드 개발', '프론트엔드 개발', '풀스택 개발', 'AI 모델링', '인프라 구축', 'UI/UX 디자인')),
      ELT(1 + MOD(i, 4), 'INDIVIDUAL', 'TEAM', 'CORPORATION', 'SOLE_PROPRIETOR'),
      ELT(1 + MOD(i, 2), 'FREELANCE', 'CONTRACT_BASED'),
      JSON_OBJECT('mon', TRUE, 'tue', TRUE, 'wed', TRUE, 'thu', TRUE, 'fri', (MOD(i, 2) = 0), 'sat', (MOD(i, 3) = 0)),
      JSON_ARRAY('Slack', ELT(1 + MOD(i, 4), 'Zoom', 'Google Meet', 'Teams', 'Discord')),
      ELT(1 + MOD(i, 5), 'JUNIOR', 'MIDDLE', 'SENIOR_5_7Y', 'SENIOR_7_10Y', 'LEAD'),
      ELT(1 + MOD(i, 5), 'UND_1Y', 'EXP_1_3Y', 'EXP_3_5Y', 'EXP_5_7Y', 'OVER_7Y'),
      ELT(1 + MOD(i, 3), 'REMOTE', 'HYBRID', 'ONSITE'),
      ELT(1 + MOD(i, 10), '최고의 코드로 최고의 가치를', '사용자가 사랑하는 서비스를 만듭니다', '빠르고 안정적인 시스템 구축', '데이터로 미래를 설계합니다', '클라우드 네이티브 전문가', '모바일 UX의 새로운 기준', 'AI로 비즈니스를 혁신합니다', '검증된 기술력과 풍부한 경험', '확장 가능한 아키텍처 설계', '성능 최적화의 달인'),
      ELT(1 + MOD(i, 5), '| 백엔드 전문', '| 풀스택 가능', '| AI/ML 특화', '| DevOps 전문', '| 모바일 앱 전문'),
      '다양한 프로젝트 경험을 바탕으로 최적의 솔루션을 제공합니다. 클라이언트의 성공이 곧 저의 성공입니다.',
      ELT(1 + MOD(i, 8), '#14B8A6', '#F59E0B', '#6366F1', '#EC4899', '#10B981', '#3B82F6', '#EF4444', '#38BDF8'),
      5 + MOD(i * 7, 10),
      300 + MOD(i * 13, 500),
      ELT(1 + MOD(i, 4), 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND')
    );

    SET v_partner_profile_id = LAST_INSERT_ID();

    INSERT INTO partner_profile_stats (partner_profile_id, experience_years, completed_projects, rating, response_rate, repeat_rate, availability_days)
    VALUES (
      v_partner_profile_id,
      1 + MOD(i * 7, 12),
      MOD(i * 11, 50) + 3,
      ROUND(3.0 + (MOD(i * 3, 20) * 0.1), 1),
      70 + MOD(i * 7, 29),
      30 + MOD(i * 11, 59),
      5 + MOD(i, 16)
    );

    INSERT IGNORE INTO partner_skill (partner_profile_id, skill_id)
    SELECT DISTINCT v_partner_profile_id, sid FROM (
      SELECT (1 + MOD(i * 3,       40)) AS sid
      UNION SELECT (1 + MOD(i * 7  +  5, 40))
      UNION SELECT (1 + MOD(i * 11 + 10, 40))
      UNION SELECT (1 + MOD(i * 13 + 17, 40))
      UNION SELECT (1 + MOD(i * 17 + 23, 40))
    ) t;

    SET i = i + 1;
  END WHILE;

  -- ============================================================
  -- Phase 2: 프로젝트 970개 추가 (총 1000개)
  -- ============================================================
  DROP TEMPORARY TABLE IF EXISTS tmp_client_ids;
  CREATE TEMPORARY TABLE tmp_client_ids (
    rn INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    uid BIGINT NOT NULL
  );
  INSERT INTO tmp_client_ids (uid)
    SELECT id FROM users WHERE user_type = 'CLIENT' ORDER BY id;

  SELECT COUNT(*) INTO v_client_count FROM tmp_client_ids;

  SET i = 1;
  WHILE i <= 970 DO

    SELECT uid INTO v_client_user_id
    FROM tmp_client_ids
    WHERE rn = (MOD(i - 1, v_client_count) + 1);

    SET @is_outsource = (MOD(i, 2) = 0);

    SET @proj_prefix = ELT(1 + MOD(i, 12),
      'AI 기반 ', '클라우드 네이티브 ', '모바일 앱 ', '실시간 스트리밍 ', '빅데이터 분석 ',
      '블록체인 기반 ', 'IoT 연동 ', 'SaaS 기반 ', '업무 자동화 ', '마이크로서비스 ',
      'ML 추천 시스템 ', '데이터 기반 ');

    SET @proj_suffix = ELT(1 + MOD(i * 3, 12),
      '플랫폼 개발', '시스템 구축', '서비스 리뉴얼', '앱 개발', '백오피스 개발',
      '고도화 프로젝트', 'API 서버 개발', '대시보드 구축', 'MVP 개발',
      '레거시 마이그레이션', '성능 최적화', '운영 자동화 시스템');

    SET @proj_domain = ELT(1 + MOD(i * 7, 10),
      '핀테크', '헬스케어', '이커머스', '교육', '물류', 'HR테크', '부동산', '엔터테인먼트', '제조', '공공');

    SET @proj_title = CONCAT(@proj_domain, ' ', @proj_prefix, @proj_suffix);
    SET @service_field = ELT(1 + MOD(i, 8), 'AI', '커머스', '웹사이트', '교육', '의료', '핀테크', 'SaaS', '모바일');
    SET @budget_min   = 500  + MOD(i * 17, 3000);
    SET @budget_max   = 2000 + MOD(i * 13, 5000);
    SET @duration     = 3    + MOD(i, 10);

    INSERT INTO projects (
      user_id, project_type, title, slogan, slogan_sub, `desc`, detail_content,
      service_field, grade, work_scope, category, visibility,
      budget_min, budget_max, budget_amount, is_partner_free,
      start_date_negotiable, start_date, duration_months, schedule_negotiable,
      meeting_type, meeting_freq, meeting_tools,
      deadline, gov_support, it_exp,
      collab_planning, collab_design, collab_publishing, collab_dev,
      status, avatar_color,
      outsource_project_type, ready_status,
      work_style, work_location, work_days, work_hours,
      contract_months, monthly_rate, dev_stage, team_size,
      current_stacks, current_status
    ) VALUES (
      v_client_user_id,
      IF(@is_outsource, 'OUTSOURCE', 'FULLTIME'),
      @proj_title,
      @proj_title,
      CONCAT('예산 ', @budget_min, '~', @budget_max, '만원 | 기간 ', @duration, '개월'),
      CONCAT(@proj_title, ' - 핵심 기능 구현과 성능 최적화를 진행합니다.'),
      CONCAT(@proj_title, '에 대한 상세 업무입니다. 레거시 시스템 개선, 신규 기능 개발, 성능 튜닝 및 운영 자동화를 포함합니다. 도메인 경험 있는 시니어급 파트너를 우대합니다.'),
      @service_field,
      ELT(1 + MOD(i, 4), 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'),
      JSON_ARRAY(ELT(1 + MOD(i, 4), 'dev', 'planning', 'design', 'publishing')),
      JSON_ARRAY(ELT(1 + MOD(i, 5), 'web', 'android', 'ios', 'server', 'data')),
      'PUBLIC',
      @budget_min,
      @budget_max,
      (@budget_min + @budget_max) * 10000 / 2,
      (MOD(i, 8) = 0),
      (MOD(i, 3) != 0),
      DATE_ADD('2026-05-01', INTERVAL MOD(i, 120) DAY),
      @duration,
      (MOD(i, 4) != 0),
      ELT(1 + MOD(i, 3), 'ONLINE', 'HYBRID', 'OFFLINE'),
      ELT(1 + MOD(i, 4), 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'DAILY'),
      JSON_ARRAY('Slack', ELT(1 + MOD(i, 3), 'Zoom', 'Google Meet', 'Jira')),
      DATE_ADD('2026-04-25', INTERVAL MOD(i * 3, 90) DAY),
      (MOD(i, 5) = 0),
      (MOD(i, 4) = 0),
      1 + MOD(i, 3), 1 + MOD(i, 2), MOD(i, 2), 2 + MOD(i, 3),
      ELT(1 + MOD(i, 4), 'RECRUITING', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'),
      ELT(1 + MOD(i, 8), '#14B8A6', '#F59E0B', '#6366F1', '#EC4899', '#10B981', '#3B82F6', '#EF4444', '#38BDF8'),
      IF(@is_outsource, ELT(1 + MOD(i, 2), 'NEW', 'MAINTENANCE'), NULL),
      IF(@is_outsource, ELT(1 + MOD(i, 4), 'IDEA', 'DOCUMENT', 'DESIGN', 'CODE'), NULL),
      IF(NOT @is_outsource, ELT(1 + MOD(i, 3), 'ONSITE', 'REMOTE', 'HYBRID'), NULL),
      IF(NOT @is_outsource, CONCAT(ELT(1 + MOD(i, 5), '서울 강남구', '서울 마포구', '경기 성남시', '부산 해운대구', '대전 유성구'), ' 사무실'), NULL),
      IF(NOT @is_outsource, ELT(1 + MOD(i, 4), 'FIVE_DAYS', 'FOUR_DAYS', 'FLEXIBLE', 'THREE_DAYS'), NULL),
      IF(NOT @is_outsource, ELT(1 + MOD(i, 4), 'FULLTIME', 'FLEXIBLE', 'MORNING', 'AFTERNOON'), NULL),
      IF(NOT @is_outsource, 3 + MOD(i, 10), NULL),
      IF(NOT @is_outsource, 300 + MOD(i * 17, 500), NULL),
      IF(NOT @is_outsource, ELT(1 + MOD(i, 5), 'PLANNING', 'DEVELOPMENT', 'BETA', 'OPERATING', 'MAINTENANCE'), NULL),
      IF(NOT @is_outsource, ELT(1 + MOD(i, 5), 'SIZE_1_5', 'SIZE_6_10', 'SIZE_11_30', 'SIZE_31_50', 'SIZE_50_PLUS'), NULL),
      IF(NOT @is_outsource, JSON_ARRAY(ELT(1 + MOD(i, 6), 'Spring', 'React', 'Vue.js', 'Node.js', 'Django', 'FastAPI')), NULL),
      IF(NOT @is_outsource, '현재 서비스 운영 중이며 인수인계 지원 가능합니다.', NULL)
    );

    SET v_project_id = LAST_INSERT_ID();

    INSERT INTO project_tags (project_id, tag)
    SELECT v_project_id, tag FROM (
      SELECT ELT(1 + MOD(i * 3,  10), '#React', '#Spring', '#Python', '#AI/ML', '#Flutter', '#Mobile', '#Web', '#Fintech', '#Blockchain', '#DevOps') AS tag
      UNION ALL SELECT ELT(1 + MOD(i * 7,   8), '#Node.js', '#TypeScript', '#AWS', '#Docker', '#Kubernetes', '#FastAPI', '#Vue.js', '#Go')
      UNION ALL SELECT ELT(1 + MOD(i * 11,  6), '#데이터분석', '#머신러닝', '#클라우드', '#마이크로서비스', '#API개발', '#풀스택')
    ) t;

    INSERT IGNORE INTO project_skill_mapping (project_id, skill_id, is_required)
    SELECT DISTINCT v_project_id, sid, is_req FROM (
      SELECT (1 + MOD(i * 3,       40)) AS sid, TRUE  AS is_req
      UNION SELECT (1 + MOD(i * 7  +  5, 40)), TRUE
      UNION SELECT (1 + MOD(i * 11 + 10, 40)), FALSE
      UNION SELECT (1 + MOD(i * 13 + 20, 40)), FALSE
    ) t;

    SET i = i + 1;
  END WHILE;

  DROP TEMPORARY TABLE IF EXISTS tmp_client_ids;

END$$

DELIMITER ;

CALL seed_partners_projects();
DROP PROCEDURE IF EXISTS seed_partners_projects;

SELECT '=== 최종 결과 ===' AS result;
SELECT 'users_client'          AS tbl, COUNT(*) AS cnt FROM users WHERE user_type='CLIENT'
UNION ALL SELECT 'users_partner',       COUNT(*) FROM users WHERE user_type='PARTNER'
UNION ALL SELECT 'client_profile',      COUNT(*) FROM client_profile
UNION ALL SELECT 'partner_profile',     COUNT(*) FROM partner_profile
UNION ALL SELECT 'partner_profile_stats', COUNT(*) FROM partner_profile_stats
UNION ALL SELECT 'partner_skill',       COUNT(*) FROM partner_skill
UNION ALL SELECT 'projects',            COUNT(*) FROM projects
UNION ALL SELECT 'project_tags',        COUNT(*) FROM project_tags
UNION ALL SELECT 'project_skill_mapping', COUNT(*) FROM project_skill_mapping;
