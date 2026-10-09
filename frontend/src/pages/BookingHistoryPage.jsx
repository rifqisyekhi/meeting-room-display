import { useCallback, useEffect, useMemo, useState } from "react";
import { FaCalendarAlt, FaChevronRight, FaClock, FaMapMarkerAlt, FaPlus, FaUsers } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import BookingAccountBar from "../components/BookingAccountBar";
import imgRuangRapatBesar from "../assets/Ruang Rapat Besar.jpeg";
import imgRuangKonsultasi from "../assets/Ruang Konsultasi.jpeg";
import "./BookingHistoryPage.css";

const roomDefaults = [
  { name: "Ruang Rapat Besar", location: "Gedung A - Lantai 3", capacity: 20, image: imgRuangRapatBesar },
  { name: "Ruang Konsultasi", location: "Gedung B - Lantai 2", capacity: 8, image: imgRuangKonsultasi },
];

const statusKey = (status = "") => {
  const value = String(status || "").toLowerCase();
  if (value.includes("tolak") || value.includes("reject") || value.includes("declin") || value.includes("tidak disetujui")) return "rejected";
  if (value.includes("batal") || value.includes("cancel")) return "cancelled";
  if (value.includes("selesai") || value.includes("complete")) return "completed";
  if (value.includes("menunggu") || value.includes("pending")) return "pending";
  return "approved";
};

const isExtensionWindowOpen = (meeting, now = new Date()) => {
  if (statusKey(meeting.status || meeting.approvalStatus) !== "approved" || !meeting.date) return false;
  const start = meeting.start || meeting.startTime;
  const end = meeting.end || meeting.endTime;
  if (!start || !end) return false;
  const startAt = new Date(`${meeting.date}T${start}:00`);
  const endAt = new Date(`${meeting.date}T${end}:00`);
  const extensionClosesAt = endAt.getTime() - 30 * 60 * 1000;
  return !Number.isNaN(startAt.getTime()) && now >= startAt && now.getTime() < extensionClosesAt;
};

const formatDate = (isoDate, options = {}) => {
  if (!isoDate) return "-";
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("id-ID", options);
};

const formatStamp = (stamp) => {
  if (!stamp) return "-";
  const date = new Date(stamp);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })} ${date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
};

const readLocalMeetings = () => {
  try {
    const meetings = JSON.parse(localStorage.getItem("app_meetings") || "[]");
    return Array.isArray(meetings) ? meetings : [];
  } catch {
    return [];
  }
};

