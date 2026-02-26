import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Database
import { initDatabase } from '../packages/server/src/db/connection';

// Auth
import authRouter from '../packages/server/src/routes/auth';
import { requireAuth } from '../packages/server/src/middleware/auth';

// Routes
import contactsRouter from '../packages/server/src/routes/contacts';
import importRouter from '../packages/server/src/routes/import';
import dashboardRouter from '../packages/server/src/routes/dashboard';
import templatesRouter from '../packages/server/src/routes/templates';
import campaignsRouter from '../packages/server/src/routes/campaigns';
import sequencesRouter from '../packages/server/src/routes/sequences';
import trackingRouter from '../packages/server/src/routes/tracking';
import remindersRouter from '../packages/server/src/routes/reminders';
import usersRouter from '../packages/server/src/routes/users';

const app = express();

// Global noindex header
app.use((_req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  next();
});

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Init DB on cold start
let dbReady = false;
app.use(async (_req, _res, next) => {
  if (!dbReady) {
    await initDatabase();
    dbReady = true;
  }
  next();
});

// Public routes
app.use('/api/auth', authRouter);
app.use('/api/track', trackingRouter);
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Protected routes
app.use('/api/contacts', requireAuth, contactsRouter);
app.use('/api/import', requireAuth, importRouter);
app.use('/api/dashboard', requireAuth, dashboardRouter);
app.use('/api/templates', requireAuth, templatesRouter);
app.use('/api/campaigns', requireAuth, campaignsRouter);
app.use('/api/sequences', requireAuth, sequencesRouter);
app.use('/api/reminders', requireAuth, remindersRouter);
app.use('/api/users', requireAuth, usersRouter);

export default app;
