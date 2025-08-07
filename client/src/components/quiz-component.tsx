import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface QuizComponentProps {
  quiz: any;
  courseId: string;
  onComplete: (score: number, passed: boolean) => void; // Updated to accept boolean for passed status
  onBack: () => void;
}

export default function QuizComponent({ quiz, courseId, onComplete, onBack }: QuizComponentProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const questions = quiz.questions || [];
  const totalQuestions = questions.length;
  const progressPercentage = totalQuestions > 0 ? ((currentQuestion + 1) / totalQuestions) * 100 : 0;

  const calculateScore = (userAnswers: Record<number, string>): number => {
    let correctAnswers = 0;
    questions.forEach((question: any, index: number) => {
      const userAnswer = userAnswers[index];
      // Ensure correctAnswer index is valid and option exists
      if (question.options && question.correctAnswer !== undefined && question.options[question.correctAnswer]) {
        const correctOption = question.options[question.correctAnswer];
        if (userAnswer === correctOption) {
          correctAnswers++;
        }
      }
    });
    return totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  };


  const submitQuizMutation = useMutation({
    mutationFn: async (answers: Record<number, string>) => {
      const finalScore = calculateScore(answers);
      const response = await apiRequest("POST", "/api/quiz-submission", {
        courseId,
        answers,
        score: finalScore,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-certificates"] });

      const isPassing = data.score >= (quiz.passingScore || 70); // Use quiz.passingScore or default to 70
      toast({
        title: isPassing ? "Quiz passed!" : "Quiz completed",
        description: `Your score: ${data.score}%${isPassing ? '' : ' - You need 70% to pass. You can retake the quiz.'}`,
        variant: isPassing ? "default" : "destructive",
      });

      onComplete(data.score, isPassing);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to submit quiz",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAnswerChange = (questionIndex: number, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: answer
    }));
  };

  const handleNext = () => {
    if (currentQuestion < totalQuestions - 1) {
      setCurrentQuestion(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const handleFinishQuiz = () => {
    const finalScore = calculateScore(answers);
    setScore(finalScore);
    setShowResults(true);
  };

  const handleSubmitResults = () => {
    submitQuizMutation.mutate(answers);
  };

  if (showResults) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Quiz Results</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <div className="space-y-4">
              <div className={`text-6xl font-bold ${score >= (quiz.passingScore || 70) ? 'text-green-600' : 'text-orange-600'}`}>
                {score}%
              </div>
              <div className="space-y-2">
                <p className="text-lg font-medium">
                  {score >= (quiz.passingScore || 70) ? "Congratulations! You passed!" : "Don't give up! You can retake this quiz"}
                </p>
                <p className="text-gray-600">
                  You answered {Object.keys(answers).filter((key) => {
                    const index = parseInt(key, 10);
                    const userAnswer = answers[index];
                    // Safely access question and options
                    const question = questions[index];
                    if (question && question.options && question.options[question.correctAnswer]) {
                      const correctOption = question.options[question.correctAnswer];
                      return userAnswer === correctOption;
                    }
                    return false; // If question or options are missing, consider it incorrect
                  }).length} out of {totalQuestions} questions correctly.
                </p>
                <p className="text-sm text-gray-500">
                  Passing score: {(quiz.passingScore || 70)}%
                </p>
              </div>
            </div>

            {score >= (quiz.passingScore || 70) && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-center space-x-2 text-green-700">
                  <Check size={20} />
                  <span className="font-medium">Course completed! Certificate will be emailed to you.</span>
                </div>
              </div>
            )}

            <div className="flex space-x-4 justify-center">
              <Button variant="outline" onClick={onBack}>
                Back to Course
              </Button>
              <Button onClick={handleSubmitResults} disabled={submitQuizMutation.isPending}>
                {submitQuizMutation.isPending ? "Submitting..." : "Submit Results"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (totalQuestions === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600">No quiz questions available for this course.</p>
            <Button onClick={onBack} className="mt-4">
              Back to Course
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQ = questions[currentQuestion];

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{quiz.title}</CardTitle>
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft size={16} className="mr-2" />
              Back
            </Button>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Question {currentQuestion + 1} of {totalQuestions}</span>
              <span>{Math.round(progressPercentage)}% complete</span>
            </div>
            <Progress value={progressPercentage} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {currentQ.question}
            </h3>

            <RadioGroup
              value={answers[currentQuestion] || ""}
              onValueChange={(value) => handleAnswerChange(currentQuestion, value)}
            >
              {currentQ.options?.map((option: string, index: number) => (
                <div key={index} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`option-${index}`} />
                  <Label htmlFor={`option-${index}`} className="cursor-pointer">
                    {String.fromCharCode(65 + index)}. {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentQuestion === 0}
            >
              <ArrowLeft size={16} className="mr-2" />
              Previous
            </Button>

            {currentQuestion === totalQuestions - 1 ? (
              <Button
                onClick={handleFinishQuiz}
                disabled={!answers[currentQuestion] && currentQ.options && currentQ.options.length > 0}
              >
                Finish Quiz
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!answers[currentQuestion] && currentQ.options && currentQ.options.length > 0}
              >
                Next
                <ArrowRight size={16} className="ml-2" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}