import { Router, Request, Response } from 'express';
import { generateMockup, getMockupPaths } from '../services/mockup-service';
import { generateProposalPdf, getProposalPdfPath } from '../services/pdf-service';

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

// Generate PDF proposal
router.post('/pdf/:contactId', async (req: Request, res: Response) => {
  try {
    const contactId = Number(req.params.contactId);
    if (!contactId) return res.status(400).json({ error: 'Invalid contact ID' });

    const pdfPath = await generateProposalPdf(contactId);
    res.json({ success: true, pdf: `/api/mockup/${contactId}/pdf` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Download PDF proposal
router.get('/:contactId/pdf', async (req: Request, res: Response) => {
  const contactId = Number(req.params.contactId);
  const pdfPath = getProposalPdfPath(contactId);

  if (!pdfPath) {
    return res.status(404).json({ error: 'PDF not found. Generate it first via POST /api/mockup/pdf/:contactId' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="nabidka-weblyx-${contactId}.pdf"`);
  res.sendFile(pdfPath);
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
  const pdfPath = getProposalPdfPath(contactId);

  res.json({
    originalExists: paths.originalExists,
    mockupExists: paths.mockupExists,
    htmlExists: paths.htmlExists,
    pdfExists: !!pdfPath,
  });
});

export default router;
