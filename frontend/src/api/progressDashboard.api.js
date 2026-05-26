/**
 * 진행 프로젝트 대시보드 통합 API.
 * 백엔드: ProgressDashboardController (/api/projects/{pid}/**)
 */
import api from './axios';

export const dashboardApi = {
  fetch: (projectId) =>
    api.get(`/projects/${projectId}/dashboard`).then((r) => r.data),
};

export const milestonesApi = {
  list: (projectId) =>
    api.get(`/projects/${projectId}/milestones`).then((r) => r.data),
  create: (projectId, payload) =>
    api.post(`/projects/${projectId}/milestones`, payload).then((r) => r.data),
  submit: (projectId, milestoneId, payload) =>
    api.post(`/projects/${projectId}/milestones/${milestoneId}/submit`, payload).then((r) => r.data),
  approve: (projectId, milestoneId) =>
    api.post(`/projects/${projectId}/milestones/${milestoneId}/approve`).then((r) => r.data),
  requestRevision: (projectId, milestoneId, reason) =>
    api.post(`/projects/${projectId}/milestones/${milestoneId}/request-revision`, { reason }).then((r) => r.data),
  cancelRevision: (projectId, milestoneId) =>
    api.post(`/projects/${projectId}/milestones/${milestoneId}/cancel-revision`).then((r) => r.data),
};

export const escrowsApi = {
  list: (projectId) =>
    api.get(`/projects/${projectId}/escrows`).then((r) => r.data),
  create: (projectId, payload) =>
    api.post(`/projects/${projectId}/escrows`, payload).then((r) => r.data),
  payMock: (projectId, escrowId, payload) =>
    api.post(`/projects/${projectId}/escrows/${escrowId}/pay-mock`, payload).then((r) => r.data),
  /**
   * 토스페이먼츠 결제 승인 (SDK 콜백 결과를 서버로 전달).
   * payload: { paymentKey, orderId, amount }
   */
  pgConfirm: (projectId, escrowId, payload) =>
    api.post(`/projects/${projectId}/escrows/${escrowId}/pg-confirm`, payload).then((r) => r.data),
};

export const projectAttachmentsApi = {
  list: (projectId) =>
    api.get(`/projects/${projectId}/attachments`).then((r) => r.data),
  create: (projectId, payload) =>
    api.post(`/projects/${projectId}/attachments`, payload).then((r) => r.data),
  /**
   * 실제 파일 업로드 (multipart/form-data).
   * @param {number|string} projectId
   * @param {File} file - 브라우저 File 객체
   * @param {{name?: string, notes?: string}} [meta]
   */
  upload: (projectId, file, meta = {}) => {
    const fd = new FormData();
    fd.append('file', file);
    if (meta.name) fd.append('name', meta.name);
    if (meta.notes) fd.append('notes', meta.notes);
    // axios 기본 Content-Type(application/json)을 undefined로 덮어써야
    // FormData boundary가 자동으로 설정됨
    return api
      .post(`/projects/${projectId}/attachments/upload`, fd, {
        headers: { 'Content-Type': undefined },
      })
      .then((r) => r.data);
  },
  remove: (projectId, attachmentId) =>
    api.delete(`/projects/${projectId}/attachments/${attachmentId}`).then((r) => r.data),
};

export const meetingApi = {
  get: (projectId) =>
    api.get(`/projects/${projectId}/meeting`).then((r) => r.data),
  upsert: (projectId, payload) =>
    api.put(`/projects/${projectId}/meeting`, payload).then((r) => r.data),
};
