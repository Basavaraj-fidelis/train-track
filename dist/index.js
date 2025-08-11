var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  bulkAssignCourseSchema: () => bulkAssignCourseSchema,
  bulkAssignUsersSchema: () => bulkAssignUsersSchema,
  bulkEmailAssignmentSchema: () => bulkEmailAssignmentSchema,
  certificates: () => certificates,
  certificatesRelations: () => certificatesRelations,
  courses: () => courses,
  coursesRelations: () => coursesRelations,
  enrollments: () => enrollments,
  enrollmentsRelations: () => enrollmentsRelations,
  insertCertificateSchema: () => insertCertificateSchema,
  insertCourseSchema: () => insertCourseSchema,
  insertEnrollmentSchema: () => insertEnrollmentSchema,
  insertQuizSchema: () => insertQuizSchema,
  insertUserSchema: () => insertUserSchema,
  quizzes: () => quizzes,
  quizzesRelations: () => quizzesRelations,
  users: () => users,
  usersRelations: () => usersRelations
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users, courses, quizzes, enrollments, certificates, usersRelations, coursesRelations, enrollmentsRelations, quizzesRelations, certificatesRelations, insertUserSchema, insertCourseSchema, insertQuizSchema, insertEnrollmentSchema, insertCertificateSchema, bulkAssignCourseSchema, bulkAssignUsersSchema, bulkEmailAssignmentSchema;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    users = pgTable("users", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      employeeId: text("employee_id").unique(),
      email: text("email").notNull().unique(),
      password: text("password"),
      name: text("name").notNull(),
      role: text("role", { enum: ["admin", "employee"] }).notNull().default("employee"),
      designation: text("designation"),
      department: text("department"),
      clientName: text("client_name"),
      phoneNumber: text("phone_number"),
      position: text("position"),
      joinDate: timestamp("join_date").defaultNow(),
      isActive: boolean("is_active").default(true),
      createdAt: timestamp("created_at").defaultNow()
    });
    courses = pgTable("courses", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      title: text("title").notNull(),
      description: text("description"),
      videoPath: text("video_path"),
      youtubeUrl: text("youtube_url"),
      duration: integer("duration"),
      // in minutes
      createdBy: varchar("created_by").references(() => users.id),
      createdAt: timestamp("created_at").defaultNow(),
      isActive: boolean("is_active").default(true),
      isComplianceCourse: boolean("is_compliance_course").default(false),
      renewalPeriodMonths: integer("renewal_period_months").default(3),
      // 3 or 4 months
      isAutoEnrollNewEmployees: boolean("is_auto_enroll_new_employees").default(false),
      // Course type for certificate expiry management
      courseType: text("course_type", { enum: ["recurring", "one-time"] }).default("one-time"),
      // New fields for deadline management
      defaultDeadlineDays: integer("default_deadline_days").default(30),
      // Default days to complete
      reminderDays: integer("reminder_days").default(7),
      // Days before deadline to send reminder
      // Embedded questions for courses
      questions: jsonb("questions")
      // Array of question objects
    });
    quizzes = pgTable("quizzes", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      courseId: varchar("course_id").references(() => courses.id).notNull(),
      title: text("title").notNull(),
      questions: jsonb("questions").notNull(),
      // Array of question objects
      passingScore: integer("passing_score").default(70),
      createdAt: timestamp("created_at").defaultNow()
    });
    enrollments = pgTable("enrollments", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").references(() => users.id),
      courseId: varchar("course_id").references(() => courses.id).notNull(),
      enrolledAt: timestamp("enrolled_at").defaultNow(),
      completedAt: timestamp("completed_at"),
      progress: integer("progress").default(0),
      // percentage 0-100
      quizScore: integer("quiz_score"),
      certificateIssued: boolean("certificate_issued").default(false),
      // New fields for bulk email assignment
      assignedEmail: text("assigned_email"),
      // Email assigned before user creation
      assignmentToken: text("assignment_token"),
      // Unique token for email access
      deadline: timestamp("deadline"),
      // Course completion deadline
      status: text("status", { enum: ["pending", "accessed", "completed", "expired"] }).default("pending"),
      remindersSent: integer("reminders_sent").default(0),
      // Compliance tracking
      expiresAt: timestamp("expires_at"),
      // When the certification expires
      isExpired: boolean("is_expired").default(false),
      renewalCount: integer("renewal_count").default(0)
      // Track how many times renewed
    });
    certificates = pgTable("certificates", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").references(() => users.id).notNull(),
      courseId: varchar("course_id").references(() => courses.id).notNull(),
      enrollmentId: varchar("enrollment_id").references(() => enrollments.id).notNull(),
      issuedAt: timestamp("issued_at").defaultNow(),
      certificateData: jsonb("certificate_data"),
      // Certificate details for PDF generation
      digitalSignature: text("digital_signature"),
      // User's digital signature
      acknowledgedAt: timestamp("acknowledged_at")
      // When user acknowledged completion
    });
    usersRelations = relations(users, ({ many }) => ({
      enrollments: many(enrollments),
      certificates: many(certificates),
      createdCourses: many(courses)
    }));
    coursesRelations = relations(courses, ({ one, many }) => ({
      creator: one(users, {
        fields: [courses.createdBy],
        references: [users.id]
      }),
      enrollments: many(enrollments),
      quizzes: many(quizzes),
      certificates: many(certificates)
    }));
    enrollmentsRelations = relations(enrollments, ({ one }) => ({
      user: one(users, {
        fields: [enrollments.userId],
        references: [users.id]
      }),
      course: one(courses, {
        fields: [enrollments.courseId],
        references: [courses.id]
      })
    }));
    quizzesRelations = relations(quizzes, ({ one }) => ({
      course: one(courses, {
        fields: [quizzes.courseId],
        references: [courses.id]
      })
    }));
    certificatesRelations = relations(certificates, ({ one }) => ({
      user: one(users, {
        fields: [certificates.userId],
        references: [users.id]
      }),
      course: one(courses, {
        fields: [certificates.courseId],
        references: [courses.id]
      }),
      enrollment: one(enrollments, {
        fields: [certificates.enrollmentId],
        references: [enrollments.id]
      })
    }));
    insertUserSchema = createInsertSchema(users).omit({
      id: true,
      createdAt: true
    });
    insertCourseSchema = createInsertSchema(courses).omit({
      id: true,
      createdAt: true
    });
    insertQuizSchema = createInsertSchema(quizzes).omit({
      id: true,
      createdAt: true
    });
    insertEnrollmentSchema = createInsertSchema(enrollments).omit({
      id: true,
      enrolledAt: true
    });
    insertCertificateSchema = createInsertSchema(certificates).omit({
      id: true,
      issuedAt: true
    });
    bulkAssignCourseSchema = z.object({
      courseId: z.string(),
      userIds: z.array(z.string()).min(1, "At least one user must be selected")
    });
    bulkAssignUsersSchema = z.object({
      userIds: z.array(z.string()).min(1, "At least one user must be selected"),
      courseIds: z.array(z.string()).min(1, "At least one course must be selected")
    });
    bulkEmailAssignmentSchema = z.object({
      courseId: z.string(),
      emails: z.array(z.string().email()).min(1, "At least one email must be provided"),
      deadlineDays: z.number().min(1).max(365).default(30)
    });
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  createTables: () => createTables,
  db: () => db,
  pool: () => pool,
  resetDatabase: () => resetDatabase
});
import pkg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql as sql2 } from "drizzle-orm";
async function resetDatabase() {
  try {
    console.log("Starting database reset...");
    await db.execute(sql2`DROP TABLE IF EXISTS certificates CASCADE`);
    await db.execute(sql2`DROP TABLE IF EXISTS enrollments CASCADE`);
    await db.execute(sql2`DROP TABLE IF EXISTS quizzes CASCADE`);
    await db.execute(sql2`DROP TABLE IF EXISTS courses CASCADE`);
    await db.execute(sql2`DROP TABLE IF EXISTS users CASCADE`);
    console.log("All tables dropped successfully");
    await createTables();
    console.log("Database reset completed successfully");
    return true;
  } catch (error) {
    console.error("Database reset failed:", error);
    throw error;
  }
}
async function createTables() {
  try {
    console.log("Creating tables...");
    await db.execute(sql2`
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
    await db.execute(sql2`
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
    await db.execute(sql2`
      CREATE TABLE IF NOT EXISTS quizzes (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        course_id VARCHAR REFERENCES courses(id) NOT NULL,
        title TEXT NOT NULL,
        questions JSONB NOT NULL,
        passing_score INTEGER DEFAULT 70,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql2`
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
    await db.execute(sql2`
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
    console.log("All tables created successfully");
  } catch (error) {
    console.error("Table creation failed:", error);
    throw error;
  }
}
async function ensureSchemaUpdates() {
  try {
    if (process.env.RESET_DATABASE === "true") {
      console.log("RESET_DATABASE flag detected, resetting database...");
      await resetDatabase();
      return;
    }
    const tablesExist = await db.execute(sql2`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users'
    `);
    if (tablesExist[0]?.count === 0) {
      console.log("Tables do not exist, creating initial schema...");
      await createTables();
      return;
    }
    await db.execute(sql2`ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_type text DEFAULT 'one-time'`);
    await db.execute(sql2`ALTER TABLE courses ADD COLUMN IF NOT EXISTS renewal_period_months integer DEFAULT 3`);
    await db.execute(sql2`ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_compliance_course boolean DEFAULT false`);
    await db.execute(sql2`ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_auto_enroll_new_employees boolean DEFAULT false`);
    await db.execute(sql2`ALTER TABLE courses ADD COLUMN IF NOT EXISTS default_deadline_days integer DEFAULT 30`);
    await db.execute(sql2`ALTER TABLE courses ADD COLUMN IF NOT EXISTS reminder_days integer DEFAULT 7`);
    await db.execute(sql2`ALTER TABLE courses ADD COLUMN IF NOT EXISTS questions jsonb`);
    await db.execute(sql2`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS expires_at timestamp`);
    await db.execute(sql2`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS is_expired boolean DEFAULT false`);
    await db.execute(sql2`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS renewal_count integer DEFAULT 0`);
    await db.execute(sql2`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS assigned_email text`);
    await db.execute(sql2`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS assignment_token text`);
    await db.execute(sql2`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS deadline timestamp`);
    await db.execute(sql2`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'`);
    await db.execute(sql2`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS reminders_sent INTEGER DEFAULT 0`);
    await db.execute(sql2`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS last_accessed_at timestamp`);
    await db.execute(sql2`ALTER TABLE courses ADD COLUMN IF NOT EXISTS youtube_url TEXT`);
    console.log("Database schema updates completed successfully");
  } catch (error) {
    console.error("Schema update error:", error);
  }
}
var Pool, pool, db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    ({ Pool } = pkg);
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL must be set. Did you forget to provision a database?"
      );
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
        sslmode: "require"
      }
    });
    db = drizzle({ client: pool, schema: schema_exports });
    ensureSchemaUpdates();
  }
});

