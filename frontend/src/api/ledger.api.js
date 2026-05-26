import api from './axios';

/**
 * 가계부 (수입/정산) — 사용자의 에스크로 이벤트를 모아 거래 목록으로 제공.
 * 서버 응답: { linked, cardLinked, bankLinked, items: [{date,type,title,category,amount,...}] }
 */
export const ledgerApi = {
  me: () => api.get('/ledger/me').then(r => r.data),
};
