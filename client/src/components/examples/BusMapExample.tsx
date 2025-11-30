import BusMap from "../BusMap";

export default function BusMapExample() {
  return (
    <div className="h-[500px] w-full">
      <BusMap routeId={1} selectedStop="keshwapur circle" />
    </div>
  );
}
