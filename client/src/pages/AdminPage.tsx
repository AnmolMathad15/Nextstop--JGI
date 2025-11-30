import { useState } from "react";
import RibbonBar from "@/components/RibbonBar";
import AppHeader from "@/components/AppHeader";
import AdminDashboard from "@/components/AdminDashboard";
import BusMap from "@/components/BusMap";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import backgroundImage from "@assets/jcet logo pic_1764501988672.jpg";

interface AdminPageProps {
  userName: string;
  onLogout: () => void;
}

export default function AdminPage({ userName, onLogout }: AdminPageProps) {
  const [showLiveMap, setShowLiveMap] = useState(false);

  if (showLiveMap) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        <RibbonBar />
        <AppHeader userName={userName} userRole="admin" onLogout={onLogout} />
        <div className="flex-1 relative">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowLiveMap(false)}
            className="absolute top-4 left-4 z-[1001] bg-white/90 shadow-md"
            data-testid="button-back-to-dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <BusMap showAllBuses role="admin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="relative z-10 flex flex-col min-h-screen">
        <RibbonBar />
        <AppHeader userName={userName} userRole="admin" onLogout={onLogout} />
        
        <div className="flex-1 overflow-auto">
          <AdminDashboard onViewLiveMap={() => setShowLiveMap(true)} />
        </div>
      </div>
    </div>
  );
}
