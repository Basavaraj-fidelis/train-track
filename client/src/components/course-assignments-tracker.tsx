
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Send, Clock, CheckCircle, XCircle, Mail } from "lucide-react";

interface CourseAssignmentsTrackerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId?: string;
  courseName?: string;
}

export function CourseAssignmentsTracker({ 
  open, 
  onOpenChange, 
  courseId, 
  courseName 
}: CourseAssignmentsTrackerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: assignments, isLoading } = useQuery({
    queryKey: [`/api/course-assignments/${courseId}`],
    enabled: open && !!courseId,
  });

  const sendRemindersMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/send-reminders/${courseId}`, {});
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/course-assignments/${courseId}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send reminders",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string, deadline: string) => {
    const isExpired = new Date() > new Date(deadline);
    
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case "accessed":
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="w-3 h-3 mr-1" />In Progress</Badge>;
      case "pending":
        return isExpired 
          ? <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Expired</Badge>
          : <Badge className="bg-yellow-100 text-yellow-800"><Mail className="w-3 h-3 mr-1" />Pending</Badge>;
      case "expired":
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Expired</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const stats = assignments ? {
    total: assignments.length,
    pending: assignments.filter((a: any) => a.status === "pending").length,
    accessed: assignments.filter((a: any) => a.status === "accessed").length,
    completed: assignments.filter((a: any) => a.status === "completed").length,
    expired: assignments.filter((a: any) => a.status === "expired" || new Date() > new Date(a.deadline)).length,
  } : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Course Assignments: {courseName}</DialogTitle>
        </DialogHeader>

        {stats && (
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div className="bg-gray-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
            <div className="bg-yellow-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-yellow-800">{stats.pending}</div>
              <div className="text-sm text-yellow-600">Pending</div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-800">{stats.accessed}</div>
              <div className="text-sm text-blue-600">In Progress</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-800">{stats.completed}</div>
              <div className="text-sm text-green-600">Completed</div>
            </div>
            <div className="bg-red-50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-red-800">{stats.expired}</div>
              <div className="text-sm text-red-600">Expired</div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Assignment Details</h3>
          <Button 
            onClick={() => sendRemindersMutation.mutate()}
            disabled={sendRemindersMutation.isPending || !stats?.pending}
          >
            <Send className="w-4 h-4 mr-2" />
            {sendRemindersMutation.isPending ? "Sending..." : `Send Reminders (${stats?.pending || 0})`}
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading assignments...</div>
        ) : assignments && assignments.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Quiz Score</TableHead>
                <TableHead>Reminders</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((assignment: any) => (
                <TableRow key={assignment.id}>
                  <TableCell className="font-medium">
                    {assignment.assignedEmail || assignment.user?.email}
                  </TableCell>
                  <TableCell>
                    {assignment.user?.name || "Not registered"}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(assignment.status, assignment.deadline)}
                  </TableCell>
                  <TableCell>
                    {new Date(assignment.enrolledAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {new Date(assignment.deadline).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {assignment.progress || 0}%
                  </TableCell>
                  <TableCell>
                    {assignment.quizScore ? `${assignment.quizScore}%` : "-"}
                  </TableCell>
                  <TableCell>
                    {assignment.remindersSent || 0}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No assignments found for this course.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
