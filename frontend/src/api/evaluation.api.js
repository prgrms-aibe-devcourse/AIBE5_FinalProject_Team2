/**
 * Evaluation dashboard API.
 * Endpoints: GET /api/evaluation/client, GET /api/evaluation/partner
 */
import api from './axios';

export const evaluationApi = {
  /** For ClientDashboard. Returns EvaluationItemDto[]. */
  forClient: () =>
    api.get('/evaluation/client').then((r) => r.data),

  /** For PartnerDashboard. Returns EvaluationItemDto[]. */
  forPartner: () =>
    api.get('/evaluation/partner').then((r) => r.data),
};
