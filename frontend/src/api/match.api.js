/**
 * AI 매칭 점수 API.
 * - 백엔드: MatchController (/api/match/**)
 * - 사용 흐름: 프론트에서 1차 필터링한 후보 id 배열 + 자연어 query를 전송하면
 *   [{ id, matchScore, reasons[] }] 배열을 반환.
 */
import api from './axios';

// AI 매칭은 Gemini 호출이 후보 수에 따라 오래 걸릴 수 있어 별도 타임아웃을 길게 둔다.
const MATCH_TIMEOUT_MS = 180000; // 3분

export const matchApi = {
  /**
   * 파트너 매칭 점수.
   * @param {string} query
   * @param {number[]} candidateIds
   */
  partners: (query, candidateIds) =>
    api.post('/match/partners', { query, candidateIds }, { timeout: MATCH_TIMEOUT_MS }).then((r) => r.data),

  /** 클라이언트 매칭 점수. */
  clients: (query, candidateIds) =>
    api.post('/match/clients', { query, candidateIds }, { timeout: MATCH_TIMEOUT_MS }).then((r) => r.data),

  /** 프로젝트 매칭 점수. */
  projects: (query, candidateIds) =>
    api.post('/match/projects', { query, candidateIds }, { timeout: MATCH_TIMEOUT_MS }).then((r) => r.data),
};
