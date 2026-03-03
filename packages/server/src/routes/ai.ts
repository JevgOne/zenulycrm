import { Router, Request, Response } from 'express';
import { generateEmailForContact, getRateLimitStatus } from '../services/ai-service';
import { chat, type ChatMessage } from '../services/assistant-service';

const router = Router();

router.post('/generate-email', async (req: Request, res: Response) => {
  try {
    const { contact_id } = req.body;
    if (!contact_id) {
      return res.status(400).json({ error: 'contact_id is required' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not configured' });
    }

    const result = await generateEmailForContact(Number(contact_id));
    res.json(result);
  } catch (err: any) {
    const status = err.message.includes('Rate limit') ? 429 : 500;
    res.status(status).json({ error: err.message });
  }
});

router.get('/rate-limit', async (_req: Request, res: Response) => {
  const status = await getRateLimitStatus();
  res.json(status);
});

// AI Chat Assistant
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, history } = req.body as { message: string; history?: ChatMessage[] };

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not configured' });
    }

    const result = await chat(message, history || []);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
