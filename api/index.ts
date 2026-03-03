import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { initDatabase } from '../packages/server/src/db/connection';
import authRouter from '../packages/server/src/routes/auth';
import { requireAuth } from '../packages/server/src/middleware/auth';
import contactsRouter from '../packages/server/src/routes/contacts';
import importRouter from '../packages/server/src/routes/import';
import dashboardRouter from '../packages/server/src/routes/dashboard';
import templatesRouter from '../packages/server/src/routes/templates';
import campaignsRouter from '../packages/server/src/routes/campaigns';
import sequencesRouter from '../packages/server/src/routes/sequences';
import trackingRouter from '../packages/server/src/routes/tracking';
import remindersRouter from '../packages/server/src/routes/reminders';
import usersRouter from '../packages/server/src/routes/users';
import scannerRouter from '../packages/server/src/routes/scanner';
import aiRouter from '../packages/server/src/routes/ai';
import mockupRouter from '../packages/server/src/routes/mockup';
import autopilotRouter from '../packages/server/src/routes/autopilot';
import { initAutopilotTable } from '../packages/server/src/services/autopilot-service';

const app = express();

let initialized = false;

async function ensureInit() {
  if (!initialized) {
    await initDatabase();
    await initAutopilotTable();
    initialized = true;
  }
}

app.use(async (_req, _res, next) => {
  await ensureInit();
  next();
});

app.use((_req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  next();
});

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.CLIENT_URL || '',
  ].filter(Boolean),
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/track', trackingRouter);
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/contacts', requireAuth, contactsRouter);
app.use('/api/import', requireAuth, importRouter);
app.use('/api/dashboard', requireAuth, dashboardRouter);
app.use('/api/templates', requireAuth, templatesRouter);
app.use('/api/campaigns', requireAuth, campaignsRouter);
app.use('/api/sequences', requireAuth, sequencesRouter);
app.use('/api/reminders', requireAuth, remindersRouter);
app.use('/api/users', requireAuth, usersRouter);
app.use('/api/scanner', requireAuth, scannerRouter);
app.use('/api/ai', requireAuth, aiRouter);
app.use('/api/mockup', requireAuth, mockupRouter);
app.use('/api/autopilot', requireAuth, autopilotRouter);

app.get('/api/settings/status', requireAuth, (_req, res) => {
  res.json({
    resend_configured: !!process.env.RESEND_API_KEY,
    anthropic_configured: !!process.env.ANTHROPIC_API_KEY,
    sender_email: process.env.SENDER_EMAIL || 'info@weblyx.cz',
    sender_name: process.env.SENDER_NAME || 'Weblyx',
  });
});

export default app;
