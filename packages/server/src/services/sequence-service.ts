/**
 * Sequence Service - handles automated follow-up sequences
 */
import { v4 as uuidv4 } from 'uuid';
import db from '../db/connection';
import { renderTemplate } from '../routes/templates';
import { sendEmail } from './email-service';

export function enrollInSequence(sequenceId: number, contactIds: number[]) {
  const sequence = db.prepare('SELECT * FROM sequences WHERE id = ? AND is_active = 1').get(sequenceId) as any;
  if (!sequence) throw new Error('Sequence not found or inactive');

  const firstStep = db.prepare(
    'SELECT * FROM sequence_steps WHERE sequence_id = ? ORDER BY step_order ASC LIMIT 1'
  ).get(sequenceId) as any;

  if (!firstStep) throw new Error('Sequence has no steps');

  const insertEnrollment = db.prepare(`
    INSERT INTO sequence_enrollments (sequence_id, contact_id, current_step, next_send_at)
    VALUES (?, ?, 0, datetime('now', '+' || ? || ' days'))
  `);

  let enrolled = 0;
  for (const contactId of contactIds) {
    // Check not already enrolled
    const existing = db.prepare(
      "SELECT id FROM sequence_enrollments WHERE sequence_id = ? AND contact_id = ? AND status = 'active'"
    ).get(sequenceId, contactId);

    if (!existing) {
      insertEnrollment.run(sequenceId, contactId, firstStep.delay_days);
      enrolled++;

      db.prepare(`
        INSERT INTO activities (contact_id, type, title, details)
        VALUES (?, 'sequence_enrolled', 'Přidán do sekvence', ?)
      `).run(contactId, JSON.stringify({ sequence: sequence.name }));
    }
  }

  return enrolled;
}

export function processSequences(): number {
  // Find enrollments that are due
  const due = db.prepare(`
    SELECT se.*, s.name as sequence_name
    FROM sequence_enrollments se
    JOIN sequences s ON se.sequence_id = s.id
    WHERE se.status = 'active'
      AND se.next_send_at <= datetime('now')
      AND s.is_active = 1
  `).all() as any[];

  let processed = 0;

  for (const enrollment of due) {
    // Get current step
    const steps = db.prepare(
      'SELECT * FROM sequence_steps WHERE sequence_id = ? ORDER BY step_order ASC'
    ).all(enrollment.sequence_id) as any[];

    if (enrollment.current_step >= steps.length) {
      // Sequence complete
      db.prepare("UPDATE sequence_enrollments SET status = 'completed' WHERE id = ?")
        .run(enrollment.id);
      continue;
    }

    const step = steps[enrollment.current_step];
    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(enrollment.contact_id) as any;

    if (!contact || !contact.email) {
      db.prepare("UPDATE sequence_enrollments SET status = 'cancelled' WHERE id = ?")
        .run(enrollment.id);
      continue;
    }

    // Check conditions - skip if contact already responded
    if (step.condition) {
      const cond = JSON.parse(step.condition);
      if (cond.skip_if_replied && contact.stage === 'responded') {
        db.prepare("UPDATE sequence_enrollments SET status = 'completed' WHERE id = ?")
          .run(enrollment.id);
        continue;
      }
      if (cond.skip_if_opened) {
        const hasOpened = db.prepare(
          "SELECT id FROM sent_emails WHERE contact_id = ? AND opened_at IS NOT NULL LIMIT 1"
        ).get(contact.id);
        if (hasOpened) {
          db.prepare("UPDATE sequence_enrollments SET status = 'completed' WHERE id = ?")
            .run(enrollment.id);
          continue;
        }
      }
    }

    // Check if contact moved past 'contacted' stage - stop sequence
    if (['responded', 'meeting', 'client'].includes(contact.stage)) {
      db.prepare("UPDATE sequence_enrollments SET status = 'completed' WHERE id = ?")
        .run(enrollment.id);
      continue;
    }

    // Send the email
    const template = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(step.template_id) as any;
    if (!template) continue;

    const rendered = renderTemplate(template.subject, template.body_html, contact);
    const trackingId = uuidv4();

    const emailResult = db.prepare(`
      INSERT INTO sent_emails (contact_id, template_id, subject, to_email, tracking_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(contact.id, template.id, rendered.subject, contact.email, trackingId);

    sendEmail(Number(emailResult.lastInsertRowid));

    // Move contact to 'contacted' if still 'new'
    if (contact.stage === 'new') {
      db.prepare("UPDATE contacts SET stage = 'contacted', updated_at = datetime('now') WHERE id = ?")
        .run(contact.id);
    }

    // Advance to next step
    const nextStep = enrollment.current_step + 1;
    if (nextStep >= steps.length) {
      db.prepare("UPDATE sequence_enrollments SET current_step = ?, status = 'completed' WHERE id = ?")
        .run(nextStep, enrollment.id);
    } else {
      const nextDelay = steps[nextStep].delay_days;
      db.prepare(`
        UPDATE sequence_enrollments
        SET current_step = ?, next_send_at = datetime('now', '+' || ? || ' days')
        WHERE id = ?
      `).run(nextStep, nextDelay, enrollment.id);
    }

    processed++;
  }

  return processed;
}

export function cancelEnrollment(enrollmentId: number) {
  db.prepare("UPDATE sequence_enrollments SET status = 'cancelled' WHERE id = ?")
    .run(enrollmentId);
}
