import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const employeeSchema = z.object({
  employeeId: z.string().min(1, "Employee ID is required"),
  name: z.string().min(1, "Employee name is required"),
  email: z.string().email("Valid email is required"),
  designation: z.string().min(1, "Designation is required"),
  department: z.string().min(1, "Department is required"),
  clientName: z.string().min(1, "Client name is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
});

interface EnhancedEmployeeFormProps {
  onSubmit: (data: z.infer<typeof employeeSchema>) => void;
  onCancel: () => void;
  isLoading?: boolean;
  initialData?: Partial<z.infer<typeof employeeSchema>>;
  mode?: "create" | "edit";
}

export default function EnhancedEmployeeForm({ 
  onSubmit, 
  onCancel, 
  isLoading = false,
  initialData,
  mode = "create" 
}: EnhancedEmployeeFormProps) {
  const form = useForm({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      employeeId: "",
      name: "",
      email: "",
      designation: "",
      department: "",
      clientName: "",
      phoneNumber: "",
    },
  });

  // Update form values when initialData changes
  React.useEffect(() => {
    if (initialData && mode === "edit") {
      form.reset({
        employeeId: initialData.employeeId || "",
        name: initialData.name || "",
        email: initialData.email || "",
        designation: initialData.designation || "",
        department: initialData.department || "",
        clientName: initialData.clientName || "",
        phoneNumber: initialData.phoneNumber || "",
      });
    }
  }, [initialData, mode, form]);

  const handleSubmit = (data: z.infer<typeof employeeSchema>) => {
    onSubmit(data);
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>
          {mode === "create" ? "Add New Employee" : "Edit Employee"}
        </DialogTitle>
      </DialogHeader>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="employeeId">Employee ID</Label>
            <Input
              id="employeeId"
              {...form.register("employeeId")}
              placeholder="EMP001"
              className={form.formState.errors.employeeId ? "border-destructive" : ""}
            />
            {form.formState.errors.employeeId && (
              <p className="text-sm text-destructive mt-1">
                {form.formState.errors.employeeId.message}
              </p>
            )}
          </div>
          
          <div>
            <Label htmlFor="name">Employee Name</Label>
            <Input
              id="name"
              {...form.register("name")}
              placeholder="John Doe"
              className={form.formState.errors.name ? "border-destructive" : ""}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive mt-1">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="email">Employee Email</Label>
          <Input
            id="email"
            type="email"
            {...form.register("email")}
            placeholder="john.doe@company.com"
            className={form.formState.errors.email ? "border-destructive" : ""}
          />
          {form.formState.errors.email && (
            <p className="text-sm text-destructive mt-1">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="designation">Employee Designation</Label>
            <Input
              id="designation"
              {...form.register("designation")}
              placeholder="Software Engineer"
              className={form.formState.errors.designation ? "border-destructive" : ""}
            />
            {form.formState.errors.designation && (
              <p className="text-sm text-destructive mt-1">
                {form.formState.errors.designation.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="department">Employee Department</Label>
            <Input
              id="department"
              {...form.register("department")}
              placeholder="Engineering"
              className={form.formState.errors.department ? "border-destructive" : ""}
            />
            {form.formState.errors.department && (
              <p className="text-sm text-destructive mt-1">
                {form.formState.errors.department.message}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="clientName">Client Name</Label>
            <Input
              id="clientName"
              {...form.register("clientName")}
              placeholder="ABC Corporation"
              className={form.formState.errors.clientName ? "border-destructive" : ""}
            />
            {form.formState.errors.clientName && (
              <p className="text-sm text-destructive mt-1">
                {form.formState.errors.clientName.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="phoneNumber">Phone Number</Label>
            <Input
              id="phoneNumber"
              {...form.register("phoneNumber")}
              placeholder="+1 (555) 123-4567"
              className={form.formState.errors.phoneNumber ? "border-destructive" : ""}
            />
            {form.formState.errors.phoneNumber && (
              <p className="text-sm text-destructive mt-1">
                {form.formState.errors.phoneNumber.message}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : mode === "create" ? "Add Employee" : "Save Changes"}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}