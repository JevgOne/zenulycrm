import db from '../db/connection';

interface SendResult {
  success: boolean;
  resendId?: string;
  error?: string;
}

export async function sendEmail(sentEmailId: number): Promise<SendResult> {
  const email = await db.get('SELECT * FROM sent_emails WHERE id = ?', sentEmailId);
  if (!email) return { success: false, error: 'Email not found' };

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`[DEV] Would send email to ${email.to_email}: "${email.subject}"`);
    await db.run("UPDATE sent_emails SET status = 'sent', sent_at = datetime('now') WHERE id = ?", sentEmailId);

    if (email.campaign_id) {
      await db.run('UPDATE campaigns SET total_sent = total_sent + 1 WHERE id = ?', email.campaign_id);
    }

    await db.run(`
      INSERT INTO activities (contact_id, type, title, details) VALUES (?, 'email_sent', 'Email odeslán', ?)
    `, email.contact_id, JSON.stringify({ subject: email.subject, to: email.to_email }));

    return { success: true, resendId: `dev-${sentEmailId}` };
  }

  const trackingPixel = `<img src="${getBaseUrl()}/api/track/open/${email.tracking_id}" width="1" height="1" style="display:none" />`;
  const bodyWithTracking = (email.body_html || email.subject) + trackingPixel;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${process.env.SENDER_NAME || 'Weblyx'} <${process.env.SENDER_EMAIL || 'info@weblyx.cz'}>`,
        to: [email.to_email], subject: email.subject, html: bodyWithTracking,
      }),
    });

    const data: any = await response.json();

    if (response.ok) {
      await db.run("UPDATE sent_emails SET status = 'sent', sent_at = datetime('now'), resend_id = ? WHERE id = ?", data.id, sentEmailId);
      if (email.campaign_id) {
        await db.run('UPDATE campaigns SET total_sent = total_sent + 1 WHERE id = ?', email.campaign_id);
      }
      await db.run(`
        INSERT INTO activities (contact_id, type, title, details) VALUES (?, 'email_sent', 'Email odeslán', ?)
      `, email.contact_id, JSON.stringify({ subject: email.subject, to: email.to_email }));
      await db.run("UPDATE contacts SET last_contacted_at = datetime('now') WHERE id = ?", email.contact_id);
      return { success: true, resendId: data.id };
    } else {
      const errorMsg = data.message || JSON.stringify(data);
      await db.run('UPDATE sent_emails SET status = ?, error = ? WHERE id = ?', 'failed', errorMsg, sentEmailId);
      return { success: false, error: errorMsg };
    }
  } catch (err: any) {
    await db.run('UPDATE sent_emails SET status = ?, error = ? WHERE id = ?', 'failed', err.message, sentEmailId);
    return { success: false, error: err.message };
  }
}

export async function processEmailQueue(batchSize = 5): Promise<number> {
  const queued = await db.all("SELECT id FROM sent_emails WHERE status = 'queued' ORDER BY created_at ASC LIMIT ?", batchSize);
  for (const email of queued) {
    await sendEmail(email.id);
  }
  return queued.length;
}

export async function recordOpen(trackingId: string): Promise<boolean> {
  const email = await db.get('SELECT * FROM sent_emails WHERE tracking_id = ?', trackingId);
  if (!email) return false;

  if (!email.opened_at) {
    await db.run("UPDATE sent_emails SET opened_at = datetime('now'), status = 'opened' WHERE id = ?", email.id);
    if (email.campaign_id) {
      await db.run('UPDATE campaigns SET total_opened = total_opened + 1 WHERE id = ?', email.campaign_id);
    }
    await db.run("INSERT INTO activities (contact_id, type, title) VALUES (?, 'email_opened', 'Email otevřen')", email.contact_id);
  }
  return true;
}

export async function recordClick(trackingId: string): Promise<string | null> {
  const email = await db.get('SELECT * FROM sent_emails WHERE tracking_id = ?', trackingId);
  if (!email) return null;

  if (!email.clicked_at) {
    await db.run("UPDATE sent_emails SET clicked_at = datetime('now'), status = 'clicked' WHERE id = ?", email.id);
    if (email.campaign_id) {
      await db.run('UPDATE campaigns SET total_clicked = total_clicked + 1 WHERE id = ?', email.campaign_id);
    }
    await db.run("INSERT INTO activities (contact_id, type, title) VALUES (?, 'email_clicked', 'Kliknuto na odkaz v emailu')", email.contact_id);
    await db.run("UPDATE contacts SET priority = 'hot' WHERE id = ? AND priority != 'hot'", email.contact_id);
  }
  return email.to_email;
}

function getBaseUrl(): string {
  return process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
}
