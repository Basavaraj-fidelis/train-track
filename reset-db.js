
import pkg from 'pg';
const { Pool } = pkg;
import bcrypt from 'bcrypt';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    sslmode: 'require'
  }
});

async function resetDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('Starting database reset...');
    
    // Drop all tables in correct order (due to foreign key constraints)
    await client.query('DROP TABLE IF EXISTS certificates CASCADE');
    await client.query('DROP TABLE IF EXISTS enrollments CASCADE');
    await client.query('DROP TABLE IF EXISTS quizzes CASCADE');
    await client.query('DROP TABLE IF EXISTS courses CASCADE');
    await client.query('DROP TABLE IF EXISTS users CASCADE');
    
    console.log('All tables dropped successfully');
    
    // Create users table
    await client.query(`
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
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create courses table
    await client.query(`
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
    await client.query(`
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
    await client.query(`
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
    await client.query(`
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

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await client.query(`
      INSERT INTO users (employee_id, email, password, name, role, designation, department, client_name, phone_number, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (email) DO UPDATE SET
        password = EXCLUDED.password,
        role = EXCLUDED.role
    `, [
      'ADMIN001',
      'admin@traintrack.com',
      hashedPassword,
      'Administrator',
      'admin',
      'System Administrator',
      'IT',
      'TrainTrack',
      '+1-555-0100',
      true
    ]);

    console.log('Admin user created/updated successfully');
    console.log('Database reset completed successfully');
    console.log('Admin login: username=admin, password=admin123');
    
  } catch (error) {
    console.error('Database reset failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

resetDatabase()
  .then(() => {
    console.log('Reset operation completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Reset operation failed:', error);
    process.exit(1);
  });