// server/index.ts
import express2 from "express";
import session from "express-session";
import MemoryStore from "memorystore";
import cors from "cors";

// server/routes.ts
import { createServer } from "http";

// server/storage.ts
init_db();
init_schema();
import { eq, and, sql as sql3, desc, asc, lt, gte, count, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
var Storage = class {
  // User management
  async createUser(userData) {
    if (!userData.employeeId) {
      const lastUser = await db.select().from(users).where(sql3`employee_id IS NOT NULL`).orderBy(desc(users.createdAt)).limit(1);
      const lastId = lastUser[0]?.employeeId?.match(/\d+$/)?.[0] || "0";
      userData.employeeId = `EMP${String(parseInt(lastId) + 1).padStart(3, "0")}`;
    }
    if (userData.password) {
      userData.password = await bcrypt.hash(userData.password, 10);
    }
    const [newUser] = await db.insert(users).values(userData).returning();
    return newUser;
  }
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || null;
  }
  async getUserByEmail(email) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || null;
  }
  async getUserByEmployeeId(employeeId) {
    const [user] = await db.select().from(users).where(eq(users.employeeId, employeeId));
    return user || null;
  }
  async updateUser(id, userData) {
    if (userData.password) {
      userData.password = await bcrypt.hash(userData.password, 10);
    }
    const [updatedUser] = await db.update(users).set(userData).where(eq(users.id, id)).returning();
    return updatedUser || null;
  }
  async deleteUser(id) {
    await db.delete(certificates).where(eq(certificates.userId, id));
    await db.delete(enrollments).where(eq(enrollments.userId, id));
    const result = await db.delete(users).where(eq(users.id, id));
    return result.rowCount > 0;
  }
  async getAllEmployees() {
    return db.select().from(users).where(eq(users.role, "employee")).orderBy(asc(users.name));
  }
  async deactivateEmployees(employeeIds) {
    const result = await db.update(users).set({ isActive: false }).where(inArray(users.id, employeeIds));
    return result.rowCount;
  }
  // Course management
  async createCourse(courseData) {
    let finalVideoPath = "";
    if (courseData.youtubeUrl && courseData.youtubeUrl.trim()) {
      finalVideoPath = courseData.youtubeUrl.trim();
    } else if (courseData.videoPath && courseData.videoPath.trim()) {
      finalVideoPath = courseData.videoPath.trim();
    }
    const courseToInsert = {
      title: courseData.title,
      description: courseData.description,
      videoPath: finalVideoPath,
      // Store YouTube URL or video file path
      duration: courseData.duration || 0,
      createdBy: courseData.createdBy || "admin",
      courseType: courseData.courseType || "one-time",
      defaultDeadlineDays: courseData.defaultDeadlineDays || 30,
      reminderDays: courseData.reminderDays || 7
    };
    console.log("Creating course with video path:", finalVideoPath);
    const [newCourse] = await db.insert(courses).values(courseToInsert).returning();
    if (courseData.questions && courseData.questions.length > 0) {
      await this.createQuiz({
        courseId: newCourse.id,
        title: `${newCourse.title} Quiz`,
        questions: courseData.questions,
        passingScore: 70
      });
    }
    console.log("Course created successfully:", {
      id: newCourse.id,
      title: newCourse.title,
      videoPath: newCourse.videoPath
    });
    return newCourse;
  }
  async getCourse(id) {
    const [course] = await db.select().from(courses).where(eq(courses.id, id));
    console.log("Retrieved course data for ID:", id);
    console.log("Course details:", {
      id: course?.id,
      title: course?.title,
      videoPath: course?.videoPath,
      hasVideoPath: !!course?.videoPath
    });
    return course || null;
  }
  async getAllCourses() {
    return db.select().from(courses).where(eq(courses.isActive, true)).orderBy(desc(courses.createdAt));
  }
  async updateCourse(id, courseData) {
    const updateData = { ...courseData };
    if (courseData.youtubeUrl !== void 0) {
      updateData.videoPath = courseData.youtubeUrl.trim() || "";
      delete updateData.youtubeUrl;
    }
    delete updateData.questions;
    console.log(`Updating course ${id} with video path:`, updateData.videoPath);
    const [updatedCourse] = await db.update(courses).set(updateData).where(eq(courses.id, id)).returning();
    if (!updatedCourse) {
      console.error(`Failed to update course with id: ${id}`);
      return null;
    }
    if (courseData.questions) {
      const existingQuiz = await this.getQuizByCourseId(id);
      if (existingQuiz) {
        await this.updateQuiz(existingQuiz.id, {
          courseId: id,
          title: existingQuiz.title,
          questions: courseData.questions,
          passingScore: existingQuiz.passingScore
        });
      } else {
        await this.createQuiz({
          courseId: id,
          title: `${updatedCourse.title} Quiz`,
          questions: courseData.questions,
          passingScore: 70
        });
      }
    }
    console.log("Course updated successfully:", {
      id: updatedCourse.id,
      title: updatedCourse.title,
      videoPath: updatedCourse.videoPath
    });
    return updatedCourse;
  }
  async deleteCourse(id) {
    try {
      return await db.transaction(async (tx) => {
        const enrolledUsers = await tx.select({
          userId: enrollments.userId
        }).from(enrollments).where(eq(enrollments.courseId, id));
        const usersToDelete = [];
        for (const enrollment of enrolledUsers) {
          if (enrollment.userId) {
            const otherEnrollmentsCount = await tx.select({ count: count() }).from(enrollments).where(
              and(
                eq(enrollments.userId, enrollment.userId),
                sql3`${enrollments.courseId} != ${id}`
              )
            );
            if ((otherEnrollmentsCount[0]?.count || 0) === 0) {
              usersToDelete.push(enrollment.userId);
            }
          }
        }
        await tx.delete(certificates).where(eq(certificates.courseId, id));
        await tx.delete(enrollments).where(eq(enrollments.courseId, id));
        await tx.delete(quizzes).where(eq(quizzes.courseId, id));
        if (usersToDelete.length > 0) {
          await tx.delete(users).where(inArray(users.id, usersToDelete));
        }
        const result = await tx.delete(courses).where(eq(courses.id, id));
        return result.rowCount > 0;
      });
    } catch (error) {
      console.error("Error during course deletion:", error);
      throw new Error("Failed to delete course and related data");
    }
  }
  async autoEnrollInComplianceCourses(employeeIdentifier) {
    const complianceCourses = await db.select().from(courses).where(
      and(
        eq(courses.isComplianceCourse, true),
        eq(courses.isAutoEnrollNewEmployees, true),
        eq(courses.isActive, true)
      )
    );
    let user = await this.getUserByEmail(employeeIdentifier);
    if (!user) {
      user = await this.getUserByEmployeeId(employeeIdentifier);
    }
    if (!user || complianceCourses.length === 0) {
      return;
    }
    for (const course of complianceCourses) {
      const existingEnrollment = await this.getEnrollment(user.id, course.id);
      if (!existingEnrollment) {
        const deadline = /* @__PURE__ */ new Date();
        deadline.setDate(deadline.getDate() + (course.defaultDeadlineDays || 30));
        await this.createEnrollment({
          userId: user.id,
          courseId: course.id,
          deadline,
          status: "pending"
        });
      }
    }
  }
  // Quiz management
  async createQuiz(quizData) {
    const [newQuiz] = await db.insert(quizzes).values(quizData).returning();
    return newQuiz;
  }
  async getQuiz(id) {
    const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, id));
    return quiz || null;
  }
  async getQuizByCourseId(courseId) {
    const [quiz] = await db.select().from(quizzes).where(eq(quizzes.courseId, courseId));
    return quiz || null;
  }
  async updateQuiz(id, quizData) {
    const [updatedQuiz] = await db.update(quizzes).set(quizData).where(eq(quizzes.id, id)).returning();
    return updatedQuiz || null;
  }
  async deleteQuiz(id) {
    const result = await db.delete(quizzes).where(eq(quizzes.id, id));
    return result.rowCount > 0;
  }
  async deleteQuizByCourseId(courseId) {
    const result = await db.delete(quizzes).where(eq(quizzes.courseId, courseId));
    return result.rowCount > 0;
  }
  async addQuizToCourse(courseId, quizData) {
    const existingQuiz = await this.getQuizByCourseId(courseId);
    if (existingQuiz) {
      const updatedQuiz = await this.updateQuiz(existingQuiz.id, {
        ...quizData,
        courseId
      });
      return updatedQuiz;
    } else {
      return this.createQuiz({
        ...quizData,
        courseId
      });
    }
  }
  // Enrollment management
  async createEnrollment(enrollmentData) {
    if (enrollmentData.assignedEmail && !enrollmentData.userId) {
      enrollmentData.assignmentToken = randomBytes(32).toString("hex");
    }
    const [newEnrollment] = await db.insert(enrollments).values(enrollmentData).returning();
    return newEnrollment;
  }
  async getEnrollment(userId, courseId) {
    const enrollmentsList = await db.select().from(enrollments).where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId))).limit(1);
    return enrollmentsList[0] || null;
  }
  async getEnrollmentById(userId, enrollmentId) {
    const [enrollment] = await db.select().from(enrollments).where(and(eq(enrollments.id, enrollmentId), eq(enrollments.userId, userId)));
    return enrollment || null;
  }
  async getEnrollmentByToken(token) {
    const [enrollment] = await db.select().from(enrollments).where(eq(enrollments.assignmentToken, token));
    return enrollment || null;
  }
  async updateEnrollment(id, enrollmentData) {
    const [updatedEnrollment] = await db.update(enrollments).set(enrollmentData).where(eq(enrollments.id, id)).returning();
    return updatedEnrollment || null;
  }
  async deleteEnrollment(id) {
    const result = await db.delete(enrollments).where(eq(enrollments.id, id));
    return result.rowCount > 0;
  }
  async getUserEnrollments(userId) {
    const enrollmentsData = await db.select({
      id: enrollments.id,
      userId: enrollments.userId,
      courseId: enrollments.courseId,
      enrolledAt: enrollments.enrolledAt,
      completedAt: enrollments.completedAt,
      progress: enrollments.progress,
      quizScore: enrollments.quizScore,
      certificateIssued: enrollments.certificateIssued,
      expiresAt: enrollments.expiresAt,
      isExpired: enrollments.isExpired,
      renewalCount: enrollments.renewalCount,
      assignedEmail: enrollments.assignedEmail,
      assignmentToken: enrollments.assignmentToken,
      deadline: enrollments.deadline,
      status: enrollments.status,
      remindersSent: enrollments.remindersSent,
      lastAccessedAt: sql3`${enrollments.completedAt}`.as("lastAccessedAt"),
      // Include ALL course fields including videoPath
      courseId2: courses.id,
      courseTitle: courses.title,
      courseDescription: courses.description,
      courseVideoPath: courses.videoPath,
      courseDuration: courses.duration,
      courseType: courses.courseType,
      courseCreatedAt: courses.createdAt,
      courseIsActive: courses.isActive,
      courseRenewalPeriodMonths: courses.renewalPeriodMonths,
      courseIsComplianceCourse: courses.isComplianceCourse
    }).from(enrollments).leftJoin(courses, eq(enrollments.courseId, courses.id)).where(eq(enrollments.userId, userId)).orderBy(enrollments.enrolledAt);
    return enrollmentsData.map((enrollment) => ({
      id: enrollment.id,
      userId: enrollment.userId,
      courseId: enrollment.courseId,
      enrolledAt: enrollment.enrolledAt,
      completedAt: enrollment.completedAt,
      progress: enrollment.certificateIssued ? 100 : enrollment.progress || 0,
      // Show 100% if certificate issued
      quizScore: enrollment.quizScore,
      certificateIssued: enrollment.certificateIssued,
      expiresAt: enrollment.expiresAt,
      isExpired: enrollment.isExpired,
      renewalCount: enrollment.renewalCount,
      assignedEmail: enrollment.assignedEmail,
      assignmentToken: enrollment.assignmentToken,
      deadline: enrollment.deadline,
      status: enrollment.certificateIssued ? "completed" : enrollment.status || "pending",
      remindersSent: enrollment.remindersSent,
      lastAccessedAt: enrollment.completedAt || enrollment.enrolledAt,
      course: enrollment.courseId2 ? {
        id: enrollment.courseId2,
        title: enrollment.courseTitle,
        description: enrollment.courseDescription,
        videoPath: enrollment.courseVideoPath,
        // Include videoPath
        duration: enrollment.courseDuration,
        courseType: enrollment.courseType,
        createdAt: enrollment.courseCreatedAt,
        isActive: enrollment.courseIsActive,
        renewalPeriodMonths: enrollment.courseRenewalPeriodMonths,
        isComplianceCourse: enrollment.courseIsComplianceCourse
      } : null
    }));
  }
  async getUserActiveEnrollments(userId) {
    const enrollmentsData = await db.select({
      id: enrollments.id,
      userId: enrollments.userId,
      courseId: enrollments.courseId,
      enrolledAt: enrollments.enrolledAt,
      completedAt: enrollments.completedAt,
      progress: enrollments.progress,
      quizScore: enrollments.quizScore,
      certificateIssued: enrollments.certificateIssued,
      expiresAt: enrollments.expiresAt,
      isExpired: enrollments.isExpired,
      renewalCount: enrollments.renewalCount,
      assignedEmail: enrollments.assignedEmail,
      assignmentToken: enrollments.assignmentToken,
      deadline: enrollments.deadline,
      status: enrollments.status,
      remindersSent: enrollments.remindersSent,
      lastAccessedAt: sql3`${enrollments.completedAt}`.as("lastAccessedAt"),
      // Separate course fields instead of nested object
      courseId2: courses.id,
      courseTitle: courses.title,
      courseDescription: courses.description,
      courseDuration: courses.duration,
      courseType: courses.courseType,
      courseRenewalPeriodMonths: courses.renewalPeriodMonths,
      courseIsComplianceCourse: courses.isComplianceCourse
    }).from(enrollments).leftJoin(courses, eq(enrollments.courseId, courses.id)).where(and(
      eq(enrollments.userId, userId),
      eq(courses.isActive, true)
      // Only check enrollments for active courses
    )).orderBy(enrollments.enrolledAt);
    return enrollmentsData.map((enrollment) => ({
      ...enrollment,
      lastAccessedAt: enrollment.completedAt || enrollment.enrolledAt,
      course: enrollment.courseId2 ? {
        id: enrollment.courseId2,
        title: enrollment.courseTitle,
        description: enrollment.courseDescription,
        duration: enrollment.courseDuration,
        courseType: enrollment.courseType,
        renewalPeriodMonths: enrollment.courseRenewalPeriodMonths,
        isComplianceCourse: enrollment.isComplianceCourse
      } : null
    }));
  }
  async getAllEnrollments() {
    const enrollmentsData = await db.select({
      id: enrollments.id,
      enrolledAt: enrollments.enrolledAt,
      completedAt: enrollments.completedAt,
      progress: enrollments.progress,
      quizScore: enrollments.quizScore,
      certificateIssued: enrollments.certificateIssued,
      deadline: enrollments.deadline,
      status: enrollments.status,
      assignedEmail: enrollments.assignedEmail,
      remindersSent: enrollments.remindersSent,
      // Separate user fields
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
      userEmployeeId: users.employeeId,
      // Separate course fields
      courseId: courses.id,
      courseTitle: courses.title,
      courseDescription: courses.description
    }).from(enrollments).leftJoin(users, eq(enrollments.userId, users.id)).innerJoin(courses, eq(enrollments.courseId, courses.id)).orderBy(desc(enrollments.enrolledAt));
    return enrollmentsData.map((enrollment) => ({
      id: enrollment.id,
      enrolledAt: enrollment.enrolledAt,
      completedAt: enrollment.completedAt,
      progress: enrollment.progress,
      quizScore: enrollment.quizScore,
      certificateIssued: enrollment.certificateIssued,
      deadline: enrollment.deadline,
      status: enrollment.status,
      assignedEmail: enrollment.assignedEmail,
      remindersSent: enrollment.remindersSent,
      user: enrollment.userId ? {
        id: enrollment.userId,
        name: enrollment.userName,
        email: enrollment.userEmail,
        employeeId: enrollment.userEmployeeId
      } : null,
      course: {
        id: enrollment.courseId,
        title: enrollment.courseTitle,
        description: enrollment.courseDescription
      }
    }));
  }
  async getCourseEnrollments(courseId) {
    try {
      const enrollmentsData = await db.select({
        // Enrollment fields
        id: enrollments.id,
        userId: enrollments.userId,
        courseId: enrollments.courseId,
        enrolledAt: enrollments.enrolledAt,
        progress: enrollments.progress,
        completedAt: enrollments.completedAt,
        certificateIssued: enrollments.certificateIssued,
        assignedEmail: enrollments.assignedEmail,
        // User fields
        userName: users.name,
        userEmail: users.email,
        userDepartment: users.department,
        userClientName: users.clientName,
        userIdFromTable: users.id
      }).from(enrollments).leftJoin(users, eq(enrollments.userId, users.id)).where(eq(enrollments.courseId, courseId));
      const transformedData = enrollmentsData.map((enrollment, index) => {
        try {
          return {
            id: enrollment.id || `temp-${Date.now()}-${index}`,
            userId: enrollment.userId || null,
            courseId: enrollment.courseId || courseId,
            enrolledAt: enrollment.enrolledAt || null,
            progress: Math.max(0, Math.min(100, Number(enrollment.progress) || 0)),
            completedAt: enrollment.completedAt || null,
            certificateIssued: Boolean(enrollment.certificateIssued),
            assignedEmail: enrollment.assignedEmail || "",
            user: enrollment.userIdFromTable ? {
              id: enrollment.userIdFromTable,
              name: enrollment.userName || "Not registered",
              email: enrollment.userEmail || enrollment.assignedEmail || "",
              department: enrollment.userDepartment || "N/A",
              clientName: enrollment.userClientName || "N/A"
            } : null
          };
        } catch (transformError) {
          console.error(`Error transforming enrollment at index ${index}:`, transformError);
          return null;
        }
      }).filter(Boolean);
      return transformedData;
    } catch (error) {
      console.error(`Error retrieving course enrollments for ${courseId}:`, error);
      return [];
    }
  }
  // Certificate management
  async createCertificate(certificateData) {
    const [newCertificate] = await db.insert(certificates).values(certificateData).returning();
    return newCertificate;
  }
  async getUserCertificates(userId) {
    return db.select({
      id: certificates.id,
      issuedAt: certificates.issuedAt,
      certificateData: certificates.certificateData,
      digitalSignature: certificates.digitalSignature,
      acknowledgedAt: certificates.acknowledgedAt,
      course: {
        id: courses.id,
        title: courses.title,
        description: courses.description,
        courseType: courses.courseType,
        renewalPeriodMonths: courses.renewalPeriodMonths
      }
    }).from(certificates).innerJoin(courses, eq(certificates.courseId, courses.id)).where(eq(certificates.userId, userId)).orderBy(desc(certificates.issuedAt));
  }
  async getUserCertificateForCourse(userId, courseId) {
    const [certificate] = await db.select().from(certificates).where(and(eq(certificates.userId, userId), eq(certificates.courseId, courseId)));
    return certificate || null;
  }
  async getAllCertificates() {
    return db.select({
      id: certificates.id,
      issuedAt: certificates.issuedAt,
      certificateData: certificates.certificateData,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
        employeeId: users.employeeId
      },
      course: {
        id: courses.id,
        title: courses.title
      }
    }).from(certificates).innerJoin(users, eq(certificates.userId, users.id)).innerJoin(courses, eq(certificates.courseId, courses.id)).orderBy(desc(certificates.issuedAt));
  }
  async updateCertificate(id, certificateData) {
    const [updatedCertificate] = await db.update(certificates).set(certificateData).where(eq(certificates.id, id)).returning();
    return updatedCertificate || null;
  }
  async deleteCertificate(id) {
    const result = await db.delete(certificates).where(eq(certificates.id, id));
    return result.rowCount > 0;
  }
  // Bulk operations
  async bulkAssignCourse(courseId, userIds) {
    const course = await this.getCourse(courseId);
    if (!course) throw new Error("Course not found");
    const deadline = /* @__PURE__ */ new Date();
    deadline.setDate(deadline.getDate() + (course.defaultDeadlineDays || 30));
    const enrollmentPromises = userIds.map(
      (userId) => this.createEnrollment({
        userId,
        courseId,
        deadline,
        status: "pending"
      }).catch(() => null)
      // Ignore duplicates
    );
    const results = await Promise.all(enrollmentPromises);
    return results.filter(Boolean);
  }
  async bulkAssignUsers(userIds, courseIds) {
    const enrollments2 = [];
    for (const courseId of courseIds) {
      const course = await this.getCourse(courseId);
      if (!course) continue;
      const deadline = /* @__PURE__ */ new Date();
      deadline.setDate(deadline.getDate() + (course.defaultDeadlineDays || 30));
      for (const userId of userIds) {
        try {
          const enrollment = await this.createEnrollment({
            userId,
            courseId,
            deadline,
            status: "pending"
          });
          enrollments2.push(enrollment);
        } catch {
        }
      }
    }
    return enrollments2;
  }
  async bulkAssignCourseByEmail(courseId, emails, deadlineDays = 30) {
    const course = await this.getCourse(courseId);
    if (!course) throw new Error("Course not found");
    const deadline = /* @__PURE__ */ new Date();
    deadline.setDate(deadline.getDate() + deadlineDays);
    const assignments = [];
    for (const email of emails) {
      try {
        const assignment = await this.createEnrollment({
          courseId,
          assignedEmail: email,
          deadline,
          status: "pending",
          assignmentToken: randomBytes(32).toString("hex")
        });
        assignments.push({
          ...assignment,
          assignedEmail: email,
          deadline
        });
      } catch (error) {
        console.error(`Failed to assign course to ${email}:`, error);
      }
    }
    return assignments;
  }
  // Dashboard and analytics
  async getDashboardStats() {
    const [
      totalEmployeesResult,
      activeCoursesResult,
      pendingAssignmentsResult,
      certificatesIssuedResult
    ] = await Promise.all([
      db.select({ count: count() }).from(users).where(eq(users.role, "employee")),
      db.select({ count: count() }).from(courses).where(eq(courses.isActive, true)),
      db.select({ count: count() }).from(enrollments).where(eq(enrollments.status, "pending")),
      db.select({ count: count() }).from(certificates)
    ]);
    return {
      totalEmployees: totalEmployeesResult[0]?.count || 0,
      activeCourses: activeCoursesResult[0]?.count || 0,
      pendingAssignments: pendingAssignmentsResult[0]?.count || 0,
      certificatesIssued: certificatesIssuedResult[0]?.count || 0
    };
  }
  async getUserAnalytics(userId) {
    const [
      enrollmentCount,
      completedCount,
      certificateCount,
      averageScore
    ] = await Promise.all([
      db.select({ count: count() }).from(enrollments).where(eq(enrollments.userId, userId)),
      db.select({ count: count() }).from(enrollments).where(and(eq(enrollments.userId, userId), eq(enrollments.certificateIssued, true))),
      db.select({ count: count() }).from(certificates).where(eq(certificates.userId, userId)),
      db.select({ avg: sql3`AVG(${enrollments.quizScore})` }).from(enrollments).where(and(eq(enrollments.userId, userId), sql3`${enrollments.quizScore} IS NOT NULL`))
    ]);
    return {
      totalEnrollments: enrollmentCount[0]?.count || 0,
      completedCourses: completedCount[0]?.count || 0,
      certificatesEarned: certificateCount[0]?.count || 0,
      averageQuizScore: Math.round(averageScore[0]?.avg || 0)
    };
  }
  // Compliance and reporting
  async getComplianceReport() {
    const employees = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      employeeId: users.employeeId,
      department: users.department
    }).from(users).where(and(eq(users.role, "employee"), eq(users.isActive, true)));
    const complianceCourses = await db.select().from(courses).where(and(eq(courses.isComplianceCourse, true), eq(courses.isActive, true)));
    const complianceData = [];
    for (const employee of employees) {
      const enrollments2 = await this.getUserEnrollments(employee.id);
      const complianceEnrollments = enrollments2.filter(
        (e) => complianceCourses.some((c) => c.id === e.course.id)
      );
      const compliantCount = complianceEnrollments.filter(
        (e) => e.certificateIssued && (!e.isExpired || e.course.courseType === "one-time")
      ).length;
      complianceData.push({
        ...employee,
        totalComplianceCourses: complianceCourses.length,
        compliantCourses: compliantCount,
        complianceRate: complianceCourses.length > 0 ? Math.round(compliantCount / complianceCourses.length * 100) : 100,
        isCompliant: compliantCount === complianceCourses.length
      });
    }
    return {
      employees: complianceData,
      overallComplianceRate: complianceData.length > 0 ? Math.round(complianceData.reduce((sum, emp) => sum + emp.complianceRate, 0) / complianceData.length) : 100
    };
  }
  async renewExpiredCertifications(courseId, userIds) {
    const renewedEnrollments = [];
    for (const userId of userIds) {
      const enrollment = await this.getEnrollment(userId, courseId);
      if (enrollment && enrollment.isExpired) {
        const course = await this.getCourse(courseId);
        if (!course) continue;
        const deadline = /* @__PURE__ */ new Date();
        deadline.setDate(deadline.getDate() + (course.defaultDeadlineDays || 30));
        const renewed = await this.updateEnrollment(enrollment.id, {
          isExpired: false,
          progress: 0,
          quizScore: null,
          certificateIssued: false,
          completedAt: null,
          deadline,
          status: "pending",
          renewalCount: (enrollment.renewalCount || 0) + 1
        });
        if (renewed) {
          renewedEnrollments.push(renewed);
        }
      }
    }
    return renewedEnrollments;
  }
  // Assignment tracking
  async getCourseAssignments(courseId) {
    try {
      console.log(`Fetching assignments for course: ${courseId}`);
      const result = await db.select({
        // Enrollment fields
        id: enrollments.id,
        courseId: enrollments.courseId,
        userId: enrollments.userId,
        assignedEmail: enrollments.assignedEmail,
        enrolledAt: enrollments.enrolledAt,
        progress: enrollments.progress,
        quizScore: enrollments.quizScore,
        certificateIssued: enrollments.certificateIssued,
        remindersSent: enrollments.remindersSent,
        deadline: enrollments.deadline,
        status: enrollments.status,
        completedAt: enrollments.completedAt,
        assignmentToken: enrollments.assignmentToken,
        lastAccessedAt: enrollments.lastAccessedAt,
        // User fields
        userIdFromJoin: users.id,
        userName: users.name,
        userEmail: users.email,
        userDepartment: users.department,
        userClientName: users.clientName
      }).from(enrollments).leftJoin(users, eq(enrollments.userId, users.id)).where(eq(enrollments.courseId, courseId)).orderBy(desc(enrollments.enrolledAt));
      console.log(`Raw query result count: ${result.length}`);
      const transformedData = result.map((row, index) => {
        try {
          return {
            id: row.id || `temp-${Date.now()}-${index}`,
            courseId: row.courseId || courseId,
            userId: row.userId || null,
            assignedEmail: row.assignedEmail || "",
            enrolledAt: row.enrolledAt || null,
            progress: Math.max(0, Math.min(100, Number(row.progress) || 0)),
            quizScore: row.quizScore ? Number(row.quizScore) : null,
            certificateIssued: Boolean(row.certificateIssued),
            remindersSent: Math.max(0, Number(row.remindersSent) || 0),
            deadline: row.deadline || null,
            status: row.status || "pending",
            completedAt: row.completedAt || null,
            assignmentToken: row.assignmentToken || null,
            lastAccessedAt: row.lastAccessedAt || null,
            user: row.userIdFromJoin ? {
              id: row.userIdFromJoin,
              name: row.userName || "Not registered",
              email: row.userEmail || row.assignedEmail || "",
              department: row.userDepartment || "N/A",
              clientName: row.userClientName || "N/A"
            } : null
          };
        } catch (transformError) {
          console.error(`Error transforming assignment at index ${index}:`, transformError);
          return null;
        }
      }).filter(Boolean);
      console.log(`Found ${transformedData.length} assignments for course ${courseId}`);
      return transformedData;
    } catch (error) {
      console.error(`Error retrieving course assignments for ${courseId}:`, error);
      return [];
    }
  }
  async incrementReminderCount(enrollmentId) {
    await db.update(enrollments).set({ remindersSent: sql3`${enrollments.remindersSent} + 1` }).where(eq(enrollments.id, enrollmentId));
  }
  async getTotalRemindersSent() {
    const [result] = await db.select({ total: sql3`SUM(${enrollments.remindersSent})` }).from(enrollments);
    return result?.total || 0;
  }
  async getCourseDeletionImpact(courseId) {
    const course = await this.getCourse(courseId);
    if (!course) {
      return {
        course: null,
        totalEnrollments: 0,
        usersToDelete: [],
        usersToKeep: [],
        certificatesCount: 0,
        quizzesCount: 0
      };
    }
    const courseEnrollments = await this.getCourseEnrollments(courseId);
    const enrolledUserIds = [...new Set(courseEnrollments.map((e) => e.user?.id).filter(Boolean))];
    const usersToDelete = [];
    const usersToKeep = [];
    for (const userId of enrolledUserIds) {
      if (userId) {
        const user = await this.getUser(userId);
        const userEnrollments = await this.getUserEnrollments(userId);
        const otherCoursesCount = userEnrollments.filter((e) => e.courseId !== courseId).length;
        if (otherCoursesCount === 0 && user) {
          usersToDelete.push(user);
        } else if (user) {
          usersToKeep.push(user);
        }
      }
    }
    const [certificatesResult, quizzesResult] = await Promise.all([
      db.select({ count: count() }).from(certificates).where(eq(certificates.courseId, courseId)),
      db.select({ count: count() }).from(quizzes).where(eq(quizzes.courseId, courseId))
    ]);
    return {
      course,
      totalEnrollments: courseEnrollments.length,
      usersToDelete,
      usersToKeep,
      certificatesCount: certificatesResult[0]?.count || 0,
      quizzesCount: quizzesResult[0]?.count || 0
    };
  }
  async cleanupExpiredAssignments() {
    const result = await db.update(enrollments).set({ status: "expired", isExpired: true }).where(
      and(
        lt(enrollments.deadline, /* @__PURE__ */ new Date()),
        eq(enrollments.status, "pending")
      )
    );
    return result.rowCount;
  }
  async resetReminderData() {
    const thirtyDaysAgo = /* @__PURE__ */ new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const result = await db.update(enrollments).set({ remindersSent: 0 }).where(
      and(
        lt(enrollments.enrolledAt, thirtyDaysAgo),
        gte(enrollments.remindersSent, 1)
      )
    );
    return result.rowCount;
  }
};
var storage = new Storage();

