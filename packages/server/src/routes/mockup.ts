import { Router, Request, Response } from 'express';
import { generateMockup, getMockupPaths } from '../services/mockup-service';

const router = Router();

router.post('/generate/:contactId', async (req: Request, res: Response) => {
  try {
    const contactId = Number(req.params.contactId);
    if (!contactId) {
      return res.status(400).json({ error: 'Invalid contact ID' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not configured' });
    }

    const result = await generateMockup(contactId);
    res.json({
      success: true,
      original: `/api/mockup/${contactId}/original`,
      mockup: `/api/mockup/${contactId}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:contactId', async (req: Request, res: Response) => {
  const contactId = Number(req.params.contactId);
  const paths = getMockupPaths(contactId);

  if (!paths.mockupExists) {
    return res.status(404).json({ error: 'Mockup not found. Generate it first.' });
  }

  res.sendFile(paths.mockupPath);
});

router.get('/:contactId/original', async (req: Request, res: Response) => {
  const contactId = Number(req.params.contactId);
  const paths = getMockupPaths(contactId);

  if (!paths.originalExists) {
    return res.status(404).json({ error: 'Original screenshot not found.' });
  }

  res.sendFile(paths.originalPath);
});

router.get('/:contactId/status', async (req: Request, res: Response) => {
  const contactId = Number(req.params.contactId);
  const paths = getMockupPaths(contactId);

  res.json({
    originalExists: paths.originalExists,
    mockupExists: paths.mockupExists,
    htmlExists: paths.htmlExists,
  });
});

export default router;
