// pages/api/auth/login.js
import sql from '../../../lib/db';
import bcrypt from 'bcryptjs';
import { signToken, setAuthCookie } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

  try {
    const rows = await sql`SELECT * FROM admins WHERE username = ${username.trim()}`;
    if (!rows.length) return res.status(401).json({ error: 'Invalid username or password' });

    const admin = rows[0];
    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.status(401).json({ error: 'Invalid username or password' });

    const token = signToken({ id: admin.id, username: admin.username });
    setAuthCookie(res, token);
    res.json({ ok: true, admin: { id: admin.id, username: admin.username, college: admin.college } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
}
