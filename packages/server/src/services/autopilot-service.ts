import db from '../db/connection';
import { generateEmailForContact } from './ai-service';
import { generateMockup, getMockupPaths } from './mockup-service';
import { v4 as uuid } from 'uuid';

interface AutopilotConfig {
  enabled: boolean;
  min_score: number;
  auto_email: boolean;
  auto_mockup: boolean;
  auto_followup: boolean;
  followup_days: number;
  max_per_run: number;
}

const DEFAULT_CONFIG: AutopilotConfig = {
  enabled: false,
  min_score: 40,
  auto_email: true,
  auto_mockup: true,
  auto_followup: true,
  followup_days: 5,
  max_per_run: 3,
};

export async function initAutopilotTable() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS autopilot_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS autopilot_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER REFERENCES contacts(id),
      action TEXT NOT NULL,
      status TEXT DEFAULT 'success',
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_autopilot_log_created ON autopilot_log(created_at);
  `);
}

export async function getConfig(): Promise<AutopilotConfig> {
  const rows = await db.all('SELECT key, value FROM autopilot_config');
  const config = { ...DEFAULT_CONFIG };

  for (const row of rows) {
    const key = row.key as keyof AutopilotConfig;
    if (key in config) {
      const val = row.value;
      if (typeof DEFAULT_CONFIG[key] === 'boolean') {
        (config as any)[key] = val === 'true';
      } else if (typeof DEFAULT_CONFIG[key] === 'number') {
        (config as any)[key] = Number(val);
      } else {
        (config as any)[key] = val;
      }
    }
  }

  return config;
}

export async function setConfig(updates: Partial<AutopilotConfig>): Promise<AutopilotConfig> {
  for (const [key, value] of Object.entries(updates)) {
    await db.run(
      `INSERT INTO autopilot_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?`,
      key, String(value), String(value)
    );
  }
  return getConfig();
}

async function log(contactId: number | null, action: string, status: string, details?: string) {
  await db.run(
    'INSERT INTO autopilot_log (contact_id, action, status, details) VALUES (?, ?, ?, ?)',
    contactId, action, status, details || null
  );
}

export async function getLog(limit = 50): Promise<any[]> {
  return db.all(`
    SELECT l.*, c.business_name, c.domain
    FROM autopilot_log l
    LEFT JOIN contacts c ON l.contact_id = c.id
    ORDER BY l.created_at DESC LIMIT ?
  `, limit);
}

export async function processNewContacts(): Promise<number> {
  const config = await getConfig();
  if (!config.enabled) return 0;
  if (!process.env.ANTHROPIC_API_KEY) return 0;

  // Find new contacts with high score that haven't been processed by autopilot
  const contacts = await db.all(`
    SELECT c.id, c.business_name, c.domain, c.email, c.score
    FROM contacts c
    WHERE c.stage = 'new'
      AND c.score >= ?
      AND c.email IS NOT NULL
      AND c.email != ''
      AND c.id NOT IN (
        SELECT DISTINCT contact_id FROM autopilot_log WHERE contact_id IS NOT NULL AND action = 'auto_email'
      )
    ORDER BY c.score DESC
    LIMIT ?
  `, config.min_score, config.max_per_run);

  let processed = 0;

  for (const contact of contacts) {
    try {
      // Auto-generate mockup
      if (config.auto_mockup) {
        const mockupPaths = getMockupPaths(contact.id);
        if (!mockupPaths.mockupExists) {
          try {
            await generateMockup(contact.id);
            await log(contact.id, 'auto_mockup', 'success', 'Mockup vygenerován');
          } catch (err: any) {
            await log(contact.id, 'auto_mockup', 'error', err.message);
          }
        }
      }

      // Auto-generate and queue email
      if (config.auto_email) {
        try {
          const email = await generateEmailForContact(contact.id);
          const trackingId = uuid();

          await db.run(`
            INSERT INTO sent_emails (contact_id, subject, to_email, status, tracking_id, body_html)
            VALUES (?, ?, ?, 'queued', ?, ?)
          `, contact.id, email.subject, contact.email, trackingId, email.body_html);

          await log(contact.id, 'auto_email', 'success', `Email zařazen: "${email.subject}"`);
          processed++;
        } catch (err: any) {
          await log(contact.id, 'auto_email', 'error', err.message);
        }
      }
    } catch (err: any) {
      await log(contact.id, 'auto_process', 'error', err.message);
    }
  }

  return processed;
}

export async function processFollowups(): Promise<number> {
  const config = await getConfig();
  if (!config.enabled || !config.auto_followup) return 0;
  if (!process.env.ANTHROPIC_API_KEY) return 0;

  // Find contacts that were emailed X days ago but haven't responded
  const contacts = await db.all(`
    SELECT c.id, c.business_name, c.domain, c.email, c.score
    FROM contacts c
    WHERE c.stage = 'contacted'
      AND c.email IS NOT NULL
      AND c.email != ''
      AND c.last_contacted_at IS NOT NULL
      AND c.last_contacted_at <= datetime('now', ?)
      AND c.id NOT IN (
        SELECT DISTINCT contact_id FROM autopilot_log WHERE contact_id IS NOT NULL AND action = 'auto_followup'
      )
    ORDER BY c.score DESC
    LIMIT ?
  `, `-${config.followup_days} days`, config.max_per_run);

  let processed = 0;

  for (const contact of contacts) {
    try {
      const email = await generateEmailForContact(contact.id);
      const trackingId = uuid();

      // Modify subject for follow-up
      const subject = `Re: ${email.subject}`;

      await db.run(`
        INSERT INTO sent_emails (contact_id, subject, to_email, status, tracking_id, body_html)
        VALUES (?, ?, ?, 'queued', ?, ?)
      `, contact.id, subject, contact.email, trackingId, email.body_html);

      await log(contact.id, 'auto_followup', 'success', `Follow-up zařazen: "${subject}"`);
      processed++;
    } catch (err: any) {
      await log(contact.id, 'auto_followup', 'error', err.message);
    }
  }

  return processed;
}
