import { v4 as uuidv4 } from 'uuid';
import db from '../db/connection';
import { renderTemplate } from '../routes/templates';
import { sendEmail } from './email-service';

export async function enrollInSequence(sequenceId: number, contactIds: number[]) {
  const sequence = await db.get('SELECT * FROM sequences WHERE id = ? AND is_active = 1', sequenceId);
  if (!sequence) throw new Error('Sequence not found or inactive');

  const firstStep = await db.get('SELECT * FROM sequence_steps WHERE sequence_id = ? ORDER BY step_order ASC LIMIT 1', sequenceId);
  if (!firstStep) throw new Error('Sequence has no steps');

  let enrolled = 0;
  for (const contactId of contactIds) {
    const existing = await db.get(
      "SELECT id FROM sequence_enrollments WHERE sequence_id = ? AND contact_id = ? AND status = 'active'",
      sequenceId, contactId
    );

    if (!existing) {
      await db.run(
        "INSERT INTO sequence_enrollments (sequence_id, contact_id, current_step, next_send_at) VALUES (?, ?, 0, datetime('now', '+' || ? || ' days'))",
        sequenceId, contactId, firstStep.delay_days
      );
      enrolled++;

      await db.run(`
        INSERT INTO activities (contact_id, type, title, details) VALUES (?, 'sequence_enrolled', 'Přidán do sekvence', ?)
      `, contactId, JSON.stringify({ sequence: sequence.name }));
    }
  }

  return enrolled;
}

export async function processSequences(): Promise<number> {
  const due = await db.all(`
    SELECT se.*, s.name as sequence_name
    FROM sequence_enrollments se JOIN sequences s ON se.sequence_id = s.id
    WHERE se.status = 'active' AND se.next_send_at <= datetime('now') AND s.is_active = 1
  `);

  let processed = 0;

  for (const enrollment of due) {
    const steps = await db.all(
      'SELECT * FROM sequence_steps WHERE sequence_id = ? ORDER BY step_order ASC',
      enrollment.sequence_id
    );

    if (enrollment.current_step >= steps.length) {
      await db.run("UPDATE sequence_enrollments SET status = 'completed' WHERE id = ?", enrollment.id);
      continue;
    }

    const step = steps[enrollment.current_step];
    const contact = await db.get('SELECT * FROM contacts WHERE id = ?', enrollment.contact_id);

    if (!contact || !contact.email) {
      await db.run("UPDATE sequence_enrollments SET status = 'cancelled' WHERE id = ?", enrollment.id);
      continue;
    }

    if (step.condition) {
      const cond = JSON.parse(step.condition);
      if (cond.skip_if_replied && contact.stage === 'responded') {
        await db.run("UPDATE sequence_enrollments SET status = 'completed' WHERE id = ?", enrollment.id);
        continue;
      }
      if (cond.skip_if_opened) {
        const hasOpened = await db.get("SELECT id FROM sent_emails WHERE contact_id = ? AND opened_at IS NOT NULL LIMIT 1", contact.id);
        if (hasOpened) {
          await db.run("UPDATE sequence_enrollments SET status = 'completed' WHERE id = ?", enrollment.id);
          continue;
        }
      }
    }

    if (['responded', 'meeting', 'client'].includes(contact.stage)) {
      await db.run("UPDATE sequence_enrollments SET status = 'completed' WHERE id = ?", enrollment.id);
      continue;
    }

    const template = await db.get('SELECT * FROM email_templates WHERE id = ?', step.template_id);
    if (!template) continue;

    const rendered = renderTemplate(template.subject, template.body_html, contact);
    const trackingId = uuidv4();

    const emailResult = await db.run(`
      INSERT INTO sent_emails (contact_id, template_id, subject, to_email, tracking_id) VALUES (?, ?, ?, ?, ?)
    `, contact.id, template.id, rendered.subject, contact.email, trackingId);

    await sendEmail(emailResult.lastInsertRowid);

    if (contact.stage === 'new') {
      await db.run("UPDATE contacts SET stage = 'contacted', updated_at = datetime('now') WHERE id = ?", contact.id);
    }

    const nextStep = enrollment.current_step + 1;
    if (nextStep >= steps.length) {
      await db.run("UPDATE sequence_enrollments SET current_step = ?, status = 'completed' WHERE id = ?", nextStep, enrollment.id);
    } else {
      const nextDelay = steps[nextStep].delay_days;
      await db.run(
        "UPDATE sequence_enrollments SET current_step = ?, next_send_at = datetime('now', '+' || ? || ' days') WHERE id = ?",
        nextStep, nextDelay, enrollment.id
      );
    }

    processed++;
  }

  return processed;
}

export async function cancelEnrollment(enrollmentId: number) {
  await db.run("UPDATE sequence_enrollments SET status = 'cancelled' WHERE id = ?", enrollmentId);
}
