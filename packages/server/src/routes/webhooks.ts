import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { unsubscribeByEmail, sendUnsubscribeConfirmation } from '../services/email-service';

const router = Router();

// Keywords that indicate unsubscribe intent
const UNSUBSCRIBE_KEYWORDS = [
  'odhlásit', 'odhlášení', 'odhlašení', 'odhlaste', 'odhlasit',
  'unsubscribe', 'nechci', 'nezasílejte', 'nezasilejte',
  'přestaňte', 'prestante', 'stop', 'gdpr', 'remove',
  'vymazat', 'smazat', 'osobní údaje', 'osobních údajů',
];

// Keywords that indicate interest
const INTEREST_KEYWORDS = [
  'zájem', 'zajem', 'interested', 'ano', 'chci',
  'nabídku', 'nabidku', 'cenovou', 'více info', 'vice info',
  'zavolejte', 'ozvěte', 'ozvete', 'domluvit', 'schůzku', 'schuzku',
  'kontaktujte', 'rád', 'ráda', 'prosím', 'pošlete',
];

function detectIntent(text: string): 'unsubscribe' | 'interest' | null {
  const lower = text.toLowerCase();
  if (UNSUBSCRIBE_KEYWORDS.some(kw => lower.includes(kw))) return 'unsubscribe';
  if (INTEREST_KEYWORDS.some(kw => lower.includes(kw))) return 'interest';
  return null;
}

// Resend webhook - handles complained, bounced events
router.post('/resend', async (req: Request, res: Response) => {
  try {
    const { type, data } = req.body;

    if (!type || !data) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    console.log(`[Webhook] Resend event: ${type}`);

    if (type === 'email.complained') {
      // Spam complaint - auto-unsubscribe
      const email = data.to?.[0] || data.email_id;
      if (email) {
        // Find email in our DB by resend_id
        const sentEmail = await db.get(
          'SELECT to_email FROM sent_emails WHERE resend_id = ?',
          data.email_id
        );
        const targetEmail = sentEmail?.to_email || email;
        await unsubscribeByEmail(targetEmail);
        await sendUnsubscribeConfirmation(targetEmail);
        console.log(`[Webhook] Auto-unsubscribed (spam complaint): ${targetEmail}`);
      }
    }

    if (type === 'email.bounced') {
      // Hard bounce - auto-unsubscribe to prevent future sends
      const sentEmail = await db.get(
        'SELECT to_email, contact_id FROM sent_emails WHERE resend_id = ?',
        data.email_id
      );
      if (sentEmail) {
        await unsubscribeByEmail(sentEmail.to_email);
        if (sentEmail.contact_id) {
          await db.run(
            "INSERT INTO activities (contact_id, type, title) VALUES (?, 'bounced', 'Email bounced - odhlášen')",
            sentEmail.contact_id
          );
        }
        console.log(`[Webhook] Auto-unsubscribed (bounce): ${sentEmail.to_email}`);
      }
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error('[Webhook] Resend error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Inbound reply webhook - processes replies and detects intent
// Set this up in Resend dashboard: Inbound → Add webhook → POST to /api/webhooks/inbound
router.post('/inbound', async (req: Request, res: Response) => {
  try {
    const { from, to, subject, text, html } = req.body;

    if (!from) {
      return res.status(400).json({ error: 'Missing from address' });
    }

    const senderEmail = typeof from === 'string' ? from : from.address || from[0]?.address;
    if (!senderEmail) {
      return res.status(400).json({ error: 'Invalid from address' });
    }

    const replyContent = text || html || subject || '';
    const intent = detectIntent(replyContent);

    console.log(`[Webhook] Inbound reply from ${senderEmail}, intent: ${intent || 'unknown'}`);

    // Find contact by email
    const contact = await db.get(
      'SELECT id, name, email, stage FROM contacts WHERE email = ?',
      senderEmail.toLowerCase().trim()
    );

    if (intent === 'unsubscribe') {
      await unsubscribeByEmail(senderEmail);
      await sendUnsubscribeConfirmation(senderEmail);

      if (contact) {
        await db.run(
          "UPDATE contacts SET stage = 'unsubscribed', updated_at = datetime('now') WHERE id = ?",
          contact.id
        );
        await db.run(
          "INSERT INTO activities (contact_id, type, title, details) VALUES (?, 'unsubscribed', 'Odhlášen na základě odpovědi', ?)",
          contact.id, JSON.stringify({ reply_preview: replyContent.substring(0, 200) })
        );
      }
      console.log(`[Webhook] Unsubscribed + confirmation sent: ${senderEmail}`);
    }

    if (intent === 'interest') {
      if (contact) {
        await db.run(
          "UPDATE contacts SET stage = 'interested', priority = 'hot', updated_at = datetime('now') WHERE id = ?",
          contact.id
        );
        // Stop sequence - no more cold emails for hot leads
        await db.run(
          "UPDATE sequence_enrollments SET status = 'completed' WHERE contact_id = ? AND status = 'active'",
          contact.id
        );
        await db.run(
          "INSERT INTO activities (contact_id, type, title, details) VALUES (?, 'replied_interest', 'Odpověděl se zájmem!', ?)",
          contact.id, JSON.stringify({ reply_preview: replyContent.substring(0, 200) })
        );
        // Notify sales about hot lead
        const apiKey = process.env.RESEND_API_KEY;
        const notifyEmail = process.env.SENDER_EMAIL || 'info@weblyx.cz';
        if (apiKey) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: `Weblyx CRM <${notifyEmail}>`,
              to: notifyEmail,
              subject: `🔥 Hot lead: ${contact.email}`,
              html: `<h2>Nový hot lead!</h2>
                <p><strong>Email:</strong> ${contact.email}</p>
                <p><strong>Firma:</strong> ${contact.business_name || 'N/A'}</p>
                <p><strong>Odpověď:</strong></p>
                <blockquote>${replyContent.substring(0, 500)}</blockquote>
                <p>Sekvence byla automaticky zastavena. Kontaktuj ho osobně!</p>`
            })
          }).catch(err => console.error('[Webhook] Failed to send hot lead notification:', err));
        }
      }
      console.log(`[Webhook] Interest detected + sequence stopped: ${senderEmail}`);
    }

    // If no clear intent, still log the reply
    if (!intent && contact) {
      await db.run(
        "INSERT INTO activities (contact_id, type, title, details) VALUES (?, 'replied', 'Odpověděl na email', ?)",
        contact.id, JSON.stringify({ subject, reply_preview: replyContent.substring(0, 200) })
      );
    }

    res.json({ received: true, intent });
  } catch (err: any) {
    console.error('[Webhook] Inbound error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
