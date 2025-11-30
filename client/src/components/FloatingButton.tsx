import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Navigation } from "lucide-react";

type FloatingButtonVariant = "back" | "next" | "location";

interface FloatingButtonProps {
  variant: FloatingButtonVariant;
  onClick: () => void;
  position?: "left" | "right";
  className?: string;
}

export default function FloatingButton({ variant, onClick, position = "right", className }: FloatingButtonProps) {
  const icons = {
    back: ChevronLeft,
    next: ChevronRight,
    location: Navigation,
  };

  const Icon = icons[variant];

  return (
    <button
      onClick={onClick}
      className={cn(
        "fixed bottom-24 w-14 h-14 rounded-full flex items-center justify-center",
        "bg-yellow-400 text-gray-900 shadow-lg",
        "hover:bg-yellow-500 hover:scale-110 transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2",
        position === "left" ? "left-4" : "right-4",
        className
      )}
      style={{ boxShadow: "0 6px 20px rgba(250, 204, 21, 0.6)" }}
      data-testid={`floating-button-${variant}`}
    >
      <Icon className="h-6 w-6" />
    </button>
  );
}
