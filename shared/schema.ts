import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
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
  createdAt: timestamp("created_at").defaultNow(),
});

export const courses = pgTable("courses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  videoPath: text("video_path"),
  duration: integer("duration"), // in minutes
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  isActive: boolean("is_active").default(true),
  isComplianceCourse: boolean("is_compliance_course").default(false),
  renewalPeriodMonths: integer("renewal_period_months").default(3), // 3 or 4 months
  isAutoEnrollNewEmployees: boolean("is_auto_enroll_new_employees").default(false),
  // Course type for certificate expiry management
  courseType: text("course_type", { enum: ["recurring", "one-time"] }).default("one-time"),
  // New fields for deadline management
  defaultDeadlineDays: integer("default_deadline_days").default(30), // Default days to complete
  reminderDays: integer("reminder_days").default(7), // Days before deadline to send reminder
});

export const quizzes = pgTable("quizzes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").references(() => courses.id).notNull(),
  title: text("title").notNull(),
  questions: jsonb("questions").notNull(), // Array of question objects
  passingScore: integer("passing_score").default(70),
  createdAt: timestamp("created_at").defaultNow(),
});

export const enrollments = pgTable("enrollments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  courseId: varchar("course_id").references(() => courses.id).notNull(),
  enrolledAt: timestamp("enrolled_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  progress: integer("progress").default(0), // percentage 0-100
  quizScore: integer("quiz_score"),
  certificateIssued: boolean("certificate_issued").default(false),
  // New fields for bulk email assignment
  assignedEmail: text("assigned_email"), // Email assigned before user creation
  assignmentToken: text("assignment_token"), // Unique token for email access
  deadline: timestamp("deadline"), // Course completion deadline
  status: text("status", { enum: ["pending", "accessed", "completed", "expired"] }).default("pending"),
  remindersSent: integer("reminders_sent").default(0),
  // Compliance tracking
  expiresAt: timestamp("expires_at"), // When the certification expires
  isExpired: boolean("is_expired").default(false),
  renewalCount: integer("renewal_count").default(0), // Track how many times renewed
});

export const certificates = pgTable("certificates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  courseId: varchar("course_id").references(() => courses.id).notNull(),
  enrollmentId: varchar("enrollment_id").references(() => enrollments.id).notNull(),
  issuedAt: timestamp("issued_at").defaultNow(),
  certificateData: jsonb("certificate_data"), // Certificate details for PDF generation
  digitalSignature: text("digital_signature"), // User's digital signature
  acknowledgedAt: timestamp("acknowledged_at"), // When user acknowledged completion
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  enrollments: many(enrollments),
  certificates: many(certificates),
  createdCourses: many(courses),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  creator: one(users, {
    fields: [courses.createdBy],
    references: [users.id],
  }),
  enrollments: many(enrollments),
  quizzes: many(quizzes),
  certificates: many(certificates),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  user: one(users, {
    fields: [enrollments.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [enrollments.courseId],
    references: [courses.id],
  }),
}));

export const quizzesRelations = relations(quizzes, ({ one }) => ({
  course: one(courses, {
    fields: [quizzes.courseId],
    references: [courses.id],
  }),
}));

export const certificatesRelations = relations(certificates, ({ one }) => ({
  user: one(users, {
    fields: [certificates.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [certificates.courseId],
    references: [courses.id],
  }),
  enrollment: one(enrollments, {
    fields: [certificates.enrollmentId],
    references: [enrollments.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertCourseSchema = createInsertSchema(courses).omit({
  id: true,
  createdAt: true,
});

export const insertQuizSchema = createInsertSchema(quizzes).omit({
  id: true,
  createdAt: true,
});

export const insertEnrollmentSchema = createInsertSchema(enrollments).omit({
  id: true,
  enrolledAt: true,
});

export const insertCertificateSchema = createInsertSchema(certificates).omit({
  id: true,
  issuedAt: true,
});

// Bulk assignment schemas
export const bulkAssignCourseSchema = z.object({
  courseId: z.string(),
  userIds: z.array(z.string()).min(1, "At least one user must be selected")
});

export const bulkAssignUsersSchema = z.object({
  userIds: z.array(z.string()).min(1, "At least one user must be selected"),
  courseIds: z.array(z.string()).min(1, "At least one course must be selected")
});

// Email bulk assignment schema
export const bulkEmailAssignmentSchema = z.object({
  courseId: z.string(),
  emails: z.array(z.string().email()).min(1, "At least one email must be provided"),
  deadlineDays: z.number().min(1).max(365).default(30),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Course = typeof courses.$inferSelect;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type Quiz = typeof quizzes.$inferSelect;
export type InsertQuiz = z.infer<typeof insertQuizSchema>;
export type Enrollment = typeof enrollments.$inferSelect;
export type InsertEnrollment = z.infer<typeof insertEnrollmentSchema>;
export type Certificate = typeof certificates.$inferSelect;
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;