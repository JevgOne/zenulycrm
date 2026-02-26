import { Router, Request, Response } from 'express';
import db from '../db/connection';

const router = Router();

// GET /api/contacts - List with filters
router.get('/', (req: Request, res: Response) => {
  const {
    stage, category, city, source, priority,
    minScore, maxScore, q, tag,
    sort = 'created_at', order = 'desc',
    page = '1', limit = '50'
  } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (stage) { where += ' AND stage = ?'; params.push(stage); }
  if (category) { where += ' AND category = ?'; params.push(category); }
  if (city) { where += ' AND city = ?'; params.push(city); }
  if (source) { where += ' AND source = ?'; params.push(source); }
  if (priority) { where += ' AND priority = ?'; params.push(priority); }
  if (minScore) { where += ' AND score >= ?'; params.push(Number(minScore)); }
  if (maxScore) { where += ' AND score <= ?'; params.push(Number(maxScore)); }
  if (tag) { where += ' AND tags LIKE ?'; params.push(`%"${tag}"%`); }
  if (q) {
    where += ' AND (business_name LIKE ? OR domain LIKE ? OR email LIKE ? OR contact_name LIKE ? OR city LIKE ?)';
    const search = `%${q}%`;
    params.push(search, search, search, search, search);
  }

  const allowedSorts = ['created_at', 'updated_at', 'score', 'business_name', 'stage', 'last_contacted_at'];
  const sortCol = allowedSorts.includes(sort as string) ? sort : 'created_at';
  const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

  const offset = (Number(page) - 1) * Number(limit);

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM contacts ${where}`).get(...params) as any;
  const rows = db.prepare(
    `SELECT * FROM contacts ${where} ORDER BY ${sortCol} ${sortOrder} LIMIT ? OFFSET ?`
  ).all(...params, Number(limit), offset);

  res.json({
    contacts: rows,
    total: countRow.total,
    page: Number(page),
    totalPages: Math.ceil(countRow.total / Number(limit))
  });
});

// GET /api/contacts/stages - Count per stage
router.get('/stages', (_req: Request, res: Response) => {
  const rows = db.prepare(
    'SELECT stage, COUNT(*) as count FROM contacts GROUP BY stage'
  ).all();
  res.json(rows);
});

// GET /api/contacts/categories - Distinct categories
router.get('/categories', (_req: Request, res: Response) => {
  const rows = db.prepare(
    'SELECT DISTINCT category FROM contacts WHERE category IS NOT NULL ORDER BY category'
  ).all();
  res.json(rows.map((r: any) => r.category));
});

// GET /api/contacts/cities - Distinct cities
router.get('/cities', (_req: Request, res: Response) => {
  const rows = db.prepare(
    'SELECT DISTINCT city FROM contacts WHERE city IS NOT NULL ORDER BY city'
  ).all();
  res.json(rows.map((r: any) => r.city));
});

// GET /api/contacts/:id - Single contact with activities
router.get('/:id', (req: Request, res: Response) => {
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  const activities = db.prepare(
    'SELECT * FROM activities WHERE contact_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(req.params.id);

  const emails = db.prepare(
    'SELECT * FROM sent_emails WHERE contact_id = ? ORDER BY created_at DESC LIMIT 20'
  ).all(req.params.id);

  res.json({ ...contact as any, activities, emails });
});

// POST /api/contacts - Create new contact
router.post('/', (req: Request, res: Response) => {
  const {
    business_name, url, domain, email, phone, contact_name,
    category, city, tags, source = 'manual',
    score, mobile_friendly, ssl_valid, copyright_year,
    cms, cms_version, load_time, outdated_tech,
    stage = 'new', priority = 'medium', notes
  } = req.body;

  const result = db.prepare(`
    INSERT INTO contacts (
      business_name, url, domain, email, phone, contact_name,
      category, city, tags, source,
      score, mobile_friendly, ssl_valid, copyright_year,
      cms, cms_version, load_time, outdated_tech,
      stage, priority, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    business_name, url, domain, email, phone, contact_name,
    category, city, JSON.stringify(tags || []), source,
    score || 0, mobile_friendly ?? 1, ssl_valid ?? 1, copyright_year,
    cms, cms_version, load_time, JSON.stringify(outdated_tech || []),
    stage, priority, notes
  );

  // Log activity
  db.prepare(`
    INSERT INTO activities (contact_id, type, title)
    VALUES (?, 'created', 'Kontakt vytvořen')
  `).run(result.lastInsertRowid);

  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(contact);
});

