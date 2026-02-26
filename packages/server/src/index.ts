import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';

// Database
import { initDatabase } from './db/connection';

// Routes
import contactsRouter from './routes/contacts';
import importRouter from './routes/import';
import dashboardRouter from './routes/dashboard';
import templatesRouter from './routes/templates';
import campaignsRouter from './routes/campaigns';
import sequencesRouter from './routes/sequences';
import trackingRouter from './routes/tracking';
import remindersRouter from './routes/reminders';

// Services
import { startScheduler } from './services/scheduler';

async function start() {
  // Initialize database schema
  await initDatabase();

  const app = express();
  const PORT = process.env.PORT || 3001;

  // Middleware
  app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174'], credentials: true }));
  app.use(express.json());

  // API routes
  app.use('/api/contacts', contactsRouter);
  app.use('/api/import', importRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/templates', templatesRouter);
  app.use('/api/campaigns', campaignsRouter);
  app.use('/api/sequences', sequencesRouter);
  app.use('/api/track', trackingRouter);
  app.use('/api/reminders', remindersRouter);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // In production, serve React build
  if (process.env.NODE_ENV === 'production') {
    const clientDist = path.join(__dirname, '../../client/dist');
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Zenuly CRM server running on http://localhost:${PORT}`);
    startScheduler();
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
