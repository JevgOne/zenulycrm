import { Router, Request, Response } from 'express';
import db from '../db/connection';

const router = Router();

// GET /api/reminders - upcoming reminders
router.get('/', (_req: Request, res: Response) => {
  const reminders = db.prepare(`
    SELECT r.*, c.business_name, c.domain, c.email
    FROM reminders r
    LEFT JOIN contacts c ON r.contact_id = c.id
    WHERE r.completed = 0
    ORDER BY r.due_at ASC
    LIMIT 50
  `).all();
  res.json(reminders);
});

// POST /api/reminders
router.post('/', (req: Request, res: Response) => {
  const { contact_id, title, due_at } = req.body;
  const result = db.prepare(`
    INSERT INTO reminders (contact_id, title, due_at) VALUES (?, ?, ?)
  `).run(contact_id, title, due_at);

  db.prepare(`
    INSERT INTO activities (contact_id, type, title, details)
    VALUES (?, 'reminder', 'Připomínka nastavena', ?)
  `).run(contact_id, JSON.stringify({ title, due_at }));

  const reminder = db.prepare('SELECT * FROM reminders WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(reminder);
});

// PUT /api/reminders/:id/complete
router.put('/:id/complete', (req: Request, res: Response) => {
  db.prepare('UPDATE reminders SET completed = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// DELETE /api/reminders/:id
router.delete('/:id', (req: Request, res: Response) => {
  db.prepare('DELETE FROM reminders WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
