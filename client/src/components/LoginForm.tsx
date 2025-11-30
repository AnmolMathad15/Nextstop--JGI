import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import GlassCard from "./GlassCard";
import appLogo from "@assets/logo_1764501998717.jpg";
import type { UserRole } from "@/context/AuthContext";

interface LoginFormProps {
  role: UserRole;
  onLogin: (username: string, password: string) => Promise<void>;
  onSwitchRole?: (role: UserRole) => void;
}

export default function LoginForm({ role, onLogin, onSwitchRole }: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const getPlaceholder = () => {
    switch (role) {
      case "student": return "Enter your USN";
      case "driver": return "Enter Driver ID";
      case "admin": return "Enter Admin ID";
    }
  };

  const getRoleTitle = () => {
    switch (role) {
      case "student": return "Student Login";
      case "driver": return "Driver Login";
      case "admin": return "Admin Login";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please fill in all fields");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      await onLogin(username, password);
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <GlassCard className="w-full max-w-sm mx-auto">
      <div className="flex flex-col items-center mb-6">
        <div className="p-3 bg-yellow-400 rounded-full shadow-lg animate-pulse-glow mb-4">
          <img
            src={appLogo}
            alt="Nextstop JGI"
            className="w-16 h-16 object-cover rounded-full"
            data-testid="img-login-logo"
          />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white" data-testid="text-login-title">
          Welcome to Nextstop JGI
        </h2>
        <p className="text-sm text-muted-foreground mt-1" data-testid="text-login-subtitle">
          {getRoleTitle()}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">
            {role === "student" ? "USN" : role === "driver" ? "Driver ID" : "Admin ID"}
          </Label>
          <Input
            id="username"
            type="text"
            placeholder={getPlaceholder()}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="border-b-2 border-gray-200 focus:border-yellow-400"
            data-testid="input-username"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10 border-b-2 border-gray-200 focus:border-yellow-400"
              data-testid="input-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              data-testid="button-toggle-password"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500" data-testid="text-error">{error}</p>
        )}

        <div className="text-right">
          <a href="#" className="text-sm font-medium text-yellow-600 hover:text-yellow-500" data-testid="link-forgot-password">
            Forgot Password?
          </a>
        </div>

        <Button
          type="submit"
          className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold py-3"
          disabled={isLoading}
          data-testid="button-login"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Logging in...
            </>
          ) : (
            "Login"
          )}
        </Button>
      </form>

      {onSwitchRole && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-center text-muted-foreground mb-3">Switch login type:</p>
          <div className="flex gap-2 justify-center">
            {(["student", "driver", "admin"] as UserRole[]).map((r) => (
              <Button
                key={r}
                variant={r === role ? "default" : "outline"}
                size="sm"
                onClick={() => onSwitchRole(r)}
                className={r === role ? "bg-primary" : ""}
                data-testid={`button-switch-${r}`}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  );
}
