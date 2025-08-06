
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Upload, FileVideo, Play, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

interface CourseFormData {
  title: string;
  description: string;
  videoFile: File | null;
  quizQuestions: QuizQuestion[];
}

export default function CourseCreation() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if we're editing
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const editCourseId = urlParams.get('edit');
  const isEditing = !!editCourseId;

  // Check authentication
  const { data: authData, isLoading: authLoading } = useQuery({
    queryKey: ['/api/auth/me'],
    queryFn: async () => {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Not authenticated');
      }
      return response.json();
    }
  });

  // Fetch existing course data if editing
  const { data: existingCourse, isLoading: courseLoading } = useQuery({
    queryKey: [`/api/courses/${editCourseId}`],
    enabled: isEditing && !!editCourseId,
    queryFn: async () => {
      const response = await fetch(`/api/courses/${editCourseId}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch course');
      }
      return response.json();
    }
  });

  // Form data
  const [courseData, setCourseData] = useState<CourseFormData>({
    title: "",
    description: "",
    videoFile: null,
    quizQuestions: []
  });

  // Load existing course data when editing
  useEffect(() => {
    if (isEditing && existingCourse && !courseLoading) {
      console.log('Loading existing course data:', existingCourse);
      setCourseData({
        title: existingCourse.title || "",
        description: existingCourse.description || "",
        videoFile: null, // Keep null for existing video
        quizQuestions: existingCourse.questions || []
      });
    }
  }, [isEditing, existingCourse, courseLoading]);

  const [newQuestion, setNewQuestion] = useState({
    question: "",
    options: ["", "", "", ""],
    correctAnswer: 0
  });

  if (authLoading || (isEditing && courseLoading)) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!authData?.user || authData.user.role !== 'admin') {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-4">Access Denied</h2>
        <p>You need admin privileges to create courses.</p>
      </div>
    </div>;
  }

  if (isEditing && !existingCourse && !courseLoading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-4">Course Not Found</h2>
        <p>The course you're trying to edit doesn't exist.</p>
        <Button onClick={() => setLocation('/enhanced-hr-dashboard')} className="mt-4">
          Back to Dashboard
        </Button>
      </div>
    </div>;
  }

  const steps = [
    { number: 1, title: "Course Details", icon: FileVideo },
    { number: 2, title: "Video Upload", icon: Upload },
    { number: 3, title: "Quiz Creation", icon: Play },
    { number: 4, title: "Review & Complete", icon: CheckCircle }
  ];

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCourseData(prev => ({ ...prev, videoFile: file }));
    }
  };

  const addQuestion = () => {
    if (newQuestion.question && newQuestion.options.every(opt => opt.trim())) {
      setCourseData(prev => ({
        ...prev,
        quizQuestions: [...prev.quizQuestions, { ...newQuestion }]
      }));
      setNewQuestion({
        question: "",
        options: ["", "", "", ""],
        correctAnswer: 0
      });
    } else {
      toast({
        title: "Error",
        description: "Please fill in the question and all options",
        variant: "destructive"
      });
    }
  };

  const removeQuestion = (index: number) => {
    setCourseData(prev => ({
      ...prev,
      quizQuestions: prev.quizQuestions.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Validate required fields
      if (!courseData.title?.trim()) {
        throw new Error("Course title is required");
      }

      if (!courseData.description?.trim()) {
        throw new Error("Course description is required");
      }

      if (!courseData.videoFile && !isEditing) {
        throw new Error("Video file is required for new courses");
      }

      if (courseData.quizQuestions.length === 0) {
        throw new Error("At least one quiz question is required");
      }

      const formData = new FormData();
      formData.append('title', courseData.title.trim());
      formData.append('description', courseData.description.trim());
      formData.append('questions', JSON.stringify(courseData.quizQuestions));

      if (courseData.videoFile) {
        formData.append('video', courseData.videoFile);
      }

      const url = isEditing ? `/api/courses/${editCourseId}` : '/api/courses';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to ${isEditing ? 'update' : 'create'} course`);
      }

      toast({
        title: "Success!",
        description: isEditing ? "Course updated successfully" : "Course created successfully"
      });

      setLocation('/enhanced-hr-dashboard');
    } catch (error) {
      console.error('Course submission error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit course",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return courseData.title?.trim() && courseData.description?.trim();
      case 2: return courseData.videoFile !== null || (isEditing && existingCourse?.videoPath);
      case 3: return courseData.quizQuestions.length > 0;
      default: return true;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="outline" 
            onClick={() => setLocation('/enhanced-hr-dashboard')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">
            {isEditing ? `Edit Course: ${existingCourse?.title || ''}` : 'Create New Course'}
          </h1>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((step, index) => (
            <div key={step.number} className="flex flex-col items-center flex-1">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold ${
                currentStep >= step.number ? 'bg-blue-600' : 'bg-gray-300'
              }`}>
                {currentStep > step.number ? (
                  <CheckCircle className="w-6 h-6" />
                ) : (
                  step.number
                )}
              </div>
              <span className="text-sm mt-2 text-center">{step.title}</span>
              {index < steps.length - 1 && (
                <div className={`h-1 w-full mt-4 ${
                  currentStep > step.number ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Form Content */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Step {currentStep}: {steps[currentStep - 1].title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Course Title *</Label>
                  <Input
                    id="title"
                    value={courseData.title}
                    onChange={(e) => setCourseData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter course title"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Course Description *</Label>
                  <Textarea
                    id="description"
                    value={courseData.description}
                    onChange={(e) => setCourseData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter detailed course description"
                    className="mt-1 min-h-[120px]"
                  />
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="video">Course Video {!isEditing && '*'}</Label>
                  <div className="mt-1 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="mt-4">
                      <Label htmlFor="video-upload" className="cursor-pointer">
                        <span className="mt-2 block text-sm font-medium text-gray-900">
                          {courseData.videoFile 
                            ? courseData.videoFile.name 
                            : isEditing && existingCourse?.videoPath 
                            ? `Current: ${existingCourse.videoPath}` 
                            : "Click to upload video"}
                        </span>
                      </Label>
                      <Input
                        id="video-upload"
                        type="file"
                        accept="video/*"
                        onChange={handleVideoUpload}
                        className="hidden"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      MP4, AVI, MOV up to 500MB
                      {isEditing && existingCourse?.videoPath && !courseData.videoFile && (
                        <span className="block text-blue-600 mt-2">Leave empty to keep current video</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Quiz Questions</h3>

                  {/* Existing Questions */}
                  {courseData.quizQuestions.length > 0 && (
                    <div className="space-y-4 mb-6">
                      <h4 className="font-medium">Added Questions ({courseData.quizQuestions.length})</h4>
                      {courseData.quizQuestions.map((q, index) => (
                        <div key={index} className="border rounded-lg p-4 bg-gray-50">
                          <div className="flex justify-between items-start mb-2">
                            <h5 className="font-medium">Question {index + 1}</h5>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => removeQuestion(index)}
                            >
                              Remove
                            </Button>
                          </div>
                          <p className="mb-2">{q.question}</p>
                          <ul className="list-none space-y-1">
                            {q.options.map((option: string, optIndex: number) => (
                              <li key={optIndex} className={optIndex === q.correctAnswer ? "text-green-600 font-medium" : ""}>
                                {String.fromCharCode(65 + optIndex)}. {option} {optIndex === q.correctAnswer && "✓"}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add New Question */}
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-4">Add New Question</h4>
                    <div className="space-y-4">
                      <div>
                        <Label>Question *</Label>
                        <Textarea
                          value={newQuestion.question}
                          onChange={(e) => setNewQuestion(prev => ({ ...prev, question: e.target.value }))}
                          placeholder="Enter your question"
                          rows={2}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {newQuestion.options.map((option, index) => (
                          <div key={index}>
                            <Label>Option {String.fromCharCode(65 + index)} *</Label>
                            <Input
                              value={option}
                              onChange={(e) => {
                                const newOptions = [...newQuestion.options];
                                newOptions[index] = e.target.value;
                                setNewQuestion(prev => ({ ...prev, options: newOptions }));
                              }}
                              placeholder={`Enter option ${String.fromCharCode(65 + index)}`}
                            />
                          </div>
                        ))}
                      </div>
                      <div>
                        <Label>Correct Answer *</Label>
                        <select
                          value={newQuestion.correctAnswer}
                          onChange={(e) => setNewQuestion(prev => ({ ...prev, correctAnswer: parseInt(e.target.value) }))}
                          className="w-full p-2 border rounded"
                        >
                          {newQuestion.options.map((option, index) => (
                            <option key={index} value={index}>
                              {String.fromCharCode(65 + index)}: {option || `Option ${String.fromCharCode(65 + index)}`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Button onClick={addQuestion} className="w-full">
                        Add Question
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="text-center space-y-4">
                <CheckCircle className="mx-auto h-16 w-16 text-green-600" />
                <h3 className="text-xl font-semibold">
                  {isEditing ? 'Course Ready to Update!' : 'Course Ready to Create!'}
                </h3>
                <div className="bg-gray-50 p-4 rounded-lg text-left">
                  <p><strong>Title:</strong> {courseData.title}</p>
                  <p><strong>Description:</strong> {courseData.description}</p>
                  <p><strong>Video:</strong> {
                    courseData.videoFile?.name || 
                    (isEditing && existingCourse?.videoPath ? `Current: ${existingCourse.videoPath}` : 'No video')
                  }</p>
                  <p><strong>Quiz Questions:</strong> {courseData.quizQuestions.length}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={handlePrevious}
            disabled={currentStep === 1}
          >
            Previous
          </Button>

          {currentStep < 4 ? (
            <Button 
              onClick={handleNext}
              disabled={!canProceed()}
            >
              Next
            </Button>
          ) : (
            <Button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting 
                ? (isEditing ? "Updating..." : "Creating...") 
                : (isEditing ? "Update Course" : "Create Course")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
