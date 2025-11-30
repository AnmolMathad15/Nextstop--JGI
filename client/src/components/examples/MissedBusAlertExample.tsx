import MissedBusAlert from "../MissedBusAlert";

export default function MissedBusAlertExample() {
  return (
    <div className="p-4">
      <MissedBusAlert
        routeName="keshwapur route"
        stopName="Shakti Colony"
        departureTime="07:00 AM"
      />
    </div>
  );
}
