import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/connection';

interface SendResult {
  success: boolean;
  resendId?: string;
  error?: string;
}

interface EmailAttachment {
  filename: string;
  content: string; // base64
  content_type?: string;
}

function getAttachments(contactId: number): EmailAttachment[] {
  const attachments: EmailAttachment[] = [];
  const mockupsDir = path.join(__dirname, '../../mockups');

  // Prefer PDF proposal over PNG mockup
  const pdfPath = path.join(mockupsDir, `${contactId}_nabidka.pdf`);
  if (fs.existsSync(pdfPath)) {
    attachments.push({
      filename: 'nabidka-weblyx.pdf',
      content: fs.readFileSync(pdfPath).toString('base64'),
      content_type: 'application/pdf',
    });
    return attachments;
  }

  // Fallback to PNG mockup
  const mockupPath = path.join(mockupsDir, `${contactId}_mockup.png`);
  if (fs.existsSync(mockupPath)) {
    attachments.push({
      filename: 'redesign-mockup.png',
      content: fs.readFileSync(mockupPath).toString('base64'),
      content_type: 'image/png',
    });
  }

  return attachments;
}

function getBaseUrl(): string {
  const url = process.env.BASE_URL;
  if (!url && process.env.NODE_ENV === 'production') {
    throw new Error('BASE_URL environment variable is required in production');
  }
  return url || `http://localhost:${process.env.PORT || 3001}`;
}

function addEmailFooter(bodyHtml: string, trackingId: string): string {
  const baseUrl = getBaseUrl();
  const unsubscribeUrl = `${baseUrl}/api/track/unsubscribe/${trackingId}`;
  const trackingPixel = `<img src="${baseUrl}/api/track/open/${trackingId}" width="1" height="1" style="display:none" />`;

  const footer = `
<div style="margin-top:40px;padding-top:15px;border-top:1px solid #eee;text-align:center;">
  <p style="font-size:11px;color:#999;margin:0;">
    <a href="${unsubscribeUrl}" style="color:#999;text-decoration:underline;">Odhlásit se z odběru</a>
  </p>
</div>
${trackingPixel}`;

  return bodyHtml + footer;
}

