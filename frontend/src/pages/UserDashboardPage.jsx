import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaCalendarAlt, FaDoorOpen, FaEye, FaEyeSlash, FaHistory, FaLock, FaSignOutAlt, FaUser } from "react-icons/fa";
import { IoMdHome } from "react-icons/io";
import "./UserDashboardPage.css";

const readUser = () => {
  try { return JSON.parse(localStorage.getItem("currentUser") || "{}"); }
  catch { return {}; }
};

const readMeetings = () => {
  try {
    const records = JSON.parse(localStorage.getItem("app_meetings") || "[]");
    return Array.isArray(records) ? records : [];
  } catch { return []; }
};

export default function UserDashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user] = useState(readUser);
  const [meetings, setMeetings] = useState(readMeetings);
  const [profileOpen, setProfileOpen] = useState(location.pathname.endsWith("/profile"));
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState({ current: false, next: false, confirm: false });
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    document.title = "Dashboard Pengguna - Booking Ruang Rapat";
  }, []);

  useEffect(() => {
    setProfileOpen(location.pathname.endsWith("/profile"));
  }, [location.pathname]);

  useEffect(() => {
    const refresh = () => setMeetings(readMeetings());
    window.addEventListener("storage", refresh);
    window.addEventListener("app_meetings_updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("app_meetings_updated", refresh);
    };
  }, []);

  const ownMeetings = useMemo(() => {
    const username = String(user.username || "").toLowerCase();
    const name = String(user.name || "").toLowerCase();
    return meetings.filter((meeting) => {
      const owner = String(meeting.bookedByUsername || meeting.username || "").toLowerCase();
      const ownerName = String(meeting.bookedBy || meeting.requester || "").toLowerCase();
      return (username && owner === username) || (name && ownerName === name);
    });
  }, [meetings, user]);

  const upcomingCount = ownMeetings.filter((meeting) => {
    const date = meeting.date;
    const end = meeting.end || meeting.endTime || "23:59";
    return date && new Date(`${date}T${end}:00`) >= new Date() && !/tolak|batal/i.test(meeting.status || "");
  }).length;
  const pendingCount = ownMeetings.filter((meeting) => /menunggu|pending/i.test(meeting.status || "")).length;

  const openProfile = () => {
    setProfileOpen(true);
    setPasswordMessage("");
    navigate("/dashboard/profile");
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    setPasswordError(false);
    setPasswordMessage("");
    if (newPassword.length < 8) {
      setPasswordError(true);
      setPasswordMessage("Password baru minimal 8 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(true);
      setPasswordMessage("Konfirmasi password baru belum sama.");
      return;
    }

    setSavingPassword(true);
    try {
      const response = await fetch("/api/dashboard/users/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.username, currentPassword, newPassword }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Password gagal diperbarui.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Password berhasil diperbarui.");
    } catch (error) {
      setPasswordError(true);
      setPasswordMessage(error.message || "Tidak dapat menghubungi server.");
    } finally {
      setSavingPassword(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("currentUser");
    sessionStorage.removeItem("isAddingAccount");
    navigate("/login", { replace: true });
  };

  return (
    <div className="user-dashboard-shell">
      <aside className="user-dashboard-sidebar">
        <div className="user-dashboard-brand">
          <img src="/dashboard-app/assets/kemenaker-white.png" alt="" />
          <span><strong>MEETING DISPLAY ROOM</strong><small>BIRO KEUANGAN DAN BMN</small></span>
        </div>
        <nav className="user-dashboard-nav" aria-label="Navigasi pengguna">
          <button className={!profileOpen ? "active" : ""} onClick={() => { setProfileOpen(false); navigate("/dashboard"); }}><IoMdHome />Dashboard</button>
          <button onClick={() => navigate("/booking")}><FaCalendarAlt />Booking Ruangan</button>
          <button onClick={() => navigate("/booking/history")}><FaHistory />Riwayat Pemesanan</button>
          <button className={profileOpen ? "active" : ""} onClick={openProfile}><FaUser />Profil</button>
        </nav>
        <button className="user-dashboard-logout" onClick={logout}><FaSignOutAlt />Keluar</button>
        <div className="user-dashboard-sidebar-user"><span>{(user.name || user.username || "U").charAt(0).toUpperCase()}</span><div><strong>{user.name || user.username || "Pengguna"}</strong><small>{user.role || "User"}</small></div></div>
      </aside>

      <main className="user-dashboard-main">
        <header className="user-dashboard-topbar">
          <div><small>Portal Pengguna</small><strong>{profileOpen ? "Profil Saya" : "Dashboard"}</strong></div>
          <button className="user-dashboard-profile-button" onClick={openProfile}>
            <span className="user-dashboard-topbar-avatar">{(user.name || user.username || "U").charAt(0).toUpperCase()}</span>
            <span className="user-dashboard-topbar-account"><strong>{user.name || user.username || "Pengguna"}</strong><small>{user.role || "User"}</small></span>
          </button>
        </header>

        {profileOpen ? (
          <section className="user-dashboard-content">
            <div className="user-page-heading"><span>AKUN SAYA</span><h1>Profil Pengguna</h1><p>Periksa informasi akun dan perbarui password Anda.</p></div>
            <div className="user-profile-grid">
              <article className="user-profile-card">
                <div className="user-profile-avatar">{(user.name || user.username || "U").charAt(0).toUpperCase()}</div>
                <h2>{user.name || "Pengguna"}</h2><p>{user.role || "User"}</p>
                <dl><div><dt>Username</dt><dd>{user.username || "-"}</dd></div><div><dt>Email</dt><dd>{user.email || "Belum diisi"}</dd></div><div><dt>Bagian</dt><dd>{user.dept || "Biro Keuangan dan BMN"}</dd></div></dl>
              </article>
              <form className="user-password-card" onSubmit={handlePasswordChange}>
                <div className="user-card-heading"><span><FaLock /></span><div><h2>Ganti Password</h2><p>Gunakan password minimal 8 karakter.</p></div></div>
                <label>Password saat ini<div className="user-password-input-wrap"><input type={visiblePasswords.current ? "text" : "password"} autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /><button type="button" aria-label={visiblePasswords.current ? "Sembunyikan password saat ini" : "Tampilkan password saat ini"} onClick={() => setVisiblePasswords((state) => ({ ...state, current: !state.current }))}>{visiblePasswords.current ? <FaEyeSlash /> : <FaEye />}</button></div></label>
                <label>Password baru<div className="user-password-input-wrap"><input type={visiblePasswords.next ? "text" : "password"} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required /><button type="button" aria-label={visiblePasswords.next ? "Sembunyikan password baru" : "Tampilkan password baru"} onClick={() => setVisiblePasswords((state) => ({ ...state, next: !state.next }))}>{visiblePasswords.next ? <FaEyeSlash /> : <FaEye />}</button></div></label>
                <label>Konfirmasi password baru<div className="user-password-input-wrap"><input type={visiblePasswords.confirm ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required /><button type="button" aria-label={visiblePasswords.confirm ? "Sembunyikan konfirmasi password" : "Tampilkan konfirmasi password"} onClick={() => setVisiblePasswords((state) => ({ ...state, confirm: !state.confirm }))}>{visiblePasswords.confirm ? <FaEyeSlash /> : <FaEye />}</button></div></label>
                {passwordMessage && <p className={`user-password-message ${passwordError ? "error" : "success"}`} role="status">{passwordMessage}</p>}
                <button type="submit" disabled={savingPassword}>{savingPassword ? "Menyimpan..." : "Simpan Password"}</button>
              </form>
            </div>
          </section>
        ) : (
          <section className="user-dashboard-content">
            <div className="user-welcome-banner"><span>Selamat datang,</span><h1>{user.name || user.username || "Pengguna"}</h1><p>Kelola pemesanan ruang rapat dan pantau status rapat Anda dengan mudah.</p><button onClick={() => navigate("/booking")}><FaDoorOpen />Booking Ruangan</button></div>
            <div className="user-stat-grid">
              <article><span className="blue"><FaCalendarAlt /></span><div><small>Total Pemesanan</small><strong>{ownMeetings.length}</strong><p>Semua pemesanan Anda</p></div></article>
              <article><span className="green"><FaDoorOpen /></span><div><small>Jadwal Mendatang</small><strong>{upcomingCount}</strong><p>Rapat yang belum selesai</p></div></article>
              <article><span className="amber"><FaHistory /></span><div><small>Menunggu Persetujuan</small><strong>{pendingCount}</strong><p>Permintaan yang diproses</p></div></article>
            </div>
            <div className="user-section-heading"><div><span>AKSES CEPAT</span><h2>Menu Pemesanan</h2></div></div>
            <div className="user-quick-grid">
              <button onClick={() => navigate("/booking")}><span className="quick-icon blue"><FaCalendarAlt /></span><span><strong>Booking Ruangan</strong><small>Pilih ruang, tanggal, dan waktu rapat.</small></span><b>›</b></button>
              <button onClick={() => navigate("/booking/history")}><span className="quick-icon purple"><FaHistory /></span><span><strong>Riwayat Pemesanan</strong><small>Lihat status dan detail pemesanan Anda.</small></span><b>›</b></button>
              <button onClick={openProfile}><span className="quick-icon slate"><FaUser /></span><span><strong>Profil & Password</strong><small>Perbarui informasi keamanan akun.</small></span><b>›</b></button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
