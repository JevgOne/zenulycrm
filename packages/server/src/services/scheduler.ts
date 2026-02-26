import cron from 'node-cron';
import { processEmailQueue } from './email-service';
import { processSequences } from './sequence-service';
import db from '../db/connection';

export function startScheduler() {
  console.log('Scheduler started');

  cron.schedule('*/30 * * * * *', async () => {
    const processed = await processEmailQueue(3);
    if (processed > 0) console.log(`[Scheduler] Processed ${processed} queued emails`);
  });

  cron.schedule('*/5 * * * *', async () => {
    const processed = await processSequences();
    if (processed > 0) console.log(`[Scheduler] Processed ${processed} sequence steps`);
  });

  cron.schedule('* * * * *', async () => {
    const running = await db.all("SELECT * FROM campaigns WHERE status = 'running'");
    for (const campaign of running) {
      const row = await db.get("SELECT COUNT(*) as c FROM sent_emails WHERE campaign_id = ? AND status = 'queued'", campaign.id);
      if (row.c === 0) {
        await db.run("UPDATE campaigns SET status = 'completed', completed_at = datetime('now') WHERE id = ?", campaign.id);
        console.log(`[Scheduler] Campaign "${campaign.name}" completed`);
      }
    }
  });

  cron.schedule('0 0 * * *', async () => {
    const stats = await db.get(`
      SELECT
        (SELECT COUNT(*) FROM contacts) as total_contacts,
        (SELECT COUNT(*) FROM contacts WHERE stage = 'client') as clients,
        (SELECT COUNT(*) FROM sent_emails WHERE sent_at >= date('now', '-1 day')) as emails_today
    `);
    console.log(`[Daily] Contacts: ${stats.total_contacts}, Clients: ${stats.clients}, Emails today: ${stats.emails_today}`);
  });
}
