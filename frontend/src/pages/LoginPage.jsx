import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./LoginPage.css";
import logoKemnaker from "../assets/Logo Kemenaker White.png";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const queryPortal = queryParams.get("portal");
  const isLogoutParam = queryParams.get("logout") === "true";
  const statePortal = location.state?.fromPortal;
  const returnTo = location.state?.from?.pathname || "";
  const isBookingLogin =
    queryPortal === "booking" ||
    statePortal === "booking" ||
    returnTo.startsWith("/booking");

  // Jika sudah login dan tidak dalam mode tambah akun atau logout, langsung arahkan ke tujuan atau role yang sesuai
  useEffect(() => {
    if (isLogoutParam) {
      const keys = [
        "booking_isAuthenticated",
        "booking_currentUser",
        "booking_isAddingAccount",
        "dashboard_isAuthenticated",
        "dashboard_currentUser",
        "dashboard_savedAccounts",
        "isAuthenticated",
        "currentUser",
        "isAddingAccount",
      ];
      keys.forEach((k) => {
        sessionStorage.removeItem(k);
        localStorage.removeItem(k);
      });
      return;
    }

    const isAdding =
      sessionStorage.getItem("booking_isAddingAccount") === "true" ||
      sessionStorage.getItem("isAddingAccount") === "true";
    if (isAdding) return;

    let activeUser = null;
    try {
      const stored =
        sessionStorage.getItem("dashboard_currentUser") ||
        sessionStorage.getItem("currentUser") ||
        sessionStorage.getItem("booking_currentUser") ||
        localStorage.getItem("dashboard_currentUser") ||
        localStorage.getItem("currentUser") ||
        localStorage.getItem("booking_currentUser");
      if (stored) activeUser = JSON.parse(stored);
    } catch (e) {}

    const isAuth =
      sessionStorage.getItem("dashboard_isAuthenticated") === "true" ||
      localStorage.getItem("dashboard_isAuthenticated") === "true" ||
      sessionStorage.getItem("booking_isAuthenticated") === "true" ||
      localStorage.getItem("booking_isAuthenticated") === "true" ||
      sessionStorage.getItem("isAuthenticated") === "true" ||
      localStorage.getItem("isAuthenticated") === "true";

    if (isAuth && activeUser) {
      const role = (activeUser.role || "").toLowerCase();
      const uname = (activeUser.username || "").toLowerCase();
      const isAdminOrPimpinan =
        role.includes("admin") ||
        role.includes("pimpinan") ||
        role.includes("approval") ||
        uname === "admin" ||
        uname.includes("approval") ||
        uname.includes("pimpinan");

      if (isAdminOrPimpinan) {
        navigate("/dashboard", { replace: true });
      } else {
        const dest =
          returnTo && returnTo !== "/login" && returnTo !== "/booking"
            ? returnTo
            : "/dashboard";
        navigate(dest, { replace: true });
      }
    }
  }, [navigate, returnTo, isBookingLogin, isLogoutParam]);

  // Sinkronkan seluruh data akun dari backend database saat halaman login dibuka
  useEffect(() => {
    const syncUsersFromBackend = async () => {
      try {
        const res = await fetch("/api/dashboard/users");
        if (res.ok) {
          const remoteUsers = await res.json();
          if (Array.isArray(remoteUsers)) {
            let localLogin = [];
            try {
              localLogin = JSON.parse(
                localStorage.getItem("app_login_users") || "[]",
              );
            } catch (e) {}

            const localByUsername = new Map();
            localLogin.forEach((u) => {
              if (u && u.username) {
                localByUsername.set(u.username.toLowerCase(), u);
              }
            });
            const merged = remoteUsers
              .filter((user) => user?.username)
              .map((user) => ({
                ...localByUsername.get(user.username.toLowerCase()),
                ...user,
              }));
            localStorage.setItem("app_login_users", JSON.stringify(merged));
            localStorage.setItem("app_users", JSON.stringify(merged));
          }
        }
      } catch (err) {
        console.warn("Sinkronisasi akun login dari backend:", err.message);
      }
    };

    syncUsersFromBackend();
  }, []);

  const getLoginAccounts = () => {
    let stored = [];
    try {
      stored = JSON.parse(localStorage.getItem("app_login_users") || "[]");
    } catch (e) {
      stored = [];
    }
    return stored.filter((user) => user?.username);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      alert("Harap masukkan username dan password!");
      return;
    }

    setIsLoading(true);
    let authenticatedUser = null;

    // 1. Prioritaskan otentikasi langsung ke server database backend
    try {
      const res = await fetch("/api/dashboard/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmedUsername, password }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        authenticatedUser = data.user;
      } else if (res.status === 401 || (data && data.message)) {
        setIsLoading(false);
        alert(data.message || "Username atau password salah!");
        return;
      }
    } catch (err) {
      console.warn("Backend login offline, mencoba cache lokal:", err.message);
    }

    // 2. Fallback ke database cache lokal jika koneksi ke backend gagal
    if (!authenticatedUser) {
      const accounts = getLoginAccounts();
      const localMatch = accounts.find(
        (u) =>
          (u.username || "").toLowerCase() === trimmedUsername.toLowerCase() &&
          u.password === password,
      );
      if (localMatch) {
        if (localMatch.status === "Nonaktif") {
          setIsLoading(false);
          alert("Akun ini sedang dinonaktifkan. Silakan hubungi Admin Utama.");
          return;
        }
        authenticatedUser = {
          username: localMatch.username,
          name: localMatch.name,
          role: localMatch.role,
          email: localMatch.email || "",
          dept: localMatch.dept || "",
          status: localMatch.status || "Aktif",
        };
      }
    }

    setIsLoading(false);

    if (authenticatedUser) {
      const userData = {
        username: authenticatedUser.username,
        name: authenticatedUser.name,
        role: authenticatedUser.role,
        email: authenticatedUser.email || "",
        dept: authenticatedUser.dept || "",
      };

      const userRole = (userData.role || "").toLowerCase();
      const uname = (userData.username || "").toLowerCase();
      const isAdminOrPimpinan =
        userRole.includes("admin") ||
        userRole.includes("pimpinan") ||
        userRole.includes("approval") ||
        uname === "admin" ||
        uname.includes("approval") ||
        uname.includes("pimpinan");

      if (isAdminOrPimpinan) {
        // ----------------------------------------------------
        // SESI LOGIN KHUSUS ADMIN & PIMPINAN (APPROVAL)
        // ----------------------------------------------------
        sessionStorage.setItem("dashboard_isAuthenticated", "true");
        sessionStorage.setItem("dashboard_currentUser", JSON.stringify(userData));
        localStorage.setItem("dashboard_isAuthenticated", "true");
        localStorage.setItem("dashboard_currentUser", JSON.stringify(userData));

        // Sinkronisasi untuk dashboard app internal iframe
        sessionStorage.setItem("isAuthenticated", "true");
        sessionStorage.setItem("currentUser", JSON.stringify(userData));
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("currentUser", JSON.stringify(userData));

        // Sinkronkan juga sesi booking agar bila membuka portal booking, akun yang aktif tetap Admin/Pimpinan
        sessionStorage.setItem("booking_isAuthenticated", "true");
        sessionStorage.setItem("booking_currentUser", JSON.stringify(userData));
        localStorage.setItem("booking_isAuthenticated", "true");
        localStorage.setItem("booking_currentUser", JSON.stringify(userData));

        sessionStorage.removeItem("isAddingAccount");
        sessionStorage.removeItem("booking_isAddingAccount");

        let saved = [];
        try {
          saved = JSON.parse(
            localStorage.getItem("savedAccounts") ||
              sessionStorage.getItem("savedAccounts") ||
              "[]",
          );
        } catch (e) {
          saved = [];
        }

        saved = saved
          .filter(
            (u) =>
              (u.name || "").toLowerCase() !== "andi pratama" &&
              (u.username || "").toLowerCase() !== "andipratama",
          )
          .map((u) => {
            let r = u.role || "User";
            if (r === "Administrator") r = "Admin";
            if (r.startsWith("Approval")) r = "Pimpinan";
            return { ...u, role: r };
          });

        const existingIdx = saved.findIndex(
          (u) =>
            (u.username || "").toLowerCase() === userData.username.toLowerCase(),
        );
        if (existingIdx >= 0) {
          saved[existingIdx] = userData;
        } else {
          saved.push(userData);
        }
        localStorage.setItem("savedAccounts", JSON.stringify(saved));
        sessionStorage.setItem("savedAccounts", JSON.stringify(saved));

        // Admin dan Approval/Pimpinan SELALU langsung ke Dashboard masing-masing!
        navigate("/dashboard", { replace: true });
      } else {
        // ----------------------------------------------------
        // SESI LOGIN KHUSUS USER BIASA (PENGGUNA / PEMOHON)
        // ----------------------------------------------------
        sessionStorage.setItem("booking_isAuthenticated", "true");
        sessionStorage.setItem("booking_currentUser", JSON.stringify(userData));
        localStorage.setItem("booking_isAuthenticated", "true");
        localStorage.setItem("booking_currentUser", JSON.stringify(userData));

        sessionStorage.setItem("dashboard_isAuthenticated", "true");
        sessionStorage.setItem("dashboard_currentUser", JSON.stringify(userData));
        localStorage.setItem("dashboard_isAuthenticated", "true");
        localStorage.setItem("dashboard_currentUser", JSON.stringify(userData));

        sessionStorage.setItem("isAuthenticated", "true");
        sessionStorage.setItem("currentUser", JSON.stringify(userData));
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("currentUser", JSON.stringify(userData));

        sessionStorage.removeItem("booking_isAddingAccount");
        sessionStorage.removeItem("isAddingAccount");

        let bookingSaved = [];
        try {
          bookingSaved = JSON.parse(
            localStorage.getItem("booking_savedAccounts") ||
              sessionStorage.getItem("booking_savedAccounts") ||
              "[]",
          );
        } catch (e) {
          bookingSaved = [];
        }

        const existingIdx = bookingSaved.findIndex(
          (u) =>
            (u.username || "").toLowerCase() === userData.username.toLowerCase(),
        );
        if (existingIdx >= 0) {
          bookingSaved[existingIdx] = userData;
        } else {
          bookingSaved.push(userData);
        }
        localStorage.setItem("booking_savedAccounts", JSON.stringify(bookingSaved));
        sessionStorage.setItem("booking_savedAccounts", JSON.stringify(bookingSaved));

        const destination =
          returnTo && returnTo !== "/login" && returnTo !== "/booking"
            ? returnTo
            : "/dashboard";
        navigate(destination, { replace: true });
      }
    } else {
      alert("Username atau password salah!");
    }
  };

  return (
    <div className="login-layout">
      {/* Left Branding Panel */}
      <div className="login-left-panel">
        {/* Large Decorative Watermark Emblem in bottom corner */}
        <img
          src={logoKemnaker}
          alt=""
          className="login-watermark-emblem"
          aria-hidden="true"
        />

        {/* Faint Decorative Background Text */}
        <div className="login-watermark-text" aria-hidden="true">
          Ruang Rapat
        </div>

        {/* Main Brand Content */}
        <div className="login-brand-content">
          <div className="login-brand-header">
            <img
              src={logoKemnaker}
              alt="Logo Kemnaker"
              className="login-brand-logo"
            />
            <div className="login-brand-title">
              <span>MEETING DISPLAY</span>
              <span>ROOM</span>
            </div>
          </div>

          <div className="login-brand-divider"></div>

          <p className="login-brand-sub">Biro Keuangan dan BMN</p>
        </div>
      </div>

      {/* Right Login Form Panel */}
      <div className="login-right-panel">
        <div className="login-card">
          <h2 className="login-title">
            {isBookingLogin ? "Login Booking" : "Login Dashboard"}
          </h2>
          <p className="login-subtitle">
            {isBookingLogin
              ? "Masuk untuk memesan Ruang Rapat"
              : "Masuk untuk kelola Ruang Rapat"}
          </p>

          <form onSubmit={handleLogin} className="login-form">
            <div className="login-form-group">
              <label htmlFor="username">Username</label>
              <div className="login-input-wrapper">
                <svg
                  className="login-input-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <input
                  id="username"
                  type="text"
                  placeholder="Masukkan username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="login-form-group">
              <label htmlFor="password">Password</label>
              <div className="login-input-wrapper">
                <svg
                  className="login-input-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="login-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="login-submit-btn">
              Masuk
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
