import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "light" | "dark";
}

export default function GlassCard({ children, className, variant = "light" }: GlassCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl p-6 backdrop-blur-lg",
        variant === "light" 
          ? "bg-white/75 dark:bg-gray-800/75" 
          : "bg-black/50 dark:bg-black/60",
        className
      )}
      data-testid="glass-card"
    >
      {children}
    </div>
  );
}
