import { Router, Response } from 'express';
import crypto from 'crypto';
import db from '../db/connection';
import { AuthRequest } from '../middleware/auth';

const router = Router();

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// GET /api/users - list all users
router.get('/', async (_req: AuthRequest, res: Response) => {
  const users = await db.all(
    'SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC'
  );
  res.json(users);
});

// POST /api/users - create new user
router.post('/', async (req: AuthRequest, res: Response) => {
  const { email, password, name, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email a heslo jsou povinné' });
  }

  const existing = await db.get('SELECT id FROM users WHERE email = ?', email.toLowerCase().trim());
  if (existing) {
    return res.status(409).json({ error: 'Uživatel s tímto emailem již existuje' });
  }

  const result = await db.run(
    'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
    email.toLowerCase().trim(),
    hashPassword(password),
    name || email.split('@')[0],
    role || 'admin'
  );

  res.json({
    id: result.lastInsertRowid,
    email: email.toLowerCase().trim(),
    name: name || email.split('@')[0],
    role: role || 'admin',
  });
});

// PUT /api/users/:id - update user
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { email, name, role, password } = req.body;

  const user = await db.get('SELECT * FROM users WHERE id = ?', id);
  if (!user) {
    return res.status(404).json({ error: 'Uživatel nenalezen' });
  }

  if (email && email !== user.email) {
    const existing = await db.get('SELECT id FROM users WHERE email = ? AND id != ?', email.toLowerCase().trim(), id);
    if (existing) {
      return res.status(409).json({ error: 'Email je již používán' });
    }
  }

  await db.run(
    'UPDATE users SET email = ?, name = ?, role = ? WHERE id = ?',
    (email || user.email).toLowerCase().trim(),
    name || user.name,
    role || user.role,
    id
  );

  if (password) {
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(password), id);
  }

  res.json({ success: true });
});

// DELETE /api/users/:id - delete user
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;

  const user = await db.get('SELECT id FROM users WHERE id = ?', id);
  if (!user) {
    return res.status(404).json({ error: 'Uživatel nenalezen' });
  }

  // Prevent deleting yourself
  if (req.user && req.user.id === user.id) {
    return res.status(400).json({ error: 'Nemůžete smazat vlastní účet' });
  }

  await db.run('DELETE FROM users WHERE id = ?', id);
  res.json({ success: true });
});

// PUT /api/users/:id/password - change password
router.put('/:id/password', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { password } = req.body;

  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Heslo musí mít alespoň 6 znaků' });
  }

  const user = await db.get('SELECT id FROM users WHERE id = ?', id);
  if (!user) {
    return res.status(404).json({ error: 'Uživatel nenalezen' });
  }

  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(password), id);
  res.json({ success: true });
});

export default router;
