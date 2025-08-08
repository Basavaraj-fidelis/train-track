import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import { sql } from "drizzle-orm";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

// Auto-migration for missing columns
async function ensureSchemaUpdates() {
  try {
    // Add courseType column if it doesn't exist (separate statements for PostgreSQL compatibility)
    await db.execute(sql`ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_type text DEFAULT 'one-time'`);
    await db.execute(sql`ALTER TABLE courses ADD COLUMN IF NOT EXISTS renewal_period_months integer DEFAULT 3`);
    await db.execute(sql`ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_compliance_course boolean DEFAULT false`);
    await db.execute(sql`ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_auto_enroll_new_employees boolean DEFAULT false`);
    await db.execute(sql`ALTER TABLE courses ADD COLUMN IF NOT EXISTS default_deadline_days integer DEFAULT 30`);
    await db.execute(sql`ALTER TABLE courses ADD COLUMN IF NOT EXISTS reminder_days integer DEFAULT 7`);

    // Add missing enrollment columns (separate statements)
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS expires_at timestamp`);
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS is_expired boolean DEFAULT false`);
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS renewal_count integer DEFAULT 0`);
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS assigned_email text`);
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS assignment_token text`);
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS deadline timestamp`);
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'`);

    // Add reminders_sent column if it doesn't exist
    await db.execute(sql`
      ALTER TABLE enrollments 
      ADD COLUMN IF NOT EXISTS reminders_sent INTEGER DEFAULT 0 NOT NULL
    `);

    // Update courses table to include youtube_url
    await db.execute(sql`
      ALTER TABLE courses 
      ADD COLUMN IF NOT EXISTS youtube_url TEXT
    `);

    console.log('Database schema updates completed successfully');
  } catch (error) {
    console.error('Schema update error:', error);
  }
}

// Run migration on startup
ensureSchemaUpdates();