// server/routes.ts
init_schema();
import { z as z2 } from "zod";
import bcrypt2 from "bcrypt";
import multer from "multer";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";

// server/types.ts
import "express-session";

// server/routes.ts
var upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), "server/uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|avi|mov|wmv|webm/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only video files are allowed"));
    }
  },
  limits: {
    fileSize: 500 * 1024 * 1024
    // 500MB limit
  }
});
var transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || process.env.EMAIL_USER,
    pass: process.env.SMTP_PASS || process.env.EMAIL_PASS
  }
});
async function registerRoutes(app2) {
  const checkDatabaseHealth = async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        await storage.getDashboardStats();
        console.log("Database connection healthy");
        return true;
      } catch (error) {
        console.error(`Database health check failed (attempt ${i + 1}):`, error);
        if (i < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2e3 * (i + 1)));
        }
      }
    }
    return false;
  };
  await checkDatabaseHealth();
  app2.post("/api/admin/reset-database", async (req, res) => {
    try {
      const { resetKey } = req.body;
      if (resetKey !== "RESET_TRAINTRACK_DB_2025") {
        return res.status(403).json({ message: "Invalid reset key" });
      }
      const { resetDatabase: resetDatabase2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      await resetDatabase2();
      const hashedPassword = await bcrypt2.hash("admin123", 10);
      const adminUser = await storage.createUser({
        employeeId: "ADMIN001",
        email: "admin@traintrack.com",
        name: "Administrator",
        role: "admin",
        designation: "System Administrator",
        department: "IT",
        clientName: "TrainTrack",
        phoneNumber: "+1-555-0100",
        password: hashedPassword,
        isActive: true
      });
      console.log("Database reset completed and admin user created");
      res.json({
        success: true,
        message: "Database reset successfully and admin user created",
        adminUser: {
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.name,
          role: adminUser.role
        }
      });
    } catch (error) {
      console.error("Database reset error:", error);
      res.status(500).json({
        message: "Failed to reset database",
        error: process.env.NODE_ENV === "development" ? error.message : void 0
      });
    }
  });
  const cleanupExpiredAssignments = async () => {
    try {
      const expiredCount = await storage.cleanupExpiredAssignments();
      if (expiredCount > 0) {
        console.log(`Cleaned up ${expiredCount} expired course assignments`);
      }
      const resetCount = await storage.resetReminderData();
      if (resetCount > 0) {
        console.log(`Reset reminder data for ${resetCount} old assignments`);
      }
    } catch (error) {
      console.error("Failed to cleanup expired assignments:", error);
    }
  };
  cleanupExpiredAssignments();
  setInterval(cleanupExpiredAssignments, 60 * 60 * 1e3);
  app2.post("/api/auth/admin-login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (username === "admin" && password === "admin123") {
        let adminUser = await storage.getUserByEmail("admin@traintrack.com");
        if (!adminUser) {
          console.log("Creating default admin user...");
          const hashedPassword = await bcrypt2.hash("admin123", 10);
          adminUser = await storage.createUser({
            employeeId: "ADMIN001",
            email: "admin@traintrack.com",
            name: "Administrator",
            role: "admin",
            designation: "System Administrator",
            department: "IT",
            clientName: "TrainTrack",
            phoneNumber: "+1-555-0100",
            password: hashedPassword,
            isActive: true
          });
          console.log("Admin user created successfully");
        }
        if (adminUser.password) {
          const isValidPassword = await bcrypt2.compare("admin123", adminUser.password);
          if (!isValidPassword) {
            return res.status(401).json({ message: "Invalid credentials" });
          }
        }
        req.session.userId = adminUser.id;
        req.session.userRole = "admin";
        console.log("Admin login successful:", { userId: adminUser.id, email: adminUser.email });
        res.json({
          success: true,
          user: {
            id: adminUser.id,
            email: adminUser.email,
            name: adminUser.name,
            role: adminUser.role,
            employeeId: adminUser.employeeId
          }
        });
      } else {
        res.status(401).json({ message: "Invalid credentials" });
      }
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({
        message: "Login failed",
        error: process.env.NODE_ENV === "development" ? error.message : void 0
      });
    }
  });
  app2.post("/api/auth/employee-login", async (req, res) => {
    try {
      const { email } = req.body;
      const user = await storage.getUserByEmail(email);
      if (!user || user.role !== "employee" || !user.isActive) {
        return res.status(401).json({ message: "Email not found or not authorized. Please contact HR." });
      }
      req.session.userId = user.id;
      req.session.userRole = "employee";
      res.json({ success: true, user });
    } catch (error) {
      res.status(500).json({ message: "Login failed" });
    }
  });
  app2.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });
  app2.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    res.json({ user });
  });
  const requireAdmin = async (req, res, next) => {
    console.log("Session check - userId:", req.session.userId, "userRole:", req.session.userRole);
    if (!req.session.userId || req.session.userRole !== "admin") {
      console.log("Admin access denied - Session:", req.session);
      return res.status(403).json({ message: "Admin access required" });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || user.role !== "admin") {
        console.log("User not found or not admin - destroying session");
        req.session.destroy();
        return res.status(403).json({ message: "Admin access required" });
      }
    } catch (error) {
      console.error("Error verifying admin user:", error);
      return res.status(500).json({ message: "Authentication error" });
    }
    next();
  };
  const requireAuth = async (req, res, next) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  };
  app2.get("/api/employees", requireAdmin, async (req, res) => {
    try {
      const employees = await storage.getAllEmployees();
      res.json(employees);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch employees" });
    }
  });
  app2.post("/api/employees", requireAdmin, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      userData.role = "employee";
      const employee = await storage.createUser(userData);
      res.json(employee);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        res.status(400).json({ message: "Invalid employee data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create employee" });
      }
    }
  });
  app2.put("/api/employees/:id", requireAdmin, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      userData.role = "employee";
      const updatedEmployee = await storage.updateUser(req.params.id, userData);
      if (updatedEmployee) {
        res.json(updatedEmployee);
      } else {
        res.status(404).json({ message: "Employee not found" });
      }
    } catch (error) {
      if (error instanceof z2.ZodError) {
        res.status(400).json({ message: "Invalid employee data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update employee" });
      }
    }
  });
  app2.delete("/api/employees/:id", requireAdmin, async (req, res) => {
    try {
      const success = await storage.deleteUser(req.params.id);
      if (success) {
        res.json({ success: true, message: "Employee and all related data deleted successfully" });
      } else {
        res.status(404).json({ message: "Employee not found" });
      }
    } catch (error) {
      console.error("Employee deletion error:", error);
      res.status(500).json({
        message: "Failed to delete employee",
        error: process.env.NODE_ENV === "development" ? error.message : void 0
      });
    }
  });
  app2.get("/api/courses", async (req, res) => {
    try {
      const courses2 = await storage.getAllCourses();
      res.json(courses2);
    } catch (error) {
      console.error("Error fetching courses:", error);
      if (error.code === "42703") {
        console.log("Database schema needs updating, returning empty courses array");
        res.json([]);
      } else {
        res.status(500).json({
          message: "Failed to fetch courses",
          error: process.env.NODE_ENV === "development" ? error.message : void 0
        });
      }
    }
  });
  app2.post("/api/courses", requireAdmin, upload.single("video"), async (req, res) => {
    try {
      console.log("Course creation request body:", req.body);
      console.log("Course creation file:", req.file);
      const { title, description, questions, courseType, youtubeUrl } = req.body;
      if (!title || !description) {
        return res.status(400).json({ message: "Title and description are required" });
      }
      if (!youtubeUrl?.trim() && !req.file) {
        return res.status(400).json({ message: "Video file or YouTube URL is required" });
      }
      let parsedQuestions = [];
      if (questions) {
        try {
          parsedQuestions = typeof questions === "string" ? JSON.parse(questions) : questions;
        } catch (parseError) {
          console.error("Error parsing questions:", parseError);
          return res.status(400).json({ message: "Invalid questions format" });
        }
      }
      const course = await storage.createCourse({
        title: title.trim(),
        description: description.trim(),
        youtubeUrl: youtubeUrl?.trim() || "",
        // Use youtubeUrl parameter
        videoPath: req.file ? req.file.filename : "",
        // Use file upload if available
        courseType: courseType || "one-time",
        createdBy: req.session.userId,
        questions: parsedQuestions
      });
      console.log("Course created with ID:", course.id, "Video path:", course.videoPath);
      res.json({ success: true, course });
    } catch (error) {
      console.error("Course creation error:", error);
      res.status(500).json({
        message: "Failed to create course",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.put("/api/courses/:id", requireAdmin, upload.single("video"), async (req, res) => {
    try {
      const { title, description, questions, courseType, youtubeUrl } = req.body;
      const updateData = {
        title,
        description,
        courseType: courseType || "one-time"
      };
      if (req.file) {
        updateData.videoPath = req.file.filename;
        console.log("Updating course with uploaded file:", req.file.filename);
      } else if (youtubeUrl !== void 0) {
        updateData.youtubeUrl = youtubeUrl?.trim() || "";
        console.log("Updating course with YouTube URL:", youtubeUrl);
      }
      if (questions) {
        let parsedQuestions = [];
        try {
          parsedQuestions = typeof questions === "string" ? JSON.parse(questions) : questions;
        } catch (parseError) {
          console.error("Error parsing questions:", parseError);
          return res.status(400).json({ message: "Invalid questions format" });
        }
        updateData.questions = parsedQuestions;
      }
      const updatedCourse = await storage.updateCourse(req.params.id, updateData);
      if (!updatedCourse) {
        return res.status(404).json({ message: "Course not found" });
      }
      res.json(updatedCourse);
    } catch (error) {
      console.error("Course update error:", error);
      res.status(500).json({ message: "Failed to update course" });
    }
  });
  app2.get("/api/courses/:id/deletion-impact", requireAdmin, async (req, res) => {
    try {
      const impact = await storage.getCourseDeletionImpact(req.params.id);
      if (!impact.course) {
        return res.status(404).json({ message: "Course not found" });
      }
      res.json({
        course: impact.course,
        impact: {
          totalEnrollments: impact.totalEnrollments,
          usersWillBeDeleted: impact.usersToDelete.length,
          usersWillBeKept: impact.usersToKeep.length,
          certificatesWillBeDeleted: impact.certificatesCount,
          quizzesWillBeDeleted: impact.quizzesCount
        },
        usersToDelete: impact.usersToDelete.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          employeeId: u.employeeId
        })),
        usersToKeep: impact.usersToKeep.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          employeeId: u.employeeId
        }))
      });
    } catch (error) {
      console.error("Error getting deletion impact:", error);
      res.status(500).json({
        message: "Failed to get deletion impact",
        error: process.env.NODE_ENV === "development" ? error.message : void 0
      });
    }
  });
  app2.delete("/api/courses/:id", requireAdmin, async (req, res) => {
    try {
      const course = await storage.getCourse(req.params.id);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      const enrollments2 = await storage.getCourseEnrollments(req.params.id);
      const enrolledUserIds = [...new Set(enrollments2.map((e) => e.user?.id).filter(Boolean))];
      const success = await storage.deleteCourse(req.params.id);
      if (success) {
        console.log(`Course deleted: ${course.title} (ID: ${req.params.id})`);
        console.log(`Cleaned up ${enrollments2.length} enrollments for ${enrolledUserIds.length} users`);
        res.json({
          success: true,
          message: "Course and all related data deleted successfully",
          details: {
            courseName: course.title,
            enrollmentsRemoved: enrollments2.length,
            usersAffected: enrolledUserIds.length
          }
        });
      } else {
        res.status(404).json({ message: "Course not found" });
      }
    } catch (error) {
      console.error("Course deletion error:", error);
      res.status(500).json({
        message: "Failed to delete course and related data",
        error: process.env.NODE_ENV === "development" ? error.message : void 0
      });
    }
  });
  app2.get("/api/courses/:id", async (req, res) => {
    try {
      const course = await storage.getCourse(req.params.id);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      res.json(course);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch course" });
    }
  });
  app2.get("/api/videos/:filename", (req, res) => {
    try {
      const filename = req.params.filename;
      const videoPath = path.join(process.cwd(), "server/uploads", filename);
      console.log(`Attempting to serve video: ${videoPath}`);
      if (!fs.existsSync(videoPath)) {
        console.error(`Video file not found: ${videoPath}`);
        return res.status(404).json({ message: "Video not found" });
      }
      const stat = fs.statSync(videoPath);
      const fileSize = stat.size;
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = end - start + 1;
        const file = fs.createReadStream(videoPath, { start, end });
        const head = {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": "video/mp4"
          // Assuming mp4, adjust if needed
        };
        res.writeHead(206, head);
        file.pipe(res);
      } else {
        const head = {
          "Content-Length": fileSize,
          "Content-Type": "video/mp4"
          // Assuming mp4, adjust if needed
        };
        res.writeHead(200, head);
        fs.createReadStream(videoPath).pipe(res);
      }
    } catch (error) {
      console.error(`Error streaming video ${req.params.filename}:`, error);
      res.status(500).json({ message: "Error streaming video" });
    }
  });
  app2.get("/api/courses/:courseId/quiz", async (req, res) => {
    try {
      console.log(`Fetching quiz for course: ${req.params.courseId}`);
      const course = await storage.getCourse(req.params.courseId);
      if (!course) {
        console.log(`Course not found: ${req.params.courseId}`);
        return res.status(404).json({ message: "Course not found" });
      }
      console.log(`Course found: ${course.title}, has questions:`, !!course.questions);
      let quiz = await storage.getQuizByCourseId(req.params.courseId);
      console.log("Separate quiz found:", !!quiz);
      if (!quiz && course.questions && course.questions.length > 0) {
        console.log(`Using embedded questions for course: ${course.title}`);
        quiz = {
          id: `course-embedded-quiz-${course.id}`,
          courseId: course.id,
          title: `${course.title} Quiz`,
          questions: course.questions,
          passingScore: 70,
          // Default passing score
          createdAt: /* @__PURE__ */ new Date()
        };
      }
      if (!quiz) {
        console.log("No quiz or questions found for course");
        return res.status(404).json({ message: "No quiz found for this course" });
      }
      console.log(`Returning quiz with ${quiz.questions?.length || 0} questions`);
      res.json(quiz);
    } catch (error) {
      console.error("Quiz fetch error:", error);
      res.status(500).json({
        message: "Failed to fetch quiz",
        error: process.env.NODE_ENV === "development" ? error.message : void 0
      });
    }
  });
  app2.post("/api/courses/:courseId/quiz", requireAdmin, async (req, res) => {
    try {
      const quizData = insertQuizSchema.parse({
        ...req.body,
        courseId: req.params.courseId
      });
      const quiz = await storage.createQuiz(quizData);
      res.json(quiz);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        res.status(400).json({ message: "Invalid quiz data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create quiz" });
      }
    }
  });
  app2.put("/api/quizzes/:id", requireAdmin, async (req, res) => {
    try {
      const quizData = insertQuizSchema.parse(req.body);
      const updatedQuiz = await storage.updateQuiz(req.params.id, quizData);
      if (updatedQuiz) {
        res.json(updatedQuiz);
      } else {
        res.status(404).json({ message: "Quiz not found" });
      }
    } catch (error) {
      if (error instanceof z2.ZodError) {
        res.status(400).json({ message: "Invalid quiz data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update quiz" });
      }
    }
  });
  app2.delete("/api/quizzes/:id", requireAdmin, async (req, res) => {
    try {
      const success = await storage.deleteQuiz(req.params.id);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ message: "Quiz not found" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to delete quiz" });
    }
  });
  app2.get("/api/my-enrollments", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const enrollments2 = await storage.getUserEnrollments(req.session.userId);
      res.json(enrollments2);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch enrollments" });
    }
  });
  app2.put("/api/my-enrollments/:enrollmentId", requireAuth, async (req, res) => {
    try {
      const { progress } = req.body;
      const enrollmentId = req.params.enrollmentId;
      const enrollment = await storage.getEnrollmentById(req.session.userId, enrollmentId);
      if (!enrollment) {
        return res.status(404).json({ message: "Enrollment not found or access denied" });
      }
      const updatedEnrollment = await storage.updateEnrollment(enrollmentId, {
        progress: Math.min(Math.max(progress || 0, 0), 100),
        // Ensure progress is between 0-100
        lastAccessedAt: /* @__PURE__ */ new Date()
      });
      if (updatedEnrollment) {
        res.json(updatedEnrollment);
      } else {
        res.status(404).json({ message: "Failed to update enrollment" });
      }
    } catch (error) {
      console.error("Error updating enrollment progress:", error);
      res.status(500).json({ message: "Failed to update enrollment progress" });
    }
  });
  app2.post("/api/enroll", requireAdmin, async (req, res) => {
    try {
      const { userId, courseId } = req.body;
      const existing = await storage.getEnrollment(userId, courseId);
      if (existing) {
        return res.status(400).json({ message: "User already enrolled in this course" });
      }
      const enrollment = await storage.createEnrollment({ userId, courseId });
      res.json(enrollment);
    } catch (error) {
      res.status(500).json({ message: "Failed to enroll user" });
    }
  });
  app2.get("/api/enrollments", requireAdmin, async (req, res) => {
    try {
      const enrollments2 = await storage.getAllEnrollments();
      res.json(enrollments2);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch enrollments" });
    }
  });
  app2.put("/api/enrollments/:id", requireAdmin, async (req, res) => {
    try {
      const { progress, quizScore, certificateIssued } = req.body;
      const updatedEnrollment = await storage.updateEnrollment(req.params.id, {
        progress,
        quizScore,
        certificateIssued,
        completedAt: certificateIssued ? /* @__PURE__ */ new Date() : null
      });
      if (updatedEnrollment) {
        res.json(updatedEnrollment);
      } else {
        res.status(404).json({ message: "Enrollment not found" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to update enrollment" });
    }
  });
  app2.delete("/api/enrollments/:id", requireAdmin, async (req, res) => {
    try {
      const success = await storage.deleteEnrollment(req.params.id);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ message: "Enrollment not found" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to delete enrollment" });
    }
  });
  app2.get("/api/certificates", requireAdmin, async (req, res) => {
    try {
      const certificates2 = await storage.getAllCertificates();
      res.json(certificates2);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch certificates" });
    }
  });
  app2.delete("/api/certificates/:id", requireAdmin, async (req, res) => {
    try {
      const success = await storage.deleteCertificate(req.params.id);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ message: "Certificate not found" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to delete certificate" });
    }
  });
  app2.post("/api/quiz-submission", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { courseId, answers, score } = req.body;
      console.log("Quiz submission data:", { courseId, score, userId: req.session.userId });
      const enrollment = await storage.getEnrollment(req.session.userId, courseId);
      if (!enrollment) {
        return res.status(400).json({ message: "Not enrolled in this course" });
      }
      const quiz = await storage.getQuizByCourseId(courseId);
      const passingScore = quiz?.passingScore || 70;
      const isPassing = score >= passingScore;
      console.log("Quiz validation:", { passingScore, isPassing, currentScore: score });
      const updated = await storage.updateEnrollment(enrollment.id, {
        quizScore: score,
        progress: isPassing ? 95 : Math.min(90, enrollment.progress || 0),
        // Mark as 95% if passing (awaiting acknowledgment), keep existing progress if not passing
        completedAt: null,
        // Don't mark completed until certificate is acknowledged
        status: isPassing ? "accessed" : "pending"
      });
      let certificate = null;
      console.log("Quiz passed - awaiting acknowledgment for certificate generation");
      res.json({
        success: true,
        score,
        certificateIssued: enrollment.certificateIssued,
        isPassing,
        needsAcknowledgment: isPassing && !enrollment.certificateIssued
      });
    } catch (error) {
      console.error("Quiz submission error:", error);
      res.status(500).json({
        message: "Failed to submit quiz",
        error: process.env.NODE_ENV === "development" ? error.message : void 0
      });
    }
  });
  app2.get("/api/my-certificates", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const certificates2 = await storage.getUserCertificates(req.session.userId);
      res.json(certificates2);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch certificates" });
    }
  });
  app2.post("/api/acknowledge-completion", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { courseId, digitalSignature } = req.body;
      if (!digitalSignature?.trim()) {
        return res.status(400).json({ message: "Digital signature is required" });
      }
      const enrollment = await storage.getEnrollment(req.session.userId, courseId);
      if (!enrollment) {
        return res.status(400).json({ message: "Not enrolled in this course" });
      }
      const quiz = await storage.getQuizByCourseId(courseId);
      const passingScore = quiz?.passingScore || 70;
      if (!enrollment.quizScore || enrollment.quizScore < passingScore) {
        return res.status(400).json({ message: "Quiz must be completed with passing score before acknowledgment" });
      }
      const existingCertificate = await storage.getUserCertificateForCourse(req.session.userId, courseId);
      let certificate;
      const user = await storage.getUser(req.session.userId);
      const course = await storage.getCourse(courseId);
      let expiresAt = null;
      if (course?.courseType === "recurring") {
        const completionDate = /* @__PURE__ */ new Date();
        const renewalMonths = course.renewalPeriodMonths || 3;
        expiresAt = new Date(completionDate.getTime() + renewalMonths * 30 * 24 * 60 * 60 * 1e3);
      }
      const certificateData = {
        score: enrollment.quizScore,
        completedAt: /* @__PURE__ */ new Date(),
        acknowledgedAt: /* @__PURE__ */ new Date(),
        digitalSignature: digitalSignature.trim(),
        participantName: user?.name || "",
        courseName: course?.title || "",
        completionDate: (/* @__PURE__ */ new Date()).toLocaleDateString(),
        certificateId: existingCertificate?.id || `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        courseType: course?.courseType || "one-time",
        expiresAt: expiresAt ? expiresAt.toLocaleDateString() : null
      };
      if (existingCertificate) {
        certificate = await storage.updateCertificate(existingCertificate.id, {
          certificateData,
          digitalSignature: digitalSignature.trim(),
          acknowledgedAt: /* @__PURE__ */ new Date()
        });
      } else {
        certificate = await storage.createCertificate({
          userId: req.session.userId,
          courseId,
          enrollmentId: enrollment.id,
          certificateData,
          digitalSignature: digitalSignature.trim(),
          acknowledgedAt: /* @__PURE__ */ new Date()
        });
      }
      await storage.updateEnrollment(enrollment.id, {
        certificateIssued: true,
        progress: 100,
        // Set progress to 100% when certificate is generated
        completedAt: /* @__PURE__ */ new Date(),
        expiresAt,
        isExpired: false,
        status: "completed"
      });
      try {
        if (user && course) {
          const certificateEmailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb; text-align: center;">Certificate of Completion</h2>
              <div style="border: 2px solid #2563eb; padding: 30px; margin: 20px 0; text-align: left;">
                <p style="font-size: 16px; margin: 20px 0;">I, <strong>${user.name}</strong>, working with Client: <strong>${user.clientName || "N/A"}</strong>, holding Employee ID: <strong>${user.employeeId}</strong>, hereby acknowledge that I have successfully completed the following course:</p>

                <div style="margin: 20px 0;">
                  <p><strong>Course Name:</strong> ${course.title}</p>
                  <p><strong>Completion Date:</strong> ${(/* @__PURE__ */ new Date()).toLocaleDateString()}</p>
                  <p><strong>Score:</strong> ${enrollment.quizScore}%</p>
                  <p><strong>Certificate ID:</strong> ${certificateData.certificateId}</p>
                </div>

                <p style="font-size: 16px; margin: 20px 0;">I acknowledge that I have attended the training session. I understand the content and importance of the training, along with the company's policies related to it.</p>

                <p style="font-size: 16px; margin: 20px 0;">I commit to:</p>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>Adhering to the guidelines provided in the training</li>
                  <li>Applying the knowledge responsibly in my role</li>
                  <li>Maintaining a safe, respectful, and compliant work environment</li>
                </ul>

                <p style="font-style: italic; margin-top: 30px; text-align: center;">Digital Signature: ${digitalSignature}</p>
              </div>
              <p style="text-align: center; color: #666; font-size: 12px;">
                This certificate was digitally generated and acknowledged by the participant.
              </p>
            </div>
          `;
          await transporter.sendMail({
            from: process.env.SMTP_FROM || "noreply@traintrack.com",
            to: user.email,
            subject: `Certificate of Completion: ${course.title}`,
            html: certificateEmailHtml
          });
          await transporter.sendMail({
            from: process.env.SMTP_FROM || "noreply@traintrack.com",
            to: process.env.SMTP_FROM || "noreply@traintrack.com",
            subject: `Certificate Issued: ${user.name} - ${course.title}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Certificate Issued - HR Notification</h2>
                <p>A certificate has been issued to the following employee:</p>
                <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px;">
                  <p><strong>Employee:</strong> ${user.name}</p>
                  <p><strong>Employee ID:</strong> ${user.employeeId}</p>
                  <p><strong>Email:</strong> ${user.email}</p>
                  <p><strong>Department:</strong> ${user.department}</p>
                  <p><strong>Course:</strong> ${course.title}</p>
                  <p><strong>Score:</strong> ${enrollment.quizScore}%</p>
                  <p><strong>Completion Date:</strong> ${(/* @__PURE__ */ new Date()).toLocaleDateString()}</p>
                  <p><strong>Certificate ID:</strong> ${certificateData.certificateId}</p>
                  <p><strong>Digital Signature:</strong> ${digitalSignature}</p>
                </div>
                ${certificateEmailHtml}
              </div>
            `
          });
        }
      } catch (emailError) {
        console.error("Failed to send certificate email:", emailError);
      }
      res.json({
        success: true,
        certificate,
        message: "Course completion acknowledged and certificate generated successfully"
      });
    } catch (error) {
      console.error("Acknowledgment error:", error);
      res.status(500).json({
        message: "Failed to acknowledge completion",
        error: process.env.NODE_ENV === "development" ? error.message : void 0
      });
    }
  });
  app2.get("/api/dashboard-stats", requireAdmin, async (req, res) => {
    try {
      if (req.session.userRole !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const stats = await storage.getDashboardStats();
      const remindersSent = await storage.getTotalRemindersSent();
      res.json({
        ...stats,
        remindersSent
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });
  app2.post("/api/bulk-assign-course", requireAdmin, async (req, res) => {
    try {
      const validatedData = bulkAssignCourseSchema.parse(req.body);
      const enrollments2 = await storage.bulkAssignCourse(validatedData.courseId, validatedData.userIds);
      res.json({ enrollments: enrollments2, message: `Course assigned to ${validatedData.userIds.length} users successfully` });
    } catch (error) {
      console.error("Error bulk assigning course:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid data" });
    }
  });
  app2.post("/api/bulk-import-employees", requireAdmin, async (req, res) => {
    try {
      const { employees } = req.body;
      if (!Array.isArray(employees) || employees.length === 0) {
        return res.status(400).json({ message: "Employee data array is required" });
      }
      const results = {
        created: 0,
        updated: 0,
        errors: []
      };
      for (const empData of employees) {
        try {
          const existingUser = await storage.getUserByEmail(empData.email) || await storage.getUserByEmployeeId(empData.employeeId);
          if (existingUser) {
            await storage.updateUser(existingUser.id, {
              ...empData,
              role: "employee",
              isActive: empData.isActive !== false
              // Default to active
            });
            results.updated++;
          } else {
            await storage.createUser({
              ...empData,
              role: "employee",
              password: empData.password || await bcrypt2.hash(`temp${Date.now()}`, 10),
              isActive: empData.isActive !== false
            });
            results.created++;
            await storage.autoEnrollInComplianceCourses(empData.employeeId || empData.email);
          }
        } catch (error) {
          results.errors.push({
            employee: empData.email || empData.employeeId,
            error: error.message
          });
        }
      }
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Bulk import failed", error: error.message });
    }
  });
  app2.post("/api/deactivate-employees", requireAdmin, async (req, res) => {
    try {
      const { employeeIds } = req.body;
      const results = await storage.deactivateEmployees(employeeIds);
      res.json({ message: `Deactivated ${results} employees successfully` });
    } catch (error) {
      res.status(500).json({ message: "Failed to deactivate employees" });
    }
  });
  app2.get("/api/compliance-status", requireAdmin, async (req, res) => {
    try {
      const complianceReport = await storage.getComplianceReport();
      res.json(complianceReport);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate compliance report" });
    }
  });
  app2.post("/api/renew-expired-certifications", requireAdmin, async (req, res) => {
    try {
      const { courseId, userIds } = req.body;
      const renewedEnrollments = await storage.renewExpiredCertifications(courseId, userIds);
      res.json({
        message: `Renewed ${renewedEnrollments.length} certifications`,
        renewedEnrollments
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to renew certifications" });
    }
  });
  app2.post("/api/bulk-assign-users", requireAdmin, async (req, res) => {
    try {
      const validatedData = bulkAssignUsersSchema.parse(req.body);
      const enrollments2 = await storage.bulkAssignUsers(validatedData.userIds, validatedData.courseIds);
      res.json({ enrollments: enrollments2, message: `${validatedData.userIds.length} users assigned to ${validatedData.courseIds.length} courses successfully` });
    } catch (error) {
      console.error("Error bulk assigning users:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid data" });
    }
  });
  app2.post("/api/bulk-assign-emails", requireAdmin, async (req, res) => {
    try {
      const validatedData = bulkEmailAssignmentSchema.parse(req.body);
      const assignments = await storage.bulkAssignCourseByEmail(
        validatedData.courseId,
        validatedData.emails,
        validatedData.deadlineDays
      );
      const course = await storage.getCourse(validatedData.courseId);
      for (const assignment of assignments) {
        try {
          const loginLink = `${req.protocol}://${req.get("host")}/course-access/${assignment.assignmentToken}`;
          await transporter.sendMail({
            from: process.env.SMTP_FROM || "noreply@traintrack.com",
            to: assignment.assignedEmail,
            subject: `Training Assignment: ${course?.title}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Training Course Assignment</h2>
                <p>You have been assigned to complete the following training course:</p>
                <div style="border: 1px solid #e5e7eb; padding: 20px; margin: 20px 0; border-radius: 8px;">
                  <h3 style="color: #1e40af; margin-top: 0;">${course?.title}</h3>
                  <p>${course?.description}</p>
                  <p><strong>Deadline:</strong> ${assignment.deadline?.toLocaleDateString()}</p>
                </div>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${loginLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Access Course
                  </a>
                </div>
                <p style="color: #666; font-size: 14px;">
                  This link is valid until ${assignment.deadline?.toLocaleDateString()}. 
                  Please complete the course before the deadline.
                </p>
              </div>
            `
          });
        } catch (emailError) {
          console.error("Failed to send assignment email:", emailError);
        }
      }
      res.json({
        assignments,
        message: `Course assigned to ${validatedData.emails.length} email addresses successfully`
      });
    } catch (error) {
      console.error("Error bulk assigning emails:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid data" });
    }
  });
  app2.get("/api/course-access/:token", async (req, res) => {
    try {
      const enrollment = await storage.getEnrollmentByToken(req.params.token);
      if (!enrollment || enrollment.status === "expired") {
        return res.status(404).json({ message: "Invalid or expired access link" });
      }
      if (/* @__PURE__ */ new Date() > enrollment.deadline) {
        await storage.cleanupExpiredAssignments();
        return res.status(410).json({ message: "Course deadline has passed" });
      }
      const course = await storage.getCourse(enrollment.courseId);
      let existingUser = null;
      if (enrollment.assignedEmail) {
        existingUser = await storage.getUserByEmail(enrollment.assignedEmail);
      }
      if (existingUser && !enrollment.userId) {
        await storage.updateEnrollment(enrollment.id, {
          userId: existingUser.id,
          status: "accessed"
        });
      }
      res.json({
        enrollment,
        course,
        existingUser,
        isFirstTime: !existingUser
        // Only first time if no existing user found
      });
    } catch (error) {
      console.error("Error accessing course:", error);
      res.status(500).json({ message: "Failed to access course" });
    }
  });
  app2.post("/api/complete-profile", async (req, res) => {
    try {
      const { token, userData } = req.body;
      const enrollment = await storage.getEnrollmentByToken(token);
      if (!enrollment) {
        return res.status(404).json({ message: "Invalid access token" });
      }
      const hashedPassword = await bcrypt2.hash(`temp${Date.now()}`, 10);
      const user = await storage.createUser({
        ...userData,
        email: enrollment.assignedEmail,
        password: hashedPassword,
        role: "employee",
        isActive: true
      });
      await storage.updateEnrollment(enrollment.id, {
        userId: user.id,
        status: "accessed"
      });
      req.session.userId = user.id;
      req.session.userRole = "employee";
      res.json({ success: true, user });
    } catch (error) {
      console.error("Error completing profile:", error);
      res.status(500).json({ message: "Failed to complete profile" });
    }
  });
  app2.get("/api/course-assignments/:courseId", requireAdmin, async (req, res) => {
    try {
      const courseId = req.params.courseId;
      if (!courseId || courseId.trim() === "") {
        return res.status(400).json({ message: "Course ID is required" });
      }
      console.log(`Fetching assignments for course: ${courseId}`);
      const course = await storage.getCourse(courseId);
      if (!course) {
        console.log(`Course not found: ${courseId}`);
        return res.status(404).json({ message: "Course not found" });
      }
      const assignments = await storage.getCourseAssignments(courseId);
      console.log(`Found ${assignments.length} assignments for course ${courseId}`);
      const validAssignments = Array.isArray(assignments) ? assignments.filter((a) => a && typeof a === "object") : [];
      const sanitizedAssignments = validAssignments.map((assignment, index) => {
        try {
          return {
            id: assignment.id || `fallback-${Date.now()}-${index}`,
            courseId: assignment.courseId || courseId,
            userId: assignment.userId || null,
            assignedEmail: String(assignment.assignedEmail || "").trim(),
            enrolledAt: assignment.enrolledAt || null,
            progress: Math.max(0, Math.min(100, Number(assignment.progress) || 0)),
            quizScore: assignment.quizScore ? Number(assignment.quizScore) : null,
            certificateIssued: Boolean(assignment.certificateIssued),
            remindersSent: Math.max(0, Number(assignment.remindersSent) || 0),
            deadline: assignment.deadline || null,
            status: assignment.status || "pending",
            completedAt: assignment.completedAt || null,
            assignmentToken: assignment.assignmentToken || null,
            lastAccessedAt: assignment.lastAccessedAt || null,
            user: assignment.user && typeof assignment.user === "object" ? {
              id: assignment.user.id || null,
              name: String(assignment.user.name || "Not registered").trim(),
              email: String(assignment.user.email || assignment.assignedEmail || "").trim(),
              department: String(assignment.user.department || "N/A").trim(),
              clientName: String(assignment.user.clientName || "N/A").trim()
            } : null
          };
        } catch (sanitizeError) {
          console.error(`Error sanitizing assignment at index ${index}:`, sanitizeError);
          return null;
        }
      }).filter(Boolean);
      console.log(`Returning ${sanitizedAssignments.length} valid assignments`);
      res.json(sanitizedAssignments);
    } catch (error) {
      console.error("Error fetching course assignments:", error);
      res.status(500).json({
        message: "Failed to fetch assignments",
        error: process.env.NODE_ENV === "development" ? error?.message : void 0,
        courseId: req.params.courseId
      });
    }
  });
  app2.get("/api/courses/:courseId/has-assignments", requireAdmin, async (req, res) => {
    try {
      const assignments = await storage.getCourseAssignments(req.params.courseId);
      res.json({ hasAssignments: assignments.length > 0 });
    } catch (error) {
      console.error("Error checking course assignments:", error);
      res.status(500).json({ message: "Failed to check assignments" });
    }
  });
  app2.post("/api/send-reminders/:courseId", requireAdmin, async (req, res) => {
    try {
      const assignments = await storage.getCourseAssignments(req.params.courseId);
      const pendingAssignments = assignments.filter(
        (a) => a.status !== "completed" && a.status !== "expired" && !a.certificateIssued && a.progress < 100 && /* @__PURE__ */ new Date() < new Date(a.deadline)
      );
      const course = await storage.getCourse(req.params.courseId);
      let sentCount = 0;
      for (const assignment of pendingAssignments) {
        try {
          const loginLink = assignment.assignmentToken ? `${req.protocol}://${req.get("host")}/course-access/${assignment.assignmentToken}` : `${req.protocol}://${req.get("host")}/employee-login`;
          const recipientEmail = assignment.assignedEmail || assignment.user?.email;
          if (!recipientEmail) continue;
          await transporter.sendMail({
            from: process.env.SMTP_FROM || "noreply@traintrack.com",
            to: recipientEmail,
            subject: `Reminder: Training Course Deadline Approaching - ${course?.title}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #dc2626;">Training Reminder</h2>
                <p>This is a reminder that you have a pending training course that needs to be completed:</p>
                <div style="border: 1px solid #fca5a5; background-color: #fef2f2; padding: 20px; margin: 20px 0; border-radius: 8px;">
                  <h3 style="color: #dc2626; margin-top: 0;">${course?.title}</h3>
                  <p><strong>Deadline:</strong> ${new Date(assignment.deadline).toLocaleDateString()}</p>
                  <p><strong>Status:</strong> ${assignment.status}</p>
                </div>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${loginLink}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Complete Course Now
                  </a>
                </div>
                <p style="color: #666; font-size: 14px;">
                  Please complete this course before the deadline to avoid it being marked as expired.
                </p>
              </div>
            `
          });
          await storage.incrementReminderCount(assignment.id);
          sentCount++;
        } catch (emailError) {
          console.error("Failed to send reminder email:", emailError);
        }
      }
      res.json({ message: `Sent ${sentCount} reminder emails` });
    } catch (error) {
      console.error("Error sending reminders:", error);
      res.status(500).json({ message: "Failed to send reminders" });
    }
  });
  app2.get("/api/performance-metrics", async (req, res) => {
    try {
      const startTime = Date.now();
      await storage.getDashboardStats();
      const dbResponseTime = Date.now() - startTime;
      const metrics = {
        serverResponseTime: dbResponseTime,
        activeUsers: 1,
        // In a real app, you'd track active sessions
        memoryUsage: process.memoryUsage ? Math.round(process.memoryUsage().heapUsed / process.memoryUsage().heapTotal * 100) : 45,
        cpuUsage: Math.floor(Math.random() * 20) + 15,
        // Simulated CPU usage
        uptime: process.uptime ? `${Math.floor(process.uptime() / 3600)}h ${Math.floor(process.uptime() % 3600 / 60)}m` : "Unknown",
        requestsPerMinute: 15,
        // In a real app, you'd track this
        dbConnectionStatus: "Connected",
        totalRequests: 0
        // In a real app, you'd track this
      };
      res.json(metrics);
    } catch (error) {
      res.status(500).json({
        message: "Failed to fetch performance metrics",
        error: process.env.NODE_ENV === "development" ? error.message : void 0
      });
    }
  });
  app2.get("/api/user-analytics/:id", requireAdmin, async (req, res) => {
    try {
      const analytics = await storage.getUserAnalytics(req.params.id);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching user analytics:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/courses/:courseId/enrollments", requireAdmin, async (req, res) => {
    try {
      const courseId = req.params.courseId;
      if (!courseId || courseId.trim() === "") {
        return res.status(400).json({ message: "Course ID is required" });
      }
      console.log(`Fetching enrollments for course: ${courseId}`);
      const course = await storage.getCourse(courseId);
      if (!course) {
        console.log(`Course not found: ${courseId}`);
        return res.status(404).json({ message: "Course not found" });
      }
      const enrollments2 = await storage.getCourseEnrollments(courseId);
      console.log(`Found ${enrollments2.length} enrollments for course ${courseId}`);
      const formattedEnrollments = (Array.isArray(enrollments2) ? enrollments2 : []).map((enrollment) => {
        if (!enrollment || typeof enrollment !== "object") {
          return null;
        }
        return {
          id: enrollment.id || `temp-${Date.now()}`,
          userId: enrollment.userId || null,
          courseId: enrollment.courseId || courseId,
          enrolledAt: enrollment.enrolledAt || null,
          progress: Math.max(0, Math.min(100, Number(enrollment.progress) || 0)),
          completedAt: enrollment.completedAt || null,
          certificateIssued: Boolean(enrollment.certificateIssued),
          assignedEmail: enrollment.assignedEmail || enrollment.user?.email || "",
          userName: enrollment.user?.name || "Not registered",
          userEmail: enrollment.user?.email || enrollment.assignedEmail || "",
          clientName: enrollment.user?.clientName || "N/A",
          department: enrollment.user?.department || "Not registered",
          user: enrollment.user || null
        };
      }).filter(Boolean);
      res.json(formattedEnrollments);
    } catch (error) {
      console.error("Error fetching course enrollments:", error);
      res.status(500).json({
        message: "Failed to fetch course enrollments",
        error: process.env.NODE_ENV === "development" ? error?.message : void 0
      });
    }
  });
  app2.get("/api/users/:userId/enrollments", requireAdmin, async (req, res) => {
    try {
      const enrollments2 = await storage.getUserEnrollments(req.params.userId);
      res.json(enrollments2);
    } catch (error) {
      console.error("Error fetching user enrollments:", error);
      res.status(500).json({ message: "Failed to fetch user enrollments" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs2 from "fs";
import path3 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path2 from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path2.resolve(import.meta.dirname, "client", "src"),
      "@shared": path2.resolve(import.meta.dirname, "shared"),
      "@assets": path2.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path2.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path2.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path3.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path3.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path3.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
var SessionStore = MemoryStore(session);
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key-here",
    resave: false,
    saveUninitialized: false,
    store: new SessionStore({
      checkPeriod: 864e5
      // Prune expired entries every 24h
    }),
    cookie: {
      secure: false,
      // Set to true in production with HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1e3,
      // 24 hours
      sameSite: "lax"
    },
    name: "traintrack.sid"
  })
);
app.use(
  cors({
    origin: process.env.NODE_ENV === "production" ? ["https://*.replit.dev", "https://*.repl.co"] : true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"]
  })
);
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path4 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path4.startsWith("/api")) {
      let logLine = `${req.method} ${path4} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
    },
    () => {
      log(`serving on port ${port}`);
    }
  );
})();
