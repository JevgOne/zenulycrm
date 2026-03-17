import { createClient, type Client } from '@libsql/client';

let client: Client;

function getClient(): Client {
  if (!client) {
    client = createClient({
      url: (process.env.TURSO_DATABASE_URL || 'file:./data/lead-crm.db').trim(),
      authToken: process.env.TURSO_AUTH_TOKEN?.trim(),
    });
  }
  return client;
}

// DB wrapper with convenience methods
export const db = {
  async get(sql: string, ...args: any[]): Promise<any> {
    const result = await getClient().execute({ sql, args });
    return result.rows[0] || null;
  },

  async all(sql: string, ...args: any[]): Promise<any[]> {
    const result = await getClient().execute({ sql, args });
    return result.rows as any[];
  },

  async run(sql: string, ...args: any[]): Promise<{ lastInsertRowid: number; changes: number }> {
    const result = await getClient().execute({ sql, args });
    return {
      lastInsertRowid: Number(result.lastInsertRowid),
      changes: result.rowsAffected,
    };
  },

  async exec(sql: string): Promise<void> {
    await getClient().executeMultiple(sql);
  },

  async batch(stmts: Array<{ sql: string; args?: any[] }>): Promise<void> {
    await getClient().batch(
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
  subject TEXT NOT NULL, to_email TEXT NOT NULL, body_html TEXT, body_text TEXT,
  status TEXT DEFAULT 'queued', tracking_id TEXT UNIQUE,
  opened_at TEXT, clicked_at TEXT, bounced_at TEXT, resend_id TEXT, error TEXT, sent_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS unsubscribes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE,
  reason TEXT, unsubscribed_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_unsubscribes_email ON unsubscribes(email);
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

// Migrations for existing databases
async function runMigrations() {
  const migrations = [
    'ALTER TABLE sent_emails ADD COLUMN body_html TEXT',
    'ALTER TABLE sent_emails ADD COLUMN body_text TEXT',
  ];
  for (const sql of migrations) {
    try { await db.run(sql); } catch { /* column already exists */ }
  }
}

// Seed default email templates + sequence
async function seedDefaults() {
  const existing = await db.get('SELECT COUNT(*) as c FROM email_templates');
  if (existing.c > 0) return;

  // Template 1: Cold Intro
  await db.run(`INSERT INTO email_templates (name, subject, body_html, body_text, category) VALUES (?, ?, ?, ?, ?)`,
    'Cold Intro',
    '{{firma}} - všiml jsem si něčeho na vašem webu',
    `<p>Dobrý den{{kontakt ? ', ' + kontakt : ''}},</p>
<p>při průzkumu firem v oblasti <strong>{{obor}}</strong> v {{mesto}} mě zaujaly vaše stránky <strong>{{web}}</strong>.</p>
<p>Všiml jsem si dvou věcí, které vás mohou stát zákazníky:</p>
{{problemy_html}}
<p>Vaše stránka získala <strong>{{score}}/100</strong> v testu zastaralosti — to znamená, že potenciální zákazníci mohou odcházet ke konkurenci s modernějším webem.</p>
<p>Stojí vám to za 15 minut? Rád vám ukážu, co konkrétně zlepšit.</p>
<p>S pozdravem,<br/>{{odesilatel}}<br/>Weblyx.cz | info@weblyx.cz</p>`,
    'Dobrý den,\n\npři průzkumu firem v oblasti {{obor}} v {{mesto}} mě zaujaly vaše stránky {{web}}.\n\nVšiml jsem si dvou věcí, které vás mohou stát zákazníky:\n\n{{problemy}}\n\nVaše stránka získala {{score}}/100 v testu zastaralosti.\n\nStojí vám to za 15 minut? Rád vám ukážu, co konkrétně zlepšit.\n\nS pozdravem,\n{{odesilatel}}\nWeblyx.cz | info@weblyx.cz',
    'cold-outreach'
  );

  // Template 2: Follow-up s hodnotou
  await db.run(`INSERT INTO email_templates (name, subject, body_html, body_text, category) VALUES (?, ?, ?, ?, ?)`,
    'Follow-up s tipem',
    'Re: {{firma}} - konkrétní tip pro váš web',
    `<p>Dobrý den{{kontakt ? ', ' + kontakt : ''}},</p>
<p>navazuji na svůj předchozí email ohledně vašeho webu {{web}}.</p>
<p>Nechci jen upozorňovat na problémy — tady je <strong>konkrétní tip</strong>, který můžete udělat sami:</p>
<p>{{mobilni}} — pokud váš web není optimalizovaný pro mobily, přicházíte až o <strong>60 % návštěvníků</strong>. Zkontrolujte si to na <em>Google Mobile-Friendly Test</em>.</p>
<p>Pokud byste chtěl kompletní modernizaci webu (od 7 900 Kč), rád vám připravím nezávazný návrh.</p>
<p>Stačí odpovědět jedním slovem „zájem".</p>
<p>{{odesilatel}}<br/>Weblyx.cz</p>`,
    'Dobrý den,\n\nnavazuji na svůj předchozí email ohledně vašeho webu {{web}}.\n\nNechci jen upozorňovat na problémy — tady je konkrétní tip:\n\n{{mobilni}} — pokud váš web není optimalizovaný pro mobily, přicházíte až o 60 % návštěvníků.\n\nPokud byste chtěl kompletní modernizaci webu (od 7 900 Kč), rád vám připravím nezávazný návrh.\n\nStačí odpovědět jedním slovem „zájem".\n\n{{odesilatel}}\nWeblyx.cz',
    'follow-up'
  );

  // Template 3: Nabídka s mockupem/PDF
  await db.run(`INSERT INTO email_templates (name, subject, body_html, body_text, category) VALUES (?, ?, ?, ?, ?)`,
    'Nabídka s návrhem',
    '{{firma}} - připravil jsem vám návrh nového webu',
    `<p>Dobrý den{{kontakt ? ', ' + kontakt : ''}},</p>
<p>protože jsem viděl potenciál ve vašem podnikání, připravil jsem <strong>nezávazný návrh</strong>, jak by mohl vypadat váš nový web.</p>
<p>V příloze najdete:</p>
<ul>
<li>Analýzu současného stavu vašeho webu</li>
<li>Návrh moderního redesignu</li>
<li>Naše cenové balíčky (od 7 900 Kč)</li>
</ul>
<p>Podívejte se a dejte mi vědět, co si myslíte — stačí krátká odpověď.</p>
<p>{{odesilatel}}<br/>Weblyx.cz | info@weblyx.cz</p>`,
    'Dobrý den,\n\nprotože jsem viděl potenciál ve vašem podnikání, připravil jsem nezávazný návrh, jak by mohl vypadat váš nový web.\n\nV příloze najdete:\n- Analýzu současného stavu vašeho webu\n- Návrh moderního redesignu\n- Naše cenové balíčky (od 7 900 Kč)\n\nPodívejte se a dejte mi vědět, co si myslíte.\n\n{{odesilatel}}\nWeblyx.cz | info@weblyx.cz',
    'nabidka'
  );

  // Template 4: Breakup email
  await db.run(`INSERT INTO email_templates (name, subject, body_html, body_text, category) VALUES (?, ?, ?, ?, ?)`,
    'Poslední zpráva',
    '{{firma}} - poslední zpráva ode mě',
    `<p>Dobrý den{{kontakt ? ', ' + kontakt : ''}},</p>
<p>chápu, že máte plno práce, a nechci vás dále obtěžovat.</p>
<p>Pokud někdy budete přemýšlet o modernizaci webu, budu rád, když se ozvete. Nabídka bezplatné konzultace platí.</p>
<p>Přeji hodně úspěchů v podnikání.</p>
<p>{{odesilatel}}<br/>Weblyx.cz | info@weblyx.cz</p>`,
    'Dobrý den,\n\nchápu, že máte plno práce, a nechci vás dále obtěžovat.\n\nPokud někdy budete přemýšlet o modernizaci webu, budu rád, když se ozvete. Nabídka bezplatné konzultace platí.\n\nPřeji hodně úspěchů v podnikání.\n\n{{odesilatel}}\nWeblyx.cz | info@weblyx.cz',
    'breakup'
  );

  // Default sequence with 4 steps
  const seqResult = await db.run(`INSERT INTO sequences (name, description) VALUES (?, ?)`,
    'Výchozí outreach sekvence',
    'Cold intro → Follow-up tip → Nabídka s návrhem → Breakup email'
  );
  const seqId = seqResult.lastInsertRowid;
  const templates = await db.all('SELECT id, category FROM email_templates ORDER BY id ASC LIMIT 4');
  const delays = [0, 3, 4, 7];
  for (let i = 0; i < templates.length; i++) {
    await db.run(
      'INSERT INTO sequence_steps (sequence_id, step_order, template_id, delay_days, condition) VALUES (?, ?, ?, ?, ?)',
      seqId, i, templates[i].id, delays[i],
      i > 0 ? JSON.stringify({ skip_if_replied: true }) : null
    );
  }

  console.log('Default templates and sequence seeded');
}

// Initialize schema
export async function initDatabase() {
  await db.exec(SCHEMA);
  await runMigrations();
  await seedDefaults();
  console.log('Database initialized (Turso)');
}

export default db;
