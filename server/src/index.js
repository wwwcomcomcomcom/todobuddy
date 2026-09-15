import express from 'express';
import cors from 'cors';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

import './db.js';
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import boardRoutes from './routes/board.js';
import todoRoutes from './routes/todos.js';
import crewRoutes from './routes/crews.js';
import friendRoutes from './routes/friends.js';
import uploadsRouter from './routes/uploads.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.TODOBUDDY_UPLOAD_DIR ?? join(__dirname, '..', 'uploads');
mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '8mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

// 개발 중 앱이 어떤 요청을 보내는지 한눈에 보기 위한 최소한의 로그.
if (process.env.TODOBUDDY_LOG !== 'off') {
  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => {
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`);
    });
    next();
  });
}

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/auth', authRoutes);
app.use('/categories', categoryRoutes);
app.use('/board', boardRoutes);
app.use('/todos', todoRoutes);
app.use('/crews', crewRoutes);
app.use('/friends', friendRoutes);
app.use('/uploads', uploadsRouter(UPLOAD_DIR));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error', detail: String(err.message ?? err) });
});

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, '127.0.0.1', () => {
  console.log(`TodoBuddy server listening on http://127.0.0.1:${PORT}`);
});
