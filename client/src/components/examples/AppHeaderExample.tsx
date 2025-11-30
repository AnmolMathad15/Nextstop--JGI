import AppHeader from "../AppHeader";

export default function AppHeaderExample() {
  return (
    <AppHeader
      userName="Rahul Kumar"
      userRole="student"
      onLogout={() => console.log("Logout clicked")}
    />
  );
}
