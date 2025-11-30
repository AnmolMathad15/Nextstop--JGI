import NotificationCard from "../NotificationCard";

export default function NotificationCardExample() {
  return (
    <div className="p-4 space-y-3 max-w-md">
      <NotificationCard
        type="route"
        title="Route Update"
        message="A new stop has been added to your route."
        time="10:30 AM"
        isRead={false}
        onClick={() => console.log("Notification clicked")}
      />
      <NotificationCard
        type="maintenance"
        title="Vehicle Maintenance"
        message="Scheduled maintenance check tomorrow."
        time="9:15 AM"
        isRead={true}
      />
    </div>
  );
}
