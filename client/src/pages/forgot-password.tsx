
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [emailSent, setEmailSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordForm) => {
      const response = await apiRequest("POST", "/api/auth/forgot-password", data);
      return response.json();
    },
    onSuccess: () => {
      setEmailSent(true);
      toast({
        title: "Email sent",
        description: "If an account exists with this email, you'll receive a password reset link.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send reset email. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ForgotPasswordForm) => {
    forgotPasswordMutation.mutate(data);
  };

  if (emailSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-400 via-teal-500 to-blue-600 flex items-center justify-center p-4">
        <Card className="backdrop-blur-xl bg-white/15 border-white/20 shadow-2xl w-full max-w-md">
          <CardContent className="pt-8 pb-8 px-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-white/20 to-white/10 rounded-2xl mb-6 shadow-lg backdrop-blur-sm">
              <Mail className="text-white" size={28} />
            </div>
            <h1 className="text-2xl font-bold text-white mb-4">Check Your Email</h1>
            <p className="text-white/80 mb-6">
              If an account exists with this email, you'll receive a password reset link shortly.
            </p>
            <Link href="/employee-login">
              <Button className="w-full h-12 bg-white/20 hover:bg-white/30 text-white font-semibold">
                Back to Login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-400 via-teal-500 to-blue-600 flex items-center justify-center p-4">
      <Card className="backdrop-blur-xl bg-white/15 border-white/20 shadow-2xl w-full max-w-md">
        <CardContent className="pt-8 pb-8 px-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Forgot Password</h1>
            <p className="text-white/80">Enter your email to receive a reset link</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/90 font-medium">
                Email Address
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
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 bg-white/20 hover:bg-white/30 text-white font-semibold"
              disabled={forgotPasswordMutation.isPending}
            >
              {forgotPasswordMutation.isPending ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>

          <div className="text-center mt-6">
            <Link href="/employee-login">
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10">
                <ArrowLeft size={16} className="mr-2" />
                Back to login
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
