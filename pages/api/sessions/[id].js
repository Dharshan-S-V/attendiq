// pages/api/sessions/[id].js
import sql from '../../../lib/db';
import { getAdminFromReq } from '../../../lib/auth';

export default async function handler(req, res) {
  const { id } = req.query;

  // GET — public endpoint (student scans QR, fetches session info)
  if (req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM sessions WHERE id = ${id}`;
      if (!rows.length) return res.status(404).json({ error: 'Session not found' });
      const s = rows[0];
      if (s.expires_at && new Date(s.expires_at) < new Date()) {
        return res.status(410).json({ error: 'Session expired' });
      }
      // Return only what student needs (no admin_id)
      res.json({
        session: {
          id: s.id, subject: s.subject, section: s.section,
          location: s.location, lat: s.lat, lng: s.lng,
          radius: s.radius, date: s.date, timeSlot: s.time_slot,
          expiresAt: s.expires_at
        }
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Server error' });
    }
    return;
  }

  // DELETE — admin only
  if (req.method === 'DELETE') {
    const admin = getAdminFromReq(req);
    if (!admin) return res.status(401).json({ error: 'Unauthorized' });
    try {
      await sql`DELETE FROM sessions WHERE id = ${id} AND admin_id = ${admin.id}`;
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'Server error' });
    }
    return;
  }

  res.status(405).end();
}
