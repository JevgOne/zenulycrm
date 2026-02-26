import { Router, Request, Response } from 'express';
import { recordOpen, recordClick } from '../services/email-service';

const router = Router();

// 1x1 transparent pixel for open tracking
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

// GET /api/track/open/:trackingId
router.get('/open/:trackingId', (req: Request, res: Response) => {
  recordOpen(req.params.trackingId);
  res.set({
    'Content-Type': 'image/gif',
    'Content-Length': String(PIXEL.length),
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  });
  res.send(PIXEL);
});

// GET /api/track/click/:trackingId
router.get('/click/:trackingId', (req: Request, res: Response) => {
  const { url } = req.query;
  recordClick(req.params.trackingId);
  if (url && typeof url === 'string') {
    res.redirect(url);
  } else {
    res.redirect('https://weblyx.cz');
  }
});

export default router;
