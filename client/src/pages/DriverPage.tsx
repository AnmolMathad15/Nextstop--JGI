import { useState } from "react";
import RibbonBar from "@/components/RibbonBar";
import AppHeader from "@/components/AppHeader";
import DriverDashboard from "@/components/DriverDashboard";
import BusMap from "@/components/BusMap";
import BottomNavigation from "@/components/BottomNavigation";
import NotificationCard from "@/components/NotificationCard";
import ReportForm from "@/components/ReportForm";
import TripHistory from "@/components/TripHistory";
import backgroundImage from "@assets/jcet logo pic_1764501988672.jpg";

type NavItem = "map" | "routes" | "alerts" | "reports" | "history";

interface DriverPageProps {
  userName: string;
  driverId: string;
  assignedBusId?: string;
  onLogout: () => void;
}

const mockNotifications = [
  { type: "route" as const, title: "Route Update", message: "Route #58B for tomorrow has been assigned to you.", time: "4:45 PM" },
  { type: "maintenance" as const, title: "Vehicle Maintenance", message: "Scheduled maintenance check tomorrow at 9 AM.", time: "9:15 AM" },
  { type: "general" as const, title: "Safety Reminder", message: "Please ensure all safety protocols are followed.", time: "Yesterday" },
];

export default function DriverPage({ userName, driverId, assignedBusId, onLogout }: DriverPageProps) {
  const [activeNav, setActiveNav] = useState<NavItem>("map");

  const handleReportSubmit = async (data: { reason: string; notes: string; photo?: File }) => {
    console.log("Report submitted:", data);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    alert("Report submitted successfully!");
  };

  const renderContent = () => {
    switch (activeNav) {
      case "map":
        return (
          <div className="flex-1 overflow-auto pb-20">
            <DriverDashboard 
              driverName={userName} 
              driverId={driverId}
              assignedBusId={assignedBusId}
            />
          </div>
        );

      case "routes":
        return (
          <div className="flex-1 relative">
            <BusMap showAllBuses role="admin" />
          </div>
        );

      case "alerts":
        return (
          <div className="flex-1 overflow-auto p-4 pb-20">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Notifications</h2>
            <div className="space-y-3">
              {mockNotifications.map((notification, index) => (
                <NotificationCard
                  key={index}
                  type={notification.type}
                  title={notification.title}
                  message={notification.message}
                  time={notification.time}
                />
              ))}
            </div>
          </div>
        );

      case "reports":
        return (
          <div className="flex-1 overflow-auto pb-20">
            <ReportForm onSubmit={handleReportSubmit} />
          </div>
        );

      case "history":
        return (
          <div className="flex-1 overflow-auto pb-20">
            <TripHistory />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="relative z-10 flex flex-col min-h-screen">
        <RibbonBar />
        <AppHeader 
          userName={userName} 
          userRole="driver" 
          onLogout={onLogout}
        />
        
        {renderContent()}

        <BottomNavigation
          activeItem={activeNav}
          onNavigate={(item) => setActiveNav(item as NavItem)}
          variant="driver"
        />
      </div>
    </div>
  );
}
