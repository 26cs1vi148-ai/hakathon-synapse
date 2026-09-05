import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../../data');
const file = path.join(dataDir, 'local-db.json');

const empty = { students: [], sos_alerts: [], location_updates: [] };

async function readDb() {
  await fs.mkdir(dataDir, { recursive: true });
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch { await fs.writeFile(file, JSON.stringify(empty, null, 2)); return structuredClone(empty); }
}
async function writeDb(db) { await fs.writeFile(file, JSON.stringify(db, null, 2)); }

export const localStore = {
  async listAlerts() { const db = await readDb(); return db.sos_alerts.sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)); },
  async getAlert(id) { const db = await readDb(); return db.sos_alerts.find(x => x.id === id) || null; },
  async createStudent(student) { const db = await readDb(); const existing = db.students.find(x => x.studentId === student.studentId); if (existing) return existing; db.students.push(student); await writeDb(db); return student; },
  async createAlert(alert) { const db = await readDb(); db.sos_alerts.push(alert); await writeDb(db); return alert; },
  async updateAlert(id, patch) { const db = await readDb(); const i = db.sos_alerts.findIndex(x => x.id === id); if (i < 0) return null; db.sos_alerts[i] = { ...db.sos_alerts[i], ...patch }; await writeDb(db); return db.sos_alerts[i]; },
  async addLocation(update) { const db = await readDb(); db.location_updates.push(update); await writeDb(db); return update; },
  async hasActiveForStudent(studentId) { const db = await readDb(); return db.sos_alerts.find(x => x.studentId === studentId && ['ACTIVE','RESPONDED'].includes(x.status)) || null; }
};