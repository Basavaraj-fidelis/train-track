var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express2 from "express";
import session from "express-session";
import MemoryStore from "memorystore";
import cors from "cors";

// server/routes.ts
import { createServer } from "http";

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
var users = pgTable("users", {
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
var courses = pgTable("courses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  videoPath: text("video_path"),
  duration: integer("duration"),
  // in minutes
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  isActive: boolean("is_active").default(true),
  isComplianceCourse: boolean("is_compliance_course").default(false),
  renewalPeriodMonths: integer("renewal_period_months").default(3),
  // 3 or 4 months
  isAutoEnrollNewEmployees: boolean("is_auto_enroll_new_employees").default(false),
  // New fields for deadline management
  defaultDeadlineDays: integer("default_deadline_days").default(30),
  // Default days to complete
  reminderDays: integer("reminder_days").default(7)
  // Days before deadline to send reminder
});
var quizzes = pgTable("quizzes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").references(() => courses.id).notNull(),
  title: text("title").notNull(),
  questions: jsonb("questions").notNull(),
  // Array of question objects
  passingScore: integer("passing_score").default(70),
  createdAt: timestamp("created_at").defaultNow()
});
var enrollments = pgTable("enrollments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  courseId: varchar("course_id").references(() => courses.id).notNull(),
  enrolledAt: timestamp("enrolled_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  progress: integer("progress").default(0),
  // percentage 0-100
  quizScore: integer("quiz_score"),
  certificateIssued: boolean("certificate_issued").default(false),
  expiresAt: timestamp("expires_at"),
  // When the certification expires
  isExpired: boolean("is_expired").default(false),
  renewalCount: integer("renewal_count").default(0),
  // Track how many times renewed
  // New fields for bulk email assignment
  assignedEmail: text("assigned_email"),
  // Email assigned before user creation
  assignmentToken: text("assignment_token"),
  // Unique token for email access
  deadline: timestamp("deadline"),
  // Course completion deadline
  status: text("status", { enum: ["pending", "accessed", "completed", "expired"] }).default("pending"),
  remindersSent: integer("reminders_sent").default(0)
});
var certificates = pgTable("certificates", {
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
var usersRelations = relations(users, ({ many }) => ({
  enrollments: many(enrollments),
  certificates: many(certificates),
  createdCourses: many(courses)
}));
var coursesRelations = relations(courses, ({ one, many }) => ({
  creator: one(users, {
    fields: [courses.createdBy],
    references: [users.id]
  }),
  enrollments: many(enrollments),
  quizzes: many(quizzes),
  certificates: many(certificates)
}));
var enrollmentsRelations = relations(enrollments, ({ one }) => ({
  user: one(users, {
    fields: [enrollments.userId],
    references: [users.id]
  }),
  course: one(courses, {
    fields: [enrollments.courseId],
    references: [courses.id]
  })
}));
var quizzesRelations = relations(quizzes, ({ one }) => ({
  course: one(courses, {
    fields: [quizzes.courseId],
    references: [courses.id]
  })
}));
var certificatesRelations = relations(certificates, ({ one }) => ({
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
var insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true
});
var insertCourseSchema = createInsertSchema(courses).omit({
  id: true,
  createdAt: true
});
var insertQuizSchema = createInsertSchema(quizzes).omit({
  id: true,
  createdAt: true
});
var insertEnrollmentSchema = createInsertSchema(enrollments).omit({
  id: true,
  enrolledAt: true
});
var insertCertificateSchema = createInsertSchema(certificates).omit({
  id: true,
  issuedAt: true
});
var bulkAssignCourseSchema = z.object({
  courseId: z.string(),
  userIds: z.array(z.string()).min(1, "At least one user must be selected")
});
var bulkAssignUsersSchema = z.object({
  userIds: z.array(z.string()).min(1, "At least one user must be selected"),
  courseIds: z.array(z.string()).min(1, "At least one course must be selected")
});
var bulkEmailAssignmentSchema = z.object({
  courseId: z.string(),
  emails: z.array(z.string().email()).min(1, "At least one email must be provided"),
  deadlineDays: z.number().min(1).max(365).default(30)
});

// server/db.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle({ client: pool, schema: schema_exports });

// server/storage.ts
import { eq, and, desc, sql as sql2, isNull, inArray } from "drizzle-orm";
import crypto from "crypto";
var DatabaseStorage = class {
  constructor(db2) {
    this.db = db2;
  }
  // Inject db instance
  async getUser(id) {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user || void 0;
  }
  async getUserByEmail(email) {
    const [user] = await this.db.select().from(users).where(eq(users.email, email));
    return user || void 0;
  }
  async createUser(insertUser) {
    const [user] = await this.db.insert(users).values(insertUser).returning();
    return user;
  }
  async updateUser(id, user) {
    const [updated] = await this.db.update(users).set(user).where(eq(users.id, id)).returning();
    return updated || void 0;
  }
  async getAllEmployees() {
    return await this.db.select().from(users).where(eq(users.role, "employee"));
  }
  async deleteUser(id) {
    const result = await this.db.delete(users).where(eq(users.id, id));
    return (result.rowCount || 0) > 0;
  }
  async getCourse(id) {
    const [course] = await this.db.select().from(courses).where(eq(courses.id, id));
    return course || void 0;
  }
  async getAllCourses() {
    return await this.db.select().from(courses).where(eq(courses.isActive, true));
  }
  async createCourse(courseData) {
    try {
      if (!courseData.title || !courseData.description) {
        throw new Error("Title and description are required");
      }
      if (!courseData.createdBy) {
        throw new Error("Created by user ID is required");
      }
      const courseId = crypto.randomUUID();
      const [course] = await this.db.insert(courses).values({
        id: courseId,
        title: courseData.title.trim(),
        description: courseData.description.trim(),
        duration: courseData.duration || 0,
        videoPath: courseData.videoPath,
        isActive: true,
        createdBy: courseData.createdBy,
        createdAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      }).returning();
      if (courseData.questions && courseData.questions.length > 0) {
        try {
          await this.createQuiz({
            id: crypto.randomUUID(),
            courseId: course.id,
            title: `${courseData.title} Quiz`,
            description: `Quiz for ${courseData.title}`,
            questions: courseData.questions,
            passingScore: 70,
            timeLimit: 30
          });
        } catch (quizError) {
          console.error("Error creating quiz:", quizError);
        }
      }
      return course;
    } catch (error) {
      console.error("Error creating course:", error);
      throw error;
    }
  }
  async updateCourse(id, course) {
    const [updated] = await this.db.update(courses).set(course).where(eq(courses.id, id)).returning();
    return updated || void 0;
  }
  async deleteCourse(id) {
    const result = await this.db.update(courses).set({ isActive: false }).where(eq(courses.id, id));
    return (result.rowCount || 0) > 0;
  }
  async getQuizByCourseId(courseId) {
    const [quiz] = await this.db.select().from(quizzes).where(eq(quizzes.courseId, courseId));
    return quiz || void 0;
  }
  async createQuiz(insertQuiz) {
    const [quiz] = await this.db.insert(quizzes).values(insertQuiz).returning();
    return quiz;
  }
  async updateQuiz(id, quiz) {
    const [updated] = await this.db.update(quizzes).set(quiz).where(eq(quizzes.id, id)).returning();
    return updated || void 0;
  }
  async getEnrollment(userId, courseId) {
    const [enrollment] = await this.db.select().from(enrollments).where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)));
    return enrollment || void 0;
  }
  async getUserEnrollments(userId) {
    return await this.db.select().from(enrollments).innerJoin(courses, eq(enrollments.courseId, courses.id)).where(eq(enrollments.userId, userId)).then((results) => results.map((result) => ({ ...result.enrollments, course: result.courses })));
  }
  async createEnrollment(insertEnrollment) {
    const [enrollment] = await this.db.insert(enrollments).values(insertEnrollment).returning();
    return enrollment;
  }
  async updateEnrollment(id, enrollment) {
    const [updated] = await this.db.update(enrollments).set(enrollment).where(eq(enrollments.id, id)).returning();
    return updated || void 0;
  }
  async getCourseEnrollments(courseId) {
    return await this.db.select().from(enrollments).innerJoin(users, eq(enrollments.userId, users.id)).where(eq(enrollments.courseId, courseId)).then((results) => results.map((result) => ({ ...result.enrollments, user: result.users })));
  }
  async getUserCertificates(userId) {
    return await this.db.select().from(certificates).innerJoin(courses, eq(certificates.courseId, courses.id)).where(eq(certificates.userId, userId)).orderBy(desc(certificates.issuedAt)).then((results) => results.map((result) => ({ ...result.certificates, course: result.courses })));
  }
  async createCertificate(certificateData) {
    const [certificate] = await this.db.insert(certificates).values(certificateData).returning();
    return certificate;
  }
  async updateCertificate(certificateId, updates) {
    const [certificate] = await this.db.update(certificates).set(updates).where(eq(certificates.id, certificateId)).returning();
    return certificate;
  }
  async getUserCertificateForCourse(userId, courseId) {
    const [certificate] = await this.db.select().from(certificates).where(and(
      eq(certificates.userId, userId),
      eq(certificates.courseId, courseId)
    ));
    return certificate;
  }
  async getCertificate(id) {
    const [certificate] = await this.db.select().from(certificates).where(eq(certificates.id, id));
    return certificate || void 0;
  }
  async getDashboardStats() {
    const [employeeCount] = await this.db.select({ count: sql2`count(*)` }).from(users).where(eq(users.role, "employee"));
    const [courseCount] = await this.db.select({ count: sql2`count(*)` }).from(courses).where(eq(courses.isActive, true));
    const [pendingCount] = await this.db.select({ count: sql2`count(*)` }).from(enrollments).where(isNull(enrollments.completedAt));
    const [completedCount] = await this.db.select({ count: sql2`count(*)` }).from(enrollments).where(sql2`${enrollments.completedAt} IS NOT NULL`);
    const [certCount] = await this.db.select({ count: sql2`count(*)` }).from(certificates);
    const [totalEnrollments] = await this.db.select({ count: sql2`count(*)` }).from(enrollments);
    const [avgProgress] = await this.db.select({ avg: sql2`avg(${enrollments.progress})` }).from(enrollments);
    return {
      totalEmployees: Number(employeeCount.count) || 0,
      activeCourses: Number(courseCount.count) || 0,
      pendingAssignments: Number(pendingCount.count) || 0,
      certificatesIssued: Number(certCount.count) || 0,
      completedCourses: Number(completedCount.count) || 0,
      totalEnrollments: Number(totalEnrollments.count) || 0,
      averageProgress: Math.round(Number(avgProgress.avg) || 0)
    };
  }
  async bulkAssignCourse(courseId, userIds) {
    const existingEnrollments = await this.db.select().from(enrollments).where(and(
      eq(enrollments.courseId, courseId),
      inArray(enrollments.userId, userIds)
    ));
    const existingUserIds = new Set(existingEnrollments.map((e) => e.userId));
    const newUserIds = userIds.filter((userId) => !existingUserIds.has(userId));
    if (newUserIds.length === 0) {
      throw new Error("All selected users are already enrolled in this course");
    }
    const enrollmentData = newUserIds.map((userId) => ({
      userId,
      courseId
      // Initialize expiresAt for bulk assignment if needed, or handle it in the caller
      // expiresAt: new Date() // Example: set to now, or calculate based on course settings
    }));
    const newEnrollments = await this.db.insert(enrollments).values(enrollmentData).returning();
    return newEnrollments;
  }
  async bulkAssignUsers(userIds, courseIds) {
    try {
      const existingEnrollments = await this.db.select().from(enrollments).where(and(
        inArray(enrollments.userId, userIds),
        inArray(enrollments.courseId, courseIds)
      ));
      const existingPairs = new Set(
        existingEnrollments.map((e) => `${e.userId}-${e.courseId}`)
      );
      const enrollmentData = [];
      for (const userId of userIds) {
        for (const courseId of courseIds) {
          const pair = `${userId}-${courseId}`;
          if (!existingPairs.has(pair)) {
            enrollmentData.push({ userId, courseId });
          }
        }
      }
      if (enrollmentData.length === 0) {
        throw new Error("All selected user-course combinations already exist");
      }
      const newEnrollments = await this.db.insert(enrollments).values(enrollmentData).returning();
      return newEnrollments;
    } catch (error) {
      console.error("Error in bulkAssignUsers:", error);
      throw error;
    }
  }
  async getUserAnalytics(userId) {
    const userEnrollments = await this.getUserEnrollments(userId);
    const userCertificates = await this.getUserCertificates(userId);
    const completedCourses = userEnrollments.filter((e) => e.completedAt).length;
    const inProgressCourses = userEnrollments.filter((e) => !e.completedAt).length;
    const scoresWithValues = userEnrollments.map((e) => e.quizScore).filter((score) => score !== null && score !== void 0);
    const averageScore = scoresWithValues.length > 0 ? scoresWithValues.reduce((acc, score) => acc + score, 0) / scoresWithValues.length : 0;
    return {
      totalCourses: userEnrollments.length,
      completedCourses,
      inProgressCourses,
      certificatesEarned: userCertificates.length,
      averageScore: Math.round(averageScore)
    };
  }
  async getUserByEmployeeId(employeeId) {
    const [user] = await this.db.select().from(users).where(eq(users.employeeId, employeeId));
    return user || void 0;
  }
  async autoEnrollInComplianceCourses(employeeIdentifier) {
    const complianceCourses = await this.db.select().from(courses).where(and(
      eq(courses.isComplianceCourse, true),
      eq(courses.isAutoEnrollNewEmployees, true),
      eq(courses.isActive, true)
    ));
    const user = await this.getUserByEmail(employeeIdentifier) || await this.getUserByEmployeeId(employeeIdentifier);
    if (!user) return;
    for (const course of complianceCourses) {
      const existingEnrollment = await this.getEnrollment(user.id, course.id);
      if (!existingEnrollment) {
        const expirationDate = /* @__PURE__ */ new Date();
        expirationDate.setMonth(expirationDate.getMonth() + (course.renewalPeriodMonths || 3));
        await this.createEnrollment({
          userId: user.id,
          courseId: course.id,
          expiresAt: expirationDate
        });
      }
    }
  }
  async deactivateEmployees(employeeIds) {
    const result = await this.db.update(users).set({ isActive: false }).where(inArray(users.id, employeeIds));
    return result.rowCount || 0;
  }
  async getComplianceReport() {
    const [totalEmp] = await this.db.select({ count: sql2`count(*)` }).from(users).where(eq(users.role, "employee"));
    const [activeEmp] = await this.db.select({ count: sql2`count(*)` }).from(users).where(and(eq(users.role, "employee"), eq(users.isActive, true)));
    const thirtyDaysFromNow = /* @__PURE__ */ new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const [expiredCerts] = await this.db.select({ count: sql2`count(*)` }).from(enrollments).where(and(
      sql2`${enrollments.expiresAt} < NOW()`,
      eq(enrollments.isExpired, false)
    ));
    const [expiringCerts] = await this.db.select({ count: sql2`count(*)` }).from(enrollments).where(and(
      sql2`${enrollments.expiresAt} BETWEEN NOW() AND '${thirtyDaysFromNow.toISOString()}'`,
      eq(enrollments.isExpired, false)
    ));
    const complianceCourses = await this.db.select().from(courses).where(eq(courses.isComplianceCourse, true));
    const expiringEmployees = await this.db.select().from(enrollments).innerJoin(users, eq(enrollments.userId, users.id)).innerJoin(courses, eq(enrollments.courseId, courses.id)).where(and(
      sql2`${enrollments.expiresAt} BETWEEN NOW() AND '${thirtyDaysFromNow.toISOString()}'`,
      eq(enrollments.isExpired, false),
      eq(users.isActive, true)
    ));
    return {
      totalEmployees: Number(totalEmp.count),
      activeEmployees: Number(activeEmp.count),
      expiredCertifications: Number(expiredCerts.count),
      expiringInNext30Days: Number(expiringCerts.count),
      complianceCourses,
      expiringEmployees: expiringEmployees.map((result) => ({
        ...result.enrollments,
        user: result.users,
        course: result.courses
      }))
    };
  }
  async renewExpiredCertifications(courseId, userIds) {
    const whereConditions = [
      eq(enrollments.courseId, courseId),
      sql2`${enrollments.expiresAt} <= NOW()`
    ];
    if (userIds && userIds.length > 0) {
      whereConditions.push(
        inArray(enrollments.userId, userIds)
      );
    }
    const course = await this.getCourse(courseId);
    const renewalPeriod = course?.renewalPeriodMonths || 3;
    const newExpirationDate = /* @__PURE__ */ new Date();
    newExpirationDate.setMonth(newExpirationDate.getMonth() + renewalPeriod);
    const renewed = await this.db.update(enrollments).set({
      progress: 0,
      quizScore: null,
      completedAt: null,
      certificateIssued: false,
      expiresAt: newExpirationDate,
      isExpired: false,
      renewalCount: sql2`${enrollments.renewalCount} + 1`
    }).where(and(...whereConditions)).returning();
    return renewed;
  }
  async markExpiredCertifications() {
    await this.db.update(enrollments).set({ isExpired: true }).where(and(
      sql2`${enrollments.expiresAt} < NOW()`,
      eq(enrollments.isExpired, false)
    ));
  }
  // --- New methods for email-based bulk assignment ---
  async bulkAssignCourseByEmail(courseId, emails, deadlineDays) {
    const deadline = /* @__PURE__ */ new Date();
    deadline.setDate(deadline.getDate() + deadlineDays);
    const newEnrollmentsData = [];
    for (const email of emails) {
      const user = await this.getUserByEmail(email);
      if (user) {
        const existingEnrollment = await this.getEnrollment(user.id, courseId);
        if (!existingEnrollment) {
          newEnrollmentsData.push({
            userId: user.id,
            courseId,
            deadline,
            status: "pending",
            assignmentToken: crypto.randomUUID()
          });
        }
      } else {
        newEnrollmentsData.push({
          courseId,
          assignedEmail: email,
          deadline,
          status: "pending",
          assignmentToken: crypto.randomUUID()
        });
      }
    }
    if (newEnrollmentsData.length === 0) {
      return [];
    }
    return await this.db.insert(enrollments).values(newEnrollmentsData).returning();
  }
  async getEnrollmentByToken(token) {
    const [enrollment] = await this.db.select().from(enrollments).where(eq(enrollments.assignmentToken, token));
    return enrollment;
  }
  async getCourseAssignments(courseId) {
    const enrollmentsWithUsers = await this.db.select().from(enrollments).leftJoin(users, eq(enrollments.userId, users.id)).where(and(
      eq(enrollments.courseId, courseId),
      sql2`${enrollments.assignmentToken} IS NOT NULL`
    ));
    return enrollmentsWithUsers.map((result) => ({
      ...result.enrollments,
      user: result.users
    }));
  }
  async sendCourseReminders(courseId, pendingOnly) {
    console.log(`Sending reminders for course ${courseId}${pendingOnly ? " (pending only)" : ""}`);
    return 0;
  }
  async cleanupExpiredAssignments() {
    try {
      const result = await this.db.update(enrollments).set({ status: "expired" }).where(and(
        sql2`${enrollments.deadline} < NOW()`,
        sql2`${enrollments.status} != 'expired'`,
        sql2`${enrollments.status} != 'completed'`
      ));
      return result.rowCount || 0;
    } catch (error) {
      if (error.code === "42703") {
        console.log("Deadline column not found, skipping cleanup");
        return 0;
      }
      throw error;
    }
  }
};
var storage = new DatabaseStorage(db);

