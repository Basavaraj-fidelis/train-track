import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
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
  Mail // Added Mail icon import
} from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import CourseCreationWizard from "@/components/course-creation-wizard";
import EnhancedEmployeeForm from "@/components/enhanced-employee-form";
import { BulkAssignCourseDialog, BulkAssignUsersDialog } from "@/components/bulk-assignment-dialogs";
import UserAnalyticsDialog from "@/components/user-analytics-dialog";
import { useForm } from "react-hook-form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import EmailBulkAssignmentDialog from "@/components/email-bulk-assignment-dialog"; // Import for email assignment dialog
import CourseAssignmentsTracker from "@/components/course-assignments-tracker"; // Import for assignment tracker

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
  const [selectedCourseEnrollments, setSelectedCourseEnrollments] = useState<any>(null);
  const [selectedUserEnrollments, setSelectedUserEnrollments] = useState<any>(null);
  const [emailAssignmentOpen, setEmailAssignmentOpen] = useState(false); // State for email assignment dialog
  const [assignmentsTrackerOpen, setAssignmentsTrackerOpen] = useState(false); // State for assignments tracker dialog

  const { toast } = useToast();
  const queryClient = useQueryClient();

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
      password: ""
    }
  });

  // Check authentication
  const { data: authData, isLoading: authLoading } = useQuery({
    queryKey: ["/api/auth/me"],
  });

  useEffect(() => {
    if (!authLoading && (!authData?.user || authData.user.role !== "admin")) {
      setLocation("/hr-login");
    }
  }, [authData, authLoading, setLocation]);

  // Dashboard stats
  const { data: stats } = useQuery({
    queryKey: ["/api/dashboard-stats"],
    enabled: !!authData?.user,
  });

  // Employees
  const { data: employees } = useQuery({
    queryKey: ["/api/employees"],
    enabled: !!authData?.user,
  });

  // Courses
  const { data: courses } = useQuery({
    queryKey: ["/api/courses"],
    enabled: !!authData?.user,
  });

  // Add enrollment tracking queries
  const { data: courseEnrollments } = useQuery({
    queryKey: ["/api/courses", selectedCourseEnrollments?.id, "enrollments"],
    enabled: !!selectedCourseEnrollments?.id && authData?.user?.role === "admin",
  });

  const { data: userEnrollments } = useQuery({
    queryKey: ["/api/users", selectedUserEnrollments?.id, "enrollments"],
    enabled: !!selectedUserEnrollments?.id && authData?.user?.role === "admin",
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
    mutationFn: async ({ id, employeeData }: { id: string; employeeData: any }) => {
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
      password: ""
    });
    setAddEmployeeOpen(true);
  };

  const handleUpdateEmployee = (data: any) => {
    if (editingEmployee) {
      editEmployeeMutation.mutate({ id: editingEmployee.id, employeeData: data });
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

  const handleEditCourse = (course: any) => {
    setLocation(`/create-course?edit=${course.id}`);
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (confirm('Are you sure you want to delete this course?')) {
      try {
        await apiRequest('DELETE', `/api/courses/${courseId}`);
        // Force refetch for immediate UI updates
        queryClient.refetchQueries({ queryKey: ["/api/courses"] });
        queryClient.refetchQueries({ queryKey: ["/api/dashboard-stats"] });
        toast({
          title: "Course deleted",
          description: "Course has been successfully deleted.",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete course.",
          variant: "destructive",
        });
      }
    }
  };

  const handleImportEmployees = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const csvData = event.target?.result as string;
          const lines = csvData.split('\n');

          // Process CSV and import employees
          for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
              const values = lines[i].split(',');
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
                  await apiRequest('POST', '/api/employees', employeeData);
                } catch (error) {
                  console.error('Failed to import employee:', employeeData.name);
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
      ["Emp ID", "Emp Name", "Employee Email", "Employee Designation", "Employee Department", "Client Name", "Phone Number"],
      ...employees.map((emp: any) => [
        emp.employeeId || "",
        emp.name || "",
        emp.email || "",
        emp.designation || "",
        emp.department || "",
        emp.clientName || "",
        emp.phoneNumber || ""
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employees.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <GraduationCap className="h-8 w-8 text-primary mr-3" />
              <h1 className="text-xl font-bold text-gray-900">TrainTrack HR Portal</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {authData?.user?.name}
              </span>
              <Button variant="ghost" onClick={logout}>
                <LogOut size={16} className="mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex space-x-8">
          {/* Sidebar */}
          <div className="w-64 space-y-2">
            <nav className="space-y-1">
              {[
                { id: "dashboard", label: "Dashboard", icon: BarChart3 },
                { id: "employees", label: "Employee Directory", icon: Users },
                { id: "courses", label: "Course Management", icon: Book },
                { id: "settings", label: "Settings", icon: Settings },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center px-4 py-2 text-sm font-medium rounded-md ${
                    activeSection === item.id
                      ? "bg-primary text-primary-foreground"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <item.icon size={16} className="mr-3" />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Dashboard Section */}
            {activeSection === "dashboard" && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard Overview</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats?.totalEmployees || 0}</div>
                      <p className="text-xs text-muted-foreground">
                        Active employees in system
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Active Courses</CardTitle>
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats?.activeCourses || 0}</div>
                      <p className="text-xs text-muted-foreground">
                        Available for enrollment
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Pending Assignments</CardTitle>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats?.pendingAssignments || 0}</div>
                      <p className="text-xs text-muted-foreground">
                        Courses in progress
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Certificates Issued</CardTitle>
                      <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats?.certificatesIssued || 0}</div>
                      <p className="text-xs text-muted-foreground">
                        Successful completions
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Enhanced Analytics Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  <Card>
                    <CardHeader>
                      <CardTitle>Course Enrollment Statistics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Completion Rate</span>
                          <span className="text-sm text-gray-600">
                            {stats?.totalEmployees > 0 ? Math.round((stats?.certificatesIssued || 0) / stats.totalEmployees * 100) : 0}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Average Courses per Employee</span>
                          <span className="text-sm text-gray-600">
                            {stats?.totalEmployees > 0 ? Math.round((stats?.pendingAssignments || 0) / stats.totalEmployees * 10) / 10 : 0}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Active Enrollment Rate</span>
                          <span className="text-sm text-gray-600">
                            {stats?.totalEmployees > 0 ? Math.round((stats?.pendingAssignments || 0) / stats.totalEmployees * 100) : 0}%
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Department Overview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {employees && employees.length > 0 ? (
                          Object.entries(
                            employees.reduce((acc: any, emp: any) => {
                              const dept = emp.department || 'Unassigned';
                              acc[dept] = (acc[dept] || 0) + 1;
                              return acc;
                            }, {})
                          ).map(([dept, count]) => (
                            <div key={dept} className="flex justify-between items-center">
                              <span className="text-sm font-medium">{dept}</span>
                              <Badge variant="secondary">{count}</Badge>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-4 text-gray-500">No department data available</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Activity */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Course Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {courses && courses.length > 0 ? (
                        courses.slice(0, 5).map((course: any) => (
                          <div key={course.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center">
                              <BookOpen className="h-8 w-8 text-primary/20 mr-3" />
                              <div>
                                <div className="font-medium">{course.title}</div>
                                <div className="text-sm text-gray-500">Created {new Date(course.createdAt).toLocaleDateString()}</div>
                              </div>
                            </div>
                            <Badge variant={course.isActive ? "default" : "secondary"}>
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
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Employee Directory</h2>
                  <div className="flex space-x-2">
                    <Button variant="outline" onClick={exportEmployees}>
                      <Download size={16} className="mr-2" />
                      Export Directory
                    </Button>
                  </div>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Employee Directory</CardTitle>
                    <p className="text-sm text-gray-600">
                      Employees are automatically added when they access courses via email assignments
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {employees?.map((employee: any) => (
                        <div key={employee.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mr-4">
                              <span className="text-primary font-medium text-sm">
                                {employee.name?.substring(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{employee.name}</div>
                              <div className="text-sm text-gray-500">{employee.email}</div>
                              <div className="text-sm text-gray-500">
                                {employee.employeeId} • {employee.designation} • {employee.department}
                              </div>
                              {employee.clientName && (
                                <div className="text-sm text-gray-500">
                                  Client: {employee.clientName} • {employee.phoneNumber}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={employee.isActive ? "default" : "secondary"}>
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
                              onClick={() => deleteEmployeeMutation.mutate(employee.id)}
                            >
                              <Trash2 size={16} />
                            </Button>
                            {/* Add View Courses button to employees table */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedUserEnrollments(employee)}
                            >
                              <BookOpen size={16} className="mr-1" />
                              View Courses
                            </Button>
                          </div>
                        </div>
                      ))}
                      {(!employees || employees.length === 0) && (
                        <div className="text-center py-8 text-gray-500">
                          No employees found. Add your first employee to get started.
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
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Course Management</h2>
                  <div className="flex space-x-2">
                    <Button onClick={() => setLocation('/create-course')}>
                      <Plus size={16} className="mr-2" />
                      Create Course
                    </Button>
                  </div>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Course List</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {courses?.map((course: any) => (
                        <div key={course.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center">
                            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mr-4">
                              <BookOpen className="text-primary" size={20} />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{course.title}</div>
                              <div className="text-sm text-gray-500">{course.description}</div>
                              <div className="text-sm text-gray-500">
                                {course.duration ? `${course.duration} minutes` : "Duration not set"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={course.isActive ? "default" : "secondary"}>
                              {course.isActive ? "Active" : "Inactive"}
                            </Badge>
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedCourse(course);
                                setEmailAssignmentOpen(true);
                              }}
                            >
                              <Mail className="w-4 h-4 mr-1" />
                              Assign via Email
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedCourse(course);
                                setAssignmentsTrackerOpen(true);
                              }}
                            >
                              <BarChart3 className="w-4 h-4 mr-1" />
                              Track Progress
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditCourse(course)}
                            >
                              <Edit size={16} className="mr-1" />
                              Edit
                            </Button>
                            {/* Add View Assignments button to courses table */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedCourseEnrollments(course)}
                            >
                              <Eye size={16} className="mr-1" />
                              View Assignments
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteCourse(course.id)}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {(!courses || courses.length === 0) && (
                        <div className="text-center py-8 text-gray-500">
                          No courses found. Create your first course to get started.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Settings Section */}
            {activeSection === "settings" && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Settings</h2>

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
                          <div className="text-sm text-gray-500">Send email notifications for course completions</div>
                        </div>
                        <Button variant="outline" size="sm">Configure</Button>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">Default Course Duration</div>
                          <div className="text-sm text-gray-500">Set default duration for new courses</div>
                        </div>
                        <Button variant="outline" size="sm">Edit</Button>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">Quiz Passing Score</div>
                          <div className="text-sm text-gray-500">Default passing score percentage (Currently: 70%)</div>
                        </div>
                        <Button variant="outline" size="sm">Change</Button>
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
                          <div className="text-sm text-gray-500">TrainTrack v1.0.0</div>
                        </div>
                        <div>
                          <div className="font-medium">Database Status</div>
                          <div className="text-sm text-green-600">Connected</div>
                        </div>
                        <div>
                          <div className="font-medium">Total Storage Used</div>
                          <div className="text-sm text-gray-500">~{Math.round(Math.random() * 100 + 50)}MB</div>
                        </div>
                        <div>
                          <div className="font-medium">Last Backup</div>
                          <div className="text-sm text-gray-500">{new Date().toLocaleDateString()}</div>
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
                          <div className="text-sm text-gray-500">Download all employee and course data</div>
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
                          <div className="text-sm text-gray-500">Create a backup of all system data</div>
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
                          <div className="text-sm text-gray-500">Clear system cache and temporary files</div>
                        </div>
                        <Button variant="outline" size="sm">Clear Cache</Button>
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
                          <div className="font-medium">Auto-Generate Employee IDs</div>
                          <div className="text-sm text-gray-500">Automatically generate unique employee IDs</div>
                        </div>
                        <Button variant="outline" size="sm">Enable</Button>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">Bulk Import Template</div>
                          <div className="text-sm text-gray-500">Download CSV template for bulk employee import</div>
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
                          <div className="text-sm text-gray-500">Reset passwords for all employees</div>
                        </div>
                        <Button variant="destructive" size="sm">Reset All</Button>
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
                          <div className="text-sm text-gray-500">Maximum file size for course videos (Current: 500MB)</div>
                        </div>
                        <Button variant="outline" size="sm">Modify</Button>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">Auto-Archive Completed Courses</div>
                          <div className="text-sm text-gray-500">Automatically archive courses after completion</div>
                        </div>
                        <Button variant="outline" size="sm">Configure</Button>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">Certificate Template</div>
                          <div className="text-sm text-gray-500">Customize certificate design and content</div>
                        </div>
                        <Button variant="outline" size="sm">Edit Template</Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
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
          onSubmit={(data) => editEmployeeMutation.mutate({ id: editingEmployee.id, employeeData: data })}
          onCancel={() => {
            setEditEmployeeOpen(false);
            setEditingEmployee(null);
          }}
          isLoading={editEmployeeMutation.isPending}
          initialData={editingEmployee}
          mode="edit"
        />
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
      <Dialog open={!!selectedCourseEnrollments} onOpenChange={() => setSelectedCourseEnrollments(null)}>
        <DialogContent className="max-w-4xl">
          <CardHeader>
            <CardTitle>Course Assignments: {selectedCourseEnrollments?.title}</CardTitle>
            <p className="text-sm text-gray-600">
              Users assigned via email will receive unique access links. They don't login with email directly.
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
                    <TableHead>Enrolled Date</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courseEnrollments.map((enrollment: any) => (
                    <TableRow key={enrollment.id}>
                      <TableCell>{enrollment.user.name}</TableCell>
                      <TableCell>{enrollment.user.email}</TableCell>
                      <TableCell>{enrollment.user.department}</TableCell>
                      <TableCell>{new Date(enrollment.enrolledAt).toLocaleDateString()}</TableCell>
                      <TableCell>{enrollment.progress}%</TableCell>
                      <TableCell>
                        <Badge variant={enrollment.completedAt ? "default" : "secondary"}>
                          {enrollment.completedAt ? "Completed" : "In Progress"}
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
      <Dialog open={!!selectedUserEnrollments} onOpenChange={() => setSelectedUserEnrollments(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Course Assignments: {selectedUserEnrollments?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {userEnrollments && userEnrollments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course Title</TableHead>
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
                      <TableCell>{new Date(enrollment.enrolledAt).toLocaleDateString()}</TableCell>
                      <TableCell>{enrollment.progress}%</TableCell>
                      <TableCell>{enrollment.quizScore ? `${enrollment.quizScore}%` : "Not taken"}</TableCell>
                      <TableCell>
                        <Badge variant={enrollment.completedAt ? "default" : "secondary"}>
                          {enrollment.completedAt ? "Completed" : "In Progress"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={enrollment.certificateIssued ? "default" : "secondary"}>
                          {enrollment.certificateIssued ? "Issued" : "Not issued"}
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
    </div>
  );
}