import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/connection';
import { renderTemplate } from './templates';

const router = Router();

// GET /api/campaigns
router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT c.*, t.name as template_name
    FROM campaigns c
    LEFT JOIN email_templates t ON c.template_id = t.id
    ORDER BY c.created_at DESC
  `).all();
  res.json(rows);
});

// GET /api/campaigns/:id
router.get('/:id', (req: Request, res: Response) => {
  const campaign = db.prepare(`
    SELECT c.*, t.name as template_name, t.subject as template_subject
    FROM campaigns c
    LEFT JOIN email_templates t ON c.template_id = t.id
    WHERE c.id = ?
  `).get(req.params.id);

  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const recipients = db.prepare(`
    SELECT se.*, co.business_name, co.domain, co.email
    FROM sent_emails se
    LEFT JOIN contacts co ON se.contact_id = co.id
    WHERE se.campaign_id = ?
    ORDER BY se.created_at DESC
  `).all(req.params.id);

  res.json({ ...(campaign as any), recipients });
});

// POST /api/campaigns
router.post('/', (req: Request, res: Response) => {
  const { name, template_id, filter_json, scheduled_at } = req.body;

  const result = db.prepare(`
    INSERT INTO campaigns (name, template_id, filter_json, scheduled_at)
    VALUES (?, ?, ?, ?)
  `).run(name, template_id, JSON.stringify(filter_json || {}), scheduled_at || null);

  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(campaign);
});

// POST /api/campaigns/:id/send - Execute campaign
router.post('/:id/send', (req: Request, res: Response) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id) as any;
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const template = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(campaign.template_id) as any;
  if (!template) return res.status(400).json({ error: 'Template not found' });

  // Build filter query for contacts
  const filters = JSON.parse(campaign.filter_json || '{}');
  let where = "WHERE email IS NOT NULL AND email != ''";
  const params: any[] = [];

  if (filters.stage) {
    const stages = Array.isArray(filters.stage) ? filters.stage : [filters.stage];
    where += ` AND stage IN (${stages.map(() => '?').join(',')})`;
    params.push(...stages);
  }
  if (filters.category) { where += ' AND category = ?'; params.push(filters.category); }
  if (filters.city) { where += ' AND city = ?'; params.push(filters.city); }
  if (filters.minScore) { where += ' AND score >= ?'; params.push(filters.minScore); }

  const contacts = db.prepare(`SELECT * FROM contacts ${where}`).all(...params);

  // Queue emails
  const insertEmail = db.prepare(`
    INSERT INTO sent_emails (campaign_id, contact_id, template_id, subject, to_email, tracking_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let queued = 0;
  for (const contact of contacts as any[]) {
    const rendered = renderTemplate(template.subject, template.body_html, contact);
    const trackingId = uuidv4();

    insertEmail.run(
      campaign.id, contact.id, template.id,
      rendered.subject, contact.email, trackingId
    );
    queued++;
  }

  // Update campaign
  db.prepare(`
    UPDATE campaigns SET status = 'running', total_recipients = ? WHERE id = ?
  `).run(queued, campaign.id);

  res.json({ queued, status: 'running' });
});

// PUT /api/campaigns/:id
router.put('/:id', (req: Request, res: Response) => {
  const { name, template_id, filter_json, status } = req.body;
  db.prepare(`
    UPDATE campaigns SET name = ?, template_id = ?, filter_json = ?, status = ? WHERE id = ?
  `).run(name, template_id, JSON.stringify(filter_json || {}), status || 'draft', req.params.id);

  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  res.json(campaign);
});

// DELETE /api/campaigns/:id
router.delete('/:id', (req: Request, res: Response) => {
  db.prepare('DELETE FROM sent_emails WHERE campaign_id = ?').run(req.params.id);
  db.prepare('DELETE FROM campaigns WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
