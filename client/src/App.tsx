import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "@/pages/landing";
import HRLogin from "@/pages/hr-login";
import EmployeeLogin from "@/pages/employee-login";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import EnhancedHRDashboard from "@/pages/enhanced-hr-dashboard";
import CourseCreation from "@/pages/course-creation";
import EmployeeDashboard from "@/pages/employee-dashboard";
import NotFound from "@/pages/not-found";
import CourseAccess from "@/pages/course-access";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/hr-login" component={HRLogin} />
      <Route path="/employee-login" component={EmployeeLogin} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/hr-dashboard" component={EnhancedHRDashboard} />
      <Route path="/create-course" component={CourseCreation} />
      <Route path="/employee-dashboard" component={EmployeeDashboard} />
      <Route path="/course-access/:token" component={CourseAccess} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;