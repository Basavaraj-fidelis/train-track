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
    // Add courseType column if it doesn't exist
    await db.execute(sql`
      ALTER TABLE courses 
      ADD COLUMN IF NOT EXISTS course_type text DEFAULT 'one-time',
      ADD COLUMN IF NOT EXISTS renewal_period_months integer DEFAULT 3,
      ADD COLUMN IF NOT EXISTS is_compliance_course boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS is_auto_enroll_new_employees boolean DEFAULT false
    `);

    // Add missing enrollment columns
    await db.execute(sql`
      ALTER TABLE enrollments 
      ADD COLUMN IF NOT EXISTS expires_at timestamp,
      ADD COLUMN IF NOT EXISTS is_expired boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS renewal_count integer DEFAULT 0,
      ADD COLUMN IF NOT EXISTS assigned_email text,
      ADD COLUMN IF NOT EXISTS assignment_token text,
      ADD COLUMN IF NOT EXISTS deadline timestamp,
      ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS reminders_sent integer DEFAULT 0
    `);

    console.log('Database schema updates completed successfully');
  } catch (error) {
    console.error('Schema update error:', error);
  }
}

// Run migration on startup
ensureSchemaUpdates();