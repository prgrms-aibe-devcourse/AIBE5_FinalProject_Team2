/**
 * 프로젝트 지원/매칭/계약 API.
 * - 백엔드: ProjectApplicationController (/api/applications)
 * - JWT 필수.
 */
import api from './axios';

export const applicationsApi = {
  /** 파트너: 내 지원 목록 (대시보드 진행/계약/종료 탭). */
  myList: () => api.get('/applications/me').then((r) => r.data),

  /** 클라이언트: 내가 등록한 모든 프로젝트의 지원자. */
  receivedList: () => api.get('/applications/received').then((r) => r.data),

  /** 특정 프로젝트의 지원자 (작성자만). */
  byProject: (projectId) => api.get(`/applications/project/${projectId}`).then((r) => r.data),

  /** 파트너 → 프로젝트 지원. */
  apply: (projectId, message) =>
    api.post('/applications', { projectId, message }).then((r) => r.data),

  /** 상태 변경. status: APPLIED/ACCEPTED/REJECTED/CONTRACTED/IN_PROGRESS/COMPLETED/WITHDRAWN */
  updateStatus: (id, status) =>
    api.patch(`/applications/${id}/status`, { status }).then((r) => r.data),

  /**
   * 모집 완료(close-recruiting) — 프로젝트 작성자가 ACCEPTED 한 지원자 1명을 확정.
   * 같은 트랜잭션에서 project.status=CLOSED, 다른 지원자는 자동 REJECTED.
   */
  closeRecruiting: (projectId, acceptedApplicationId) =>
    api
      .post('/applications/close-recruiting', { projectId, acceptedApplicationId })
      .then((r) => r.data),

  /**
   * 작성자 → 진행 프로젝트 미팅 시작 시 파트너 application 자동 보장.
   * 없으면 IN_PROGRESS 로 자동 생성, 있으면 IN_PROGRESS 로 update.
   */
  ensureActive: (projectId, partnerUserId) =>
    api
      .post('/applications/ensure-active', { projectId, partnerUserId })
      .then((r) => r.data),
};
