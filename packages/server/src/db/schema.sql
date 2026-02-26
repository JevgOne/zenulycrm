-- Weblyx Lead CRM - Database Schema

CREATE TABLE IF NOT EXISTS contacts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Identity
  business_name   TEXT,
  url             TEXT,
  domain          TEXT,
  email           TEXT,
  phone           TEXT,
  contact_name    TEXT,
  -- Classification
  category        TEXT,
  city            TEXT,
  tags            TEXT DEFAULT '[]',
  source          TEXT DEFAULT 'manual',
  -- Website analysis (from Python lead-finder)
  score           INTEGER DEFAULT 0,
  mobile_friendly INTEGER DEFAULT 1,
  ssl_valid       INTEGER DEFAULT 1,
  copyright_year  INTEGER,
  cms             TEXT,
  cms_version     TEXT,
  load_time       REAL,
  outdated_tech   TEXT DEFAULT '[]',
  analysis_error  TEXT,
  -- Pipeline
  stage           TEXT DEFAULT 'new',
  priority        TEXT DEFAULT 'medium',
  -- Notes
  notes           TEXT,
  -- Timestamps
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now')),
  last_contacted_at TEXT,
  next_followup_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_contacts_stage ON contacts(stage);
CREATE INDEX IF NOT EXISTS idx_contacts_score ON contacts(score DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_category ON contacts(category);
CREATE INDEX IF NOT EXISTS idx_contacts_city ON contacts(city);
CREATE INDEX IF NOT EXISTS idx_contacts_domain ON contacts(domain);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);

-- Activity log (timeline per contact)
CREATE TABLE IF NOT EXISTS activities (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  details    TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_activities_contact ON activities(contact_id);

-- Email templates
CREATE TABLE IF NOT EXISTS email_templates (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  subject    TEXT NOT NULL,
  body_html  TEXT NOT NULL,
  body_text  TEXT,
  category   TEXT,
  variables  TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Email campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT NOT NULL,
  status           TEXT DEFAULT 'draft',
  template_id      INTEGER REFERENCES email_templates(id),
  filter_json      TEXT,
  scheduled_at     TEXT,
  total_recipients INTEGER DEFAULT 0,
  total_sent       INTEGER DEFAULT 0,
  total_opened     INTEGER DEFAULT 0,
  total_clicked    INTEGER DEFAULT 0,
  total_replied    INTEGER DEFAULT 0,
  total_bounced    INTEGER DEFAULT 0,
  created_at       TEXT DEFAULT (datetime('now')),
  completed_at     TEXT
);

-- Individual sent emails
CREATE TABLE IF NOT EXISTS sent_emails (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id  INTEGER REFERENCES campaigns(id),
  contact_id   INTEGER NOT NULL REFERENCES contacts(id),
  template_id  INTEGER REFERENCES email_templates(id),
  subject      TEXT NOT NULL,
  to_email     TEXT NOT NULL,
  status       TEXT DEFAULT 'queued',
  tracking_id  TEXT UNIQUE,
  opened_at    TEXT,
  clicked_at   TEXT,
  bounced_at   TEXT,
  resend_id    TEXT,
  error        TEXT,
  sent_at      TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sent_emails_campaign ON sent_emails(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sent_emails_contact ON sent_emails(contact_id);
CREATE INDEX IF NOT EXISTS idx_sent_emails_tracking ON sent_emails(tracking_id);

-- Follow-up sequences
CREATE TABLE IF NOT EXISTS sequences (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT,
  is_active   INTEGER DEFAULT 1,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sequence_steps (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  sequence_id  INTEGER NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  step_order   INTEGER NOT NULL,
  template_id  INTEGER NOT NULL REFERENCES email_templates(id),
  delay_days   INTEGER NOT NULL DEFAULT 3,
  condition    TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  sequence_id   INTEGER NOT NULL REFERENCES sequences(id),
  contact_id    INTEGER NOT NULL REFERENCES contacts(id),
  current_step  INTEGER DEFAULT 0,
  status        TEXT DEFAULT 'active',
  enrolled_at   TEXT DEFAULT (datetime('now')),
  next_send_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_enrollments_next ON sequence_enrollments(next_send_at);

-- Reminders
CREATE TABLE IF NOT EXISTS reminders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  due_at     TEXT NOT NULL,
  completed  INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_at);

-- Users (for auth)
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT,
  role          TEXT DEFAULT 'admin',
  created_at    TEXT DEFAULT (datetime('now'))
);
