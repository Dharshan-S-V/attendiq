// pages/api/auth/register.js
import sql from '../../../lib/db';
import bcrypt from 'bcryptjs';
import { signToken, setAuthCookie } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { username, password, college } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const rows = await sql`
      INSERT INTO admins (username, password, college)
      VALUES (${username.trim()}, ${hash}, ${college || ''})
      RETURNING id, username, college
    `;
    const admin = rows[0];
    const token = signToken({ id: admin.id, username: admin.username });
    setAuthCookie(res, token);
    res.status(201).json({ ok: true, admin: { id: admin.id, username: admin.username, college: admin.college } });
  } catch (e) {
    if (e.message?.includes('unique')) return res.status(409).json({ error: 'Username already taken' });
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
}
