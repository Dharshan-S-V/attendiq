// pages/api/records/mark.js
import sql from '../../../lib/db';
import { isWithinRange } from '../../../lib/geo';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const {
    sessionId, name, roll, email,
    department, year,
    lat, lng, accuracy
  } = req.body;

  // ── Validation ──
  if (!sessionId || !name || !roll || !department || !year) {
    return res.status(400).json({ error: 'Missing required fields (name, roll, department, year)' });
  }
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }
  if (lat == null || lng == null) {
    return res.status(400).json({ error: 'GPS location is required' });
  }

  // Roll number format: e.g. 23am019 (2 digits + 2-4 letters + 3 digits)
  const rollRegex = /^\d{2}[a-zA-Z]{2,4}\d{3}$/;
  if (!rollRegex.test(roll.trim())) {
    return res.status(400).json({ error: 'Invalid roll number format. Use format like 23am019' });
  }

  // Ensure lat/lng are proper numbers (not strings)
  const studentLat = parseFloat(lat);
  const studentLng = parseFloat(lng);
  const gpsAccuracy = parseFloat(accuracy) || 50; // default 50m if unknown

  if (isNaN(studentLat) || isNaN(studentLng)) {
    return res.status(400).json({ error: 'Invalid GPS coordinates received' });
  }

  try {
    // ── Fetch session ──
    const sRows = await sql`SELECT * FROM sessions WHERE id = ${sessionId}`;
    if (!sRows.length) return res.status(404).json({ error: 'Session not found' });

    const s = sRows[0];
    if (s.expires_at && new Date(s.expires_at) < new Date()) {
      return res.status(410).json({ error: 'This QR session has expired. Ask your faculty for a new one.' });
    }

    // Ensure session lat/lng are numbers
    const classLat = parseFloat(s.lat);
    const classLng = parseFloat(s.lng);
    const radius   = parseInt(s.radius);

    if (isNaN(classLat) || isNaN(classLng)) {
      return res.status(500).json({ error: 'Session location data is invalid. Contact admin.' });
    }

    // ── Duplicate check by ROLL NUMBER ──
    const dupRoll = await sql`
      SELECT id FROM attendance WHERE session_id = ${sessionId} AND roll = ${roll.trim().toLowerCase()}
    `;
    if (dupRoll.length) {
      return res.status(409).json({ error: 'Attendance already marked for this roll number in this session.' });
    }

    // ── Duplicate check by EMAIL ──
    const dupEmail = await sql`
      SELECT id FROM attendance WHERE session_id = ${sessionId} AND email = ${email.trim().toLowerCase()}
    `;
    if (dupEmail.length) {
      return res.status(409).json({ error: 'Attendance already marked from this email in this session.' });
    }

    // ── Accurate distance + GPS tolerance check ──
    const geo = isWithinRange(
      studentLat, studentLng,
      classLat,   classLng,
      radius,     gpsAccuracy
    );

    const status = geo.inRange ? 'present' : 'absent';

    // ── Insert record ──
    const rows = await sql`
      INSERT INTO attendance
        (session_id, name, roll, email, department, year,
         status, distance, accuracy, lat, lng)
      VALUES
        (${sessionId},
         ${name.trim()},
         ${roll.trim().toLowerCase()},
         ${email.trim().toLowerCase()},
         ${department},
         ${year},
         ${status},
         ${geo.distance},
         ${Math.round(gpsAccuracy)},
         ${studentLat},
         ${studentLng})
      RETURNING *
    `;

    res.status(201).json({
      ok: true,
      record: rows[0],
      distance:        geo.distance,
      effectiveRadius: geo.effectiveRadius,
      accuracyBuffer:  geo.accuracyBuffer,
      radius:          radius,
      status,
      // Debug info shown to student so they understand result
      debug: {
        yourLocation:    `${studentLat.toFixed(6)}, ${studentLng.toFixed(6)}`,
        classLocation:   `${classLat.toFixed(6)}, ${classLng.toFixed(6)}`,
        rawDistance:     geo.distance,
        setRadius:       radius,
        gpsAccuracy:     Math.round(gpsAccuracy),
        buffer:          geo.accuracyBuffer,
        effectiveRadius: geo.effectiveRadius,
      }
    });

  } catch (e) {
    if (e.message?.includes('unique') || e.message?.includes('duplicate')) {
      return res.status(409).json({ error: 'Attendance already marked for this session.' });
    }
    console.error('mark.js error:', e);
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
}
