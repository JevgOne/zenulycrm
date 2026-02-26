/**
 * Email Service - handles sending via Resend + tracking
 */
import db from '../db/connection';

interface SendResult {
  success: boolean;
  resendId?: string;
  error?: string;
}

export async function sendEmail(sentEmailId: number): Promise<SendResult> {
  const email = db.prepare('SELECT * FROM sent_emails WHERE id = ?').get(sentEmailId) as any;
  if (!email) return { success: false, error: 'Email not found' };

  const apiKey = process.env.RESEND_API_KEY;

  // If no API key, log and mark as sent (dev mode)
  if (!apiKey) {
    console.log(`[DEV] Would send email to ${email.to_email}: "${email.subject}"`);
    db.prepare(`
      UPDATE sent_emails SET status = 'sent', sent_at = datetime('now') WHERE id = ?
    `).run(sentEmailId);

    // Update campaign stats
    if (email.campaign_id) {
      db.prepare('UPDATE campaigns SET total_sent = total_sent + 1 WHERE id = ?')
        .run(email.campaign_id);
    }

    // Log activity
    db.prepare(`
      INSERT INTO activities (contact_id, type, title, details)
      VALUES (?, 'email_sent', 'Email odeslán', ?)
    `).run(email.contact_id, JSON.stringify({ subject: email.subject, to: email.to_email }));

    return { success: true, resendId: `dev-${sentEmailId}` };
  }

  // Inject tracking pixel into HTML body
  const trackingPixel = `<img src="${getBaseUrl()}/api/track/open/${email.tracking_id}" width="1" height="1" style="display:none" />`;
  const bodyWithTracking = (email.body_html || email.subject) + trackingPixel;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${process.env.SENDER_NAME || 'Weblyx'} <${process.env.SENDER_EMAIL || 'info@weblyx.cz'}>`,
        to: [email.to_email],
        subject: email.subject,
        html: bodyWithTracking,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      db.prepare(`
        UPDATE sent_emails SET status = 'sent', sent_at = datetime('now'), resend_id = ? WHERE id = ?
      `).run(data.id, sentEmailId);

      if (email.campaign_id) {
        db.prepare('UPDATE campaigns SET total_sent = total_sent + 1 WHERE id = ?')
          .run(email.campaign_id);
      }

      db.prepare(`
        INSERT INTO activities (contact_id, type, title, details)
        VALUES (?, 'email_sent', 'Email odeslán', ?)
      `).run(email.contact_id, JSON.stringify({ subject: email.subject, to: email.to_email }));

      // Update contact last_contacted_at
      db.prepare("UPDATE contacts SET last_contacted_at = datetime('now') WHERE id = ?")
        .run(email.contact_id);

      return { success: true, resendId: data.id };
    } else {
      const errorMsg = data.message || JSON.stringify(data);
      db.prepare('UPDATE sent_emails SET status = ?, error = ? WHERE id = ?')
        .run('failed', errorMsg, sentEmailId);
      return { success: false, error: errorMsg };
    }
  } catch (err: any) {
    db.prepare('UPDATE sent_emails SET status = ?, error = ? WHERE id = ?')
      .run('failed', err.message, sentEmailId);
    return { success: false, error: err.message };
  }
}

export function processEmailQueue(batchSize = 5): number {
  const queued = db.prepare(`
    SELECT id FROM sent_emails WHERE status = 'queued' ORDER BY created_at ASC LIMIT ?
  `).all(batchSize) as any[];

  let sent = 0;
  for (const email of queued) {
    sendEmail(email.id).then(result => {
      if (result.success) sent++;
    });
  }

  return queued.length;
}

export function recordOpen(trackingId: string): boolean {
  const email = db.prepare('SELECT * FROM sent_emails WHERE tracking_id = ?').get(trackingId) as any;
  if (!email) return false;

  if (!email.opened_at) {
    db.prepare("UPDATE sent_emails SET opened_at = datetime('now'), status = 'opened' WHERE id = ?")
      .run(email.id);

    if (email.campaign_id) {
      db.prepare('UPDATE campaigns SET total_opened = total_opened + 1 WHERE id = ?')
        .run(email.campaign_id);
    }

    db.prepare(`
      INSERT INTO activities (contact_id, type, title)
      VALUES (?, 'email_opened', 'Email otevřen')
    `).run(email.contact_id);
  }

  return true;
}

export function recordClick(trackingId: string): string | null {
  const email = db.prepare('SELECT * FROM sent_emails WHERE tracking_id = ?').get(trackingId) as any;
  if (!email) return null;

  if (!email.clicked_at) {
    db.prepare("UPDATE sent_emails SET clicked_at = datetime('now'), status = 'clicked' WHERE id = ?")
      .run(email.id);

    if (email.campaign_id) {
      db.prepare('UPDATE campaigns SET total_clicked = total_clicked + 1 WHERE id = ?')
        .run(email.campaign_id);
    }

    db.prepare(`
      INSERT INTO activities (contact_id, type, title)
      VALUES (?, 'email_clicked', 'Kliknuto na odkaz v emailu')
    `).run(email.contact_id);

    // Auto-upgrade priority to hot if clicked
    db.prepare("UPDATE contacts SET priority = 'hot' WHERE id = ? AND priority != 'hot'")
      .run(email.contact_id);
  }

  return email.to_email;
}

function getBaseUrl(): string {
  return process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
}
