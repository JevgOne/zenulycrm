import { Router, Request, Response } from 'express';
import db from '../db/connection';

const router = Router();

router.get('/overview', async (_req: Request, res: Response) => {
  const totalRow = await db.get('SELECT COUNT(*) as c FROM contacts');
  const monthRow = await db.get("SELECT COUNT(*) as c FROM contacts WHERE created_at >= date('now', 'start of month')");
  const stages = await db.all('SELECT stage, COUNT(*) as count FROM contacts GROUP BY stage');
  const byPriority = await db.all('SELECT priority, COUNT(*) as count FROM contacts GROUP BY priority');
  const avgRow = await db.get('SELECT AVG(score) as avg FROM contacts WHERE score > 0');
  const recentActivity = await db.all(
    'SELECT a.*, c.business_name, c.domain FROM activities a LEFT JOIN contacts c ON a.contact_id = c.id ORDER BY a.created_at DESC LIMIT 10'
  );
  const upcomingReminders = await db.all(
    "SELECT r.*, c.business_name, c.domain FROM reminders r LEFT JOIN contacts c ON r.contact_id = c.id WHERE r.completed = 0 AND r.due_at >= datetime('now') ORDER BY r.due_at LIMIT 10"
  );
  const sentRow = await db.get("SELECT COUNT(*) as c FROM sent_emails WHERE status != 'queued'");
  const openedRow = await db.get("SELECT COUNT(*) as c FROM sent_emails WHERE opened_at IS NOT NULL");
  const clickedRow = await db.get("SELECT COUNT(*) as c FROM sent_emails WHERE clicked_at IS NOT NULL");

  res.json({
    totalContacts: totalRow.c,
    thisMonth: monthRow.c,
    stages,
    byPriority,
    avgScore: Math.round(avgRow?.avg || 0),
    recentActivity,
    upcomingReminders,
    emailStats: { totalSent: sentRow.c, totalOpened: openedRow.c, totalClicked: clickedRow.c },
  });
});

router.get('/by-category', async (_req: Request, res: Response) => {
  const rows = await db.all(
    'SELECT category, COUNT(*) as count, AVG(score) as avg_score FROM contacts WHERE category IS NOT NULL GROUP BY category ORDER BY count DESC'
  );
  res.json(rows);
});

router.get('/by-city', async (_req: Request, res: Response) => {
  const rows = await db.all(
    'SELECT city, COUNT(*) as count, AVG(score) as avg_score FROM contacts WHERE city IS NOT NULL GROUP BY city ORDER BY count DESC'
  );
  res.json(rows);
});

router.get('/score-distribution', async (_req: Request, res: Response) => {
  const rows = await db.all(`
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
  `);
  res.json(rows);
});

export default router;