export default function BookingHistoryPage() {
  const navigate = useNavigate();
  const [currentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("currentUser") || "{}"); }
    catch { return {}; }
  });
  const [meetings, setMeetings] = useState(readLocalMeetings);
  const [rooms, setRooms] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("app_rooms") || "[]");
      if (Array.isArray(stored) && stored.length) {
        return [...stored, ...roomDefaults].filter((room, index, list) =>
          list.findIndex((item) => (item.name || "").trim().toLowerCase() === (room.name || "").trim().toLowerCase()) === index,
        ).map((room) => ({ ...room, image: room.image || room.img || room.images?.[0] || roomDefaults.find((item) =>
          room.name?.toLowerCase().includes(item.name.toLowerCase()),
        )?.image || imgRuangRapatBesar }));
      }
    } catch {}
    return roomDefaults;
  });
  const [filterStatus, setFilterStatus] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [extensionTarget, setExtensionTarget] = useState(null);
  const [extensionComplete, setExtensionComplete] = useState(null);
  const [recommendationTarget, setRecommendationTarget] = useState(null);
  const [selectedRecommendationSlots, setSelectedRecommendationSlots] = useState({});
  const [showAllRecommendations, setShowAllRecommendations] = useState(false);
  const [notice, setNotice] = useState("");

  const isAdmin = (currentUser.role || "").toLowerCase().includes("admin") ||
    (currentUser.username || "").toLowerCase() === "admin";

  const refreshData = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard/data");
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data.meetings)) {
        const local = readLocalMeetings();
        const merged = [...data.meetings, ...local].filter((meeting, index, list) =>
          list.findIndex((other) => String(other.id) === String(meeting.id)) === index,
        );
        setMeetings(merged);
      }
      if (Array.isArray(data.rooms) && data.rooms.length) {
        let localRooms = [];
        try {
          const storedRooms = JSON.parse(localStorage.getItem("app_rooms") || "[]");
          if (Array.isArray(storedRooms)) localRooms = storedRooms;
        } catch {}
        const combinedRooms = [...data.rooms, ...localRooms].filter((room, index, list) =>
          list.findIndex((item) => (item.name || "").trim().toLowerCase() === (room.name || "").trim().toLowerCase()) === index,
        );
        setRooms(combinedRooms.map((room) => ({ ...room, image: room.image || room.images?.[0] || roomDefaults.find((item) =>
          room.name?.toLowerCase().includes(item.name.toLowerCase()),
        )?.image || imgRuangRapatBesar })));
      }
    } catch (error) {
      console.warn("Gagal memuat riwayat booking:", error);
    }
  }, []);

  useEffect(() => {
    const initialFetch = setTimeout(refreshData, 0);
    const interval = setInterval(refreshData, 10000);
    return () => {
      clearTimeout(initialFetch);
      clearInterval(interval);
    };
  }, [refreshData]);

  const visibleMeetings = useMemo(() => {
    const query = search.trim().toLowerCase();
    return meetings.filter((meeting) => {
      const belongsToUser = isAdmin ||
        (currentUser.username && meeting.bookedByUsername &&
          meeting.bookedByUsername.toLowerCase() === currentUser.username.toLowerCase()) ||
        (currentUser.name && meeting.bookedBy &&
          meeting.bookedBy.toLowerCase() === currentUser.name.toLowerCase());
      if (!belongsToUser) return false;
      const key = statusKey(meeting.status || meeting.approvalStatus);
      if (filterStatus !== "all" && key !== filterStatus) return false;
      if (fromDate && (meeting.date || "") < fromDate) return false;
      if (toDate && (meeting.date || "") > toDate) return false;
      const searchText = [meeting.room, meeting.title, meeting.agenda, meeting.requester, meeting.bookedBy]
        .filter(Boolean).join(" ").toLowerCase();
      return !query || searchText.includes(query);
    }).sort((a, b) => `${b.date || ""} ${b.start || ""}`.localeCompare(`${a.date || ""} ${a.start || ""}`));
  }, [meetings, isAdmin, currentUser, filterStatus, fromDate, toDate, search]);

  const recommendedRooms = useMemo(() => {
    if (!recommendationTarget) return [];
    const duration = 30;
    const participantCount = Number(recommendationTarget.participants) || 0;
    const today = new Date();
    const isToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}` === recommendationTarget.date;
    const currentMinutes = today.getHours() * 60 + today.getMinutes();

    return rooms.map((room) => {
      const roomStatus = (room.status || "").toLowerCase();
      if (roomStatus.includes("perbaikan") || roomStatus.includes("maintenance") || roomStatus.includes("tidak tersedia")) return false;
      const roomName = (room.name || "").trim().toLowerCase();
      if (!roomName) return false;
      const roomCapacity = Number(String(room.capacity || "").match(/\d+/)?.[0]) || 0;
      if (participantCount && roomCapacity < participantCount) return false;

      const occupied = meetings.filter((meeting) => {
        if (meeting.date !== recommendationTarget.date) return false;
        const status = statusKey(meeting.status || meeting.approvalStatus);
        if (status === "rejected" || status === "cancelled") return false;
        return (meeting.room || "").trim().toLowerCase() === roomName;
      });

      const scheduleSlots = [];
      for (let start = 8 * 60; start + duration <= 17 * 60; start += 30) {
        const end = start + duration;
        const hasConflict = occupied.some((meeting) => {
          const [otherStartHour, otherStartMinute] = (meeting.start || meeting.startTime || "00:00").split(":").map(Number);
          const [otherEndHour, otherEndMinute] = (meeting.end || meeting.endTime || "00:00").split(":").map(Number);
          const otherStart = otherStartHour * 60 + otherStartMinute;
          const otherEnd = otherEndHour * 60 + otherEndMinute;
          return start < otherEnd && end > otherStart;
        });
        const isPast = isToday && start < currentMinutes;
        scheduleSlots.push({
          start: `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`,
          end: `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`,
          available: !hasConflict && !isPast,
        });
      }
      const availableSlots = scheduleSlots.filter((slot) => slot.available);
      const occupiedSlots = occupied.map((meeting) => ({
        start: meeting.start || meeting.startTime,
        end: meeting.end || meeting.endTime,
      })).filter((slot) => slot.start && slot.end).sort((a, b) => a.start.localeCompare(b.start));
      return availableSlots.length ? {
        ...room,
        occupiedSlots,
      } : null;
    }).filter(Boolean);
  }, [recommendationTarget, rooms, meetings]);

  const isRecommendationTimeAvailable = (room, slot) => {
    if (!slot?.start || !slot?.end || !recommendationTarget) return false;
    const toMinutes = (value) => {
      const [hour, minute] = value.split(":").map(Number);
      return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : NaN;
    };
    const start = toMinutes(slot.start);
    const end = toMinutes(slot.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start % 30 !== 0 || end % 30 !== 0 || start < 8 * 60 || end > 17 * 60 || start >= end) return false;

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (recommendationTarget.date === today && start <= now.getHours() * 60 + now.getMinutes()) return false;

    const roomName = (room.name || "").trim().toLowerCase();
    return !meetings.some((meeting) => {
      if (meeting.date !== recommendationTarget.date) return false;
      if (["rejected", "cancelled"].includes(statusKey(meeting.status || meeting.approvalStatus))) return false;
      if ((meeting.room || "").trim().toLowerCase() !== roomName) return false;
      const occupiedStart = toMinutes(meeting.start || meeting.startTime || "");
      const occupiedEnd = toMinutes(meeting.end || meeting.endTime || "");
      return Number.isFinite(occupiedStart) && Number.isFinite(occupiedEnd) && start < occupiedEnd && end > occupiedStart;
    });
  };

  const extendMeeting = async (meeting, hours) => {
    if (!isExtensionWindowOpen(meeting)) {
      setExtensionTarget(null);
      setNotice("Tambah waktu tersedia sejak rapat dimulai hingga 30 menit sebelum jadwal selesai.");
      return;
    }

    const end = meeting.end || meeting.endTime || "00:00";
    const [endHour, endMinute] = end.split(":").map(Number);
    const newEndMinutes = endHour * 60 + endMinute + hours * 60;
    if (newEndMinutes > 17 * 60) {
      setNotice("Jam booking tidak dapat diperpanjang melewati pukul 17.00 WIB.");
      return;
    }

    const [startHour, startMinute] = (meeting.start || meeting.startTime || "00:00").split(":").map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const conflict = meetings.find((other) => {
      if (String(other.id) === String(meeting.id) || other.date !== meeting.date) return false;
      if (statusKey(other.status) === "rejected" || statusKey(other.status) === "cancelled") return false;
      if ((other.room || "").trim().toLowerCase() !== (meeting.room || "").trim().toLowerCase()) return false;
      const [otherStartHour, otherStartMinute] = (other.start || other.startTime || "00:00").split(":").map(Number);
      const [otherEndHour, otherEndMinute] = (other.end || other.endTime || "00:00").split(":").map(Number);
      const otherStart = otherStartHour * 60 + otherStartMinute;
      const otherEnd = otherEndHour * 60 + otherEndMinute;
      return startMinutes < otherEnd && newEndMinutes > otherStart;
    });
    if (conflict) {
      setNotice(`Tambahan waktu bentrok dengan jadwal ${conflict.start || conflict.startTime}–${conflict.end || conflict.endTime}.`);
      return;
    }

    const updatedMeeting = {
      ...meeting,
      end: `${String(Math.floor(newEndMinutes / 60)).padStart(2, "0")}:${String(newEndMinutes % 60).padStart(2, "0")}`,
      extensionHistory: [
        ...(Array.isArray(meeting.extensionHistory) ? meeting.extensionHistory : []),
        { hours, requestedBy: currentUser.username || currentUser.name, requestedAt: new Date().toISOString() },
      ],
    };
    const updatedMeetings = meetings.map((item) => String(item.id) === String(meeting.id) ? updatedMeeting : item);
    localStorage.setItem("app_meetings", JSON.stringify(updatedMeetings));
    setMeetings(updatedMeetings);
    setExtensionTarget(null);
    setNotice("");
    try {
      const response = await fetch("/api/dashboard/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedMeeting),
      });
      if (!response.ok) throw new Error("Gagal menyimpan perubahan booking.");
      setExtensionComplete({ meeting: updatedMeeting, hours });
    } catch (error) {
      console.warn("Sinkronisasi tambah waktu:", error);
      setNotice("Waktu diperbarui di halaman ini, tetapi gagal disinkronkan ke server.");
    }
  };

  const tabs = [
    ["all", "Semua"], ["pending", "Menunggu"], ["approved", "Disetujui"],
    ["rejected", "Ditolak"], ["completed", "Selesai"], ["cancelled", "Dibatalkan"],
  ];

  return (
    <main className="booking-history-page">
      <section className="booking-history-hero">
        <BookingAccountBar currentUser={currentUser} historyPage />
        <div className="booking-history-hero-copy">
          <h1>Riwayat Pemesanan Ruangan</h1>
          <p>Berikut adalah daftar riwayat pemesanan ruangan rapat yang pernah Anda buat.</p>
        </div>
        <div className="booking-history-toolbar">
          <div className="booking-history-tabs" role="tablist" aria-label="Filter status pemesanan">
            {tabs.map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={filterStatus === key}
                className={filterStatus === key ? "active" : ""} onClick={() => setFilterStatus(key)}>
                {label}
              </button>
            ))}
          </div>
          <div className="booking-history-controls">
            <label className="booking-history-date-filter">
              <FaCalendarAlt aria-hidden="true" />
              <span>Pilih Rentang Tanggal</span>
              <input type="date" aria-label="Tanggal mulai" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
              <span>s/d</span>
              <input type="date" aria-label="Tanggal akhir" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </label>
            <input className="booking-history-search" type="search"
              placeholder="Cari nama ruangan, agenda, atau bagian..." value={search}
              onChange={(event) => setSearch(event.target.value)} />
          </div>
        </div>
      </section>

      <section className="booking-history-list" aria-label="Daftar pemesanan">
        {visibleMeetings.length ? visibleMeetings.map((meeting) => {
          const key = statusKey(meeting.status || meeting.approvalStatus);
          const room = rooms.find((item) => item.name?.toLowerCase() === meeting.room?.toLowerCase()) ||
            roomDefaults.find((item) => meeting.room?.toLowerCase().includes(item.name.toLowerCase())) || roomDefaults[0];
          const isExpanded = String(expandedId) === String(meeting.id);
          const end = meeting.end || meeting.endTime || "00:00";
          const canExtend = key === "approved" && isExtensionWindowOpen(meeting);
          const canRecommend = key === "rejected" || key === "cancelled";
          const submittedAt = meeting.createdAt;
          const changedAt = key === "rejected" ? meeting.rejectedAt : meeting.approvedAt || meeting.updatedAt;
          const statusText = {
            pending: "Menunggu Persetujuan Admin", approved: "Disetujui", rejected: "Ditolak",
            completed: "Selesai", cancelled: "Dibatalkan",
          }[key];
          return (
            <article className={`booking-history-card ${isExpanded ? "expanded" : ""}`} key={meeting.id}>
              <div className="booking-history-row">
                <button type="button" className="booking-history-expand" aria-expanded={isExpanded}
                  onClick={() => setExpandedId(isExpanded ? null : meeting.id)}>
                  <img className="booking-history-room-image" src={room.image || room.img || imgRuangRapatBesar} alt={meeting.room || "Ruangan"} />
                  <span className="booking-history-room-info">
                    <strong>{meeting.room || "Ruang Rapat"}</strong>
                    <small><FaMapMarkerAlt /> {room.location || "Lokasi ruangan"}</small>
                    <small><FaUsers /> Kapasitas {room.capacity || meeting.participants || "-"} Orang</small>
                    <span><FaCalendarAlt /> {formatDate(meeting.date, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</span>
                    <span><FaClock /> {meeting.start || meeting.startTime} - {end}</span>
                  </span>
                  <span className="booking-history-timeline">
                    <span className="booking-history-step done">
                      <i>✓</i><b>Diajukan</b><small>{formatStamp(submittedAt)}</small>
                    </span>
                    <i className={`booking-history-line ${key === "pending" ? "pending" : "done"}`} />
                    <span className={`booking-history-step ${key === "pending" ? "current" : key === "rejected" || key === "cancelled" ? "rejected" : "done"}`}>
                      <i>{key === "rejected" || key === "cancelled" ? "×" : key === "pending" ? "" : "✓"}</i>
                      <b>{key === "pending" ? "Menunggu Persetujuan" : key === "rejected" ? "Ditolak" : key === "cancelled" ? "Dibatalkan" : "Disetujui"}</b>
                      <small>{formatStamp(changedAt)}</small>
                    </span>
                    <i className={`booking-history-line ${key === "completed" ? "done" : ""}`} />
                    <span className={`booking-history-step ${key === "completed" ? "done" : ""}`}>
                      <i>{key === "completed" ? "✓" : ""}</i><b>Selesai</b>
                      <small>{key === "completed" ? `${formatDate(meeting.date, { day: "2-digit", month: "short", year: "numeric" })} ${end}` : "-"}</small>
                    </span>
                  </span>
                  <span className={`booking-history-status ${key}`}>{statusText}</span>
                  <FaChevronRight className="booking-history-chevron" />
                </button>
                {(canExtend || canRecommend) && (
                  <div className="booking-history-row-actions">
                    {canRecommend && (
                      <button type="button" className="booking-history-recommendation-button"
                        onClick={() => { setSelectedRecommendationSlots({}); setShowAllRecommendations(false); setRecommendationTarget(meeting); }}>
                        Lihat Rekomendasi <FaChevronRight />
                      </button>
                    )}
                    {canExtend && (
                      <button type="button" className="booking-history-add-time" onClick={() => { setNotice(""); setExtensionTarget(meeting); }}>
                        <FaPlus /> Tambah Waktu
                      </button>
                    )}
                  </div>
                )}
              </div>
              {isExpanded && (
                <div className="booking-history-details">
                  <span><strong>Agenda:</strong> {meeting.title || meeting.agenda || "-"}</span>
                  <span><strong>Bagian:</strong> {meeting.requester || meeting.bagian || "-"}</span>
                  <span><strong>Pemesan:</strong> {meeting.bookedBy || meeting.requester || "-"}</span>
                  <span><strong>Jumlah peserta:</strong> {meeting.participants || 0} orang</span>
                  {meeting.desc && <span><strong>Catatan:</strong> {meeting.desc}</span>}
                  {Array.isArray(meeting.extensionHistory) && meeting.extensionHistory.length > 0 && (
                    <span><strong>Tambahan waktu:</strong> {meeting.extensionHistory.map((item) => `+${item.hours} jam`).join(", ")}</span>
                  )}
                </div>
              )}
            </article>
          );
        }) : (
          <div className="booking-history-empty">Belum ada pemesanan yang cocok dengan filter.</div>
        )}
      </section>

      {notice && <div className="booking-history-notice" role="status">{notice}<button onClick={() => setNotice("")}>Tutup</button></div>}

      {extensionTarget && (
        <div className="booking-history-modal-backdrop" onClick={() => setExtensionTarget(null)}>
          <div className="booking-history-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="booking-history-modal-close" onClick={() => setExtensionTarget(null)} aria-label="Tutup">×</button>
            <h2>Tambah Waktu Booking</h2>
            <p>{extensionTarget.room} · {extensionTarget.start || extensionTarget.startTime}–{extensionTarget.end || extensionTarget.endTime}</p>
            <span>Pilih durasi tambahan. Waktu perpanjangan langsung ditambahkan setelah dipilih.</span>
            <div className="booking-history-extension-options">
              {[1, 2, 3, 4, 5].map((hours) => {
                const [hour, minute] = (extensionTarget.end || extensionTarget.endTime || "00:00").split(":").map(Number);
                const disabled = hour * 60 + minute + hours * 60 > 17 * 60 || !isExtensionWindowOpen(extensionTarget);
                return <button type="button" key={hours} disabled={disabled} onClick={() => extendMeeting(extensionTarget, hours)}>+{hours} jam</button>;
              })}
            </div>
            <small>Tambah waktu tersedia sejak rapat dimulai hingga 30 menit sebelum rapat selesai. Jam akhir maksimal pukul 17.00 WIB.</small>
          </div>
        </div>
      )}

      {extensionComplete && (
        <div className="booking-history-modal-backdrop" onClick={() => setExtensionComplete(null)}>
          <div className="booking-history-modal booking-history-extension-success" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="booking-history-modal-close" onClick={() => setExtensionComplete(null)} aria-label="Tutup">×</button>
            <span className="booking-history-extension-success-icon">✓</span>
            <h2>Waktu Rapat Berhasil Ditambahkan</h2>
            <p>{extensionComplete.meeting.room} berhasil diperpanjang {extensionComplete.hours} jam.</p>
            <strong>{extensionComplete.meeting.start || extensionComplete.meeting.startTime}–{extensionComplete.meeting.end}</strong>
            <button type="button" className="booking-history-extension-success-done" onClick={() => setExtensionComplete(null)}>Selesai</button>
          </div>
        </div>
      )}

      {recommendationTarget && (
        <div className="booking-recommendation-backdrop" onClick={() => setRecommendationTarget(null)}>
          <section className="booking-recommendation-modal" style={{
            width: recommendedRooms.length <= 1 ? "min(600px, calc(100vw - 40px))" : recommendedRooms.length === 2 ? "min(800px, calc(100vw - 40px))" : "min(1040px, calc(100vw - 40px))",
          }} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="booking-recommendation-close" onClick={() => setRecommendationTarget(null)} aria-label="Tutup">×</button>
            <div className="booking-recommendation-title">
              <span className="booking-recommendation-error">×</span>
              <div>
                <h2>{statusKey(recommendationTarget.status || recommendationTarget.approvalStatus) === "cancelled" ? "Pemesanan Ruang Rapat Dibatalkan" : "Pemesanan Ruang Rapat Ditolak"}</h2>
                <p>Pemesanan Anda untuk <strong>{recommendationTarget.room}</strong> pada {formatDate(recommendationTarget.date, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} pukul {recommendationTarget.start || recommendationTarget.startTime}–{recommendationTarget.end || recommendationTarget.endTime} tidak dapat digunakan.</p>
              </div>
            </div>
            <div className="booking-recommendation-reason">
              <strong>{statusKey(recommendationTarget.status || recommendationTarget.approvalStatus) === "cancelled" ? "Alasan Pembatalan" : "Alasan Penolakan"}</strong>
              <span>{recommendationTarget.rejectionReason || recommendationTarget.rejectReason || recommendationTarget.catatanPenolakan || recommendationTarget.cancellationReason || "Ruang tidak tersedia pada waktu yang dipilih karena sudah ada kegiatan lain."}</span>
            </div>
            <div className="booking-recommendation-heading">
              <span className="booking-recommendation-lightbulb">✦</span>
              <div><strong>Rekomendasi Ruangan Lain</strong><small>Isi jam mulai dan selesai sendiri. Jadwal yang sudah dipesan ditampilkan sebagai jam tidak tersedia.</small></div>
              {recommendedRooms.length > 3 && <button type="button" className="booking-recommendation-all" onClick={() => setShowAllRecommendations((value) => !value)}>
                {showAllRecommendations ? "Tampilkan Lebih Sedikit" : "Lihat Semua Ruangan"} <FaChevronRight />
              </button>}
            </div>
            {recommendedRooms.length ? (
              <div className="booking-recommendation-grid" style={{ "--recommendation-columns": Math.min(recommendedRooms.length, 3) }}>
                {(showAllRecommendations ? recommendedRooms : recommendedRooms.slice(0, 3)).map((room) => (
                  <article className="booking-recommendation-room" key={room.id || room.name}>
                    <div className="booking-recommendation-image-wrap">
                      <img src={room.image || room.img || room.images?.[0] || imgRuangRapatBesar} alt={room.name} />
                      <span>Tersedia</span>
                    </div>
                    <h3>{room.name}</h3>
                    <p><FaUsers /> Kapasitas: {room.capacity || "-"} Orang</p>
                    <p><FaMapMarkerAlt /> {room.location || "Lokasi ruangan"}</p>
                    <strong className="booking-recommendation-schedule-label">Jam Tidak Tersedia</strong>
                    <div className="booking-recommendation-slots">
                      {room.occupiedSlots.length ? room.occupiedSlots.map((slot, index) => (
                        <span key={`${slot.start}-${slot.end}-${index}`} title="Jam sudah dipesan"
                          aria-label={`Tidak tersedia, ${slot.start} sampai ${slot.end}`}
                          className="booking-recommendation-slot unavailable">
                          {slot.start} - {slot.end}
                        </span>
                      )) : <small className="booking-recommendation-no-bookings">Belum ada pemesanan pada hari ini.</small>}
                    </div>
                    <div className="booking-recommendation-custom-time">
                      <label>Mulai<input type="time" step="1800" value={selectedRecommendationSlots[room.name]?.start || ""}
                        onChange={(event) => setSelectedRecommendationSlots((current) => ({
                          ...current,
                          [room.name]: { ...(current[room.name] || {}), start: event.target.value },
                        }))} /></label>
                      <label>Selesai<input type="time" step="1800" value={selectedRecommendationSlots[room.name]?.end || ""}
                        onChange={(event) => setSelectedRecommendationSlots((current) => ({
                          ...current,
                          [room.name]: { ...(current[room.name] || {}), end: event.target.value },
                        }))} /></label>
                    </div>
                    {selectedRecommendationSlots[room.name]?.start && selectedRecommendationSlots[room.name]?.end &&
                      !isRecommendationTimeAvailable(room, selectedRecommendationSlots[room.name]) &&
                      <small className="booking-recommendation-time-error">Pilih jam tersedia dengan interval 30 menit (08.00–17.00).</small>}
                    <button type="button" className="booking-recommendation-book" onClick={() => {
                      const slot = selectedRecommendationSlots[room.name];
                      navigate("/booking", {
                      state: { bookingRecommendation: {
                        room: room.name,
                        image: room.image || room.img || room.images?.[0],
                        location: room.location,
                        capacity: room.capacity,
                        date: recommendationTarget.date,
                        start: slot.start,
                        end: slot.end,
                        title: recommendationTarget.title || recommendationTarget.agenda || "",
                        participants: recommendationTarget.participants || "",
                      } },
                      });
                    }} disabled={!isRecommendationTimeAvailable(room, selectedRecommendationSlots[room.name])}>
                      Booking Sekarang
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="booking-recommendation-empty">Tidak ada ruangan lain dengan kapasitas yang sesuai dan jadwal kosong pada tanggal ini.</div>
            )}
            <button type="button" className="booking-recommendation-done" onClick={() => setRecommendationTarget(null)}>Tutup</button>
          </section>
        </div>
      )}
    </main>
  );
}
