import api from './axios';

export const portfolioApi = {
  myList: () => api.get('/portfolios/me').then((r) => r.data),

  myAdded: () => api.get('/portfolios/me/added').then((r) => r.data),

  getBySource: (sourceKey) =>
    api.get(`/portfolios/me/by-source/${encodeURIComponent(sourceKey)}`).then((r) => r.data),

  byUsername: (username) => api.get(`/portfolios/${encodeURIComponent(username)}`).then((r) => r.data),

  upsertBySource: (sourceKey, payload) =>
    api.put(`/portfolios/by-source/${encodeURIComponent(sourceKey)}`, payload).then((r) => r.data),

  setAdded: (sourceKey, isAdded) =>
    api.patch(`/portfolios/by-source/${encodeURIComponent(sourceKey)}/added`, { isAdded }).then((r) => r.data),
};