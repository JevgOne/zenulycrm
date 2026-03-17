import { Router, Request, Response } from 'express';
import { recordOpen, recordClick } from '../services/email-service';
import db from '../db/connection';

const router = Router();

const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

router.get('/open/:trackingId', async (req: Request, res: Response) => {
  await recordOpen(req.params.trackingId as string);
  res.set({
    'Content-Type': 'image/gif',
    'Content-Length': String(PIXEL.length),
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  });
  res.send(PIXEL);
});

router.get('/click/:trackingId', async (req: Request, res: Response) => {
  const { url } = req.query;
  await recordClick(req.params.trackingId as string);
  if (url && typeof url === 'string') {
    res.redirect(url);
  } else {
    res.redirect('https://weblyx.cz');
  }
});

// Unsubscribe page (GET = show confirmation, POST = process)
router.get('/unsubscribe/:trackingId', async (req: Request, res: Response) => {
  const email = await db.get('SELECT to_email FROM sent_emails WHERE tracking_id = ?', req.params.trackingId);
  if (!email) {
    return res.status(404).send('<html><body><h1>Odkaz vypršel</h1></body></html>');
  }

  const maskedEmail = email.to_email.replace(/(.{2})(.*)(@.*)/, '$1***$3');

  res.send(`<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Odhlášení z odběru - Weblyx</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f8f9fa; color: #333; }
    .card { background: white; border-radius: 12px; padding: 40px; max-width: 420px; width: 90%; box-shadow: 0 2px 12px rgba(0,0,0,0.08); text-align: center; }
    h1 { font-size: 20px; margin-bottom: 8px; }
    p { color: #666; font-size: 14px; line-height: 1.6; }
    .email { font-weight: 600; color: #333; }
    button { background: #e53e3e; color: white; border: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; cursor: pointer; margin-top: 16px; }
    button:hover { background: #c53030; }
    .cancel { background: none; color: #999; text-decoration: underline; border: none; cursor: pointer; font-size: 13px; margin-top: 12px; display: block; margin-left: auto; margin-right: auto; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Odhlášení z odběru</h1>
    <p>Opravdu se chcete odhlásit z emailů od Weblyx?</p>
    <p class="email">${maskedEmail}</p>
    <form method="POST">
      <button type="submit">Ano, odhlásit se</button>
    </form>
    <button class="cancel" onclick="window.close()">Zrušit</button>
  </div>
</body>
</html>`);
});

router.post('/unsubscribe/:trackingId', async (req: Request, res: Response) => {
  const email = await db.get('SELECT to_email, contact_id FROM sent_emails WHERE tracking_id = ?', req.params.trackingId);
  if (!email) {
    return res.status(404).send('<html><body><h1>Odkaz vypršel</h1></body></html>');
  }

  // Add to unsubscribe list
  try {
    await db.run(
      "INSERT INTO unsubscribes (email) VALUES (?) ON CONFLICT(email) DO NOTHING",
      email.to_email
    );
  } catch { /* already unsubscribed */ }

  // Log activity
  if (email.contact_id) {
    await db.run(
      "INSERT INTO activities (contact_id, type, title) VALUES (?, 'unsubscribed', 'Odhlášen z odběru')",
      email.contact_id
    );
  }

  res.send(`<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Odhlášeno - Weblyx</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f8f9fa; color: #333; }
    .card { background: white; border-radius: 12px; padding: 40px; max-width: 420px; width: 90%; box-shadow: 0 2px 12px rgba(0,0,0,0.08); text-align: center; }
    h1 { font-size: 20px; color: #38a169; }
    p { color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Úspěšně odhlášeno</h1>
    <p>Nebudete již dostávat žádné emaily od Weblyx. Omlouváme se za obtěžování.</p>
  </div>
</body>
</html>`);
});

export default router;
