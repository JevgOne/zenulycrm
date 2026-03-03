import { Router, Request, Response } from 'express';
import { getConfig, setConfig, getLog, processNewContacts, processFollowups } from '../services/autopilot-service';

const router = Router();

router.get('/config', async (_req: Request, res: Response) => {
  const config = await getConfig();
  res.json(config);
});

router.put('/config', async (req: Request, res: Response) => {
  try {
    const config = await setConfig(req.body);
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/log', async (req: Request, res: Response) => {
  const limit = Number(req.query.limit) || 50;
  const log = await getLog(limit);
  res.json(log);
});

router.post('/run', async (_req: Request, res: Response) => {
  try {
    const newProcessed = await processNewContacts();
    const followupsProcessed = await processFollowups();
    res.json({
      new_contacts_processed: newProcessed,
      followups_processed: followupsProcessed,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
