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

  const logout = () => {
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("currentUser");
    sessionStorage.removeItem("isAddingAccount");
    navigate("/login");
  };

  const switchAccount = () => {
    setMenuOpen(false);
    sessionStorage.setItem("isAddingAccount", "true");
    localStorage.removeItem("isAuthenticated");
    navigate("/login");
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
          <button
            type="button"
            className={!historyPage ? "active" : ""}
            aria-current={!historyPage ? "page" : undefined}
            onClick={() => navigate("/booking")}
          >
            Booking Ruangan
          </button>
          <button
            type="button"
            className={historyPage ? "active" : ""}
            aria-current={historyPage ? "page" : undefined}
            onClick={() => navigate("/booking/history")}
          >
            Riwayat Pemesanan
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
