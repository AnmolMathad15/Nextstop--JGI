import { Route, Truck, MapPin, Bell } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type NotificationType = "route" | "maintenance" | "location" | "general";

interface NotificationCardProps {
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  isRead?: boolean;
  onClick?: () => void;
}

const icons = {
  route: Route,
  maintenance: Truck,
  location: MapPin,
  general: Bell,
};

const iconColors = {
  route: "bg-primary",
  maintenance: "bg-yellow-500",
  location: "bg-blue-500",
  general: "bg-green-500",
};

export default function NotificationCard({ type, title, message, time, isRead = false, onClick }: NotificationCardProps) {
  const Icon = icons[type];

  return (
    <Card
      className={cn(
        "p-4 hover-elevate cursor-pointer",
        !isRead && "border-l-4 border-l-primary"
      )}
      onClick={onClick}
      data-testid="notification-card"
    >
      <div className="flex gap-4">
        <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0", iconColors[type])}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 dark:text-white" data-testid="text-notification-title">
            {title}
          </p>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2" data-testid="text-notification-message">
            {message}
          </p>
          <p className="text-xs text-muted-foreground mt-2" data-testid="text-notification-time">
            {time}
          </p>
        </div>
      </div>
    </Card>
  );
}
