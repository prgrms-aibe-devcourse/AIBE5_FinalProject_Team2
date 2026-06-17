import api from './axios';

export const getVisionBoard = () => api.get('/vision-board').then(r => r.data.items ?? []);
export const saveVisionBoard = (items) => api.put('/vision-board', { items });
