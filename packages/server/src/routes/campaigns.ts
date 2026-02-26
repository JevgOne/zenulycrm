import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/connection';
import { renderTemplate } from './templates';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const rows = await db.all(`
    SELECT c.*, t.name as template_name
    FROM campaigns c LEFT JOIN email_templates t ON c.template_id = t.id
    ORDER BY c.created_at DESC
  `);
  res.json(rows);
});

router.get('/:id', async (req: Request, res: Response) => {
  const campaign = await db.get(`
    SELECT c.*, t.name as template_name, t.subject as template_subject
    FROM campaigns c LEFT JOIN email_templates t ON c.template_id = t.id WHERE c.id = ?
  `, req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const recipients = await db.all(`
    SELECT se.*, co.business_name, co.domain, co.email
    FROM sent_emails se LEFT JOIN contacts co ON se.contact_id = co.id
    WHERE se.campaign_id = ? ORDER BY se.created_at DESC
  `, req.params.id);

  res.json({ ...campaign, recipients });
});

router.post('/', async (req: Request, res: Response) => {
  const { name, template_id, filter_json, scheduled_at } = req.body;
  const result = await db.run(`
    INSERT INTO campaigns (name, template_id, filter_json, scheduled_at) VALUES (?, ?, ?, ?)
  `, name, template_id, JSON.stringify(filter_json || {}), scheduled_at || null);

  const campaign = await db.get('SELECT * FROM campaigns WHERE id = ?', result.lastInsertRowid);
  res.status(201).json(campaign);
});

router.post('/:id/send', async (req: Request, res: Response) => {
  const campaign = await db.get('SELECT * FROM campaigns WHERE id = ?', req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const template = await db.get('SELECT * FROM email_templates WHERE id = ?', campaign.template_id);
  if (!template) return res.status(400).json({ error: 'Template not found' });

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

  const contacts = await db.all(`SELECT * FROM contacts ${where}`, ...params);

  let queued = 0;
  for (const contact of contacts) {
    const rendered = renderTemplate(template.subject, template.body_html, contact);
    const trackingId = uuidv4();
    await db.run(`
      INSERT INTO sent_emails (campaign_id, contact_id, template_id, subject, to_email, tracking_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `, campaign.id, contact.id, template.id, rendered.subject, contact.email, trackingId);
    queued++;
  }

  await db.run("UPDATE campaigns SET status = 'running', total_recipients = ? WHERE id = ?", queued, campaign.id);
  res.json({ queued, status: 'running' });
});

router.put('/:id', async (req: Request, res: Response) => {
  const { name, template_id, filter_json, status } = req.body;
  await db.run(`
    UPDATE campaigns SET name = ?, template_id = ?, filter_json = ?, status = ? WHERE id = ?
  `, name, template_id, JSON.stringify(filter_json || {}), status || 'draft', req.params.id);

  const campaign = await db.get('SELECT * FROM campaigns WHERE id = ?', req.params.id);
  res.json(campaign);
});

router.delete('/:id', async (req: Request, res: Response) => {
  await db.run('DELETE FROM sent_emails WHERE campaign_id = ?', req.params.id);
  await db.run('DELETE FROM campaigns WHERE id = ?', req.params.id);
  res.json({ ok: true });
});

export default router;
