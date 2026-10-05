import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LoginPage.css";

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
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    const user = dummyDB.find(
      (u) => u.username === username && u.password === password,
    );
    if (user) {
      const userData = {
        username: user.username,
        name: user.name,
        role: user.role,
      };
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("currentUser", JSON.stringify(userData));

      // Selalu sinkronkan nama & role di savedAccounts dengan dummyDB terbaru
      let saved = JSON.parse(localStorage.getItem("savedAccounts") || "[]");
      const existingIdx = saved.findIndex((u) => u.username === user.username);
      if (existingIdx >= 0) {
        // Update nama/role jika sudah berubah di source code
        saved[existingIdx] = userData;
        localStorage.setItem("savedAccounts", JSON.stringify(saved));
      } else if (rememberMe) {
        // Tambahkan ke saved jika belum ada dan rememberMe dicentang
        saved.push(userData);
        localStorage.setItem("savedAccounts", JSON.stringify(saved));
      }

      navigate("/dashboard");
    } else {
      alert("Username atau password salah!");
    }
  };

  return (
    <div className="login-container">
      {/* Header Logo */}
      <div className="login-header">
        <img src="/dashboard/assets/kemnaker.png" alt="Logo Kemnaker" />
        <h1>BIRO KEUANGAN DAN BMN</h1>
      </div>

      {/* Login Card */}
      <div className="login-card">
        <h2>Login Dashboard</h2>
        <p>Masuk untuk kelola ruang rapat.</p>

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <svg
              className="input-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <input
              type="text"
              placeholder="Masukkan username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <svg
              className="input-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Masukkan password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              )}
            </button>
          </div>

          <div className="login-options">
            <label className="remember-me">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Ingat saya
            </label>
            <a href="#" className="forgot-password">
              Lupa password?
            </a>
          </div>

          <button type="submit" className="login-button">
            Masuk
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M5 12h14M12 5l7 7-7 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </form>

        <div className="login-footer">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            <path d="M9 12l2 2 4-4"></path>
          </svg>
          <span>
            Akses sistem ini khusus untuk administrator yang berwenang.
          </span>
        </div>
      </div>
    </div>
  );
}
