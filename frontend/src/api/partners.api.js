/**
 * 파트너 관련 API.
 * - 백엔드: PartnerController (/api/partners/**)
 */
import api from './axios';

export const partnersApi = {
  /**
   * 파트너 목록. 옵션 미지정 시 백엔드 기본(최신순 20개) 반환.
   * 검색 페이지처럼 클라이언트 필터링 위해 전체 필요하면 { limit: 999 } 전달.
   *
   * @param {{limit?: number, offset?: number, sort?: 'latest'|'id'}} opts
   */
  list: (opts = {}) => {
    const params = new URLSearchParams();
    if (opts.limit  != null) params.set('limit',  opts.limit);
    if (opts.offset != null) params.set('offset', opts.offset);
    if (opts.sort)           params.set('sort',   opts.sort);
    const qs = params.toString();
    return api.get(`/partners${qs ? '?' + qs : ''}`).then((r) => r.data);
  },

  /** 파트너 상세 */
  detail: (id) => api.get(`/partners/${id}`).then((r) => r.data),
};
