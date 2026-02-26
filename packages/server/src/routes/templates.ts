import { Router, Request, Response } from 'express';
import db from '../db/connection';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const rows = await db.all('SELECT * FROM email_templates ORDER BY created_at DESC');
  res.json(rows);
});

router.get('/:id', async (req: Request, res: Response) => {
  const row = await db.get('SELECT * FROM email_templates WHERE id = ?', req.params.id);
  if (!row) return res.status(404).json({ error: 'Template not found' });
  res.json(row);
});

router.post('/', async (req: Request, res: Response) => {
  const { name, subject, body_html, body_text, category, variables } = req.body;
  const result = await db.run(`
    INSERT INTO email_templates (name, subject, body_html, body_text, category, variables) VALUES (?, ?, ?, ?, ?, ?)
  `, name, subject, body_html, body_text || '', category || null, JSON.stringify(variables || []));

  const template = await db.get('SELECT * FROM email_templates WHERE id = ?', result.lastInsertRowid);
  res.status(201).json(template);
});

router.put('/:id', async (req: Request, res: Response) => {
  const { name, subject, body_html, body_text, category, variables } = req.body;
  await db.run(`
    UPDATE email_templates SET name = ?, subject = ?, body_html = ?, body_text = ?,
    category = ?, variables = ?, updated_at = datetime('now') WHERE id = ?
  `, name, subject, body_html, body_text || '', category || null, JSON.stringify(variables || []), req.params.id);

  const template = await db.get('SELECT * FROM email_templates WHERE id = ?', req.params.id);
  res.json(template);
});

router.delete('/:id', async (req: Request, res: Response) => {
  await db.run('DELETE FROM email_templates WHERE id = ?', req.params.id);
  res.json({ ok: true });
});

router.post('/:id/preview', async (req: Request, res: Response) => {
  const template = await db.get('SELECT * FROM email_templates WHERE id = ?', req.params.id);
  if (!template) return res.status(404).json({ error: 'Template not found' });

  const { contact_id } = req.body;
  let contact: any;

  if (contact_id) {
    contact = await db.get('SELECT * FROM contacts WHERE id = ?', contact_id);
  } else {
    contact = await db.get('SELECT * FROM contacts WHERE score > 0 ORDER BY score DESC LIMIT 1');
  }

  if (!contact) {
    contact = {
      business_name: 'Vzorová Firma', domain: 'priklad.cz', url: 'https://priklad.cz',
      city: 'Praha', category: 'kadeřnictví', score: 65,
      mobile_friendly: 0, ssl_valid: 0, copyright_year: 2017, load_time: 5.2,
      outdated_tech: '["Old jQuery 1.7", "Missing OpenGraph tags"]',
    };
  }

  const rendered = renderTemplate(template.subject, template.body_html, contact);
  res.json(rendered);
});

function renderTemplate(subject: string, body: string, contact: any) {
  const outdatedTech = typeof contact.outdated_tech === 'string'
    ? JSON.parse(contact.outdated_tech || '[]') : (contact.outdated_tech || []);

  const issuesList = outdatedTech.map((t: string) => `• ${t}`).join('\n');
  const issuesHtml = outdatedTech.map((t: string) => `<li>${t}</li>`).join('');

  const vars: Record<string, string> = {
    firma: contact.business_name || contact.domain || '',
    web: contact.domain || '', url: contact.url || '',
    kontakt: contact.contact_name || '', email: contact.email || '',
    mesto: contact.city || '', obor: contact.category || '',
    score: String(contact.score || 0), problemy: issuesList,
    problemy_html: issuesHtml ? `<ul>${issuesHtml}</ul>` : '',
    pocet_problemu: String(outdatedTech.length),
    copyright: String(contact.copyright_year || ''), cms: contact.cms || '',
    rychlost: contact.load_time ? `${contact.load_time}s` : '',
    mobilni: contact.mobile_friendly ? 'je optimalizována pro mobily' : 'není optimalizována pro mobily',
    ssl: contact.ssl_valid ? 'má platný SSL' : 'nemá SSL certifikát',
    odesilatel: process.env.SENDER_NAME || 'Weblyx', firma_odesilatel: 'Weblyx',
  };

  let renderedSubject = subject;
  let renderedBody = body;
  for (const [key, value] of Object.entries(vars)) {
    renderedSubject = renderedSubject.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    renderedBody = renderedBody.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return { subject: renderedSubject, body: renderedBody };
}

export { renderTemplate };
export default router;
