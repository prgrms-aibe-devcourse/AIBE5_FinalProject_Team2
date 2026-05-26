-- =====================================================================
-- DevBridge 대량 시드 데이터 (클라이언트 1000, 파트너 1000, 프로젝트 1000)
-- 기존 30개 포함, 970개씩 추가
-- 실행: mysql -u root -p1234 devbridge_db < seed_bulk_1000.sql
-- =====================================================================

USE devbridge_db;

DELIMITER $$

DROP PROCEDURE IF EXISTS seed_1000_records$$

CREATE PROCEDURE seed_1000_records()
BEGIN
  DECLARE i INT DEFAULT 1;
  DECLARE v_user_id BIGINT;
  DECLARE v_client_profile_id BIGINT;
  DECLARE v_partner_profile_id BIGINT;
  DECLARE v_project_id BIGINT;
  DECLARE v_client_user_id BIGINT;
  DECLARE v_client_count INT;

  -- ============================================================
  -- Phase 1: 클라이언트 970명 추가 (총 1000명)
  -- ============================================================
  SET i = 1;
  WHILE i <= 970 DO

    INSERT INTO users (
      email, phone, username, password, user_type, interests,
      contact_email, gender, birth_date, region,
      bank_name, bank_account_holder_name
    ) VALUES (
      CONCAT('client_', LPAD(i + 30, 5, '0'), '@devbridge.com'),
      CONCAT('010-', LPAD(1000 + MOD(i * 137, 9000), 4, '0'), '-', LPAD(1000 + MOD(i * 251, 9000), 4, '0')),
      CONCAT('client_', LPAD(i + 30, 5, '0')),
      '$2a$10$devbridge.mock.hashed.password.hash',
      'CLIENT',
      ELT(1 + MOD(i, 8), '웹 개발, AI', '모바일, 커머스', 'SaaS, B2B', '핀테크, 블록체인', '헬스케어, 의료', '교육, EdTech', '물류, IoT', '엔터테인먼트, 미디어'),
      CONCAT('client_', LPAD(i + 30, 5, '0'), '@devbridge.com'),
      ELT(1 + MOD(i, 3), 'MALE', 'FEMALE', 'OTHER'),
      DATE_ADD('1975-01-01', INTERVAL MOD(i * 97, 7300) DAY),
      ELT(1 + MOD(i, 10), '서울시 강남구', '서울시 마포구', '서울시 성동구', '경기도 성남시', '경기도 수원시', '부산시 해운대구', '인천시 연수구', '대전시 유성구', '대구시 수성구', '광주시 북구'),
      ELT(1 + MOD(i, 6), '국민은행', '신한은행', '하나은행', '우리은행', '카카오뱅크', '토스뱅크'),
      ELT(1 + MOD(i, 15), '김민준', '이서연', '박도윤', '최지아', '정시우', '윤하은', '임주원', '오서현', '홍민재', '강예린', '조현우', '신수아', '한지호', '문서윤', '배태현')
    );

    SET v_user_id = LAST_INSERT_ID();

    INSERT INTO client_profile (
      user_id, client_type, slogan, org_name, industry, manager_name,
      grade, slogan_sub, bio, strength_desc,
      preferred_levels, preferred_work_type,
      budget_min, budget_max, avg_project_budget, avatar_color
    ) VALUES (
      v_user_id,
      ELT(1 + MOD(i, 4), 'INDIVIDUAL', 'SOLE_PROPRIETOR', 'CORPORATION', 'TEAM'),
      ELT(1 + MOD(i, 10), '혁신적인 IT 솔루션을 추구합니다', '글로벌 수준의 개발 파트너를 찾습니다', '최고의 팀과 최고의 결과를', '기술로 비즈니스를 혁신합니다', '데이터 기반 의사결정을 실현합니다', '사용자 중심의 서비스를 만듭니다', '빠른 실행, 완벽한 결과', 'AI로 새로운 가치를 창출합니다', '고객이 사랑하는 제품을 만듭니다', '함께 성장하는 파트너십'),
      ELT(1 + MOD(i, 15), '테크스타트업', '디지털에이전시', '이커머스코리아', 'AI연구소', '핀테크랩', '헬스케어테크', '에듀테크', '물류테크', 'SaaS플랫폼', '미디어테크', '게임스튜디오', '블록체인랩', '클라우드서비스', '데이터스튜디오', '모바일랩'),
      ELT(1 + MOD(i, 8), 'SaaS', '웹사이트', 'AI', '커머스', '의료', '교육', '핀테크', '모바일'),
      ELT(1 + MOD(i, 6), '김대표', '이CTO', '박PM', '최팀장', '정디렉터', '윤매니저'),
      ELT(1 + MOD(i, 4), 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'),
      ELT(1 + MOD(i, 5), '우수 파트너 우대', '장기 프로젝트 선호', '빠른 실행 가능 팀 환영', '예산 협의 가능', '정규직 전환 가능'),
      '글로벌 IT 인재들과 협업하여 혁신적인 결과물을 만듭니다. 성공적인 팀 매칭과 프로젝트 관리를 경험해보세요.',
      '검증된 파트너와 함께 최고의 서비스를 구축합니다. 기술력과 도메인 지식을 겸비한 팀을 선호합니다.',
      JSON_ARRAY(ELT(1 + MOD(i, 3), '시니어', '미들', '주니어')),
      MOD(i, 3),
      500 + MOD(i * 17, 2500),
      3000 + MOD(i * 13, 5000),
      1500 + MOD(i * 11, 3000),
      ELT(1 + MOD(i, 8), '#14B8A6', '#F59E0B', '#6366F1', '#EC4899', '#10B981', '#3B82F6', '#EF4444', '#38BDF8')
    );

    SET v_client_profile_id = LAST_INSERT_ID();

    INSERT INTO client_profile_stats (client_profile_id, completed_projects, posted_projects, rating, repeat_rate)
    VALUES (
      v_client_profile_id,
      MOD(i * 3, 25) + 1,
      MOD(i * 5, 35) + 2,
      ROUND(3.0 + (MOD(i * 7, 20) * 0.1), 1),
      MOD(i * 9, 60) + 20
    );

    -- client_preferred_skill: 3 skills (서로 다른 skill_id 보장)
    INSERT INTO client_preferred_skill (client_profile_id, skill_id)
    SELECT v_client_profile_id, sid FROM (
      SELECT (1 + MOD(i * 3,       40)) AS sid
      UNION ALL SELECT (1 + MOD(i * 7  + 13, 40))
      UNION ALL SELECT (1 + MOD(i * 11 + 27, 40))
    ) t WHERE NOT EXISTS (
      SELECT 1 FROM client_preferred_skill x
      WHERE x.client_profile_id = v_client_profile_id AND x.skill_id = t.sid
    );

    SET i = i + 1;
  END WHILE;

  -- ============================================================
  -- Phase 2: 파트너 970명 추가 (총 1000명)
  -- ============================================================
  SET i = 1;
  WHILE i <= 970 DO

    INSERT INTO users (
      email, phone, username, password, user_type, interests,
      contact_email, gender, birth_date, region,
      bank_name, bank_account_holder_name
    ) VALUES (
      CONCAT('partner_', LPAD(i + 30, 5, '0'), '@devbridge.com'),
      CONCAT('010-', LPAD(1000 + MOD(i * 163, 9000), 4, '0'), '-', LPAD(1000 + MOD(i * 281, 9000), 4, '0')),
      CONCAT('partner_', LPAD(i + 30, 5, '0')),
      '$2a$10$devbridge.mock.hashed.password.hash',
      'PARTNER',
      ELT(1 + MOD(i, 8), 'Spring, Java, 백엔드', 'React, TypeScript, 프론트엔드', 'Python, AI/ML, 데이터', 'Flutter, Swift, 모바일', 'AWS, Kubernetes, DevOps', 'Node.js, Express, 풀스택', 'Figma, 디자인, UI/UX', 'Go, Rust, 시스템'),
      CONCAT('partner_', LPAD(i + 30, 5, '0'), '@devbridge.com'),
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

    -- partner_skill: 5 skills
    INSERT INTO partner_skill (partner_profile_id, skill_id)
    SELECT v_partner_profile_id, sid FROM (
      SELECT (1 + MOD(i * 3,       40)) AS sid
      UNION ALL SELECT (1 + MOD(i * 7  +  5, 40))
      UNION ALL SELECT (1 + MOD(i * 11 + 10, 40))
      UNION ALL SELECT (1 + MOD(i * 13 + 17, 40))
      UNION ALL SELECT (1 + MOD(i * 17 + 23, 40))
    ) t WHERE NOT EXISTS (
      SELECT 1 FROM partner_skill x
      WHERE x.partner_profile_id = v_partner_profile_id AND x.skill_id = t.sid
    );

    SET i = i + 1;
  END WHILE;

  -- ============================================================
  -- Phase 3: 프로젝트 970개 추가 (총 1000개)
  -- ============================================================
  -- 클라이언트 ID 임시 테이블 (LIMIT 변수 우회)
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

    -- 클라이언트 유저 순환 배정
    SELECT uid INTO v_client_user_id
    FROM tmp_client_ids
    WHERE rn = (MOD(i - 1, v_client_count) + 1);

    SET @is_outsource = (MOD(i, 2) = 0);

    SET @proj_prefix = ELT(1 + MOD(i, 12),
      'AI 기반 ', '클라우드 ', '모바일 앱 ', '실시간 ', '빅데이터 ',
      '블록체인 ', 'IoT 기반 ', 'SaaS ', '자동화 ', '마이크로서비스 ',
      'ML 파이프라인 ', '데이터 기반 ');

    SET @proj_suffix = ELT(1 + MOD(i * 3, 12),
      '플랫폼 개발', '시스템 구축', '서비스 리뉴얼', '앱 개발', '백오피스 개발',
      '고도화 프로젝트', 'API 서버 개발', '대시보드 구축', 'MVP 개발',
      '마이그레이션', '성능 최적화', '운영 자동화');

    SET @proj_domain = ELT(1 + MOD(i * 7, 8),
      '핀테크', '헬스케어', '이커머스', '교육', '물류', 'HR테크', '부동산', '엔터테인먼트');

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
      CONCAT(@proj_title, '에 대한 상세 업무 설명입니다. 레거시 시스템 개선, 신규 기능 개발, 성능 튜닝 및 운영 자동화까지 포함됩니다. 시니어급 개발자와 협력하여 높은 완성도의 결과물을 목표로 합니다.'),
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
      1 + MOD(i, 3),
      1 + MOD(i, 2),
      MOD(i, 2),
      2 + MOD(i, 3),
      ELT(1 + MOD(i, 4), 'RECRUITING', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'),
      ELT(1 + MOD(i, 8), '#14B8A6', '#F59E0B', '#6366F1', '#EC4899', '#10B981', '#3B82F6', '#EF4444', '#38BDF8'),
      -- 외주 전용
      IF(@is_outsource, ELT(1 + MOD(i, 2), 'NEW', 'MAINTENANCE'), NULL),
      IF(@is_outsource, ELT(1 + MOD(i, 4), 'IDEA', 'DOCUMENT', 'DESIGN', 'CODE'), NULL),
      -- 상주 전용
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

    -- project_tags: 3개
    INSERT INTO project_tags (project_id, tag)
    SELECT v_project_id, tag FROM (
      SELECT ELT(1 + MOD(i * 3,  10), '#React', '#Spring', '#Python', '#AI/ML', '#Flutter', '#Mobile', '#Web', '#Fintech', '#Blockchain', '#DevOps') AS tag
      UNION ALL SELECT ELT(1 + MOD(i * 7,   8), '#Node.js', '#TypeScript', '#AWS', '#Docker', '#Kubernetes', '#FastAPI', '#Vue.js', '#Go')
      UNION ALL SELECT ELT(1 + MOD(i * 11,  6), '#데이터분석', '#머신러닝', '#클라우드', '#마이크로서비스', '#API개발', '#풀스택')
    ) t;

    -- project_skill_mapping: 4개 (required 2 + preferred 2)
    INSERT INTO project_skill_mapping (project_id, skill_id, is_required)
    SELECT v_project_id, sid, is_req FROM (
      SELECT (1 + MOD(i * 3,       40)) AS sid, TRUE  AS is_req
      UNION ALL SELECT (1 + MOD(i * 7  +  5, 40)), TRUE
      UNION ALL SELECT (1 + MOD(i * 11 + 10, 40)), FALSE
      UNION ALL SELECT (1 + MOD(i * 13 + 20, 40)), FALSE
    ) t WHERE NOT EXISTS (
      SELECT 1 FROM project_skill_mapping x
      WHERE x.project_id = v_project_id AND x.skill_id = t.sid
    );

    SET i = i + 1;
  END WHILE;

END$$

DELIMITER ;

CALL seed_1000_records();
DROP PROCEDURE IF EXISTS seed_1000_records;

-- 결과 확인
SELECT '=== 시드 완료 ===' AS result;
SELECT 'users'              AS tbl, COUNT(*) AS cnt FROM users
UNION ALL SELECT 'client_profile',        COUNT(*) FROM client_profile
UNION ALL SELECT 'partner_profile',       COUNT(*) FROM partner_profile
UNION ALL SELECT 'client_profile_stats',  COUNT(*) FROM client_profile_stats
UNION ALL SELECT 'partner_profile_stats', COUNT(*) FROM partner_profile_stats
UNION ALL SELECT 'partner_skill',         COUNT(*) FROM partner_skill
UNION ALL SELECT 'client_preferred_skill',COUNT(*) FROM client_preferred_skill
UNION ALL SELECT 'projects',              COUNT(*) FROM projects
UNION ALL SELECT 'project_tags',          COUNT(*) FROM project_tags
UNION ALL SELECT 'project_skill_mapping', COUNT(*) FROM project_skill_mapping;
