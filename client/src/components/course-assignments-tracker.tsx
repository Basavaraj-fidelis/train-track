import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { BarChart3, Mail, RefreshCw, Eye, Users } from "lucide-react";

interface CourseAssignmentsTrackerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId?: string;
  courseName?: string;
}

export default function CourseAssignmentsTracker({
  open,
  onOpenChange,
  courseId,
  courseName
}: CourseAssignmentsTrackerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: assignments, isLoading, refetch, error } = useQuery({
    queryKey: ["/api/course-assignments", courseId],
    enabled: open && !!courseId,
    queryFn: async () => {
      console.log(`Fetching assignments for course: ${courseId}`);
      const response = await apiRequest("GET", `/api/course-assignments/${courseId}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to fetch assignments: ${response.status} - ${errorText}`);
        throw new Error(`Failed to fetch assignments: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      console.log(`Received ${Array.isArray(data) ? data.length : 0} assignments:`, data);
      
      // Validate and clean the data
      if (!Array.isArray(data)) {
        console.warn('Expected array but received:', typeof data, data);
        return [];
      }
      
      // Ensure each assignment has required fields
      const validatedData = data.map((assignment, index) => {
        if (!assignment || typeof assignment !== 'object') {
          console.warn(`Assignment at index ${index} is invalid:`, assignment);
          return null;
        }
        
        return {
          id: assignment.id || `temp-${index}`,
          courseId: assignment.courseId || courseId,
          userId: assignment.userId || null,
          assignedEmail: assignment.assignedEmail || '',
          enrolledAt: assignment.enrolledAt || null,
          progress: Math.max(0, Math.min(100, assignment.progress || 0)),
          quizScore: assignment.quizScore || null,
          certificateIssued: assignment.certificateIssued || false,
          remindersSent: assignment.remindersSent || 0,
          deadline: assignment.deadline || null,
          status: assignment.status || 'pending',
          completedAt: assignment.completedAt || null,
          user: assignment.user || null,
        };
      }).filter(Boolean);
      
      console.log(`Validated ${validatedData.length} assignments`);
      return validatedData;
    },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
  });

  const sendRemindersMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/send-reminders/${courseId}`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/course-assignments", courseId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send reminders",
        variant: "destructive",
      });
    },
  });

  const sendReminder = useMutation({
    mutationFn: async (enrollmentId: string) => {
      const response = await fetch(`/api/enrollments/${enrollmentId}/send-reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to send reminder');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Reminder sent",
        description: "Email reminder has been sent successfully.",
      });
      // Refetch data to update UI
      queryClient.invalidateQueries({ queryKey: ['/api/course-assignments', courseId] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard-stats'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send reminder",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: "secondary" as const, label: "Pending" },
      accessed: { variant: "default" as const, label: "Accessed" },
      completed: { variant: "default" as const, label: "Completed" },
      expired: { variant: "destructive" as const, label: "Expired" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const pendingCount = assignments?.filter(assignment => 
    assignment && 
    !assignment.certificateIssued && 
    assignment.status !== "expired" &&
    (!assignment.completedAt || assignment.progress < 100)
  )?.length || 0;
  const completedCount = assignments?.filter((a: any) => 
    a && (a.certificateIssued || (a.completedAt && a.progress >= 100))
  )?.length || 0;
  const expiredCount = assignments?.filter((a: any) => 
    a && (a.status === "expired" || 
    (a.deadline && new Date(a.deadline) < new Date() && !a.certificateIssued))
  )?.length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 size={20} />
            Course Assignment Tracker: {courseName}
          </DialogTitle>
          <DialogDescription>
            Track assignment progress, view user details, and send reminders for this course.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{assignments?.length || 0}</div>
              <div className="text-sm text-blue-800">Total Assigned</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
              <div className="text-sm text-yellow-800">Pending</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{completedCount}</div>
              <div className="text-sm text-green-800">Completed</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{expiredCount}</div>
              <div className="text-sm text-red-800">Expired</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center">
            <div className="flex space-x-2">
              <Button
                onClick={() => sendRemindersMutation.mutate()}
                disabled={sendRemindersMutation.isPending || pendingCount === 0}
                size="sm"
              >
                <Mail size={16} className="mr-2" />
                {sendRemindersMutation.isPending ? "Sending..." : "Send Reminders"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  console.log("Refreshing course assignments...");
                  refetch();
                  queryClient.invalidateQueries({ queryKey: ["/api/course-assignments", courseId] });
                }}
                size="sm"
              >
                <RefreshCw size={16} className="mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Assignments Table */}
          <div className="border rounded-lg">
            {isLoading ? (
              <div className="p-8 text-center">Loading assignments...</div>
            ) : error ? (
              <div className="p-8 text-center text-red-500">
                <p>Error loading assignments: {error.message}</p>
                <Button 
                  variant="outline" 
                  onClick={() => refetch()} 
                  className="mt-4"
                >
                  Retry
                </Button>
              </div>
            ) : assignments && assignments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>User Name</TableHead>
                    <TableHead>Client Name</TableHead>
                    <TableHead>Assigned Date</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Reminders Sent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment: any, index: number) => {
                    if (!assignment || typeof assignment !== 'object') {
                      console.warn(`Skipping invalid assignment at index ${index}:`, assignment);
                      return null;
                    }
                    
                    const userEmail = assignment.assignedEmail || assignment.user?.email || "N/A";
                    const userName = assignment.user?.name || "Not registered";
                    const clientName = assignment.user?.clientName || "N/A";
                    const progress = Math.max(0, Math.min(100, Number(assignment.progress) || 0));
                    
                    try {
                      return (
                        <TableRow key={assignment.id || `assignment-${index}`}>
                          <TableCell>{userEmail}</TableCell>
                          <TableCell>{userName}</TableCell>
                          <TableCell>{clientName}</TableCell>
                          <TableCell>
                            {assignment.enrolledAt ? new Date(assignment.enrolledAt).toLocaleDateString() : "N/A"}
                          </TableCell>
                          <TableCell>
                            {assignment.deadline ? new Date(assignment.deadline).toLocaleDateString() : "N/A"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              assignment.certificateIssued ? "default" :
                              assignment.status === "expired" ? "destructive" :
                              assignment.userId ? "outline" : "secondary"
                            }>
                              {assignment.certificateIssued ? "Completed" :
                               assignment.status === "expired" ? "Expired" :
                               assignment.userId ? "In Progress" :
                               "Email Sent"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <span className="text-sm text-gray-600">{progress}%</span>
                            </div>
                          </TableCell>
                          <TableCell>{Number(assignment.remindersSent) || 0}</TableCell>
                        </TableRow>
                      );
                    } catch (renderError) {
                      console.error(`Error rendering assignment at index ${index}:`, renderError, assignment);
                      return (
                        <TableRow key={`error-${index}`}>
                          <TableCell colSpan={8} className="text-red-500 text-center">
                            Error displaying assignment data
                          </TableCell>
                        </TableRow>
                      );
                    }
                  }).filter(Boolean)}
                </TableBody>
              </Table>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <Users size={48} className="mx-auto mb-4 opacity-50" />
                <p>No assignments found for this course.</p>
                <p className="text-sm">Use "Email Assignment" to assign this course to users.</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}