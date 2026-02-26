import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.SESSION_SECRET || 'zenuly-crm-secret-change-me';

export interface AuthRequest extends Request {
  user?: { id: number; email: string; name: string; role: string };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Nepřihlášen' });
  }

  try {
    const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Neplatný nebo expirovaný token' });
  }
}
