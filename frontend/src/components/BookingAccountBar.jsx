import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IoLogoWhatsapp } from "react-icons/io";
import logo from "../assets/Logo Kemenaker White.png";
import "./BookingAccountBar.css";

export default function BookingAccountBar({ currentUser, historyPage = false, showHelp = false }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const name = currentUser?.name || "Pengguna";
  const role = currentUser?.role || "User";
  const normalizedRole = role.toLowerCase();
  const isRegularUser = !["admin", "pimpinan", "approval"].some((value) => normalizedRole.includes(value));

  const logout = () => {
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
    keys.forEach((key) => {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    });
    navigate("/login?portal=booking&logout=true", { replace: true });
  };

  const switchAccount = () => {
    setMenuOpen(false);
    const keys = [
      "booking_isAuthenticated",
      "booking_currentUser",
      "dashboard_isAuthenticated",
      "dashboard_currentUser",
      "isAuthenticated",
      "currentUser",
    ];
    keys.forEach((key) => {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    });
    sessionStorage.setItem("booking_isAddingAccount", "true");
    sessionStorage.setItem("isAddingAccount", "true");
    navigate("/login?portal=booking", { state: { from: { pathname: "/booking" }, fromPortal: "booking" } });
  };

  return (
    <div className="booking-account-bar">
      <div className="booking-account-brand">
        <img src={logo} alt="Logo Kemnaker" />
        <span>BIRO KEUANGAN DAN BMN</span>
      </div>
      <div className="booking-account-actions">
        {showHelp && (
          <a className="booking-account-help" href="http://wa.me/+6285122777026" target="_blank" rel="noopener noreferrer">
            <IoLogoWhatsapp /> <span>Hubungi Bantuan</span>
          </a>
        )}
        <nav className="booking-section-nav" aria-label="Navigasi booking">
          <button type="button" onClick={() => navigate("/dashboard")}>
            Dashboard
          </button>
          <button
            type="button"
            className={!historyPage ? "active" : ""}
            aria-current={!historyPage ? "page" : undefined}
            onClick={() => navigate("/booking")}
          >
            <span>Booking</span><span className="bk-nav-full"> Ruangan</span>
          </button>
          <button
            type="button"
            className={historyPage ? "active" : ""}
            aria-current={historyPage ? "page" : undefined}
            onClick={() => navigate("/booking/history")}
          >
            <span>Riwayat</span><span className="bk-nav-full"> Pemesanan</span>
          </button>
        </nav>
        <div className="booking-account-menu-wrap">
          <button
            type="button"
            className="booking-account-avatar"
            aria-label={`Akun ${name}`}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {name.charAt(0).toUpperCase()}
          </button>
          {menuOpen && (
            <div className="booking-account-menu">
              <div className="booking-account-menu-label">AKUN AKTIF</div>
              <div className="booking-account-current">
                <strong>{name}</strong>
                <small>Role: {role}</small>
              </div>
              {isRegularUser ? (
                <button type="button" onClick={() => { setMenuOpen(false); navigate("/dashboard/profile"); }}>
                  Profil &amp; Ganti Password
                </button>
              ) : (
                <button type="button" onClick={() => { setMenuOpen(false); navigate("/dashboard"); }}>
                  Buka Dashboard {role}
                </button>
              )}
              <button type="button" onClick={switchAccount}>Tambah Akun Lain</button>
              <button type="button" className="booking-account-logout" onClick={logout}>Log Out</button>
            </div>
          )}
        </div>
      </div>
      {menuOpen && <button className="booking-account-dismiss" aria-label="Tutup menu akun" onClick={() => setMenuOpen(false)} />}
    </div>
  );
}
