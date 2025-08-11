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
import { eq, sql } from "drizzle-orm";
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

  // Fix progress for completed courses on startup
  try {
    const fixedCount = await storage.fixCompletedCourseProgress();
    if (fixedCount > 0) {
      console.log(`Fixed progress for ${fixedCount} completed enrollments`);
    }
  } catch (error) {
    console.error('Failed to fix completed course progress:', error);
  }

  // Database reset endpoint (for development/setup only)
  app.post("/api/admin/reset-database", async (req, res) => {
    try {
      const { resetKey } = req.body;

      // Simple protection - require a reset key
      if (resetKey !== "RESET_TRAINTRACK_DB_2025") {
        return res.status(403).json({ message: "Invalid reset key" });
      }

      // Import reset function
      const { resetDatabase } = await import("./db");
      await resetDatabase();

      // Create default admin user
      const hashedPassword = await bcrypt.hash("admin123", 10);
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

      console.log('Database reset completed and admin user created');

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
      console.error('Database reset error:', error);
      res.status(500).json({ 
        message: "Failed to reset database",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

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
          console.log('Creating default admin user...');
          const hashedPassword = await bcrypt.hash("admin123", 10);
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
          console.log('Admin user created successfully');
        }

        // Verify password if user exists
        if (adminUser.password) {
          const isValidPassword = await bcrypt.compare("admin123", adminUser.password);
          if (!isValidPassword) {
            return res.status(401).json({ message: "Invalid credentials" });
          }
        }

        req.session.userId = adminUser.id;
        req.session.userRole = "admin";

        console.log('Admin login successful:', { userId: adminUser.id, email: adminUser.email });

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
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  app.post("/api/auth/employee-login", async (req, res) => {
    try {
      const { email, password } = req.body; // Added password for authentication

      const user = await storage.getUserByEmail(email);
      if (!user || user.role !== "employee" || !user.isActive) {
        return res.status(401).json({ message: "Email not found or not authorized. Please contact HR." });
      }

      // Password verification
      if (user.password) {
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          return res.status(401).json({ message: "Invalid credentials" });
        }
      } else {
        // Handle case where user exists but has no password (e.g., created via bulk import without password)
        // This might require a password reset flow or a default password.
        // For now, treating as invalid credentials if no password is set.
        return res.status(401).json({ message: "Password not set for this account. Please use the 'Forgot Password' feature or contact HR." });
      }

      req.session.userId = user.id;
      req.session.userRole = "employee";
      res.json({ success: true, user });
    } catch (error) {
      console.error("Employee login error:", error);
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

      // Password generation and hashing for new employees
      if (!userData.password) {
        const generatedPassword = Math.random().toString(36).slice(-12); // Simple random password
        userData.password = await bcrypt.hash(generatedPassword, 10);

        // Send email with username and password
        try {
          await transporter.sendMail({
            from: process.env.SMTP_FROM || 'noreply@traintrack.com',
            to: userData.email,
            subject: 'Your TrainTrack Account Details',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Welcome to TrainTrack!</h2>
                <p>Your account has been created. Please use the following credentials to log in:</p>
                <div style="border: 1px solid #e5e7eb; padding: 20px; margin: 20px 0; border-radius: 8px;">
                  <p><strong>Username/Email:</strong> ${userData.email}</p>
                  <p><strong>Temporary Password:</strong> ${generatedPassword}</p>
                </div>
                <p style="color: #666; font-size: 14px;">
                  For security reasons, we recommend changing your password after your first login.
                </p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${req.protocol}://${req.get('host')}/employee-login" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Login Now
                  </a>
                </div>
              </div>
            `,
          });
        } catch (emailError) {
          console.error('Failed to send welcome email:', emailError);
          // Continue even if email fails, as the account is created
        }
      }

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

      // Handle password update separately if provided
      if (req.body.password) {
        userData.password = await bcrypt.hash(req.body.password, 10);
      }

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
        res.json({ success: true, message: "Employee and all related data deleted successfully" });
      } else {
        res.status(404).json({ message: "Employee not found" });
      }
    } catch (error: any) {
      console.error('Employee deletion error:', error);
      res.status(500).json({ 
        message: "Failed to delete employee",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Password Reset Functionality
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      const user = await storage.getUserByEmail(email);

      if (!user || user.role !== 'employee' || !user.isActive) {
        return res.status(400).json({ message: "If an account with that email exists, a reset link has been sent." });
      }

      // Generate reset token
      const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Token valid for 24 hours

      await storage.createPasswordResetToken({
        userId: user.id,
        token: resetToken,
        expiresAt: expiresAt,
      });

      const resetLink = `${req.protocol}://${req.get('host')}/reset-password?token=${resetToken}`;

      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@traintrack.com',
        to: user.email,
        subject: 'Password Reset Request for TrainTrack',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Password Reset Request</h2>
            <p>You requested to reset your password. Please click the link below to set a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              This link will expire in 24 hours. If you did not request this, please ignore this email.
            </p>
          </div>
        `,
      });

      res.json({ message: "If an account with that email exists, a reset link has been sent." });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to process password reset request" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;

      const resetEntry = await storage.getPasswordResetToken(token);

      if (!resetEntry || new Date() > resetEntry.expiresAt) {
        return res.status(400).json({ message: "Invalid or expired password reset token" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      await storage.updateUserPassword(resetEntry.userId, hashedPassword);

      // Clean up the used token
      await storage.deletePasswordResetToken(token);

      res.json({ message: "Password reset successfully. You can now log in with your new password." });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
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

      const { title, description, questions, courseType, youtubeUrl, duration } = req.body;

      if (!title || !description) {
        return res.status(400).json({ message: "Title and description are required" });
      }

      // Require either a video file or YouTube URL
      if (!youtubeUrl?.trim() && !req.file) {
        return res.status(400).json({ message: "Video file or YouTube URL is required" });
      }

      let parsedQuestions = [];
      if (questions) {
        try {
          parsedQuestions = typeof questions === 'string' ? JSON.parse(questions) : questions;
        } catch (parseError) {
          console.error('Error parsing questions:', parseError);
          return res.status(400).json({ message: "Invalid questions format" });
        }
      }

      // Create course using youtubeUrl parameter
      const course = await storage.createCourse({
        title: title.trim(),
        description: description.trim(),
        youtubeUrl: youtubeUrl?.trim() || '', // Use youtubeUrl parameter
        videoPath: req.file ? req.file.filename : '', // Use file upload if available
        courseType: courseType || 'one-time',
        createdBy: req.session.userId!,
        questions: parsedQuestions,
        duration: duration ? parseInt(duration, 10) : 0, // Include duration, default to 0 if not provided or invalid
      });

      console.log('Course created with ID:', course.id, 'Video path:', course.videoPath);

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
      const { title, description, questions, courseType, youtubeUrl, duration } = req.body;
      const updateData: any = {
        title,
        description,
        courseType: courseType || 'one-time',
      };

      // Handle video upload or YouTube URL update
      if (req.file) {
        updateData.videoPath = req.file.filename;
        console.log('Updating course with uploaded file:', req.file.filename);
      } else if (youtubeUrl !== undefined) {
        updateData.youtubeUrl = youtubeUrl?.trim() || '';
        console.log('Updating course with YouTube URL:', youtubeUrl);
      }

      // Handle questions update
      if (questions) {
        let parsedQuestions = [];
        try {
          parsedQuestions = typeof questions === 'string' ? JSON.parse(questions) : questions;
        } catch (parseError) {
          console.error('Error parsing questions:', parseError);
          return res.status(400).json({ message: "Invalid questions format" });
        }
        updateData.questions = parsedQuestions;
      }

      // Handle duration update
      if (duration !== undefined) {
        updateData.duration = parseInt(duration, 10);
      }

      const updatedCourse = await storage.updateCourse(req.params.id, updateData);

      if (!updatedCourse) {
        return res.status(404).json({ message: "Course not found" });
      }

      res.json(updatedCourse);
    } catch (error) {
      console.error('Course update error:', error);
      res.status(500).json({ message: "Failed to update course" });
    }
  });

  // Preview course deletion impact
  app.get("/api/courses/:id/deletion-impact", requireAdmin, async (req, res) => {
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
          quizzesWillBeDeleted: impact.quizzesCount,
        },
        usersToDelete: impact.usersToDelete.map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          employeeId: u.employeeId,
        })),
        usersToKeep: impact.usersToKeep.map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          employeeId: u.employeeId,
        })),
      });
    } catch (error: any) {
      console.error('Error getting deletion impact:', error);
      res.status(500).json({ 
        message: "Failed to get deletion impact",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  app.delete("/api/courses/:id", requireAdmin, async (req, res) => {
    try {
      // Get course details before deletion for logging
      const course = await storage.getCourse(req.params.id);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      // Get enrollment count for logging
      const enrollments = await storage.getCourseEnrollments(req.params.id);
      const enrolledUserIds = [...new Set(enrollments.map(e => e.user?.id).filter(Boolean))];

      const success = await storage.deleteCourse(req.params.id);

      if (success) {
        console.log(`Course deleted: ${course.title} (ID: ${req.params.id})`);
        console.log(`Cleaned up ${enrollments.length} enrollments for ${enrolledUserIds.length} users`);

        res.json({ 
          success: true,
          message: "Course and all related data deleted successfully",
          details: {
            courseName: course.title,
            enrollmentsRemoved: enrollments.length,
            usersAffected: enrolledUserIds.length
          }
        });
      } else {
        res.status(404).json({ message: "Course not found" });
      }
    } catch (error: any) {
      console.error('Course deletion error:', error);
      res.status(500).json({ 
        message: "Failed to delete course and related data",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
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

      // Determine progress based on completion status
      let newProgress;
      if (enrollment.certificateIssued) {
        // If certificate is already issued, keep progress at 100%
        newProgress = 100;
      } else if (isPassing) {
        // If passing but no certificate yet, set to 95% (awaiting acknowledgment)
        newProgress = 95;
      } else {
        // If not passing, keep existing video progress or set to 90% max
        newProgress = Math.min(90, enrollment.progress || 0);
      }

      // Update enrollment with latest quiz attempt
      const updated = await storage.updateEnrollment(enrollment.id, {
        quizScore: score,
        progress: newProgress,
        completedAt: enrollment.certificateIssued ? enrollment.completedAt : null, // Keep existing completion date if certificate issued
        status: enrollment.certificateIssued ? "completed" : (isPassing ? "accessed" : "pending")
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

      // Update enrollment to mark certificate as issued and progress to 100%
      await storage.updateEnrollment(enrollment.id, {
        certificateIssued: true,
        progress: 100, // Ensure progress is exactly 100% when certificate is issued
        completedAt: new Date(),
        expiresAt: expiresAt,
        isExpired: false,
        status: "completed"
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

  // Debug endpoint to check database data
  app.get("/api/debug/database-check", requireAdmin, async (req, res) => {
    try {
      const [coursesResult, enrollmentsResult, usersResult] = await Promise.all([
        db.select({ 
          id: courses.id, 
          title: courses.title, 
          isActive: courses.isActive 
        }).from(courses).limit(10),
        db.select({ 
          id: enrollments.id, 
          courseId: enrollments.courseId, 
          userId: enrollments.userId, 
          assignedEmail: enrollments.assignedEmail,
          status: enrollments.status,
          enrolledAt: enrollments.enrolledAt,
          progress: enrollments.progress,
          certificateIssued: enrollments.certificateIssued
        }).from(enrollments).limit(10),
        db.select({ 
          id: users.id, 
          name: users.name, 
          email: users.email 
        }).from(users).limit(10)
      ]);

      // Specific debug for the problematic course
      const specificCourseEnrollments = await db
        .select()
        .from(enrollments)
        .where(eq(enrollments.courseId, 'f24ea136-f8db-4e54-b0f5-33fe6c39bd99'));

      res.json({
        courses: coursesResult,
        enrollments: enrollmentsResult,
        users: usersResult,
        specificCourseEnrollments,
        counts: {
          totalCourses: await db.select({ count: sql<number>`COUNT(*)` }).from(courses).then(r => r[0]?.count || 0),
          totalEnrollments: await db.select({ count: sql<number>`COUNT(*)` }).from(enrollments).then(r => r[0]?.count || 0),
          totalUsers: await db.select({ count: sql<number>`COUNT(*)` }).from(users).then(r => r[0]?.count || 0),
        }
      });
    } catch (error) {
      console.error("Debug database check failed:", error);
      res.status(500).json({ message: "Debug check failed", error: error.message });
    }
  });

  // Get course assignments (for HR tracking)
  app.get("/api/course-assignments/:courseId", requireAdmin, async (req, res) => {
    try {
      const courseId = req.params.courseId;

      // Validate courseId
      if (!courseId || courseId.trim() === '') {
        return res.status(400).json({ message: "Course ID is required" });
      }

      console.log(`Fetching assignments for course: ${courseId}`);

      // Verify course exists first
      const course = await storage.getCourse(courseId);
      if (!course) {
        console.log(`Course not found: ${courseId}`);
        return res.status(404).json({ message: "Course not found" });
      }

      const assignments = await storage.getCourseAssignments(courseId);
      console.log(`Found ${assignments.length} assignments for course ${courseId}`);

      // Ensure we always return an array with proper validation
      const validAssignments = Array.isArray(assignments) ? assignments.filter(a => a && typeof a === 'object') : [];

      // Add additional validation for each assignment
      const sanitizedAssignments = validAssignments.map((assignment, index) => {
        try {
          return {
            id: assignment.id || `fallback-${Date.now()}-${index}`,
            courseId: assignment.courseId || courseId,
            userId: assignment.userId || null,
            assignedEmail: String(assignment.assignedEmail || '').trim(),
            enrolledAt: assignment.enrolledAt || null,
            progress: Math.max(0, Math.min(100, Number(assignment.progress) || 0)),
            quizScore: assignment.quizScore ? Number(assignment.quizScore) : null,
            certificateIssued: Boolean(assignment.certificateIssued),
            remindersSent: Math.max(0, Number(assignment.remindersSent) || 0),
            deadline: assignment.deadline || null,
            status: assignment.status || 'pending',
            completedAt: assignment.completedAt || null,
            assignmentToken: assignment.assignmentToken || null,
            lastAccessedAt: assignment.lastAccessedAt || null,
            user: assignment.user && typeof assignment.user === 'object' ? {
              id: assignment.user.id || null,
              name: String(assignment.user.name || 'Not registered').trim(),
              email: String(assignment.user.email || assignment.assignedEmail || '').trim(),
              department: String(assignment.user.department || 'N/A').trim(),
              clientName: String(assignment.user.clientName || 'N/A').trim(),
            } : null,
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
        error: process.env.NODE_ENV === 'development' ? error?.message : undefined,
        courseId: req.params.courseId
      });
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

      // Get real memory usage
      const memoryStats = process.memoryUsage();
      const memoryUsagePercent = Math.round((memoryStats.heapUsed / memoryStats.heapTotal) * 100);

      // Calculate uptime
      const uptimeSeconds = process.uptime();
      const hours = Math.floor(uptimeSeconds / 3600);
      const minutes = Math.floor((uptimeSeconds % 3600) / 60);
      const formattedUptime = `${hours}h ${minutes}m`;

      // Get active sessions (you can enhance this to track real sessions)
      const activeUsers = Object.keys(req.sessionStore?.sessions || {}).length || 1;

      const metrics = {
        serverResponseTime: dbResponseTime,
        activeUsers: activeUsers,
        memoryUsage: memoryUsagePercent,
        cpuUsage: Math.floor(Math.random() * 15) + 10, // Simulated, as real CPU monitoring requires additional packages
        uptime: formattedUptime,
        requestsPerMinute: Math.floor(Math.random() * 10) + 5, // Simulated for now
        dbConnectionStatus: "Connected",
        totalRequests: 0 // Would require middleware to track
      };

      res.json(metrics);
    } catch (error) {
      console.error('Performance metrics error:', error);
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
      const courseId = req.params.courseId;

      // Validate courseId
      if (!courseId || courseId.trim() === '') {
        return res.status(400).json({ message: "Course ID is required" });
      }

      console.log(`Fetching enrollments for course: ${courseId}`);

      // Verify course exists first
      const course = await storage.getCourse(courseId);
      if (!course) {
        console.log(`Course not found: ${courseId}`);
        return res.status(404).json({ message: "Course not found" });
      }

      const enrollments = await storage.getCourseEnrollments(courseId);
      console.log(`Found ${enrollments.length} enrollments for course ${courseId}`);

      // Ensure we always return an array with consistent data structure
      const formattedEnrollments = (Array.isArray(enrollments) ? enrollments : []).map(enrollment => {
        if (!enrollment || typeof enrollment !== 'object') {
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
          assignedEmail: enrollment.assignedEmail || enrollment.user?.email || '',
          userName: enrollment.user?.name || "Not registered",
          userEmail: enrollment.user?.email || enrollment.assignedEmail || '',
          clientName: enrollment.user?.clientName || "N/A",
          department: enrollment.user?.department || "Not registered",
          user: enrollment.user || null,
        };
      }).filter(Boolean);

      res.json(formattedEnrollments);
    } catch (error) {
      console.error("Error fetching course enrollments:", error);
      res.status(500).json({ 
        message: "Failed to fetch course enrollments",
        error: process.env.NODE_ENV === 'development' ? error?.message : undefined
      });
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