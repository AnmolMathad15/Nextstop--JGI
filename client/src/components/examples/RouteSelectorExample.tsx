import RouteSelector from "../RouteSelector";

export default function RouteSelectorExample() {
  return (
    <RouteSelector
      onSelectRoute={(routeId, stopName) => {
        console.log("Selected route:", routeId, "stop:", stopName);
      }}
    />
  );
}
