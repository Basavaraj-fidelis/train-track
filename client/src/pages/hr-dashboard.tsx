import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  Play
} from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import FileUpload from "@/components/file-upload";

const addEmployeeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  department: z.string().min(1, "Department is required"),
  position: z.string().min(1, "Position is required"),
});

const addCourseSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  duration: z.string().min(1, "Duration is required"),
});

type AddEmployeeForm = z.infer<typeof addEmployeeSchema>;
type AddCourseForm = z.infer<typeof addCourseSchema>;

export default function HRDashboard() {
  const [, setLocation] = useLocation();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const [addCourseOpen, setAddCourseOpen] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  // Add employee form
  const employeeForm = useForm<AddEmployeeForm>({
    resolver: zodResolver(addEmployeeSchema),
  });

  // Add course form
  const courseForm = useForm<AddCourseForm>({
    resolver: zodResolver(addCourseSchema),
  });

  // Mutations
  const addEmployeeMutation = useMutation({
    mutationFn: async (data: AddEmployeeForm) => {
      const response = await apiRequest("POST", "/api/employees", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      setAddEmployeeOpen(false);
      employeeForm.reset();
      toast({
        title: "Employee added",
        description: "Employee has been successfully added to the system.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add employee. Please try again.",
        variant: "destructive",
      });
    },
  });

  const addCourseMutation = useMutation({
    mutationFn: async (data: AddCourseForm & { video?: File }) => {
      const formData = new FormData();
      formData.append("title", data.title);
      formData.append("description", data.description);
      formData.append("duration", data.duration);
      if (data.video) {
        formData.append("video", data.video);
      }

      const response = await fetch("/api/courses", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to create course");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      setAddCourseOpen(false);
      courseForm.reset();
      setVideoFile(null);
      toast({
        title: "Course created",
        description: "Course has been successfully created.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create course. Please try again.",
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
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      toast({
        title: "Employee removed",
        description: "Employee has been removed from the system.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove employee. Please try again.",
        variant: "destructive",
      });
    },
  });

  const logout = () => {
    apiRequest("POST", "/api/auth/logout");
    setLocation("/");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  const onAddEmployee = (data: AddEmployeeForm) => {
    addEmployeeMutation.mutate(data);
  };

  const onAddCourse = (data: AddCourseForm) => {
    addCourseMutation.mutate({ ...data, video: videoFile || undefined });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className="w-64 bg-white shadow-sm border-r border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mr-3">
                <GraduationCap className="text-white" size={16} />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">TrainTrack</h2>
                <p className="text-xs text-gray-500">HR Admin</p>
              </div>
            </div>
          </div>

          <nav className="p-4">
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => setActiveSection("dashboard")}
                  className={`sidebar-item flex items-center px-4 py-3 text-gray-700 rounded-lg w-full text-left ${
                    activeSection === "dashboard" ? "bg-primary/10 text-primary" : ""
                  }`}
                >
                  <BarChart3 size={16} className="mr-3" />
                  Dashboard
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveSection("users")}
                  className={`sidebar-item flex items-center px-4 py-3 text-gray-700 rounded-lg w-full text-left ${
                    activeSection === "users" ? "bg-primary/10 text-primary" : ""
                  }`}
                >
                  <Users size={16} className="mr-3" />
                  User Management
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveSection("courses")}
                  className={`sidebar-item flex items-center px-4 py-3 text-gray-700 rounded-lg w-full text-left ${
                    activeSection === "courses" ? "bg-primary/10 text-primary" : ""
                  }`}
                >
                  <Book size={16} className="mr-3" />
                  Course Management
                </button>
              </li>
            </ul>
          </nav>

          <div className="absolute bottom-4 left-4 right-4">
            <Button variant="ghost" onClick={logout} className="w-full justify-start">
              <LogOut size={16} className="mr-3" />
              Logout
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {activeSection === "dashboard" && "Dashboard"}
                  {activeSection === "users" && "User Management"}
                  {activeSection === "courses" && "Course Management"}
                </h1>
                <p className="text-gray-600">Welcome back, Admin</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">A</span>
                </div>
              </div>
            </div>
          </header>

          {/* Dashboard Content */}
          <main className="p-8">
            {activeSection === "dashboard" && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mr-4">
                          <Users className="text-primary" size={24} />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Total Employees</p>
                          <p className="text-2xl font-bold text-gray-900">{stats?.totalEmployees || 0}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                          <Book className="text-green-600" size={24} />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Active Courses</p>
                          <p className="text-2xl font-bold text-gray-900">{stats?.activeCourses || 0}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mr-4">
                          <Clock className="text-yellow-600" size={24} />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Pending Assignments</p>
                          <p className="text-2xl font-bold text-gray-900">{stats?.pendingAssignments || 0}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                          <Tag className="text-green-600" size={24} />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Certificates Issued</p>
                          <p className="text-2xl font-bold text-gray-900">{stats?.certificatesIssued || 0}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {activeSection === "users" && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">User Management</h2>
                  <Dialog open={addEmployeeOpen} onOpenChange={setAddEmployeeOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus size={16} className="mr-2" />
                        Add Employee
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Employee</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={employeeForm.handleSubmit(onAddEmployee)} className="space-y-4">
                        <div>
                          <Label htmlFor="name">Full Name</Label>
                          <Input
                            id="name"
                            {...employeeForm.register("name")}
                            className={employeeForm.formState.errors.name ? "border-destructive" : ""}
                          />
                          {employeeForm.formState.errors.name && (
                            <p className="text-sm text-destructive mt-1">
                              {employeeForm.formState.errors.name.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            {...employeeForm.register("email")}
                            className={employeeForm.formState.errors.email ? "border-destructive" : ""}
                          />
                          {employeeForm.formState.errors.email && (
                            <p className="text-sm text-destructive mt-1">
                              {employeeForm.formState.errors.email.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="department">Department</Label>
                          <Input
                            id="department"
                            {...employeeForm.register("department")}
                            className={employeeForm.formState.errors.department ? "border-destructive" : ""}
                          />
                          {employeeForm.formState.errors.department && (
                            <p className="text-sm text-destructive mt-1">
                              {employeeForm.formState.errors.department.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="position">Position</Label>
                          <Input
                            id="position"
                            {...employeeForm.register("position")}
                            className={employeeForm.formState.errors.position ? "border-destructive" : ""}
                          />
                          {employeeForm.formState.errors.position && (
                            <p className="text-sm text-destructive mt-1">
                              {employeeForm.formState.errors.position.message}
                            </p>
                          )}
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button type="button" variant="outline" onClick={() => setAddEmployeeOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={addEmployeeMutation.isPending}>
                            {addEmployeeMutation.isPending ? "Adding..." : "Add Employee"}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Employees</CardTitle>
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
                                {employee.department} • {employee.position}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={employee.isActive ? "default" : "secondary"}>
                              {employee.isActive ? "Active" : "Inactive"}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteEmployeeMutation.mutate(employee.id)}
                            >
                              <Trash2 size={16} />
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

            {activeSection === "courses" && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Course Management</h2>
                  <Dialog open={addCourseOpen} onOpenChange={setAddCourseOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus size={16} className="mr-2" />
                        Create Course
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Create New Course</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={courseForm.handleSubmit(onAddCourse)} className="space-y-4">
                        <div>
                          <Label htmlFor="title">Course Title</Label>
                          <Input
                            id="title"
                            {...courseForm.register("title")}
                            className={courseForm.formState.errors.title ? "border-destructive" : ""}
                          />
                          {courseForm.formState.errors.title && (
                            <p className="text-sm text-destructive mt-1">
                              {courseForm.formState.errors.title.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="description">Description</Label>
                          <Textarea
                            id="description"
                            {...courseForm.register("description")}
                            className={courseForm.formState.errors.description ? "border-destructive" : ""}
                          />
                          {courseForm.formState.errors.description && (
                            <p className="text-sm text-destructive mt-1">
                              {courseForm.formState.errors.description.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="duration">Duration (minutes)</Label>
                          <Input
                            id="duration"
                            type="number"
                            {...courseForm.register("duration")}
                            className={courseForm.formState.errors.duration ? "border-destructive" : ""}
                          />
                          {courseForm.formState.errors.duration && (
                            <p className="text-sm text-destructive mt-1">
                              {courseForm.formState.errors.duration.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label>Course Video</Label>
                          <FileUpload onFileSelect={setVideoFile} accept="video/*" />
                          {videoFile && (
                            <p className="text-sm text-gray-600 mt-2">Selected: {videoFile.name}</p>
                          )}
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button type="button" variant="outline" onClick={() => setAddCourseOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={addCourseMutation.isPending}>
                            {addCourseMutation.isPending ? "Creating..." : "Create Course"}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {courses?.map((course: any) => (
                    <Card key={course.id} className="hover:shadow-lg transition-shadow">
                      <CardContent className="pt-6">
                        <div className="w-full h-40 bg-gray-200 rounded-lg mb-4 relative overflow-hidden flex items-center justify-center">
                          <Play className="text-gray-400" size={48} />
                          {course.duration && (
                            <div className="absolute top-2 right-2 bg-primary text-white px-2 py-1 rounded text-xs">
                              {course.duration} min
                            </div>
                          )}
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{course.title}</h3>
                        <p className="text-gray-600 text-sm mb-4 line-clamp-2">{course.description}</p>
                        <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                          <span>
                            <Clock size={12} className="inline mr-1" />
                            Created: {new Date(course.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm" className="flex-1">
                            <Edit size={14} className="mr-1" />
                            Edit
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1">
                            Assign
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {(!courses || courses.length === 0) && (
                    <div className="col-span-full text-center py-12 text-gray-500">
                      No courses found. Create your first course to get started.
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
