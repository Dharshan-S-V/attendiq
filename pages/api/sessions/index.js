// pages/api/sessions/index.js
import sql from '../../../lib/db';
import { getAdminFromReq } from '../../../lib/auth';

function makeId() {
  return 'AQ' + Date.now().toString(36).toUpperCase() +
    Math.random().toString(36).substr(2, 4).toUpperCase();
}

export default async function handler(req, res) {
  const admin = getAdminFromReq(req);
  if (!admin) return res.status(401).json({ error: 'Unauthorized' });

  // GET — list all sessions for this admin
  if (req.method === 'GET') {
    try {
      const rows = await sql`
        SELECT
          s.*,
          COUNT(a.id)::int AS response_count,
          COUNT(a.id) FILTER (WHERE a.status = 'present')::int AS present_count
        FROM sessions s
        LEFT JOIN attendance a ON a.session_id = s.id
        WHERE s.admin_id = ${admin.id}
        GROUP BY s.id
        ORDER BY s.created_at DESC
      `;
      res.json({ sessions: rows });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Server error' });
    }
    return;
  }

  // POST — create new session
  if (req.method === 'POST') {
    const { subject, section, location, lat, lng, radius, date, timeSlot, expiryMinutes } = req.body;
    if (!subject || !location || lat == null || lng == null) {
      return res.status(400).json({ error: 'subject, location, lat, lng are required' });
    }

    const id = makeId();
    const expiresAt = expiryMinutes > 0
      ? new Date(Date.now() + expiryMinutes * 60000).toISOString()
      : null;

    try {
      const rows = await sql`
        INSERT INTO sessions (id, admin_id, subject, section, location, lat, lng, radius, date, time_slot, expires_at)
        VALUES (
          ${id}, ${admin.id}, ${subject}, ${section || null},
          ${location}, ${lat}, ${lng}, ${radius || 50},
          ${date || null}, ${timeSlot || null}, ${expiresAt}
        )
        RETURNING *
      `;
      res.status(201).json({ session: rows[0] });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Server error' });
    }
    return;
  }

  res.status(405).end();
}
