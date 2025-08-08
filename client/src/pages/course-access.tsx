
import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Calendar, Clock, User, Building, Phone, Mail } from "lucide-react";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  employeeId: z.string().min(1, "Employee ID is required"),
  designation: z.string().min(1, "Designation is required"),
  department: z.string().min(1, "Department is required"),
  clientName: z.string().min(1, "Client name is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
});

type ProfileForm = z.infer<typeof profileSchema>;

export default function CourseAccess() {
  const [match, params] = useRoute("/course-access/:token");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isFirstTime, setIsFirstTime] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
  });

  // Fetch course access data
  const { data: accessData, isLoading, error } = useQuery({
    queryKey: ["/api/course-access", params?.token],
    queryFn: async () => {
      if (!params?.token) throw new Error("No token provided");
      const response = await apiRequest("GET", `/api/course-access/${params.token}`);
      return response.json();
    },
    enabled: !!params?.token,
  });

  const completeProfileMutation = useMutation({
    mutationFn: async (data: ProfileForm) => {
      const response = await apiRequest("POST", "/api/complete-profile", {
        token: params?.token,
        userData: data,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile completed successfully",
        description: "You can now access the course",
      });
      setLocation("/employee-dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to complete profile",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const loginExistingUserMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/employee-login", {
        email: accessData.enrollment.assignedEmail,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Welcome back!",
        description: "You can now access your courses",
      });
      setLocation("/employee-dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Login failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (accessData) {
      setIsFirstTime(accessData.isFirstTime);
      if (!accessData.isFirstTime && accessData.existingUser) {
        // User already exists, automatically log them in
        loginExistingUserMutation.mutate();
      }
    }
  }, [accessData]);

  const onSubmit = (data: ProfileForm) => {
    completeProfileMutation.mutate(data);
  };

  if (!match) {
    return <div>Invalid URL</div>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading course access...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="text-red-600 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Access Error</h2>
            <p className="text-gray-600 mb-4">
              {error.message || "Invalid or expired access link"}
            </p>
            <Button onClick={() => setLocation("/")} variant="outline">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!accessData) {
    return <div>No access data available</div>;
  }

  const { course, enrollment } = accessData;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white p-4">
      <div className="max-w-2xl mx-auto">
        {isFirstTime ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-center text-2xl text-blue-600">
                Complete Your Profile
              </CardTitle>
              <div className="text-center">
                <p className="text-gray-600 mb-4">
                  You've been assigned to complete the training course:
                </p>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-bold text-blue-800">{course?.title}</h3>
                  <p className="text-blue-600 text-sm">{course?.description}</p>
                  {enrollment?.deadline && (
                    <div className="flex items-center justify-center mt-2 text-sm text-blue-600">
                      <Calendar size={16} className="mr-1" />
                      Deadline: {new Date(enrollment.deadline).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      {...register("name")}
                      placeholder="John Doe"
                      className={errors.name ? "border-destructive" : ""}
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="employeeId">Employee ID *</Label>
                    <Input
                      id="employeeId"
                      {...register("employeeId")}
                      placeholder="EMP001"
                      className={errors.employeeId ? "border-destructive" : ""}
                    />
                    {errors.employeeId && (
                      <p className="text-sm text-destructive mt-1">{errors.employeeId.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="designation">Designation *</Label>
                    <Input
                      id="designation"
                      {...register("designation")}
                      placeholder="Software Engineer"
                      className={errors.designation ? "border-destructive" : ""}
                    />
                    {errors.designation && (
                      <p className="text-sm text-destructive mt-1">{errors.designation.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="department">Department *</Label>
                    <Input
                      id="department"
                      {...register("department")}
                      placeholder="Engineering"
                      className={errors.department ? "border-destructive" : ""}
                    />
                    {errors.department && (
                      <p className="text-sm text-destructive mt-1">{errors.department.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="clientName">Client Name *</Label>
                    <Input
                      id="clientName"
                      {...register("clientName")}
                      placeholder="ABC Corporation"
                      className={errors.clientName ? "border-destructive" : ""}
                    />
                    {errors.clientName && (
                      <p className="text-sm text-destructive mt-1">{errors.clientName.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="phoneNumber">Phone Number *</Label>
                    <Input
                      id="phoneNumber"
                      {...register("phoneNumber")}
                      placeholder="+1-555-0123"
                      className={errors.phoneNumber ? "border-destructive" : ""}
                    />
                    {errors.phoneNumber && (
                      <p className="text-sm text-destructive mt-1">{errors.phoneNumber.message}</p>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <strong>Email:</strong> {enrollment?.assignedEmail}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    This will be your login email for future access.
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={completeProfileMutation.isPending}
                >
                  {completeProfileMutation.isPending ? "Creating Profile..." : "Complete Profile & Access Course"}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-green-600 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Welcome Back, {accessData?.existingUser?.name}!
              </h2>
              <p className="text-gray-600 mb-4">
                You've been assigned a new course. Logging you in automatically...
              </p>
              {course && (
                <div className="bg-blue-50 p-4 rounded-lg mt-4">
                  <h3 className="font-bold text-blue-800">{course.title}</h3>
                  <p className="text-blue-600 text-sm">{course.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
