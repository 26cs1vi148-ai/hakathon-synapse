import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api',
});

export const createSos = (data) =>
  api.post('/sos', data).then((r) => r.data);

export const updateLocation = (id, data) =>
  api.patch(`/sos/${id}/location`, data).then((r) => r.data);

export const updateStatus = (id, status) =>
  api.patch(`/sos/${id}/status`, { status }).then((r) => r.data);

export const getAlerts = () =>
  api.get('/sos').then((r) => r.data);

export const createDemo = () =>
  api.post('/sos/demo').then((r) => r.data);

export const simulate = (id) =>
  api.post(`/sos/${id}/simulate`).then((r) => r.data);