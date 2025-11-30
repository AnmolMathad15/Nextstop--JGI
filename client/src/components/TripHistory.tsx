import { Calendar, Clock, MapPin, Navigation } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Trip {
  id: string;
  date: string;
  route: string;
  startTime: string;
  endTime: string;
  stops: number;
  distance: string;
  status: "completed" | "cancelled" | "ongoing";
}

interface TripHistoryProps {
  trips?: Trip[];
}

// todo: remove mock data - replace with API data
const mockTrips: Trip[] = [
  {
    id: "TRP001",
    date: "Nov 30, 2025",
    route: "keshwapur route",
    startTime: "06:45 AM",
    endTime: "07:50 AM",
    stops: 10,
    distance: "12.5 km",
    status: "completed",
  },
  {
    id: "TRP002",
    date: "Nov 29, 2025",
    route: "keshwapur route",
    startTime: "06:50 AM",
    endTime: "07:55 AM",
    stops: 10,
    distance: "12.5 km",
    status: "completed",
  },
  {
    id: "TRP003",
    date: "Nov 28, 2025",
    route: "keshwapur route",
    startTime: "06:48 AM",
    endTime: "-",
    stops: 5,
    distance: "6.2 km",
    status: "cancelled",
  },
  {
    id: "TRP004",
    date: "Nov 27, 2025",
    route: "keshwapur route",
    startTime: "06:45 AM",
    endTime: "07:48 AM",
    stops: 10,
    distance: "12.5 km",
    status: "completed",
  },
];

export default function TripHistory({ trips = mockTrips }: TripHistoryProps) {
  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4 pb-24">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white" data-testid="text-history-title">
            Trip History
          </h2>
          <p className="text-sm text-muted-foreground">Your recent trips</p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Calendar className="h-3 w-3" />
          Last 30 days
        </Badge>
      </div>

      <div className="space-y-3">
        {trips.map((trip) => (
          <Card key={trip.id} className="hover-elevate" data-testid={`card-trip-${trip.id}`}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{trip.route}</p>
                  <p className="text-sm text-muted-foreground">{trip.date}</p>
                </div>
                <Badge
                  variant={
                    trip.status === "completed"
                      ? "default"
                      : trip.status === "cancelled"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {trip.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {trip.startTime} - {trip.endTime}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{trip.stops} stops</span>
                </div>
                <div className="flex items-center gap-2 text-sm col-span-2">
                  <Navigation className="h-4 w-4 text-muted-foreground" />
                  <span>{trip.distance}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
