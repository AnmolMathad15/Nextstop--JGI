import { useState } from "react";
import { MapPin, Bus, ChevronRight, ArrowLeft, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { ROUTES_DATA, ROUTE_COLORS } from "@/lib/constants";

interface ApiRoute {
  id: number;
  name: string;
  displayOrder: number;
  isActive: boolean;
  color?: string | null;
}

interface ApiStop {
  id: number;
  routeId: number;
  name: string;
  lat: number;
  lng: number;
  scheduledTime: string;
  time1015am?: string | null;
  sequence: number;
  isMainStop?: boolean | null;
}

interface RouteSelectorProps {
  onSelectRoute: (routeId: number, stopName: string) => void;
}

export default function RouteSelector({ onSelectRoute }: RouteSelectorProps) {
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [step, setStep] = useState<"routes" | "stops">("routes");

  // ── Fetch routes from API; fall back to static constants ─────────────────
  const { data: apiRoutes, isLoading: routesLoading } = useQuery<ApiRoute[]>({
    queryKey: ["/api/routes"],
    staleTime: 60_000,
  });

  // ── Fetch stops for the selected route ───────────────────────────────────
  const { data: routeDetail, isLoading: stopsLoading } = useQuery<ApiRoute & { stops: ApiStop[] }>({
    queryKey: [`/api/routes/${selectedRouteId}`],
    enabled: selectedRouteId !== null,
    staleTime: 60_000,
  });

  // Merge API data with static fallback (keeps colors + stop coordinates)
  const routes: ApiRoute[] = apiRoutes?.length
    ? apiRoutes.filter(r => r.isActive)
    : ROUTES_DATA.map(r => ({ id: r.id, name: r.name, displayOrder: r.id, isActive: true }));

  const stops: ApiStop[] = routeDetail?.stops?.length
    ? routeDetail.stops
    : ROUTES_DATA.find(r => r.id === selectedRouteId)?.stops.map((s, i) => ({
        id: i,
        routeId: selectedRouteId!,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        scheduledTime: s.scheduledTime,
        time1015am: (s as any).time1015am,
        sequence: i + 1,
        isMainStop: (s as any).isMainStop ?? false,
      })) ?? [];

  const selectedRoute = routes.find(r => r.id === selectedRouteId);

  const getRouteColor = (route: ApiRoute) =>
    route.color ?? ROUTE_COLORS[route.name.toLowerCase()] ?? "#3b82f6";

  const handleRouteClick = (id: number) => {
    setSelectedRouteId(id);
    setStep("stops");
  };

  const handleStopClick = (stopName: string) => {
    if (selectedRouteId) onSelectRoute(selectedRouteId, stopName);
  };

  const handleBack = () => {
    setStep("routes");
    setSelectedRouteId(null);
  };

  // ── Stop list view ────────────────────────────────────────────────────────
  if (step === "stops") {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button size="icon" variant="ghost" onClick={handleBack} data-testid="button-back-routes">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white" data-testid="text-route-name">
              {selectedRoute?.name ?? "Route"}
            </h2>
            <p className="text-sm text-muted-foreground">Select your bus stop</p>
          </div>
        </div>

        {stopsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-2">
            {stops.map((stop, index) => (
              <Card
                key={stop.id ?? stop.name}
                className="p-4 hover-elevate cursor-pointer"
                onClick={() => handleStopClick(stop.name)}
                data-testid={`card-stop-${index}`}
              >
                <div className="flex items-center gap-4">
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{
                        backgroundColor:
                          index === stops.length - 1
                            ? "#22c55e"
                            : getRouteColor(selectedRoute!),
                      }}
                    />
                    {index < stops.length - 1 && (
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 dark:text-white truncate" data-testid={`text-stop-name-${index}`}>
                        {stop.name}
                      </p>
                      {stop.isMainStop && (
                        <Badge variant="secondary" className="text-[10px] shrink-0">Major</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {stop.scheduledTime}
                      </span>
                      {stop.time1015am && (
                        <span className="text-xs text-muted-foreground/70">/ {stop.time1015am}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Route list view ───────────────────────────────────────────────────────
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

      {routesLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-3">
          {routes.map((route) => {
            const staticRoute = ROUTES_DATA.find(r => r.id === route.id);
            const stopCount = staticRoute?.stops.length ?? "?";
            const color = getRouteColor(route);
            return (
              <Card
                key={route.id}
                className="p-4 hover-elevate cursor-pointer"
                onClick={() => handleRouteClick(route.id)}
                data-testid={`card-route-${route.id}`}
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full" style={{ backgroundColor: `${color}20` }}>
                    <MapPin className="h-6 w-6" style={{ color }} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white" data-testid={`text-route-${route.id}`}>
                      {route.name}
                    </p>
                    <p className="text-sm text-muted-foreground">{stopCount} stops</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
