/**
 * 프로젝트 관련 API.
 * - 백엔드: ProjectController (/api/projects/**)
 */
import api from './axios';

export const projectsApi = {
  /**
   * 프로젝트 목록. 옵션 미지정 시 백엔드 기본(최신순 20개) 반환.
   * 검색 페이지처럼 클라이언트 필터링 위해 전체 필요하면 { limit: 999 } 전달.
   */
  list: (opts = {}) => {
    const params = new URLSearchParams();
    if (opts.limit  != null) params.set('limit',  opts.limit);
    if (opts.offset != null) params.set('offset', opts.offset);
    if (opts.sort)           params.set('sort',   opts.sort);
    const qs = params.toString();
    return api.get(`/projects${qs ? '?' + qs : ''}`).then((r) => r.data);
  },

  /** 프로젝트 상세 */
  detail: (id) => api.get(`/projects/${id}`).then((r) => r.data),

  /** 특정 username 사용자가 등록한 프로젝트 목록 (채팅 - 상대 프로젝트 카드 보여주기용) */
  byUsername: (username) => api.get(`/projects/by-username/${encodeURIComponent(username)}`).then((r) => r.data),

  /** 프로젝트 등록 (JWT 필수) */
  create: (payload) => api.post('/projects', payload).then((r) => r.data),

  /** 프로젝트 수정 (작성자 본인만, JWT 필수) */
  update: (id, payload) => api.put(`/projects/${id}`, payload).then((r) => r.data),

  /** 프로젝트 삭제 (작성자 본인만, JWT 필수) */
  remove: (id) => api.delete(`/projects/${id}`).then((r) => r.data),

  /** 내가 등록한 프로젝트 목록 (JWT 필수) — 대시보드 '시작 전 프로젝트' 탭용.
   *  status: 단일/배열/콤마 문자열 모두 허용. 예: 'IN_PROGRESS' / ['RECRUITING','IN_PROGRESS'] / 'IN_PROGRESS,COMPLETED' */
  myList: (status) => {
    const params = {};
    if (status) {
      params.status = Array.isArray(status) ? status.join(',') : String(status);
    }
    return api.get('/projects/me', { params }).then((r) => r.data);
  },

  /** 프로젝트 status 만 변경 (작성자 본인만). status: RECRUITING|IN_PROGRESS|COMPLETED|CLOSED */
  updateStatus: (id, status) =>
    api.patch(`/projects/${id}/status`, { status }).then((r) => r.data),
};

