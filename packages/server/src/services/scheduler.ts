/**
 * Scheduler - runs periodic tasks using node-cron
 */
import cron from 'node-cron';
import { processEmailQueue } from './email-service';
import { processSequences } from './sequence-service';
import db from '../db/connection';

export function startScheduler() {
  console.log('Scheduler started');

  // Process email queue every 30 seconds
  cron.schedule('*/30 * * * * *', () => {
    const processed = processEmailQueue(3);
    if (processed > 0) {
      console.log(`[Scheduler] Processed ${processed} queued emails`);
    }
  });

  // Process sequences every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    const processed = processSequences();
    if (processed > 0) {
      console.log(`[Scheduler] Processed ${processed} sequence steps`);
    }
  });

  // Check and complete finished campaigns every minute
  cron.schedule('* * * * *', () => {
    const running = db.prepare(
      "SELECT * FROM campaigns WHERE status = 'running'"
    ).all() as any[];

    for (const campaign of running) {
      const queued = (db.prepare(
        "SELECT COUNT(*) as c FROM sent_emails WHERE campaign_id = ? AND status = 'queued'"
      ).get(campaign.id) as any).c;

      if (queued === 0) {
        db.prepare("UPDATE campaigns SET status = 'completed', completed_at = datetime('now') WHERE id = ?")
          .run(campaign.id);
        console.log(`[Scheduler] Campaign "${campaign.name}" completed`);
      }
    }
  });

  // Log daily stats at midnight
  cron.schedule('0 0 * * *', () => {
    const stats = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM contacts) as total_contacts,
        (SELECT COUNT(*) FROM contacts WHERE stage = 'client') as clients,
        (SELECT COUNT(*) FROM sent_emails WHERE sent_at >= date('now', '-1 day')) as emails_today
    `).get() as any;

    console.log(`[Daily] Contacts: ${stats.total_contacts}, Clients: ${stats.clients}, Emails today: ${stats.emails_today}`);
  });
}
