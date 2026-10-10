import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  FaCheckCircle,
  FaCalendarAlt,
  FaClock,
  FaMapMarkerAlt,
  FaUsers,
  FaUserCheck,
  FaQrcode,
  FaShareAlt,
  FaArrowLeft,
  FaCheck,
  FaSignOutAlt,
  FaInfoCircle,
  FaFileAlt,
  FaUserTie,
  FaBuilding,
} from "react-icons/fa";
import kemnakerLogo from "../assets/kemnaker-logo.png";
import "./MeetingPassPage.css";

export default function MeetingPassPage() {
  const { id } = useParams();
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  // Field Perwakilan (Khusus PIC)
  const [repName, setRepName] = useState("");

  // Form Presensi Peserta (Untuk Seluruh Peserta)
  const [attName, setAttName] = useState("");
  const [attDept, setAttDept] = useState("");
  const [attNip, setAttNip] = useState("");
  const [attNotes, setAttNotes] = useState("");
  const [submittingAtt, setSubmittingAtt] = useState(false);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadMeeting = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/dashboard/meetings/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.meeting) {
          setMeeting(data.meeting);
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.warn("Backend fetch failed, falling back to localStorage:", e);
    }

    try {
      const stored = JSON.parse(localStorage.getItem("app_meetings") || "[]");
      const found = stored.find(
        (m) => String(m.id) === String(id) || String(m.googleId) === String(id)
      );
      if (found) {
        setMeeting(found);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadMeeting();
    const interval = setInterval(loadMeeting, 10000);
    return () => clearInterval(interval);
  }, [loadMeeting]);

  // Handle Check-In Perwakilan
  const handleCheckIn = async () => {
    if (!meeting) return;
    const norm = (meeting.status || "").toLowerCase();
    if (norm.includes("menunggu") || norm === "pending") {
      showToast("Rapat belum disetujui oleh Pimpinan.", "error");
      return;
    }
    const actorName = repName.trim() || meeting.bookedBy || meeting.requester || "Perwakilan Rapat";
    setActionLoading(true);
    try {
      const res = await fetch(`/api/dashboard/meetings/${meeting.id}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ by: actorName }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.meeting) {
          setMeeting(data.meeting);
        }
      } else {
        const nowIso = new Date().toISOString();
        const updated = {
          ...meeting,
          status: "Berjalan",
          checkInAt: nowIso,
          checkedInBy: actorName,
        };
        setMeeting(updated);
        try {
          const stored = JSON.parse(localStorage.getItem("app_meetings") || "[]");
          const idx = stored.findIndex((m) => String(m.id) === String(meeting.id));
          if (idx !== -1) {
            stored[idx] = updated;
            localStorage.setItem("app_meetings", JSON.stringify(stored));
          }
        } catch (e) {}
      }
      showToast(`✓ Check-In berhasil! Sesi rapat kini berstatus Berjalan.`);
    } catch (err) {
      showToast("Gagal melakukan Check-In server, coba lagi.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Check-Out Perwakilan
  const handleCheckOut = async () => {
    if (!meeting) return;
    if (!window.confirm("Apakah Anda yakin ingin menyelesaikan sesi rapat ini (Check-Out)?")) {
      return;
    }
    const actorName = repName.trim() || meeting.bookedBy || meeting.requester || "Perwakilan Rapat";
    setActionLoading(true);
    try {
      const res = await fetch(`/api/dashboard/meetings/${meeting.id}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ by: actorName }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.meeting) {
          setMeeting(data.meeting);
        }
      } else {
        const nowIso = new Date().toISOString();
        const updated = {
          ...meeting,
          status: "Selesai",
          checkOutAt: nowIso,
          checkedOutBy: actorName,
        };
        setMeeting(updated);
        try {
          const stored = JSON.parse(localStorage.getItem("app_meetings") || "[]");
          const idx = stored.findIndex((m) => String(m.id) === String(meeting.id));
          if (idx !== -1) {
            stored[idx] = updated;
            localStorage.setItem("app_meetings", JSON.stringify(stored));
          }
        } catch (e) {}
      }
      showToast("✓ Check-Out berhasil! Sesi rapat telah ditandai Selesai.");
    } catch (err) {
      showToast("Gagal melakukan Check-Out server, coba lagi.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Presensi Peserta
  const handleSubmitAttendance = async (e) => {
    e.preventDefault();
    const norm = (meeting?.status || "").toLowerCase();
    if (norm.includes("menunggu") || norm === "pending") {
      showToast("Presensi belum dapat diisi karena rapat belum disetujui Pimpinan.", "error");
      return;
    }
    if (!attName.trim()) {
      alert("Mohon masukkan Nama Lengkap Anda.");
      return;
    }

    setSubmittingAtt(true);
    const newAttendee = {
      name: attName.trim(),
      dept: attDept.trim() || "-",
      nip: attNip.trim() || "-",
      notes: attNotes.trim() || "",
    };

    try {
      const res = await fetch(`/api/dashboard/meetings/${meeting.id}/attendees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAttendee),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.meeting) {
          setMeeting(data.meeting);
        }
      } else {
        const attendeeRecord = {
          id: "att_" + Date.now(),
          ...newAttendee,
          signedAt: new Date().toISOString(),
        };
        const updatedMeeting = {
          ...meeting,
          attendees: [...(meeting.attendees || []), attendeeRecord],
        };
        setMeeting(updatedMeeting);
        try {
          const stored = JSON.parse(localStorage.getItem("app_meetings") || "[]");
          const idx = stored.findIndex((m) => String(m.id) === String(meeting.id));
          if (idx !== -1) {
            stored[idx] = updatedMeeting;
            localStorage.setItem("app_meetings", JSON.stringify(stored));
          }
        } catch (e) {}
      }

      setAttName("");
      setAttDept("");
      setAttNip("");
      setAttNotes("");
      showToast("✓ Kehadiran Anda berhasil dicatat dalam Daftar Hadir!");
    } catch (err) {
      showToast("Gagal menyimpan presensi, silakan coba lagi.", "error");
    } finally {
      setSubmittingAtt(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    showToast("✓ Tautan presensi berhasil disalin!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: meeting?.title || "Presensi Rapat",
          text: `Presensi & Detil Rapat: ${meeting?.title} (${meeting?.room})`,
          url: window.location.href,
        });
      } catch (e) {}
    } else {
      handleCopyLink();
    }
  };

  if (loading) {
    return (
      <div className="mp-wrapper">
        <div style={{ padding: "80px 20px", textAlign: "center", color: "#64748b" }}>
          <div className="mp-spinner" />
          <p style={{ fontSize: "15px", fontWeight: 600, marginTop: "12px" }}>
            Memuat Data Detil Rapat...
          </p>
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="mp-wrapper">
        <div className="mp-container">
          <div className="mp-card" style={{ textAlign: "center", padding: "40px 24px" }}>
            <h2 style={{ color: "#0c2d5e", margin: "0 0 10px" }}>Rapat Tidak Ditemukan</h2>
            <p style={{ color: "#64748b", fontSize: "13px", margin: "0 0 20px" }}>
              Kode QR atau ID Rapat (<code>{id}</code>) tidak terdaftar dalam sistem.
            </p>
            <Link to="/" className="mp-btn-action primary" style={{ textDecoration: "none", display: "inline-flex" }}>
              <FaArrowLeft /> Kembali ke Beranda
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const normStatus = (meeting.status || "").toLowerCase();
  const isRunning = normStatus === "berjalan" || normStatus === "in_progress";
  const isUpcoming = normStatus === "akan datang" || normStatus === "disetujui" || normStatus === "upcoming";
  const isCompleted = normStatus === "selesai" || normStatus === "completed";
  const isPending = normStatus.includes("menunggu") || normStatus === "pending";

  const attendeesList = Array.isArray(meeting.attendees) ? meeting.attendees : [];
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="mp-wrapper">
      <div className="mp-container">
        {/* Top Navbar */}
        <header className="mp-topbar">
          <div className="mp-brand">
            <img src={kemnakerLogo} alt="Logo Kemnaker" className="mp-logo" />
            <div className="mp-brand-info">
              <h1>Kementerian Ketenagakerjaan</h1>
              <p>Biro Keuangan dan BMN · Kalender Ruang Rapat</p>
            </div>
          </div>
          <div className="mp-topbar-actions">
            <button
              type="button"
              className="mp-qr-toggle-btn"
              onClick={() => setShowQRModal(true)}
              title="Lihat Kode QR Rapat"
            >
              <FaQrcode />
              <span>Kode QR</span>
            </button>
            <Link to="/" className="mp-back-btn" title="Menuju Display TV">
              <FaArrowLeft />
              <span>Display TV</span>
            </Link>
          </div>
        </header>

        {/* ============================================================== */}
        {/* CARD 1: DETIL RAPAT (SESUAI DENGAN FORMAT TAMPILAN CONTOH USER) */}
        {/* ============================================================== */}
        <section className="mp-card mp-detil-card">
          <div className="mp-card-title-row">
            <h2 className="mp-detil-heading">Detil Rapat</h2>
            <div className="mp-live-pill-wrap">
              {isRunning && <span className="mp-status-pill live"><span className="pulse-dot" /> Berjalan (LIVE)</span>}
              {isUpcoming && <span className="mp-status-pill upcoming">⏳ Terjadwal</span>}
              {isCompleted && <span className="mp-status-pill done">✓ Selesai</span>}
              {isPending && <span className="mp-status-pill pending">Menunggu Approval</span>}
            </div>
          </div>

          {/* Banner Kuning: Presensi Aktif di Hari Kegiatan */}
          <div className="mp-presensi-banner">
            <span className="mp-banner-stripe" />
            <div className="mp-banner-content">
              <strong>Presensi Aktif di Hari Kegiatan</strong>
            </div>
          </div>

          {/* Tabel / Field Rincian Rapat Sesuai Sketsa */}
          <div className="mp-detil-table-wrap">
            <table className="mp-detil-table">
              <tbody>
                <tr>
                  <td className="mp-field-label">Judul Rapat</td>
                  <td className="mp-field-colon">:</td>
                  <td className="mp-field-value mp-field-title">
                    {(meeting.title || meeting.agenda || "SHARING SESSION IMPLEMENTASI PEMBAYARAN GAJI TERPUSAT").toUpperCase()}
                  </td>
                </tr>

                <tr>
                  <td className="mp-field-label">Sifat Rapat</td>
                  <td className="mp-field-colon">:</td>
                  <td className="mp-field-value">
                    <span className="mp-badge-nature">
                      {meeting.nature || meeting.sifat || "TERBUKA"}
                    </span>
                  </td>
                </tr>

                <tr>
                  <td className="mp-field-label">Pengelola Rapat</td>
                  <td className="mp-field-colon">:</td>
                  <td className="mp-field-value">
                    {meeting.requester || meeting.bagian || meeting.bookedBy || "Subbagian Akuntansi dan Pelaporan Keuangan II"}
                  </td>
                </tr>

                <tr>
                  <td className="mp-field-label">Tanggal dan Waktu</td>
                  <td className="mp-field-colon">:</td>
                  <td className="mp-field-value mp-field-date">
                    {meeting.date || "-"}
                  </td>
                </tr>

                <tr>
                  <td className="mp-field-label mp-field-label-top">Tempat (Ruangan)</td>
                  <td className="mp-field-colon mp-field-colon-top">:</td>
                  <td className="mp-field-value">
                    {/* Mini table: Tanggal | Waktu | Tempat */}
                    <div className="mp-schedule-table-container">
                      <table className="mp-schedule-table">
                        <thead>
                          <tr>
                            <th>Tanggal</th>
                            <th>Waktu</th>
                            <th>Tempat</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="nowrap">{meeting.date || "-"}</td>
                            <td className="nowrap">
                              {meeting.start || "09:00"} s/d {meeting.end || "17:00"}
                            </td>
                            <td>
                              <strong>{meeting.room || "Ruang Rapat"}</strong>
                              {meeting.location ? ` - ${meeting.location}` : ""}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td className="mp-field-label">Materi Rapat</td>
                  <td className="mp-field-colon">:</td>
                  <td className="mp-field-value mp-field-desc">
                    {meeting.desc || meeting.notes || "Materi dan paparan dibagikan saat sesi rapat berlangsung."}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ============================================================== */}
        {/* CARD 2: KONTROL RAPAT (CHECK-IN & CHECK-OUT UNTUK PERWAKILAN)    */}
        {/* ============================================================== */}
        <section className="mp-card mp-control-card">
          <div className="mp-section-head">
            <div className="mp-section-badge-group">
              <span className="mp-role-tag perwakilan">
                <FaUserTie /> Khusus Perwakilan / PIC
              </span>
              <h3 className="mp-section-title">Kontrol Sesi Rapat</h3>
            </div>
            <p className="mp-section-subtitle">
              Tombol <strong>Check-In</strong> dan <strong>Check-Out</strong> di bawah ini digunakan oleh <em>perwakilan rapat / penanggung jawab</em> untuk membuka dan mengakhiri sesi pemakaian ruangan secara resmi.
            </p>
          </div>

          {/* Form / Konfirmasi Identitas Perwakilan */}
          <div className="mp-rep-control-body">
            {!isCompleted && (
              <div className="mp-rep-input-row">
                <label htmlFor="repNameInput">Nama / Keterangan Perwakilan (PIC):</label>
                <input
                  id="repNameInput"
                  type="text"
                  className="mp-rep-input"
                  placeholder={`Contoh: ${meeting.bookedBy || meeting.requester || "Budi Santoso"} (PIC)`}
                  value={repName}
                  onChange={(e) => setRepName(e.target.value)}
                />
              </div>
            )}

            {/* Status Sesi Saat Ini */}
            <div className="mp-session-status-banner">
              {isRunning && (
                <div className="mp-status-box ongoing">
                  <FaCheckCircle className="icon" />
                  <div>
                    <strong>Sesi Rapat Sedang Berlangsung</strong>
                    <span>
                      {meeting.checkInAt
                        ? `Check-in pukul ${new Date(meeting.checkInAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB ${meeting.checkedInBy ? `oleh ${meeting.checkedInBy}` : ""}`
                        : "Sesi telah aktif di sistem kalender."}
                    </span>
                  </div>
                </div>
              )}

              {isPending && (
                <div className="mp-status-box waiting" style={{ borderColor: "#f59e0b", background: "rgba(245, 158, 11, 0.08)" }}>
                  <FaClock className="icon" style={{ color: "#d97706" }} />
                  <div>
                    <strong style={{ color: "#b45309" }}>Menunggu Persetujuan Pimpinan</strong>
                    <span>Pengajuan rapat ini belum disetujui. Check-in ruangan baru dapat dilakukan setelah disetujui oleh Pimpinan.</span>
                  </div>
                </div>
              )}

              {isUpcoming && (
                <div className="mp-status-box waiting">
                  <FaClock className="icon" />
                  <div>
                    <strong>Sesi Rapat Siap Dimulai</strong>
                    <span>Silakan perwakilan menekan tombol <strong>Check-In</strong> saat telah tiba di ruangan.</span>
                  </div>
                </div>
              )}

              {isCompleted && (
                <div className="mp-status-box completed">
                  <FaCheckCircle className="icon" />
                  <div>
                    <strong>Sesi Rapat Telah Selesai</strong>
                    <span>
                      {meeting.checkOutAt
                        ? `Check-out pada ${new Date(meeting.checkOutAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB ${meeting.checkedOutBy ? `oleh ${meeting.checkedOutBy}` : ""}`
                        : "Ruangan telah dikosongkan dan siap digunakan berikutnya."}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Tombol Aksi Check-In & Check-Out */}
            <div className="mp-control-btn-grid">
              <button
                type="button"
                className="mp-btn-action checkin-btn"
                onClick={handleCheckIn}
                disabled={actionLoading || isRunning || isCompleted || isPending}
                title={isPending ? "Rapat belum disetujui oleh Pimpinan" : isRunning ? "Rapat sudah berstatus Berjalan" : "Mulai sesi rapat sekarang"}
              >
                <FaCheck />
                <span>{actionLoading ? "Memproses..." : isPending ? "Menunggu Persetujuan" : isRunning ? "✓ Telah Check-In" : "Check-In (Mulai Rapat)"}</span>
              </button>

              <button
                type="button"
                className="mp-btn-action checkout-btn"
                onClick={handleCheckOut}
                disabled={actionLoading || !isRunning || isCompleted}
                title={!isRunning ? "Hanya aktif saat rapat sedang berjalan" : "Selesaikan sesi rapat"}
              >
                <FaSignOutAlt />
                <span>{actionLoading ? "Memproses..." : isCompleted ? "✓ Telah Selesai" : "Check-Out (Selesai Rapat)"}</span>
              </button>
            </div>
          </div>
        </section>

        {/* ============================================================== */}
        {/* CARD 3: DAFTAR HADIR / PRESENSI (UNTUK SEMUA PESERTA RAPAT)    */}
        {/* ============================================================== */}
        <section className="mp-card mp-attendance-card">
          <div className="mp-section-head">
            <div className="mp-section-badge-group">
              <span className="mp-role-tag peserta">
                <FaUsers /> Untuk Semua Peserta
              </span>
              <h3 className="mp-section-title">Daftar Hadir / Presensi Rapat</h3>
            </div>
            <p className="mp-section-subtitle">
              Seluruh peserta yang mengikuti rapat wajib mengisi formulir presensi digital di bawah ini sebagai bukti kehadiran kegiatan.
            </p>
          </div>

          {/* Form Input Presensi Peserta */}
          <form onSubmit={handleSubmitAttendance} className="mp-attendance-form">
            <div className="mp-form-header">
              <FaUserCheck className="form-icon" />
              <strong>Formulir Kehadiran Peserta</strong>
            </div>

            <div className="mp-form-grid">
              <div className="mp-input-group">
                <label>Nama Lengkap <span className="req">*</span></label>
                <input
                  type="text"
                  className="mp-text-input"
                  placeholder="Contoh: Siti Rahmawati, S.E."
                  value={attName}
                  onChange={(e) => setAttName(e.target.value)}
                  required
                />
              </div>

              <div className="mp-input-group">
                <label>Unit Kerja / Instansi <span className="req">*</span></label>
                <input
                  type="text"
                  className="mp-text-input"
                  placeholder="Contoh: Biro Keuangan dan BMN"
                  value={attDept}
                  onChange={(e) => setAttDept(e.target.value)}
                  required
                />
              </div>

              <div className="mp-input-group">
                <label>NIP / Jabatan (Opsional)</label>
                <input
                  type="text"
                  className="mp-text-input"
                  placeholder="Contoh: 19890412... / Pengelola BMN"
                  value={attNip}
                  onChange={(e) => setAttNip(e.target.value)}
                />
              </div>

              <div className="mp-input-group">
                <label>Catatan / Keterangan (Opsional)</label>
                <input
                  type="text"
                  className="mp-text-input"
                  placeholder="Contoh: Hadir mendampingi pimpinan"
                  value={attNotes}
                  onChange={(e) => setAttNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="mp-form-submit-row">
              <button
                type="submit"
                className="mp-submit-att-btn"
                disabled={submittingAtt || isPending || isCompleted}
                title={isPending ? "Presensi belum dibuka (Menunggu persetujuan pimpinan)" : isCompleted ? "Rapat telah selesai" : undefined}
              >
                <FaCheck />
                <span>{submittingAtt ? "Mencatat Kehadiran..." : isPending ? "Presensi Belum Dibuka" : isCompleted ? "Rapat Selesai" : "Kirim Presensi Kehadiran"}</span>
              </button>
            </div>
          </form>

          {/* Tabel / Daftar Peserta yang Sudah Hadir */}
          <div className="mp-attendance-list-section">
            <div className="mp-att-header-row">
              <h4 className="mp-att-list-title">
                Daftar Peserta Hadir
              </h4>
              <span className="mp-att-counter-badge">
                Total Hadir: {attendeesList.length} Orang
              </span>
            </div>

            {attendeesList.length === 0 ? (
              <div className="mp-att-empty-box">
                <FaFileAlt size={28} className="empty-icon" />
                <p>Belum ada peserta yang mengisi presensi.</p>
                <small>Silakan isi formulir di atas untuk mencatatkan kehadiran Anda.</small>
              </div>
            ) : (
              <div className="mp-att-table-wrapper">
                <table className="mp-att-table">
                  <thead>
                    <tr>
                      <th style={{ width: "36px", textAlign: "center" }}>No</th>
                      <th>Nama Peserta</th>
                      <th>Unit Kerja / Instansi</th>
                      <th>NIP / Jabatan</th>
                      <th style={{ width: "100px", textAlign: "center" }}>Waktu Hadir</th>
                      <th style={{ width: "80px", textAlign: "center" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendeesList.map((att, idx) => {
                      const timeStr = att.signedAt
                        ? new Date(att.signedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
                        : "-";
                      return (
                        <tr key={att.id || idx}>
                          <td style={{ textAlign: "center", color: "#64748b" }}>{idx + 1}</td>
                          <td>
                            <strong className="att-name">{att.name}</strong>
                            {att.notes ? <div className="att-notes">{att.notes}</div> : null}
                          </td>
                          <td className="att-dept">{att.dept || "-"}</td>
                          <td className="att-nip">{att.nip || "-"}</td>
                          <td style={{ textAlign: "center", fontSize: "12px", color: "#475569" }}>{timeStr} WIB</td>
                          <td style={{ textAlign: "center" }}>
                            <span className="att-badge-done">✓ Hadir</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Footer & Share Bar */}
        <footer className="mp-footer-bar">
          <div className="mp-footer-links">
            <button type="button" className="mp-footer-btn" onClick={handleShare}>
              <FaShareAlt /> Bagikan Presensi
            </button>
            <button type="button" className="mp-footer-btn" onClick={handleCopyLink}>
              {copied ? "✓ Link Disalin" : "Salin Link"}
            </button>
            <button type="button" className="mp-footer-btn" onClick={() => setShowQRModal(true)}>
              <FaQrcode /> QR Rapat
            </button>
          </div>
          <p className="mp-footer-credit">
            Kementerian Ketenagakerjaan Republik Indonesia · Biro Keuangan dan BMN
          </p>
        </footer>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`mp-toast ${toast.type}`}>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Modal QR Code Pop-up */}
      {showQRModal && (
        <div className="mp-modal-backdrop" onClick={() => setShowQRModal(false)}>
          <div className="mp-modal-box" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="mp-modal-close-btn"
              onClick={() => setShowQRModal(false)}
              aria-label="Tutup Modal"
            >
              ×
            </button>

            <h3 className="mp-modal-title">QR Code Presensi Rapat</h3>
            <p className="mp-modal-subtitle">
              Pindai dengan kamera smartphone untuk membuka halaman presensi &amp; detil rapat ini.
            </p>

            <div className="mp-modal-qr-wrap">
              <QRCodeSVG
                value={currentUrl}
                size={220}
                level="H"
                marginSize={2}
                bgColor="#ffffff"
                fgColor="#0c2d5e"
              />
            </div>

            <div className="mp-modal-meeting-info">
              <strong>{meeting.title || "Rapat"}</strong>
              <span>{meeting.room} · {meeting.date} ({meeting.start}–{meeting.end})</span>
            </div>

            <div className="mp-modal-actions">
              <button
                type="button"
                className="mp-btn-action primary"
                onClick={handleCopyLink}
              >
                {copied ? "✓ Link Tersalin!" : "Salin Tautan Presensi"}
              </button>
              <button
                type="button"
                className="mp-btn-action light"
                onClick={() => window.print()}
              >
                Cetak Halaman
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
