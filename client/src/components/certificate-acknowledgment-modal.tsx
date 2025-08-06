
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Award, User, Calendar, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CertificateAcknowledgmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseTitle: string;
  userName: string;
  completionDate: string;
  quizScore: number;
  onAcknowledge: (signature: string) => Promise<void>;
}

export default function CertificateAcknowledgmentModal({
  open,
  onOpenChange,
  courseTitle,
  userName,
  completionDate,
  quizScore,
  onAcknowledge,
}: CertificateAcknowledgmentModalProps) {
  const [signature, setSignature] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleAcknowledge = async () => {
    if (!signature.trim()) {
      toast({
        title: "Signature Required",
        description: "Please provide your digital signature to acknowledge completion.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onAcknowledge(signature.trim());
      setSignature("");
      onOpenChange(false);
    } catch (error) {
      console.error("Acknowledgment error:", error);
      toast({
        title: "Error",
        description: "Failed to acknowledge course completion. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Award className="h-6 w-6 text-green-600" />
            Course Completion Acknowledgment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Completion Summary */}
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <h3 className="text-lg font-semibold text-green-900">
                    Congratulations on Completing the Course!
                  </h3>
                  <p className="text-green-700">
                    You have successfully completed all requirements for certification.
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Course:</span>
                  <span className="text-sm">{courseTitle}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Participant:</span>
                  <span className="text-sm">{userName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Completed:</span>
                  <span className="text-sm">{completionDate}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Score:</span>
                  <span className="text-sm">{quizScore}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Acknowledgment Text */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Course Completion Acknowledgment</h4>
            <p className="text-sm text-gray-700 mb-4">
              By providing my digital signature below, I acknowledge that:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 ml-4">
              <li>I have completed all required training modules for this course</li>
              <li>I have successfully passed the assessment with the required score</li>
              <li>I understand the content and concepts covered in this training</li>
              <li>I will apply the knowledge gained from this training in my work</li>
              <li>This acknowledgment serves as confirmation of my course completion</li>
            </ul>
          </div>

          {/* Digital Signature */}
          <div className="space-y-2">
            <Label htmlFor="signature" className="text-base font-medium">
              Digital Signature *
            </Label>
            <Input
              id="signature"
              placeholder="Type your full name as digital signature"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className="text-lg py-3"
            />
            <p className="text-sm text-gray-500">
              Please type your full name as your digital signature to acknowledge course completion.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleAcknowledge}
            disabled={isSubmitting || !signature.trim()}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? "Processing..." : "Acknowledge & Generate Certificate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
