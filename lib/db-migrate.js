// lib/db-migrate.js
// Run once: DATABASE_URL=your_url node lib/db-migrate.js

const { neon } = require('@neondatabase/serverless');

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error('Set DATABASE_URL first'); process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);
  console.log('Running migrations...');

  try {
    // Add email column if not exists
    await sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS email VARCHAR(200)`;
    console.log('✅ email column ready');

    // Add device_id column if not exists
    await sql`ALTER TABLE attendance ADD COLUMN IF NOT EXISTS device_id VARCHAR(200)`;
    console.log('✅ device_id column ready');

    // Unique constraint: one email per session
    await sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_session_email_key') THEN
          ALTER TABLE attendance ADD CONSTRAINT attendance_session_email_key UNIQUE (session_id, email);
        END IF;
      END $$
    `;
    console.log('✅ email unique constraint ready');

    // Unique constraint: one device per session (for present records)
    // Note: We allow multiple absent records per device then delete on retry,
    // so the actual uniqueness is enforced in application logic not DB constraint
    await sql`CREATE INDEX IF NOT EXISTS idx_attendance_device ON attendance(session_id, device_id)`;
    console.log('✅ device_id index ready');

    await sql`CREATE INDEX IF NOT EXISTS idx_attendance_email ON attendance(session_id, email)`;
    console.log('✅ email index ready');

    // Normalize existing roll numbers to lowercase
    await sql`UPDATE attendance SET roll = LOWER(roll) WHERE roll != LOWER(roll)`;
    console.log('✅ roll numbers normalized');

    console.log('\n🎉 All migrations complete!');
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

migrate();
