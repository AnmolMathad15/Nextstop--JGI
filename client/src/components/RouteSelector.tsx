import { useState, useEffect } from "react";
import { MapPin, Bus, ChevronRight, ArrowLeft, Clock, Navigation2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES_DATA } from "@/lib/constants";

interface RouteSelectorProps {
  onSelectRoute: (routeId: number, stopName: string) => void;
}

type LiveStatus = "on-route" | "delayed" | "not-started";

const ROUTE_COLORS: { bg: string; icon: string; light: string; dot: string }[] = [
  { bg: "#0d9488", icon: "#ffffff", light: "rgba(13,148,136,0.12)", dot: "#0d9488" },
  { bg: "#2563eb", icon: "#ffffff", light: "rgba(37,99,235,0.12)",  dot: "#2563eb" },
  { bg: "#7c3aed", icon: "#ffffff", light: "rgba(124,58,237,0.12)", dot: "#7c3aed" },
  { bg: "#ea580c", icon: "#ffffff", light: "rgba(234,88,12,0.12)",  dot: "#ea580c" },
  { bg: "#db2777", icon: "#ffffff", light: "rgba(219,39,119,0.12)", dot: "#db2777" },
  { bg: "#d97706", icon: "#ffffff", light: "rgba(217,119,6,0.12)",  dot: "#d97706" },
];

const ROUTE_STATUSES: LiveStatus[] = [
  "on-route", "on-route", "delayed", "not-started", "on-route", "delayed",
];

const ROUTE_ETAS = ["Next bus in 4 min", "Next bus in 11 min", "Delayed ~8 min", "Starts at 07:00", "Next bus in 2 min", "Delayed ~5 min"];

function StatusBadge({ status }: { status: LiveStatus }) {
  if (status === "on-route") return (
    <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#059669" }}>
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      On Route
    </span>
  );
  if (status === "delayed") return (
    <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#d97706" }}>
      <span className="inline-flex rounded-full h-2 w-2 bg-amber-400" />
      Delayed
    </span>
  );
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-400">
      <span className="inline-flex rounded-full h-2 w-2 bg-gray-300" />
      Not Started
    </span>
  );
}

function RouteCardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm flex items-center gap-4">
      <Skeleton className="h-12 w-12 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-4 w-4 rounded" />
    </div>
  );
}

