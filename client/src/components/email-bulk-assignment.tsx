
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Mail, Send } from "lucide-react";

interface EmailBulkAssignmentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId?: string;
  courseName?: string;
}

export function EmailBulkAssignmentDialog({ 
  open, 
  onOpenChange, 
  courseId, 
  courseName 
}: EmailBulkAssignmentProps) {
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
        description: error.message || "Failed to assign course via emails",
        variant: "destructive",
      });
    },
  });

  const parseEmails = (text: string): string[] => {
    return text
      .split(/[,\n\r\s]+/)
      .map(email => email.trim())
      .filter(email => email && email.includes('@'));
  };

  const handleSubmit = () => {
    const emails = parseEmails(emailText);
    
    if (!courseId || emails.length === 0) {
      toast({
        title: "Error",
        description: "Please enter at least one valid email address",
        variant: "destructive",
      });
      return;
    }

    // Validate email format
    const invalidEmails = emails.filter(email => !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/));
    if (invalidEmails.length > 0) {
      toast({
        title: "Error",
        description: `Invalid email addresses: ${invalidEmails.join(', ')}`,
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

  const emailCount = parseEmails(emailText).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Bulk Assign Course via Email: {courseName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="deadline">Completion Deadline (Days)</Label>
            <Input
              id="deadline"
              type="number"
              value={deadlineDays}
              onChange={(e) => setDeadlineDays(parseInt(e.target.value) || 30)}
              min={1}
              max={365}
              className="w-32"
            />
            <p className="text-sm text-gray-500">
              Deadline: {new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000).toLocaleDateString()}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="emails">
              Employee Email Addresses ({emailCount} emails detected)
            </Label>
            <Textarea
              id="emails"
              placeholder="Enter email addresses separated by commas, spaces, or new lines:&#10;&#10;employee1@company.com, employee2@company.com&#10;employee3@company.com"
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
            />
            <p className="text-sm text-gray-500">
              Enter email addresses separated by commas, spaces, or line breaks. 
              Each email will receive a unique access link.
            </p>
          </div>

          {emailCount > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Assignment Summary</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Course: {courseName}</li>
                <li>• {emailCount} email addresses will be assigned</li>
                <li>• Deadline: {deadlineDays} days from now</li>
                <li>• Each user will receive an email with a unique access link</li>
                <li>• Users will create their profile on first access</li>
              </ul>
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={emailCount === 0 || assignEmailsMutation.isPending}
            >
              <Send className="w-4 h-4 mr-2" />
              {assignEmailsMutation.isPending 
                ? "Sending..." 
                : `Send to ${emailCount} Email${emailCount !== 1 ? 's' : ''}`
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
