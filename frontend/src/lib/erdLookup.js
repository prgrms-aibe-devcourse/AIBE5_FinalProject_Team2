// ERD v2 mock data lookup helpers.
// frontend/src/data/erd/*.json을 읽어 프로젝트 상세 보기에서 쓸 수 있는
// 정규화된 객체로 변환합니다.

import projectsRaw from "../data/erd/projects.json";
import recruitRoles from "../data/erd/project_recruit_roles.json";
import skillMapping from "../data/erd/project_skill_mapping.json";
import skillMaster from "../data/erd/skill_master.json";
import fieldMapping from "../data/erd/project_field_mapping.json";
import fieldMaster from "../data/erd/project_field_master.json";
import clientProfiles from "../data/erd/client_profile.json";
import clientProfileStats from "../data/erd/client_profile_stats.json";
import userVerifications from "../data/erd/user_verifications.json";
import users from "../data/erd/users.json";

// id 로 기본 프로젝트 row 조회
export function findErdProject(proj) {
  if (!proj) return null;
  if (proj.id != null) {
    const hit = projectsRaw.find(p => p.id === proj.id);
    if (hit) return hit;
  }
  if (proj.title) {
    const hit = projectsRaw.find(p => p.title === proj.title);
    if (hit) return hit;
  }
  return null;
}

const skillName = id => skillMaster.find(s => s.id === id)?.name;

// 숫자(만원) → "1,500만원" 포맷
function formatBudget(min, max) {
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max) {
    return `${min.toLocaleString()}~${max.toLocaleString()}만원`;
  }
  const v = max ?? min;
  return `${v.toLocaleString()}만원`;
}

const WORK_SCOPE_LABEL = { planning: "기획", design: "디자인/퍼블리싱", publishing: "프론트 개발", dev: "백엔드 개발" };
const CATEGORY_LABEL = { web: "웹", android: "안드로이드", ios: "iOS", pc: "PC", embedded: "임베디드", etc: "기타" };
const READY_LABEL = { idea: "아이디어만 있음", document: "기획서 준비 완료", design: "디자인 완료", code: "일부 개발 완료" };
const OUTSOURCE_TYPE_LABEL = { new: "신규 개발", maintenance: "유지보수/고도화" };
const WORK_STYLE_LABEL = { onsite: "상주", remote: "원격", hybrid: "혼합" };
const WORK_DAYS_LABEL = { "3days": "주 3일", "4days": "주 4일", "5days": "주 5일", flexible: "유연 근무" };
const WORK_HOURS_LABEL = { morning: "오전", afternoon: "오후", flexible: "유연", fulltime: "풀타임" };
const DEV_STAGE_LABEL = { planning: "기획 단계", development: "개발 중", beta: "베타 운영", operating: "운영 중", maintenance: "유지보수" };
const VISIBILITY_LABEL = { public: "전체 공개", applicants: "지원자에게만 공개", private: "비공개" };
const MEETING_TYPE_LABEL = { online: "온라인", offline: "오프라인", hybrid: "혼합" };
const MEETING_FREQ_LABEL = { daily: "매일", weekly: "주 1회", biweekly: "격주", monthly: "월 1회" };

/**
 * proj (레거시) + ERD 데이터를 병합해 ProjectDetailPopup 용 상세 객체 반환.
 * ERD 에 매칭되지 않으면 null.
 */
export function buildProjectDetail(proj) {
  const p = findErdProject(proj);
  if (!p) return null;

  // 스킬
  const skillRows = skillMapping.filter(s => s.project_id === p.id);
  const requiredSkills = skillRows.filter(s => s.is_required).map(s => skillName(s.skill_id)).filter(Boolean);
  const preferredSkills = skillRows.filter(s => !s.is_required).map(s => skillName(s.skill_id)).filter(Boolean);

  // 분야
  const fieldRows = fieldMapping.filter(f => f.project_id === p.id);
  const fields = fieldRows
    .map(f => fieldMaster.find(fm => fm.id === f.field_id))
    .filter(Boolean)
    .map(fm => `${fm.parent_category} > ${fm.field_name}`);

  // 모집 직무 (상주)
  const roles = recruitRoles.filter(r => r.project_id === p.id);

  // 클라이언트
  const clientUser = users.find(u => u.id === p.user_id);
  const clientProfile = clientProfiles.find(cp => cp.user_id === p.user_id);
  const clientStats = clientProfile ? clientProfileStats.find(cs => cs.client_profile_id === clientProfile.id) : null;
  const verifications = userVerifications
    .filter(v => v.user_id === p.user_id && v.status === "verified")
    .map(v => ({ identity: "본인인증", business: "사업자등록", evaluation: "평가완료" }[v.verification_type]))
    .filter(Boolean);

  return {
    // 식별
    id: p.id,
    type: p.project_type, // "outsource" | "fulltime"

    // 공통 헤더
    title: p.title,
    slogan_sub: p.slogan_sub,
    desc: p.desc,
    detail_content: p.detail_content,
    tags: p.tags || [],
    visibility: VISIBILITY_LABEL[p.visibility] || p.visibility,
    avatarColor: p.avatar_color,

    // 예산·기간
    budget_label: formatBudget(p.budget_min, p.budget_max),
    duration_months: p.duration_months,
    period_label: p.duration_months ? `${p.duration_months}개월` : null,
    start_date: p.start_date,
    start_date_negotiable: p.start_date_negotiable,
    schedule_negotiable: p.schedule_negotiable,
    deadline: p.deadline,
    gov_support: p.gov_support,

    // 업무 범위 / 카테고리
    work_scopes: (p.work_scope || []).map(w => WORK_SCOPE_LABEL[w] || w),
    categories: (p.category || []).map(c => CATEGORY_LABEL[c] || c),
    service_field: p.service_field,
    fields,

    // 스킬
    requiredSkills,
    preferredSkills,

    // 협업/미팅
    meeting_type: MEETING_TYPE_LABEL[p.meeting_type] || p.meeting_type,
    meeting_freq: MEETING_FREQ_LABEL[p.meeting_freq] || p.meeting_freq,
    meeting_tools: p.meeting_tools || [],
    req_tags: p.req_tags || [],
    it_exp: p.it_exp,
    collab_planning: p.collab_planning,
    collab_design: p.collab_design,
    collab_publishing: p.collab_publishing,
    collab_dev: p.collab_dev,

    // 외주 전용
    outsource_project_type: OUTSOURCE_TYPE_LABEL[p.outsource_project_type],
    ready_status: READY_LABEL[p.ready_status],

    // 상주 전용
    work_style: WORK_STYLE_LABEL[p.work_style],
    work_location: p.work_location,
    work_days: WORK_DAYS_LABEL[p.work_days],
    work_hours: WORK_HOURS_LABEL[p.work_hours],
    contract_months: p.contract_months,
    monthly_rate: p.monthly_rate,
    dev_stage: DEV_STAGE_LABEL[p.dev_stage],
    team_size: p.team_size,
    current_stacks: p.current_stacks || [],
    current_status: p.current_status,
    recruit_roles: roles,

    // 클라이언트 카드
    client: clientUser ? {
      username: clientUser.username,
      orgName: clientProfile?.org_name,
      industry: clientProfile?.industry,
      grade: clientProfile?.grade,
      rating: clientStats?.rating,
      completedProjects: clientStats?.completed_projects,
      avatarColor: clientProfile?.avatar_color,
      verifications,
    } : null,
  };
}
