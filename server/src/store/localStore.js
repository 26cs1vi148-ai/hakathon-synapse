import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../../data');
const file = path.join(dataDir, 'local-db.json');

const empty = {
  students: [],
  sos_alerts: [],
  location_updates: [],
  student_invites: [],
};

async function readDb() {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    await fs.writeFile(
      file,
      JSON.stringify(empty, null, 2)
    );

    return structuredClone(empty);
  }
}

async function writeDb(db) {
  await fs.writeFile(
    file,
    JSON.stringify(db, null, 2)
  );
}

export const localStore = {
  async listAlerts() {
    const db = await readDb();

    return db.sos_alerts.sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    );
  },

  async getAlert(id) {
    const db = await readDb();

    return (
      db.sos_alerts.find(
        (x) => x.id === id
      ) || null
    );
  },

  async createStudent(student) {
    const db = await readDb();

    const existing = db.students.find(
      (x) => x.studentId === student.studentId
    );

    if (existing) {
      return existing;
    }

    db.students.push(student);

    await writeDb(db);

    return student;
  },

  async listStudents() {
    const db = await readDb();

    return [...db.students].sort(
      (a, b) =>
        new Date(b.createdAt || 0) -
        new Date(a.createdAt || 0)
    );
  },

  async getStudent(studentId) {
    const db = await readDb();

    return (
      db.students.find(
        (x) => x.studentId === studentId
      ) || null
    );
  },

  async saveStudent(student) {
    const db = await readDb();

    const index = db.students.findIndex(
      (x) => x.studentId === student.studentId
    );

    if (index >= 0) {
      db.students[index] = {
        ...db.students[index],
        ...student
      };
    } else {
      db.students.push(student);
    }

    await writeDb(db);

    return db.students.find(
      (x) => x.studentId === student.studentId
    );
  },

  async createAlert(alert) {
    const db = await readDb();

    db.sos_alerts.push(alert);

    await writeDb(db);

    return alert;
  },

  async updateAlert(id, patch) {
    const db = await readDb();

    const i = db.sos_alerts.findIndex(
      (x) => x.id === id
    );

    if (i < 0) {
      return null;
    }

    db.sos_alerts[i] = {
      ...db.sos_alerts[i],
      ...patch
    };

    await writeDb(db);

    return db.sos_alerts[i];
  },

  async addLocation(update) {
    const db = await readDb();

    db.location_updates.push(update);

    await writeDb(db);

    return update;
  },

  async hasActiveForStudent(studentId) {
    const db = await readDb();

    return (
      db.sos_alerts.find(
        (x) =>
          x.studentId === studentId &&
          ['ACTIVE', 'RESPONDED'].includes(
            x.status
          )
      ) || null
    );
  },

  async addWardenAction(id, action) {
    const db = await readDb();

    const alert = db.sos_alerts.find(
      (x) => x.id === id
    );

    if (!alert) {
      throw new Error('SOS not found.');
    }

    if (!Array.isArray(alert.actionHistory)) {
      alert.actionHistory = [];
    }

    alert.actionHistory.push(action);

    await writeDb(db);

    return alert;
  },

  async addWardenNote(id, note) {
    const db = await readDb();

    const alert = db.sos_alerts.find(
      (x) => x.id === id
    );

    if (!alert) {
      throw new Error('SOS not found.');
    }

    if (!Array.isArray(alert.wardenNotes)) {
      alert.wardenNotes = [];
    }

    alert.wardenNotes.push(note);

    await writeDb(db);

    return alert;
  }, 
  
  async createStudentInvite(invite) {
    const db = await readDb();
    if (!Array.isArray(db.student_invites)) {
      db.student_invites = [];
    }
    db.student_invites.push(invite);
    await writeDb(db);
    return invite;
  },

  async getStudentInvite(tokenHash) {
    const db = await readDb();
    if (!Array.isArray(db.student_invites)) return null;
    return (
      db.student_invites.find(
        (x) => x.tokenHash === tokenHash
      ) || null
    );
  },

  async markStudentInviteUsed(tokenHash) {
    const db = await readDb();
    if (!Array.isArray(db.student_invites)) return false;
    const i = db.student_invites.findIndex(
      (x) => x.tokenHash === tokenHash
    );
    if (i >= 0) {
      db.student_invites[i].used = true;
      db.student_invites[i].usedAt = new Date().toISOString();
    }
    await writeDb(db);
    return true;
  },
};