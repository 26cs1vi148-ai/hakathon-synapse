import axios from 'axios';
import { auth } from './firebase';

export const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    'http://127.0.0.1:5000/api',
});

export const createSos = (data) =>
  api.post('/sos', data).then((r) => r.data);

export const updateLocation = (id, data) =>
  api
    .patch(`/sos/${id}/location`, data)
    .then((r) => r.data);

export const updateStatus = (
  id,
  status,
  note = '',
  wardenEmail = ''
) =>
  api
    .patch(`/sos/${id}/status`, {
      status,
      note,
      ...(wardenEmail
        ? { wardenEmail }
        : {}),
    })
    .then((r) => r.data);

export const getAlerts = () =>
  api.get('/sos').then((r) => r.data);

export const createDemo = () =>
  api.post('/sos/demo').then((r) => r.data);

export const simulate = (id) =>
  api
    .post(`/sos/${id}/simulate`)
    .then((r) => r.data);


/* =========================
   STUDENT INVITATION
   ========================= */

export const createStudentInvite = async () => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error(
      'Warden is not logged in.'
    );
  }

  const token = await user.getIdToken();

  return api
    .post(
      '/students/invite',
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )
    .then((r) => r.data);
};


/* =========================
   WARDEN: STUDENT LIST
   ========================= */

export const getStudents = async () => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('User is not logged in.');
  }

  const token = await user.getIdToken();

  const response = await api.get('/students', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  // Backend may return either:
  // [student1, student2]
  // or { students: [student1, student2] }
  if (Array.isArray(response.data)) {
    return response.data;
  }

  if (Array.isArray(response.data?.students)) {
    return response.data.students;
  }

  return [];
};


/* =========================
   STUDENT: REGISTER
   ========================= */

export const registerStudent = async (
  data
) => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error(
      'Student Firebase account is not logged in.'
    );
  }

  const token = await user.getIdToken();

  return api
    .post('/students/register', data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    .then((r) => r.data);
};


/* =========================
   STUDENT: MY PROFILE
   ========================= */

export const getMyStudent = async () => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error(
      'Student is not logged in.'
    );
  }

  const token = await user.getIdToken();

  return api
    .get('/students/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    .then((r) => r.data);
};
export const registerHeartbeat = (student) => {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  return fetch(`${base}/students/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(student),
  }).then(r => r.json());
};