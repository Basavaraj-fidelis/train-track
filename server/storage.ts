
import { db } from "./db";
import {
  users,
  courses,
  enrollments,
  quizzes,
  certificates,
  type User,
  type Course,
  type Enrollment,
  type Quiz,
  type Certificate,
  type InsertUser,
  type InsertCourse,
  type InsertEnrollment,
  type InsertQuiz,
  type InsertCertificate,
} from "@shared/schema";
import { eq, and, sql, desc, asc, isNull, or, lt, gte, count, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";

export class Storage {
  // User management
  async createUser(userData: InsertUser): Promise<User> {
    // Generate employee ID if not provided
    if (!userData.employeeId) {
      const lastUser = await db
        .select()
        .from(users)
        .where(sql`employee_id IS NOT NULL`)
        .orderBy(desc(users.createdAt))
        .limit(1);
      
      const lastId = lastUser[0]?.employeeId?.match(/\d+$/)?.[0] || "0";
      userData.employeeId = `EMP${String(parseInt(lastId) + 1).padStart(3, "0")}`;
    }

    if (userData.password) {
      userData.password = await bcrypt.hash(userData.password, 10);
    }

    const [newUser] = await db.insert(users).values(userData).returning();
    return newUser;
  }

  async getUser(id: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || null;
  }

  async getUserByEmployeeId(employeeId: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.employeeId, employeeId));
    return user || null;
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User | null> {
    if (userData.password) {
      userData.password = await bcrypt.hash(userData.password, 10);
    }

    const [updatedUser] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return updatedUser || null;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.rowCount > 0;
  }

  async getAllEmployees(): Promise<User[]> {
    return db.select().from(users).where(eq(users.role, "employee")).orderBy(asc(users.name));
  }

  async deactivateEmployees(employeeIds: string[]): Promise<number> {
    const result = await db
      .update(users)
      .set({ isActive: false })
      .where(inArray(users.id, employeeIds));
    return result.rowCount;
  }

  // Course management
  async createCourse(courseData: InsertCourse & { questions?: any[]; courseType?: string }): Promise<Course> {
    const courseToInsert: InsertCourse = {
      title: courseData.title,
      description: courseData.description,
      videoPath: courseData.videoPath,
      duration: courseData.duration || 0,
      createdBy: courseData.createdBy,
      courseType: courseData.courseType as "recurring" | "one-time" || "one-time",
      defaultDeadlineDays: courseData.defaultDeadlineDays || 30,
      reminderDays: courseData.reminderDays || 7,
    };

    const [newCourse] = await db.insert(courses).values(courseToInsert).returning();

    // Create quiz if questions are provided
    if (courseData.questions && courseData.questions.length > 0) {
      await this.createQuiz({
        courseId: newCourse.id,
        title: `${newCourse.title} Quiz`,
        questions: courseData.questions,
        passingScore: 70,
      });
    }

    return newCourse;
  }

  async getCourse(id: string): Promise<Course | null> {
    const [course] = await db.select().from(courses).where(eq(courses.id, id));
    return course || null;
  }

  async getAllCourses(): Promise<Course[]> {
    return db.select().from(courses).where(eq(courses.isActive, true)).orderBy(desc(courses.createdAt));
  }

  async updateCourse(id: string, courseData: Partial<InsertCourse & { questions?: any[] }>): Promise<Course | null> {
    const updateData: Partial<InsertCourse> = { ...courseData };
    delete (updateData as any).questions;

    const [updatedCourse] = await db
      .update(courses)
      .set(updateData)
      .where(eq(courses.id, id))
      .returning();

    // Update quiz if questions are provided
    if (courseData.questions) {
      const existingQuiz = await this.getQuizByCourseId(id);
      if (existingQuiz) {
        await this.updateQuiz(existingQuiz.id, {
          courseId: id,
          title: existingQuiz.title,
          questions: courseData.questions,
          passingScore: existingQuiz.passingScore,
        });
      } else {
        await this.createQuiz({
          courseId: id,
          title: `${updatedCourse.title} Quiz`,
          questions: courseData.questions,
          passingScore: 70,
        });
      }
    }

    return updatedCourse || null;
  }

  async deleteCourse(id: string): Promise<boolean> {
    // Soft delete by marking as inactive
    const result = await db
      .update(courses)
      .set({ isActive: false })
      .where(eq(courses.id, id));
    return result.rowCount > 0;
  }

  async autoEnrollInComplianceCourses(employeeIdentifier: string): Promise<void> {
    // Get compliance courses that auto-enroll new employees
    const complianceCourses = await db
      .select()
      .from(courses)
      .where(
        and(
          eq(courses.isComplianceCourse, true),
          eq(courses.isAutoEnrollNewEmployees, true),
          eq(courses.isActive, true)
        )
      );

    // Get user
    let user = await this.getUserByEmail(employeeIdentifier);
    if (!user) {
      user = await this.getUserByEmployeeId(employeeIdentifier);
    }

    if (!user || complianceCourses.length === 0) {
      return;
    }

    // Enroll in each compliance course
    for (const course of complianceCourses) {
      const existingEnrollment = await this.getEnrollment(user.id, course.id);
      if (!existingEnrollment) {
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + (course.defaultDeadlineDays || 30));

        await this.createEnrollment({
          userId: user.id,
          courseId: course.id,
          deadline,
          status: "pending",
        });
      }
    }
  }

  // Quiz management
  async createQuiz(quizData: InsertQuiz): Promise<Quiz> {
    const [newQuiz] = await db.insert(quizzes).values(quizData).returning();
    return newQuiz;
  }

  async getQuiz(id: string): Promise<Quiz | null> {
    const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, id));
    return quiz || null;
  }

  async getQuizByCourseId(courseId: string): Promise<Quiz | null> {
    const [quiz] = await db.select().from(quizzes).where(eq(quizzes.courseId, courseId));
    return quiz || null;
  }

  async updateQuiz(id: string, quizData: Partial<InsertQuiz>): Promise<Quiz | null> {
    const [updatedQuiz] = await db
      .update(quizzes)
      .set(quizData)
      .where(eq(quizzes.id, id))
      .returning();
    return updatedQuiz || null;
  }

  async deleteQuiz(id: string): Promise<boolean> {
    const result = await db.delete(quizzes).where(eq(quizzes.id, id));
    return result.rowCount > 0;
  }

  // Enrollment management
  async createEnrollment(enrollmentData: InsertEnrollment): Promise<Enrollment> {
    // Generate assignment token if assigning by email
    if (enrollmentData.assignedEmail && !enrollmentData.userId) {
      enrollmentData.assignmentToken = randomBytes(32).toString('hex');
    }

    const [newEnrollment] = await db.insert(enrollments).values(enrollmentData).returning();
    return newEnrollment;
  }

  async getEnrollment(userId: string, courseId: string): Promise<Enrollment | null> {
    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)));
    return enrollment || null;
  }

  async getEnrollmentByToken(token: string): Promise<Enrollment | null> {
    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(eq(enrollments.assignmentToken, token));
    return enrollment || null;
  }

  async updateEnrollment(id: string, enrollmentData: Partial<InsertEnrollment>): Promise<Enrollment | null> {
    const [updatedEnrollment] = await db
      .update(enrollments)
      .set(enrollmentData)
      .where(eq(enrollments.id, id))
      .returning();
    return updatedEnrollment || null;
  }

  async deleteEnrollment(id: string): Promise<boolean> {
    const result = await db.delete(enrollments).where(eq(enrollments.id, id));
    return result.rowCount > 0;
  }

  async getUserEnrollments(userId: string): Promise<any[]> {
    return db
      .select({
        id: enrollments.id,
        enrolledAt: enrollments.enrolledAt,
        completedAt: enrollments.completedAt,
        progress: enrollments.progress,
        quizScore: enrollments.quizScore,
        certificateIssued: enrollments.certificateIssued,
        deadline: enrollments.deadline,
        status: enrollments.status,
        expiresAt: enrollments.expiresAt,
        isExpired: enrollments.isExpired,
        course: {
          id: courses.id,
          title: courses.title,
          description: courses.description,
          duration: courses.duration,
          videoPath: courses.videoPath,
          courseType: courses.courseType,
          renewalPeriodMonths: courses.renewalPeriodMonths,
        },
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(eq(enrollments.userId, userId))
      .orderBy(desc(enrollments.enrolledAt));
  }

  async getAllEnrollments(): Promise<any[]> {
    return db
      .select({
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
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          employeeId: users.employeeId,
        },
        course: {
          id: courses.id,
          title: courses.title,
          description: courses.description,
        },
      })
      .from(enrollments)
      .leftJoin(users, eq(enrollments.userId, users.id))
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .orderBy(desc(enrollments.enrolledAt));
  }

  async getCourseEnrollments(courseId: string): Promise<any[]> {
    return db
      .select({
        id: enrollments.id,
        enrolledAt: enrollments.enrolledAt,
        completedAt: enrollments.completedAt,
        progress: enrollments.progress,
        quizScore: enrollments.quizScore,
        certificateIssued: enrollments.certificateIssued,
        deadline: enrollments.deadline,
        status: enrollments.status,
        assignedEmail: enrollments.assignedEmail,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          employeeId: users.employeeId,
          department: users.department,
        },
      })
      .from(enrollments)
      .leftJoin(users, eq(enrollments.userId, users.id))
      .where(eq(enrollments.courseId, courseId))
      .orderBy(desc(enrollments.enrolledAt));
  }

  // Certificate management
  async createCertificate(certificateData: InsertCertificate): Promise<Certificate> {
    const [newCertificate] = await db.insert(certificates).values(certificateData).returning();
    return newCertificate;
  }

  async getUserCertificates(userId: string): Promise<any[]> {
    return db
      .select({
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
          renewalPeriodMonths: courses.renewalPeriodMonths,
        },
      })
      .from(certificates)
      .innerJoin(courses, eq(certificates.courseId, courses.id))
      .where(eq(certificates.userId, userId))
      .orderBy(desc(certificates.issuedAt));
  }

  async getUserCertificateForCourse(userId: string, courseId: string): Promise<Certificate | null> {
    const [certificate] = await db
      .select()
      .from(certificates)
      .where(and(eq(certificates.userId, userId), eq(certificates.courseId, courseId)));
    return certificate || null;
  }

  async getAllCertificates(): Promise<any[]> {
    return db
      .select({
        id: certificates.id,
        issuedAt: certificates.issuedAt,
        certificateData: certificates.certificateData,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          employeeId: users.employeeId,
        },
        course: {
          id: courses.id,
          title: courses.title,
        },
      })
      .from(certificates)
      .innerJoin(users, eq(certificates.userId, users.id))
      .innerJoin(courses, eq(certificates.courseId, courses.id))
      .orderBy(desc(certificates.issuedAt));
  }

  async updateCertificate(id: string, certificateData: Partial<InsertCertificate>): Promise<Certificate | null> {
    const [updatedCertificate] = await db
      .update(certificates)
      .set(certificateData)
      .where(eq(certificates.id, id))
      .returning();
    return updatedCertificate || null;
  }

  async deleteCertificate(id: string): Promise<boolean> {
    const result = await db.delete(certificates).where(eq(certificates.id, id));
    return result.rowCount > 0;
  }

  // Bulk operations
  async bulkAssignCourse(courseId: string, userIds: string[]): Promise<Enrollment[]> {
    const course = await this.getCourse(courseId);
    if (!course) throw new Error("Course not found");

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + (course.defaultDeadlineDays || 30));

    const enrollmentPromises = userIds.map(userId =>
      this.createEnrollment({
        userId,
        courseId,
        deadline,
        status: "pending",
      }).catch(() => null) // Ignore duplicates
    );

    const results = await Promise.all(enrollmentPromises);
    return results.filter(Boolean) as Enrollment[];
  }

  async bulkAssignUsers(userIds: string[], courseIds: string[]): Promise<Enrollment[]> {
    const enrollments: Enrollment[] = [];

    for (const courseId of courseIds) {
      const course = await this.getCourse(courseId);
      if (!course) continue;

      const deadline = new Date();
      deadline.setDate(deadline.getDate() + (course.defaultDeadlineDays || 30));

      for (const userId of userIds) {
        try {
          const enrollment = await this.createEnrollment({
            userId,
            courseId,
            deadline,
            status: "pending",
          });
          enrollments.push(enrollment);
        } catch {
          // Ignore duplicates
        }
      }
    }

    return enrollments;
  }

  async bulkAssignCourseByEmail(courseId: string, emails: string[], deadlineDays: number = 30): Promise<any[]> {
    const course = await this.getCourse(courseId);
    if (!course) throw new Error("Course not found");

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + deadlineDays);

    const assignments = [];

    for (const email of emails) {
      try {
        const assignment = await this.createEnrollment({
          courseId,
          assignedEmail: email,
          deadline,
          status: "pending",
          assignmentToken: randomBytes(32).toString('hex'),
        });

        assignments.push({
          ...assignment,
          assignedEmail: email,
          deadline,
        });
      } catch (error) {
        console.error(`Failed to assign course to ${email}:`, error);
      }
    }

    return assignments;
  }

  // Dashboard and analytics
  async getDashboardStats(): Promise<any> {
    const [
      totalEmployeesResult,
      activeCoursesResult,
      pendingAssignmentsResult,
      certificatesIssuedResult,
    ] = await Promise.all([
      db.select({ count: count() }).from(users).where(eq(users.role, "employee")),
      db.select({ count: count() }).from(courses).where(eq(courses.isActive, true)),
      db.select({ count: count() }).from(enrollments).where(eq(enrollments.status, "pending")),
      db.select({ count: count() }).from(certificates),
    ]);

    return {
      totalEmployees: totalEmployeesResult[0]?.count || 0,
      activeCourses: activeCoursesResult[0]?.count || 0,
      pendingAssignments: pendingAssignmentsResult[0]?.count || 0,
      certificatesIssued: certificatesIssuedResult[0]?.count || 0,
    };
  }

  async getUserAnalytics(userId: string): Promise<any> {
    const [
      enrollmentCount,
      completedCount,
      certificateCount,
      averageScore,
    ] = await Promise.all([
      db.select({ count: count() }).from(enrollments).where(eq(enrollments.userId, userId)),
      db.select({ count: count() }).from(enrollments).where(and(eq(enrollments.userId, userId), eq(enrollments.certificateIssued, true))),
      db.select({ count: count() }).from(certificates).where(eq(certificates.userId, userId)),
      db.select({ avg: sql<number>`AVG(${enrollments.quizScore})` }).from(enrollments).where(and(eq(enrollments.userId, userId), sql`${enrollments.quizScore} IS NOT NULL`)),
    ]);

    return {
      totalEnrollments: enrollmentCount[0]?.count || 0,
      completedCourses: completedCount[0]?.count || 0,
      certificatesEarned: certificateCount[0]?.count || 0,
      averageQuizScore: Math.round(averageScore[0]?.avg || 0),
    };
  }

  // Compliance and reporting
  async getComplianceReport(): Promise<any> {
    // Get all active employees and their compliance status
    const employees = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        employeeId: users.employeeId,
        department: users.department,
      })
      .from(users)
      .where(and(eq(users.role, "employee"), eq(users.isActive, true)));

    const complianceCourses = await db
      .select()
      .from(courses)
      .where(and(eq(courses.isComplianceCourse, true), eq(courses.isActive, true)));

    const complianceData = [];

    for (const employee of employees) {
      const enrollments = await this.getUserEnrollments(employee.id);
      const complianceEnrollments = enrollments.filter(e => 
        complianceCourses.some(c => c.id === e.course.id)
      );

      const compliantCount = complianceEnrollments.filter(e => 
        e.certificateIssued && (!e.isExpired || e.course.courseType === 'one-time')
      ).length;

      complianceData.push({
        ...employee,
        totalComplianceCourses: complianceCourses.length,
        compliantCourses: compliantCount,
        complianceRate: complianceCourses.length > 0 ? Math.round((compliantCount / complianceCourses.length) * 100) : 100,
        isCompliant: compliantCount === complianceCourses.length,
      });
    }

    return {
      employees: complianceData,
      overallComplianceRate: complianceData.length > 0 
        ? Math.round(complianceData.reduce((sum, emp) => sum + emp.complianceRate, 0) / complianceData.length)
        : 100,
    };
  }

  async renewExpiredCertifications(courseId: string, userIds: string[]): Promise<Enrollment[]> {
    const renewedEnrollments = [];

    for (const userId of userIds) {
      // Check if user has expired certification for this course
      const enrollment = await this.getEnrollment(userId, courseId);
      if (enrollment && enrollment.isExpired) {
        const course = await this.getCourse(courseId);
        if (!course) continue;

        const deadline = new Date();
        deadline.setDate(deadline.getDate() + (course.defaultDeadlineDays || 30));

        // Reset enrollment for renewal
        const renewed = await this.updateEnrollment(enrollment.id, {
          isExpired: false,
          progress: 0,
          quizScore: null,
          certificateIssued: false,
          completedAt: null,
          deadline,
          status: "pending",
          renewalCount: (enrollment.renewalCount || 0) + 1,
        });

        if (renewed) {
          renewedEnrollments.push(renewed);
        }
      }
    }

    return renewedEnrollments;
  }

  // Assignment tracking
  async getCourseAssignments(courseId: string): Promise<any[]> {
    return db
      .select({
        id: enrollments.id,
        assignedEmail: enrollments.assignedEmail,
        assignmentToken: enrollments.assignmentToken,
        deadline: enrollments.deadline,
        status: enrollments.status,
        progress: enrollments.progress,
        certificateIssued: enrollments.certificateIssued,
        remindersSent: enrollments.remindersSent,
        enrolledAt: enrollments.enrolledAt,
        completedAt: enrollments.completedAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          employeeId: users.employeeId,
        },
      })
      .from(enrollments)
      .leftJoin(users, eq(enrollments.userId, users.id))
      .where(eq(enrollments.courseId, courseId))
      .orderBy(desc(enrollments.enrolledAt));
  }

  async incrementReminderCount(enrollmentId: string): Promise<void> {
    await db
      .update(enrollments)
      .set({ remindersSent: sql`${enrollments.remindersSent} + 1` })
      .where(eq(enrollments.id, enrollmentId));
  }

  async getTotalRemindersSent(): Promise<number> {
    const [result] = await db
      .select({ total: sql<number>`SUM(${enrollments.remindersSent})` })
      .from(enrollments);
    return result?.total || 0;
  }

  async cleanupExpiredAssignments(): Promise<number> {
    const result = await db
      .update(enrollments)
      .set({ status: "expired", isExpired: true })
      .where(
        and(
          lt(enrollments.deadline, new Date()),
          eq(enrollments.status, "pending")
        )
      );
    return result.rowCount;
  }

  async resetReminderData(): Promise<number> {
    // Reset reminder counts for assignments older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await db
      .update(enrollments)
      .set({ remindersSent: 0 })
      .where(
        and(
          lt(enrollments.enrolledAt, thirtyDaysAgo),
          gte(enrollments.remindersSent, 1)
        )
      );
    return result.rowCount;
  }
}

export const storage = new Storage();
