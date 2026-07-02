import { Map, Route, Bell, Settings, BarChart3, History } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = "map" | "routes" | "alerts" | "settings" | "reports" | "history";

interface BottomNavigationProps {
  activeItem: NavItem;
  onNavigate: (item: NavItem) => void;
  variant?: "student" | "driver" | "admin";
}

const studentItems: { id: NavItem; label: string; icon: typeof Map }[] = [
  { id: "map", label: "Map", icon: Map },
  { id: "routes", label: "Routes", icon: Route },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "settings", label: "Settings", icon: Settings },
];

const driverItems: { id: NavItem; label: string; icon: typeof Map }[] = [
  { id: "map", label: "Dashboard", icon: Map },
  { id: "routes", label: "Route", icon: Route },
  { id: "alerts", label: "Notifications", icon: Bell },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "history", label: "History", icon: History },
];

export default function BottomNavigation({ activeItem, onNavigate, variant = "student" }: BottomNavigationProps) {
  const items = variant === "driver" ? driverItems : studentItems;

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 shadow-inner z-40"
      data-testid="bottom-navigation"
    >
      <div className="flex justify-around py-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]",
                isActive
                  ? "text-teal-600 dark:text-teal-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              )}
              data-testid={`nav-item-${item.id}`}
            >
              <Icon 
                className={cn("h-5 w-5", isActive && "fill-current")} 
                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
              />
              <span className={cn("text-xs", isActive ? "font-semibold" : "font-medium")}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
