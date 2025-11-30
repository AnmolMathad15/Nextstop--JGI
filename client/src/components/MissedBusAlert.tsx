import { AlertTriangle, Clock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface MissedBusAlertProps {
  routeName: string;
  stopName: string;
  departureTime: string;
}

export default function MissedBusAlert({ routeName, stopName, departureTime }: MissedBusAlertProps) {
  return (
    <Alert 
      variant="destructive" 
      className="border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950"
      data-testid="alert-missed-bus"
    >
      <AlertTriangle className="h-5 w-5" />
      <AlertTitle className="font-bold" data-testid="text-alert-title">
        Bus Already Departed
      </AlertTitle>
      <AlertDescription className="mt-2" data-testid="text-alert-description">
        <p>
          The bus on <strong>{routeName}</strong> has already departed from{" "}
          <strong>{stopName}</strong> at <strong>{departureTime}</strong>.
        </p>
        <div className="flex items-center gap-2 mt-3 text-sm">
          <Clock className="h-4 w-4" />
          <span>Please check tomorrow's schedule or contact the transport office.</span>
        </div>
      </AlertDescription>
    </Alert>
  );
}
