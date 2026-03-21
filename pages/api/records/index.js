// pages/api/records/index.js
import sql from '../../../lib/db';
import { getAdminFromReq } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const admin = getAdminFromReq(req);
  if (!admin) return res.status(401).json({ error: 'Unauthorized' });

  const { sessionId } = req.query;

  try {
    let rows;
    if (sessionId) {
      const sCheck = await sql`
        SELECT id FROM sessions WHERE id = ${sessionId} AND admin_id = ${admin.id}
      `;
      if (!sCheck.length) return res.status(403).json({ error: 'Forbidden' });

      rows = await sql`
        SELECT a.*, s.subject, s.section, s.location
        FROM attendance a
        JOIN sessions s ON s.id = a.session_id
        WHERE a.session_id = ${sessionId}
        ORDER BY a.marked_at DESC
      `;
    } else {
      rows = await sql`
        SELECT a.*, s.subject, s.section, s.location
        FROM attendance a
        JOIN sessions s ON s.id = a.session_id
        WHERE s.admin_id = ${admin.id}
        ORDER BY a.marked_at DESC
      `;
    }

    const total   = rows.length;
    const present = rows.filter(r => r.status === 'present').length;
    const absent  = total - present;

    // No rate — just total, present, absent
    res.json({
      records: rows,
      stats: { total, present, absent }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
}
