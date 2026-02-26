import { Router, Request, Response } from 'express';
import { recordOpen, recordClick } from '../services/email-service';

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

export default router;
