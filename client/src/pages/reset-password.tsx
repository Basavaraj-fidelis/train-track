
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export default function ResetPassword() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [token, setToken] = useState<string>("");

  useEffect(() => {
    console.log('Reset Password - Current location:', location);
    
    // Try multiple ways to extract the token
    const currentUrl = window.location.href;
    console.log('Full URL:', currentUrl);
    
    // Method 1: From window.location.search
    const urlParams1 = new URLSearchParams(window.location.search);
    const tokenParam1 = urlParams1.get("token");
    
    // Method 2: From location state
    const urlParams2 = new URLSearchParams(location.split("?")[1] || "");
    const tokenParam2 = urlParams2.get("token");
    
    console.log('Token method 1 (window.location.search):', tokenParam1);
    console.log('Token method 2 (location split):', tokenParam2);
    
    const tokenParam = tokenParam1 || tokenParam2;
    
    if (tokenParam && tokenParam.trim()) {
      console.log('Token found:', tokenParam);
      setToken(tokenParam.trim());
    } else {
      console.log('No valid token found, redirecting to login');
      toast({
        title: "Invalid Reset Link",
        description: "The password reset link is invalid or has expired.",
        variant: "destructive",
      });
      setTimeout(() => setLocation("/employee-login"), 2000);
    }
  }, [location, setLocation, toast]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPasswordForm) => {
      const response = await apiRequest("POST", "/api/auth/reset-password", {
        token,
        password: data.newPassword,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Your password has been reset successfully.",
      });
      setLocation("/employee-login");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reset password.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ResetPasswordForm) => {
    if (!token || !token.trim()) {
      toast({
        title: "Error",
        description: "Invalid reset token. Please request a new password reset.",
        variant: "destructive",
      });
      return;
    }
    resetPasswordMutation.mutate(data);
  };

  // If no token is found after initial load, show error state
  if (!token && location.includes('/reset-password')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-400 via-teal-500 to-blue-600 flex items-center justify-center p-4">
        <Card className="backdrop-blur-xl bg-white/15 border-white/20 shadow-2xl w-full max-w-md">
          <CardContent className="pt-8 pb-8 px-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-white mb-2">Invalid Reset Link</h1>
              <p className="text-white/80">This password reset link is invalid or has expired.</p>
            </div>
            <div className="text-center">
              <Button 
                onClick={() => setLocation("/forgot-password")}
                className="w-full h-12 bg-white/20 hover:bg-white/30 text-white font-semibold"
              >
                Request New Reset Link
              </Button>
            </div>
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
            <h1 className="text-2xl font-bold text-white mb-2">Reset Password</h1>
            <p className="text-white/80">Enter your new password</p>
            {process.env.NODE_ENV === 'development' && (
              <div className="text-xs text-white/60 mt-2">
                Debug: Token = {token || 'No token'}<br/>
                Location = {location}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-white/90 font-medium">
                New Password
              </Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Enter new password"
                {...register("newPassword")}
                className={`bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20 h-12 ${
                  errors.newPassword ? "border-red-300" : ""
                }`}
              />
              {errors.newPassword && (
                <p className="text-red-200 text-sm mt-1">{errors.newPassword.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-white/90 font-medium">
                Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                {...register("confirmPassword")}
                className={`bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20 h-12 ${
                  errors.confirmPassword ? "border-red-300" : ""
                }`}
              />
              {errors.confirmPassword && (
                <p className="text-red-200 text-sm mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 bg-white/20 hover:bg-white/30 text-white font-semibold"
              disabled={resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
