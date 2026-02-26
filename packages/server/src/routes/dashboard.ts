import { Router, Request, Response } from 'express';
import db from '../db/connection';

const router = Router();

// GET /api/dashboard/overview
router.get('/overview', (_req: Request, res: Response) => {
  const totalContacts = (db.prepare('SELECT COUNT(*) as c FROM contacts').get() as any).c;
  const thisMonth = (db.prepare(
    "SELECT COUNT(*) as c FROM contacts WHERE created_at >= date('now', 'start of month')"
  ).get() as any).c;

  const stages = db.prepare(
    'SELECT stage, COUNT(*) as count FROM contacts GROUP BY stage'
  ).all();

  const byPriority = db.prepare(
    'SELECT priority, COUNT(*) as count FROM contacts GROUP BY priority'
  ).all();

  const avgScore = (db.prepare(
    'SELECT AVG(score) as avg FROM contacts WHERE score > 0'
  ).get() as any).avg;

  const recentActivity = db.prepare(
    'SELECT a.*, c.business_name, c.domain FROM activities a LEFT JOIN contacts c ON a.contact_id = c.id ORDER BY a.created_at DESC LIMIT 10'
  ).all();

  const upcomingReminders = db.prepare(
    "SELECT r.*, c.business_name, c.domain FROM reminders r LEFT JOIN contacts c ON r.contact_id = c.id WHERE r.completed = 0 AND r.due_at >= datetime('now') ORDER BY r.due_at LIMIT 10"
  ).all();

  const emailStats = {
    totalSent: (db.prepare("SELECT COUNT(*) as c FROM sent_emails WHERE status != 'queued'").get() as any).c,
    totalOpened: (db.prepare("SELECT COUNT(*) as c FROM sent_emails WHERE opened_at IS NOT NULL").get() as any).c,
    totalClicked: (db.prepare("SELECT COUNT(*) as c FROM sent_emails WHERE clicked_at IS NOT NULL").get() as any).c,
  };

  res.json({
    totalContacts,
    thisMonth,
    stages,
    byPriority,
    avgScore: Math.round(avgScore || 0),
    recentActivity,
    upcomingReminders,
    emailStats,
  });
});

// GET /api/dashboard/by-category
router.get('/by-category', (_req: Request, res: Response) => {
  const rows = db.prepare(
    'SELECT category, COUNT(*) as count, AVG(score) as avg_score FROM contacts WHERE category IS NOT NULL GROUP BY category ORDER BY count DESC'
  ).all();
  res.json(rows);
});

// GET /api/dashboard/by-city
router.get('/by-city', (_req: Request, res: Response) => {
  const rows = db.prepare(
    'SELECT city, COUNT(*) as count, AVG(score) as avg_score FROM contacts WHERE city IS NOT NULL GROUP BY city ORDER BY count DESC'
  ).all();
  res.json(rows);
});

// GET /api/dashboard/score-distribution
router.get('/score-distribution', (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT
      CASE
        WHEN score >= 80 THEN '80-100'
        WHEN score >= 60 THEN '60-79'
        WHEN score >= 40 THEN '40-59'
        WHEN score >= 20 THEN '20-39'
        ELSE '0-19'
      END as range,
      COUNT(*) as count
    FROM contacts
    GROUP BY range
    ORDER BY range DESC
  `).all();
  res.json(rows);
});

export default router;