export async function sendEmail(sentEmailId: number): Promise<SendResult> {
  const email = await db.get('SELECT * FROM sent_emails WHERE id = ?', sentEmailId);
  if (!email) return { success: false, error: 'Email not found' };

  // Prevent duplicate: check if same email+template was already sent
  const alreadySent = await db.get(
    "SELECT id FROM sent_emails WHERE to_email = ? AND template_id = ? AND status IN ('sent','opened','clicked') AND id != ?",
    email.to_email, email.template_id, sentEmailId
  );
  if (alreadySent) {
    await db.run("UPDATE sent_emails SET status = 'skipped', error = 'duplicate' WHERE id = ?", sentEmailId);
    return { success: false, error: 'Duplicate - already sent' };
  }

  // Check unsubscribe list
  const unsub = await db.get('SELECT id FROM unsubscribes WHERE email = ?', email.to_email);
  if (unsub) {
    await db.run("UPDATE sent_emails SET status = 'skipped', error = 'unsubscribed' WHERE id = ?", sentEmailId);
    return { success: false, error: 'Recipient unsubscribed' };
  }

  if (!email.body_html) {
    await db.run("UPDATE sent_emails SET status = 'failed', error = 'Missing body_html' WHERE id = ?", sentEmailId);
    return { success: false, error: 'Email has no body_html' };
  }

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`[DEV] Would send email to ${email.to_email}: "${email.subject}"`);
    console.log(`[DEV] Body preview: ${email.body_html.substring(0, 200)}...`);
    const attachments = getAttachments(email.contact_id);
    if (attachments.length > 0) console.log(`[DEV] Would attach: ${attachments.map(a => a.filename).join(', ')}`);

    await db.run("UPDATE sent_emails SET status = 'sent', sent_at = datetime('now') WHERE id = ?", sentEmailId);
    await db.run("UPDATE contacts SET last_contacted_at = datetime('now') WHERE id = ?", email.contact_id);

    if (email.campaign_id) {
      await db.run('UPDATE campaigns SET total_sent = total_sent + 1 WHERE id = ?', email.campaign_id);
    }

    await db.run(`
      INSERT INTO activities (contact_id, type, title, details) VALUES (?, 'email_sent', 'Email odeslán (DEV)', ?)
    `, email.contact_id, JSON.stringify({ subject: email.subject, to: email.to_email }));

    return { success: true, resendId: `dev-${sentEmailId}` };
  }

  const bodyWithFooter = addEmailFooter(email.body_html, email.tracking_id);

  // Get attachments (PDF or PNG)
  const attachments = getAttachments(email.contact_id);

  try {
    const emailPayload: any = {
      from: `${process.env.SENDER_NAME || 'Weblyx'} <${process.env.SENDER_EMAIL || 'info@weblyx.cz'}>`,
      to: [email.to_email],
      subject: email.subject,
      html: bodyWithFooter,
      headers: {
        'List-Unsubscribe': `<${getBaseUrl()}/api/track/unsubscribe/${email.tracking_id}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    };

    if (attachments.length > 0) {
      emailPayload.attachments = attachments.map(a => ({
        filename: a.filename,
        content: a.content,
      }));
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(emailPayload),
    });

    const data: any = await response.json();

    if (response.ok) {
      await db.run("UPDATE sent_emails SET status = 'sent', sent_at = datetime('now'), resend_id = ? WHERE id = ?", data.id, sentEmailId);
      if (email.campaign_id) {
        await db.run('UPDATE campaigns SET total_sent = total_sent + 1 WHERE id = ?', email.campaign_id);
      }
      await db.run(`
        INSERT INTO activities (contact_id, type, title, details) VALUES (?, 'email_sent', 'Email odeslán', ?)
      `, email.contact_id, JSON.stringify({ subject: email.subject, to: email.to_email, attachments: attachments.map(a => a.filename) }));
      await db.run("UPDATE contacts SET last_contacted_at = datetime('now') WHERE id = ?", email.contact_id);
      return { success: true, resendId: data.id };
    } else {
      const errorMsg = data.message || JSON.stringify(data);
      // On rate limit / quota exceeded, put email back to queued so it retries later
      if (response.status === 429 || errorMsg.toLowerCase().includes('quota') || errorMsg.toLowerCase().includes('rate limit')) {
        await db.run("UPDATE sent_emails SET status = 'queued' WHERE id = ?", sentEmailId);
        return { success: false, error: `QUOTA_EXCEEDED: ${errorMsg}` };
      }
      await db.run('UPDATE sent_emails SET status = ?, error = ? WHERE id = ?', 'failed', errorMsg, sentEmailId);
      return { success: false, error: errorMsg };
    }
  } catch (err: any) {
    await db.run('UPDATE sent_emails SET status = ?, error = ? WHERE id = ?', 'failed', err.message, sentEmailId);
    return { success: false, error: err.message };
  }
}

export const DAILY_SEND_LIMIT = 100;

export async function processEmailQueue(batchSize = 5): Promise<number> {
  // Check daily limit
  const todayCount = await db.get(
    "SELECT COUNT(*) as cnt FROM sent_emails WHERE status IN ('sent','opened','clicked') AND sent_at >= date('now')"
  );
  if (todayCount.cnt >= DAILY_SEND_LIMIT) {
    return 0; // Daily limit reached
  }

  const remaining = DAILY_SEND_LIMIT - todayCount.cnt;
  const actualBatch = Math.min(batchSize, remaining);

  // Atomic claim to prevent race conditions
  const batchId = uuidv4();
  await db.run(`
    UPDATE sent_emails SET status = 'processing'
    WHERE id IN (
      SELECT id FROM sent_emails WHERE status = 'queued' ORDER BY created_at ASC LIMIT ?
    )
  `, actualBatch);

  const claimed = await db.all("SELECT id FROM sent_emails WHERE status = 'processing'");

  let sent = 0;
  for (const email of claimed) {
    const result = await sendEmail(email.id);
    if (result.error?.startsWith('QUOTA_EXCEEDED')) {
      // Put remaining emails back to queued and stop
      const remainingIds = claimed.slice(sent + 1).map((e: any) => e.id);
      for (const id of remainingIds) {
        await db.run("UPDATE sent_emails SET status = 'queued' WHERE id = ? AND status = 'processing'", id);
      }
      console.log('[EmailQueue] Resend quota exceeded, stopping batch');
      break;
    }
    sent++;
  }

  return sent;
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
