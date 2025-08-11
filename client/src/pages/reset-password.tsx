
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
    const urlParams = new URLSearchParams(location.split("?")[1] || "");
    const tokenParam = urlParams.get("token");
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setLocation("/employee-login");
    }
  }, [location, setLocation]);

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
        newPassword: data.newPassword,
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
    resetPasswordMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-400 via-teal-500 to-blue-600 flex items-center justify-center p-4">
      <Card className="backdrop-blur-xl bg-white/15 border-white/20 shadow-2xl w-full max-w-md">
        <CardContent className="pt-8 pb-8 px-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Reset Password</h1>
            <p className="text-white/80">Enter your new password</p>
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
