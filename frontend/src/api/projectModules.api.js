/**
 * 계약 세부 협의 7가지 모듈 데이터 API.
 * - 백엔드: ProjectModuleController (/api/projects/{projectId}/modules)
 * - JWT 필수 (PUT).
 */
import api from './axios';

export const MODULE_KEYS = ["scope", "deliverable", "schedule", "payment", "revision", "completion", "terms"];

export const projectModulesApi = {
  /** 프로젝트의 7모듈 전체 조회 → [{moduleKey,status,data,...}] */
  list: (projectId) =>
    api.get(`/projects/${projectId}/modules`).then((r) => r.data),

  /**
   * 모듈 upsert. data 는 객체 — 함수 내부에서 JSON.stringify 처리.
   * status: "미확정" / "논의 중" / "제안됨" / "협의완료"
   */
  upsert: (projectId, moduleKey, { status, data } = {}) =>
    api
      .put(`/projects/${projectId}/modules/${moduleKey}`, {
        status: status ?? null,
        data: data == null ? null : (typeof data === "string" ? data : JSON.stringify(data)),
      })
      .then((r) => r.data),
};
