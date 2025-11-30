import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import GlassCard from "./GlassCard";
import appLogo from "@assets/logo_1764501998717.jpg";

interface OTPInputProps {
  length?: number;
  onVerify: (otp: string) => Promise<void>;
  onResend?: () => void;
  phone?: string;
}

export default function OTPInput({ length = 6, onVerify, onResend, phone }: OTPInputProps) {
  const [otp, setOtp] = useState<string[]>(Array(length).fill(""));
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otpString = otp.join("");
    if (otpString.length !== length) return;
    
    setIsLoading(true);
    try {
      await onVerify(otpString);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = () => {
    if (countdown === 0 && onResend) {
      onResend();
      setCountdown(30);
      setOtp(Array(length).fill(""));
    }
  };

  return (
    <GlassCard variant="dark" className="w-full max-w-sm mx-auto text-white">
      <div className="flex flex-col items-center mb-6">
        <div className="p-3 bg-yellow-400 rounded-full shadow-lg animate-float mb-4">
          <img
            src={appLogo}
            alt="Nextstop JGI"
            className="w-14 h-14 object-cover rounded-full"
            data-testid="img-otp-logo"
          />
        </div>
        <h2 className="text-2xl font-extrabold tracking-wide" data-testid="text-otp-title">
          Verify OTP
        </h2>
        <p className="text-sm text-gray-300 mt-2 text-center" data-testid="text-otp-description">
          Enter the 6-digit code sent to {phone || "your mobile"}.
        </p>
      </div>

      <div className="flex justify-center gap-2 mb-6">
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={(el) => { inputRefs.current[index] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            className="h-14 w-11 text-center text-2xl font-bold bg-white text-gray-900 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:outline-none animate-fade-up"
            style={{ animationDelay: `${index * 0.1}s` }}
            data-testid={`input-otp-${index}`}
          />
        ))}
      </div>

      <p className="text-center text-gray-300 text-sm mb-6" data-testid="text-resend">
        Didn't receive the code?{" "}
        <button
          onClick={handleResend}
          disabled={countdown > 0}
          className={`font-semibold ${countdown > 0 ? "text-gray-500" : "text-yellow-400 hover:underline"}`}
          data-testid="button-resend"
        >
          Resend OTP
        </button>
        {countdown > 0 && <span className="ml-1">({countdown}s)</span>}
      </p>

      <div className="space-y-3">
        <Button
          onClick={handleVerify}
          disabled={otp.some((d) => !d) || isLoading}
          className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold py-3"
          data-testid="button-verify-otp"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify OTP"
          )}
        </Button>

        <Button
          variant="outline"
          className="w-full border-2 border-gray-200 bg-white/10 text-white hover:bg-white/20 font-bold py-3"
          data-testid="button-password-login"
        >
          Login with Password
        </Button>
      </div>
    </GlassCard>
  );
}
