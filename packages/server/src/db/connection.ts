import { createClient, type Client } from '@libsql/client';

const client: Client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:./data/lead-crm.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// DB wrapper with convenience methods
export const db = {
  async get(sql: string, ...args: any[]): Promise<any> {
    const result = await client.execute({ sql, args });
    return result.rows[0] || null;
  },

  async all(sql: string, ...args: any[]): Promise<any[]> {
    const result = await client.execute({ sql, args });
    return result.rows as any[];
  },

  async run(sql: string, ...args: any[]): Promise<{ lastInsertRowid: number; changes: number }> {
    const result = await client.execute({ sql, args });
    return {
      lastInsertRowid: Number(result.lastInsertRowid),
      changes: result.rowsAffected,
    };
  },

  async exec(sql: string): Promise<void> {
    await client.executeMultiple(sql);
  },

  async batch(stmts: Array<{ sql: string; args?: any[] }>): Promise<void> {
    await client.batch(
      stmts.map(s => ({ sql: s.sql, args: s.args || [] })),
      'write'
    );
  },
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, business_name TEXT, url TEXT, domain TEXT, email TEXT, phone TEXT, contact_name TEXT,
  category TEXT, city TEXT, tags TEXT DEFAULT '[]', source TEXT DEFAULT 'manual',
  score INTEGER DEFAULT 0, mobile_friendly INTEGER DEFAULT 1, ssl_valid INTEGER DEFAULT 1, copyright_year INTEGER,
  cms TEXT, cms_version TEXT, load_time REAL, outdated_tech TEXT DEFAULT '[]', analysis_error TEXT,
  stage TEXT DEFAULT 'new', priority TEXT DEFAULT 'medium', notes TEXT,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), last_contacted_at TEXT, next_followup_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_contacts_stage ON contacts(stage);
CREATE INDEX IF NOT EXISTS idx_contacts_score ON contacts(score DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_category ON contacts(category);
CREATE INDEX IF NOT EXISTS idx_contacts_city ON contacts(city);
CREATE INDEX IF NOT EXISTS idx_contacts_domain ON contacts(domain);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT, contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type TEXT NOT NULL, title TEXT NOT NULL, details TEXT, created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activities_contact ON activities(contact_id);
CREATE TABLE IF NOT EXISTS email_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, subject TEXT NOT NULL, body_html TEXT NOT NULL,
  body_text TEXT, category TEXT, variables TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, status TEXT DEFAULT 'draft',
  template_id INTEGER REFERENCES email_templates(id), filter_json TEXT, scheduled_at TEXT,
  total_recipients INTEGER DEFAULT 0, total_sent INTEGER DEFAULT 0, total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0, total_replied INTEGER DEFAULT 0, total_bounced INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')), completed_at TEXT
);
CREATE TABLE IF NOT EXISTS sent_emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id INTEGER REFERENCES campaigns(id),
  contact_id INTEGER NOT NULL REFERENCES contacts(id), template_id INTEGER REFERENCES email_templates(id),
  subject TEXT NOT NULL, to_email TEXT NOT NULL, status TEXT DEFAULT 'queued', tracking_id TEXT UNIQUE,
  opened_at TEXT, clicked_at TEXT, bounced_at TEXT, resend_id TEXT, error TEXT, sent_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sent_emails_campaign ON sent_emails(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sent_emails_contact ON sent_emails(contact_id);
CREATE INDEX IF NOT EXISTS idx_sent_emails_tracking ON sent_emails(tracking_id);
CREATE TABLE IF NOT EXISTS sequences (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sequence_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT, sequence_id INTEGER NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL, template_id INTEGER NOT NULL REFERENCES email_templates(id),
  delay_days INTEGER NOT NULL DEFAULT 3, condition TEXT, created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT, sequence_id INTEGER NOT NULL REFERENCES sequences(id),
  contact_id INTEGER NOT NULL REFERENCES contacts(id), current_step INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active', enrolled_at TEXT DEFAULT (datetime('now')), next_send_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_enrollments_next ON sequence_enrollments(next_send_at);
CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  title TEXT NOT NULL, due_at TEXT NOT NULL, completed INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_at);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  name TEXT, role TEXT DEFAULT 'admin', created_at TEXT DEFAULT (datetime('now'))
);
`;

// Initialize schema
export async function initDatabase() {
  await db.exec(SCHEMA);
  console.log('Database initialized (Turso)');
}

export default db;
