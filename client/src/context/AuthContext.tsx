import { createContext, useContext, useState, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";

export type UserRole = "student" | "driver" | "admin";

export interface User {
  id: string;
  username: string;
  role: UserRole;
  name?: string;
}

export interface AuthData {
  user: User;
  driverId?: string;
  assignedBusId?: string;
  studentId?: string;
  preferredRouteId?: number;
  preferredStop?: string;
}

interface AuthContextType {
  user: User | null;
  authData: AuthData | null;
  isAuthenticated: boolean;
  login: (username: string, password: string, role: UserRole) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authData, setAuthData] = useState<AuthData | null>(null);

  const login = useCallback(async (username: string, password: string, role: UserRole): Promise<boolean> => {
    try {
      const response = await apiRequest("POST", "/api/auth/login", { username, password, role });
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setAuthData(data);
      return true;
    } catch (error) {
      console.error("Login failed:", error);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    setAuthData(null);
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user: authData?.user || null, 
      authData,
      isAuthenticated: !!authData, 
      login, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
