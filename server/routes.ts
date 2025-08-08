import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertCourseSchema, insertQuizSchema, bulkAssignCourseSchema, bulkAssignUsersSchema, bulkEmailAssignmentSchema } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";
import "./types"; // Import session type definitions

// Configure multer for video uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), "server/uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|avi|mov|wmv|webm/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  },
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  }
});

// Email configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || process.env.EMAIL_USER,
    pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Database health check with retry logic
  const checkDatabaseHealth = async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        await storage.getDashboardStats();
        console.log('Database connection healthy');
        return true;
      } catch (error) {
        console.error(`Database health check failed (attempt ${i + 1}):`, error);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1))); // Exponential backoff
        }
      }
    }
    return false;
  };

  // Check database health on startup
  await checkDatabaseHealth();

  // Cleanup expired assignments and reset reminder data periodically
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
      console.error('Failed to cleanup expired assignments:', error);
    }
  };

  // Run cleanup on startup
  cleanupExpiredAssignments();

  // Run cleanup every hour
  setInterval(cleanupExpiredAssignments, 60 * 60 * 1000);

  // Authentication routes
  app.post("/api/auth/admin-login", async (req, res) => {
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
            password: await bcrypt.hash("admin123", 10),
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

  app.post("/api/auth/employee-login", async (req, res) => {
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

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    res.json({ user });
  });

  // Admin-only middleware
  const requireAdmin = async (req: any, res: any, next: any) => {
    console.log('Session check - userId:', req.session.userId, 'userRole:', req.session.userRole);

    if (!req.session.userId || req.session.userRole !== "admin") {
      console.log('Admin access denied - Session:', req.session);
      return res.status(403).json({ message: "Admin access required" });
    }

    // Verify the user still exists and is actually an admin
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user || user.role !== "admin") {
        console.log('User not found or not admin - destroying session');
        req.session.destroy();
        return res.status(403).json({ message: "Admin access required" });
      }
    } catch (error) {
      console.error('Error verifying admin user:', error);
      return res.status(500).json({ message: "Authentication error" });
    }

    next();
  };

  // Authenticated user middleware
  const requireAuth = async (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  };

  // Employee routes
  app.get("/api/employees", requireAdmin, async (req, res) => {
    try {
      const employees = await storage.getAllEmployees();
      res.json(employees);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch employees" });
    }
  });

  app.post("/api/employees", requireAdmin, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      userData.role = "employee";

      const employee = await storage.createUser(userData);
      res.json(employee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid employee data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create employee" });
      }
    }
  });

  app.put("/api/employees/:id", requireAdmin, async (req, res) => {
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
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid employee data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update employee" });
      }
    }
  });

  app.delete("/api/employees/:id", requireAdmin, async (req, res) => {
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

  // Course routes
  app.get("/api/courses", async (req, res) => {
    try {
      const courses = await storage.getAllCourses();
      res.json(courses);
    } catch (error: any) {
      console.error('Error fetching courses:', error);
      if (error.code === '42703') {
        // Schema needs updating, return empty array for now
        console.log('Database schema needs updating, returning empty courses array');
        res.json([]);
      } else {
        res.status(500).json({ 
          message: "Failed to fetch courses",
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    }
  });

  app.post("/api/courses", requireAdmin, upload.single('video'), async (req, res) => {
    try {
      console.log('Course creation request body:', req.body);
      console.log('Course creation file:', req.file);
      console.log('Session during course creation:', req.session);

      const { title, description, questions, courseType, youtubeUrl } = req.body;

      if (!title || !description) {
        return res.status(400).json({ message: "Title and description are required" });
      }

      // Require either a video file or YouTube URL
      if (!youtubeUrl && !req.file) {
        return res.status(400).json({ message: "Video file or YouTube URL is required" });
      }

      let parsedQuestions = [];
      if (questions) {
        try {
          // Handle both string and object formats
          parsedQuestions = typeof questions === 'string' ? JSON.parse(questions) : questions;
        } catch (parseError) {
          console.error('Error parsing questions:', parseError);
          return res.status(400).json({ message: "Invalid questions format" });
        }
      }

      const course = await storage.createCourse({
        title: title.trim(),
        description: description.trim(),
        videoPath: req.file ? req.file.filename : undefined,
        youtubeUrl: youtubeUrl ? youtubeUrl.trim() : undefined,
        courseType: courseType || 'one-time',
        createdBy: req.session.userId!,
        questions: parsedQuestions,
      });

      // If there are questions, create a separate quiz entry
      if (parsedQuestions.length > 0) {
        await storage.addQuizToCourse(course.id, {
          title: `${title} Quiz`,
          questions: parsedQuestions,
          passingScore: 70
        });
      }

      res.json({ success: true, course });
    } catch (error) {
      console.error('Course creation error:', error);
      res.status(500).json({ 
        message: "Failed to create course", 
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.put("/api/courses/:id", requireAdmin, upload.single('video'), async (req, res) => {
    try {
      const { title, description, questions, courseType, youtubeUrl } = req.body;
      const updateData: any = {
        title,
        description,
        courseType: courseType || 'one-time',
      };

      // Handle video upload or YouTube URL update
      if (req.file) {
        updateData.videoPath = req.file.filename;
        updateData.youtubeUrl = null; // Clear YouTube URL if a file is uploaded
      } else if (youtubeUrl) {
        updateData.youtubeUrl = youtubeUrl;
        updateData.videoPath = null; // Clear video path if a URL is provided
      }

      // Handle questions update
      if (questions) {
        let parsedQuestions = [];
        try {
          // Handle both string and object formats
          parsedQuestions = typeof questions === 'string' ? JSON.parse(questions) : questions;
        } catch (parseError) {
          console.error('Error parsing questions:', parseError);
          return res.status(400).json({ message: "Invalid questions format" });
        }
        updateData.questions = parsedQuestions;

        // If questions are updated, update or create the associated quiz
        if (parsedQuestions.length > 0) {
          await storage.addQuizToCourse(req.params.id, {
            title: `${title} Quiz`,
            questions: parsedQuestions,
            passingScore: 70
          });
        } else {
          // If questions are cleared, also remove the associated quiz
          await storage.deleteQuizByCourseId(req.params.id);
        }
      }

      const updatedCourse = await storage.updateCourse(req.params.id, updateData);
      res.json(updatedCourse);
    } catch (error) {
      console.error('Course update error:', error);
      res.status(500).json({ message: "Failed to update course" });
    }
  });

  app.delete("/api/courses/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteCourse(req.params.id);
      res.json({ message: "Course deleted successfully" });
    } catch (error) {
      console.error('Course deletion error:', error);
      res.status(500).json({ message: "Failed to delete course" });
    }
  });

  app.get("/api/courses/:id", async (req, res) => {
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

  // Video streaming
  app.get("/api/videos/:filename", (req, res) => {
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
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(videoPath, { start, end });
        const head = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'video/mp4', // Assuming mp4, adjust if needed
        };
        res.writeHead(206, head);
        file.pipe(res);
      } else {
        const head = {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4', // Assuming mp4, adjust if needed
        };
        res.writeHead(200, head);
        fs.createReadStream(videoPath).pipe(res);
      }
    } catch (error) {
      console.error(`Error streaming video ${req.params.filename}:`, error);
      res.status(500).json({ message: "Error streaming video" });
    }
  });

  // Quiz routes
  app.get("/api/courses/:courseId/quiz", async (req, res) => {
    try {
      console.log(`Fetching quiz for course: ${req.params.courseId}`);

      const course = await storage.getCourse(req.params.courseId);

      if (!course) {
        console.log(`Course not found: ${req.params.courseId}`);
        return res.status(404).json({ message: "Course not found" });
      }

      console.log(`Course found: ${course.title}, has questions:`, !!course.questions);

      // Check if course has questions embedded or separate quiz
      let quiz = await storage.getQuizByCourseId(req.params.courseId);
      console.log('Separate quiz found:', !!quiz);

      // If no separate quiz exists but course has questions, use course questions
      if (!quiz && course.questions && course.questions.length > 0) {
        console.log(`Using embedded questions for course: ${course.title}`);
        quiz = {
          id: `course-embedded-quiz-${course.id}`,
          courseId: course.id,
          title: `${course.title} Quiz`,
          questions: course.questions,
          passingScore: 70, // Default passing score
          createdAt: new Date()
        };
      }

      if (!quiz) {
        console.log('No quiz or questions found for course');
        return res.status(404).json({ message: "No quiz found for this course" });
      }

      console.log(`Returning quiz with ${quiz.questions?.length || 0} questions`);
      res.json(quiz);
    } catch (error) {
      console.error("Quiz fetch error:", error);
      res.status(500).json({ 
        message: "Failed to fetch quiz",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  app.post("/api/courses/:courseId/quiz", requireAdmin, async (req, res) => {
    try {
      const quizData = insertQuizSchema.parse({
        ...req.body,
        courseId: req.params.courseId,
      });

      const quiz = await storage.createQuiz(quizData);
      res.json(quiz);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid quiz data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create quiz" });
      }
    }
  });

  app.put("/api/quizzes/:id", requireAdmin, async (req, res) => {
    try {
      const quizData = insertQuizSchema.parse(req.body);
      const updatedQuiz = await storage.updateQuiz(req.params.id, quizData);

      if (updatedQuiz) {
        res.json(updatedQuiz);
      } else {
        res.status(404).json({ message: "Quiz not found" });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid quiz data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update quiz" });
      }
    }
  });

  app.delete("/api/quizzes/:id", requireAdmin, async (req, res) => {
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

  // Enrollment routes
  app.get("/api/my-enrollments", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const enrollments = await storage.getUserEnrollments(req.session.userId);
      res.json(enrollments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch enrollments" });
    }
  });

  // Employee can update their own enrollment progress
  app.put("/api/my-enrollments/:enrollmentId", requireAuth, async (req, res) => {
    try {
      const { progress } = req.body;
      const enrollmentId = req.params.enrollmentId;

      // First verify this enrollment belongs to the current user
      const enrollment = await storage.getEnrollmentById(req.session.userId!, enrollmentId);
      if (!enrollment) {
        return res.status(404).json({ message: "Enrollment not found or access denied" });
      }

      const updatedEnrollment = await storage.updateEnrollment(enrollmentId, {
        progress: Math.min(Math.max(progress || 0, 0), 100), // Ensure progress is between 0-100
        lastAccessedAt: new Date()
      });

      if (updatedEnrollment) {
        res.json(updatedEnrollment);
      } else {
        res.status(404).json({ message: "Failed to update enrollment" });
      }
    } catch (error) {
      console.error('Error updating enrollment progress:', error);
      res.status(500).json({ message: "Failed to update enrollment progress" });
    }
  });

  app.post("/api/enroll", requireAdmin, async (req, res) => {
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

  // Additional enrollment management endpoints
  app.get("/api/enrollments", requireAdmin, async (req, res) => {
    try {
      const enrollments = await storage.getAllEnrollments();
      res.json(enrollments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch enrollments" });
    }
  });

  app.put("/api/enrollments/:id", requireAdmin, async (req, res) => {
    try {
      const { progress, quizScore, certificateIssued } = req.body;
      const updatedEnrollment = await storage.updateEnrollment(req.params.id, {
        progress,
        quizScore,
        certificateIssued,
        completedAt: certificateIssued ? new Date() : null
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

  app.delete("/api/enrollments/:id", requireAdmin, async (req, res) => {
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

  // Certificate management endpoints
  app.get("/api/certificates", requireAdmin, async (req, res) => {
    try {
      const certificates = await storage.getAllCertificates();
      res.json(certificates);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch certificates" });
    }
  });

  app.delete("/api/certificates/:id", requireAdmin, async (req, res) => {
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

  app.post("/api/quiz-submission", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { courseId, answers, score } = req.body;
      console.log('Quiz submission data:', { courseId, score, userId: req.session.userId });

      const enrollment = await storage.getEnrollment(req.session.userId, courseId);
      if (!enrollment) {
        return res.status(400).json({ message: "Not enrolled in this course" });
      }

      // Get quiz to check passing score
      const quiz = await storage.getQuizByCourseId(courseId);
      const passingScore = quiz?.passingScore || 70;
      const isPassing = score >= passingScore;

      console.log('Quiz validation:', { passingScore, isPassing, currentScore: score });

      // Update enrollment with latest quiz attempt
      const updated = await storage.updateEnrollment(enrollment.id, {
        quizScore: score,
        progress: isPassing ? 100 : 90, // Mark as 90% if not passing to allow retake
        completedAt: isPassing ? new Date() : null, // Only mark completed if passing
      });

      let certificate = null;

      // Don't auto-generate certificate here - wait for acknowledgment
      console.log('Quiz passed - awaiting acknowledgment for certificate generation');

      res.json({ 
        success: true, 
        score, 
        certificateIssued: enrollment.certificateIssued, 
        isPassing,
        needsAcknowledgment: isPassing && !enrollment.certificateIssued
      });
    } catch (error) {
      console.error('Quiz submission error:', error);
      res.status(500).json({ 
        message: "Failed to submit quiz",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Certificate routes
  app.get("/api/my-certificates", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const certificates = await storage.getUserCertificates(req.session.userId);
      res.json(certificates);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch certificates" });
    }
  });

  app.post("/api/acknowledge-completion", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { courseId, digitalSignature } = req.body;

      if (!digitalSignature?.trim()) {
        return res.status(400).json({ message: "Digital signature is required" });
      }

      // Get enrollment to verify quiz completion
      const enrollment = await storage.getEnrollment(req.session.userId, courseId);
      if (!enrollment) {
        return res.status(400).json({ message: "Not enrolled in this course" });
      }

      // Get quiz to check passing score
      const quiz = await storage.getQuizByCourseId(courseId);
      const passingScore = quiz?.passingScore || 70;

      if (!enrollment.quizScore || enrollment.quizScore < passingScore) {
        return res.status(400).json({ message: "Quiz must be completed with passing score before acknowledgment" });
      }

      // Check if certificate already exists for this course (replace if exists)
      const existingCertificate = await storage.getUserCertificateForCourse(req.session.userId, courseId);

      let certificate;
      const user = await storage.getUser(req.session.userId);
      const course = await storage.getCourse(courseId);

      // Calculate expiry date based on course type
      let expiresAt = null;
      if (course?.courseType === 'recurring') {
        const completionDate = new Date();
        const renewalMonths = course.renewalPeriodMonths || 3;
        expiresAt = new Date(completionDate.getTime() + (renewalMonths * 30 * 24 * 60 * 60 * 1000));
      }

      const certificateData = {
        score: enrollment.quizScore,
        completedAt: new Date(),
        acknowledgedAt: new Date(),
        digitalSignature: digitalSignature.trim(),
        participantName: user?.name || "",
        courseName: course?.title || "",
        completionDate: new Date().toLocaleDateString(),
        certificateId: existingCertificate?.id || `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        courseType: course?.courseType || 'one-time',
        expiresAt: expiresAt ? expiresAt.toLocaleDateString() : null
      };

      if (existingCertificate) {
        // Update existing certificate
        certificate = await storage.updateCertificate(existingCertificate.id, {
          certificateData,
          digitalSignature: digitalSignature.trim(),
          acknowledgedAt: new Date()
        });
      } else {
        // Create new certificate
        certificate = await storage.createCertificate({
          userId: req.session.userId,
          courseId,
          enrollmentId: enrollment.id,
          certificateData,
          digitalSignature: digitalSignature.trim(),
          acknowledgedAt: new Date()
        });
      }

      // Update enrollment to mark certificate as issued
      await storage.updateEnrollment(enrollment.id, {
        certificateIssued: true,
        completedAt: new Date(),
        expiresAt: expiresAt,
        isExpired: false
      });

      // Send certificate email to both user and HR
      try {
        if (user && course) {
          const certificateEmailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb; text-align: center;">Certificate of Completion</h2>
              <div style="border: 2px solid #2563eb; padding: 30px; margin: 20px 0; text-align: left;">
                <p style="font-size: 16px; margin: 20px 0;">I, <strong>${user.name}</strong>, working with Client: <strong>${user.clientName || 'N/A'}</strong>, holding Employee ID: <strong>${user.employeeId}</strong>, hereby acknowledge that I have successfully completed the following course:</p>

                <div style="margin: 20px 0;">
                  <p><strong>Course Name:</strong> ${course.title}</p>
                  <p><strong>Completion Date:</strong> ${new Date().toLocaleDateString()}</p>
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

          // Send to employee
          await transporter.sendMail({
            from: process.env.SMTP_FROM || 'noreply@traintrack.com',
            to: user.email,
            subject: `Certificate of Completion: ${course.title}`,
            html: certificateEmailHtml,
          });

          // Send to HR
          await transporter.sendMail({
            from: process.env.SMTP_FROM || 'noreply@traintrack.com',
            to: process.env.SMTP_FROM || 'noreply@traintrack.com',
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
                  <p><strong>Completion Date:</strong> ${new Date().toLocaleDateString()}</p>
                  <p><strong>Certificate ID:</strong> ${certificateData.certificateId}</p>
                  <p><strong>Digital Signature:</strong> ${digitalSignature}</p>
                </div>
                ${certificateEmailHtml}
              </div>
            `,
          });
        }
      } catch (emailError) {
        console.error('Failed to send certificate email:', emailError);
      }

      res.json({ 
        success: true, 
        certificate: certificate,
        message: "Course completion acknowledged and certificate generated successfully"
      });
    } catch (error) {
      console.error('Acknowledgment error:', error);
      res.status(500).json({ 
        message: "Failed to acknowledge completion",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard-stats", requireAdmin, async (req, res) => {
    try {
      if (req.session.userRole !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const stats = await storage.getDashboardStats();
      const remindersSent = await storage.getTotalRemindersSent();

      res.json({
        ...stats,
        remindersSent,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Bulk assignment endpoints
  app.post("/api/bulk-assign-course", requireAdmin, async (req, res) => {
    try {
      const validatedData = bulkAssignCourseSchema.parse(req.body);
      const enrollments = await storage.bulkAssignCourse(validatedData.courseId, validatedData.userIds);
      res.json({ enrollments, message: `Course assigned to ${validatedData.userIds.length} users successfully` });
    } catch (error) {
      console.error("Error bulk assigning course:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid data" });
    }
  });

  // Bulk employee operations for large organizations
  app.post("/api/bulk-import-employees", requireAdmin, async (req, res) => {
    try {
      const { employees } = req.body; // Array of employee data

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
          // Check if employee exists by employeeId or email
          const existingUser = await storage.getUserByEmail(empData.email) || 
                              await storage.getUserByEmployeeId(empData.employeeId);

          if (existingUser) {
            // Update existing employee
            await storage.updateUser(existingUser.id, {
              ...empData,
              role: "employee",
              isActive: empData.isActive !== false // Default to active
            });
            results.updated++;
          } else {
            // Create new employee
            await storage.createUser({
              ...empData,
              role: "employee",
              password: empData.password || await bcrypt.hash(`temp${Date.now()}`, 10),
              isActive: empData.isActive !== false
            });
            results.created++;

            // Auto-enroll in compliance courses
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

  app.post("/api/deactivate-employees", requireAdmin, async (req, res) => {
    try {
      const { employeeIds } = req.body;

      const results = await storage.deactivateEmployees(employeeIds);
      res.json({ message: `Deactivated ${results} employees successfully` });
    } catch (error) {
      res.status(500).json({ message: "Failed to deactivate employees" });
    }
  });

  app.get("/api/compliance-status", requireAdmin, async (req, res) => {
    try {
      const complianceReport = await storage.getComplianceReport();
      res.json(complianceReport);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate compliance report" });
    }
  });

  app.post("/api/renew-expired-certifications", requireAdmin, async (req, res) => {
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

  app.post("/api/bulk-assign-users", requireAdmin, async (req, res) => {
    try {
      const validatedData = bulkAssignUsersSchema.parse(req.body);
      const enrollments = await storage.bulkAssignUsers(validatedData.userIds, validatedData.courseIds);
      res.json({ enrollments, message: `${validatedData.userIds.length} users assigned to ${validatedData.courseIds.length} courses successfully` });
    } catch (error) {
      console.error("Error bulk assigning users:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid data" });
    }
  });

  // Email-based bulk assignment
  app.post("/api/bulk-assign-emails", requireAdmin, async (req, res) => {
    try {
      const validatedData = bulkEmailAssignmentSchema.parse(req.body);
      const assignments = await storage.bulkAssignCourseByEmail(
        validatedData.courseId, 
        validatedData.emails, 
        validatedData.deadlineDays
      );

      // Send emails to assigned users
      const course = await storage.getCourse(validatedData.courseId);
      for (const assignment of assignments) {
        try {
          const loginLink = `${req.protocol}://${req.get('host')}/course-access/${assignment.assignmentToken}`;

          await transporter.sendMail({
            from: process.env.SMTP_FROM || 'noreply@traintrack.com',
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
            `,
          });
        } catch (emailError) {
          console.error('Failed to send assignment email:', emailError);
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

  // Course access via token
  app.get("/api/course-access/:token", async (req, res) => {
    try {
      const enrollment = await storage.getEnrollmentByToken(req.params.token);

      if (!enrollment || enrollment.status === "expired") {
        return res.status(404).json({ message: "Invalid or expired access link" });
      }

      if (new Date() > enrollment.deadline!) {
        await storage.cleanupExpiredAssignments();
        return res.status(410).json({ message: "Course deadline has passed" });
      }

      const course = await storage.getCourse(enrollment.courseId);

      // Check if user already exists by email
      let existingUser = null;
      if (enrollment.assignedEmail) {
        existingUser = await storage.getUserByEmail(enrollment.assignedEmail);
      }

      // If user exists but enrollment is not linked, link it
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
        isFirstTime: !existingUser // Only first time if no existing user found
      });
    } catch (error) {
      console.error("Error accessing course:", error);
      res.status(500).json({ message: "Failed to access course" });
    }
  });

  // Complete profile and link user to enrollment
  app.post("/api/complete-profile", async (req, res) => {
    try {
      const { token, userData } = req.body;

      const enrollment = await storage.getEnrollmentByToken(token);
      if (!enrollment) {
        return res.status(404).json({ message: "Invalid access token" });
      }

      // Create user account
      const hashedPassword = await bcrypt.hash(`temp${Date.now()}`, 10);
      const user = await storage.createUser({
        ...userData,
        email: enrollment.assignedEmail!,
        password: hashedPassword,
        role: "employee",
        isActive: true
      });

      // Link enrollment to user
      await storage.updateEnrollment(enrollment.id, {
        userId: user.id,
        status: "accessed"
      });

      // Create session
      req.session.userId = user.id;
      req.session.userRole = "employee";

      res.json({ success: true, user });
    } catch (error) {
      console.error("Error completing profile:", error);
      res.status(500).json({ message: "Failed to complete profile" });
    }
  });

  // Get course assignments (for HR tracking)
  app.get("/api/course-assignments/:courseId", requireAdmin, async (req, res) => {
    try {
      const assignments = await storage.getCourseAssignments(req.params.courseId);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching course assignments:", error);
      res.status(500).json({ message: "Failed to fetch assignments" });
    }
  });

  // Check if course has any assignments
  app.get("/api/courses/:courseId/has-assignments", requireAdmin, async (req, res) => {
    try {
      const assignments = await storage.getCourseAssignments(req.params.courseId);
      res.json({ hasAssignments: assignments.length > 0 });
    } catch (error) {
      console.error("Error checking course assignments:", error);
      res.status(500).json({ message: "Failed to check assignments" });
    }
  });

  // Send reminders
  app.post("/api/send-reminders/:courseId", requireAdmin, async (req, res) => {
    try {
      const assignments = await storage.getCourseAssignments(req.params.courseId);
      // Only send to users who haven't completed the course AND are not expired
      const pendingAssignments = assignments.filter(a => 
        a.status !== 'completed' && 
        a.status !== 'expired' &&
        !a.certificateIssued &&
        a.progress < 100 &&
        new Date() < new Date(a.deadline)
      );

      const course = await storage.getCourse(req.params.courseId);
      let sentCount = 0;

      for (const assignment of pendingAssignments) {
        try {
          const loginLink = assignment.assignmentToken 
            ? `${req.protocol}://${req.get('host')}/course-access/${assignment.assignmentToken}`
            : `${req.protocol}://${req.get('host')}/employee-login`;

          const recipientEmail = assignment.assignedEmail || assignment.user?.email;
          if (!recipientEmail) continue;

          await transporter.sendMail({
            from: process.env.SMTP_FROM || 'noreply@traintrack.com',
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
            `,
          });

          // Increment reminder count for this enrollment
          await storage.incrementReminderCount(assignment.id);
          sentCount++;
        } catch (emailError) {
          console.error('Failed to send reminder email:', emailError);
        }
      }

      res.json({ message: `Sent ${sentCount} reminder emails` });
    } catch (error) {
      console.error("Error sending reminders:", error);
      res.status(500).json({ message: "Failed to send reminders" });
    }
  });

  // Performance metrics endpoint
  app.get("/api/performance-metrics", async (req, res) => {
    try {
      const startTime = Date.now();

      // Test database response time
      await storage.getDashboardStats();
      const dbResponseTime = Date.now() - startTime;

      const metrics = {
        serverResponseTime: dbResponseTime,
        activeUsers: 1, // In a real app, you'd track active sessions
        memoryUsage: process.memoryUsage ? Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100) : 45,
        cpuUsage: Math.floor(Math.random() * 20) + 15, // Simulated CPU usage
        uptime: process.uptime ? `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m` : "Unknown",
        requestsPerMinute: 15, // In a real app, you'd track this
        dbConnectionStatus: "Connected",
        totalRequests: 0 // In a real app, you'd track this
      };

      res.json(metrics);
    } catch (error) {
      res.status(500).json({ 
        message: "Failed to fetch performance metrics",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // User analytics endpoint
  app.get("/api/user-analytics/:id", requireAdmin, async (req, res) => {
    try {
      const analytics = await storage.getUserAnalytics(req.params.id);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching user analytics:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get course enrollments (who is assigned to a specific course)
  app.get("/api/courses/:courseId/enrollments", requireAdmin, async (req, res) => {
    try {
      const enrollments = await storage.getCourseEnrollments(req.params.courseId);
      res.json(enrollments);
    } catch (error) {
      console.error("Error fetching course enrollments:", error);
      res.status(500).json({ message: "Failed to fetch course enrollments" });
    }
  });

  // Get user enrollments (what courses a specific user is assigned to)
  app.get("/api/users/:userId/enrollments", requireAdmin, async (req, res) => {
    try {
      const enrollments = await storage.getUserEnrollments(req.params.userId);
      res.json(enrollments);
    } catch (error) {
      console.error("Error fetching user enrollments:", error);
      res.status(500).json({ message: "Failed to fetch user enrollments" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}