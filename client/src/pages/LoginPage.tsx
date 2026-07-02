import { useState } from "react";
import RibbonBar from "@/components/RibbonBar";
import LoginForm from "@/components/LoginForm";
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
    <div className="min-h-screen flex flex-col">
      {/* Full-screen tinted overlay over the campus background */}
      <div className="login-bg-overlay fixed inset-0 z-0 pointer-events-none" />

      {/* Decorative blurred orbs for depth */}
      <div
        className="fixed z-0 pointer-events-none"
        style={{
          width: 480,
          height: 480,
          borderRadius: "50%",
          top: "-120px",
          left: "-120px",
          background: "radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 70%)",
          filter: "blur(2px)",
        }}
      />
      <div
        className="fixed z-0 pointer-events-none"
        style={{
          width: 360,
          height: 360,
          borderRadius: "50%",
          bottom: "-80px",
          right: "-80px",
          background: "radial-gradient(circle, rgba(245,158,11,0.18) 0%, transparent 70%)",
          filter: "blur(2px)",
        }}
      />

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
          <p className="text-xs text-white/60 drop-shadow">
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
