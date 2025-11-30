import FloatingButton from "../FloatingButton";

export default function FloatingButtonExample() {
  return (
    <div className="h-[200px] relative bg-gray-200">
      <FloatingButton
        variant="back"
        position="left"
        onClick={() => console.log("Back clicked")}
      />
      <FloatingButton
        variant="location"
        position="right"
        onClick={() => console.log("Location clicked")}
      />
    </div>
  );
}
