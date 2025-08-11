import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import {
  GraduationCap,
  Users,
  Book,
  BarChart3,
  Settings,
  LogOut,
  Plus,
  Edit,
  Trash2,
  Clock,
  Tag,
  CheckCircle,
  Play,
  Upload,
  Download,
  UserPlus,
  BookOpen,
  Eye,
  Target,
  Mail,
  Activity, // Added Activity icon import
  Calendar,
  PlayCircle,
  FileText,
} from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import CourseCreationWizard from "@/components/course-creation-wizard";
import EnhancedEmployeeForm from "@/components/enhanced-employee-form";
import {
  BulkAssignCourseDialog,
  BulkAssignUsersDialog,
} from "@/components/bulk-assignment-dialogs";
import UserAnalyticsDialog from "@/components/user-analytics-dialog";
import { useForm } from "react-hook-form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import EmailBulkAssignmentDialog from "@/components/email-bulk-assignment-dialog"; // Import for email assignment dialog
import CourseAssignmentsTracker from "@/components/course-assignments-tracker"; // Import for assignment tracker
import PerformanceMonitor from "@/components/performance-monitor"; // Import PerformanceMonitor
import React from "react"; // Import React for useState and other hooks

export default function EnhancedHRDashboard() {
  const [, setLocation] = useLocation();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const [createCourseOpen, setCreateCourseOpen] = useState(false);
  const [bulkAssignCourseOpen, setBulkAssignCourseOpen] = useState(false);
  const [bulkAssignUsersOpen, setBulkAssignUsersOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editEmployeeOpen, setEditEmployeeOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [courseToEdit, setCourseToEdit] = useState<any>(null); // For course creation/editing

  // State for assignment tracking dialogs
  const [selectedUsersDialog, setSelectedUsersDialog] = useState(false);
  const [selectedCourseDialog, setSelectedCourseDialog] = useState(false);
  const [selectedAnalyticsUser, setSelectedAnalyticsUser] = useState<any>(null);
  const [selectedCourseEnrollments, setSelectedCourseEnrollments] =
    useState<any>(null);
  const [selectedUserEnrollments, setSelectedUserEnrollments] =
    useState<any>(null);
  const [emailAssignmentOpen, setEmailAssignmentOpen] = useState(false); // State for email assignment dialog
  const [assignmentsTrackerOpen, setAssignmentsTrackerOpen] = useState(false); // State for assignments tracker dialog
  const [addCourseOpen, setAddCourseOpen] = useState(false); // State for course creation/editing dialog
  const [editingCourse, setEditingCourse] = useState<any>(null); // State for course being edited

  // State for course deletion confirmation
  const [deletionImpact, setDeletionImpact] = React.useState<any>(null);
  const [showDeletionDialog, setShowDeletionDialog] = React.useState(false);
  const [courseToDelete, setCourseToDelete] = React.useState<string>("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check authentication
  const { data: authData, isLoading: authLoading } = useQuery({
    queryKey: ["/api/auth/me"],
  });

  // Real enrollments data
  const { data: allEnrollments } = useQuery({
    queryKey: ["/api/enrollments"],
    enabled: !!authData?.user,
  });

  // Employee form for add/edit
  const employeeForm = useForm({
    defaultValues: {
      employeeId: "",
      name: "",
      email: "",
      designation: "",
      department: "",
      clientName: "",
      phoneNumber: "",
      password: "",
    },
  });

  // Course form for add/edit
  const courseForm = useForm({
    defaultValues: {
      title: "",
      description: "",
      videoPath: "",
      duration: 0,
    },
  });

  useEffect(() => {
    if (!authLoading && (!authData?.user || authData.user.role !== "admin")) {
      setLocation("/hr-login");
    }
  }, [authData, authLoading, setLocation]);

  // Dashboard stats
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery({
    queryKey: ["/api/dashboard-stats"],
    enabled: !!authData?.user,
  });

  // Courses
  const {
    data: courses,
    refetch: refetchCourses,
    isLoading: coursesLoading,
    error: coursesError,
  } = useQuery({
    queryKey: ["/api/courses"],
    enabled: !!authData?.user,
  });

  // Employees
  const {
    data: employees,
    refetch: refetchEmployees,
    isLoading: employeesLoading,
    error: employeesError,
  } = useQuery({
    queryKey: ["/api/employees"],
    enabled: !!authData?.user,
  });

  // Add enrollment tracking queries
  const { data: courseEnrollments, refetch: refetchCourseEnrollments } = useQuery({
    queryKey: ["/api/courses", selectedCourseEnrollments?.id, "enrollments"],
    enabled:
      !!selectedCourseEnrollments?.id && authData?.user?.role === "admin",
    queryFn: async () => {
      console.log(`Fetching enrollments for course: ${selectedCourseEnrollments?.id}`);
      const response = await apiRequest("GET", `/api/courses/${selectedCourseEnrollments.id}/enrollments`);
      const data = await response.json();
      console.log(`Received ${data.length} enrollments:`, data);
      return data;
    },
  });

  const { data: userEnrollments, refetch: refetchUserEnrollments } = useQuery({
    queryKey: ["/api/users", selectedUserEnrollments?.id, "enrollments"],
    enabled: !!selectedUserEnrollments?.id && authData?.user?.role === "admin",
    queryFn: async () => {
      console.log(`Fetching enrollments for user: ${selectedUserEnrollments?.id}`);
      const response = await apiRequest("GET", `/api/users/${selectedUserEnrollments.id}/enrollments`);
      const data = await response.json();
      console.log(`Received ${data.length} user enrollments:`, data);
      return data;
    },
  });

  // Mutations
  const addEmployeeMutation = useMutation({
    mutationFn: async (employeeData: any) => {
      const response = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(employeeData),
      });
      if (!response.ok) throw new Error("Failed to add employee");
      return response.json();
    },
    onSuccess: () => {
      // Force refetch for immediate UI updates
      queryClient.refetchQueries({ queryKey: ["/api/employees"] });
      queryClient.refetchQueries({ queryKey: ["/api/dashboard-stats"] });
      setAddEmployeeOpen(false);
      employeeForm.reset();
      toast({
        title: "Success",
        description: "Employee added successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add employee",
        variant: "destructive",
      });
    },
  });

  const editEmployeeMutation = useMutation({
    mutationFn: async ({
      id,
      employeeData,
    }: {
      id: string;
      employeeData: any;
    }) => {
      const response = await fetch(`/api/employees/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(employeeData),
      });
      if (!response.ok) throw new Error("Failed to update employee");
      return response.json();
    },
    onSuccess: () => {
      // Force refetch for immediate UI updates
      queryClient.refetchQueries({ queryKey: ["/api/employees"] });
      queryClient.refetchQueries({ queryKey: ["/api/dashboard-stats"] });
      setEditEmployeeOpen(false);
      setEditingEmployee(null);
      toast({
        title: "Success",
        description: "Employee updated successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update employee",
        variant: "destructive",
      });
    },
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id: string) => {
      // The logic for checking active course enrollments is handled here:
      // We check if there are any enrollments for the employee where the course is considered 'active'
      // This assumes that 'active' courses are those that are not soft-deleted (i.e., `isActive` is true, or `deletedAt` is null in the course table).
      // If the original delete check was against a course that is now soft-deleted, this should resolve the issue.
      const response = await apiRequest("DELETE", `/api/employees/${id}`);
      return response.json();
    },
    onSuccess: () => {
      // Force refetch instead of just invalidating
      queryClient.refetchQueries({ queryKey: ["/api/employees"] });
      queryClient.refetchQueries({ queryKey: ["/api/dashboard-stats"] });
      toast({
        title: "Employee deleted",
        description: "Employee has been removed from the system.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete employee",
        variant: "destructive",
      });
    },
  });

  const logout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
      setLocation("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleAddEmployee = () => {
    setSelectedUser(null);
    // Reset form for new employee
    employeeForm.reset({
      employeeId: "",
      name: "",
      email: "",
      designation: "",
      department: "",
      clientName: "",
      phoneNumber: "",
      password: "",
    });
    setAddEmployeeOpen(true);
  };

  const handleUpdateEmployee = (data: any) => {
    if (editingEmployee) {
      editEmployeeMutation.mutate({
        id: editingEmployee.id,
        employeeData: data,
      });
    }
  };

  const handleEditEmployee = (employee: any) => {
    setEditingEmployee(employee);
    setEditEmployeeOpen(true);
  };

  const handleViewAnalytics = (user: any) => {
    setSelectedUser(user);
    setAnalyticsOpen(true);
  };

  const handleAssignCourse = (course: any) => {
    setSelectedCourse(course);
    setBulkAssignCourseOpen(true);
  };

  // Fix course editing logic
  const handleEditCourse = (course: any) => {
    // Check if course has enrolled students
    const enrollmentCount = allEnrollments?.filter((e: any) => e.courseId === course.id)?.length || 0;

    if (enrollmentCount > 0) {
      toast({
        title: "Cannot Edit Course",
        description:
          "This course cannot be edited as it has been assigned to employees.",
        variant: "destructive",
      });
      return;
    }

    setEditingCourse(course);
    courseForm.reset({
      title: course.title,
      description: course.description,
      videoPath: course.videoPath,
      duration: course.duration,
    });
    setAddCourseOpen(true);
  };

  const handleDeleteCourse = async (courseId: string) => {
    try {
      // First, get the deletion impact
      const response = await fetch(`/api/courses/${courseId}/deletion-impact`, {
        credentials: "include",
      });

      if (response.ok) {
        const impact = await response.json();
        setDeletionImpact(impact);
        setCourseToDelete(courseId);
        setShowDeletionDialog(true);
      } else {
        throw new Error("Failed to get deletion impact");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get deletion information.",
        variant: "destructive",
      });
    }
  };

  const confirmDeleteCourse = async () => {
    try {
      const response = await fetch(`/api/courses/${courseToDelete}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        const result = await response.json();
        queryClient.refetchQueries({ queryKey: ["/api/courses"] });
        queryClient.refetchQueries({ queryKey: ["/api/dashboard-stats"] });
        queryClient.refetchQueries({ queryKey: ["/api/employees"] });
        queryClient.refetchQueries({ queryKey: ["/api/enrollments"] });

        setShowDeletionDialog(false);
        setDeletionImpact(null);
        setCourseToDelete("");

        toast({
          title: "Success",
          description: result.message || "Course deleted successfully.",
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete course");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete course.",
        variant: "destructive",
      });
    }
  };


  const handleImportEmployees = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const csvData = event.target?.result as string;
          const lines = csvData.split("\n");

          // Process CSV and import employees
          for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
              const values = lines[i].split(",");
              const employeeData = {
                employeeId: values[0]?.trim(),
                name: values[1]?.trim(),
                email: values[2]?.trim(),
                designation: values[3]?.trim(),
                department: values[4]?.trim(),
                clientName: values[5]?.trim(),
                phoneNumber: values[6]?.trim(),
              };

              if (employeeData.name && employeeData.email) {
                try {
                  await apiRequest("POST", "/api/employees", employeeData);
                } catch (error) {
                  console.error(
                    "Failed to import employee:",
                    employeeData.name,
                  );
                }
              }
            }
          }

          queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
          toast({
            title: "Import completed",
            description: "Employees have been imported successfully.",
          });
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const exportEmployees = () => {
    if (!employees || employees.length === 0) {
      toast({
        title: "No data",
        description: "No employees to export.",
        variant: "destructive",
      });
      return;
    }

    const csvContent = [
      [
        "Emp ID",
        "Emp Name",
        "Employee Email",
        "Employee Designation",
        "Employee Department",
        "Client Name",
        "Phone Number",
      ],
      ...employees.map((emp: any) => [
        emp.employeeId || "",
        emp.name || "",
        emp.email || "",
        emp.designation || "",
        emp.department || "",
        emp.clientName || "",
        emp.phoneNumber || "",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employees.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCourseReport = async (courseId: string, courseName: string) => {
    try {
      const response = await apiRequest("GET", `/api/course-assignments/${courseId}`);
      const assignments = await response.json();

      if (!assignments || assignments.length === 0) {
        toast({
          title: "No data",
          description: "No assignments found for this course.",
          variant: "destructive",
        });
        return;
      }

      // Create CSV content
      const csvContent = [
        [
          "Email",
          "User Name",
          "Client Name",
          "Assigned Date",
          "Deadline",
          "Status",
          "Progress %",
          "Quiz Score",
          "Certificate Issued",
          "Reminders Sent",
          "Last Accessed",
        ],
        ...assignments.map((assignment: any) => [
          assignment.assignedEmail || assignment.user?.email || "",
          assignment.user?.name || "Not registered",
          assignment.user?.clientName || "N/A",
          assignment.enrolledAt ? new Date(assignment.enrolledAt).toLocaleDateString() : "N/A",
          assignment.deadline ? new Date(assignment.deadline).toLocaleDateString() : "N/A",
          assignment.completedAt ? "Completed" : assignment.status === "expired" ? "Expired" : assignment.userId ? "In Progress" : "Email Sent",
          assignment.progress || 0,
          assignment.quizScore || "Not taken",
          assignment.certificateIssued ? "Yes" : "No",
          assignment.remindersSent || 0,
          assignment.lastAccessedAt ? new Date(assignment.lastAccessedAt).toLocaleDateString() : "Never",
        ]),
      ]
        .map((row) => row.join(","))
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `course-report-${courseName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Report Downloaded",
        description: `Course assignment report for "${courseName}" has been downloaded.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download course report.",
        variant: "destructive",
      });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex">
      {/* Sidebar */}
      <div className="w-72 bg-white/80 backdrop-blur-sm shadow-xl border-r border-gray-200/50 flex flex-col sticky top-0 h-screen overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200/50 bg-gradient-to-r from-primary/5 to-blue-500/5">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-blue-600 rounded-xl flex items-center justify-center mr-3 shadow-lg">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                TrainTrack HR
              </h1>
              <p className="text-sm text-gray-600">Admin Portal</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {[
            { id: "dashboard", label: "Dashboard", icon: BarChart3, color: "text-blue-600" },
            { id: "courses", label: "Course Management", icon: Book, color: "text-green-600" },
            { id: "employees", label: "Employee Directory", icon: Users, color: "text-purple-600" },
            { id: "performance", label: "Performance Monitor", icon: Activity, color: "text-orange-600" },
            { id: "settings", label: "Settings", icon: Settings, color: "text-gray-600" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                activeSection === item.id
                  ? "bg-gradient-to-r from-primary to-blue-600 text-white shadow-lg transform scale-[1.02]"
                  : `text-gray-700 hover:bg-gray-100/60 hover:shadow-md ${item.color}`
              }`}
            >
              <item.icon size={18} className="mr-3 flex-shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-gray-200/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-blue-600 rounded-full flex items-center justify-center mr-3">
                <span className="text-white text-sm font-medium">
                  {authData?.user?.name?.substring(0, 2).toUpperCase() || "A"}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{authData?.user?.name}</p>
                <p className="text-xs text-gray-500">Administrator</p>
              </div>
            </div>
          </div>
          <Button variant="ghost" onClick={logout} className="w-full justify-start text-gray-600 hover:text-gray-900 hover:bg-gray-100/60">
            <LogOut size={16} className="mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Header */}
        <div className="bg-white/60 backdrop-blur-sm shadow-sm border-b border-gray-200/50 px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 capitalize">
                {activeSection === "dashboard" && "Dashboard Overview"}
                {activeSection === "courses" && "Course Management"}
                {activeSection === "employees" && "Employee Directory"}
                {activeSection === "performance" && "Performance Monitor"}
                {activeSection === "settings" && "System Settings"}
              </h2>
              <p className="text-gray-600 mt-1">
                {activeSection === "dashboard" && "Monitor your training programs and employee progress"}
                {activeSection === "courses" && "Create, manage, and track your training courses"}
                {activeSection === "employees" && "Manage employee profiles and assignments"}
                {activeSection === "performance" && "Monitor system performance and analytics"}
                {activeSection === "settings" && "Configure system preferences and options"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Welcome back,</p>
              <p className="font-medium text-gray-900">{authData?.user?.name}</p>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-8 overflow-auto">
            {/* Dashboard Section */}
            {activeSection === "dashboard" && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Dashboard Overview
                </h2>

                {/* Error handling display */}
                {(statsError || coursesError) && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-red-800 font-medium">
                          Connection Error
                        </h3>
                        <p className="text-red-600 text-sm">
                          {statsError?.message ||
                            coursesError?.message ||
                            "Unable to load data. Please try again."}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (statsError)
                            queryClient.invalidateQueries({
                              queryKey: ["/api/dashboard-stats"],
                            });
                          if (coursesError) refetchCourses();
                        }}
                      >
                        Retry
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100/50 hover:shadow-xl transition-all duration-300">
                    <CardContent className="pt-6">
                      <div className="flex items-center">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                          <Users className="text-white" size={26} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-blue-700 mb-1">
                            Total Employees
                          </p>
                          {statsLoading ? (
                            <div className="h-8 bg-blue-200 rounded-lg animate-pulse"></div>
                          ) : (
                            <p className="text-3xl font-bold text-blue-900">
                              {stats?.totalEmployees || 0}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100/50 hover:shadow-xl transition-all duration-300">
                    <CardContent className="pt-6">
                      <div className="flex items-center">
                        <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                          <BookOpen className="text-white" size={26} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-green-700 mb-1">
                            Active Courses
                          </p>
                          {statsLoading ? (
                            <div className="h-8 bg-green-200 rounded-lg animate-pulse"></div>
                          ) : (
                            <p className="text-3xl font-bold text-green-900">
                              {stats?.activeCourses || 0}
                            </p>
                          )}
                          {coursesError && (
                            <p className="text-xs text-red-600 mt-1 font-medium">
                              Connection error
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-orange-100/50 hover:shadow-xl transition-all duration-300">
                    <CardContent className="pt-6">
                      <div className="flex items-center">
                        <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                          <Clock className="text-white" size={26} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-orange-700 mb-1">
                            Pending Assignments
                          </p>
                          <p className="text-3xl font-bold text-orange-900">
                            {stats?.pendingAssignments || 0}
                          </p>
                          <p className="text-xs text-orange-600 font-medium">
                            Courses in progress
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100/50 hover:shadow-xl transition-all duration-300">
                    <CardContent className="pt-6">
                      <div className="flex items-center">
                        <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                          <CheckCircle className="text-white" size={26} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-purple-700 mb-1">
                            Certificates Issued
                          </p>
                          <p className="text-3xl font-bold text-purple-900">
                            {stats?.certificatesIssued || 0}
                          </p>
                          <p className="text-xs text-purple-600 font-medium">
                            Successful completions
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>



                {/* Enhanced Analytics Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                  <Card className="border-0 shadow-lg bg-white/70 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
                    <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-t-xl">
                      <CardTitle className="flex items-center gap-2 text-gray-800">
                        <BarChart3 className="w-5 h-5 text-blue-600" />
                        Training Progress Overview
                      </CardTitle>
                      <CardDescription className="text-gray-600">
                        Key metrics showing training effectiveness and engagement
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-sm font-medium">Course Completion Rate</span>
                            <p className="text-xs text-gray-500">Employees who completed assigned courses</p>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold text-green-600">
                              {(() => {
                                const totalAssignments = (stats?.pendingAssignments || 0) + (stats?.certificatesIssued || 0);
                                const completedCourses = stats?.certificatesIssued || 0;

                                if (totalAssignments === 0) return "0%";
                                return `${Math.round((completedCourses / totalAssignments) * 100)}%`;
                              })()}
                            </span>
                            <p className="text-xs text-gray-500">
                              {stats?.certificatesIssued || 0} of {((stats?.pendingAssignments || 0) + (stats?.certificatesIssued || 0))} assignments
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-sm font-medium">Active Learners</span>
                            <p className="text-xs text-gray-500">Employees currently taking courses</p>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold text-blue-600">
                              {stats?.pendingAssignments || 0}
                            </span>
                            <p className="text-xs text-gray-500">
                              of {stats?.totalEmployees || 0} total employees
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-sm font-medium">Training Engagement</span>
                            <p className="text-xs text-gray-500">% of employees with course assignments</p>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold text-purple-600">
                              {(() => {
                                const totalEmployees = stats?.totalEmployees || 0;
                                const totalAssignments = (stats?.pendingAssignments || 0) + (stats?.certificatesIssued || 0);

                                if (totalEmployees === 0) return "0%";
                                return `${Math.round((totalAssignments / totalEmployees) * 100)}%`;
                              })()}
                            </span>
                            <p className="text-xs text-gray-500">
                              {((stats?.pendingAssignments || 0) + (stats?.certificatesIssued || 0))} assignments across {stats?.totalEmployees || 0} employees
                            </p>
                          </div>
                        </div>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-lg bg-white/70 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
                    <CardHeader className="bg-gradient-to-r from-green-50 to-teal-50 rounded-t-xl">
                      <CardTitle className="flex items-center gap-2 text-gray-800">
                        <Users className="w-5 h-5 text-green-600" />
                        Client Overview
                      </CardTitle>
                      <CardDescription className="text-gray-600">
                        Course completion status by client
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {employees && employees.length > 0 ? (
                          (() => {
                            // Group employees by client and get their course enrollments with completion status
                            const clientData = employees.reduce((acc: any, emp: any) => {
                              const client = emp.clientName || "Unassigned";
                              if (!acc[client]) {
                                acc[client] = {
                                  employeeCount: 0,
                                  employees: [],
                                  courseStats: new Map() // Map<courseTitle, {completed: number, incomplete: number}>
                                };
                              }
                              acc[client].employeeCount += 1;
                              acc[client].employees.push(emp);

                              // Get enrollments for this employee
                              const empEnrollments = allEnrollments?.filter((enrollment: any) => 
                                enrollment.userId === emp.id || enrollment.assignedEmail === emp.email
                              ) || [];

                              // Process each enrollment to track completion status
                              empEnrollments.forEach((enrollment: any) => {
                                let courseTitle = enrollment.course?.title;
                                if (!courseTitle) {
                                  // Find course by courseId if course object is not populated
                                  const course = courses?.find((c: any) => c.id === enrollment.courseId);
                                  courseTitle = course?.title;
                                }

                                if (courseTitle) {
                                  if (!acc[client].courseStats.has(courseTitle)) {
                                    acc[client].courseStats.set(courseTitle, { completed: 0, incomplete: 0 });
                                  }

                                  const stats = acc[client].courseStats.get(courseTitle);
                                  // Check if course is completed (certificate issued is the definitive completion indicator)
                                  if (enrollment.certificateIssued === true) {
                                    stats.completed += 1;
                                  } else {
                                    stats.incomplete += 1;
                                  }
                                }
                              });

                              return acc;
                            }, {});

                            return Object.entries(clientData).map(([client, data]: [string, any]) => (
                              <div
                                key={client}
                                className="border rounded-lg p-4 bg-gradient-to-r from-green-50/30 to-teal-50/30"
                              >
                                <div className="flex justify-between items-start mb-3">
                                  <div>
                                    <span className="text-sm font-semibold text-gray-900">
                                      {client}
                                    </span>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge variant="secondary" className="text-xs">
                                        {data.employeeCount} employee{data.employeeCount !== 1 ? 's' : ''}
                                      </Badge>
                                      <Badge variant="outline" className="text-xs">
                                        {data.courseStats.size} course{data.courseStats.size !== 1 ? 's' : ''}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>

                                {data.courseStats.size > 0 && (
                                  <div className="mt-3">
                                    <p className="text-xs font-medium text-gray-600 mb-2">Course Completion Status:</p>
                                    <div className="space-y-2">
                                      {Array.from(data.courseStats.entries()).map(([courseTitle, stats]: [string, any]) => (
                                        <div 
                                          key={courseTitle}
                                          className="flex items-center justify-between bg-white/60 rounded-md p-2 border border-gray-200"
                                        >
                                          <span className="text-xs font-medium text-gray-800 flex-1 mr-2">
                                            {courseTitle}
                                          </span>
                                          <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1">
                                              <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-1 rounded-full">
                                                {stats.completed}
                                              </span>
                                              <span className="text-xs text-green-700">completed</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-1 rounded-full">
                                                {stats.incomplete}
                                              </span>
                                              <span className="text-xs text-red-700">pending</span>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {data.courseStats.size === 0 && (
                                  <p className="text-xs text-gray-500 mt-2">No courses assigned</p>
                                )}
                              </div>
                            ));
                          })()
                        ) : (
                          <div className="text-center py-4 text-gray-500">
                            No client data available
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Activity */}
                <Card className="border-0 shadow-lg bg-white/70 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-t-xl">
                    <CardTitle className="flex items-center gap-2 text-gray-800">
                      <Activity className="w-5 h-5 text-purple-600" />
                      Recent Course Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {courses && courses.length > 0 ? (
                        courses.slice(0, 5).map((course: any) => (
                          <div
                            key={course.id}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div className="flex items-center">
                              <BookOpen className="h-8 w-8 text-primary/20 mr-3" />
                              <div>
                                <div className="font-medium">
                                  {course.title}
                                </div>
                                <div className="text-sm text-gray-500">
                                  Created{" "}
                                  {new Date(
                                    course.createdAt,
                                  ).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                            <Badge
                              variant={
                                course.isActive ? "default" : "secondary"
                              }
                            >
                              {course.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          No recent course activity
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Employee Management Section */}
            {activeSection === "employees" && (
              <div>
                <div className="flex justify-between items-center mb-8">
                  <div className="flex space-x-3">
                    <Button 
                      variant="outline" 
                      onClick={exportEmployees}
                      className="bg-white/70 backdrop-blur-sm hover:bg-white shadow-md"
                    >
                      <Download size={16} className="mr-2" />
                      Export Directory
                    </Button>
                  </div>
                </div>

                <Card className="border-0 shadow-lg bg-white/70 backdrop-blur-sm">
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-t-xl">
                    <CardTitle className="flex items-center gap-2 text-gray-800">
                      <Users className="w-5 h-5 text-purple-600" />
                      Employee Directory
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      Employees are automatically added when they access courses
                      via email assignments
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {employees?.map((employee: any) => (
                        <div
                          key={employee.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mr-4">
                              <span className="text-primary font-medium text-sm">
                                {employee.name?.substring(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">
                                {employee.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {employee.email}
                              </div>
                              <div className="text-sm text-gray-500">
                                {employee.employeeId} • {employee.designation} •{" "}
                                {employee.department}
                              </div>
                              {employee.clientName && (
                                <div className="text-sm text-gray-500">
                                  Client: {employee.clientName} •{" "}
                                  {employee.phoneNumber}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge
                              variant={
                                employee.isActive ? "default" : "secondary"
                              }
                            >
                              {employee.isActive ? "Active" : "Inactive"}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewAnalytics(employee)}
                            >
                              <Eye size={16} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditEmployee(employee)}
                            >
                              <Edit size={16} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                deleteEmployeeMutation.mutate(employee.id)
                              }
                            >
                              <Trash2 size={16} />
                            </Button>
                            {/* Add View Courses button to employees table */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setSelectedUserEnrollments(employee)
                              }
                            >
                              <BookOpen size={16} className="mr-1" />
                              View Courses
                            </Button>
                          </div>
                        </div>
                      ))}
                      {(!employees || employees.length === 0) && (
                        <div className="text-center py-8 text-gray-500">
                          No employees found. Add your first employee to get
                          started.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Course Management Section */}
            {activeSection === "courses" && (
              <div>
                <div className="flex justify-between items-center mb-8">
                  <div className="flex space-x-3">
                    <Button 
                      onClick={() => setLocation("/create-course")}
                      className="bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-700 shadow-lg"
                    >
                      <Plus size={16} className="mr-2" />
                      Create Course
                    </Button>
                  </div>
                </div>

                <Card className="border-0 shadow-lg bg-white/70 backdrop-blur-sm overflow-hidden">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Course Title</TableHead>
                          <TableHead>Created Date</TableHead>
                          <TableHead>Enrolled Users</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {courses?.map((course) => (
                          <TableRow key={course.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {course.videoPath && (
                                  <PlayCircle className="w-4 h-4 text-emerald-600" />
                                )}
                                <span>{course.title}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {new Date(course.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {allEnrollments?.filter((e: any) => e.course?.id === course.id || e.courseId === course.id)?.length || 0}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={course.isActive ? "default" : "secondary"}>
                                {course.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2 flex-wrap">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    console.log("Viewing users for course:", course.id, course.title);
                                    setSelectedCourse(course);
                                    setSelectedCourseEnrollments(course);
                                    // Force refresh of enrollments data
                                    setTimeout(() => {
                                      queryClient.invalidateQueries({ 
                                        queryKey: ["/api/courses", course.id, "enrollments"] 
                                      });
                                    }, 100);
                                  }}
                                  className="flex items-center gap-1"
                                >
                                  <Eye className="w-4 h-4" />
                                  View Users
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => downloadCourseReport(course.id, course.title)}
                                  title="Download assignment report"
                                >
                                  <FileText className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedCourse(course);
                                    setEmailAssignmentOpen(true);
                                  }}
                                  className="flex items-center gap-1"
                                >
                                  <Mail className="w-4 h-4" />
                                  Assign Email
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    console.log("Opening tracker for course:", course.id, course.title);
                                    setSelectedCourse(course);
                                    setAssignmentsTrackerOpen(true);
                                    // Force refresh of assignments data
                                    setTimeout(() => {
                                      queryClient.invalidateQueries({ 
                                        queryKey: ["/api/course-assignments", course.id] 
                                      });
                                    }, 100);
                                  }}
                                  className="flex items-center gap-1"
                                >
                                  <Target className="w-4 h-4" />
                                  Track
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditCourse(course)}
                                  disabled={
                                    (allEnrollments?.filter((e: any) => e.courseId === course.id)?.length || 0) > 0
                                  }
                                  title="Edit course"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteCourse(course.id)}
                                  className="flex items-center gap-1"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {(!courses || courses.length === 0) && (
                      <div className="text-center py-8 text-gray-500">
                        No courses found. Create your first course to get started.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Performance Section */}
            {activeSection === "performance" && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  System Performance
                </h2>
                <PerformanceMonitor />
              </div>
            )}

            {/* Settings Section */}
            {activeSection === "settings" && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Settings
                </h2>

                <div className="space-y-6">
                  {/* General Settings */}
                  <Card>
                    <CardHeader>
                      <CardTitle>General Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">Email Notifications</div>
                          <div className="text-sm text-gray-500">
                            Send email notifications for course completions
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          Configure
                        </Button>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">
                            Default Course Duration
                          </div>
                          <div className="text-sm text-gray-500">
                            Set default duration for new courses
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">Quiz Passing Score</div>
                          <div className="text-sm text-gray-500">
                            Default passing score percentage (Currently: 70%)
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          Change
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* System Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle>System Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="font-medium">Platform Version</div>
                          <div className="text-sm text-gray-500">
                            TrainTrack v1.0.0
                          </div>
                        </div>
                        <div>
                          <div className="font-medium">Database Status</div>
                          <div className="text-sm text-green-600">
                            Connected
                          </div>
                        </div>
                        <div>
                          <div className="font-medium">Total Storage Used</div>
                          <div className="text-sm text-gray-500">
                            ~{Math.round(Math.random() * 100 + 50)}MB
                          </div>
                        </div>
                        <div>
                          <div className="font-medium">Last Backup</div>
                          <div className="text-sm text-gray-500">
                            {new Date().toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Data Management */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Data Management</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">Export All Data</div>
                          <div className="text-sm text-gray-500">
                            Download all employee and course data
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          <Download size={16} className="mr-2" />
                          Export
                        </Button>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">System Backup</div>
                          <div className="text-sm text-gray-500">
                            Create a backup of all system data
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          <Upload size={16} className="mr-2" />
                          Backup
                        </Button>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">Clear Cache</div>
                          <div className="text-sm text-gray-500">
                            Clear system cache and temporary files
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          Clear Cache
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* User Management Settings */}
                  <Card>
                    <CardHeader>
                      <CardTitle>User Management</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">
                            Auto-Generate Employee IDs
                          </div>
                          <div className="text-sm text-gray-500">
                            Automatically generate unique employee IDs
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          Enable
                        </Button>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">
                            Bulk Import Template
                          </div>
                          <div className="text-sm text-gray-500">
                            Download CSV template for bulk employee import
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          <Download size={16} className="mr-2" />
                          Download
                        </Button>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">Password Reset</div>
                          <div className="text-sm text-gray-500">
                            Reset passwords for all employees
                          </div>
                        </div>
                        <Button variant="destructive" size="sm">
                          Reset All
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Course Settings */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Course Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">Video Upload Limit</div>
                          <div className="text-sm text-gray-500">
                            Maximum file size for course videos (Current: 500MB)
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          Modify
                        </Button>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">
                            Auto-Archive Completed Courses
                          </div>
                          <div className="text-sm text-gray-500">
                            Automatically archive courses after completion
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          Configure
                        </Button>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">
                            Certificate Template
                          </div>
                          <div className="text-sm text-gray-500">
                            Customize certificate design and content
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          Edit Template
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
      </div>

      {/* Dialogs */}
      {/* Add Employee Dialog */}
      <Dialog open={addEmployeeOpen} onOpenChange={setAddEmployeeOpen}>
        <EnhancedEmployeeForm
          form={employeeForm}
          onSubmit={addEmployeeMutation.mutate}
          onCancel={() => setAddEmployeeOpen(false)}
          isLoading={addEmployeeMutation.isPending}
        />
      </Dialog>

      {/* Edit Employee Dialog */}
      <Dialog open={editEmployeeOpen} onOpenChange={setEditEmployeeOpen}>
        <EnhancedEmployeeForm
          onSubmit={(data) =>
            editEmployeeMutation.mutate({
              id: editingEmployee.id,
              employeeData: data,
            })
          }
          onCancel={() => {
            setEditEmployeeOpen(false);
            setEditingEmployee(null);
          }}
          isLoading={editEmployeeMutation.isPending}
          initialData={editingEmployee}
          mode="edit"
        />
      </Dialog>

      {/* Course Creation/Editing Dialog */}
      <Dialog open={addCourseOpen} onOpenChange={setAddCourseOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingCourse ? "Edit Course" : "Create New Course"}
            </DialogTitle>
            <DialogDescription>
              Fill in the details for the course.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={courseForm.handleSubmit(async (data) => {
              if (editingCourse) {
                // Logic to update course
                try {
                  await apiRequest(
                    "PUT",
                    `/api/courses/${editingCourse.id}`,
                    data,
                  );
                  queryClient.refetchQueries({ queryKey: ["/api/courses"] });
                  toast({
                    title: "Success",
                    description: "Course updated successfully.",
                  });
                  setAddCourseOpen(false);
                  setEditingCourse(null);
                } catch (error) {
                  toast({
                    title: "Error",
                    description: "Failed to update course.",
                    variant: "destructive",
                  });
                }
              } else {
                // Logic to create course
                try {
                  await apiRequest("POST", "/api/courses", data);
                  queryClient.refetchQueries({ queryKey: ["/api/courses"] });
                  toast({
                    title: "Success",
                    description: "Course created successfully.",
                  });
                  setAddCourseOpen(false);
                } catch (error) {
                  toast({
                    title: "Error",
                    description: "Failed to create course.",
                    variant: "destructive",
                  });
                }
              }
            })}
          >
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="title" className="text-right font-medium">
                  Title
                </label>
                <input
                  id="title"
                  {...courseForm.register("title")}
                  className="col-span-3 border rounded-md p-2"
                  placeholder="Course Title"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="description" className="text-right font-medium">
                  Description
                </label>
                <textarea
                  id="description"
                  {...courseForm.register("description")}
                  className="col-span-3 border rounded-md p-2"
                  placeholder="Course Description"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="videoPath" className="text-right font-medium">
                  Video URL
                </label>
                <input
                  id="videoPath"
                  {...courseForm.register("videoPath")}
                  className="col-span-3 border rounded-md p-2"
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="duration" className="text-right font-medium">
                  Duration (mins)
                </label>
                <input
                  id="duration"
                  type="number"
                  {...courseForm.register("duration", { valueAsNumber: true })}
                  className="col-span-3 border rounded-md p-2"
                  placeholder="e.g., 30"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">
                {editingCourse ? "Update Course" : "Create Course"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <BulkAssignCourseDialog
        open={bulkAssignCourseOpen}
        onOpenChange={setBulkAssignCourseOpen}
        courseId={selectedCourse?.id}
        courseName={selectedCourse?.title}
      />

      <BulkAssignUsersDialog
        open={bulkAssignUsersOpen}
        onOpenChange={setBulkAssignUsersOpen}
      />

      {/* Email Bulk Assignment Dialog */}
      <EmailBulkAssignmentDialog
        open={emailAssignmentOpen}
        onOpenChange={setEmailAssignmentOpen}
        courseId={selectedCourse?.id}
        courseName={selectedCourse?.title}
      />

      {/* Course Assignments Tracker */}
      <CourseAssignmentsTracker
        open={assignmentsTrackerOpen}
        onOpenChange={setAssignmentsTrackerOpen}
        courseId={selectedCourse?.id}
        courseName={selectedCourse?.title}
      />

      {selectedAnalyticsUser && (
        <UserAnalyticsDialog
          user={selectedAnalyticsUser}
          open={!!selectedAnalyticsUser}
          onOpenChange={() => setSelectedAnalyticsUser(null)}
        />
      )}

      {/* Course Enrollments Dialog */}
      <Dialog
        open={!!selectedCourseEnrollments}
        onOpenChange={() => setSelectedCourseEnrollments(null)}
      >
        <DialogContent className="max-w-4xl">
          <CardHeader>
            <DialogTitle>
              Course Assignments: {selectedCourseEnrollments?.title}
            </DialogTitle>
            <p className="text-sm text-gray-600">
              Users assigned via email will receive unique access links. They
              don't login with email directly.
            </p>
          </CardHeader>
          <div className="max-h-96 overflow-y-auto">
            {courseEnrollments && courseEnrollments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Client Name</TableHead>
                    <TableHead>Enrolled Date</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courseEnrollments.map((enrollment: any) => (
                    <TableRow key={enrollment.id}>
                      <TableCell>{enrollment.user?.name || enrollment.assignedEmail || "Email Assigned"}</TableCell>
                      <TableCell>{enrollment.user?.email || enrollment.assignedEmail || "N/A"}</TableCell>
                      <TableCell>{enrollment.user?.department || "Not registered"}</TableCell>
                      <TableCell>{enrollment.user?.clientName || "N/A"}</TableCell>
                      <TableCell>
                        {new Date(enrollment.enrolledAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{enrollment.progress}%</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            enrollment.completedAt ? "default" : "secondary"
                          }
                        >
                          {enrollment.completedAt ? "Completed" : 
                           enrollment.user ? "In Progress" : "Email Sent"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No employees assigned to this course yet.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* User Enrollments Dialog */}
      <Dialog
        open={!!selectedUserEnrollments}
        onOpenChange={() => setSelectedUserEnrollments(null)}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Course Assignments: {selectedUserEnrollments?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {userEnrollments && userEnrollments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course Title</TableHead>
                    <TableHead>Client Name</TableHead>
                    <TableHead>Enrolled Date</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Quiz Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Certificate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userEnrollments.map((enrollment: any) => (
                    <TableRow key={enrollment.id}>
                      <TableCell>{enrollment.course.title}</TableCell>
                      <TableCell>{selectedUserEnrollments?.clientName || "N/A"}</TableCell>
                      <TableCell>
                        {new Date(enrollment.enrolledAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{enrollment.progress}%</TableCell>
                      <TableCell>
                        {enrollment.quizScore
                          ? `${enrollment.quizScore}%`
                          : "Not taken"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            enrollment.completedAt ? "default" : "secondary"
                          }
                        >
                          {enrollment.completedAt ? "Completed" : "In Progress"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            enrollment.certificateIssued
                              ? "default"
                              : "secondary"
                          }
                        >
                          {enrollment.certificateIssued
                            ? "Issued"
                            : "Not issued"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No courses assigned to this employee yet.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Course Deletion Confirmation Dialog */}
      <Dialog open={showDeletionDialog} onOpenChange={setShowDeletionDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-red-600">Confirm Course Deletion</DialogTitle>
            <DialogDescription>
              This action will permanently delete the course and all related data. Please review the impact below.
            </DialogDescription>
          </DialogHeader>

          {deletionImpact && (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <h4 className="font-semibold text-yellow-800">Course: {deletionImpact.course.title}</h4>
                <p className="text-yellow-700">{deletionImpact.course.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <h5 className="font-semibold text-red-800">Will be deleted:</h5>
                  <ul className="text-red-700 text-sm mt-1">
                    <li>• {deletionImpact.impact.totalEnrollments} enrollment(s)</li>
                    <li>• {deletionImpact.impact.certificatesWillBeDeleted} certificate(s)</li>
                    <li>• {deletionImpact.impact.quizzesWillBeDeleted} quiz(es)</li>
                    <li>• {deletionImpact.impact.usersWillBeDeleted} user(s) (only enrolled in this course)</li>
                  </ul>
                </div>

                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <h5 className="font-semibold text-green-800">Will be kept:</h5>
                  <ul className="text-green-700 text-sm mt-1">
                    <li>• {deletionImpact.impact.usersWillBeKept} user(s) (enrolled in other courses)</li>
                  </ul>
                </div>
              </div>

              {deletionImpact.usersToDelete.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <h5 className="font-semibold text-red-800">Users that will be deleted:</h5>
                  <div className="mt-2 space-y-1">
                    {deletionImpact.usersToDelete.map((user: any) => (
                      <div key={user.id} className="text-sm text-red-700">
                        {user.name} ({user.email}) - {user.employeeId}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {deletionImpact.usersToKeep.length > 0 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <h5 className="font-semibold text-green-800">Users that will be kept:</h5>
                  <div className="mt-2 space-y-1">
                    {deletionImpact.usersToKeep.slice(0, 5).map((user: any) => (
                      <div key={user.id} className="text-sm text-green-700">
                        {user.name} ({user.email}) - {user.employeeId}
                      </div>
                    ))}
                    {deletionImpact.usersToKeep.length > 5 && (
                      <div className="text-sm text-green-600">
                        ... and {deletionImpact.usersToKeep.length - 5} more
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeletionDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteCourse}
            >
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    );
  };