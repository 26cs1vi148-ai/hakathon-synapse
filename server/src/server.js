import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import sosRoutes from './routes/sosRoutes.js';
import studentRoutes from './routes/studentRoutes.js';

const app = express();

app.use(helmet());

app.use(cors({
  origin: true,
}));

app.use(express.json({ limit: '32kb' }));

app.use(rateLimit({
  windowMs: 60_000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.get('/api/health', (req, res) =>
  res.json({
    ok: true,
    storage: process.env.STORAGE_MODE || 'local',
  })
);

app.use('/api/sos', sosRoutes);
// ── Connected Students (in-memory heartbeat) ──────────────
const connectedStudents = new Map();
const HEARTBEAT_TTL = 90_000; // 90 s — offline if no ping

app.post('/api/students/heartbeat', (req, res) => {
  const { studentId, name, hostel, room, phone } = req.body;
  if (!studentId)
    return res.status(400).json({ message: 'studentId required' });

  connectedStudents.set(studentId, {
    studentId, name, hostel, room, phone,
    lastSeen: Date.now(),
  });
  res.json({ ok: true });
});

app.get('/api/students', (req, res) => {
  const now = Date.now();
  const online = [];
  for (const [id, s] of connectedStudents.entries()) {
    if (now - s.lastSeen < HEARTBEAT_TTL) online.push(s);
    else connectedStudents.delete(id);  // cleanup stale
  }
  res.json(online);
});
// ──────────────────────────────────────────────────────────
app.use('/api/students', studentRoutes);


app.use((err, req, res, next) => {
  console.error(err);

  if (err?.name === 'ZodError') {
    return res.status(400).json({
      message: 'Invalid request.',
      issues: err.issues,
    });
  }

  res.status(500).json({
    message: 'Internal server error.',
  });
});

const port = Number(process.env.PORT || 5000);

app.listen(port, () => {
  console.log(`Campus SOS API listening on ${port}`);
});