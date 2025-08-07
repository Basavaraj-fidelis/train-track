import {
  users, courses, quizzes, enrollments, certificates,
  type User, type InsertUser, type Course, type InsertCourse,
  type Quiz, type InsertQuiz, type Enrollment, type InsertEnrollment,
  type Certificate, type InsertCertificate
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, isNull, inArray, lt, gt } from "drizzle-orm";
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
  deleteQuiz(id: string): Promise<boolean>;

  // Enrollment operations
  getEnrollment(userId: string, courseId: string): Promise<Enrollment | undefined>;
  getUserEnrollments(userId: string): Promise<(Enrollment & { course: Course })[]>;
  createEnrollment(enrollment: InsertEnrollment): Promise<Enrollment>;
  updateEnrollment(id: string, enrollment: Partial<InsertEnrollment>): Promise<Enrollment | undefined>;
  deleteEnrollment(id: string): Promise<boolean>;
  getAllEnrollments(): Promise<any[]>;
  getCourseEnrollments(courseId: string): Promise<(Enrollment & { user: User })[]>;

  // Certificate operations
  getUserCertificates(userId: string): Promise<(Certificate & { course: Course })[]>;
  createCertificate(certificate: InsertCertificate): Promise<Certificate>;
  getCertificate(id: string): Promise<Certificate | undefined>;
  updateCertificate(certificateId: string, updates: Partial<InsertCertificate>);
  getUserCertificateForCourse(userId: string, courseId: string);
  getAllCertificates(): Promise<any[]>;
  deleteCertificate(id: string): Promise<boolean>;

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
  updateEnrollmentProgress(enrollmentId: string, progress: number, quizScore?: number): Promise<boolean>;
  incrementRemindersSent(enrollmentId: string): Promise<boolean>;
  getTotalRemindersSent(): Promise<number>;
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
    // FIX: Delete related certificates first, then enrollments before deleting the user
    await this.db.delete(certificates).where(eq(certificates.userId, id));
    await this.db.delete(enrollments).where(eq(enrollments.userId, id));

    const result = await this.db.delete(users).where(eq(users.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getCourse(id: string): Promise<Course | undefined> {
    try {
      const [course] = await this.db.select().from(courses).where(eq(courses.id, id));
      return course || undefined;
    } catch (error: any) {
      if (error.code === '42703') {
        // If course_type column doesn't exist, select basic fields only
        console.log('Selecting course with basic fields only due to schema migration');
        const [course] = await this.db.select({
          id: courses.id,
          title: courses.title,
          description: courses.description,
          videoPath: courses.videoPath,
          duration: courses.duration,
          createdBy: courses.createdBy,
          createdAt: courses.createdAt,
          isActive: courses.isActive,
        }).from(courses).where(eq(courses.id, id));
        return course || undefined;
      }
      throw error;
    }
  }

  async getAllCourses(): Promise<Course[]> {
    try {
      return await this.db.select().from(courses).where(eq(courses.isActive, true));
    } catch (error: any) {
      if (error.code === '42703') {
        // If course_type column doesn't exist, select basic fields only
        console.log('Selecting courses with basic fields only due to schema migration');
        return await this.db.select({
          id: courses.id,
          title: courses.title,
          description: courses.description,
          videoPath: courses.videoPath,
          duration: courses.duration,
          createdBy: courses.createdBy,
          createdAt: courses.createdAt,
          isActive: courses.isActive,
        }).from(courses).where(eq(courses.isActive, true));
      }
      throw error;
    }
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

      const courseValues: any = {
        id: courseId,
        title: courseData.title.trim(),
        description: courseData.description.trim(),
        duration: courseData.duration || 0,
        videoPath: courseData.videoPath,
        isActive: true,
        createdBy: courseData.createdBy,
        createdAt: new Date(),
      };

      // Only add these fields if they exist in the schema
      try {
        // Test if the column exists by trying to insert with it
        const [course] = await this.db
          .insert(courses)
          .values({
            ...courseValues,
            courseType: courseData.courseType || 'one-time',
            renewalPeriodMonths: courseData.renewalPeriodMonths || 3,
            isComplianceCourse: courseData.isComplianceCourse || false,
            isAutoEnrollNewEmployees: courseData.isAutoEnrollNewEmployees || false,
          })
          .returning();

        return course;
      } catch (error: any) {
        if (error.code === '42703') {
          // Column doesn't exist yet, insert without the new fields
          console.log('Creating course without new schema fields, they will be available after migration');
          const [course] = await this.db
            .insert(courses)
            .values(courseValues)
            .returning();
          return course;
        }
        throw error;
      }

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
    // FIX: Delete related certificates first, then enrollments, quizzes, and finally the course
    await this.db.delete(certificates).where(eq(certificates.courseId, id));
    await this.db.delete(enrollments).where(eq(enrollments.courseId, id));
    await this.db.delete(quizzes).where(eq(quizzes.courseId, id));

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

  async deleteQuiz(id: string): Promise<boolean> {
    const result = await this.db.delete(quizzes).where(eq(quizzes.id, id));
    return (result.rowCount || 0) > 0;
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

  async deleteEnrollment(id: string): Promise<boolean> {
    const result = await this.db.delete(enrollments).where(eq(enrollments.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getAllEnrollments(): Promise<any[]> {
    return await this.db
      .select({
        id: enrollments.id,
        userId: enrollments.userId,
        courseId: enrollments.courseId,
        enrolledAt: enrollments.enrolledAt,
        completedAt: enrollments.completedAt,
        progress: enrollments.progress,
        quizScore: enrollments.quizScore,
        certificateIssued: enrollments.certificateIssued,
        status: enrollments.status,
        deadline: enrollments.deadline,
        user: {
          name: users.name,
          email: users.email,
          employeeId: users.employeeId,
        },
        course: {
          title: courses.title,
          description: courses.description,
        },
      })
      .from(enrollments)
      .leftJoin(users, eq(enrollments.userId, users.id))
      .leftJoin(courses, eq(enrollments.courseId, courses.id));
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

  async getAllCertificates(): Promise<any[]> {
    return await this.db
      .select({
        id: certificates.id,
        userId: certificates.userId,
        courseId: certificates.courseId,
        enrollmentId: certificates.enrollmentId,
        issuedAt: certificates.issuedAt,
        certificateData: certificates.certificateData,
        digitalSignature: certificates.digitalSignature,
        acknowledgedAt: certificates.acknowledgedAt,
        user: {
          name: users.name,
          email: users.email,
          employeeId: users.employeeId,
        },
        course: {
          title: courses.title,
          description: courses.description,
        },
      })
      .from(certificates)
      .leftJoin(users, eq(certificates.userId, users.id))
      .leftJoin(courses, eq(certificates.courseId, courses.id));
  }

  async deleteCertificate(id: string): Promise<boolean> {
    const result = await this.db.delete(certificates).where(eq(certificates.id, id));
    return (result.rowCount || 0) > 0;
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
    try {
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
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      return {
        totalEmployees: 0,
        activeCourses: 0,
        pendingAssignments: 0,
        certificatesIssued: 0,
        completedCourses: 0,
        totalEnrollments: 0,
        averageProgress: 0,
      };
    }
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
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + deadlineDays);

    const newEnrollmentsData: InsertEnrollment[] = [];

    for (const email of emails) {
      // Check if user exists
      const user = await this.getUserByEmail(email);

      if (user) {
        // User exists, create regular enrollment
        const existingEnrollment = await this.getEnrollment(user.id, courseId);
        if (!existingEnrollment) {
          newEnrollmentsData.push({
            userId: user.id,
            courseId: courseId,
            deadline: deadline,
            status: "pending",
            assignmentToken: crypto.randomUUID(),
          });
        }
      } else {
        // User doesn't exist, create email-based assignment
        newEnrollmentsData.push({
          courseId: courseId,
          assignedEmail: email,
          deadline: deadline,
          status: "pending",
          assignmentToken: crypto.randomUUID(),
        });
      }
    }

    if (newEnrollmentsData.length === 0) {
      return [];
    }

    return await this.db.insert(enrollments).values(newEnrollmentsData).returning();
  }

  async getEnrollmentByToken(token: string): Promise<Enrollment | undefined> {
    const [enrollment] = await this.db.select().from(enrollments).where(eq(enrollments.assignmentToken, token));
    return enrollment;
  }

  async getCourseAssignments(courseId: string): Promise<any[]> {
    // Get all enrollments for this course with assignment tokens
    const enrollmentsWithUsers = await this.db
      .select()
      .from(enrollments)
      .leftJoin(users, eq(enrollments.userId, users.id))
      .where(and(
        eq(enrollments.courseId, courseId),
        sql`${enrollments.assignmentToken} IS NOT NULL`
      ));

    return enrollmentsWithUsers.map(result => ({
      ...result.enrollments,
      user: result.users,
    }));
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

  async incrementReminderCount(enrollmentId: string): Promise<void> {
    try {
      await this.db
        .update(enrollments)
        .set({ remindersSent: sql`${enrollments.remindersSent} + 1` })
        .where(eq(enrollments.id, enrollmentId));
    } catch (error) {
      console.error('Failed to increment reminder count:', error);
      // Don't throw error as this is not critical
    }
  }

  async cleanupExpiredAssignments(): Promise<number> {
    try {
      // Mark assignments as expired if past their deadline
      const result = await this.db
        .update(enrollments)
        .set({ status: "expired" })
        .where(and(
          lt(enrollments.deadline, new Date()),
          inArray(enrollments.status, ["pending", "accessed"])
        ));
      return result.rowCount || 0;
    } catch (error: any) {
      // Handle case where deadline column doesn't exist yet
      if (error.code === '42703') {
        console.log('Deadline column not found, skipping cleanup');
        return 0;
      }
      throw error;
    }
  }

  async resetReminderData(): Promise<number> {
    // Reset reminder count for enrollments where deadline is more than 10 days past
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    const result = await this.db
      .update(enrollments)
      .set({ remindersSent: 0 })
      .where(
        and(
          lt(enrollments.deadline, tenDaysAgo),
          gt(enrollments.remindersSent, 0)
        )
      );

    return result.rowCount || 0;
  }

  async updateEnrollmentProgress(enrollmentId: string, progress: number, quizScore?: number): Promise<boolean> {
    try {
      const updateData: any = { progress };
      if (quizScore !== undefined) {
        updateData.quizScore = quizScore;
      }

      // Mark as completed if progress is 100%
      if (progress >= 100) {
        updateData.completedAt = new Date();
        updateData.certificateIssued = true;
      }

      await this.db
        .update(enrollments)
        .set(updateData)
        .where(eq(enrollments.id, enrollmentId));

      return true;
    } catch (error) {
      console.error("Error updating enrollment progress:", error);
      return false;
    }
  }

  async incrementRemindersSent(enrollmentId: string): Promise<boolean> {
    try {
      await this.db
        .update(enrollments)
        .set({
          remindersSent: sql`${enrollments.remindersSent} + 1`
        })
        .where(eq(enrollments.id, enrollmentId));

      return true;
    } catch (error) {
      console.error("Error incrementing reminders sent:", error);
      return false;
    }
  }

  async getTotalRemindersSent(): Promise<number> {
    try {
      const result = await this.db
        .select({
          total: sql<number>`COALESCE(SUM(${enrollments.remindersSent}), 0)`
        })
        .from(enrollments);

      return result[0]?.total || 0;
    } catch (error) {
      console.error("Error getting total reminders sent:", error);
      return 0;
    }
  }

  // Additional helper methods for backward compatibility
  async getTotalEmployees(): Promise<number> {
    const [result] = await this.db.select({ count: sql`count(*)` }).from(users).where(eq(users.role, "employee"));
    return Number(result.count) || 0;
  }

  async getTotalActiveCourses(): Promise<number> {
    const [result] = await this.db.select({ count: sql`count(*)` }).from(courses).where(eq(courses.isActive, true));
    return Number(result.count) || 0;
  }

  async getPendingAssignments(): Promise<number> {
    const [result] = await this.db.select({ count: sql`count(*)` }).from(enrollments).where(isNull(enrollments.completedAt));
    return Number(result.count) || 0;
  }

  async getCertificatesIssued(): Promise<number> {
    const [result] = await this.db.select({ count: sql`count(*)` }).from(certificates);
    return Number(result.count) || 0;
  }
}

export const storage = new DatabaseStorage(db);