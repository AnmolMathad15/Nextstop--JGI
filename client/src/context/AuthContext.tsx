import { createContext, useContext, useState, useCallback } from "react";

export type UserRole = "student" | "driver" | "admin";

export interface User {
  id: string;
  username: string;
  role: UserRole;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string, role: UserRole) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = useCallback(async (username: string, _password: string, role: UserRole): Promise<boolean> => {
    // todo: remove mock functionality - replace with actual API call
    const mockUsers: Record<UserRole, User> = {
      student: { id: "STU001", username, role: "student", name: "Rahul Kumar" },
      driver: { id: "DRV001", username, role: "driver", name: "Ravi Patil" },
      admin: { id: "ADM001", username, role: "admin", name: "Admin User" },
    };

    await new Promise((resolve) => setTimeout(resolve, 1000));
    setUser(mockUsers[role]);
    return true;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
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
