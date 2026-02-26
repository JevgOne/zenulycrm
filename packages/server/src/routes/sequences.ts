import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { enrollInSequence, cancelEnrollment } from '../services/sequence-service';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const sequences = await db.all(`
    SELECT s.*,
      (SELECT COUNT(*) FROM sequence_steps WHERE sequence_id = s.id) as step_count,
      (SELECT COUNT(*) FROM sequence_enrollments WHERE sequence_id = s.id AND status = 'active') as active_enrollments,
      (SELECT COUNT(*) FROM sequence_enrollments WHERE sequence_id = s.id AND status = 'completed') as completed_enrollments
    FROM sequences s ORDER BY s.created_at DESC
  `);
  res.json(sequences);
});

router.get('/:id', async (req: Request, res: Response) => {
  const sequence = await db.get('SELECT * FROM sequences WHERE id = ?', req.params.id);
  if (!sequence) return res.status(404).json({ error: 'Sequence not found' });

  const steps = await db.all(`
    SELECT ss.*, t.name as template_name, t.subject as template_subject
    FROM sequence_steps ss LEFT JOIN email_templates t ON ss.template_id = t.id
    WHERE ss.sequence_id = ? ORDER BY ss.step_order ASC
  `, req.params.id);

  const enrollments = await db.all(`
    SELECT se.*, c.business_name, c.domain, c.email
    FROM sequence_enrollments se LEFT JOIN contacts c ON se.contact_id = c.id
    WHERE se.sequence_id = ? ORDER BY se.enrolled_at DESC
  `, req.params.id);

  res.json({ ...sequence, steps, enrollments });
});

router.post('/', async (req: Request, res: Response) => {
  const { name, description, steps } = req.body;
  const result = await db.run('INSERT INTO sequences (name, description) VALUES (?, ?)', name, description || '');
  const seqId = result.lastInsertRowid;

  if (steps && steps.length > 0) {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      await db.run(`
        INSERT INTO sequence_steps (sequence_id, step_order, template_id, delay_days, condition) VALUES (?, ?, ?, ?, ?)
      `, seqId, i, step.template_id, step.delay_days || 3, step.condition ? JSON.stringify(step.condition) : null);
    }
  }

  const sequence = await db.get('SELECT * FROM sequences WHERE id = ?', seqId);
  res.status(201).json(sequence);
});

router.put('/:id', async (req: Request, res: Response) => {
  const { name, description, is_active, steps } = req.body;
  await db.run('UPDATE sequences SET name = ?, description = ?, is_active = ? WHERE id = ?',
    name, description || '', is_active ?? 1, req.params.id);

  if (steps) {
    await db.run('DELETE FROM sequence_steps WHERE sequence_id = ?', req.params.id);
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      await db.run(`
        INSERT INTO sequence_steps (sequence_id, step_order, template_id, delay_days, condition) VALUES (?, ?, ?, ?, ?)
      `, req.params.id, i, step.template_id, step.delay_days || 3, step.condition ? JSON.stringify(step.condition) : null);
    }
  }

  const sequence = await db.get('SELECT * FROM sequences WHERE id = ?', req.params.id);
  res.json(sequence);
});

router.post('/:id/enroll', async (req: Request, res: Response) => {
  const { contact_ids, filter } = req.body;
  let ids: number[] = contact_ids || [];

  if (filter && !contact_ids) {
    let where = "WHERE email IS NOT NULL AND email != ''";
    const params: any[] = [];
    if (filter.stage) { where += ' AND stage = ?'; params.push(filter.stage); }
    if (filter.category) { where += ' AND category = ?'; params.push(filter.category); }
    if (filter.city) { where += ' AND city = ?'; params.push(filter.city); }
    if (filter.minScore) { where += ' AND score >= ?'; params.push(filter.minScore); }
    const contacts = await db.all(`SELECT id FROM contacts ${where}`, ...params);
    ids = contacts.map((c: any) => c.id);
  }

  const enrolled = await enrollInSequence(Number(req.params.id), ids);
  res.json({ enrolled, total: ids.length });
});

router.post('/enrollments/:id/cancel', async (req: Request, res: Response) => {
  await cancelEnrollment(Number(req.params.id));
  res.json({ ok: true });
});

router.delete('/:id', async (req: Request, res: Response) => {
  await db.run('DELETE FROM sequence_enrollments WHERE sequence_id = ?', req.params.id);
  await db.run('DELETE FROM sequence_steps WHERE sequence_id = ?', req.params.id);
  await db.run('DELETE FROM sequences WHERE id = ?', req.params.id);
  res.json({ ok: true });
});

export default router;
