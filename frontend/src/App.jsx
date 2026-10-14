import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import DisplayPage from "./pages/DisplayPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import BookingPage from "./pages/BookingPage";
import BookingHistoryPage from "./pages/BookingHistoryPage";
import MeetingPassPage from "./pages/MeetingPassPage";
import UserDashboardPage from "./pages/UserDashboardPage";

// eslint-disable-next-line react/prop-types
const ProtectedRoute = ({ children }) => {
  const isBookingAuth =
    sessionStorage.getItem("booking_isAuthenticated") === "true" ||
    localStorage.getItem("booking_isAuthenticated") === "true";
  const isDashboardAuth =
    sessionStorage.getItem("dashboard_isAuthenticated") === "true" ||
    localStorage.getItem("dashboard_isAuthenticated") === "true" ||
    sessionStorage.getItem("isAuthenticated") === "true" ||
    localStorage.getItem("isAuthenticated") === "true";

  const isAuthenticated = isBookingAuth || isDashboardAuth;
  const location = useLocation();

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login?portal=booking"
        state={{ from: location, fromPortal: "booking" }}
        replace
      />
    );
  }

  try {
    if (
      !sessionStorage.getItem("booking_currentUser") &&
      !localStorage.getItem("booking_currentUser")
    ) {
      const fallbackUser =
        sessionStorage.getItem("dashboard_currentUser") ||
        localStorage.getItem("dashboard_currentUser") ||
        sessionStorage.getItem("currentUser") ||
        localStorage.getItem("currentUser");
      if (fallbackUser) {
        sessionStorage.setItem("booking_currentUser", fallbackUser);
        sessionStorage.setItem("booking_isAuthenticated", "true");
      }
    }
  } catch (e) {}

  return children;
};

// eslint-disable-next-line react/prop-types
const DashboardRoute = ({ children }) => {
  const location = useLocation();

  const isDashboardAuth =
    sessionStorage.getItem("dashboard_isAuthenticated") === "true" ||
    localStorage.getItem("dashboard_isAuthenticated") === "true" ||
    sessionStorage.getItem("isAuthenticated") === "true" ||
    localStorage.getItem("isAuthenticated") === "true";

  const isBookingAuth =
    sessionStorage.getItem("booking_isAuthenticated") === "true" ||
    localStorage.getItem("booking_isAuthenticated") === "true";

  let currentUser = null;
  try {
    const stored =
      sessionStorage.getItem("dashboard_currentUser") ||
      localStorage.getItem("dashboard_currentUser") ||
      sessionStorage.getItem("currentUser") ||
      localStorage.getItem("currentUser") ||
      sessionStorage.getItem("booking_currentUser") ||
      localStorage.getItem("booking_currentUser");
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

  // Jika user adalah User biasa dan sudah login (baik via booking atau dashboard),
  // langsung tampilkan Dashboard User (UserDashboardPage) tanpa redirect ke login
  if ((isBookingAuth || isDashboardAuth) && currentUser && !isAdminOrPimpinan) {
    return <UserDashboardPage />;
  }

  // Jika user adalah Admin/Pimpinan yang login via booking dan membuka dashboard,
  // izinkan akses langsung ke Dashboard Admin
  if (isBookingAuth && currentUser && isAdminOrPimpinan) {
    return children;
  }

  // Jika belum login sama sekali
  if (!isDashboardAuth && !isBookingAuth) {
    return (
      <Navigate
        to="/login?portal=dashboard"
        state={{ from: location, fromPortal: "dashboard" }}
        replace
      />
    );
  }

  // Fallback untuk regular user jika belum ter-render
  if (currentUser && !isAdminOrPimpinan) {
    return <UserDashboardPage />;
  }

  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Tampilan Layar TV / Display Ruangan */}
        <Route path="/" element={<DisplayPage />} />
        <Route path="/display" element={<DisplayPage />} />
        <Route path="/tv" element={<DisplayPage />} />
        <Route path="/TV" element={<DisplayPage />} />

        {/* Halaman Khusus Pass Rapat & Presensi QR (Bisa diakses dari HP scan QR tanpa login) */}
        <Route path="/meeting/:id" element={<MeetingPassPage />} />
        <Route path="/m/:id" element={<MeetingPassPage />} />

        {/* Halaman Login */}
        <Route path="/login" element={<LoginPage />} />

        {/* Halaman Booking untuk pengguna yang sudah login */}
        <Route
          path="/booking/history"
          element={
            <ProtectedRoute>
              <BookingHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/booking"
          element={
            <ProtectedRoute>
              <BookingPage />
            </ProtectedRoute>
          }
        />

        {/* Tampilan Dashboard Admin / Pimpinan (Dilindungi ketat) */}
        <Route
          path="/dashboard/*"
          element={
            <DashboardRoute>
              <DashboardPage />
            </DashboardRoute>
          }
        />
        <Route path="/admin/*" element={<Navigate to="/dashboard" replace />} />

        {/* Fallback ke Display jika URL tidak dikenali */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
