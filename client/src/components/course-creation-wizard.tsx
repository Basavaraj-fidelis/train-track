import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ChevronLeft, ChevronRight, Upload, Plus, Trash2, Check } from "lucide-react";

const courseBasicSchema = z.object({
  title: z.string().min(1, "Course title is required"),
  description: z.string().min(1, "Course description is required"),
});

const quizQuestionSchema = z.object({
  question: z.string().min(1, "Question is required"),
  options: z.array(z.string()).min(2, "At least 2 options required"),
  correctAnswer: z.string().min(1, "Correct answer is required"),
});

const quizSchema = z.object({
  title: z.string().min(1, "Quiz title is required"),
  questions: z.array(quizQuestionSchema).min(1, "At least one question is required"),
  passingScore: z.number().min(0).max(100),
});

interface CourseCreationWizardProps {
  onClose: () => void;
  onComplete: () => void;
}

export default function CourseCreationWizard({ onClose, onComplete }: CourseCreationWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [courseData, setCourseData] = useState<any>({});
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [questions, setQuestions] = useState<Array<{
    question: string;
    options: string[];
    correctAnswer: string;
  }>>([]);
  const [currentQuestion, setCurrentQuestion] = useState({
    question: "",
    options: ["", "", "", ""],
    correctAnswer: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const basicForm = useForm({
    resolver: zodResolver(courseBasicSchema),
    defaultValues: { title: "", description: "" },
  });

  const quizForm = useForm({
    resolver: zodResolver(z.object({
      title: z.string().min(1, "Quiz title is required"),
      passingScore: z.number().min(0).max(100),
    })),
    defaultValues: { title: "", passingScore: 70 },
  });

  const createCourseMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch("/api/courses", {
        method: "POST",
        body: data,
      });
      if (!response.ok) throw new Error("Failed to create course");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      toast({
        title: "Success",
        description: "Course created successfully!",
      });
      onComplete();
    },
  });

  const steps = [
    { number: 1, title: "Course Info", description: "Basic course details" },
    { number: 2, title: "Video Upload", description: "Upload course video" },
    { number: 3, title: "Create Quiz", description: "Add quiz questions" },
    { number: 4, title: "Complete", description: "Review and finish" },
  ];

  const handleBasicInfoNext = (data: z.infer<typeof courseBasicSchema>) => {
    setCourseData({ ...courseData, ...data });
    setCurrentStep(2);
  };

  const handleVideoNext = () => {
    if (!videoFile) {
      toast({
        title: "Error",
        description: "Please select a video file",
        variant: "destructive",
      });
      return;
    }
    setCurrentStep(3);
  };

  const addQuestion = () => {
    if (!currentQuestion.question || !currentQuestion.correctAnswer || 
        currentQuestion.options.filter(opt => opt.trim()).length < 2) {
      toast({
        title: "Error",
        description: "Please fill in all question details and at least 2 options",
        variant: "destructive",
      });
      return;
    }

    setQuestions([...questions, {
      ...currentQuestion,
      options: currentQuestion.options.filter(opt => opt.trim()),
    }]);
    setCurrentQuestion({
      question: "",
      options: ["", "", "", ""],
      correctAnswer: "",
    });
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleQuizNext = (data: { title: string; passingScore: number }) => {
    if (questions.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one quiz question",
        variant: "destructive",
      });
      return;
    }
    setCourseData({ 
      ...courseData, 
      quiz: { 
        ...data, 
        questions 
      } 
    });
    setCurrentStep(4);
  };

  const handleComplete = () => {
    const formData = new FormData();
    formData.append("title", courseData.title);
    formData.append("description", courseData.description);
    if (videoFile) {
      formData.append("video", videoFile);
    }
    if (courseData.quiz) {
      formData.append("quiz", JSON.stringify(courseData.quiz));
    }
    
    createCourseMutation.mutate(formData);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex justify-between">
          {steps.map((step, index) => (
            <div key={step.number} className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= step.number
                    ? "bg-primary text-primary-foreground"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {currentStep > step.number ? <Check size={16} /> : step.number}
              </div>
              <div className="mt-2 text-center">
                <div className="text-sm font-medium">{step.title}</div>
                <div className="text-xs text-gray-500">{step.description}</div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-1 w-20 mt-4 ${
                    currentStep > step.number ? "bg-primary" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Step {currentStep}: {steps[currentStep - 1].title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Step 1: Course Info */}
          {currentStep === 1 && (
            <form onSubmit={basicForm.handleSubmit(handleBasicInfoNext)} className="space-y-4">
              <div>
                <Label htmlFor="title">Course Title</Label>
                <Input
                  id="title"
                  {...basicForm.register("title")}
                  placeholder="Enter course title"
                  className={basicForm.formState.errors.title ? "border-destructive" : ""}
                />
                {basicForm.formState.errors.title && (
                  <p className="text-sm text-destructive mt-1">
                    {basicForm.formState.errors.title.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="description">Course Description</Label>
                <Textarea
                  id="description"
                  {...basicForm.register("description")}
                  placeholder="Describe what this course covers"
                  rows={4}
                  className={basicForm.formState.errors.description ? "border-destructive" : ""}
                />
                {basicForm.formState.errors.description && (
                  <p className="text-sm text-destructive mt-1">
                    {basicForm.formState.errors.description.message}
                  </p>
                )}
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit">
                  Next <ChevronRight size={16} className="ml-2" />
                </Button>
              </div>
            </form>
          )}

          {/* Step 2: Video Upload */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <Label>Course Video</Label>
                <div className="mt-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-32 border-dashed"
                  >
                    <div className="text-center">
                      <Upload size={24} className="mx-auto mb-2" />
                      <div className="text-sm">
                        {videoFile ? videoFile.name : "Click to upload video file"}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        MP4, AVI, MOV files supported
                      </div>
                    </div>
                  </Button>
                </div>
              </div>
              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                >
                  <ChevronLeft size={16} className="mr-2" /> Back
                </Button>
                <Button type="button" onClick={handleVideoNext}>
                  Next <ChevronRight size={16} className="ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Create Quiz */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <form onSubmit={quizForm.handleSubmit(handleQuizNext)}>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="quizTitle">Quiz Title</Label>
                    <Input
                      id="quizTitle"
                      {...quizForm.register("title")}
                      placeholder="Enter quiz title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="passingScore">Passing Score (%)</Label>
                    <Input
                      id="passingScore"
                      type="number"
                      min="0"
                      max="100"
                      {...quizForm.register("passingScore", { valueAsNumber: true })}
                    />
                  </div>
                </div>

                {/* Add Question Form */}
                <div className="mt-6 p-4 border rounded-lg">
                  <h4 className="font-medium mb-4">Add New Question</h4>
                  <div className="space-y-4">
                    <div>
                      <Label>Question</Label>
                      <Textarea
                        value={currentQuestion.question}
                        onChange={(e) => setCurrentQuestion({
                          ...currentQuestion,
                          question: e.target.value
                        })}
                        placeholder="Enter your question"
                      />
                    </div>
                    <div>
                      <Label>Answer Options</Label>
                      {currentQuestion.options.map((option, index) => (
                        <Input
                          key={index}
                          value={option}
                          onChange={(e) => {
                            const newOptions = [...currentQuestion.options];
                            newOptions[index] = e.target.value;
                            setCurrentQuestion({
                              ...currentQuestion,
                              options: newOptions
                            });
                          }}
                          placeholder={`Option ${index + 1}`}
                          className="mt-2"
                        />
                      ))}
                    </div>
                    <div>
                      <Label>Correct Answer</Label>
                      <Input
                        value={currentQuestion.correctAnswer}
                        onChange={(e) => setCurrentQuestion({
                          ...currentQuestion,
                          correctAnswer: e.target.value
                        })}
                        placeholder="Enter the correct answer exactly as written above"
                      />
                    </div>
                    <Button type="button" onClick={addQuestion}>
                      <Plus size={16} className="mr-2" /> Add Question
                    </Button>
                  </div>
                </div>

                {/* Questions List */}
                {questions.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-medium mb-4">Quiz Questions ({questions.length})</h4>
                    <div className="space-y-3">
                      {questions.map((q, index) => (
                        <div key={index} className="p-3 border rounded-lg">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-medium">Q{index + 1}: {q.question}</div>
                              <div className="text-sm text-gray-600 mt-1">
                                Options: {q.options.join(", ")}
                              </div>
                              <Badge variant="secondary" className="mt-2">
                                Correct: {q.correctAnswer}
                              </Badge>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeQuestion(index)}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(2)}
                  >
                    <ChevronLeft size={16} className="mr-2" /> Back
                  </Button>
                  <Button type="submit">
                    Next <ChevronRight size={16} className="ml-2" />
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Step 4: Complete */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Review Course Details</h3>
                <div className="space-y-4">
                  <div>
                    <Label>Course Title</Label>
                    <div className="text-sm text-gray-600">{courseData.title}</div>
                  </div>
                  <div>
                    <Label>Description</Label>
                    <div className="text-sm text-gray-600">{courseData.description}</div>
                  </div>
                  <div>
                    <Label>Video File</Label>
                    <div className="text-sm text-gray-600">{videoFile?.name}</div>
                  </div>
                  <div>
                    <Label>Quiz</Label>
                    <div className="text-sm text-gray-600">
                      {courseData.quiz?.title} - {questions.length} questions
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(3)}
                >
                  <ChevronLeft size={16} className="mr-2" /> Back
                </Button>
                <Button 
                  onClick={handleComplete}
                  disabled={createCourseMutation.isPending}
                >
                  {createCourseMutation.isPending ? "Creating..." : "Create Course"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}