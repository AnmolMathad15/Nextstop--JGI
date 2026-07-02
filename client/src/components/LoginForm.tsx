import { useState } from "react";
import { Eye, EyeOff, Loader2, GraduationCap, Truck, ShieldCheck, X, KeyRound, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import appLogo from "@assets/logo_1764501998717.jpg";
import type { UserRole } from "@/context/AuthContext";

interface LoginFormProps {
  role: UserRole;
  onLogin: (username: string, password: string) => Promise<void>;
  onSwitchRole?: (role: UserRole) => void;
}

const DEMO_CREDENTIALS: Record<UserRole, { username: string; password: string; label: string }> = {
  student: { username: "2JH23CS001", password: "student123", label: "Student" },
  driver:  { username: "driver1",     password: "driver123",  label: "Driver"  },
  admin:   { username: "admin",        password: "admin123",   label: "Admin"   },
};

const ROLE_ICONS: Record<UserRole, React.ReactNode> = {
  student: <GraduationCap className="h-4 w-4" />,
  driver:  <Truck className="h-4 w-4" />,
  admin:   <ShieldCheck className="h-4 w-4" />,
};

export default function LoginForm({ role, onLogin, onSwitchRole }: LoginFormProps) {
  const [username, setUsername]           = useState("");
  const [password, setPassword]           = useState("");
  const [showPassword, setShowPassword]   = useState(false);
  const [isLoading, setIsLoading]         = useState(false);
  const [error, setError]                 = useState("");
  const [showForgot, setShowForgot]       = useState(false);
  const [forgotUsn, setForgotUsn]         = useState("");
  const [forgotStatus, setForgotStatus]   = useState<"idle" | "sent" | "error">("idle");
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  const getUsernameLabel = () => {
    switch (role) {
      case "student": return "USN / ROLL NUMBER";
      case "driver":  return "DRIVER ID";
      case "admin":   return "ADMIN ID";
    }
  };

  const getUsernamePlaceholder = () => {
    switch (role) {
      case "student": return "e.g. 2JH23CS001";
      case "driver":  return "e.g. driver1";
      case "admin":   return "e.g. admin";
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
      setError("Invalid credentials. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemoCredentials = (r: UserRole) => {
    const creds = DEMO_CREDENTIALS[r];
    setUsername(creds.username);
    setPassword(creds.password);
    if (onSwitchRole) onSwitchRole(r);
    setError("");
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotUsn.trim()) {
      setForgotStatus("error");
      return;
    }
    setForgotStatus("sent");
  };

  const closeForgot = () => {
    setShowForgot(false);
    setForgotUsn("");
    setForgotStatus("idle");
  };

  return (
    <>
      {/* Card */}
      <div
        className="w-full max-w-md mx-auto rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "#ffffff" }}
      >
        {/* Top accent bar */}
        <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #1e3a6e, #f59e0b)" }} />

        <div className="px-8 py-7">
          {/* Logo + title */}
          <div className="flex flex-col items-center mb-7">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg mb-4"
              style={{ background: "linear-gradient(135deg, #1e3a6e 60%, #2563eb)" }}
            >
              <img
                src={appLogo}
                alt="JCET"
                className="w-16 h-16 object-cover rounded-full"
                data-testid="img-login-logo"
              />
            </div>
            <h1 className="nextstop-brand text-4xl" data-testid="text-login-title">
              <span style={{ color: "#1e3a6e" }}>Next</span>
              <span style={{ color: "#f59e0b" }}>Stop</span>
              <span style={{ color: "#1e3a6e" }}> JGI</span>
            </h1>
            <p className="text-sm font-semibold text-gray-700 mt-0.5">Jain College of Engineering and Technology</p>
            <p className="text-xs tracking-widest text-gray-400 uppercase mt-0.5">Smart Campus Portal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Role selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold tracking-widest text-gray-500 uppercase">Login As</Label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-lg border-2 bg-gray-50 text-gray-800 font-medium focus:outline-none transition-colors"
                  style={{ borderColor: "#1e3a6e" }}
                  data-testid="button-role-selector"
                >
                  <span className="flex items-center gap-2">
                    {ROLE_ICONS[role]}
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${showRoleDropdown ? "rotate-180" : ""}`} />
                </button>
                {showRoleDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-white rounded-lg border shadow-lg overflow-hidden">
                    {(["student", "driver", "admin"] as UserRole[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          if (onSwitchRole) onSwitchRole(r);
                          setShowRoleDropdown(false);
                          setError("");
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-blue-50 ${r === role ? "bg-blue-50 text-blue-900" : "text-gray-700"}`}
                        data-testid={`option-role-${r}`}
                      >
                        {ROLE_ICONS[r]}
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Username */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold tracking-widest text-gray-500 uppercase">
                {getUsernameLabel()}
              </Label>
              <Input
                id="username"
                type="text"
                placeholder={getUsernamePlaceholder()}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="border-2 bg-gray-50 focus-visible:ring-0 focus-visible:border-yellow-400 rounded-lg py-2.5"
                style={{ borderColor: username ? "#1e3a6e" : undefined }}
                autoComplete="username"
                data-testid="input-username"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold tracking-widest text-gray-500 uppercase">Password</Label>
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="text-xs font-semibold hover:underline"
                  style={{ color: "#f59e0b" }}
                  data-testid="link-forgot-password"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-2 bg-gray-50 focus-visible:ring-0 focus-visible:border-yellow-400 rounded-lg py-2.5 pr-11"
                  style={{ borderColor: password ? "#1e3a6e" : undefined }}
                  autoComplete="current-password"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500 font-medium" data-testid="text-error">{error}</p>
            )}

            {/* Submit */}
            <Button
              type="submit"
              className="w-full py-3 rounded-lg font-bold text-base tracking-wide text-white shadow-md hover:opacity-90 transition-opacity"
              style={{ background: "#1e3a6e" }}
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...</>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs text-center font-bold tracking-widest text-gray-400 uppercase mb-3">
              Demo Credentials — Click to Fill
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(["student", "driver", "admin"] as UserRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => fillDemoCredentials(r)}
                  className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg border-2 text-xs font-bold uppercase transition-all hover:shadow-md active:scale-95"
                  style={{
                    borderColor: r === role ? "#f59e0b" : "#e5e7eb",
                    background: r === role ? "#fffbeb" : "#f9fafb",
                    color: r === role ? "#92400e" : "#374151",
                  }}
                  data-testid={`button-demo-${r}`}
                >
                  {ROLE_ICONS[r]}
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="px-8 py-3 text-center" style={{ background: "#f8fafc" }}>
          <p className="text-xs text-gray-400">
            {role === "driver"
              ? "Assigned by JGI College Admin — Drivers Only"
              : role === "admin"
              ? "Admin Access Only — Authorized Personnel"
              : "Student Portal — Track Your College Bus"}
          </p>
        </div>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgot} onOpenChange={(open) => { if (!open) closeForgot(); }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold" style={{ color: "#1e3a6e" }}>
              <KeyRound className="h-5 w-5" style={{ color: "#f59e0b" }} />
              Forgot Password
            </DialogTitle>
          </DialogHeader>

          {forgotStatus === "sent" ? (
            <div className="py-4 text-center space-y-3">
              <div
                className="mx-auto w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: "#fffbeb" }}
              >
                <KeyRound className="h-8 w-8" style={{ color: "#f59e0b" }} />
              </div>
              <h3 className="font-bold text-gray-800">Request Received!</h3>
              <p className="text-sm text-gray-500">
                Your password reset request for <span className="font-semibold text-gray-700">{forgotUsn}</span> has been recorded.
                Please contact the JCET transport office or your administrator to reset your password.
              </p>
              <div
                className="rounded-lg p-3 text-xs text-left space-y-1"
                style={{ background: "#f0f9ff", border: "1px solid #bae6fd" }}
              >
                <p className="font-bold text-blue-800">Contact Details</p>
                <p className="text-blue-700">📞 Transport Office: +91-836-XXXXXXX</p>
                <p className="text-blue-700">✉️ transport@jcet.edu.in</p>
              </div>
              <Button
                onClick={closeForgot}
                className="w-full font-bold"
                style={{ background: "#1e3a6e", color: "white" }}
                data-testid="button-forgot-close"
              >
                Back to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleForgotSubmit} className="space-y-4 pt-1">
              <p className="text-sm text-gray-500">
                Enter your USN or ID below and we'll help you recover access to your account.
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold tracking-widest text-gray-500 uppercase">
                  USN / User ID
                </Label>
                <Input
                  type="text"
                  placeholder="e.g. 2JH23CS001 or admin"
                  value={forgotUsn}
                  onChange={(e) => { setForgotUsn(e.target.value); setForgotStatus("idle"); }}
                  className="border-2 focus-visible:ring-0 focus-visible:border-yellow-400"
                  data-testid="input-forgot-usn"
                />
                {forgotStatus === "error" && (
                  <p className="text-xs text-red-500">Please enter your USN or User ID.</p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full font-bold"
                style={{ background: "#1e3a6e", color: "white" }}
                data-testid="button-forgot-submit"
              >
                Send Reset Request
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
