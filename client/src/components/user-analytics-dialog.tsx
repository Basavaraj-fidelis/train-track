import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Trophy, Clock, Target } from "lucide-react";

interface UserAnalyticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  userName?: string;
}

export default function UserAnalyticsDialog({ 
  open, 
  onOpenChange, 
  userId, 
  userName 
}: UserAnalyticsDialogProps) {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["/api/user-analytics", userId],
    enabled: open && !!userId,
  });

  const completionRate = analytics ? Math.round((analytics.completedCourses / analytics.totalCourses) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Analytics for {userName}</DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : analytics ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.totalCourses}</div>
                  <p className="text-xs text-muted-foreground">
                    Enrolled courses
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completed</CardTitle>
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.completedCourses}</div>
                  <p className="text-xs text-muted-foreground">
                    Courses completed
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.inProgressCourses}</div>
                  <p className="text-xs text-muted-foreground">
                    Currently learning
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Certificates</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.certificatesEarned}</div>
                  <p className="text-xs text-muted-foreground">
                    Earned certificates
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Course Completion Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Progress</span>
                    <span>{completionRate}%</span>
                  </div>
                  <Progress value={completionRate} className="w-full" />
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>{analytics.completedCourses} completed</span>
                    <span>{analytics.totalCourses} total</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Average Quiz Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-4">
                  <div className="text-3xl font-bold text-primary">
                    {analytics.averageScore}%
                  </div>
                  <Badge variant={analytics.averageScore >= 80 ? "default" : analytics.averageScore >= 60 ? "secondary" : "destructive"}>
                    {analytics.averageScore >= 80 ? "Excellent" : analytics.averageScore >= 60 ? "Good" : "Needs Improvement"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No analytics data available for this user.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}