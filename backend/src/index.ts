import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { assertDatabaseConnection } from './config/database.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import studentRoutes from './routes/student.routes.js';
import taxonomiesRoutes from './routes/taxonomies.routes.js';
import coursesRoutes from './routes/courses.routes.js';
import publicRoutes from './routes/public.routes.js';
import profileRoutes from './routes/profile.routes.js';
import challengesRoutes from './routes/challenges.routes.js';
import practiceRoutes from './routes/practice.routes.js';
import forumRoutes from './routes/forum.routes.js';
import notificationRoutes from './routes/notification.routes.js';

const app = express();

// Behind a proxy (Vercel/Render/Nginx) so req.ip and rate-limit keys are correct.
app.set('trust proxy', 1);

app.use(helmet());

// Allowed browser origins: the ones configured in CORS_ORIGIN plus any
// Vercel deployment (*.vercel.app), so preview + production URLs work
// without having to hard-code them.
const allowedOrigins = env.corsOrigin
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Non-browser clients (curl, health checks) send no Origin header.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      try {
        if (/\.vercel\.app$/.test(new URL(origin).hostname)) return callback(null, true);
      } catch {
        /* malformed origin -> fall through to deny */
      }
      return callback(new Error('Origin no permitido por CORS'));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(globalLimiter);

// Health check (used by the frontend and by uptime monitors)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'grancanaria-rcp-backend', time: new Date().toISOString() });
});

// Feature routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/taxonomies', taxonomiesRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/challenges', challengesRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/notifications', notificationRoutes);

// 404 + central error handler (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

async function start(): Promise<void> {
  try {
    await assertDatabaseConnection();
  } catch (err) {
    const e = err as { message?: string; code?: string; errors?: Array<{ message?: string }> };
    const reason = e.message || e.code || e.errors?.[0]?.message || String(err);
    console.error('[startup] could not connect to the database.');
    console.error('[startup] reason:', reason);
    console.error('[startup] Check DATABASE_URL in backend/.env and that PostgreSQL is running.');
    process.exit(1);
  }

  app.listen(env.port, () => {
    console.log(`\n🫀  GranCanaria RCP Academy - backend`);
    console.log(`    Listening on http://localhost:${env.port}`);
    console.log(`    Env: ${env.nodeEnv}\n`);
  });
}

start();

export { app };
