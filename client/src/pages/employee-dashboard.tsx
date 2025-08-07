import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  GraduationCap, 
  Book, 
  Tag, 
  User, 
  LogOut, 
  CheckCircle,
  Clock,
  Play,
  Download,
  ArrowLeft,
  Award,
  Calendar
} from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import CourseViewer from "@/components/course-viewer";

export default function EmployeeDashboard() {
  const [, setLocation] = useLocation();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("dashboard"); // Assuming activeTab is intended for the tab switching

  // Check authentication
  const { data: authData, isLoading: authLoading } = useQuery({
    queryKey: ["/api/auth/me"],
  });

  useEffect(() => {
    if (!authLoading && (!authData?.user || authData.user.role !== "employee")) {
      setLocation("/employee-login");
    }
  }, [authData, authLoading, setLocation]);

  // User enrollments
  const { data: enrollments } = useQuery({
    queryKey: ["/api/my-enrollments"],
    enabled: !!authData?.user,
  });

  // User certificates
  const { data: certificates } = useQuery({
    queryKey: ["/api/my-certificates"],
    enabled: !!authData?.user,
  });

  const logout = () => {
    apiRequest("POST", "/api/auth/logout");
    setLocation("/");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  const totalCourses = enrollments?.length || 0;
  const completedCourses = enrollments?.filter((e: any) => e.certificateIssued).length || 0;
  const certificateCount = certificates?.length || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className="w-64 bg-white shadow-sm border-r border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center mr-3">
                <GraduationCap className="text-white" size={16} />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">TrainTrack</h2>
                <p className="text-xs text-gray-500">Employee Portal</p>
              </div>
            </div>
          </div>

          <nav className="p-4">
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => {
                    setActiveSection("dashboard");
                    setSelectedCourse(null);
                    setActiveTab("dashboard"); // Update activeTab
                  }}
                  className={`sidebar-item flex items-center px-4 py-3 text-gray-700 rounded-lg w-full text-left ${
                    activeSection === "dashboard" ? "bg-green-50 text-green-600" : ""
                  }`}
                >
                  <CheckCircle size={16} className="mr-3" />
                  Dashboard
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setActiveSection("courses");
                    setSelectedCourse(null);
                    setActiveTab("courses"); // Update activeTab
                  }}
                  className={`sidebar-item flex items-center px-4 py-3 text-gray-700 rounded-lg w-full text-left ${
                    activeSection === "courses" ? "bg-green-50 text-green-600" : ""
                  }`}
                >
                  <Book size={16} className="mr-3" />
                  My Courses
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setActiveSection("certificates");
                    setSelectedCourse(null);
                    setActiveTab("certificates"); // Update activeTab
                  }}
                  className={`sidebar-item flex items-center px-4 py-3 text-gray-700 rounded-lg w-full text-left ${
                    activeSection === "certificates" ? "bg-green-50 text-green-600" : ""
                  }`}
                >
                  <Tag size={16} className="mr-3" />
                  Certificates
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setActiveSection("profile");
                    setSelectedCourse(null);
                    setActiveTab("profile"); // Update activeTab
                  }}
                  className={`sidebar-item flex items-center px-4 py-3 text-gray-700 rounded-lg w-full text-left ${
                    activeSection === "profile" ? "bg-green-50 text-green-600" : ""
                  }`}
                >
                  <User size={16} className="mr-3" />
                  Profile
                </button>
              </li>
            </ul>
          </nav>

          <div className="absolute bottom-4 left-4 right-4">
            <Button variant="ghost" onClick={logout} className="w-full justify-start">
              <LogOut size={16} className="mr-3" />
              Logout
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {selectedCourse ? selectedCourse.course.title : "My Dashboard"}
                </h1>
                <p className="text-gray-600">
                  Welcome back, {authData?.user?.name || "Employee"}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {authData?.user?.name?.substring(0, 2).toUpperCase() || "E"}
                  </span>
                </div>
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="p-8">
            {selectedCourse ? (
              <div>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedCourse(null)}
                  className="mb-6"
                >
                  <ArrowLeft size={16} className="mr-2" />
                  Back to Courses
                </Button>
                <CourseViewer enrollment={selectedCourse} />
              </div>
            ) : (
              <>
                {activeSection === "dashboard" && (
                  <div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center">
                            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                              <Book className="text-green-600" size={24} />
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Assigned Courses</p>
                              <p className="text-2xl font-bold text-gray-900">{totalCourses}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center">
                            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mr-4">
                              <CheckCircle className="text-primary" size={24} />
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Completed</p>
                              <p className="text-2xl font-bold text-gray-900">{completedCourses}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center">
                            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                              <Tag className="text-green-600" size={24} />
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Certificates</p>
                              <p className="text-2xl font-bold text-gray-900">{certificateCount}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <Card>
                        <CardHeader>
                          <CardTitle>Current Courses</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {enrollments?.filter((e: any) => !e.completedAt).map((enrollment: any) => (
                              <div key={enrollment.id} className="border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="font-medium text-gray-900">{enrollment.course.title}</h4>
                                  <Badge variant={
                                    enrollment.certificateIssued ? "default" : 
                                    enrollment.quizScore && enrollment.quizScore >= 70 ? "default" :
                                    enrollment.quizScore && enrollment.quizScore < 70 ? "destructive" : "secondary"
                                  }>
                                    {enrollment.certificateIssued ? "Completed" : 
                                     enrollment.quizScore && enrollment.quizScore >= 70 ? "Awaiting Certificate" :
                                     enrollment.quizScore && enrollment.quizScore < 70 ? "Needs Retake" : "In Progress"}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{enrollment.course.description}</p>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm text-gray-600">Progress</span>
                                  <span className="text-sm font-medium text-gray-900">{enrollment.progress}%</span>
                                </div>
                                <Progress value={enrollment.progress} className="mb-3" />
                                <Button
                                  size="sm"
                                  className="w-full"
                                  onClick={() => setSelectedCourse(enrollment)}
                                >
                                  {enrollment.certificateIssued ? "Review Course" :
                                   enrollment.quizScore && enrollment.quizScore >= 70 ? "Get Certificate" :
                                   enrollment.quizScore && enrollment.quizScore < 70 ? "Retake Course" :
                                   enrollment.progress > 0 ? "Continue Course" : "Start Course"}
                                </Button>
                              </div>
                            ))}
                            {enrollments?.filter((e: any) => !e.completedAt).length === 0 && (
                              <div className="text-center py-8 text-gray-500">
                                No active courses. Complete your assigned courses to continue.
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Recent Achievements</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {certificates?.slice(0, 3).map((cert: any) => (
                              <div key={cert.id} className="flex items-center p-3 bg-green-50 rounded-lg">
                                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                                  <Tag className="text-green-600" size={16} />
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-900">
                                    {cert.course.title} Tag
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    Completed {new Date(cert.issuedAt).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                            ))}
                            {(!certificates || certificates.length === 0) && (
                              <div className="text-center py-8 text-gray-500">
                                No certificates earned yet. Complete courses to earn certificates.
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}

                {activeSection === "courses" && (
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">My Courses</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {enrollments?.map((enrollment: any) => (
                        <Card key={enrollment.id}>
                          <CardContent className="pt-6">
                            <div className="w-full h-32 bg-gray-200 rounded-lg mb-4 relative overflow-hidden flex items-center justify-center">
                              <Play className="text-gray-400" size={32} />
                              <div className="absolute top-2 left-2">
                                <Badge variant={
                                  enrollment.certificateIssued ? "default" : 
                                  enrollment.quizScore && enrollment.quizScore >= 70 ? "default" :
                                  enrollment.quizScore && enrollment.quizScore < 70 ? "destructive" : "secondary"
                                }>
                                  {enrollment.certificateIssued ? "Completed" : 
                                   enrollment.quizScore && enrollment.quizScore >= 70 ? "Awaiting Certificate" :
                                   enrollment.quizScore && enrollment.quizScore < 70 ? "Needs Retake" : "In Progress"}
                                </Badge>
                              </div>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">{enrollment.course.title}</h3>
                            <p className="text-gray-600 text-sm mb-3 line-clamp-2">{enrollment.course.description}</p>
                            <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                              <span>
                                <Clock size={12} className="inline mr-1" />
                                {enrollment.course.duration} min
                              </span>
                              {enrollment.progress > 0 && (
                                <span>{enrollment.progress}% complete</span>
                              )}
                            </div>
                            {enrollment.progress > 0 && enrollment.progress < 100 && (
                              <Progress value={enrollment.progress} className="mb-4" />
                            )}
                            <Button
                              className="w-full"
                              onClick={() => setSelectedCourse(enrollment)}
                            >
                              {enrollment.certificateIssued ? "Review Course" :
                               enrollment.quizScore && enrollment.quizScore >= 70 ? "Get Certificate" :
                               enrollment.quizScore && enrollment.quizScore < 70 ? "Retake Course" :
                               enrollment.progress > 0 ? "Continue Course" : "Start Course"}
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                      {(!enrollments || enrollments.length === 0) && (
                        <div className="col-span-full text-center py-12 text-gray-500">
                          No courses assigned yet. Contact HR for course assignments.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeSection === "certificates" && (
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">My Certificates</h2>

                    <div className="space-y-8">
                      {certificates?.map((cert) => (
                        <div key={cert.id} className="border rounded-lg overflow-hidden">
                          <div className="bg-gray-50 px-6 py-4 border-b">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Award className="w-5 h-5 text-green-600" />
                                <h4 className="font-semibold">{cert.course.title}</h4>
                                <Badge variant="secondary">
                                  Score: {cert.certificateData?.score || 'N/A'}%
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-500">
                                Issued: {new Date(cert.issuedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="p-1">
                            <div className="transform scale-75 origin-top">
                              <div className="w-full max-w-4xl mx-auto bg-gradient-to-br from-blue-50 to-white border-2 border-blue-200 shadow-lg rounded-lg">
                                <div className="p-12">
                                  {/* Header */}
                                  <div className="text-center mb-8">
                                    <div className="flex justify-center mb-4">
                                      <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
                                        <Award className="w-8 h-8 text-white" />
                                      </div>
                                    </div>
                                    <h1 className="text-4xl font-bold text-blue-900 mb-2">CERTIFICATE OF COMPLETION</h1>
                                    <div className="w-24 h-1 bg-blue-600 mx-auto"></div>
                                  </div>

                                  {/* Certificate Content */}
                                  <div className="text-center space-y-6">
                                    <p className="text-lg text-gray-700">This is to certify that</p>

                                    <h2 className="text-3xl font-bold text-blue-800 border-b-2 border-blue-200 pb-2 inline-block px-8">
                                      {cert.certificateData?.participantName || authData?.user?.name || 'N/A'}
                                    </h2>

                                    <p className="text-lg text-gray-700">has successfully completed the training course</p>

                                    <h3 className="text-2xl font-semibold text-blue-700 bg-blue-50 py-3 px-6 rounded-lg inline-block">
                                      {cert.certificateData?.courseName || cert.course.title}
                                    </h3>

                                    <div className="flex justify-center items-center space-x-8 mt-8">
                                      <div className="text-center">
                                        <div className="flex items-center justify-center gap-2 mb-1">
                                          <CheckCircle className="w-5 h-5 text-green-600" />
                                          <span className="font-semibold text-gray-700">Score Achieved</span>
                                        </div>
                                        <p className="text-2xl font-bold text-green-600">{cert.certificateData?.score || 'N/A'}%</p>
                                      </div>

                                      <div className="w-px h-12 bg-gray-300"></div>

                                      <div className="text-center">
                                        <div className="flex items-center justify-center gap-2 mb-1">
                                          <Calendar className="w-5 h-5 text-blue-600" />
                                          <span className="font-semibold text-gray-700">Completion Date</span>
                                        </div>
                                        <p className="text-lg text-blue-600">
                                          {cert.certificateData?.completionDate || new Date(cert.issuedAt).toLocaleDateString()}
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Footer */}
                                  <div className="mt-12 pt-6 border-t border-gray-200">
                                    <div className="flex justify-between items-end">
                                      <div className="text-left">
                                        <p className="text-sm text-gray-600 mb-1">Certificate ID</p>
                                        <p className="font-mono text-sm font-semibold text-gray-800">
                                          {cert.certificateData?.certificateId || cert.id}
                                        </p>
                                      </div>

                                      <div className="text-center">
                                        <div className="w-48 border-b-2 border-gray-400 mb-2"></div>
                                        <p className="text-sm font-semibold text-gray-700">Training Administrator</p>
                                        <p className="text-xs text-gray-500">TrainTrack Learning Management System</p>
                                      </div>

                                      <div className="text-right">
                                        <p className="text-sm text-gray-600 mb-1">Issued Date</p>
                                        <p className="text-sm font-semibold text-gray-800">
                                          {new Date(cert.issuedAt).toLocaleDateString()}
                                        </p>
                                      </div>
                                    </div>

                                    {cert.certificateData?.digitalSignature && (
                                      <div className="mt-6 text-center">
                                        <p className="text-xs text-gray-500 mb-1">Digitally Acknowledged by Participant</p>
                                        <p className="text-sm font-semibold text-blue-700 italic">
                                          "{cert.certificateData.digitalSignature}"
                                        </p>
                                      </div>
                                    )}
                                  </div>

                                  {/* Verification Footer */}
                                  <div className="mt-8 text-center">
                                    <p className="text-xs text-gray-400">
                                      This certificate is digitally generated and authenticated. 
                                      For verification, please contact the training administrator with the certificate ID.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="text-center py-4">
                              <Button variant="outline">
                                <Download className="w-4 h-4 mr-2" />
                                Download Certificate
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {(!certificates || certificates.length === 0) && (
                        <div className="text-center py-12 text-gray-500">
                          No certificates earned yet. Complete courses to earn certificates.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeSection === "profile" && (
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">My Profile</h2>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      <div className="lg:col-span-1">
                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-center">
                              <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-white text-2xl font-bold">
                                  {authData?.user?.name?.substring(0, 2).toUpperCase() || "E"}
                                </span>
                              </div>
                              <h3 className="text-xl font-semibold text-gray-900">{authData?.user?.name}</h3>
                              <p className="text-gray-600">{authData?.user?.position || "Employee"}</p>
                            </div>

                            <div className="space-y-4 mt-6">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <p className="text-gray-900">{authData?.user?.email}</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                                <p className="text-gray-900">{authData?.user?.department || "N/A"}</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Join Date</label>
                                <p className="text-gray-900">
                                  {authData?.user?.joinDate ? new Date(authData.user.joinDate).toLocaleDateString() : "N/A"}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="lg:col-span-2">
                        <Card>
                          <CardHeader>
                            <CardTitle>Training Progress</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                              <div className="text-center">
                                <div className="text-2xl font-bold text-primary">{totalCourses}</div>
                                <div className="text-sm text-gray-600">Total Courses</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold text-green-600">{completedCourses}</div>
                                <div className="text-sm text-gray-600">Completed</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold text-green-600">{certificateCount}</div>
                                <div className="text-sm text-gray-600">Certificates</div>
                              </div>
                            </div>

                            <div className="space-y-3">
                              {enrollments?.map((enrollment: any) => (
                                <div key={enrollment.id}>
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-sm font-medium text-gray-900">{enrollment.course.title}</span>
                                    <span className="text-sm text-gray-600">{enrollment.progress}%</span>
                                  </div>
                                  <Progress value={enrollment.progress} />
                                </div>
                              ))}
                              {(!enrollments || enrollments.length === 0) && (
                                <div className="text-center py-8 text-gray-500">
                                  No course progress to display.
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}