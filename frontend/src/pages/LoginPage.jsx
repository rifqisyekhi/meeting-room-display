import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LoginPage.css";
import logoKemnaker from "../assets/Logo Kemenaker White.png";

const dummyDB = [
  {
    username: "admin",
    password: "admin123",
    role: "Administrator",
    name: "Admin Utama",
  },
  {
    username: "approval1",
    password: "approval123",
    role: "Approval 1",
    name: "Pimpinan",
  },
  {
    username: "approval2",
    password: "approval234",
    role: "Approval 2",
    name: "Wakil Pimpinan",
  },
];

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

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

  const handleLogin = (e) => {
    e.preventDefault();
    const accounts = getLoginAccounts();
    const user = accounts.find(
      (u) =>
        (u.username || "").toLowerCase() === username.trim().toLowerCase() &&
        u.password === password,
    );
    if (user) {
      if (user.status === "Nonaktif") {
        alert("Akun ini sedang dinonaktifkan. Silakan hubungi Admin Utama.");
        return;
      }
      const userData = {
        username: user.username,
        name: user.name,
        role: user.role,
        email: user.email || "",
        dept: user.dept || "",
      };
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("currentUser", JSON.stringify(userData));

      // Selalu sinkronkan nama & role di savedAccounts dengan akun login terbaru
      let saved = JSON.parse(localStorage.getItem("savedAccounts") || "[]");
      const existingIdx = saved.findIndex(
        (u) => (u.username || "").toLowerCase() === user.username.toLowerCase(),
      );
      if (existingIdx >= 0) {
        saved[existingIdx] = userData;
        localStorage.setItem("savedAccounts", JSON.stringify(saved));
      } else {
        saved.push(userData);
        localStorage.setItem("savedAccounts", JSON.stringify(saved));
      }

      navigate("/dashboard");
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
          <h2 className="login-title">Login Dashboard</h2>
          <p className="login-subtitle">Masuk untuk kelola Ruang Rapat</p>

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
