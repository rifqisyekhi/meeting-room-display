import { useLockScroll } from "../utils/scrollLock";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaBars, FaCalendarAlt, FaDoorOpen, FaEye, FaEyeSlash, FaHistory, FaLock, FaSignOutAlt, FaTimes, FaUser } from "react-icons/fa";
import { IoMdHome } from "react-icons/io";
import "./UserDashboardPage.css";

const readUser = () => {
  try {
    const raw =
      sessionStorage.getItem("booking_currentUser") ||
      localStorage.getItem("booking_currentUser") ||
      sessionStorage.getItem("dashboard_currentUser") ||
      localStorage.getItem("dashboard_currentUser") ||
      sessionStorage.getItem("currentUser") ||
      localStorage.getItem("currentUser") ||
      "{}";
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const readMeetings = () => {
  try {
    const records = JSON.parse(
      localStorage.getItem("app_meetings") ||
        sessionStorage.getItem("app_meetings") ||
        "[]",
    );
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
};

const getMeetingDateTime = (meeting, timeValue) => {
  if (!meeting?.date || !timeValue) return null;
  const dateMatch = String(meeting.date).match(/^(\d{4})-(\d{2})-(\d{2})/);
  const timeMatch = String(timeValue).match(/^(\d{1,2}):(\d{2})/);
  if (!dateMatch || !timeMatch) return null;
  const [, year, month, day] = dateMatch;
  const [, hour, minute] = timeMatch;
  const result = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  return Number.isNaN(result.getTime()) ? null : result;
};

const isPendingMeeting = (meeting) => /menunggu|pending/i.test(String(meeting?.status || ""));
const isCancelledMeeting = (meeting) => /tolak|batal|reject|cancel/i.test(String(meeting?.status || ""));
const formatMeetingDate = (date) => new Intl.DateTimeFormat("id-ID", {
  weekday: "short",
  day: "numeric",
  month: "short",
}).format(date);

export default function UserDashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(readUser);
  const [meetings, setMeetings] = useState(readMeetings);
  const profileOpen = location.pathname.endsWith("/profile");
  const [now, setNow] = useState(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState({ current: false, next: false, confirm: false });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useLockScroll(mobileSidebarOpen);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const goToBooking = (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      e.stopPropagation();
    }
    setMobileSidebarOpen(false);
    navigate("/booking");
    if (window.parent && window.parent !== window) {
      try {
        window.parent.location.href = "/booking";
      } catch (err) {}
    }
  };

  useEffect(() => {
    document.title = "Dashboard Pengguna - Booking Ruang Rapat";
  }, []);

  useEffect(() => {
    const refresh = () => {
      setMeetings(readMeetings());
      setUser(readUser());
    };
    window.addEventListener("storage", refresh);
    window.addEventListener("app_meetings_updated", refresh);

    const fetchMeetings = async () => {
      try {
        const res = await fetch("/api/dashboard/meetings");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setMeetings(data);
            try {
              localStorage.setItem("app_meetings", JSON.stringify(data));
            } catch {
              // Dashboard tetap memakai data dari API jika storage browser tidak tersedia.
            }
          }
        }
      } catch {
        // Pertahankan cache lokal ketika API belum dapat diakses.
      }
    };
    fetchMeetings();

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("app_meetings_updated", refresh);
    };
  }, []);

  useEffect(() => {
    const updateClock = () => setNow(Date.now());
    const initialUpdate = window.setTimeout(updateClock, 0);
    const interval = window.setInterval(updateClock, 60_000);
    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(interval);
    };
  }, []);

  const ownMeetings = useMemo(() => {
    const username = String(user.username || "").toLowerCase();
    const name = String(user.name || "").toLowerCase();
    const seen = new Set();
    return meetings.filter((meeting) => {
      if (!meeting) return false;
      const owner = String(meeting.bookedByUsername || meeting.username || "").toLowerCase();
      const ownerName = String(meeting.bookedBy || meeting.requester || "").toLowerCase();
      const isOwner = (username && owner === username) || (name && ownerName === name);
      if (!isOwner) return false;

      const normRoom = String(meeting.room || meeting.roomName || "").toLowerCase().replace(/\s+/g, "");
      const dedupeKey =
        meeting.originalId ||
        meeting.googleId ||
        meeting.id ||
        `${meeting.date}_${meeting.start || meeting.startTime}_${normRoom}`;

      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      if (meeting.id) seen.add(String(meeting.id));
      if (meeting.googleId) seen.add(String(meeting.googleId));
      if (meeting.originalId) seen.add(String(meeting.originalId));
      if (meeting.date && (meeting.start || meeting.startTime) && normRoom) {
        seen.add(`${meeting.date}_${meeting.start || meeting.startTime}_${normRoom}`);
      }
      return true;
    });
  }, [meetings, user]);

  const upcomingMeetings = useMemo(() => {
    if (now === null) return [];
    return ownMeetings
      .filter((meeting) => {
        const start = getMeetingDateTime(meeting, meeting.start || meeting.startTime);
        const end = getMeetingDateTime(meeting, meeting.end || meeting.endTime) || start;
        return start && end && start.getTime() >= now && !isPendingMeeting(meeting) && !isCancelledMeeting(meeting);
      })
      .sort((a, b) => getMeetingDateTime(a, a.start || a.startTime) - getMeetingDateTime(b, b.start || b.startTime));
  }, [ownMeetings, now]);
  const upcomingCount = upcomingMeetings.length;
  const nearestMeetings = upcomingMeetings.slice(0, 3);
  const pendingCount = ownMeetings.filter((meeting) => /menunggu|pending/i.test(meeting.status || "")).length;

  const openProfile = () => {
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

      try {
        const stored = JSON.parse(localStorage.getItem("app_login_users") || "[]");
        const idx = stored.findIndex((u) => (u.username || "").toLowerCase() === (user.username || "").toLowerCase());
        if (idx !== -1) {
          stored[idx].password = newPassword;
          localStorage.setItem("app_login_users", JSON.stringify(stored));
        }
      } catch (e) {}

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

  return (
    <div className="user-dashboard-shell">
      <div
        className={`user-dashboard-backdrop ${mobileSidebarOpen ? "visible" : ""}`}
        onClick={() => setMobileSidebarOpen(false)}
        aria-hidden="true"
      />
      <aside className={`user-dashboard-sidebar ${mobileSidebarOpen ? "open" : ""}`}>
        <div className="user-dashboard-brand">
          <img
            src="/dashboard-app/assets/kemenaker-white.png"
            alt="Logo Kemenaker"
            className="user-dashboard-brand-logo"
          />
          <div>
            <b>MEETING DISPLAY ROOM</b>
            <small>BIRO KEUANGAN DAN BMN</small>
          </div>
          <button
            type="button"
            className="user-dashboard-sidebar-close"
            aria-label="Tutup menu navigasi"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <FaTimes />
          </button>
        </div>
        <nav className="user-dashboard-nav" aria-label="Navigasi pengguna">
          <button
            type="button"
            className={!profileOpen ? "active" : ""}
            onClick={() => {
              setMobileSidebarOpen(false);
              navigate("/dashboard");
            }}
          >
            <IoMdHome />
            <span>Dashboard</span>
          </button>
          <button
            type="button"
            onClick={goToBooking}
          >
            <FaCalendarAlt />
            <span>Booking Ruangan</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileSidebarOpen(false);
              navigate("/booking/history");
            }}
          >
            <FaHistory />
            <span>Riwayat Pemesanan</span>
          </button>
          <button
            type="button"
            className={profileOpen ? "active" : ""}
            onClick={() => {
              setMobileSidebarOpen(false);
              openProfile();
            }}
          >
            <FaUser />
            <span>Profil</span>
          </button>
        </nav>
        <div className="user-dashboard-sidebar-footer">
          <div className="user-dashboard-sidebar-user">
            <span className="user-dashboard-sidebar-avatar">
              {(user.name || user.username || "U").charAt(0).toUpperCase()}
            </span>
            <div className="user-dashboard-sidebar-user-info">
              <strong>{user.name || user.username || "Pengguna"}</strong>
              <small>{user.role || "User"}</small>
            </div>
          </div>
          <div className="user-dashboard-sidebar-actions">
            <button type="button" className="user-dashboard-logout-btn" onClick={logout}>
              Keluar
            </button>
          </div>
        </div>
      </aside>

      <main className="user-dashboard-main">
        <div className="user-dashboard-mobile-nav">
          <button
            type="button"
            className="user-dashboard-menu-toggle"
            aria-label={mobileSidebarOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          >
            {mobileSidebarOpen ? <FaTimes /> : <FaBars />}
          </button>
        </div>

        {profileOpen ? (
          <section className="user-dashboard-content">
            <div className="user-page-heading">
              <h1>Profil Saya</h1>
              <p>Kelola data diri dan keamanan akun Anda.</p>
            </div>
            <div className="user-profile-grid">
              <article className="user-profile-card">
                <div className="user-profile-avatar">{(user.name || user.username || "U").charAt(0).toUpperCase()}</div>
                <h2>{user.name || user.username || "Pengguna"}</h2><p>{user.role || "User"}</p>
                <dl><div><dt>Username</dt><dd>{user.username || "-"}</dd></div><div><dt>Email</dt><dd>{user.email || "Belum diisi"}</dd></div><div><dt>Bagian</dt><dd>{user.dept || "Biro Keuangan dan BMN"}</dd></div></dl>
              </article>
              <form className="user-password-card" onSubmit={handlePasswordChange}>
                <div className="user-card-heading"><span><FaLock /></span><div><h2>Ganti Password</h2><p>Minimal 8 karakter.</p></div></div>
                <label>Password saat ini<div className="user-password-input-wrap"><input type={visiblePasswords.current ? "text" : "password"} autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /><button type="button" aria-label={visiblePasswords.current ? "Sembunyikan password saat ini" : "Tampilkan password saat ini"} onClick={() => setVisiblePasswords((state) => ({ ...state, current: !state.current }))}>{visiblePasswords.current ? <FaEyeSlash /> : <FaEye />}</button></div></label>
                <label>Password baru<div className="user-password-input-wrap"><input type={visiblePasswords.next ? "text" : "password"} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required /><button type="button" aria-label={visiblePasswords.next ? "Sembunyikan password baru" : "Tampilkan password baru"} onClick={() => setVisiblePasswords((state) => ({ ...state, next: !state.next }))}>{visiblePasswords.next ? <FaEyeSlash /> : <FaEye />}</button></div></label>
                <label>Konfirmasi password baru<div className="user-password-input-wrap"><input type={visiblePasswords.confirm ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required /><button type="button" aria-label={visiblePasswords.confirm ? "Sembunyikan konfirmasi password" : "Tampilkan konfirmasi password"} onClick={() => setVisiblePasswords((state) => ({ ...state, confirm: !state.confirm }))}>{visiblePasswords.confirm ? <FaEyeSlash /> : <FaEye />}</button></div></label>
                {passwordMessage && <p className={`user-password-message ${passwordError ? "error" : "success"}`} role="status">{passwordMessage}</p>}
                <button type="submit" disabled={savingPassword}>{savingPassword ? "Menyimpan..." : "Simpan Perubahan"}</button>
              </form>
            </div>
          </section>
        ) : (
          <section className="user-dashboard-content">
            <div className="user-welcome-banner"><span>Selamat datang,</span><h1>{user.name || user.username || "Pengguna"}</h1><p>Kelola pemesanan ruang rapat dan pantau status rapat Anda dengan mudah.</p><button type="button" onClick={goToBooking}><FaDoorOpen /><span>Booking Ruangan</span></button></div>
            <div className="user-stat-grid">
              <article><span className="blue"><FaCalendarAlt /></span><div><small>Total Pemesanan</small><strong>{ownMeetings.length}</strong><p>Seluruh pemesanan Anda</p></div></article>
              <article><span className="green"><FaDoorOpen /></span><div><small>Jadwal Mendatang</small><strong>{upcomingCount}</strong><p>Rapat disetujui yang akan datang</p></div></article>
              <article><span className="amber"><FaHistory /></span><div><small>Menunggu Persetujuan</small><strong>{pendingCount}</strong><p>Pemesanan menunggu keputusan</p></div></article>
            </div>
            <div className="user-dashboard-lower-panel">
              <div className="user-section-heading"><div><span>AKSES CEPAT</span><h2>Menu Pemesanan</h2></div></div>
              <div className="user-quick-grid">
                <button type="button" onClick={goToBooking}><span className="quick-icon blue"><FaCalendarAlt /></span><span><strong>Booking Ruangan</strong><small>Buat pemesanan baru</small></span><b aria-hidden="true">›</b></button>
                <button type="button" onClick={() => navigate("/booking/history")}><span className="quick-icon purple"><FaHistory /></span><span><strong>Riwayat Pemesanan</strong><small>Lihat status pemesanan</small></span><b aria-hidden="true">›</b></button>
                <button type="button" onClick={openProfile}><span className="quick-icon slate"><FaUser /></span><span><strong>Profil & Password</strong><small>Perbarui informasi akun</small></span><b aria-hidden="true">›</b></button>
              </div>
              <div className="user-upcoming-section">
                <div className="user-section-heading user-upcoming-heading">
                  <div><span>AGENDA</span><h2>Jadwal Rapat Terdekat</h2></div>
                  <button type="button" onClick={() => navigate("/booking/history")}>Lihat semua <span aria-hidden="true">→</span></button>
                </div>
                {nearestMeetings.length > 0 ? (
                  <div className="user-upcoming-list">
                    {nearestMeetings.map((meeting, index) => {
                      const start = getMeetingDateTime(meeting, meeting.start || meeting.startTime);
                      return (
                        <article className="user-upcoming-card" key={meeting.id || meeting.googleId || `${meeting.date}-${meeting.start || meeting.startTime}-${index}`}>
                          <div className="user-upcoming-date"><strong>{start ? start.getDate() : "—"}</strong><span>{start ? new Intl.DateTimeFormat("id-ID", { month: "short" }).format(start) : ""}</span></div>
                          <div className="user-upcoming-details">
                            <strong>{meeting.title || meeting.agenda || "Rapat"}</strong>
                            <span>{meeting.room || meeting.roomName || "Ruangan belum ditentukan"}</span>
                          </div>
                          <div className="user-upcoming-meta">
                            <span>{start ? formatMeetingDate(start) : "Tanggal belum tersedia"}</span>
                            <span>{meeting.start || meeting.startTime || "--:--"}{(meeting.end || meeting.endTime) ? `–${meeting.end || meeting.endTime}` : ""}</span>
                          </div>
                          <span className="user-upcoming-status">{meeting.status || "Disetujui"}</span>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="user-upcoming-empty">
                    <span><FaCalendarAlt /></span>
                    <div><strong>Belum ada jadwal rapat mendatang</strong><p>Rapat yang sudah disetujui akan muncul di sini.</p></div>
                    <button type="button" onClick={goToBooking}>Buat pemesanan</button>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
