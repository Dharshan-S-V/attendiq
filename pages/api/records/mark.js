// pages/api/records/mark.js
import sql from '../../../lib/db';
import { checkPresence } from '../../../lib/geo';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const {
    sessionId, name, roll, email,
    department, year,
    lat, lng, accuracy,
    deviceId   // unique device fingerprint from phone's localStorage
  } = req.body;

  // ── Basic validation ──
  if (!sessionId || !name || !roll || !department || !year) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }
  if (lat == null || lng == null) {
    return res.status(400).json({ error: 'GPS location is required' });
  }

  // Roll format: 23am019
  if (!/^\d{2}[a-zA-Z]{2,4}\d{3}$/.test(roll.trim())) {
    return res.status(400).json({ error: 'Invalid roll number. Format: 23am019' });
  }

  const studentLat = parseFloat(lat);
  const studentLng = parseFloat(lng);

  if (isNaN(studentLat) || isNaN(studentLng)) {
    return res.status(400).json({ error: 'Invalid GPS coordinates' });
  }

  const cleanRoll   = roll.trim().toLowerCase();
  const cleanEmail  = email.trim().toLowerCase();
  const cleanDevice = deviceId ? deviceId.trim() : null;

  try {
    // ── Fetch session ──
    const sRows = await sql`SELECT * FROM sessions WHERE id = ${sessionId}`;
    if (!sRows.length) return res.status(404).json({ error: 'Session not found' });

    const s = sRows[0];
    if (s.expires_at && new Date(s.expires_at) < new Date()) {
      return res.status(410).json({ error: 'QR session has expired. Ask faculty for a new one.' });
    }

    const classLat = parseFloat(s.lat);
    const classLng = parseFloat(s.lng);
    const radius   = parseInt(s.radius);

    if (isNaN(classLat) || isNaN(classLng)) {
      return res.status(500).json({ error: 'Session location invalid. Contact admin.' });
    }

    // ── DUPLICATE CHECKS ──
    // Rule: Present = permanently blocked (attendance confirmed)
    //       Absent  = delete old record, allow retry (student was out of range)

    // 1. Check by Roll Number
    const byRoll = await sql`
      SELECT id, status FROM attendance
      WHERE session_id = ${sessionId} AND roll = ${cleanRoll} LIMIT 1
    `;
    if (byRoll.length > 0) {
      if (byRoll[0].status === 'present') {
        return res.status(409).json({ error: 'Your attendance is already marked as Present for this session.' });
      }
      await sql`DELETE FROM attendance WHERE session_id = ${sessionId} AND roll = ${cleanRoll}`;
    }

    // 2. Check by Email
    const byEmail = await sql`
      SELECT id, status FROM attendance
      WHERE session_id = ${sessionId} AND email = ${cleanEmail} LIMIT 1
    `;
    if (byEmail.length > 0) {
      if (byEmail[0].status === 'present') {
        return res.status(409).json({ error: 'Attendance already marked as Present from this email.' });
      }
      await sql`DELETE FROM attendance WHERE session_id = ${sessionId} AND email = ${cleanEmail}`;
    }

    // 3. Check by Device ID (one phone per session)
    // Only block if device already submitted PRESENT for this session.
    // Same device can register for different sessions (training at 2:30, exam at 3:00).
    if (cleanDevice) {
      const byDevice = await sql`
        SELECT id, status FROM attendance
        WHERE session_id = ${sessionId} AND device_id = ${cleanDevice} LIMIT 1
      `;
      if (byDevice.length > 0) {
        if (byDevice[0].status === 'present') {
          return res.status(409).json({ error: 'This device has already submitted attendance for this session.' });
        }
        await sql`DELETE FROM attendance WHERE session_id = ${sessionId} AND device_id = ${cleanDevice}`;
      }
    }

    // ── STRICT GPS CHECK — exact radius, no buffer ──
    const geo    = checkPresence(studentLat, studentLng, classLat, classLng, radius);
    const status = geo.inRange ? 'present' : 'absent';

    // ── Save record ──
    const rows = await sql`
      INSERT INTO attendance
        (session_id, name, roll, email, department, year,
         status, distance, accuracy, lat, lng, device_id)
      VALUES
        (${sessionId},
         ${name.trim()},
         ${cleanRoll},
         ${cleanEmail},
         ${department},
         ${year},
         ${status},
         ${geo.distance},
         ${Math.round(parseFloat(accuracy) || 0)},
         ${studentLat},
         ${studentLng},
         ${cleanDevice})
      RETURNING *
    `;

    res.status(201).json({
      ok:       true,
      record:   rows[0],
      status,
      distance: geo.distance,
      radius:   radius,
    });

  } catch (e) {
    if (e.message?.includes('unique') || e.message?.includes('duplicate')) {
      return res.status(409).json({ error: 'Attendance already marked for this session.' });
    }
    // If device_id column doesn't exist yet, run migration
    if (e.message?.includes('device_id')) {
      return res.status(500).json({ error: 'Database needs migration. Run: node lib/db-migrate.js' });
    }
    console.error('mark.js error:', e.message);
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
}
