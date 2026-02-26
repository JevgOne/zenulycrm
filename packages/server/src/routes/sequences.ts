import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { enrollInSequence, cancelEnrollment } from '../services/sequence-service';

const router = Router();

// GET /api/sequences
router.get('/', (_req: Request, res: Response) => {
  const sequences = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM sequence_steps WHERE sequence_id = s.id) as step_count,
      (SELECT COUNT(*) FROM sequence_enrollments WHERE sequence_id = s.id AND status = 'active') as active_enrollments,
      (SELECT COUNT(*) FROM sequence_enrollments WHERE sequence_id = s.id AND status = 'completed') as completed_enrollments
    FROM sequences s ORDER BY s.created_at DESC
  `).all();
  res.json(sequences);
});

// GET /api/sequences/:id
router.get('/:id', (req: Request, res: Response) => {
  const sequence = db.prepare('SELECT * FROM sequences WHERE id = ?').get(req.params.id);
  if (!sequence) return res.status(404).json({ error: 'Sequence not found' });

  const steps = db.prepare(`
    SELECT ss.*, t.name as template_name, t.subject as template_subject
    FROM sequence_steps ss
    LEFT JOIN email_templates t ON ss.template_id = t.id
    WHERE ss.sequence_id = ?
    ORDER BY ss.step_order ASC
  `).all(req.params.id);

  const enrollments = db.prepare(`
    SELECT se.*, c.business_name, c.domain, c.email
    FROM sequence_enrollments se
    LEFT JOIN contacts c ON se.contact_id = c.id
    WHERE se.sequence_id = ?
    ORDER BY se.enrolled_at DESC
  `).all(req.params.id);

  res.json({ ...(sequence as any), steps, enrollments });
});

// POST /api/sequences
router.post('/', (req: Request, res: Response) => {
  const { name, description, steps } = req.body;

  const result = db.prepare(`
    INSERT INTO sequences (name, description) VALUES (?, ?)
  `).run(name, description || '');

  const seqId = result.lastInsertRowid;

  // Insert steps
  if (steps && steps.length > 0) {
    const insertStep = db.prepare(`
      INSERT INTO sequence_steps (sequence_id, step_order, template_id, delay_days, condition)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      insertStep.run(
        seqId, i, step.template_id,
        step.delay_days || 3,
        step.condition ? JSON.stringify(step.condition) : null
      );
    }
  }

  const sequence = db.prepare('SELECT * FROM sequences WHERE id = ?').get(seqId);
  res.status(201).json(sequence);
});

// PUT /api/sequences/:id
router.put('/:id', (req: Request, res: Response) => {
  const { name, description, is_active, steps } = req.body;

  db.prepare('UPDATE sequences SET name = ?, description = ?, is_active = ? WHERE id = ?')
    .run(name, description || '', is_active ?? 1, req.params.id);

  // Replace steps if provided
  if (steps) {
    db.prepare('DELETE FROM sequence_steps WHERE sequence_id = ?').run(req.params.id);

    const insertStep = db.prepare(`
      INSERT INTO sequence_steps (sequence_id, step_order, template_id, delay_days, condition)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      insertStep.run(
        req.params.id, i, step.template_id,
        step.delay_days || 3,
        step.condition ? JSON.stringify(step.condition) : null
      );
    }
  }

  const sequence = db.prepare('SELECT * FROM sequences WHERE id = ?').get(req.params.id);
  res.json(sequence);
});

// POST /api/sequences/:id/enroll - Enroll contacts
router.post('/:id/enroll', (req: Request, res: Response) => {
  const { contact_ids, filter } = req.body;

  let ids: number[] = contact_ids || [];

  // If filter provided, find matching contacts
  if (filter && !contact_ids) {
    let where = "WHERE email IS NOT NULL AND email != ''";
    const params: any[] = [];

    if (filter.stage) { where += ' AND stage = ?'; params.push(filter.stage); }
    if (filter.category) { where += ' AND category = ?'; params.push(filter.category); }
    if (filter.city) { where += ' AND city = ?'; params.push(filter.city); }
    if (filter.minScore) { where += ' AND score >= ?'; params.push(filter.minScore); }

    const contacts = db.prepare(`SELECT id FROM contacts ${where}`).all(...params) as any[];
    ids = contacts.map(c => c.id);
  }

  const enrolled = enrollInSequence(Number(req.params.id), ids);
  res.json({ enrolled, total: ids.length });
});

// POST /api/sequences/enrollments/:id/cancel
router.post('/enrollments/:id/cancel', (req: Request, res: Response) => {
  cancelEnrollment(Number(req.params.id));
  res.json({ ok: true });
});

// DELETE /api/sequences/:id
router.delete('/:id', (req: Request, res: Response) => {
  db.prepare('DELETE FROM sequence_enrollments WHERE sequence_id = ?').run(req.params.id);
  db.prepare('DELETE FROM sequence_steps WHERE sequence_id = ?').run(req.params.id);
  db.prepare('DELETE FROM sequences WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
