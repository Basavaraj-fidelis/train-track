
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Mail, Plus, Trash2 } from "lucide-react";

interface EmailBulkAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId?: string;
  courseName?: string;
}

export default function EmailBulkAssignmentDialog({
  open,
  onOpenChange,
  courseId,
  courseName
}: EmailBulkAssignmentDialogProps) {
  const [emailText, setEmailText] = useState("");
  const [deadlineDays, setDeadlineDays] = useState(30);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const assignEmailsMutation = useMutation({
    mutationFn: async (data: { courseId: string; emails: string[]; deadlineDays: number }) => {
      const response = await apiRequest("POST", "/api/bulk-assign-emails", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      onOpenChange(false);
      setEmailText("");
      setDeadlineDays(30);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign course",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!courseId) {
      toast({
        title: "Error",
        description: "Course not selected",
        variant: "destructive",
      });
      return;
    }

    const emails = emailText
      .split(/[,\n]/)
      .map(email => email.trim())
      .filter(email => email && email.includes("@"));

    if (emails.length === 0) {
      toast({
        title: "Error",
        description: "Please enter at least one valid email address",
        variant: "destructive",
      });
      return;
    }

    assignEmailsMutation.mutate({
      courseId,
      emails,
      deadlineDays,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail size={20} />
            Email Bulk Assignment: {courseName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <Label htmlFor="emails">Email Addresses</Label>
            <Textarea
              id="emails"
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
              placeholder="Enter email addresses separated by commas or new lines&#10;example@company.com, user2@company.com&#10;user3@company.com"
              className="min-h-32 mt-2"
            />
            <p className="text-sm text-gray-500 mt-1">
              Separate multiple emails with commas or new lines
            </p>
          </div>

          <div>
            <Label htmlFor="deadline">Completion Deadline (Days)</Label>
            <Input
              id="deadline"
              type="number"
              value={deadlineDays}
              onChange={(e) => setDeadlineDays(parseInt(e.target.value) || 30)}
              min="1"
              max="365"
              className="mt-2"
            />
            <p className="text-sm text-gray-500 mt-1">
              Number of days from assignment to complete the course
            </p>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">How it works:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Each email will receive a unique access link</li>
              <li>• Users can complete their profile and access the course</li>
              <li>• Assignment expires after the deadline</li>
              <li>• Reminder emails can be sent before deadline</li>
            </ul>
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={assignEmailsMutation.isPending || !emailText.trim()}
            >
              {assignEmailsMutation.isPending ? "Assigning..." : "Send Assignments"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
