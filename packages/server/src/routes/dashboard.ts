import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { DAILY_SEND_LIMIT } from '../services/email-service';

const router = Router();

router.get('/overview', async (_req: Request, res: Response) => {
  const [
    totalRow, contactedRow, stages, bySource,
    recentActivity, upcomingReminders,
    sentRow, openedRow, clickedRow, bouncedRow,
    sentTodayRow, queuedRow, failedRow,
    unsubscribesRow,
    sentByDay,
    sequenceProgress,
    outreachStats,
    recentEmails,
  ] = await Promise.all([
    db.get('SELECT COUNT(*) as c FROM contacts'),
    db.get("SELECT COUNT(*) as c FROM contacts WHERE stage = 'contacted'"),
    db.all('SELECT stage, COUNT(*) as count FROM contacts GROUP BY stage'),
    db.all('SELECT source, COUNT(*) as count FROM contacts GROUP BY source ORDER BY count DESC'),
    db.all(`
      SELECT a.*, c.business_name, c.contact_name, c.email as contact_email, c.domain,
        COALESCE(c.business_name, c.contact_name, c.email, c.domain) as display_name
      FROM activities a LEFT JOIN contacts c ON a.contact_id = c.id
      ORDER BY a.created_at DESC LIMIT 10
    `),
    db.all("SELECT r.*, c.business_name, c.contact_name, c.domain FROM reminders r LEFT JOIN contacts c ON r.contact_id = c.id WHERE r.completed = 0 AND r.due_at >= datetime('now') ORDER BY r.due_at LIMIT 10"),
    db.get("SELECT COUNT(*) as c FROM sent_emails WHERE status IN ('sent','opened','clicked')"),
    db.get("SELECT COUNT(*) as c FROM sent_emails WHERE opened_at IS NOT NULL"),
    db.get("SELECT COUNT(*) as c FROM sent_emails WHERE clicked_at IS NOT NULL"),
    db.get("SELECT COUNT(*) as c FROM sent_emails WHERE status = 'bounced'"),
    db.get("SELECT COUNT(*) as c FROM sent_emails WHERE status IN ('sent','opened','clicked') AND sent_at >= date('now')"),
    db.get("SELECT COUNT(*) as c FROM sent_emails WHERE status = 'queued'"),
    db.get("SELECT COUNT(*) as c FROM sent_emails WHERE status = 'failed'"),
    db.get("SELECT COUNT(*) as c FROM unsubscribes"),
    db.all(`
      SELECT DATE(sent_at) as day, COUNT(*) as count
      FROM sent_emails WHERE status IN ('sent','opened','clicked') AND sent_at >= date('now', '-6 days')
      GROUP BY day ORDER BY day
    `),
    db.all(`
      SELECT
        ss.step_order,
        t.name as template_name,
        COUNT(CASE WHEN se.current_step = ss.step_order AND se.status = 'active' THEN 1 END) as waiting,
        COUNT(CASE WHEN se.current_step > ss.step_order THEN 1 END) as done
      FROM sequence_steps ss
      JOIN email_templates t ON ss.template_id = t.id
      LEFT JOIN sequence_enrollments se ON se.sequence_id = ss.sequence_id
      WHERE ss.sequence_id = 2
      GROUP BY ss.step_order, t.name
      ORDER BY ss.step_order
    `),
    db.all("SELECT status, COUNT(*) as count FROM sequence_enrollments WHERE sequence_id = 2 GROUP BY status"),
    db.all(`
      SELECT se.id, se.subject, se.to_email, se.status, se.sent_at, se.opened_at, se.clicked_at, se.error,
        c.business_name, c.contact_name, c.domain
      FROM sent_emails se
      LEFT JOIN contacts c ON se.contact_id = c.id
      WHERE se.status != 'queued'
      ORDER BY se.sent_at DESC NULLS LAST, se.created_at DESC
      LIMIT 50
    `),
  ]);

  const totalSent = sentRow?.c || 0;
  const totalOpened = openedRow?.c || 0;
  const totalClicked = clickedRow?.c || 0;
  const sentToday = sentTodayRow?.c || 0;

  res.json({
    totalContacts: totalRow.c,
    contacted: contactedRow?.c || 0,
    stages,
    bySource,
    recentActivity,
    upcomingReminders,
    emailStats: {
      totalSent,
      totalOpened,
      totalClicked,
      totalBounced: bouncedRow?.c || 0,
      openRate: totalSent > 0 ? Number(((totalOpened / totalSent) * 100).toFixed(1)) : 0,
      clickRate: totalSent > 0 ? Number(((totalClicked / totalSent) * 100).toFixed(1)) : 0,
    },
    dailySendLimit: DAILY_SEND_LIMIT,
    sentToday,
    remainingToday: Math.max(0, DAILY_SEND_LIMIT - sentToday),
    queuedEmails: queuedRow?.c || 0,
    failedEmails: failedRow?.c || 0,
    unsubscribes: unsubscribesRow?.c || 0,
    sentByDay: sentByDay || [],
    sequenceProgress: sequenceProgress || [],
    outreachStats: Object.fromEntries((outreachStats || []).map((r: any) => [r.status, r.count])),
    recentEmails: recentEmails || [],
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
