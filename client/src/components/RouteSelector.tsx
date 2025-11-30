import { useState } from "react";
import { MapPin, Bus, ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ROUTES_DATA } from "@/lib/constants";

interface RouteSelectorProps {
  onSelectRoute: (routeId: number, stopName: string) => void;
}

export default function RouteSelector({ onSelectRoute }: RouteSelectorProps) {
  const [selectedRoute, setSelectedRoute] = useState<number | null>(null);
  const [step, setStep] = useState<"routes" | "stops">("routes");

  const selectedRouteData = ROUTES_DATA.find((r) => r.id === selectedRoute);

  const handleRouteClick = (routeId: number) => {
    setSelectedRoute(routeId);
    setStep("stops");
  };

  const handleStopClick = (stopName: string) => {
    if (selectedRoute) {
      onSelectRoute(selectedRoute, stopName);
    }
  };

  const handleBack = () => {
    setStep("routes");
    setSelectedRoute(null);
  };

  if (step === "stops" && selectedRouteData) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={handleBack}
            data-testid="button-back-routes"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white" data-testid="text-route-name">
              {selectedRouteData.name}
            </h2>
            <p className="text-sm text-muted-foreground">Select your bus stop</p>
          </div>
        </div>

        <div className="space-y-2">
          {selectedRouteData.stops.map((stop, index) => (
            <Card
              key={stop.name}
              className="p-4 hover-elevate cursor-pointer"
              onClick={() => handleStopClick(stop.name)}
              data-testid={`card-stop-${index}`}
            >
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className={`w-4 h-4 rounded-full ${index === selectedRouteData.stops.length - 1 ? "bg-green-500" : "bg-primary"}`} />
                  {index < selectedRouteData.stops.length - 1 && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-gray-300" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white" data-testid={`text-stop-name-${index}`}>
                    {stop.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Scheduled: {stop.scheduledTime}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="mb-6 text-center">
        <Bus className="h-12 w-12 text-primary mx-auto mb-3" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-select-route">
          Select Your Route
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose your bus route to view live tracking
        </p>
      </div>

      <div className="grid gap-3">
        {ROUTES_DATA.map((route) => (
          <Card
            key={route.id}
            className="p-4 hover-elevate cursor-pointer"
            onClick={() => handleRouteClick(route.id)}
            data-testid={`card-route-${route.id}`}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 dark:text-white" data-testid={`text-route-${route.id}`}>
                  {route.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {route.stops.length} stops
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
