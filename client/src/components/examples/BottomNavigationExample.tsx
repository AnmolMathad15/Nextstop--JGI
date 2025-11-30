import { useState } from "react";
import BottomNavigation from "../BottomNavigation";

export default function BottomNavigationExample() {
  const [activeItem, setActiveItem] = useState<"map" | "routes" | "alerts" | "settings" | "reports" | "history">("map");

  return (
    <div className="h-[120px] relative bg-gray-100">
      <BottomNavigation
        activeItem={activeItem}
        onNavigate={(item) => {
          setActiveItem(item);
          console.log("Navigate to:", item);
        }}
        variant="student"
      />
    </div>
  );
}
