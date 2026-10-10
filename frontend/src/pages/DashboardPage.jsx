import { useEffect } from "react";
import { Navigate } from "react-router-dom";

export default function DashboardPage() {
  useEffect(() => {
    document.title = "Dashboard - Booking Ruang Rapat";
  }, []);

  let currentUser = null;
  try {
    const stored = localStorage.getItem("currentUser");
    if (stored) currentUser = JSON.parse(stored);
  } catch (e) {}

  const role = (currentUser?.role || "").toLowerCase();
  const uname = (currentUser?.username || "").toLowerCase();
  const isAdminOrPimpinan =
    role.includes("admin") ||
    role.includes("pimpinan") ||
    role.includes("approval") ||
    uname === "admin" ||
    uname.includes("approval") ||
    uname.includes("pimpinan");

  if (currentUser && !isAdminOrPimpinan) {
    return <Navigate to="/booking" replace />;
  }

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        margin: 0,
        padding: 0,
        overflow: "hidden",
        backgroundColor: "#f4f7fb",
      }}
    >
      <iframe
        src="/dashboard-app/index.html"
        title="Dashboard Booking Ruang Rapat"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
        }}
      />
    </div>
  );
}
