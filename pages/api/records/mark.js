// pages/api/records/mark.js
import sql from '../../../lib/db';
import { haversine } from '../../../lib/geo';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { sessionId, name, roll, regNo, department, year, lat, lng, accuracy } = req.body;

  if (!sessionId || !name || !roll || !department || !year) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (lat == null || lng == null) {
    return res.status(400).json({ error: 'Location required' });
  }

  try {
    // Fetch session
    const sRows = await sql`SELECT * FROM sessions WHERE id = ${sessionId}`;
    if (!sRows.length) return res.status(404).json({ error: 'Session not found' });

    const s = sRows[0];
    if (s.expires_at && new Date(s.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Session has expired' });
    }

    // Check duplicate
    const dup = await sql`
      SELECT id FROM attendance WHERE session_id = ${sessionId} AND roll = ${roll}
    `;
    if (dup.length) {
      return res.status(409).json({ error: 'Attendance already marked for this roll number' });
    }

    // Calculate distance
    const distance = haversine(lat, lng, s.lat, s.lng);
    const status   = distance <= s.radius ? 'present' : 'absent';

    // Insert record
    const rows = await sql`
      INSERT INTO attendance
        (session_id, name, roll, reg_no, department, year, status, distance, accuracy, lat, lng)
      VALUES
        (${sessionId}, ${name.trim()}, ${roll.trim()}, ${regNo || null},
         ${department}, ${year}, ${status}, ${distance},
         ${Math.round(accuracy || 0)}, ${lat}, ${lng})
      RETURNING *
    `;

    res.status(201).json({
      ok: true,
      record: rows[0],
      distance,
      radius: s.radius,
      status
    });
  } catch (e) {
    if (e.message?.includes('unique') || e.message?.includes('duplicate')) {
      return res.status(409).json({ error: 'Attendance already marked for this roll number' });
    }
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
}
