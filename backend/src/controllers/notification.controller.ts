import type { Request, Response } from 'express';
import { query } from '../config/database.js';

function myType(req: Request): 'user' | 'student' {
  return req.auth!.role === 'student' ? 'student' : 'user';
}

// GET /api/notifications — últimas 30 + nº sin leer
export async function listNotifications(req: Request, res: Response): Promise<void> {
  const uid = req.auth!.sub;
  const type = myType(req);
  const [rows, unread] = await Promise.all([
    query(
      `SELECT id, title, body, link, read_at, created_at
       FROM notifications WHERE user_id = $1 AND user_type = $2
       ORDER BY created_at DESC LIMIT 30`,
      [uid, type],
    ),
    query<{ count: string }>(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND user_type = $2 AND read_at IS NULL',
      [uid, type],
    ),
  ]);
  res.json({ notifications: rows.rows, unread: Number(unread.rows[0].count) });
}

// POST /api/notifications/read-all
export async function markAllRead(req: Request, res: Response): Promise<void> {
  await query(
    'UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND user_type = $2 AND read_at IS NULL',
    [req.auth!.sub, myType(req)],
  );
  res.json({ ok: true });
}
