import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';

// Database
import { initDatabase } from './db/connection';

// Auth
import authRouter from './routes/auth';
import { requireAuth } from './middleware/auth';

// Routes
import contactsRouter from './routes/contacts';
import importRouter from './routes/import';
import dashboardRouter from './routes/dashboard';
import templatesRouter from './routes/templates';
import campaignsRouter from './routes/campaigns';
import sequencesRouter from './routes/sequences';
import trackingRouter from './routes/tracking';
import remindersRouter from './routes/reminders';
import usersRouter from './routes/users';
import scannerRouter from './routes/scanner';
import aiRouter from './routes/ai';
import mockupRouter from './routes/mockup';
import autopilotRouter from './routes/autopilot';
import cronRouter from './routes/cron';

// Services
import { startScheduler } from './services/scheduler';
import { initAutopilotTable } from './services/autopilot-service';

async function start() {
  await initDatabase();
  await initAutopilotTable();

  const app = express();
  const PORT = process.env.PORT || 3001;

  // Global noindex header for all responses
  app.use((_req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    next();
  });

  // Middleware
  app.use(cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      process.env.CLIENT_URL || '',
    ].filter(Boolean),
    credentials: true,
  }));
  app.use(express.json());

  // Public routes (no auth required)
  app.use('/api/auth', authRouter);
  app.use('/api/track', trackingRouter);
  app.use('/api/cron', cronRouter);
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Protected routes (auth required)
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

  // Settings status endpoint (check API key configuration)
  app.get('/api/settings/status', requireAuth, (_req, res) => {
    res.json({
      resend_configured: !!process.env.RESEND_API_KEY,
      anthropic_configured: !!process.env.ANTHROPIC_API_KEY,
      sender_email: process.env.SENDER_EMAIL || 'info@weblyx.cz',
      sender_name: process.env.SENDER_NAME || 'Weblyx',
    });
  });

  // In production, serve React build
  if (process.env.NODE_ENV === 'production') {
    // Vercel bundles to dist/public, local dev uses ../../client/dist
    const publicDir = path.join(__dirname, 'public');
    const clientDist = require('fs').existsSync(publicDir)
      ? publicDir
      : path.join(__dirname, '../../client/dist');
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Weblyx CRM server running on http://localhost:${PORT}`);
    // Only start node-cron scheduler locally (on Vercel, cron jobs handle this)
    if (!process.env.VERCEL) {
      startScheduler();
    }
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
