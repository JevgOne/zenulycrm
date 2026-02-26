import { Router, Request, Response } from 'express';
import db from '../db/connection';

const router = Router();

// GET /api/contacts - List with filters
router.get('/', async (req: Request, res: Response) => {
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

  const countRow = await db.get(`SELECT COUNT(*) as total FROM contacts ${where}`, ...params);
  const rows = await db.all(
    `SELECT * FROM contacts ${where} ORDER BY ${sortCol} ${sortOrder} LIMIT ? OFFSET ?`,
    ...params, Number(limit), offset
  );

  res.json({
    contacts: rows,
    total: countRow.total,
    page: Number(page),
    totalPages: Math.ceil(countRow.total / Number(limit))
  });
});

// GET /api/contacts/stages - Count per stage
router.get('/stages', async (_req: Request, res: Response) => {
  const rows = await db.all('SELECT stage, COUNT(*) as count FROM contacts GROUP BY stage');
  res.json(rows);
});

// GET /api/contacts/categories
router.get('/categories', async (_req: Request, res: Response) => {
  const rows = await db.all('SELECT DISTINCT category FROM contacts WHERE category IS NOT NULL ORDER BY category');
  res.json(rows.map((r: any) => r.category));
});

// GET /api/contacts/cities
router.get('/cities', async (_req: Request, res: Response) => {
  const rows = await db.all('SELECT DISTINCT city FROM contacts WHERE city IS NOT NULL ORDER BY city');
  res.json(rows.map((r: any) => r.city));
});

// GET /api/contacts/:id
router.get('/:id', async (req: Request, res: Response) => {
  const contact = await db.get('SELECT * FROM contacts WHERE id = ?', req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  const activities = await db.all(
    'SELECT * FROM activities WHERE contact_id = ? ORDER BY created_at DESC LIMIT 50', req.params.id
  );
  const emails = await db.all(
    'SELECT * FROM sent_emails WHERE contact_id = ? ORDER BY created_at DESC LIMIT 20', req.params.id
  );

  res.json({ ...contact, activities, emails });
});

// POST /api/contacts
router.post('/', async (req: Request, res: Response) => {
  const {
    business_name, url, domain, email, phone, contact_name,
    category, city, tags, source = 'manual',
    score, mobile_friendly, ssl_valid, copyright_year,
    cms, cms_version, load_time, outdated_tech,
    stage = 'new', priority = 'medium', notes
  } = req.body;

  const result = await db.run(`
    INSERT INTO contacts (
      business_name, url, domain, email, phone, contact_name,
      category, city, tags, source,
      score, mobile_friendly, ssl_valid, copyright_year,
      cms, cms_version, load_time, outdated_tech,
      stage, priority, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    business_name, url, domain, email, phone, contact_name,
    category, city, JSON.stringify(tags || []), source,
    score || 0, mobile_friendly ?? 1, ssl_valid ?? 1, copyright_year,
    cms, cms_version, load_time, JSON.stringify(outdated_tech || []),
    stage, priority, notes
  );

  await db.run(`
    INSERT INTO activities (contact_id, type, title) VALUES (?, 'created', 'Kontakt vytvořen')
  `, result.lastInsertRowid);

  const contact = await db.get('SELECT * FROM contacts WHERE id = ?', result.lastInsertRowid);
  res.status(201).json(contact);
});

// PUT /api/contacts/:id
router.put('/:id', async (req: Request, res: Response) => {
  const existing = await db.get('SELECT * FROM contacts WHERE id = ?', req.params.id);
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
        ? JSON.stringify(req.body[field]) : req.body[field];
      values.push(val);
    }
  }

  if (updates.length === 0) return res.json(existing);

  updates.push("updated_at = datetime('now')");
  values.push(req.params.id);

  await db.run(`UPDATE contacts SET ${updates.join(', ')} WHERE id = ?`, ...values);

  if (req.body.stage && req.body.stage !== existing.stage) {
    await db.run(`
      INSERT INTO activities (contact_id, type, title, details) VALUES (?, 'stage_change', ?, ?)
    `, req.params.id, `Pipeline: ${existing.stage} → ${req.body.stage}`,
      JSON.stringify({ from: existing.stage, to: req.body.stage }));
  }

  const updated = await db.get('SELECT * FROM contacts WHERE id = ?', req.params.id);
  res.json(updated);
});

// PATCH /api/contacts/:id/stage
router.patch('/:id/stage', async (req: Request, res: Response) => {
  const { stage } = req.body;
  const existing = await db.get('SELECT * FROM contacts WHERE id = ?', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Contact not found' });

  await db.run("UPDATE contacts SET stage = ?, updated_at = datetime('now') WHERE id = ?", stage, req.params.id);

  if (stage === 'contacted') {
    await db.run("UPDATE contacts SET last_contacted_at = datetime('now') WHERE id = ?", req.params.id);
  }

  await db.run(`
    INSERT INTO activities (contact_id, type, title, details) VALUES (?, 'stage_change', ?, ?)
  `, req.params.id, `Pipeline: ${existing.stage} → ${stage}`,
    JSON.stringify({ from: existing.stage, to: stage }));

  const updated = await db.get('SELECT * FROM contacts WHERE id = ?', req.params.id);
  res.json(updated);
});

// POST /api/contacts/:id/notes
router.post('/:id/notes', async (req: Request, res: Response) => {
  const { text } = req.body;
  await db.run(`
    INSERT INTO activities (contact_id, type, title, details) VALUES (?, 'note', 'Poznámka', ?)
  `, req.params.id, text);
  res.status(201).json({ ok: true });
});

// DELETE /api/contacts/:id
router.delete('/:id', async (req: Request, res: Response) => {
  await db.run('DELETE FROM contacts WHERE id = ?', req.params.id);
  res.json({ ok: true });
});

// POST /api/contacts/bulk
router.post('/bulk', async (req: Request, res: Response) => {
  const { ids, action, value } = req.body;

  for (const id of ids) {
    if (action === 'stage') {
      await db.run("UPDATE contacts SET stage = ?, updated_at = datetime('now') WHERE id = ?", value, id);
    } else if (action === 'delete') {
      await db.run('DELETE FROM contacts WHERE id = ?', id);
    } else if (action === 'priority') {
      await db.run("UPDATE contacts SET priority = ?, updated_at = datetime('now') WHERE id = ?", value, id);
    }
  }

  res.json({ ok: true, affected: ids.length });
});

export default router;
