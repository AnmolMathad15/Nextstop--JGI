import { useState, lazy, Suspense } from "react";
import RibbonBar from "@/components/RibbonBar";
import AppHeader from "@/components/AppHeader";
import AdminDashboard from "@/components/AdminDashboard";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

const BusMap = lazy(() => import("@/components/BusMap"));
import backgroundImage from "@assets/jcet logo pic_1764501988672.jpg";

interface AdminPageProps {
  userName: string;
  onLogout: () => void;
}

export default function AdminPage({ userName, onLogout }: AdminPageProps) {
  const [showLiveMap, setShowLiveMap] = useState(false);

  if (showLiveMap) {
    return (
      <div className="min-h-screen flex flex-col">
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
          <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <BusMap showAllBuses role="admin" />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
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
