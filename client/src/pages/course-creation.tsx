import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Upload, Plus, Trash2 } from "lucide-react";
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
  courseType: "recurring" | "one-time";
  youtubeUrl: string;
  duration: number;
  quizQuestions: QuizQuestion[];
}

export default function CourseCreation() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if we're editing
  const urlParams = new URLSearchParams(location.split("?")[1] || "");
  const editCourseId = urlParams.get("edit");
  const isEditing = !!editCourseId;

  // Check authentication
  const { data: authData, isLoading: authLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Not authenticated");
      }
      return response.json();
    },
  });

  // Fetch existing course data if editing
  const { data: existingCourse, isLoading: courseLoading } = useQuery({
    queryKey: [`/api/courses/${editCourseId}`],
    enabled: isEditing && !!editCourseId,
    queryFn: async () => {
      const response = await fetch(`/api/courses/${editCourseId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch course");
      }
      return response.json();
    },
  });

  // Form data
  const [courseData, setCourseData] = useState<CourseFormData>({
    title: "",
    description: "",
    courseType: "one-time",
    youtubeUrl: "",
    duration: 30,
    quizQuestions: [],
  });

  // Load existing course data when editing
  useEffect(() => {
    if (isEditing && existingCourse && !courseLoading) {
      console.log("Loading existing course data:", existingCourse);
      setCourseData({
        title: existingCourse.title || "",
        description: existingCourse.description || "",
        courseType: existingCourse.courseType || "one-time",
        youtubeUrl: existingCourse.videoPath || existingCourse.youtubeUrl || "",
        duration: existingCourse.duration || 30,
        quizQuestions: existingCourse.questions || [],
      });
    }
  }, [isEditing, existingCourse, courseLoading]);

  const [newQuestion, setNewQuestion] = useState({
    question: "",
    options: ["", "", "", ""],
    correctAnswer: 0,
  });

  if (authLoading || (isEditing && courseLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!authData?.user || authData.user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Access Denied</h2>
          <p>You need admin privileges to create courses.</p>
        </div>
      </div>
    );
  }

  if (isEditing && !existingCourse && !courseLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Course Not Found</h2>
          <p>The course you're trying to edit doesn't exist.</p>
          <Button onClick={() => setLocation("/hr-dashboard")} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const getEmbedUrl = (url: string) => {
    if (!url) return "";

    // Extract video ID from various YouTube URL formats
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);

    if (match && match[2].length === 11) {
      const videoId = match[2];
      // Add parameters to hide controls, YouTube logo, title overlay, and related videos for clean learning experience
      return `https://www.youtube.com/embed/${videoId}?controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&title=0&byline=0&portrait=0`;
    }

    return "";
  };

  const addQuestion = () => {
    if (
      newQuestion.question &&
      newQuestion.options.every((opt) => opt.trim())
    ) {
      setCourseData((prev) => ({
        ...prev,
        quizQuestions: [...prev.quizQuestions, { ...newQuestion }],
      }));
      setNewQuestion({
        question: "",
        options: ["", "", "", ""],
        correctAnswer: 0,
      });
    } else {
      toast({
        title: "Error",
        description: "Please fill in the question and all options",
        variant: "destructive",
      });
    }
  };

  const removeQuestion = (index: number) => {
    setCourseData((prev) => ({
      ...prev,
      quizQuestions: prev.quizQuestions.filter((_, i) => i !== index),
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

      if (!courseData.youtubeUrl?.trim()) {
        throw new Error("YouTube video URL is required");
      }

      // Validate YouTube URL format
      if (!getEmbedUrl(courseData.youtubeUrl)) {
        throw new Error("Please enter a valid YouTube video URL");
      }

      if (courseData.quizQuestions.length === 0) {
        throw new Error("At least one quiz question is required");
      }

      const requestData = {
        title: courseData.title.trim(),
        description: courseData.description.trim(),
        courseType: courseData.courseType,
        youtubeUrl: courseData.youtubeUrl.trim(),
        duration: courseData.duration,
        questions: courseData.quizQuestions,
      };

      console.log('Submitting course data:', requestData);

      const url = isEditing ? `/api/courses/${editCourseId}` : "/api/courses";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            `Failed to ${isEditing ? "update" : "create"} course`,
        );
      }

      toast({
        title: "Success!",
        description: isEditing
          ? "Course updated successfully"
          : "Course created successfully",
      });

      setLocation("/hr-dashboard");
    } catch (error) {
      console.error("Course submission error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to submit course",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            onClick={() => setLocation("/hr-dashboard")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">
            {isEditing
              ? `Edit Course: ${existingCourse?.title || ""}`
              : "Create New Course"}
          </h1>
        </div>

        {/* Single Form */}
        <div className="space-y-6">
          {/* Course Details */}
          <Card>
            <CardHeader>
              <CardTitle>Course Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Course Title *</Label>
                <Input
                  id="title"
                  value={courseData.title}
                  onChange={(e) =>
                    setCourseData((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  placeholder="Enter course title"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="description">Course Description *</Label>
                <Textarea
                  id="description"
                  value={courseData.description}
                  onChange={(e) =>
                    setCourseData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Enter course description"
                  className="mt-1"
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="duration">Duration (minutes) *</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  value={courseData.duration}
                  onChange={(e) =>
                    setCourseData((prev) => ({
                      ...prev,
                      duration: parseInt(e.target.value) || 30,
                    }))
                  }
                  placeholder="Enter course duration in minutes"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Estimated time to complete the course including video and quiz
                </p>
              </div>

              <div>
                <label htmlFor="courseType" className="block text-sm font-medium text-gray-700">
                  Course Type
                </label>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="one-time"
                      name="courseType"
                      value="one-time"
                      checked={courseData.courseType === "one-time"}
                      onChange={(e) =>
                        setCourseData((prev) => ({ ...prev, courseType: e.target.value as "one-time" | "recurring" }))
                      }
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <label htmlFor="one-time" className="ml-2 text-sm text-gray-700">
                      One-time Course (Certificate never expires)
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="recurring"
                      name="courseType"
                      value="recurring"
                      checked={courseData.courseType === "recurring"}
                      onChange={(e) =>
                        setCourseData((prev) => ({ ...prev, courseType: e.target.value as "one-time" | "recurring" }))
                      }
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <label htmlFor="recurring" className="ml-2 text-sm text-gray-700">
                      Recurring Course (Certificate expires and requires renewal)
                    </label>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Recurring courses will have certificates that expire after the renewal period, requiring employees to retake the course.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* YouTube Video Link */}
          <Card>
            <CardHeader>
              <CardTitle>Course Video</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="youtube-url">YouTube Video URL {!isEditing && "*"}</Label>
                <Input
                  id="youtube-url"
                  value={courseData.youtubeUrl || ""}
                  onChange={(e) =>
                    setCourseData((prev) => ({
                      ...prev,
                      youtubeUrl: e.target.value,
                    }))
                  }
                  placeholder="https://www.youtube.com/watch?v=VIDEO_ID"
                  className="mt-1"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Enter a YouTube video URL. The video will be embedded with related videos and controls hidden for better learning experience.
                </p>
                {courseData.youtubeUrl && (
                  <div className="mt-4 border rounded-lg overflow-hidden">
                    <div className="bg-gray-100 p-2 text-sm font-medium text-gray-700">
                      Preview:
                    </div>
                    <div className="aspect-video">
                      <iframe
                        width="100%"
                        height="100%"
                        src={getEmbedUrl(courseData.youtubeUrl)}
                        title="Course Video Preview"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      ></iframe>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quiz Questions */}
          <Card>
            <CardHeader>
              <CardTitle>Quiz Questions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Existing Questions */}
              {courseData.quizQuestions.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-medium">
                    Added Questions ({courseData.quizQuestions.length})
                  </h4>
                  {courseData.quizQuestions.map((q, index) => (
                    <div
                      key={index}
                      className="border rounded-lg p-4 bg-gray-50"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h5 className="font-medium">Question {index + 1}</h5>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeQuestion(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="mb-2">{q.question}</p>
                      <ul className="list-none space-y-1">
                        {q.options.map((option: string, optIndex: number) => (
                          <li
                            key={optIndex}
                            className={
                              optIndex === q.correctAnswer
                                ? "text-green-600 font-medium"
                                : ""
                            }
                          >
                            {String.fromCharCode(65 + optIndex)}. {option}{" "}
                            {optIndex === q.correctAnswer && "✓"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Question */}
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-4 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add New Question
                </h4>
                <div className="space-y-4">
                  <div>
                    <Label>Question *</Label>
                    <Textarea
                      value={newQuestion.question}
                      onChange={(e) =>
                        setNewQuestion((prev) => ({
                          ...prev,
                          question: e.target.value,
                        }))
                      }
                      placeholder="Enter your question"
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {newQuestion.options.map((option, index) => (
                      <div key={index}>
                        <Label>
                          Option {String.fromCharCode(65 + index)} *
                        </Label>
                        <Input
                          value={option}
                          onChange={(e) => {
                            const newOptions = [...newQuestion.options];
                            newOptions[index] = e.target.value;
                            setNewQuestion((prev) => ({
                              ...prev,
                              options: newOptions,
                            }));
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
                      onChange={(e) =>
                        setNewQuestion((prev) => ({
                          ...prev,
                          correctAnswer: parseInt(e.target.value),
                        }))
                      }
                      className="w-full p-2 border rounded"
                    >
                      {newQuestion.options.map((option, index) => (
                        <option key={index} value={index}>
                          {String.fromCharCode(65 + index)}:{" "}
                          {option ||
                            `Option ${String.fromCharCode(65 + index)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button onClick={addQuestion} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Question
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <Button
              variant="outline"
              onClick={() => setLocation("/hr-dashboard")}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                !courseData.title?.trim() ||
                !courseData.description?.trim() ||
                !courseData.youtubeUrl?.trim() ||
                courseData.quizQuestions.length === 0
              }
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting
                ? isEditing
                  ? "Updating..."
                  : "Creating..."
                : isEditing
                  ? "Update Course"
                  : "Create Course"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}