// server/routes.ts
import { z as z2 } from "zod";
import bcrypt from "bcrypt";
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
  const cleanupExpiredAssignments = async () => {
    try {
      const expiredCount = await storage.cleanupExpiredAssignments();
      if (expiredCount > 0) {
        console.log(`Cleaned up ${expiredCount} expired course assignments`);
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
          adminUser = await storage.createUser({
            employeeId: "ADMIN001",
            email: "admin@traintrack.com",
            name: "Administrator",
            role: "admin",
            designation: "System Administrator",
            department: "IT",
            clientName: "TrainTrack",
            phoneNumber: "+1-555-0100",
            password: await bcrypt.hash("admin123", 10)
          });
        }
        req.session.userId = adminUser.id;
        req.session.userRole = "admin";
        res.json({ success: true, user: adminUser });
      } else {
        res.status(401).json({ message: "Invalid credentials" });
      }
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ message: "Login failed" });
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
        res.json({ success: true });
      } else {
        res.status(404).json({ message: "Employee not found" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to delete employee" });
    }
  });
  app2.get("/api/courses", async (req, res) => {
    try {
      const courses2 = await storage.getAllCourses();
      res.json(courses2);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch courses" });
    }
  });
  app2.post("/api/courses", requireAdmin, upload.single("video"), async (req, res) => {
    try {
      console.log("Course creation request body:", req.body);
      console.log("Course creation file:", req.file);
      console.log("Session during course creation:", req.session);
      const { title, description, questions } = req.body;
      if (!title || !description) {
        return res.status(400).json({ message: "Title and description are required" });
      }
      if (!req.file) {
        return res.status(400).json({ message: "Video file is required" });
      }
      let parsedQuestions = [];
      if (questions) {
        try {
          parsedQuestions = JSON.parse(questions);
        } catch (parseError) {
          console.error("Error parsing questions:", parseError);
          return res.status(400).json({ message: "Invalid questions format" });
        }
      }
      const courseData = {
        title: title.trim(),
        description: description.trim(),
        duration: 0,
        createdBy: req.session.userId,
        videoPath: req.file.filename,
        questions: parsedQuestions
      };
      const course = await storage.createCourse(courseData);
      res.json(course);
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
      const { title, description, questions } = req.body;
      const updateData = {
        title,
        description,
        questions: questions ? JSON.parse(questions) : []
      };
      if (req.file) {
        updateData.videoPath = req.file.filename;
      }
      const updatedCourse = await storage.updateCourse(req.params.id, updateData);
      res.json(updatedCourse);
    } catch (error) {
      console.error("Course update error:", error);
      res.status(500).json({ message: "Failed to update course" });
    }
  });
  app2.delete("/api/courses/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteCourse(req.params.id);
      res.json({ message: "Course deleted successfully" });
    } catch (error) {
      console.error("Course deletion error:", error);
      res.status(500).json({ message: "Failed to delete course" });
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
        };
        res.writeHead(206, head);
        file.pipe(res);
      } else {
        const head = {
          "Content-Length": fileSize,
          "Content-Type": "video/mp4"
        };
        res.writeHead(200, head);
        fs.createReadStream(videoPath).pipe(res);
      }
    } catch (error) {
      res.status(500).json({ message: "Error streaming video" });
    }
  });
  app2.get("/api/courses/:courseId/quiz", async (req, res) => {
    try {
      const quiz = await storage.getQuizByCourseId(req.params.courseId);
      res.json(quiz);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch quiz" });
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
        progress: isPassing ? 100 : 90,
        // Mark as 90% if not passing to allow retake
        completedAt: isPassing ? /* @__PURE__ */ new Date() : null
        // Only mark completed if passing
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
      const certificateData = {
        score: enrollment.quizScore,
        completedAt: /* @__PURE__ */ new Date(),
        acknowledgedAt: /* @__PURE__ */ new Date(),
        digitalSignature: digitalSignature.trim(),
        participantName: user?.name || "",
        courseName: course?.title || "",
        completionDate: (/* @__PURE__ */ new Date()).toLocaleDateString(),
        certificateId: existingCertificate?.id || `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
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
        completedAt: /* @__PURE__ */ new Date()
      });
      try {
        if (user && course) {
          await transporter.sendMail({
            from: process.env.SMTP_FROM || "noreply@traintrack.com",
            to: user.email,
            subject: `Certificate of Completion: ${course.title}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb; text-align: center;">Certificate of Completion</h2>
                <div style="border: 2px solid #2563eb; padding: 30px; margin: 20px 0; text-align: center;">
                  <h3 style="color: #1e40af; margin-bottom: 20px;">This is to certify that</h3>
                  <h2 style="color: #1e3a8a; font-size: 28px; margin: 20px 0;">${user.name}</h2>
                  <p style="font-size: 16px; margin: 20px 0;">has successfully completed the training course</p>
                  <h3 style="color: #1e40af; font-size: 22px; margin: 20px 0;">${course.title}</h3>
                  <div style="margin: 30px 0;">
                    <p><strong>Score Achieved:</strong> ${enrollment.quizScore}%</p>
                    <p><strong>Completion Date:</strong> ${(/* @__PURE__ */ new Date()).toLocaleDateString()}</p>
                    <p><strong>Certificate ID:</strong> ${certificateData.certificateId}</p>
                  </div>
                  <p style="font-style: italic; margin-top: 30px;">Digital Signature: ${digitalSignature}</p>
                </div>
                <p style="text-align: center; color: #666; font-size: 12px;">
                  This certificate was digitally generated and acknowledged by the participant.
                </p>
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
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });
  app2.post("/api/bulk-assign-course", requireAdmin, async (req, res) => {
    try {
      const validatedData = bulkAssignCourseSchema.parse(req.body);
      const enrollments2 = await storage.bulkAssignCourse(validatedData.courseId, validatedData.userIds);
      res.json({ enrollments: enrollments2, message: `Course assigned to ${validatedData.userIds.length} users successfully` });
      app2.post("/api/bulk-import-employees", requireAdmin, async (req2, res2) => {
        try {
          const { employees } = req2.body;
          if (!Array.isArray(employees) || employees.length === 0) {
            return res2.status(400).json({ message: "Employee data array is required" });
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
                  password: empData.password || await bcrypt.hash(`temp${Date.now()}`, 10),
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
          res2.json(results);
        } catch (error) {
          res2.status(500).json({ message: "Bulk import failed", error: error.message });
        }
      });
      app2.post("/api/deactivate-employees", requireAdmin, async (req2, res2) => {
        try {
          const { employeeIds } = req2.body;
          const results = await storage.deactivateEmployees(employeeIds);
          res2.json({ message: `Deactivated ${results} employees successfully` });
        } catch (error) {
          res2.status(500).json({ message: "Failed to deactivate employees" });
        }
      });
      app2.get("/api/compliance-status", requireAdmin, async (req2, res2) => {
        try {
          const complianceReport = await storage.getComplianceReport();
          res2.json(complianceReport);
        } catch (error) {
          res2.status(500).json({ message: "Failed to generate compliance report" });
        }
      });
      app2.post("/api/renew-expired-certifications", requireAdmin, async (req2, res2) => {
        try {
          const { courseId, userIds } = req2.body;
          const renewedEnrollments = await storage.renewExpiredCertifications(courseId, userIds);
          res2.json({
            message: `Renewed ${renewedEnrollments.length} certifications`,
            renewedEnrollments
          });
        } catch (error) {
          res2.status(500).json({ message: "Failed to renew certifications" });
        }
      });
    } catch (error) {
      console.error("Error bulk assigning course:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid data" });
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
      res.json({
        enrollment,
        course,
        isFirstTime: !enrollment.userId
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
      const hashedPassword = await bcrypt.hash(`temp${Date.now()}`, 10);
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
      const assignments = await storage.getCourseAssignments(req.params.courseId);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching course assignments:", error);
      res.status(500).json({ message: "Failed to fetch assignments" });
    }
  });
  app2.post("/api/send-reminders/:courseId", requireAdmin, async (req, res) => {
    try {
      const assignments = await storage.getCourseAssignments(req.params.courseId);
      const pendingAssignments = assignments.filter(
        (a) => ["pending", "accessed"].includes(a.status) && /* @__PURE__ */ new Date() < new Date(a.deadline)
      );
      const course = await storage.getCourse(req.params.courseId);
      let sentCount = 0;
      for (const assignment of pendingAssignments) {
        try {
          const loginLink = `${req.protocol}://${req.get("host")}/course-access/${assignment.assignmentToken}`;
          await transporter.sendMail({
            from: process.env.SMTP_FROM || "noreply@traintrack.com",
            to: assignment.assignedEmail,
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
          sentCount++;
        } catch (emailError) {
          console.error("Failed to send reminder email:", emailError);
        }
      }
      await storage.sendCourseReminders(req.params.courseId);
      res.json({ message: `Sent ${sentCount} reminder emails` });
    } catch (error) {
      console.error("Error sending reminders:", error);
      res.status(500).json({ message: "Failed to send reminders" });
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
      const enrollments2 = await storage.getCourseEnrollments(req.params.courseId);
      res.json(enrollments2);
    } catch (error) {
      console.error("Error fetching course enrollments:", error);
      res.status(500).json({ message: "Failed to fetch course enrollments" });
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
