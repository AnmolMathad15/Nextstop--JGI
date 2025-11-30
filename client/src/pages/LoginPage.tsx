import { useState } from "react";
import RibbonBar from "@/components/RibbonBar";
import LoginForm from "@/components/LoginForm";
import backgroundImage from "@assets/jcet logo pic_1764501988672.jpg";
import type { UserRole } from "@/context/AuthContext";

interface LoginPageProps {
  onLogin: (username: string, password: string, role: UserRole) => Promise<void>;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [role, setRole] = useState<UserRole>("student");

  const handleLogin = async (username: string, password: string) => {
    await onLogin(username, password, role);
  };

  return (
    <div 
      className="min-h-screen flex flex-col"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="relative z-10 flex flex-col min-h-screen">
        <RibbonBar />
        
        <div className="flex-1 flex items-center justify-center p-4">
          <LoginForm
            role={role}
            onLogin={handleLogin}
            onSwitchRole={setRole}
          />
        </div>

        <div className="text-center py-4">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {role === "driver" 
              ? "Assigned by JGI College Admin — Drivers Only"
              : role === "admin"
              ? "Admin Access Only — Authorized Personnel"
              : "Student Portal — Track Your College Bus"}
          </p>
        </div>
      </div>
    </div>
  );
}