// PUT /api/contacts/:id - Update contact
router.put('/:id', (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Contact not found' });

  const fields = [
    'business_name', 'url', 'domain', 'email', 'phone', 'contact_name',
    'category', 'city', 'tags', 'source',
    'score', 'mobile_friendly', 'ssl_valid', 'copyright_year',
    'cms', 'cms_version', 'load_time', 'outdated_tech',
    'stage', 'priority', 'notes', 'next_followup_at'
  ];

  const updates: string[] = [];
  const values: any[] = [];

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      const val = (field === 'tags' || field === 'outdated_tech')
        ? JSON.stringify(req.body[field])
        : req.body[field];
      values.push(val);
    }
  }

  if (updates.length === 0) return res.json(existing);

  updates.push("updated_at = datetime('now')");
  values.push(req.params.id);

  db.prepare(`UPDATE contacts SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  // Log stage change
  if (req.body.stage && req.body.stage !== existing.stage) {
    db.prepare(`
      INSERT INTO activities (contact_id, type, title, details)
      VALUES (?, 'stage_change', ?, ?)
    `).run(
      req.params.id,
      `Pipeline: ${existing.stage} → ${req.body.stage}`,
      JSON.stringify({ from: existing.stage, to: req.body.stage })
    );
  }

  const updated = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// PATCH /api/contacts/:id/stage - Quick stage change
router.patch('/:id/stage', (req: Request, res: Response) => {
  const { stage } = req.body;
  const existing = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Contact not found' });

  db.prepare("UPDATE contacts SET stage = ?, updated_at = datetime('now') WHERE id = ?")
    .run(stage, req.params.id);

  if (stage === 'contacted') {
    db.prepare("UPDATE contacts SET last_contacted_at = datetime('now') WHERE id = ?")
      .run(req.params.id);
  }

  db.prepare(`
    INSERT INTO activities (contact_id, type, title, details)
    VALUES (?, 'stage_change', ?, ?)
  `).run(
    req.params.id,
    `Pipeline: ${existing.stage} → ${stage}`,
    JSON.stringify({ from: existing.stage, to: stage })
  );

  const updated = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// POST /api/contacts/:id/notes - Add note
router.post('/:id/notes', (req: Request, res: Response) => {
  const { text } = req.body;
  db.prepare(`
    INSERT INTO activities (contact_id, type, title, details)
    VALUES (?, 'note', 'Poznámka', ?)
  `).run(req.params.id, text);

  res.status(201).json({ ok: true });
});

// DELETE /api/contacts/:id
router.delete('/:id', (req: Request, res: Response) => {
  db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /api/contacts/bulk - Bulk actions
router.post('/bulk', (req: Request, res: Response) => {
  const { ids, action, value } = req.body;

  if (action === 'stage') {
    const stmt = db.prepare("UPDATE contacts SET stage = ?, updated_at = datetime('now') WHERE id = ?");
    for (const id of ids) {
      stmt.run(value, id);
    }
  } else if (action === 'delete') {
    const stmt = db.prepare('DELETE FROM contacts WHERE id = ?');
    for (const id of ids) {
      stmt.run(id);
    }
  } else if (action === 'priority') {
    const stmt = db.prepare("UPDATE contacts SET priority = ?, updated_at = datetime('now') WHERE id = ?");
    for (const id of ids) {
      stmt.run(value, id);
    }
  }

  res.json({ ok: true, affected: ids.length });
});

export default router;
