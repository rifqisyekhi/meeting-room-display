import { useEffect, useState } from "react";
import UserDashboardPage from "./UserDashboardPage";

export default function DashboardPage() {
  const [iframeSrc] = useState(() => `/dashboard-app/index.html?v=${Date.now()}`);
  useEffect(() => {
    document.title = "Dashboard - Booking Ruang Rapat";
    try {
      const stored =
        sessionStorage.getItem("dashboard_currentUser") ||
        sessionStorage.getItem("currentUser") ||
        localStorage.getItem("dashboard_currentUser") ||
        localStorage.getItem("currentUser");
      if (stored) {
        sessionStorage.setItem("dashboard_currentUser", stored);
        sessionStorage.setItem("dashboard_isAuthenticated", "true");
        sessionStorage.setItem("currentUser", stored);
        sessionStorage.setItem("isAuthenticated", "true");
      }
    } catch (e) {}
  }, []);

  let currentUser = null;
  try {
    const stored =
      sessionStorage.getItem("dashboard_currentUser") ||
      sessionStorage.getItem("currentUser") ||
      localStorage.getItem("dashboard_currentUser") ||
      localStorage.getItem("currentUser");
    if (stored) currentUser = JSON.parse(stored);
  } catch (e) {}

  const role = (currentUser?.role || "").trim().toLowerCase();
  const uname = (currentUser?.username || "").trim().toLowerCase();
  const isRegularUserRole = !role || role === "user" || role === "staff" || role === "pegawai";
  const isAdminOrPimpinan =
    !isRegularUserRole ||
    role.includes("admin") ||
    role.includes("pimpinan") ||
    role.includes("approval") ||
    uname === "admin" ||
    uname.includes("approval") ||
    uname.includes("pimpinan");

  if (currentUser && !isAdminOrPimpinan) {
    return <UserDashboardPage />;
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
        src={iframeSrc}
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
