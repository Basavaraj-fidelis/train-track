import {
  users, courses, quizzes, enrollments, certificates,
  type User, type InsertUser, type Course, type InsertCourse,
  type Quiz, type InsertQuiz, type Enrollment, type InsertEnrollment,
  type Certificate, type InsertCertificate
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, isNull, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";
import crypto from 'crypto';

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  getAllEmployees(): Promise<User[]>;
  deleteUser(id: string): Promise<boolean>;

  // Course operations
  getCourse(id: string): Promise<Course | undefined>;
  getAllCourses(): Promise<Course[]>;
  createCourse(course: InsertCourse): Promise<Course>;
  updateCourse(id: string, course: Partial<InsertCourse>): Promise<Course | undefined>;
  deleteCourse(id: string): Promise<boolean>;

  // Quiz operations
  getQuizByCourseId(courseId: string): Promise<Quiz | undefined>;
  createQuiz(quiz: InsertQuiz): Promise<Quiz>;
  updateQuiz(id: string, quiz: Partial<InsertQuiz>): Promise<Quiz | undefined>;

  // Enrollment operations
  getEnrollment(userId: string, courseId: string): Promise<Enrollment | undefined>;
  getUserEnrollments(userId: string): Promise<(Enrollment & { course: Course })[]>;
  createEnrollment(enrollment: InsertEnrollment): Promise<Enrollment>;
  updateEnrollment(id: string, enrollment: Partial<InsertEnrollment>): Promise<Enrollment | undefined>;
  getCourseEnrollments(courseId: string): Promise<(Enrollment & { user: User })[]>;

  // Certificate operations
  getUserCertificates(userId: string): Promise<(Certificate & { course: Course })[]>;
  createCertificate(certificate: InsertCertificate): Promise<Certificate>;
  getCertificate(id: string): Promise<Certificate | undefined>;
  updateCertificate(certificateId: string, updates: Partial<InsertCertificate>);
  getUserCertificateForCourse(userId: string, courseId: string);

  // Dashboard statistics
  getDashboardStats(): Promise<{
    totalEmployees: number;
    activeCourses: number;
    pendingAssignments: number;
    certificatesIssued: number;
    completedCourses: number;
    totalEnrollments: number;
    averageProgress: number;
  }>;

  // Bulk operations
  bulkAssignCourse(courseId: string, userIds: string[]): Promise<Enrollment[]>;
  bulkAssignUsers(userIds: string[], courseIds: string[]): Promise<Enrollment[]>;
  getUserAnalytics(userId: string): Promise<{
    totalCourses: number;
    completedCourses: number;
    inProgressCourses: number;
    certificatesEarned: number;
    averageScore: number;
  }>;

  // Email-based bulk assignment methods
  bulkAssignCourseByEmail(courseId: string, emails: string[], deadlineDays: number): Promise<Enrollment[]>;
  getEnrollmentByToken(token: string): Promise<Enrollment | undefined>;
  getCourseAssignments(courseId: string): Promise<any[]>;
  sendCourseReminders(courseId: string, pendingOnly?: boolean): Promise<number>;
  cleanupExpiredAssignments(): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  constructor(private db: any) {} // Inject db instance

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await this.db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await this.db
      .update(users)
      .set(user)
      .where(eq(users.id, id))
      .returning();
    return updated || undefined;
  }

  async getAllEmployees(): Promise<User[]> {
    return await this.db.select().from(users).where(eq(users.role, "employee"));
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await this.db.delete(users).where(eq(users.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getCourse(id: string): Promise<Course | undefined> {
    const [course] = await this.db.select().from(courses).where(eq(courses.id, id));
    return course || undefined;
  }

  async getAllCourses(): Promise<Course[]> {
    return await this.db.select().from(courses).where(eq(courses.isActive, true));
  }

  async createCourse(courseData: InsertCourse): Promise<Course> {
    try {
      if (!courseData.title || !courseData.description) {
        throw new Error("Title and description are required");
      }

      if (!courseData.createdBy) {
        throw new Error("Created by user ID is required");
      }

      const courseId = crypto.randomUUID();

      const [course] = await this.db
        .insert(courses)
        .values({
          id: courseId,
          title: courseData.title.trim(),
          description: courseData.description.trim(),
          duration: courseData.duration || 0,
          videoPath: courseData.videoPath,
          isActive: true,
          createdBy: courseData.createdBy,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Handle quiz questions if provided
      if (courseData.questions && courseData.questions.length > 0) {
        try {
          await this.createQuiz({
            id: crypto.randomUUID(),
            courseId: course.id,
            title: `${courseData.title} Quiz`,
            description: `Quiz for ${courseData.title}`,
            questions: courseData.questions,
            passingScore: 70,
            timeLimit: 30,
          });
        } catch (quizError) {
          console.error("Error creating quiz:", quizError);
          // Continue without quiz if quiz creation fails
        }
      }

      return course;
    } catch (error) {
      console.error("Error creating course:", error);
      throw error;
    }
  }

  async updateCourse(id: string, course: Partial<InsertCourse>): Promise<Course | undefined> {
    const [updated] = await this.db
      .update(courses)
      .set(course)
      .where(eq(courses.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCourse(id: string): Promise<boolean> {
    const result = await this.db.update(courses).set({ isActive: false }).where(eq(courses.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getQuizByCourseId(courseId: string): Promise<Quiz | undefined> {
    const [quiz] = await this.db.select().from(quizzes).where(eq(quizzes.courseId, courseId));
    return quiz || undefined;
  }

  async createQuiz(insertQuiz: InsertQuiz): Promise<Quiz> {
    const [quiz] = await this.db
      .insert(quizzes)
      .values(insertQuiz)
      .returning();
    return quiz;
  }

  async updateQuiz(id: string, quiz: Partial<InsertQuiz>): Promise<Quiz | undefined> {
    const [updated] = await this.db
      .update(quizzes)
      .set(quiz)
      .where(eq(quizzes.id, id))
      .returning();
    return updated || undefined;
  }

  async getEnrollment(userId: string, courseId: string): Promise<Enrollment | undefined> {
    const [enrollment] = await this.db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)));
    return enrollment || undefined;
  }

  async getUserEnrollments(userId: string): Promise<(Enrollment & { course: Course })[]> {
    return await this.db
      .select()
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(eq(enrollments.userId, userId))
      .then(results => results.map(result => ({ ...result.enrollments, course: result.courses })));
  }

  async createEnrollment(insertEnrollment: InsertEnrollment): Promise<Enrollment> {
    const [enrollment] = await this.db
      .insert(enrollments)
      .values(insertEnrollment)
      .returning();
    return enrollment;
  }

  async updateEnrollment(id: string, enrollment: Partial<InsertEnrollment>): Promise<Enrollment | undefined> {
    const [updated] = await this.db
      .update(enrollments)
      .set(enrollment)
      .where(eq(enrollments.id, id))
      .returning();
    return updated || undefined;
  }

  async getCourseEnrollments(courseId: string): Promise<(Enrollment & { user: User })[]> {
    return await this.db
      .select()
      .from(enrollments)
      .innerJoin(users, eq(enrollments.userId, users.id))
      .where(eq(enrollments.courseId, courseId))
      .then(results => results.map(result => ({ ...result.enrollments, user: result.users })));
  }

  async getUserCertificates(userId: string): Promise<(Certificate & { course: Course })[]> {
    return await this.db
      .select()
      .from(certificates)
      .innerJoin(courses, eq(certificates.courseId, courses.id))
      .where(eq(certificates.userId, userId))
      .orderBy(desc(certificates.issuedAt))
      .then(results => results.map(result => ({ ...result.certificates, course: result.courses })));
  }

  async createCertificate(certificateData: InsertCertificate): Promise<Certificate> {
    const [certificate] = await this.db
      .insert(certificates)
      .values(certificateData)
      .returning();
    return certificate;
  }

  async updateCertificate(certificateId: string, updates: Partial<InsertCertificate>) {
    const [certificate] = await this.db
      .update(certificates)
      .set(updates)
      .where(eq(certificates.id, certificateId))
      .returning();
    return certificate;
  }

  async getUserCertificateForCourse(userId: string, courseId: string) {
    const [certificate] = await this.db
      .select()
      .from(certificates)
      .where(and(
        eq(certificates.userId, userId),
        eq(certificates.courseId, courseId)
      ));
    return certificate;
  }

  async getCertificate(id: string): Promise<Certificate | undefined> {
    const [certificate] = await this.db.select().from(certificates).where(eq(certificates.id, id));
    return certificate || undefined;
  }

  async getDashboardStats(): Promise<{
    totalEmployees: number;
    activeCourses: number;
    pendingAssignments: number;
    certificatesIssued: number;
    completedCourses: number;
    totalEnrollments: number;
    averageProgress: number;
  }> {
    const [employeeCount] = await this.db.select({ count: sql`count(*)` }).from(users).where(eq(users.role, "employee"));
    const [courseCount] = await this.db.select({ count: sql`count(*)` }).from(courses).where(eq(courses.isActive, true));
    const [pendingCount] = await this.db.select({ count: sql`count(*)` }).from(enrollments).where(isNull(enrollments.completedAt));
    const [completedCount] = await this.db.select({ count: sql`count(*)` }).from(enrollments).where(sql`${enrollments.completedAt} IS NOT NULL`);
    const [certCount] = await this.db.select({ count: sql`count(*)` }).from(certificates);
    const [totalEnrollments] = await this.db.select({ count: sql`count(*)` }).from(enrollments);
    const [avgProgress] = await this.db.select({ avg: sql`avg(${enrollments.progress})` }).from(enrollments);

    return {
      totalEmployees: Number(employeeCount.count) || 0,
      activeCourses: Number(courseCount.count) || 0,
      pendingAssignments: Number(pendingCount.count) || 0,
      certificatesIssued: Number(certCount.count) || 0,
      completedCourses: Number(completedCount.count) || 0,
      totalEnrollments: Number(totalEnrollments.count) || 0,
      averageProgress: Math.round(Number(avgProgress.avg) || 0),
    };
  }

  async bulkAssignCourse(courseId: string, userIds: string[]): Promise<Enrollment[]> {
    // Check for existing enrollments using inArray
    const existingEnrollments = await this.db
      .select()
      .from(enrollments)
      .where(and(
        eq(enrollments.courseId, courseId),
        inArray(enrollments.userId, userIds)
      ));

    const existingUserIds = new Set(existingEnrollments.map(e => e.userId));
    const newUserIds = userIds.filter(userId => !existingUserIds.has(userId));

    if (newUserIds.length === 0) {
      throw new Error("All selected users are already enrolled in this course");
    }

    const enrollmentData = newUserIds.map(userId => ({
      userId,
      courseId,
      // Initialize expiresAt for bulk assignment if needed, or handle it in the caller
      // expiresAt: new Date() // Example: set to now, or calculate based on course settings
    }));

    const newEnrollments = await this.db
      .insert(enrollments)
      .values(enrollmentData)
      .returning();

    return newEnrollments;
  }

  async bulkAssignUsers(userIds: string[], courseIds: string[]): Promise<Enrollment[]> {
    try {
      // Get all existing enrollments for these users and courses
      const existingEnrollments = await this.db
        .select()
        .from(enrollments)
        .where(and(
          inArray(enrollments.userId, userIds),
          inArray(enrollments.courseId, courseIds)
        ));

      const existingPairs = new Set(
        existingEnrollments.map(e => `${e.userId}-${e.courseId}`)
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

      const newEnrollments = await this.db
        .insert(enrollments)
        .values(enrollmentData)
        .returning();

      return newEnrollments;
    } catch (error) {
      console.error("Error in bulkAssignUsers:", error);
      throw error;
    }
  }

  async getUserAnalytics(userId: string): Promise<{
    totalCourses: number;
    completedCourses: number;
    inProgressCourses: number;
    certificatesEarned: number;
    averageScore: number;
  }> {
    const userEnrollments = await this.getUserEnrollments(userId);
    const userCertificates = await this.getUserCertificates(userId);

    const completedCourses = userEnrollments.filter(e => e.completedAt).length;
    const inProgressCourses = userEnrollments.filter(e => !e.completedAt).length;

    const scoresWithValues = userEnrollments
      .map(e => e.quizScore)
      .filter((score): score is number => score !== null && score !== undefined);

    const averageScore = scoresWithValues.length > 0
      ? scoresWithValues.reduce((acc, score) => acc + score, 0) / scoresWithValues.length
      : 0;

    return {
      totalCourses: userEnrollments.length,
      completedCourses,
      inProgressCourses,
      certificatesEarned: userCertificates.length,
      averageScore: Math.round(averageScore),
    };
  }

  async getUserByEmployeeId(employeeId: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.employeeId, employeeId));
    return user || undefined;
  }

  async autoEnrollInComplianceCourses(employeeIdentifier: string): Promise<void> {
    // Get all compliance courses
    const complianceCourses = await this.db
      .select()
      .from(courses)
      .where(and(
        eq(courses.isComplianceCourse, true),
        eq(courses.isAutoEnrollNewEmployees, true),
        eq(courses.isActive, true)
      ));

    // Get user
    const user = await this.getUserByEmail(employeeIdentifier) ||
                  await this.getUserByEmployeeId(employeeIdentifier);

    if (!user) return;

    // Enroll in each compliance course
    for (const course of complianceCourses) {
      const existingEnrollment = await this.getEnrollment(user.id, course.id);
      if (!existingEnrollment) {
        const expirationDate = new Date();
        expirationDate.setMonth(expirationDate.getMonth() + (course.renewalPeriodMonths || 3));

        await this.createEnrollment({
          userId: user.id,
          courseId: course.id,
          expiresAt: expirationDate
        });
      }
    }
  }

  async deactivateEmployees(employeeIds: string[]): Promise<number> {
    const result = await this.db
      .update(users)
      .set({ isActive: false })
      .where(inArray(users.id, employeeIds));

    return result.rowCount || 0;
  }

  async getComplianceReport(): Promise<{
    totalEmployees: number;
    activeEmployees: number;
    expiredCertifications: number;
    expiringInNext30Days: number;
    complianceCourses: any[];
    expiringEmployees: any[];
  }> {
    const [totalEmp] = await this.db.select({ count: sql`count(*)` }).from(users).where(eq(users.role, "employee"));
    const [activeEmp] = await this.db.select({ count: sql`count(*)` }).from(users).where(and(eq(users.role, "employee"), eq(users.isActive, true)));

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const [expiredCerts] = await this.db.select({ count: sql`count(*)` })
      .from(enrollments)
      .where(and(
        sql`${enrollments.expiresAt} < NOW()`,
        eq(enrollments.isExpired, false)
      ));

    const [expiringCerts] = await this.db.select({ count: sql`count(*)` })
      .from(enrollments)
      .where(and(
        sql`${enrollments.expiresAt} BETWEEN NOW() AND '${thirtyDaysFromNow.toISOString()}'`,
        eq(enrollments.isExpired, false)
      ));

    const complianceCourses = await this.db.select().from(courses).where(eq(courses.isComplianceCourse, true));

    const expiringEmployees = await this.db
      .select()
      .from(enrollments)
      .innerJoin(users, eq(enrollments.userId, users.id))
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(and(
        sql`${enrollments.expiresAt} BETWEEN NOW() AND '${thirtyDaysFromNow.toISOString()}'`,
        eq(enrollments.isExpired, false),
        eq(users.isActive, true)
      ));

    return {
      totalEmployees: Number(totalEmp.count),
      activeEmployees: Number(activeEmp.count),
      expiredCertifications: Number(expiredCerts.count),
      expiringInNext30Days: Number(expiringCerts.count),
      complianceCourses,
      expiringEmployees: expiringEmployees.map(result => ({
        ...result.enrollments,
        user: result.users,
        course: result.courses
      }))
    };
  }

  async renewExpiredCertifications(courseId: string, userIds?: string[]): Promise<Enrollment[]> {
    const whereConditions = [
      eq(enrollments.courseId, courseId),
      sql`${enrollments.expiresAt} <= NOW()`
    ];

    if (userIds && userIds.length > 0) {
      whereConditions.push(
        inArray(enrollments.userId, userIds)
      );
    }

    // Get course renewal period
    const course = await this.getCourse(courseId);
    const renewalPeriod = course?.renewalPeriodMonths || 3;

    // Reset expired enrollments
    const newExpirationDate = new Date();
    newExpirationDate.setMonth(newExpirationDate.getMonth() + renewalPeriod);

    const renewed = await this.db
      .update(enrollments)
      .set({
        progress: 0,
        quizScore: null,
        completedAt: null,
        certificateIssued: false,
        expiresAt: newExpirationDate,
        isExpired: false,
        renewalCount: sql`${enrollments.renewalCount} + 1`
      })
      .where(and(...whereConditions))
      .returning();

    return renewed;
  }

  async markExpiredCertifications(): Promise<void> {
    await this.db
      .update(enrollments)
      .set({ isExpired: true })
      .where(and(
        sql`${enrollments.expiresAt} < NOW()`,
        eq(enrollments.isExpired, false)
      ));
  }

  // --- New methods for email-based bulk assignment ---

  async bulkAssignCourseByEmail(courseId: string, emails: string[], deadlineDays: number): Promise<Enrollment[]> {
    const users = await this.db.select().from(users).where(inArray(users.email, emails));
    const existingEnrollments = await this.db.select().from(enrollments).where(and(
      eq(enrollments.courseId, courseId),
      inArray(enrollments.userId, users.map(u => u.id))
    ));

    const existingUserIds = new Set(existingEnrollments.map(e => e.userId));
    const newEnrollmentsData: InsertEnrollment[] = [];

    for (const user of users) {
      if (!existingUserIds.has(user.id)) {
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + deadlineDays);

        newEnrollmentsData.push({
          userId: user.id,
          courseId: courseId,
          expiresAt: expirationDate,
          // Other fields can be set here if needed, e.g., assignedBy, assignmentToken
          assignmentToken: crypto.randomUUID(), // Example: token for one-time login
        });
      }
    }

    if (newEnrollmentsData.length === 0) {
      // Optionally throw an error or return an empty array if no new enrollments can be made
      return [];
    }

    return await this.db.insert(enrollments).values(newEnrollmentsData).returning();
  }

  async getEnrollmentByToken(token: string): Promise<Enrollment | undefined> {
    const [enrollment] = await this.db.select().from(enrollments).where(eq(enrollments.assignmentToken, token));
    return enrollment;
  }

  async getCourseAssignments(courseId: string): Promise<any[]> {
    return await this.db
      .select()
      .from(enrollments)
      .innerJoin(users, eq(enrollments.userId, users.id))
      .where(and(
        eq(enrollments.courseId, courseId),
        sql`${enrollments.assignmentToken} IS NOT NULL` // Filter for assignments made via email
      ))
      .then(results => results.map(result => ({
        enrollment: result.enrollments,
        user: result.users,
        course: { id: courseId } // Assuming course details are not fetched here
      })));
  }

  async sendCourseReminders(courseId: string, pendingOnly?: boolean): Promise<number> {
    // This is a placeholder. Actual implementation would involve an email service.
    // It would query for enrollments and send emails.
    console.log(`Sending reminders for course ${courseId}${pendingOnly ? ' (pending only)' : ''}`);
    // Example: fetch enrollments and send emails
    // const enrollmentsToSend = await this.db.select().from(enrollments).where(...)
    // await emailService.sendReminders(enrollmentsToSend);
    return 0; // Return count of emails sent
  }

  async cleanupExpiredAssignments(): Promise<number> {
    // This method would clean up assignments that are past their expiry date
    // and potentially have not been completed or acted upon.
    // For now, it marks them as expired if not already.
    const result = await this.db
      .update(enrollments)
      .set({ isExpired: true })
      .where(and(
        sql`${enrollments.expiresAt} < NOW()`,
        eq(enrollments.isExpired, false)
      ));
    return result.rowCount || 0;
  }
}

export const storage = new DatabaseStorage(db);