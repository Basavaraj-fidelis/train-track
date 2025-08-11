import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Play, FileText, Download, PlayCircle } from "lucide-react";
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
  const videoRef = useRef<HTMLVideoElement>(null);

  // Debug logging
  console.log('CourseViewer enrollment data:', enrollment);
  console.log('Course data:', enrollment?.course);
  console.log('CourseId from enrollment.courseId:', enrollment?.courseId);
  console.log('CourseId from enrollment.course.id:', enrollment?.course?.id);
  console.log('Course videoPath:', enrollment?.course?.videoPath);
  console.log('Course youtubeUrl:', enrollment?.course?.youtubeUrl);
  console.log('Course has video content:', !!(enrollment?.course?.videoPath || enrollment?.course?.youtubeUrl));


  const courseId = enrollment?.course?.id || enrollment?.courseId;

  const { data: quiz, isLoading: quizLoading, error: quizError, refetch } = useQuery({
    queryKey: ["/api/courses", courseId, "quiz"],
    queryFn: async () => {
      console.log('Fetching quiz for course:', courseId);
      const response = await apiRequest("GET", `/api/courses/${courseId}/quiz`);
      if (!response.ok) {
        if (response.status === 404) {
          console.log('No quiz found for this course');
          return null;
        }
        throw new Error('Failed to fetch quiz');
      }
      const quizData = await response.json();
      console.log('Quiz data received:', quizData);
      return quizData;
    },
    enabled: !!courseId && hasWatchedVideo,
    retry: 3,
    retryDelay: 1000
  });

  const { data: userData } = useQuery({
    queryKey: ["/api/user"],
    enabled: !!enrollment.courseId,
  });

  const course = enrollment.course;

  const updateProgressMutation = useMutation({
    mutationFn: async (progress: number) => {
      if (!enrollment?.id) throw new Error("No enrollment found");

      const response = await apiRequest("PUT", `/api/my-enrollments/${enrollment.id}`, {
        progress,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-enrollments"] });
      // Update local state to reflect the change
      if (enrollment.progress) {
        setVideoProgress(enrollment.progress);
      }
    },
  });

  const acknowledgeCompletionMutation = useMutation({
    mutationFn: async ({ digitalSignature }: { digitalSignature: string }) => {
      const response = await apiRequest("POST", "/api/acknowledge-completion", {
        courseId: courseId,
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
          courseId: courseId,
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

  // Refetch quiz when video is completed
  useEffect(() => {
    if (hasWatchedVideo && !quiz && !quizLoading && !quizError) {
      console.log('Video completed, refetching quiz...');
      refetch();
    }
  }, [hasWatchedVideo, quiz, quizLoading, quizError, refetch]);

  const getEmbedUrl = (url: string) => {
    if (!url) return "";

    // Handle YouTube URLs
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(youtubeRegex);

    if (match && match[1]) {
      // Parameters to hide controls, YouTube logo, and related videos for clean learning experience
      return `https://www.youtube.com/embed/${match[1]}?autoplay=0&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&fs=1&cc_load_policy=0&disablekb=0`;
    }

    return url; // Return as-is for other video URLs
  };

  const handleVideoProgress = () => {
    if (videoRef.current) {
      const progress = Math.round((videoRef.current.currentTime / videoRef.current.duration) * 100);
      setVideoProgress(progress);

      if (progress >= 80 && !hasWatchedVideo) {
        setHasWatchedVideo(true);
        updateProgressMutation.mutate(progress);
      }
    }
  };


  if (showQuiz && quiz) {
    return (
      <QuizComponent
        quiz={quiz}
        courseId={courseId}
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
              // Check if videoPath contains YouTube URL
              course.videoPath.includes('youtube.com') || course.videoPath.includes('youtu.be') ? (
                <iframe
                  src={getEmbedUrl(course.videoPath)}
                  title={course.title}
                  className="w-full aspect-video rounded-lg"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  onLoad={() => {
                    console.log('YouTube video loaded:', course.videoPath);
                    // Auto-mark video as watched for YouTube videos after 30 seconds
                    setTimeout(() => {
                      setHasWatchedVideo(true);
                      updateProgressMutation.mutate(90);
                    }, 30000);
                  }}
                />
              ) : (
                // Handle uploaded video files
                <video
                  ref={videoRef}
                  controls
                  className="w-full aspect-video rounded-lg"
                  onTimeUpdate={handleVideoProgress}
                  onEnded={() => {
                    setHasWatchedVideo(true);
                    updateProgressMutation.mutate(90);
                  }}
                >
                  <source src={`/api/videos/${course.videoPath}`} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              )
            ) : (
              <div className="w-full aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <PlayCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">No video available for this course</p>
                  <p className="text-gray-500 text-sm mt-2">Please contact your administrator to add course content</p>
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
            disabled={quizLoading || !quiz || showQuiz || (videoProgress < 80 && !hasWatchedVideo)}
            className="w-full"
          >
            {quizLoading ? "Loading Quiz..." :
             quizError ? "Quiz Unavailable" :
             !quiz ? "No Quiz Available" :
             enrollment.certificateIssued ? "Review Quiz" :
             enrollment.quizScore && enrollment.quizScore >= 70 ? "Quiz Completed - Get Certificate" :
             enrollment.quizScore && enrollment.quizScore < 70 ? "Retake Quiz" : "Take Quiz"}
          </Button>
          {(quizLoading || !quiz || quizError) && (
            <p className="text-sm text-gray-500 mt-2 text-center">
              {quizLoading ? "Quiz is being prepared..." : 
               quizError ? "Unable to load quiz. Please try again later." :
               !quiz ? "No quiz available for this course" :
               !hasWatchedVideo ? "Complete the video first" : "Quiz is being prepared..."}
            </p>
          )}
        </CardContent>
      </Card>

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