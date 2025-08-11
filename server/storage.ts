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
import { v4 as uuidv4 } from 'uuid';

// Define the interface for course creation data, now including youtubeUrl
interface CreateCourseData {
  title: string;
  description: string;
  youtubeUrl: string; // Changed from videoPath
  courseType?: 'one-time' | 'recurring';
  duration?: number;
  createdBy: string;
  defaultDeadlineDays?: number;
  reminderDays?: number;
}

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
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0] || null;
  }

  async getUserByResetToken(token: string): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.resetToken, token)).limit(1);
    return result[0] || null;
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
    // First delete all related certificates
    await db.delete(certificates).where(eq(certificates.userId, id));

    // Then delete all related enrollments
    await db.delete(enrollments).where(eq(enrollments.userId, id));

    // Finally delete the user
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
  async createCourse(courseData: InsertCourse & { questions?: any[]; courseType?: string, youtubeUrl?: string }): Promise<Course> {
    // Determine the video path - prioritize youtubeUrl over videoPath
    let finalVideoPath = '';
    if (courseData.youtubeUrl && courseData.youtubeUrl.trim()) {
      finalVideoPath = courseData.youtubeUrl.trim();
    } else if (courseData.videoPath && courseData.videoPath.trim()) {
      finalVideoPath = courseData.videoPath.trim();
    }

    const courseToInsert: InsertCourse = {
      title: courseData.title,
      description: courseData.description,
      videoPath: finalVideoPath, // Store YouTube URL or video file path
      duration: courseData.duration || 0,
      createdBy: courseData.createdBy || 'admin',
      courseType: courseData.courseType as "recurring" | "one-time" || "one-time",
      defaultDeadlineDays: courseData.defaultDeadlineDays || 30,
      reminderDays: courseData.reminderDays || 7,
    };

    console.log('Creating course with video path:', finalVideoPath);

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

    console.log('Course created successfully:', {
      id: newCourse.id,
      title: newCourse.title,
      videoPath: newCourse.videoPath
    });

    return newCourse;
  }

  async getCourse(id: string): Promise<Course | null> {
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, id));

    console.log('Retrieved course data for ID:', id);
    console.log('Course details:', {
      id: course?.id,
      title: course?.title,
      videoPath: course?.videoPath,
      hasVideoPath: !!course?.videoPath
    });
    return course || null;
  }

  async getAllCourses(): Promise<Course[]> {
    return db.select().from(courses).where(eq(courses.isActive, true)).orderBy(desc(courses.createdAt));
  }

  async updateCourse(id: string, courseData: Partial<InsertCourse & { questions?: any[]; youtubeUrl?: string }>): Promise<Course | null> {
    const updateData: Partial<InsertCourse> = { ...courseData };

    // Handle video path update - prioritize youtubeUrl
    if (courseData.youtubeUrl !== undefined) {
      updateData.videoPath = courseData.youtubeUrl.trim() || '';
      delete (updateData as any).youtubeUrl; // Remove from the set of fields to update
    }

    // Remove questions from update data as it's handled separately
    delete (updateData as any).questions;

    console.log(`Updating course ${id} with video path:`, updateData.videoPath);

    const [updatedCourse] = await db
      .update(courses)
      .set(updateData)
      .where(eq(courses.id, id))
      .returning();

    if (!updatedCourse) {
      console.error(`Failed to update course with id: ${id}`);
      return null;
    }

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

    console.log('Course updated successfully:', {
      id: updatedCourse.id,
      title: updatedCourse.title,
      videoPath: updatedCourse.videoPath
    });

    return updatedCourse;
  }

  async deleteCourse(id: string): Promise<boolean> {
    try {
      // Start a transaction to ensure data consistency
      return await db.transaction(async (tx) => {
        // Get all users enrolled in this course
        const enrolledUsers = await tx
          .select({
            userId: enrollments.userId,
          })
          .from(enrollments)
          .where(eq(enrollments.courseId, id));

        // For each enrolled user, check if they have other enrollments
        const usersToDelete: string[] = [];
        for (const enrollment of enrolledUsers) {
          if (enrollment.userId) {
            // Count other enrollments for this user (excluding the course being deleted)
            const otherEnrollmentsCount = await tx
              .select({ count: count() })
              .from(enrollments)
              .where(
                and(
                  eq(enrollments.userId, enrollment.userId),
                  sql`${enrollments.courseId} != ${id}`
                )
              );

            // If user has no other enrollments, mark for deletion
            if ((otherEnrollmentsCount[0]?.count || 0) === 0) {
              usersToDelete.push(enrollment.userId);
            }
          }
        }

        // Delete certificates related to this course
        await tx.delete(certificates).where(eq(certificates.courseId, id));

        // Delete enrollments related to this course
        await tx.delete(enrollments).where(eq(enrollments.courseId, id));

        // Delete quizzes related to this course
        await tx.delete(quizzes).where(eq(quizzes.courseId, id));

        // Delete users who were only enrolled in this course
        if (usersToDelete.length > 0) {
          await tx.delete(users).where(inArray(users.id, usersToDelete));
        }

        // Finally, delete the course itself (hard delete)
        const result = await tx.delete(courses).where(eq(courses.id, id));

        return result.rowCount > 0;
      });
    } catch (error) {
      console.error('Error during course deletion:', error);
      throw new Error('Failed to delete course and related data');
    }
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
    const [quiz] = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.courseId, courseId));
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

  async deleteQuizByCourseId(courseId: string): Promise<boolean> {
    const result = await db.delete(quizzes).where(eq(quizzes.courseId, courseId));
    return result.rowCount > 0;
  }

  async addQuizToCourse(courseId: string, quizData: Omit<InsertQuiz, 'courseId'>): Promise<Quiz> {
    // Check if a quiz already exists for this course
    const existingQuiz = await this.getQuizByCourseId(courseId);

    if (existingQuiz) {
      // Update existing quiz
      const updatedQuiz = await this.updateQuiz(existingQuiz.id, {
        ...quizData,
        courseId
      });
      return updatedQuiz!;
    } else {
      // Create new quiz
      return this.createQuiz({
        ...quizData,
        courseId
      });
    }
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
    const enrollmentsList = await db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
      .limit(1);

    return enrollmentsList[0] || null;
  }

  async getEnrollmentById(userId: string, enrollmentId: string): Promise<Enrollment | null> {
    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.id, enrollmentId), eq(enrollments.userId, userId)));
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
    try {
      const results = await db
        .select({
          // Enrollment fields
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
          lastAccessedAt: enrollments.completedAt,
          // Course fields
          courseId2: courses.id,
          courseTitle: courses.title,
          courseDescription: courses.description,
          courseDuration: courses.duration,
          courseVideoPath: courses.videoPath,
          courseType: courses.courseType,
          courseRenewalPeriodMonths: courses.renewalPeriodMonths,
          courseIsComplianceCourse: courses.isComplianceCourse,
          courseIsActive: courses.isActive,
        })
        .from(enrollments)
        .leftJoin(courses, eq(enrollments.courseId, courses.id))
        .where(and(
          eq(enrollments.userId, userId),
          eq(courses.isActive, true) // Only active courses
        ))
        .orderBy(enrollments.enrolledAt);

      return results.map(enrollment => ({
        id: enrollment.id,
        userId: enrollment.userId,
        courseId: enrollment.courseId,
        enrolledAt: enrollment.enrolledAt,
        completedAt: enrollment.completedAt,
        progress: enrollment.progress || 0,
        quizScore: enrollment.quizScore,
        certificateIssued: enrollment.certificateIssued || false,
        expiresAt: enrollment.expiresAt,
        isExpired: enrollment.isExpired || false,
        renewalCount: enrollment.renewalCount || 0,
        assignedEmail: enrollment.assignedEmail,
        assignmentToken: enrollment.assignmentToken,
        deadline: enrollment.deadline,
        status: enrollment.status || 'pending',
        remindersSent: enrollment.remindersSent || 0,
        lastAccessedAt: enrollment.lastAccessedAt || enrollment.enrolledAt,
        course: enrollment.courseId2 ? {
          id: enrollment.courseId2,
          title: enrollment.courseTitle,
          description: enrollment.courseDescription,
          duration: enrollment.courseDuration || 0,
          videoPath: enrollment.courseVideoPath,
          courseType: enrollment.courseType,
          renewalPeriodMonths: enrollment.courseRenewalPeriodMonths,
          isComplianceCourse: enrollment.courseIsComplianceCourse,
          isActive: enrollment.courseIsActive,
        } : null,
      })).filter(enrollment => enrollment.course); // Filter out enrollments without valid courses
    } catch (error) {
      console.error('Database error in getUserEnrollments:', error);
      return [];
    }
  }

  async getUserActiveEnrollments(userId: string): Promise<Enrollment[]> {
    const enrollmentsData = await db
      .select({
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
        lastAccessedAt: sql<Date>`${enrollments.completedAt}`.as('lastAccessedAt'),
        // Separate course fields instead of nested object
        courseId2: courses.id,
        courseTitle: courses.title,
        courseDescription: courses.description,
        courseDuration: courses.duration,
        courseType: courses.courseType,
        courseRenewalPeriodMonths: courses.renewalPeriodMonths,
        courseIsComplianceCourse: courses.isComplianceCourse,
      })
      .from(enrollments)
      .leftJoin(courses, eq(enrollments.courseId, courses.id))
      .where(and(
        eq(enrollments.userId, userId),
        eq(courses.isActive, true) // Only check enrollments for active courses
      ))
      .orderBy(enrollments.enrolledAt);

    return enrollmentsData.map(enrollment => ({
      ...enrollment,
      lastAccessedAt: enrollment.completedAt || enrollment.enrolledAt,
      course: enrollment.courseId2 ? {
        id: enrollment.courseId2,
        title: enrollment.courseTitle,
        description: enrollment.courseDescription,
        duration: enrollment.courseDuration,
        courseType: enrollment.courseType,
        renewalPeriodMonths: enrollment.courseRenewalPeriodMonths,
        isComplianceCourse: enrollment.isComplianceCourse,
      } : null,
    }));
  }

  async getAllEnrollments(): Promise<any[]> {
    const enrollmentsData = await db
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
        // Separate user fields
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
        userEmployeeId: users.employeeId,
        userClientName: users.clientName,
        // Separate course fields
        courseId: courses.id,
        courseTitle: courses.title,
        courseDescription: courses.description,
        courseDuration: courses.duration,
        courseType: courses.courseType,
      })
      .from(enrollments)
      .leftJoin(users, eq(enrollments.userId, users.id))
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(eq(courses.isActive, true)) // Only active courses
      .orderBy(desc(enrollments.enrolledAt));

    return enrollmentsData.map(enrollment => ({
      id: enrollment.id,
      userId: enrollment.userId,
      courseId: enrollment.courseId,
      enrolledAt: enrollment.enrolledAt,
      completedAt: enrollment.completedAt,
      progress: enrollment.progress || 0,
      quizScore: enrollment.quizScore,
      certificateIssued: enrollment.certificateIssued || false,
      deadline: enrollment.deadline,
      status: enrollment.status,
      assignedEmail: enrollment.assignedEmail,
      remindersSent: enrollment.remindersSent || 0,
      user: enrollment.userId ? {
        id: enrollment.userId,
        name: enrollment.userName,
        email: enrollment.userEmail,
        employeeId: enrollment.userEmployeeId,
        clientName: enrollment.userClientName,
      } : null,
      course: {
        id: enrollment.courseId,
        title: enrollment.courseTitle,
        description: enrollment.courseDescription,
        duration: enrollment.courseDuration || 0,
        courseType: enrollment.courseType,
      },
    }));
  }

  async getCourseEnrollments(courseId: string): Promise<any[]> {
    try {
      const enrollmentsData = await db
        .select({
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
          userIdFromTable: users.id,
        })
        .from(enrollments)
        .leftJoin(users, eq(enrollments.userId, users.id))
        .where(eq(enrollments.courseId, courseId));

      // Transform the flat structure back to nested for compatibility
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
            assignedEmail: enrollment.assignedEmail || '',
            user: enrollment.userIdFromTable ? {
              id: enrollment.userIdFromTable,
              name: enrollment.userName || 'Not registered',
              email: enrollment.userEmail || enrollment.assignedEmail || '',
              department: enrollment.userDepartment || 'N/A',
              clientName: enrollment.userClientName || 'N/A',
            } : null,
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

  async getCertificate(certificateId: string): Promise<Certificate | null> {
    const result = await db
      .select()
      .from(certificates)
      .where(eq(certificates.id, certificateId))
      .limit(1);
    return result[0] || null;
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
    try {
      console.log(`Fetching assignments for course: ${courseId}`);

      // First, let's check if the course exists
      const courseExists = await db
        .select({ id: courses.id, title: courses.title })
        .from(courses)
        .where(eq(courses.id, courseId))
        .limit(1);

      console.log(`Course exists check:`, courseExists);

      // Check if there are any enrollments for this course at all
      const enrollmentCount = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(enrollments)
        .where(eq(enrollments.courseId, courseId));

      console.log(`Total enrollments for course ${courseId}:`, enrollmentCount[0]?.count || 0);

      const result = await db
        .select({
          // Enrollment fields
          enrollmentId: enrollments.id,
          enrollmentCourseId: enrollments.courseId,
          enrollmentUserId: enrollments.userId,
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
          lastAccessedAt: sql<Date | null>`COALESCE(${enrollments.completedAt}, ${enrollments.enrolledAt})`.as('lastAccessedAt'),
          // User fields
          userId: users.id,
          userName: users.name,
          userEmail: users.email,
          userDepartment: users.department,
          userClientName: users.clientName,
        })
        .from(enrollments)
        .leftJoin(users, eq(enrollments.userId, users.id))
        .where(eq(enrollments.courseId, courseId))
        .orderBy(desc(enrollments.enrolledAt));

      console.log(`Raw query result count: ${result.length}`);

      // Log the raw result for debugging
      if (result.length === 0) {
        console.log(`No enrollments found for course ${courseId}. Let's check what courses do exist:`);
        const allCourses = await db.select({ id: courses.id, title: courses.title }).from(courses).limit(5);
        console.log(`Sample courses in database:`, allCourses);

        const allEnrollments = await db.select({
          id: enrollments.id,
          courseId: enrollments.courseId
        }).from(enrollments).limit(5);
        console.log(`Sample enrollments in database:`, allEnrollments);
      }

      // Transform the data to handle the user relation properly
      const transformedData = result.map((row, index) => {
        try {
          return {
            id: row.enrollmentId || `temp-${Date.now()}-${index}`,
            courseId: row.enrollmentCourseId || courseId,
            userId: row.enrollmentUserId || null,
            assignedEmail: row.assignedEmail || '',
            enrolledAt: row.enrolledAt || null,
            progress: Math.max(0, Math.min(100, Number(row.progress) || 0)),
            quizScore: row.quizScore ? Number(row.quizScore) : null,
            certificateIssued: Boolean(row.certificateIssued),
            remindersSent: Math.max(0, Number(row.remindersSent) || 0),
            deadline: row.deadline || null,
            status: row.status || 'pending',
            completedAt: row.completedAt || null,
            assignmentToken: row.assignmentToken || null,
            lastAccessedAt: row.lastAccessedAt || null,
            user: row.userId ? {
              id: row.userId,
              name: row.userName || 'Not registered',
              email: row.userEmail || row.assignedEmail || '',
              department: row.userDepartment || 'N/A',
              clientName: row.userClientName || 'N/A',
            } : null,
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

  async incrementReminderCount(enrollmentId: string): Promise<void> {
    await db
      .update(enrollments)
      .set({ remindersSent: sql`${enrollments.remindersSent} + 1` })
      .where(eq(enrollments.id, enrollmentId));
  }

  async getTotalRemindersSent(): Promise<number> {
    const result = await db
      .select({ total: sql<number>`SUM(${enrollments.remindersSent})` })
      .from(enrollments);

    return result[0]?.total || 0;
  }

  // Fix progress for enrollments that have certificates but progress < 100%
  async fixCompletedCourseProgress() {
    const enrollmentsToFix = await db
      .select()
      .from(enrollments)
      .where(and(
        eq(enrollments.certificateIssued, true),
        lt(enrollments.progress, 100)
      ));

    let fixedCount = 0;
    for (const enrollment of enrollmentsToFix) {
      await db
        .update(enrollments)
        .set({
          progress: 100,
          status: "completed"
        })
        .where(eq(enrollments.id, enrollment.id));
      fixedCount++;
    }

    return fixedCount;
  }

  async getCourseDeletionImpact(courseId: string): Promise<{
    course: Course | null;
    totalEnrollments: number;
    usersToDelete: User[];
    usersToKeep: User[];
    certificatesCount: number;
    quizzesCount: number;
  }> {
    const course = await this.getCourse(courseId);
    if (!course) {
      return {
        course: null,
        totalEnrollments: 0,
        usersToDelete: [],
        usersToKeep: [],
        certificatesCount: 0,
        quizzesCount: 0,
      };
    }

    // Get all enrollments for this course
    const courseEnrollments = await this.getCourseEnrollments(courseId);
    const enrolledUserIds = [...new Set(courseEnrollments.map(e => e.user?.id).filter(Boolean))];

    const usersToDelete: User[] = [];
    const usersToKeep: User[] = [];

    // Check each user's other enrollments
    for (const userId of enrolledUserIds) {
      if (userId) {
        const user = await this.getUser(userId);
        const userEnrollments = await this.getUserEnrollments(userId);
        const otherCoursesCount = userEnrollments.filter(e => e.courseId !== courseId).length;

        if (otherCoursesCount === 0 && user) {
          usersToDelete.push(user);
        } else if (user) {
          usersToKeep.push(user);
        }
      }
    }

    // Count certificates and quizzes
    const [certificatesResult, quizzesResult] = await Promise.all([
      db.select({ count: count() }).from(certificates).where(eq(certificates.courseId, courseId)),
      db.select({ count: count() }).from(quizzes).where(eq(quizzes.courseId, courseId)),
    ]);

    return {
      course,
      totalEnrollments: courseEnrollments.length,
      usersToDelete,
      usersToKeep,
      certificatesCount: certificatesResult[0]?.count || 0,
      quizzesCount: quizzesResult[0]?.count || 0,
    };
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

  // Password reset token methods
  async createPasswordResetToken(tokenData: { userId: string; token: string; expiresAt: Date }): Promise<void> {
    // Update user with reset token and expiry
    await db
      .update(users)
      .set({
        resetToken: tokenData.token,
        resetTokenExpiry: tokenData.expiresAt
      })
      .where(eq(users.id, tokenData.userId));
  }

  async getPasswordResetToken(token: string): Promise<{ userId: string; expiresAt: Date } | null> {
    const [user] = await db
      .select({
        id: users.id,
        resetTokenExpiry: users.resetTokenExpiry
      })
      .from(users)
      .where(eq(users.resetToken, token));

    if (!user || !user.resetTokenExpiry) {
      return null;
    }

    return {
      userId: user.id,
      expiresAt: user.resetTokenExpiry
    };
  }

  async deletePasswordResetToken(token: string): Promise<void> {
    await db
      .update(users)
      .set({
        resetToken: null,
        resetTokenExpiry: null
      })
      .where(eq(users.resetToken, token));
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId));
  }
}

export const storage = new Storage();