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
  const isAuthenticated =
    sessionStorage.getItem("booking_isAuthenticated") === "true" ||
    localStorage.getItem("booking_isAuthenticated") === "true";
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
  return children;
};

// eslint-disable-next-line react/prop-types
const DashboardRoute = ({ children }) => {
  const isAuthenticated =
    sessionStorage.getItem("dashboard_isAuthenticated") === "true" ||
    localStorage.getItem("dashboard_isAuthenticated") === "true" ||
    sessionStorage.getItem("isAuthenticated") === "true" ||
    localStorage.getItem("isAuthenticated") === "true";
  const location = useLocation();
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login?portal=dashboard"
        state={{ from: location, fromPortal: "dashboard" }}
        replace
      />
    );
  }

  let currentUser = null;
  try {
    const stored =
      sessionStorage.getItem("dashboard_currentUser") ||
      sessionStorage.getItem("currentUser") ||
      localStorage.getItem("dashboard_currentUser") ||
      localStorage.getItem("currentUser");
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
