import {
  users, courses, quizzes, enrollments, certificates,
  type User, type InsertUser, type Course, type InsertCourse,
  type Quiz, type InsertQuiz, type Enrollment, type InsertEnrollment,
  type Certificate, type InsertCertificate
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, isNull } from "drizzle-orm";
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

  // Dashboard statistics
  getDashboardStats(): Promise<{
    totalEmployees: number;
    activeCourses: number;
    pendingAssignments: number;
    certificatesIssued: number;
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

  async createCertificate(insertCertificate: InsertCertificate): Promise<Certificate> {
    const [certificate] = await this.db
      .insert(certificates)
      .values(insertCertificate)
      .returning();
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
        sql`${enrollments.userId} = ANY(ARRAY[${userIds.map(id => `'${id}'`).join(',')}])`
      ));

    const existingUserIds = new Set(existingEnrollments.map(e => e.userId));
    const newUserIds = userIds.filter(userId => !existingUserIds.has(userId));

    if (newUserIds.length === 0) {
      throw new Error("All selected users are already enrolled in this course");
    }

    const enrollmentData = newUserIds.map(userId => ({
      userId,
      courseId,
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
          sql`${enrollments.userId} = ANY(ARRAY[${userIds.map(id => `'${id}'`).join(',')}])`,
          sql`${enrollments.courseId} = ANY(ARRAY[${courseIds.map(id => `'${id}'`).join(',')}])`
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
}

export const storage = new DatabaseStorage(db);