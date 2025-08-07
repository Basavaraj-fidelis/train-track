import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Users, BookOpen } from "lucide-react";

interface BulkAssignCourseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId?: string;
  courseName?: string;
}

export function BulkAssignCourseDialog({ 
  open, 
  onOpenChange, 
  courseId, 
  courseName 
}: BulkAssignCourseDialogProps) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: employees } = useQuery({
    queryKey: ["/api/employees"],
    enabled: open,
  });

  const assignCourseMutation = useMutation({
    mutationFn: async (data: { courseId: string; userIds: string[] }) => {
      const response = await apiRequest("POST", "/api/bulk-assign-course", data);
      return response.json();
    },
    onSuccess: (data) => {
      // Force refetch for immediate updates
      queryClient.refetchQueries({ queryKey: ["/api/employees"] });
      queryClient.refetchQueries({ queryKey: ["/api/dashboard-stats"] });
      onOpenChange(false);
      toast({
        title: "Success",
        description: `Course assigned to ${data.assignedCount} employees`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign course",
        variant: "destructive",
      });
    },
  });

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAll = () => {
    if (employees) {
      setSelectedUsers(employees.map((emp: any) => emp.id));
    }
  };

  const clearAll = () => {
    setSelectedUsers([]);
  };

  const handleSubmit = () => {
    if (!courseId || selectedUsers.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one employee",
        variant: "destructive",
      });
      return;
    }

    assignCourseMutation.mutate({
      courseId,
      userIds: selectedUsers,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Assign Course: {courseName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">
              Select Employees ({selectedUsers.length} selected)
            </Label>
            <div className="space-x-2">
              <Button type="button" variant="outline" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={clearAll}>
                Clear All
              </Button>
            </div>
          </div>

          <ScrollArea className="h-64 border rounded-lg p-4">
            <div className="space-y-3">
              {employees?.map((employee: any) => (
                <div key={employee.id} className="flex items-center space-x-3">
                  <Checkbox
                    id={employee.id}
                    checked={selectedUsers.includes(employee.id)}
                    onCheckedChange={() => toggleUser(employee.id)}
                  />
                  <div className="flex-1">
                    <Label htmlFor={employee.id} className="cursor-pointer">
                      <div className="font-medium">{employee.name}</div>
                      <div className="text-sm text-gray-500">
                        {employee.designation} • {employee.department}
                      </div>
                    </Label>
                  </div>
                </div>
              ))}
              {(!employees || employees.length === 0) && (
                <div className="text-center py-4 text-gray-500">
                  No employees found
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={selectedUsers.length === 0 || assignCourseMutation.isPending}
            >
              {assignCourseMutation.isPending ? "Assigning..." : `Assign to ${selectedUsers.length} Employees`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface BulkAssignUsersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkAssignUsersDialog({ open, onOpenChange }: BulkAssignUsersDialogProps) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: employees } = useQuery({
    queryKey: ["/api/employees"],
    enabled: open,
  });

  const { data: courses } = useQuery({
    queryKey: ["/api/courses"],
    enabled: open,
  });

  const assignUsersMutation = useMutation({
    mutationFn: async (data: { userIds: string[]; courseIds: string[] }) => {
      const response = await apiRequest("POST", "/api/bulk-assign-users", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      onOpenChange(false);
      setSelectedUsers([]);
      setSelectedCourses([]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign users",
        variant: "destructive",
      });
    },
  });

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleCourse = (courseId: string) => {
    setSelectedCourses(prev => 
      prev.includes(courseId) 
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId]
    );
  };

  const handleSubmit = () => {
    if (selectedUsers.length === 0 || selectedCourses.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one employee and one course",
        variant: "destructive",
      });
      return;
    }

    assignUsersMutation.mutate({
      userIds: selectedUsers,
      courseIds: selectedCourses,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Bulk Assign Users to Courses</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6">
          {/* Users Selection */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Users size={20} />
              <Label className="text-base font-medium">
                Select Employees ({selectedUsers.length} selected)
              </Label>
            </div>

            <ScrollArea className="h-64 border rounded-lg p-4">
              <div className="space-y-3">
                {employees?.map((employee: any) => (
                  <div key={employee.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={`user-${employee.id}`}
                      checked={selectedUsers.includes(employee.id)}
                      onCheckedChange={() => toggleUser(employee.id)}
                    />
                    <div className="flex-1">
                      <Label htmlFor={`user-${employee.id}`} className="cursor-pointer">
                        <div className="font-medium text-sm">{employee.name}</div>
                        <div className="text-xs text-gray-500">
                          {employee.designation}
                        </div>
                      </Label>
                    </div>
                  </div>
                ))}
                {(!employees || employees.length === 0) && (
                  <div className="text-center py-4 text-gray-500">
                    No employees found
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Courses Selection */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <BookOpen size={20} />
              <Label className="text-base font-medium">
                Select Courses ({selectedCourses.length} selected)
              </Label>
            </div>

            <ScrollArea className="h-64 border rounded-lg p-4">
              <div className="space-y-3">
                {courses?.map((course: any) => (
                  <div key={course.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={`course-${course.id}`}
                      checked={selectedCourses.includes(course.id)}
                      onCheckedChange={() => toggleCourse(course.id)}
                    />
                    <div className="flex-1">
                      <Label htmlFor={`course-${course.id}`} className="cursor-pointer">
                        <div className="font-medium text-sm">{course.title}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {course.description}
                        </div>
                      </Label>
                    </div>
                  </div>
                ))}
                {(!courses || courses.length === 0) && (
                  <div className="text-center py-4 text-gray-500">
                    No courses found
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={selectedUsers.length === 0 || selectedCourses.length === 0 || assignUsersMutation.isPending}
          >
            {assignUsersMutation.isPending 
              ? "Assigning..." 
              : `Assign ${selectedUsers.length} Users to ${selectedCourses.length} Courses`
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}