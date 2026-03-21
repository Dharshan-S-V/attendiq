const { neon } = require('@neondatabase/serverless');

async function init() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ Set DATABASE_URL environment variable first');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    // admins
    await sql`CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password TEXT NOT NULL,
      college VARCHAR(200),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`;

    // sessions
    await sql`CREATE TABLE IF NOT EXISTS sessions (
      id VARCHAR(50) PRIMARY KEY,
      admin_id INTEGER REFERENCES admins(id) ON DELETE CASCADE,
      subject VARCHAR(200) NOT NULL,
      section VARCHAR(100),
      location VARCHAR(200) NOT NULL,
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      radius INTEGER NOT NULL DEFAULT 50,
      date DATE,
      time_slot VARCHAR(20),
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`;

    // attendance
    await sql`CREATE TABLE IF NOT EXISTS attendance (
      id SERIAL PRIMARY KEY,
      session_id VARCHAR(50) REFERENCES sessions(id) ON DELETE CASCADE,
      name VARCHAR(200) NOT NULL,
      roll VARCHAR(100) NOT NULL,
      reg_no VARCHAR(100),
      department VARCHAR(200) NOT NULL,
      year VARCHAR(10) NOT NULL,
      status VARCHAR(10) NOT NULL CHECK (status IN ('present','absent')),
      distance INTEGER,
      accuracy INTEGER,
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      marked_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(session_id, roll)
    );`;

    // indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance(session_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_sessions_admin ON sessions(admin_id);`;

    console.log('✅ Database tables created successfully!');
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
}

init();