import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from "drizzle-orm";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    sslmode: 'require'
  }
});
export const db = drizzle({ client: pool, schema });

// Database reset function
export async function resetDatabase() {
  try {
    console.log('Starting database reset...');

    // Drop all tables in correct order (due to foreign key constraints)
    await db.execute(sql`DROP TABLE IF EXISTS certificates CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS enrollments CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS quizzes CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS courses CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS users CASCADE`);

    console.log('All tables dropped successfully');

    // Recreate all tables
    await createTables();

    console.log('Database reset completed successfully');
    return true;
  } catch (error) {
    console.error('Database reset failed:', error);
    throw error;
  }
}

// Create all tables with proper schema
export async function createTables() {
  try {
    console.log('Creating tables...');

    // Create users table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id TEXT UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password TEXT,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
        designation TEXT,
        department TEXT,
        client_name TEXT,
        phone_number TEXT,
        position TEXT,
        join_date TIMESTAMP DEFAULT NOW(),
        is_active BOOLEAN DEFAULT true,
        reset_token TEXT,
        reset_token_expiry TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create courses table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS courses (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        description TEXT,
        video_path TEXT,
        youtube_url TEXT,
        duration INTEGER,
        created_by VARCHAR REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        is_active BOOLEAN DEFAULT true,
        is_compliance_course BOOLEAN DEFAULT false,
        renewal_period_months INTEGER DEFAULT 3,
        is_auto_enroll_new_employees BOOLEAN DEFAULT false,
        course_type TEXT DEFAULT 'one-time' CHECK (course_type IN ('recurring', 'one-time')),
        default_deadline_days INTEGER DEFAULT 30,
        reminder_days INTEGER DEFAULT 7,
        questions JSONB
      )
    `);

    // Create quizzes table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS quizzes (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        course_id VARCHAR REFERENCES courses(id) NOT NULL,
        title TEXT NOT NULL,
        questions JSONB NOT NULL,
        passing_score INTEGER DEFAULT 70,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create enrollments table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS enrollments (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR REFERENCES users(id),
        course_id VARCHAR REFERENCES courses(id) NOT NULL,
        enrolled_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        progress INTEGER DEFAULT 0,
        quiz_score INTEGER,
        certificate_issued BOOLEAN DEFAULT false,
        assigned_email TEXT,
        assignment_token TEXT,
        deadline TIMESTAMP,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accessed', 'completed', 'expired')),
        reminders_sent INTEGER DEFAULT 0,
        expires_at TIMESTAMP,
        is_expired BOOLEAN DEFAULT false,
        renewal_count INTEGER DEFAULT 0,
        last_accessed_at TIMESTAMP
      )
    `);

    // Create certificates table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS certificates (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR REFERENCES users(id) NOT NULL,
        course_id VARCHAR REFERENCES courses(id) NOT NULL,
        enrollment_id VARCHAR REFERENCES enrollments(id) NOT NULL,
        issued_at TIMESTAMP DEFAULT NOW(),
        certificate_data JSONB,
        digital_signature TEXT,
        acknowledged_at TIMESTAMP
      )
    `);

    console.log('All tables created successfully');
  } catch (error) {
    console.error('Table creation failed:', error);
    throw error;
  }
}

// Auto-migration for missing columns and database initialization
async function ensureSchemaUpdates() {
  try {
    // Check if we need to reset the database (if RESET_DATABASE env var is set)
    if (process.env.RESET_DATABASE === 'true') {
      console.log('RESET_DATABASE flag detected, resetting database...');
      await resetDatabase();
      return;
    }

    // Check if tables exist, if not create them
    const tablesExist = await db.execute(sql`
      SELECT COUNT(*) as count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'users'
    `);

    if (tablesExist[0]?.count === 0) {
      console.log('Tables do not exist, creating initial schema...');
      await createTables();
      return;
    }

    // Add courseType column if it doesn't exist (separate statements for PostgreSQL compatibility)
    await db.execute(sql`ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_type text DEFAULT 'one-time'`);
    await db.execute(sql`ALTER TABLE courses ADD COLUMN IF NOT EXISTS renewal_period_months integer DEFAULT 3`);
    await db.execute(sql`ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_compliance_course boolean DEFAULT false`);
    await db.execute(sql`ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_auto_enroll_new_employees boolean DEFAULT false`);
    await db.execute(sql`ALTER TABLE courses ADD COLUMN IF NOT EXISTS default_deadline_days integer DEFAULT 30`);
    await db.execute(sql`ALTER TABLE courses ADD COLUMN IF NOT EXISTS reminder_days integer DEFAULT 7`);
    await db.execute(sql`ALTER TABLE courses ADD COLUMN IF NOT EXISTS questions jsonb`);

    // Add missing enrollment columns (separate statements)
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS expires_at timestamp`);
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS is_expired boolean DEFAULT false`);
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS renewal_count integer DEFAULT 0`);
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS assigned_email text`);
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS assignment_token text`);
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS deadline timestamp`);
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'`);
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS reminders_sent INTEGER DEFAULT 0`);
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS last_accessed_at timestamp`);

    // Add password reset fields to users table
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token text`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expiry timestamp`);
    
    // Add missing renewal_count column to users table
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS renewal_count integer DEFAULT 0`);
    
    // Ensure all required columns exist
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number text`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS client_name text`);
    
    // Update enrollments table to ensure all columns exist
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS assigned_email text`);
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS deadline timestamp`);
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'`);
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS assignment_token text`);
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS reminders_sent integer DEFAULT 0`);
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS last_accessed_at timestamp`);
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS expires_at timestamp`);
    await db.execute(sql`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS is_expired boolean DEFAULT false`);

    console.log('Database schema updates completed successfully');

    // Update courses table to include youtube_url
    await db.execute(sql`ALTER TABLE courses ADD COLUMN IF NOT EXISTS youtube_url TEXT`);

    console.log('Database schema updates completed successfully');
  } catch (error) {
    console.error('Schema update error:', error);
  }
}

// Run migration on startup
ensureSchemaUpdates();