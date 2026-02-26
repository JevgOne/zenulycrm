import { Router, Request, Response } from 'express';
import db from '../db/connection';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const reminders = await db.all(`
    SELECT r.*, c.business_name, c.domain, c.email
    FROM reminders r LEFT JOIN contacts c ON r.contact_id = c.id
    WHERE r.completed = 0 ORDER BY r.due_at ASC LIMIT 50
  `);
  res.json(reminders);
});

router.post('/', async (req: Request, res: Response) => {
  const { contact_id, title, due_at } = req.body;
  const result = await db.run('INSERT INTO reminders (contact_id, title, due_at) VALUES (?, ?, ?)', contact_id, title, due_at);

  await db.run(`
    INSERT INTO activities (contact_id, type, title, details) VALUES (?, 'reminder', 'Připomínka nastavena', ?)
  `, contact_id, JSON.stringify({ title, due_at }));

  const reminder = await db.get('SELECT * FROM reminders WHERE id = ?', result.lastInsertRowid);
  res.status(201).json(reminder);
});

router.put('/:id/complete', async (req: Request, res: Response) => {
  await db.run('UPDATE reminders SET completed = 1 WHERE id = ?', req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', async (req: Request, res: Response) => {
  await db.run('DELETE FROM reminders WHERE id = ?', req.params.id);
  res.json({ ok: true });
});

export default router;
