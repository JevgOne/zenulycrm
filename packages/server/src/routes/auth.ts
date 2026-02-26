import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import db from '../db/connection';

const router = Router();
const JWT_SECRET = process.env.SESSION_SECRET || 'zenuly-crm-secret-change-me';
const JWT_EXPIRES = '7d';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Vyplňte email a heslo' });
  }

  const user = await db.get('SELECT * FROM users WHERE email = ?', email.toLowerCase().trim());

  if (!user) {
    return res.status(401).json({ error: 'Nesprávný email nebo heslo' });
  }

  const hash = hashPassword(password);
  if (hash !== user.password_hash) {
    return res.status(401).json({ error: 'Nesprávný email nebo heslo' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

// GET /api/auth/me - verify token and return user info
router.get('/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Nepřihlášen' });
  }

  try {
    const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET) as any;
    const user = await db.get('SELECT id, email, name, role FROM users WHERE id = ?', decoded.id);
    if (!user) return res.status(401).json({ error: 'Uživatel nenalezen' });
    res.json(user);
  } catch {
    return res.status(401).json({ error: 'Neplatný token' });
  }
});

export default router;
