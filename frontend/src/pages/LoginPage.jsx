import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./LoginPage.css";
import logoKemnaker from "../assets/Logo Kemenaker White.png";

const dummyDB = [
  {
    username: import.meta.env.VITE_ADMIN_USERNAME || "admin",
    password: import.meta.env.VITE_ADMIN_PASSWORD || "",
    role: "Administrator",
    name: "Admin Utama",
  },
  {
    username: import.meta.env.VITE_APPROVAL1_USERNAME || "approval1",
    password: import.meta.env.VITE_APPROVAL1_PASSWORD || "",
    role: "Approval",
    name: "Pimpinan",
  },
  {
    username: import.meta.env.VITE_APPROVAL2_USERNAME || "approval2",
    password: import.meta.env.VITE_APPROVAL2_PASSWORD || "",
    role: "Approval",
    name: "Wakil Pimpinan",
  },
  {
    username: import.meta.env.VITE_USER_USERNAME || "andipratama",
    password: import.meta.env.VITE_USER_PASSWORD || "",
    role: "User",
    name: "Andi Pratama",
    email: "andi@kemnaker.go.id",
    dept: "Biro Keuangan",
    status: "Aktif",
  },
];

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.from?.pathname || "/dashboard";
  const isBookingLogin = returnTo.startsWith("/booking");

  // Sinkronkan seluruh data akun dari backend database saat halaman login dibuka
  useEffect(() => {
    const syncUsersFromBackend = async () => {
      try {
        const res = await fetch("/api/dashboard/users");
        if (res.ok) {
          const remoteUsers = await res.json();
          if (Array.isArray(remoteUsers) && remoteUsers.length > 0) {
            let localLogin = [];
            try {
              localLogin = JSON.parse(
                localStorage.getItem("app_login_users") || "[]",
              );
            } catch (e) {}

            const map = new Map();
            dummyDB.forEach((u) => map.set(u.username.toLowerCase(), u));
            localLogin.forEach((u) => {
              if (u && u.username) {
                map.set(u.username.toLowerCase(), {
                  ...map.get(u.username.toLowerCase()),
                  ...u,
                });
              }
            });
            remoteUsers.forEach((u) => {
              if (u && u.username) {
                map.set(u.username.toLowerCase(), {
                  ...map.get(u.username.toLowerCase()),
                  ...u,
                });
              }
            });

            const merged = Array.from(map.values());
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
    const map = new Map();
    dummyDB.forEach((u) => map.set(u.username.toLowerCase(), u));
    stored.forEach((u) => {
      if (u && u.username) {
        map.set(u.username.toLowerCase(), {
          ...map.get(u.username.toLowerCase()),
          ...u,
        });
      }
    });
    return Array.from(map.values());
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
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("currentUser", JSON.stringify(userData));

      // Sinkronkan savedAccounts: jika bukan tambah akun lain, simpan akun yang login saat ini
      const isAdding = sessionStorage.getItem("isAddingAccount") === "true";
      sessionStorage.removeItem("isAddingAccount");

      let saved = isAdding
        ? JSON.parse(localStorage.getItem("savedAccounts") || "[]")
        : [];

      // Filter nama Andi Pratama dan normalisasi role Approval
      saved = saved
        .filter(
          (u) =>
            (u.name || "").toLowerCase() !== "andi pratama" &&
            (u.username || "").toLowerCase() !== "andipratama",
        )
        .map((u) => {
          if (u.role === "Approval 1" || u.role === "Approval 2") {
            return { ...u, role: "Approval" };
          }
          return u;
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

      navigate(returnTo, { replace: true });
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
          <h2 className="login-title">{isBookingLogin ? "Login Booking" : "Login Dashboard"}</h2>
          <p className="login-subtitle">
            {isBookingLogin ? "Masuk untuk memesan Ruang Rapat" : "Masuk untuk kelola Ruang Rapat"}
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


            <div style={{ marginTop: "24px", paddingTop: "18px", borderTop: "1px dashed #cbd5e1" }}>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "#475569", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Pilih Akun Cepat (Testing):
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => {
                    const uname = import.meta.env.VITE_APPROVAL1_USERNAME || "approval1";
                    const pwd = import.meta.env.VITE_APPROVAL1_PASSWORD || "";
                    setUsername(uname);
                    setPassword(pwd);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: "8px",
                    cursor: "pointer",
                    textAlign: "left",
                    color: "#166534",
                    fontSize: "12px",
                  }}
                >
                  <span><b>Atasan (Pimpinan)</b> - <code>{import.meta.env.VITE_APPROVAL1_USERNAME || "approval1"}</code></span>
                  <span style={{ fontWeight: 600, fontSize: "11px", background: "#dcfce7", padding: "2px 6px", borderRadius: "4px" }}>Bisa Approve</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const uname = import.meta.env.VITE_APPROVAL2_USERNAME || "approval2";
                    const pwd = import.meta.env.VITE_APPROVAL2_PASSWORD || "";
                    setUsername(uname);
                    setPassword(pwd);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: "8px",
                    cursor: "pointer",
                    textAlign: "left",
                    color: "#166534",
                    fontSize: "12px",
                  }}
                >
                  <span><b>Atasan (Wakil Pimpinan)</b> - <code>{import.meta.env.VITE_APPROVAL2_USERNAME || "approval2"}</code></span>
                  <span style={{ fontWeight: 600, fontSize: "11px", background: "#dcfce7", padding: "2px 6px", borderRadius: "4px" }}>Bisa Approve</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const uname = import.meta.env.VITE_ADMIN_USERNAME || "admin";
                    const pwd = import.meta.env.VITE_ADMIN_PASSWORD || "";
                    setUsername(uname);
                    setPassword(pwd);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    borderRadius: "8px",
                    cursor: "pointer",
                    textAlign: "left",
                    color: "#1e40af",
                    fontSize: "12px",
                  }}
                >
                  <span><b>Admin Utama</b> - <code>{import.meta.env.VITE_ADMIN_USERNAME || "admin"}</code></span>
                  <span style={{ fontWeight: 600, fontSize: "11px", background: "#dbeafe", padding: "2px 6px", borderRadius: "4px" }}>Monitoring & Check-In</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
