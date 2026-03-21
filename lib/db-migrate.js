// lib/db-migrate.js
// Run this ONCE on your existing database to apply the schema changes:
//   DATABASE_URL=your_url node lib/db-migrate.js

const { neon } = require('@neondatabase/serverless');

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ Set DATABASE_URL first'); process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);

  console.log('Running migrations…');

  try {
    // 1. Add email column if not exists
    await sql`
      ALTER TABLE attendance
      ADD COLUMN IF NOT EXISTS email VARCHAR(200)
    `;
    console.log('✅ Added email column');

    // 2. Add unique constraint on (session_id, email) to prevent duplicate email submissions
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'attendance_session_id_email_key'
        ) THEN
          ALTER TABLE attendance
          ADD CONSTRAINT attendance_session_id_email_key
          UNIQUE (session_id, email);
        END IF;
      END $$
    `;
    console.log('✅ Added unique constraint on (session_id, email)');

    // 3. Normalize roll to lowercase for consistent dedup
    await sql`
      UPDATE attendance SET roll = LOWER(roll) WHERE roll != LOWER(roll)
    `;
    console.log('✅ Normalized roll numbers to lowercase');

    // 4. Create index on email for fast lookup
    await sql`
      CREATE INDEX IF NOT EXISTS idx_attendance_email ON attendance(email)
    `;
    console.log('✅ Created email index');

    console.log('\n🎉 All migrations complete!');
  } catch (e) {
    console.error('❌ Migration error:', e.message);
    process.exit(1);
  }
}

migrate();
