import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import sosRoutes from './routes/sosRoutes.js';

const app = express();

app.use(helmet());

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map((x) => x.trim())
  : [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ];

app.use(cors({
  origin: allowedOrigins,
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