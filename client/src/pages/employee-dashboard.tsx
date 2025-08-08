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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-blue-50 to-purple-50">
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className="w-72 bg-white/80 backdrop-blur-sm shadow-xl border-r border-gray-200/50">
          <div className="p-6 border-b border-gray-200/50 bg-gradient-to-r from-emerald-500/10 to-blue-500/10">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-xl flex items-center justify-center mr-3 shadow-lg">
                <GraduationCap className="text-white" size={18} />
              </div>
              <div>
                <h2 className="font-bold text-gray-900 text-lg">TrainTrack</h2>
                <p className="text-sm text-gray-600">Employee Portal</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4">
            <ul className="space-y-3">
              {[
                { id: "dashboard", label: "Dashboard", icon: CheckCircle, color: "text-emerald-600" },
                { id: "courses", label: "My Courses", icon: Book, color: "text-blue-600" },
                { id: "certificates", label: "Certificates", icon: Award, color: "text-purple-600" },
                { id: "profile", label: "Profile", icon: User, color: "text-gray-600" },
              ].map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      setActiveSection(item.id);
                      setSelectedCourse(null);
                    }}
                    className={`sidebar-item flex items-center px-4 py-3 text-gray-700 rounded-xl w-full text-left transition-all duration-200 ${
                      activeSection === item.id 
                        ? "bg-gradient-to-r from-emerald-500 to-blue-600 text-white shadow-lg transform scale-[1.02]" 
                        : `hover:bg-gray-100/60 hover:shadow-md ${item.color}`
                    }`}
                  >
                    <item.icon size={18} className="mr-3" />
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          {/* Header */}
          <header className="bg-white/60 backdrop-blur-sm border-b border-gray-200/50 px-8 py-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-1">
                  {selectedCourse ? selectedCourse.course.title : "My Learning Dashboard"}
                </h1>
                <p className="text-gray-600 text-lg">
                  Welcome back, {authData?.user?.name || "Employee"}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-white text-lg font-bold">
                    {authData?.user?.name?.substring(0, 2).toUpperCase() || "E"}
                  </span>
                </div>
                <Button 
                  variant="ghost" 
                  onClick={logout} 
                  size="sm" 
                  className="flex items-center bg-white/70 hover:bg-white shadow-md"
                >
                  <LogOut size={16} className="mr-2" />
                  Logout
                </Button>
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
                      <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100/50 hover:shadow-xl transition-all duration-300">
                        <CardContent className="pt-6">
                          <div className="flex items-center">
                            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                              <Book className="text-white" size={26} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-blue-700 mb-1">Assigned Courses</p>
                              <p className="text-3xl font-bold text-blue-900">{totalCourses}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-emerald-100/50 hover:shadow-xl transition-all duration-300">
                        <CardContent className="pt-6">
                          <div className="flex items-center">
                            <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                              <CheckCircle className="text-white" size={26} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-emerald-700 mb-1">Completed</p>
                              <p className="text-3xl font-bold text-emerald-900">{completedCourses}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100/50 hover:shadow-xl transition-all duration-300">
                        <CardContent className="pt-6">
                          <div className="flex items-center">
                            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                              <Award className="text-white" size={26} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-purple-700 mb-1">Certificates</p>
                              <p className="text-3xl font-bold text-purple-900">{certificateCount}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <Card className="border-0 shadow-lg bg-white/70 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
                        <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-t-xl">
                          <CardTitle className="flex items-center gap-2 text-gray-800">
                            <Book className="w-5 h-5 text-blue-600" />
                            Assigned Courses
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {enrollments?.map((enrollment: any) => (
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
                            {(!enrollments || enrollments.length === 0) && (
                              <div className="text-center py-8 text-gray-500">
                                No courses assigned yet. Contact HR for course assignments.
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Recent Achievements Section */}
                      <Card className="border-0 shadow-lg bg-white/70 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
                        <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-t-xl">
                          <CardTitle className="flex items-center gap-2 text-gray-800">
                            <Award className="w-5 h-5 text-emerald-600" />
                            Certificate Status
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {certificates && certificates.length > 0 ? (
                              certificates.slice(0, 5).map((cert: any) => {
                                // Use course type and certificate data for proper expiry calculation
                                const issuedDate = new Date(cert.issuedAt);
                                let expirationDate = new Date(issuedDate);
                                
                                // Check if course is recurring and has expiry data
                                if (cert.course.courseType === 'recurring' && cert.certificateData?.expiresAt) {
                                  expirationDate = new Date(cert.certificateData.expiresAt);
                                } else if (cert.course.renewalPeriodMonths) {
                                  expirationDate.setMonth(expirationDate.getMonth() + cert.course.renewalPeriodMonths);
                                } else {
                                  // Default to 1 year for one-time courses
                                  expirationDate.setFullYear(expirationDate.getFullYear() + 1);
                                }

                                const today = new Date();
                                const isExpired = today > expirationDate;
                                const daysUntilExpiry = Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                const isExpiringSoon = daysUntilExpiry <= 30 && daysUntilExpiry > 0;

                                return (
                                  <div key={cert.id} className="flex items-center justify-between p-3 border rounded-lg">
                                    <div className="flex items-center">
                                      <Award className={`h-8 w-8 mr-3 ${isExpired ? 'text-red-500' : isExpiringSoon ? 'text-yellow-500' : 'text-green-500'}`} />
                                      <div>
                                        <div className="font-medium">{cert.course.title}</div>
                                        <div className="text-sm text-gray-500">
                                          Completed {new Date(cert.issuedAt).toLocaleDateString()}
                                        </div>
                                        <div className={`text-sm font-medium ${isExpired ? 'text-red-600' : isExpiringSoon ? 'text-yellow-600' : 'text-green-600'}`}>
                                          {cert.course.courseType === 'one-time' 
                                            ? 'No expiration (One-time certificate)'
                                            : isExpired 
                                            ? `Expired on ${expirationDate.toLocaleDateString()}`
                                            : isExpiringSoon
                                            ? `Expires in ${daysUntilExpiry} days (${expirationDate.toLocaleDateString()})`
                                            : `Valid until ${expirationDate.toLocaleDateString()}`}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                      <Badge variant={cert.course.courseType === 'one-time' ? "default" : isExpired ? "destructive" : isExpiringSoon ? "secondary" : "default"}>
                                        {cert.course.courseType === 'one-time' ? "Permanent" : isExpired ? "Expired" : isExpiringSoon ? "Expiring Soon" : "Valid"}
                                      </Badge>
                                      {cert.course.courseType === 'recurring' && (isExpired || isExpiringSoon) && (
                                        <Badge variant="outline" className="text-xs">
                                          Renewal Required
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="text-center py-8 text-gray-500">
                                No certificates earned yet. Complete courses to earn certificates!
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {enrollments?.map((enrollment: any) => (
                        <Card key={enrollment.id} className="border-0 shadow-lg bg-white/70 backdrop-blur-sm hover:shadow-xl transition-all duration-300 overflow-hidden">
                          <CardContent className="pt-6">
                            <div className="w-full h-32 bg-gradient-to-br from-blue-100 to-purple-100 rounded-xl mb-4 relative overflow-hidden flex items-center justify-center">
                              <Play className="text-blue-600" size={32} />
                              <div className="absolute top-3 left-3">
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

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      <div className="lg:col-span-1">
                        <Card className="border-0 shadow-lg bg-white/70 backdrop-blur-sm">
                          <CardContent className="pt-6">
                            <div className="text-center">
                              <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                                <span className="text-white text-2xl font-bold">
                                  {authData?.user?.name?.substring(0, 2).toUpperCase() || "E"}
                                </span>
                              </div>
                              <h3 className="text-xl font-semibold text-gray-900">{authData?.user?.name}</h3>
                              <p className="text-gray-600">{authData?.user?.designation || "Employee"}</p>
                              <Badge variant="outline" className="mt-2">
                                {authData?.user?.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Basic Information Card */}
                        <Card className="mt-6 border-0 shadow-lg bg-white/70 backdrop-blur-sm">
                          <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-t-xl">
                            <CardTitle className="flex items-center gap-2 text-gray-800">
                              <User className="w-5 h-5 text-blue-600" />
                              Basic Information
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                              <p className="text-gray-900 font-mono">{authData?.user?.employeeId || "N/A"}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                              <p className="text-gray-900">{authData?.user?.email}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                              <p className="text-gray-900">{authData?.user?.phoneNumber || "N/A"}</p>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Work Information Card */}
                        <Card className="mt-6 border-0 shadow-lg bg-white/70 backdrop-blur-sm">
                          <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-t-xl">
                            <CardTitle className="flex items-center gap-2 text-gray-800">
                              <GraduationCap className="w-5 h-5 text-emerald-600" />
                              Work Information
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                              <p className="text-gray-900">{authData?.user?.department || "N/A"}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                              <p className="text-gray-900">{authData?.user?.designation || "N/A"}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
                              <p className="text-gray-900">{authData?.user?.clientName || "N/A"}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                              <Badge variant="secondary">{authData?.user?.role || "employee"}</Badge>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="lg:col-span-2">
                        <Card className="border-0 shadow-lg bg-white/70 backdrop-blur-sm">
                          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-t-xl">
                            <CardTitle className="flex items-center gap-2 text-gray-800">
                              <BarChart3 className="w-5 h-5 text-purple-600" />
                              Training Progress
                            </CardTitle>
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