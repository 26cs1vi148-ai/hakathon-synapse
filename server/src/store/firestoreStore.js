import { getFirestore } from '../config/firebase.js';
import { Timestamp } from 'firebase-admin/firestore';

function clean(doc) {
  if (!doc) return null;

  const d = doc.data ? doc.data() : doc;
  const out = { ...d, id: doc.id ?? d.id };

  for (const k of [
    'createdAt',
    'updatedAt',
    'resolvedAt',
    'timestamp',
    'expiresAt'
  ]) {
    if (out[k]?.toDate) {
      out[k] = out[k].toDate().toISOString();
    }
  }

  return out;
}

export const firestoreStore = {
  /*
   * =========================================================
   * SOS ALERTS
   * =========================================================
   */

  async listAlerts() {
    const snap = await getFirestore()
      .collection('sos_alerts')
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();

    return snap.docs.map(clean);
  },

  async getAlert(id) {
    return clean(
      await getFirestore()
        .collection('sos_alerts')
        .doc(id)
        .get()
    );
  },

  /*
   * =========================================================
   * STUDENTS
   * =========================================================
   */

  async createStudent(student) {
    await getFirestore()
      .collection('students')
      .doc(student.studentId)
      .set(student, { merge: true });

    return student;
  },

  async listStudents() {
    const snap = await getFirestore()
      .collection('students')
      .orderBy('createdAt', 'desc')
      .get();

    return snap.docs.map(clean);
  },

  async getStudent(studentId) {
    return clean(
      await getFirestore()
        .collection('students')
        .doc(studentId)
        .get()
    );
  },

  async saveStudent(student) {
    await getFirestore()
      .collection('students')
      .doc(student.studentId)
      .set(student, { merge: true });

    return this.getStudent(student.studentId);
  },

  /*
   * =========================================================
   * STUDENT INVITATIONS
   * =========================================================
   */

  async createStudentInvite(invite) {
    await getFirestore()
      .collection('student_invites')
      .doc(invite.tokenHash)
      .set({
        ...invite,
        createdAt: Timestamp.fromDate(
          new Date(invite.createdAt)
        ),
        expiresAt: Timestamp.fromDate(
          new Date(invite.expiresAt)
        )
      });

    return invite;
  },

  async getStudentInvite(tokenHash) {
    const doc = await getFirestore()
      .collection('student_invites')
      .doc(tokenHash)
      .get();

    return clean(doc);
  },

  async markStudentInviteUsed(tokenHash) {
    await getFirestore()
      .collection('student_invites')
      .doc(tokenHash)
      .update({
        used: true,
        usedAt: Timestamp.now()
      });

    return true;
  },

  /*
   * =========================================================
   * SOS CREATION
   * =========================================================
   */

  async createAlert(alert) {
    const ref = getFirestore()
      .collection('sos_alerts')
      .doc(alert.id);

    await ref.set({
      ...alert,
      createdAt: Timestamp.fromDate(
        new Date(alert.createdAt)
      ),
      updatedAt: Timestamp.fromDate(
        new Date(alert.updatedAt)
      ),
      resolvedAt: null,
      wardenNotes: [],
      actionHistory: []
    });

    return alert;
  },

  /*
   * =========================================================
   * SOS UPDATE
   * =========================================================
   */

  async updateAlert(id, patch) {
    const normalized = { ...patch };

    for (const k of [
      'createdAt',
      'updatedAt',
      'resolvedAt'
    ]) {
      if (normalized[k]) {
        normalized[k] = Timestamp.fromDate(
          new Date(normalized[k])
        );
      }
    }

    await getFirestore()
      .collection('sos_alerts')
      .doc(id)
      .update(normalized);

    return this.getAlert(id);
  },

  /*
   * =========================================================
   * LOCATION
   * =========================================================
   */

  async addLocation(update) {
    await getFirestore()
      .collection('location_updates')
      .add({
        ...update,
        timestamp: Timestamp.fromDate(
          new Date(update.timestamp)
        )
      });

    return update;
  },

  /*
   * =========================================================
   * WARDEN ACTION HISTORY
   * =========================================================
   */

  async addWardenAction(id, action) {
    const ref = getFirestore()
      .collection('sos_alerts')
      .doc(id);

    const alert = await ref.get();

    if (!alert.exists) {
      throw new Error('SOS not found.');
    }

    const data = alert.data() || {};

    const actionWithTimestamp = {
      ...action,
      timestamp: Timestamp.fromDate(
        new Date(action.timestamp)
      )
    };

    const history = Array.isArray(data.actionHistory)
      ? data.actionHistory
      : [];

    await ref.update({
      actionHistory: [
        ...history,
        actionWithTimestamp
      ]
    });

    return this.getAlert(id);
  },

  /*
   * =========================================================
   * WARDEN NOTES
   * =========================================================
   */

  async addWardenNote(id, note) {
    const ref = getFirestore()
      .collection('sos_alerts')
      .doc(id);

    const alert = await ref.get();

    if (!alert.exists) {
      throw new Error('SOS not found.');
    }

    const data = alert.data() || {};

    const noteWithTimestamp = {
      ...note,
      timestamp: Timestamp.fromDate(
        new Date(note.timestamp)
      )
    };

    const notes = Array.isArray(data.wardenNotes)
      ? data.wardenNotes
      : [];

    await ref.update({
      wardenNotes: [
        ...notes,
        noteWithTimestamp
      ]
    });

    return this.getAlert(id);
  },

  /*
   * =========================================================
   * ACTIVE SOS FOR STUDENT
   * =========================================================
   */

  async hasActiveForStudent(studentId) {
    const snap = await getFirestore()
      .collection('sos_alerts')
      .where('studentId', '==', studentId)
      .where('status', 'in', [
        'ACTIVE',
        'RESPONDED'
      ])
      .limit(1)
      .get();

    return snap.empty
      ? null
      : clean(snap.docs[0]);
  }
};