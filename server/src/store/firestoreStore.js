import { getFirestore } from '../config/firebase.js';
import { FieldPath, Timestamp } from 'firebase-admin/firestore';

function clean(doc) {
  if (!doc) return null;
  const d = doc.data ? doc.data() : doc;
  const out = { ...d, id: doc.id ?? d.id };
  for (const k of ['createdAt','updatedAt','resolvedAt','timestamp']) {
    if (out[k]?.toDate) out[k] = out[k].toDate().toISOString();
  }
  return out;
}

export const firestoreStore = {
  async listAlerts() {
    const snap = await getFirestore().collection('sos_alerts').orderBy('createdAt','desc').limit(200).get();
    return snap.docs.map(clean);
  },
  async getAlert(id) { return clean(await getFirestore().collection('sos_alerts').doc(id).get()); },
  async createStudent(student) { await getFirestore().collection('students').doc(student.studentId).set(student, {merge:true}); return student; },
  async createAlert(alert) {
    const ref = getFirestore().collection('sos_alerts').doc(alert.id);
    await ref.set({ ...alert, createdAt: Timestamp.fromDate(new Date(alert.createdAt)), updatedAt: Timestamp.fromDate(new Date(alert.updatedAt)), resolvedAt: null });
    return alert;
  },
  async updateAlert(id, patch) {
    const normalized = { ...patch };
    for (const k of ['createdAt','updatedAt','resolvedAt']) if (normalized[k]) normalized[k] = Timestamp.fromDate(new Date(normalized[k]));
    await getFirestore().collection('sos_alerts').doc(id).update(normalized);
    return this.getAlert(id);
  },
  async addLocation(update) {
    await getFirestore().collection('location_updates').add({ ...update, timestamp: Timestamp.fromDate(new Date(update.timestamp)) });
    return update;
  },
  async hasActiveForStudent(studentId) {
    const snap = await getFirestore().collection('sos_alerts').where('studentId','==',studentId).where('status','in',['ACTIVE','RESPONDED']).limit(1).get();
    return snap.empty ? null : clean(snap.docs[0]);
  }
};
