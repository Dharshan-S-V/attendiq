// lib/db-migrate.js
// Run this ONCE:
//   DATABASE_URL=your_neon_url node lib/db-migrate.js

const { neon } = require('@neondatabase/serverless');

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ Set DATABASE_URL first');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log('🔄 Running migration...');

  try {
    // Add email column
    await sql`
      ALTER TABLE attendance
      ADD COLUMN IF NOT EXISTS email VARCHAR(200)
    `;
    console.log('✅ email column added');

    // Unique constraint on session_id + email
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
    console.log('✅ Unique constraint on (session_id, email) added');

    // Index for fast lookup
    await sql`
      CREATE INDEX IF NOT EXISTS idx_attendance_email
      ON attendance(email)
    `;
    console.log('✅ Email index created');

    // Normalize existing roll numbers to lowercase
    await sql`
      UPDATE attendance SET roll = LOWER(roll)
      WHERE roll != LOWER(roll)
    `;
    console.log('✅ Roll numbers normalized');

    console.log('\n🎉 Migration complete! Deploy your updated files now.');
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

migrate();