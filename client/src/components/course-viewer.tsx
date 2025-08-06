import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Play, FileText, Download } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import QuizComponent from "./quiz-component";

interface CourseViewerProps {
  enrollment: any;
}

export default function CourseViewer({ enrollment }: CourseViewerProps) {
  const [showQuiz, setShowQuiz] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: quiz } = useQuery({
    queryKey: ["/api/courses", enrollment.courseId, "quiz"],
    enabled: !!enrollment.courseId,
  });

  const course = enrollment.course;

  const handleQuizComplete = (score: number) => {
    toast({
      title: "Quiz completed!",
      description: `You scored ${score}%. ${score >= (quiz?.passingScore || 70) ? "Congratulations on passing!" : "Please try again to pass."}`,
      variant: score >= (quiz?.passingScore || 70) ? "default" : "destructive",
    });
    
    // Refresh enrollments
    queryClient.invalidateQueries({ queryKey: ["/api/my-enrollments"] });
    queryClient.invalidateQueries({ queryKey: ["/api/my-certificates"] });
    
    setShowQuiz(false);
  };

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
              <video
                controls
                className="w-full h-full rounded-lg"
                poster="/placeholder-video-poster.jpg"
              >
                <source src={`/api/videos/${course.videoPath}`} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white">
                  <Play size={64} className="mx-auto mb-4 opacity-50" />
                  <p>No video available for this course</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Course Overview</h3>
              <div className="flex items-center space-x-2">
                <Badge variant={enrollment.completedAt ? "default" : "secondary"}>
                  {enrollment.completedAt ? "Completed" : "In Progress"}
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
            <CardTitle>Course Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-gray-600">
                Complete this assessment to test your understanding and earn your certificate.
              </p>
              
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">{quiz.title}</h4>
                  <p className="text-sm text-gray-600">
                    {quiz.questions?.length || 0} questions • Passing score: {quiz.passingScore}%
                  </p>
                  {enrollment.quizScore && (
                    <p className="text-sm text-green-600 font-medium">
                      Previous score: {enrollment.quizScore}%
                    </p>
                  )}
                </div>
                <Button
                  onClick={() => setShowQuiz(true)}
                  disabled={enrollment.completedAt}
                >
                  {enrollment.quizScore ? "Retake Quiz" : "Start Quiz"}
                </Button>
              </div>
              
              {enrollment.certificateIssued && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-green-900">Certificate Earned!</h4>
                      <p className="text-sm text-green-700">
                        You have successfully completed this course and earned your certificate.
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      <Download size={16} className="mr-2" />
                      Download Certificate
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
