import { useState } from "react";
import LoginForm from "../LoginForm";
import type { UserRole } from "@/context/AuthContext";

export default function LoginFormExample() {
  const [role, setRole] = useState<UserRole>("student");

  const handleLogin = async (username: string, password: string) => {
    console.log("Login attempt:", { username, password, role });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    console.log("Login successful!");
  };

  return (
    <div className="p-4">
      <LoginForm
        role={role}
        onLogin={handleLogin}
        onSwitchRole={setRole}
      />
    </div>
  );
}
