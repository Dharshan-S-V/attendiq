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
      // Verify session belongs to admin
      const sCheck = await sql`SELECT id FROM sessions WHERE id = ${sessionId} AND admin_id = ${admin.id}`;
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

    // Stats
    const total   = rows.length;
    const present = rows.filter(r => r.status === 'present').length;

    res.json({
      records: rows,
      stats: { total, present, absent: total - present,
        rate: total ? Math.round((present / total) * 100) : 0 }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
}