export default function RouteSelector({ onSelectRoute }: RouteSelectorProps) {
  const [selectedRoute, setSelectedRoute] = useState<number | null>(null);
  const [step, setStep] = useState<"routes" | "stops">("routes");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(t);
  }, []);

  const selectedRouteData = ROUTES_DATA.find((r) => r.id === selectedRoute);
  const colorIndex = selectedRoute != null ? (selectedRoute - 1) % ROUTE_COLORS.length : 0;
  const selectedColor = ROUTE_COLORS[colorIndex];

  const handleRouteClick = (routeId: number) => {
    setSelectedRoute(routeId);
    setStep("stops");
  };

  const handleStopClick = (stopName: string) => {
    if (selectedRoute) onSelectRoute(selectedRoute, stopName);
  };

  const handleBack = () => {
    setStep("routes");
    setSelectedRoute(null);
  };

  if (step === "stops" && selectedRouteData) {
    const status = ROUTE_STATUSES[(selectedRouteData.id - 1) % ROUTE_STATUSES.length];
    return (
      <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #f0fdf9 0%, #eff6ff 100%)" }}>
        {/* Stops header */}
        <div
          className="sticky top-0 z-10 px-4 pt-4 pb-5"
          style={{ background: "linear-gradient(135deg, #0d9488, #2563eb)" }}
          data-testid="stops-header"
        >
          <div className="flex items-center gap-3">
            <Button
              size="icon"
              variant="ghost"
              onClick={handleBack}
              className="bg-white/20 hover:bg-white/30 text-white rounded-xl h-9 w-9"
              data-testid="button-back-routes"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white truncate" data-testid="text-route-name">
                {selectedRouteData.name}
              </h2>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-white/80">{selectedRouteData.stops.length} stops</span>
                <StatusBadge status={status} />
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-4 pb-24 max-w-2xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3 px-1">Select your boarding stop</p>

          {status === "not-started" && (
            <div className="flex items-start gap-3 rounded-xl p-3 mb-4 text-sm"
              style={{ background: "#fefce8", border: "1px solid #fde68a" }}>
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "#d97706" }} />
              <span style={{ color: "#92400e" }}>This route hasn't started yet. Check back closer to departure time.</span>
            </div>
          )}

          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-[27px] top-6 bottom-6 w-0.5 bg-gray-200 z-0" />

            <div className="space-y-2 relative z-10">
              {selectedRouteData.stops.map((stop, index) => {
                const isFirst = index === 0;
                const isLast = index === selectedRouteData.stops.length - 1;
                return (
                  <button
                    key={stop.name}
                    onClick={() => handleStopClick(stop.name)}
                    className="w-full flex items-center gap-4 bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100 hover:shadow-md hover:border-teal-200 transition-all text-left group"
                    data-testid={`card-stop-${index}`}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm"
                      style={{
                        background: isLast ? "#0d9488" : isFirst ? "#2563eb" : "#ffffff",
                        border: isLast || isFirst ? "none" : "2px solid #d1d5db",
                      }}
                    >
                      {(isFirst || isLast) && (
                        <div className="w-2.5 h-2.5 rounded-full bg-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 capitalize truncate group-hover:text-teal-700 transition-colors"
                        data-testid={`text-stop-name-${index}`}>
                        {stop.name}
                      </p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        Scheduled: {stop.scheduledTime}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-teal-500 flex-shrink-0 transition-colors" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #f0fdf9 0%, #eff6ff 100%)" }}>
      {/* Section header */}
      <div
        className="px-4 pt-5 pb-6"
        style={{ background: "linear-gradient(135deg, #0d9488, #2563eb)" }}
        data-testid="routes-header"
      >
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <div className="p-2.5 bg-white/20 rounded-xl">
            <Bus className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white" data-testid="text-select-route">
              Select Your Route
            </h2>
            <p className="text-sm text-white/75 mt-0.5">
              {ROUTES_DATA.length} routes · Tap to view stops & live status
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 pb-24 max-w-2xl mx-auto w-full">
        {isLoading ? (
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, i) => <RouteCardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid gap-3">
            {ROUTES_DATA.map((route, idx) => {
              const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
              const status = ROUTE_STATUSES[idx % ROUTE_STATUSES.length];
              const eta = ROUTE_ETAS[idx % ROUTE_ETAS.length];

              return (
                <button
                  key={route.id}
                  onClick={() => handleRouteClick(route.id)}
                  className="w-full flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:scale-[1.01] transition-all text-left group"
                  data-testid={`card-route-${route.id}`}
                >
                  {/* Colored icon */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                    style={{ background: color.bg }}
                  >
                    <MapPin className="h-6 w-6" style={{ color: color.icon }} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-bold capitalize truncate"
                      style={{ color: "#1e293b" }}
                      data-testid={`text-route-${route.id}`}
                    >
                      {route.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Navigation2 className="h-3 w-3" />
                        {route.stops.length} stops
                      </span>
                      <StatusBadge status={status} />
                    </div>
                    <p className="text-xs mt-1 flex items-center gap-1" style={{ color: color.bg }}>
                      <Clock className="h-3 w-3" />
                      {eta}
                    </p>
                  </div>

                  <ChevronRight className="h-5 w-5 flex-shrink-0 text-gray-300 group-hover:text-teal-500 transition-colors" />
                </button>
              );
            })}
          </div>
        )}

        {/* Empty state — shown when a route has no live data */}
        {!isLoading && ROUTES_DATA.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ background: "rgba(13,148,136,0.1)" }}>
              <Bus className="h-8 w-8" style={{ color: "#0d9488" }} />
            </div>
            <p className="font-semibold text-gray-600">No live bus data right now</p>
            <p className="text-sm text-gray-400 mt-1">Check back closer to departure time</p>
          </div>
        )}
      </div>
    </div>
  );
}
