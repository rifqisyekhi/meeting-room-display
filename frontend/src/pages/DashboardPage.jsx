import { useEffect, useState } from "react";
import UserDashboardPage from "./UserDashboardPage";

export default function DashboardPage() {
  const [iframeSrc] = useState(() => `/dashboard-app/index.html?v=${Date.now()}`);
  useEffect(() => {
    document.title = "Dashboard - Booking Ruang Rapat";
    try {
      /* Dashboard admin berjalan di dalam iframe dan membaca sessionStorage,
         jadi identitasnya memang perlu dicerminkan ke slot yang ia baca.

         Yang TIDAK boleh dilakukan di sini: menetapkan isAuthenticated.
         Sebelumnya baris ini menulis isAuthenticated = "true" begitu ada
         currentUser tersisa di penyimpanan mana pun, tanpa memeriksa apakah
         orangnya masih login. Akibatnya satu salinan yang lolos dari logout —
         misalnya sessionStorage milik tab lain, yang tidak ikut terhapus saat
         logout dilakukan di tab ini — langsung dipulihkan menjadi sesi yang
         sah, dan pengguna kembali masuk sebagai akun lama. */
      const sudahLogin =
        sessionStorage.getItem("dashboard_isAuthenticated") === "true" ||
        sessionStorage.getItem("isAuthenticated") === "true" ||
        localStorage.getItem("dashboard_isAuthenticated") === "true" ||
        localStorage.getItem("isAuthenticated") === "true";
      const stored =
        sessionStorage.getItem("dashboard_currentUser") ||
        sessionStorage.getItem("currentUser") ||
        localStorage.getItem("dashboard_currentUser") ||
        localStorage.getItem("currentUser");
      if (sudahLogin && stored) {
        sessionStorage.setItem("dashboard_currentUser", stored);
        sessionStorage.setItem("currentUser", stored);
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
        maxHeight: "100dvh",
        margin: 0,
        padding: 0,
        overflow: "hidden",
        backgroundColor: "#f4f7fb",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <iframe
        src={iframeSrc}
        title="Dashboard Booking Ruang Rapat"
        scrolling="yes"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
          WebkitOverflowScrolling: "touch",
        }}
      />
    </div>
  );
}
