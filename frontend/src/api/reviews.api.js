/**
 * 파트너 리뷰 API.
 * - 백엔드: PartnerReviewController (/api/reviews)
 */
import api from './axios';

export const reviewsApi = {
  /** 특정 파트너 프로필의 리뷰 목록 (공개). */
  byPartner: (partnerProfileId) =>
    api.get(`/reviews/partner/${partnerProfileId}`).then((r) => r.data),

  /** 리뷰 작성/수정 (JWT 필수). 같은 reviewer 라면 update. */
  create: ({ partnerProfileId, projectId, rating, expertise, schedule, communication, proactivity, content }) =>
    api.post('/reviews', { partnerProfileId, projectId, rating, expertise, schedule, communication, proactivity, content }).then((r) => r.data),

  /** 파트너가 클라이언트에게 후기 작성 (JWT 필수). */
  createClientReview: ({ clientProfileId, projectId, rating, expertise, schedule, communication, proactivity, content }) =>
    api.post('/reviews/client', { clientProfileId, projectId, rating, expertise, schedule, communication, proactivity, content }).then((r) => r.data),
};
