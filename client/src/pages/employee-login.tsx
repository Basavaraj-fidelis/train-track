import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, ArrowLeft, Mail } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function EmployeeLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      const response = await apiRequest("POST", "/api/auth/employee-login", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Welcome!",
        description: "Successfully accessed your training portal",
      });
      setLocation("/employee-dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Access denied",
        description: error.message || "Email not found or not authorized. Please contact HR.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-400 via-teal-500 to-blue-600 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2334D399' fill-opacity='0.05'%3E%3Cpath d='M20 20c0-5.5-4.5-10-10-10s-10 4.5-10 10 4.5 10 10 10 10 4.5 10 10-4.5 10-10 10-10-4.5-10-10 4.5-10 10-10 10 4.5 10 10z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}
      ></div>

      <div className="relative w-full max-w-md">
        {/* Glass Card Effect */}
        <Card className="backdrop-blur-xl bg-white/15 border-white/20 shadow-2xl">
          <CardContent className="pt-8 pb-8 px-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-white/20 to-white/10 rounded-2xl mb-6 shadow-lg backdrop-blur-sm">
                <GraduationCap className="text-white" size={28} />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Training Portal
              </h1>
              <p className="text-white/80 text-lg">
                Employee Access
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/90 font-medium">
                  Company Email
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="john.doe@company.com"
                    {...register("email")}
                    className={`bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20 h-12 pl-12 ${
                      errors.email ? "border-red-300" : ""
                    }`}
                  />
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" size={18} />
                </div>
                {errors.email && (
                  <p className="text-red-200 text-sm mt-1">{errors.email.message}</p>
                )}
                <p className="text-white/70 text-sm mt-2">
                  Your email must be registered by HR to access courses
                </p>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 bg-white/20 hover:bg-white/30 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 backdrop-blur-sm border border-white/20"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Accessing portal...</span>
                  </div>
                ) : (
                  "Access Portal"
                )}
              </Button>
            </form>

            {/* Info Card */}
            <div className="mt-6 p-4 bg-white/10 border border-white/20 rounded-lg backdrop-blur-sm">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-emerald-300 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="text-white/90 text-sm font-medium mb-1">Need Access?</p>
                  <p className="text-white/70 text-sm">
                    Contact your HR administrator to get registered for training courses.
                  </p>
                </div>
              </div>
            </div>

            {/* Back Link */}
            <div className="text-center mt-8">
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10">
                  <ArrowLeft size={16} className="mr-2" />
                  Back to home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}