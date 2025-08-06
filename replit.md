# TrainTrack - Professional Training Management Portal

## Overview

TrainTrack is a comprehensive employee training management system that enables organizations to manage courses, track employee progress, and issue certificates. The application features separate portals for HR administrators and employees, with video-based training courses, interactive quizzes, and automated certificate generation.

The system supports course creation with video uploads, quiz generation, employee enrollment tracking, and provides dashboard analytics for administrators. Employees can access their assigned courses, track progress, take quizzes, and earn certificates upon completion.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for client-side routing with separate portals for HR and employees
- **UI Components**: Shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming support
- **State Management**: TanStack Query (React Query) for server state management
- **Form Handling**: React Hook Form with Zod validation schemas

### Backend Architecture
- **Server**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **File Handling**: Multer for video file uploads with local storage
- **Authentication**: Session-based authentication with role-based access control
- **API Design**: RESTful API with separate endpoints for admin and employee operations

### Data Storage Solutions
- **Primary Database**: PostgreSQL with Neon serverless connection
- **Database Schema**: 
  - Users table with role-based access (admin/employee)
  - Courses table with video paths and metadata
  - Quizzes table with JSON-based questions storage
  - Enrollments table tracking progress and completion
  - Certificates table for issued certifications
- **File Storage**: Local filesystem storage for video uploads
- **Schema Management**: Drizzle Kit for database migrations

### Authentication and Authorization
- **User Roles**: Admin (HR) and Employee with different access levels
- **Authentication Flow**: 
  - Admin login with username/password credentials
  - Employee login with email-only (passwordless) authentication
  - Session management with HTTP-only cookies
- **Authorization**: Role-based route protection and API endpoint access control

### External Dependencies
- **Database**: Neon PostgreSQL serverless database
- **Email Service**: Nodemailer integration for notifications (SMTP configuration required)
- **UI Framework**: Shadcn/ui with Radix UI components
- **Development Tools**: Vite with Replit-specific plugins for development environment

The application follows a monorepo structure with shared schema definitions and clear separation between client and server code, enabling efficient development and deployment workflows.

## Recent Changes

**August 6, 2025**
- Fixed admin authentication system - admin/admin123 login now works correctly
- Updated database schema to include all required employee fields (employeeId, designation, clientName, phoneNumber)
- Enhanced HR dashboard with comprehensive course and employee management features
- Implemented step-by-step course creation wizard workflow
- Added bulk assignment capabilities for courses and users
- Integrated user analytics and CRUD operations for employee management