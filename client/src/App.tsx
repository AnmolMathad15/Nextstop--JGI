import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth, type UserRole } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import LoginPage from "@/pages/LoginPage";
import StudentPage from "@/pages/StudentPage";
import DriverPage from "@/pages/DriverPage";
import AdminPage from "@/pages/AdminPage";
import NotFound from "@/pages/not-found";
import FullscreenButton from "@/components/FullscreenButton";

function AppContent() {
  const { user, authData, isAuthenticated, login, logout } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (username: string, password: string, role: UserRole) => {
    setIsLoading(true);
    try {
      const success = await login(username, password, role);
      if (!success) {
        toast({
          title: "Login Failed",
          description: "Invalid credentials or unauthorized role. Try: admin/admin123, driver1/driver123, or 2JI20CS001/student123",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  switch (user?.role) {
    case "student":
      return (
        <StudentPage
          userName={user.name || user.username}
          onLogout={logout}
        />
      );
    case "driver":
      return (
        <DriverPage
          userName={user.name || user.username}
          driverId={authData?.driverId || user.id}
          assignedBusId={authData?.assignedBusId}
          onLogout={logout}
        />
      );
    case "admin":
      return (
        <AdminPage
          userName={user.name || user.username}
          onLogout={logout}
        />
      );
    default:
      return <NotFound />;
  }
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={AppContent} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <FullscreenButton />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
