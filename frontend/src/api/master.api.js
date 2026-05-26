/**
 * 마스터 데이터 API (스킬, 프로젝트 분야).
 * - 백엔드: MasterController (/api/master/**)
 */
import api from './axios';

export const masterApi = {
  /** 전체 스킬 목록 — [{ id, name }, ...] */
  listSkills: () => api.get('/master/skills').then((r) => r.data),

  /**
   * 프로젝트 분야 목록.
   * @param {string} [category] parent_category 필터 (예: "IT 구축")
   */
  listProjectFields: (category) =>
    api
      .get('/master/project-fields', { params: category ? { category } : {} })
      .then((r) => r.data),
};

