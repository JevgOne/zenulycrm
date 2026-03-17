import { Router, Request, Response } from 'express';
import { processEmailQueue } from '../services/email-service';
import { processSequences } from '../services/sequence-service';
import { processNewContacts, processFollowups } from '../services/autopilot-service';
import db from '../db/connection';

const router = Router();

// Vercel Cron Job endpoint - called every minute
// Also callable manually for testing
router.get('/tick', async (req: Request, res: Response) => {
  // Verify cron secret in production
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const results: Record<string, any> = {};

  // Only send emails between 8:00-18:00 CET
  const now = new Date();
  const cetHour = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Prague' })).getHours();
  const isBusinessHours = cetHour >= 8 && cetHour < 18;
  results.cetHour = cetHour;
  results.businessHours = isBusinessHours;

  try {
    // 1. Process email queue (every tick, only during business hours)
    if (isBusinessHours) {
      const emailsProcessed = await processEmailQueue(5);
      results.emails = emailsProcessed;
    } else {
      results.emails = 0;
      results.skipped = 'outside business hours (8-18 CET)';
    }

    // 2. Check completed campaigns (every tick)
    const running = await db.all("SELECT * FROM campaigns WHERE status = 'running'");
    let campaignsCompleted = 0;
    for (const campaign of running) {
      const row = await db.get("SELECT COUNT(*) as c FROM sent_emails WHERE campaign_id = ? AND status = 'queued'", campaign.id);
      if (row.c === 0) {
        await db.run("UPDATE campaigns SET status = 'completed', completed_at = datetime('now') WHERE id = ?", campaign.id);
        campaignsCompleted++;
      }
    }
    results.campaignsCompleted = campaignsCompleted;

    // 3. Process sequences (every 5 minutes, business hours only)
    const minute = new Date().getMinutes();
    if (isBusinessHours && minute % 5 === 0) {
      const seqProcessed = await processSequences();
      results.sequences = seqProcessed;
    }

    // 4. Autopilot: new contacts (every 15 minutes, business hours only)
    if (isBusinessHours && minute % 15 === 0) {
      try {
        const newContacts = await processNewContacts();
        results.autopilotNew = newContacts;
      } catch (err: any) {
        results.autopilotNewError = err.message;
      }
    }

    // 5. Autopilot: follow-ups (every hour, business hours only)
    if (isBusinessHours && minute === 0) {
      try {
        const followups = await processFollowups();
        results.autopilotFollowups = followups;
      } catch (err: any) {
        results.autopilotFollowupsError = err.message;
      }
    }

    res.json({ ok: true, timestamp: new Date().toISOString(), ...results });
  } catch (err: any) {
    console.error('[Cron] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
