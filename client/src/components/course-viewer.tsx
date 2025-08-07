import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Play, FileText, Download } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import QuizComponent from "./quiz-component";
import CertificateAcknowledgmentModal from "./certificate-acknowledgment-modal";

interface CourseViewerProps {
  enrollment: any;
}

export default function CourseViewer({ enrollment }: CourseViewerProps) {
  const [currentSection, setCurrentSection] = useState("video");
  const [showQuiz, setShowQuiz] = useState(false);
  const [showAcknowledgment, setShowAcknowledgment] = useState(false);
  const [videoProgress, setVideoProgress] = useState(enrollment.progress || 0);
  const [hasWatchedVideo, setHasWatchedVideo] = useState(enrollment.progress >= 80);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: quiz } = useQuery({
    queryKey: ["/api/courses", enrollment.courseId, "quiz"],
    enabled: !!enrollment.courseId,
  });

  const { data: userData } = useQuery({
    queryKey: ["/api/user"],
    enabled: !!enrollment.courseId,
  });

  const course = enrollment.course;

  const updateProgressMutation = useMutation({
    mutationFn: async (progress: number) => {
      const response = await apiRequest("PUT", `/api/enrollments/${enrollment.id}`, {
        progress,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-enrollments"] });
      // Update local state to reflect the change
      if (data.progress) {
        setVideoProgress(data.progress);
      }
    },
  });

  const acknowledgeCompletionMutation = useMutation({
    mutationFn: async ({ digitalSignature }: { digitalSignature: string }) => {
      const response = await apiRequest("POST", "/api/acknowledge-completion", {
        courseId: enrollment.course.id,
        digitalSignature,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-certificates"] });
      setShowAcknowledgment(false);
      toast({
        title: "Course completed successfully!",
        description: "Your certificate has been generated and emailed to you.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to acknowledge completion",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleQuizComplete = async (score: number, responseData?: any) => {
    const passingScore = quiz?.passingScore || 70;
    const isPassing = score >= passingScore;

    toast({
      title: "Quiz completed!",
      description: `You scored ${score}%. ${isPassing ? "Congratulations on passing!" : "Please try again to pass."}`,
      variant: isPassing ? "default" : "destructive"
    });

    // Invalidate queries to refresh data
    await queryClient.invalidateQueries({ queryKey: ["/api/my-enrollments"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/my-certificates"] });

    setShowQuiz(false);

    // Show acknowledgment modal if quiz passed and needs acknowledgment
    if (responseData?.needsAcknowledgment || (isPassing && !enrollment.certificateIssued)) {
      setShowAcknowledgment(true);
    }
  };

  const handleQuizSubmit = async (answers: number[], score: number) => {
    try {
      const response = await fetch('/api/quiz-submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          courseId: course.id,
          answers,
          score
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit quiz');
      }

      const result = await response.json();

      if (result.isPassing && !enrollment.certificateIssued) {
        setShowQuiz(false);
        setShowAcknowledgment(true);
      } else if (result.isPassing) {
        setShowQuiz(false);
        window.location.reload();
      }
    } catch (error) {
      console.error('Quiz submission error:', error);
    }
  };

  const handleAcknowledge = async (digitalSignature: string) => {
    await acknowledgeCompletionMutation.mutateAsync({ digitalSignature });
  };

  // Check for completed quiz that needs acknowledgment
  useEffect(() => {
    if (enrollment?.quizScore && enrollment.quizScore >= (quiz?.passingScore || 70) && !enrollment.certificateIssued) {
      // Only show if not already acknowledged
      const hasAcknowledged = localStorage.getItem(`acknowledged_${enrollment.courseId}_${enrollment.userId}`);
      if (!hasAcknowledged) {
        setShowAcknowledgment(true);
      }
    }
  }, [enrollment, quiz]);

  if (showQuiz && quiz) {
    return (
      <QuizComponent
        quiz={quiz}
        courseId={enrollment.courseId}
        onComplete={handleQuizComplete}
        onBack={() => setShowQuiz(false)}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Video Player */}
      <Card>
        <CardContent className="pt-6">
          <div className="aspect-video bg-gray-900 rounded-lg mb-4 relative">
            {course.videoPath ? (
              <div className="w-full bg-gray-900 rounded-lg overflow-hidden">
              <video
                key={enrollment.course.id}
                controls
                className="w-full h-auto"
                style={{ maxHeight: "500px" }}
                onTimeUpdate={(e) => {
                  const video = e.target as HTMLVideoElement;
                  if (video.duration) {
                    const progress = Math.round((video.currentTime / video.duration) * 100);
                    setVideoProgress(progress);

                    // Update progress in database when video reaches certain milestones
                    if (progress >= 80 && !hasWatchedVideo) {
                      setHasWatchedVideo(true);
                      updateProgressMutation.mutate(Math.min(progress, 90)); // Cap at 90% until quiz completion
                    }
                  }
                }}
                onEnded={() => {
                  setHasWatchedVideo(true);
                  setVideoProgress(100);
                  updateProgressMutation.mutate(90); // Video completed, ready for quiz
                }}
              >
                <source src={`/api/videos/${course.videoPath}`} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white">
                  <Play size={64} className="mx-auto mb-4 opacity-50" />
                  <p>No video available for this course</p>
                </div>
              </div>
            )}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75">
                <div className="text-center text-white">
                  <p className="text-sm">{error}</p>
                  <p className="text-sm mt-2 opacity-75">Please contact your administrator</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Course Overview</h3>
              <div className="flex items-center space-x-2">
                <Badge variant={enrollment.progress === 100 ? "default" : "secondary"}>
                  {enrollment.progress === 100 ? "Completed" : "In Progress"}
                </Badge>
                {enrollment.progress > 0 && (
                  <span className="text-sm text-gray-500">{enrollment.progress}% complete</span>
                )}
              </div>
            </div>

            <p className="text-gray-700">{course.description}</p>

            {enrollment.progress < 100 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{enrollment.progress}%</span>
                </div>
                <Progress value={enrollment.progress} />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Learning Objectives</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Complete understanding of course materials</li>
                  <li>• Practical application of concepts</li>
                  <li>• Pass the final assessment</li>
                  <li>• Earn course completion certificate</li>
                </ul>
              </div>
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Course Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Duration:</span>
                    <span>{course.duration} minutes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Created:</span>
                    <span>{new Date(course.createdAt).toLocaleDateString()}</span>
                  </div>
                  {enrollment.quizScore && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Quiz Score:</span>
                      <span>{enrollment.quizScore}%</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className={`font-medium ${
                        enrollment.progress === 100 ? 'text-green-600' :
                        enrollment.quizScore ? 'text-orange-600' : 'text-blue-600'
                      }`}>
                        {enrollment.progress === 100 ? 'Completed' :
                         enrollment.quizScore ? 'Needs Retake' : 'In Progress'}
                      </span>
                    </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quiz Section */}
      {quiz && (
        <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Course Quiz
                {enrollment.quizScore && (
                  <Badge variant={enrollment.quizScore >= 70 ? "default" : "destructive"}>
                    Score: {enrollment.quizScore}%
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                {videoProgress < 80 && !hasWatchedVideo
                  ? "Watch at least 80% of the video before taking the quiz."
                  : "Complete the quiz to test your understanding of the course material."}
              </p>
              {videoProgress > 0 && videoProgress < 80 && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Video Progress</span>
                    <span>{videoProgress}%</span>
                  </div>
                  <Progress value={videoProgress} />
                </div>
              )}
              <Button 
                onClick={() => setShowQuiz(true)}
                disabled={showQuiz || (videoProgress < 80 && !hasWatchedVideo)}
                className="w-full"
              >
                {enrollment.certificateIssued ? "Review Quiz" :
                 enrollment.quizScore && enrollment.quizScore >= 70 ? "Quiz Completed - Get Certificate" :
                 enrollment.quizScore && enrollment.quizScore < 70 ? "Retake Quiz" : "Take Quiz"}
              </Button>
            </CardContent>
          </Card>
      )}

        <CertificateAcknowledgmentModal
        open={showAcknowledgment}
        onOpenChange={setShowAcknowledgment}
        courseTitle={course.title}
        userName={userData?.user?.name || ""}
        completionDate={new Date().toLocaleDateString()}
        quizScore={enrollment?.quizScore || 0}
        onAcknowledge={handleAcknowledge}
      />
    </div>
  );
}