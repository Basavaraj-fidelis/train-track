import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

  const { data: assignments, isLoading } = useQuery({
    queryKey: ["/api/course-assignments", courseId],
    enabled: open && !!courseId,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/course-assignments/${courseId}`);
      return response.json();
    },
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

  const pendingCount = assignments?.filter((a: any) => ["pending", "accessed"].includes(a.status))?.length || 0;
  const completedCount = assignments?.filter((a: any) => a.status === "completed")?.length || 0;
  const expiredCount = assignments?.filter((a: any) => a.status === "expired")?.length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 size={20} />
            Course Assignment Tracker: {courseName}
          </DialogTitle>
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
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/course-assignments", courseId] })}
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
            ) : assignments && assignments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>User Name</TableHead>
                    <TableHead>Assigned Date</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Reminders Sent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment: any) => (
                    <TableRow key={assignment.id}>
                      <TableCell>{assignment.assignedEmail || assignment.user?.email}</TableCell>
                      <TableCell>{assignment.user?.name || "Not registered"}</TableCell>
                      <TableCell>
                        {assignment.enrolledAt ? new Date(assignment.enrolledAt).toLocaleDateString() : "N/A"}
                      </TableCell>
                      <TableCell>
                        {assignment.deadline ? new Date(assignment.deadline).toLocaleDateString() : "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          assignment.status === "completed" ? "default" :
                          assignment.status === "expired" ? "destructive" :
                          assignment.status === "accessed" ? "outline" : "secondary"
                        }>
                          {assignment.status === "pending" && !assignment.userId ? "Email Sent" :
                           assignment.status === "accessed" ? "In Progress" :
                           assignment.status || "pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${assignment.progress || 0}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600">{assignment.progress || 0}%</span>
                        </div>
                      </TableCell>
                      <TableCell>{assignment.remindersSent || 0}</TableCell>
                    </TableRow>
                  ))}
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