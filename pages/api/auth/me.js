// pages/api/auth/me.js
import { getAdminFromReq } from '../../../lib/auth';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const admin = getAdminFromReq(req);
  if (!admin) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const rows = await sql`SELECT id, username, college FROM admins WHERE id = ${admin.id}`;
    if (!rows.length) return res.status(401).json({ error: 'Admin not found' });
    res.json({ admin: rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
}
