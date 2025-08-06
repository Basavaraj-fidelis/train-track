import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertCourseSchema, insertQuizSchema, bulkAssignCourseSchema, bulkAssignUsersSchema } from "@shared/schema";
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
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch courses" });
    }
  });

  app.post("/api/courses", requireAdmin, upload.single('video'), async (req, res) => {
    try {
      console.log('Course creation request body:', req.body);
      console.log('Course creation file:', req.file);
      console.log('Session during course creation:', req.session);
      
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
          console.error('Error parsing questions:', parseError);
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
      console.error('Course creation error:', error);
      res.status(500).json({ 
        message: "Failed to create course", 
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.put("/api/courses/:id", requireAdmin, upload.single('video'), async (req, res) => {
    try {
      const { title, description, questions } = req.body;
      const updateData: any = {
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
          'Content-Type': 'video/mp4',
        };
        res.writeHead(206, head);
        file.pipe(res);
      } else {
        const head = {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
        };
        res.writeHead(200, head);
        fs.createReadStream(videoPath).pipe(res);
      }
    } catch (error) {
      res.status(500).json({ message: "Error streaming video" });
    }
  });

  // Quiz routes
  app.get("/api/courses/:courseId/quiz", async (req, res) => {
    try {
      const quiz = await storage.getQuizByCourseId(req.params.courseId);
      res.json(quiz);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch quiz" });
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
      
      const certificateData = {
        score: enrollment.quizScore,
        completedAt: new Date(),
        acknowledgedAt: new Date(),
        digitalSignature: digitalSignature.trim(),
        participantName: user?.name || "",
        courseName: course?.title || "",
        completionDate: new Date().toLocaleDateString(),
        certificateId: existingCertificate?.id || `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
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
        completedAt: new Date()
      });

      // Send certificate email
      try {
        if (user && course) {
          await transporter.sendMail({
            from: process.env.SMTP_FROM || 'noreply@traintrack.com',
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
                    <p><strong>Completion Date:</strong> ${new Date().toLocaleDateString()}</p>
                    <p><strong>Certificate ID:</strong> ${certificateData.certificateId}</p>
                  </div>
                  <p style="font-style: italic; margin-top: 30px;">Digital Signature: ${digitalSignature}</p>
                </div>
                <p style="text-align: center; color: #666; font-size: 12px;">
                  This certificate was digitally generated and acknowledged by the participant.
                </p>
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
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Bulk assignment endpoints
  app.post("/api/bulk-assign-course", requireAdmin, async (req, res) => {
    try {
      const validatedData = bulkAssignCourseSchema.parse(req.body);
      const enrollments = await storage.bulkAssignCourse(validatedData.courseId, validatedData.userIds);
      res.json({ enrollments, message: `Course assigned to ${validatedData.userIds.length} users successfully` });


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


    } catch (error) {
      console.error("Error bulk assigning course:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid data" });
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
