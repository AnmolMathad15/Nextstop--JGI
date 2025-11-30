import OTPInput from "../OTPInput";
import backgroundImage from "@assets/jcet logo pic_1764501988672.jpg";

export default function OTPInputExample() {
  const handleVerify = async (otp: string) => {
    console.log("Verifying OTP:", otp);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    console.log("OTP verified!");
  };

  return (
    <div 
      className="min-h-[400px] flex items-center justify-center p-4"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-black/55" />
      <div className="relative z-10">
        <OTPInput
          onVerify={handleVerify}
          onResend={() => console.log("Resend OTP")}
          phone="+91 ****5678"
        />
      </div>
    </div>
  );
}
