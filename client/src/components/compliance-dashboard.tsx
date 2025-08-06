
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  Users, 
  FileText,
  RefreshCw,
  Upload,
  Download
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function ComplianceDashboard() {
  const { data: complianceData, refetch } = useQuery({
    queryKey: ["/api/compliance-status"],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  const [bulkAction, setBulkAction] = useState<string>("");

  const handleBulkRenewal = async (courseId: string) => {
    try {
      await apiRequest("POST", "/api/renew-expired-certifications", {
        body: { courseId }
      });
      refetch();
    } catch (error) {
      console.error("Failed to renew certifications:", error);
    }
  };

  const exportComplianceReport = () => {
    // Export compliance data as CSV
    const csvData = complianceData?.expiringEmployees?.map(emp => ({
      employeeId: emp.user.employeeId,
      name: emp.user.name,
      email: emp.user.email,
      course: emp.course.title,
      expirationDate: new Date(emp.expiresAt).toLocaleDateString(),
      status: emp.isExpired ? "Expired" : "Expiring Soon"
    }));

    // Convert to CSV and download
    if (csvData) {
      const csv = [
        Object.keys(csvData[0]).join(","),
        ...csvData.map(row => Object.values(row).join(","))
      ].join("\n");
      
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `compliance-report-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    }
  };

  if (!complianceData) {
    return <div>Loading compliance data...</div>;
  }

  const complianceRate = complianceData.activeEmployees > 0 
    ? Math.round(((complianceData.activeEmployees - complianceData.expiredCertifications) / complianceData.activeEmployees) * 100)
    : 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Compliance Dashboard</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportComplianceReport}>
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Compliance Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                <Users className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Employees</p>
                <p className="text-2xl font-bold">{complianceData.activeEmployees}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center mr-4 ${
                complianceRate >= 95 ? 'bg-green-100' : complianceRate >= 80 ? 'bg-yellow-100' : 'bg-red-100'
              }`}>
                <CheckCircle className={`${
                  complianceRate >= 95 ? 'text-green-600' : complianceRate >= 80 ? 'text-yellow-600' : 'text-red-600'
                }`} size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Compliance Rate</p>
                <p className="text-2xl font-bold">{complianceRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mr-4">
                <AlertTriangle className="text-red-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Expired Certifications</p>
                <p className="text-2xl font-bold text-red-600">{complianceData.expiredCertifications}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mr-4">
                <Clock className="text-orange-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Expiring in 30 Days</p>
                <p className="text-2xl font-bold text-orange-600">{complianceData.expiringInNext30Days}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Progress Bar */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Compliance Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Compliance Rate</span>
              <span>{complianceRate}%</span>
            </div>
            <Progress value={complianceRate} className="w-full" />
            <div className="flex justify-between text-sm text-gray-500">
              <span>{complianceData.activeEmployees - complianceData.expiredCertifications} compliant</span>
              <span>{complianceData.activeEmployees} total active</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compliance Courses */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance Courses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {complianceData.complianceCourses.map((course) => (
              <div key={course.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">{course.title}</h4>
                  <p className="text-sm text-gray-600">
                    Renewal Period: {course.renewalPeriodMonths} months
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={course.isAutoEnrollNewEmployees ? "default" : "secondary"}>
                    {course.isAutoEnrollNewEmployees ? "Auto-Enroll" : "Manual"}
                  </Badge>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleBulkRenewal(course.id)}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Renew Expired
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Employees with Expiring Certifications */}
      {complianceData.expiringEmployees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Employees with Expiring Certifications 
              <Badge variant="destructive" className="ml-2">
                {complianceData.expiringEmployees.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {complianceData.expiringEmployees.map((emp) => (
                <div key={`${emp.userId}-${emp.courseId}`} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{emp.user.name}</p>
                    <p className="text-sm text-gray-600">{emp.user.email}</p>
                    <p className="text-sm text-gray-500">{emp.course.title}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={emp.isExpired ? "destructive" : "secondary"}>
                      {emp.isExpired ? "Expired" : "Expiring Soon"}
                    </Badge>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(emp.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
