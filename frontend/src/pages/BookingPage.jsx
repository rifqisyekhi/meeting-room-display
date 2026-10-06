import React, { useState } from "react";
import { CiClock2 } from "react-icons/ci";
import {
  FaUserFriends,
  FaMapMarkerAlt,
  FaRegCalendarAlt,
  FaRegClock,
  FaRegListAlt,
  FaRegBuilding,
  FaUsers,
  FaChevronLeft,
  FaChevronRight,
  FaInfoCircle,
  FaCheckCircle,
  FaPlug,
  FaSearchPlus,
} from "react-icons/fa";
import { MdMic, MdOutlineCable } from "react-icons/md";
import { TbAirConditioning } from "react-icons/tb";
import { GrGroup } from "react-icons/gr";
import { PiMonitor } from "react-icons/pi";
import { HiSpeakerWave } from "react-icons/hi2";
import { IoWaterSharp } from "react-icons/io5";
import { IoLogoWhatsapp } from "react-icons/io";
import "./BookingPage.css";
import logo from "../assets/Logo Kemenaker White.png";
import imgRuangRapatBesar from "../assets/Ruang Rapat Besar.jpeg";
import imgRuangKonsultasi from "../assets/Ruang Konsultasi.jpeg";

const initialMeetings = [
  {
    id: 1,
    title: "Rapat Koordinasi Biro Keuangan",
    requester: "Andi Pratama",
    room: "Ruang Rapat Besar",
    date: "2026-09-22",
    start: "08:00",
    end: "10:00",
    status: "Berjalan",
    participants: 12,
    desc: "Pembahasan laporan keuangan dan evaluasi program.",
  },
];

const defaultRooms = [
  {
    id: "R1",
    name: "Ruang Rapat Besar",
    capacity: 20,
    location: "Gedung A - Lantai 3",
    category: "Ruang Besar",
    img: imgRuangRapatBesar,
    images: [imgRuangRapatBesar],
    desc: "Ruang rapat representatif berkapasitas besar yang dilengkapi sistem multimedia modern, Smart TV 85 inch, proyektor, serta sound system berkualitas. Cocok untuk rapat koordinasi skala besar, pemaparan program, dan evaluasi lintas bagian.",
    facilities: [
      { label: "Kapasitas", value: "46" },
      { label: "TV", value: "Smart TV 85 inch" },
      { label: "AC", value: "Tersedia" },
      { label: "Microphone", value: "Tersedia 6 mic" },
      { label: "Speaker", value: "Tersedia" },
      { label: "Dispenser", value: "Tersedia" },
      { label: "Stopkontak", value: "Tersedia" },
      { label: "Kabel", value: "HDMI" },
    ],
  },
  {
    id: "R2",
    name: "Ruang Konsultasi",
    capacity: 20,
    location: "Gedung A - Lantai 3",
    category: "Ruang Konsultasi",
    img: imgRuangKonsultasi,
    images: [imgRuangKonsultasi],
    desc: "Ruang pertemuan privat dan kondusif untuk diskusi terfokus, konsultasi perbendaharaan, layanan BMN, serta koordinasi tim kerja dengan fasilitas Smart TV 60 inch dan whiteboard.",
    facilities: [
      { label: "Kapasitas", value: "7" },
      { label: "TV", value: "Smart TV 60 inch" },
      { label: "AC", value: "Tersedia" },
      { label: "Microphone", value: "Tidak Tersedia" },
      { label: "Speaker", value: "Tidak Tersedia" },
      { label: "Dispenser", value: "Tidak Tersedia" },
      { label: "Stopkontak", value: "Tersedia" },
      { label: "Kabel", value: "HDMI" },
    ],
  },
];

const unavailableSlots = ["08:00 - 10:00", "10:00 - 12:00"];

// Facility Icon Renderer using the user-specified icon components
const FacilityIcon = ({ type }) => {
  const norm = (type || "").toLowerCase();
  if (norm.includes("kapasitas")) {
    return <GrGroup className="bk-facility-icon" />;
  }
  if (norm.includes("tv")) {
    return <PiMonitor className="bk-facility-icon" />;
  }
  if (norm.includes("ac")) {
    return <TbAirConditioning className="bk-facility-icon" />;
  }
  if (norm.includes("mic")) {
    return <MdMic className="bk-facility-icon" />;
  }
  if (norm.includes("speaker")) {
    return <HiSpeakerWave className="bk-facility-icon" />;
  }
  if (norm.includes("dispenser")) {
    return <IoWaterSharp className="bk-facility-icon" />;
  }
  if (
    norm.includes("stopkontak") ||
    norm.includes("stop kontak") ||
    norm.includes("plug") ||
    norm.includes("outlet")
  ) {
    return <FaPlug className="bk-facility-icon" />;
  }
  if (norm.includes("kabel") || norm.includes("cable")) {
    return <MdOutlineCable className="bk-facility-icon" />;
  }
  return <GrGroup className="bk-facility-icon" />;
};

export default function BookingPage() {
  const [selectedCategory, setSelectedCategory] = useState("Semua");
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedDate, setSelectedDate] = useState("2026-09-23");
  const [selectedTime, setSelectedTime] = useState(null);

  // Time picker state: start & end hours (numpad input) & minutes (00 / 30)
  const [startHour, setStartHour] = useState("00");
  const [startMinute, setStartMinute] = useState("00");
  const [endHour, setEndHour] = useState("00");
  const [endMinute, setEndMinute] = useState("00");

  const [agenda, setAgenda] = useState("");
  const [bagian, setBagian] = useState("");
  const [customBagian, setCustomBagian] = useState("");
  const [peserta, setPeserta] = useState("");

  // Modal notification state, facility modal state & room detail modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [bookedDetails, setBookedDetails] = useState(null);
  const [selectedFacilityRoom, setSelectedFacilityRoom] = useState(null);
  const [selectedRoomDetail, setSelectedRoomDetail] = useState(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  // Desktop: derived step for blur; Mobile: explicit step navigation
  const currentStep = showSuccessModal
    ? 4
    : selectedRoom
      ? selectedDate && selectedTime
        ? 3
        : 2
      : 1;
  const [mobileStep, setMobileStep] = useState(1); // 1, 2, 3

  const days = [
    { day: "Senin", date: "21", full: "2026-09-21" },
    { day: "Selasa", date: "22", full: "2026-09-22" },
    { day: "Rabu", date: "23", full: "2026-09-23" },
    { day: "Kamis", date: "24", full: "2026-09-24" },
    { day: "Jumat", date: "25", full: "2026-09-25" },
  ];

  const updateTimes = (sh, sm, eh, em) => {
    setStartHour(sh);
    setStartMinute(sm);
    setEndHour(eh);
    setEndMinute(em);

    if (sh && sh !== "00" && eh && eh !== "00") {
      const s = `${sh}:${sm}`;
      const e = `${eh}:${em}`;
      setSelectedTime(`${s} - ${e}`);
    } else {
      setSelectedTime(null);
    }
  };

  const handleStartHourInput = (val) => {
    const cleaned = val.replace(/\D/g, "").slice(0, 2);
    let finalVal = cleaned;
    if (Number(cleaned) > 23) finalVal = "23";
    setStartHour(finalVal);

    if (
      finalVal.length === 2 ||
      (finalVal.length === 1 && Number(finalVal) > 2)
    ) {
      const formatted = finalVal.padStart(2, "0");
      updateTimes(formatted, startMinute, endHour, endMinute);
    } else if (finalVal === "") {
      updateTimes("00", startMinute, endHour, endMinute);
    }
  };

  const handleStartHourBlur = () => {
    if (startHour && startHour !== "00") {
      const formatted = String(
        Math.min(23, Math.max(0, Number(startHour))),
      ).padStart(2, "0");
      updateTimes(formatted, startMinute, endHour, endMinute);
    } else {
      setStartHour("00");
      updateTimes("00", startMinute, endHour, endMinute);
    }
  };

  const handleEndHourInput = (val) => {
    const cleaned = val.replace(/\D/g, "").slice(0, 2);
    let finalVal = cleaned;
    if (Number(cleaned) > 23) finalVal = "23";
    setEndHour(finalVal);

    if (
      finalVal.length === 2 ||
      (finalVal.length === 1 && Number(finalVal) > 2)
    ) {
      const formatted = finalVal.padStart(2, "0");
      updateTimes(startHour, startMinute, formatted, endMinute);
    } else if (finalVal === "") {
      updateTimes(startHour, startMinute, "00", endMinute);
    }
  };

  const handleEndHourBlur = () => {
    if (endHour && endHour !== "00") {
      const formatted = String(
        Math.min(23, Math.max(0, Number(endHour))),
      ).padStart(2, "0");
      updateTimes(startHour, startMinute, formatted, endMinute);
    } else {
      setEndHour("00");
      updateTimes(startHour, startMinute, "00", endMinute);
    }
  };

  const handleStartMinute = (val) => {
    updateTimes(startHour, val, endHour, endMinute);
  };

  const handleEndMinute = (val) => {
    updateTimes(startHour, startMinute, endHour, val);
  };

  const selectedDayObj = days.find((d) => d.full === selectedDate);
  const formattedDateString = selectedDayObj
    ? `${selectedDayObj.day}, ${selectedDayObj.date} September 2026`
    : selectedDate;

  const handleBooking = () => {
    const finalBagian = bagian === "Other" ? customBagian.trim() : bagian;
    if (
      !agenda ||
      !finalBagian ||
      !peserta ||
      !selectedRoom ||
      !selectedDate ||
      !selectedTime
    ) {
      if (bagian === "Other" && !customBagian.trim()) {
        alert("Mohon masukkan nama bagian Anda!");
      } else {
        alert("Mohon lengkapi semua data!");
      }
      return;
    }

    let start = `${startHour}:${startMinute}`;
    let end = `${endHour}:${endMinute}`;
    if (selectedTime && selectedTime.includes(" - ")) {
      const parts = selectedTime.split(" - ");
      start = parts[0].trim();
      end = parts[1].trim();
    }

    const nowIso = new Date().toISOString();
    const newMeeting = {
      id: Date.now(),
      title: agenda,
      requester: finalBagian,
      room: selectedRoom?.name,
      date: selectedDate,
      start,
      end,
      status: "Menunggu Approval",
      participants: parseInt(peserta) || 0,
      desc: agenda,
      createdAt: nowIso,
    };
    let currentMeetings = [];
    try {
      const stored = localStorage.getItem("app_meetings");
      currentMeetings = stored ? JSON.parse(stored) : initialMeetings;
      if (!Array.isArray(currentMeetings)) currentMeetings = initialMeetings;
    } catch (e) {
      currentMeetings = initialMeetings;
    }
    currentMeetings.push(newMeeting);
    localStorage.setItem("app_meetings", JSON.stringify(currentMeetings));

    // Tambahkan notifikasi ke antrean untuk Dashboard Admin & Akun Approval
    try {
      const storedNotifs = JSON.parse(
        localStorage.getItem("app_notifications") || "[]",
      );
      const newNotif = {
        id: newMeeting.id,
        meetingId: newMeeting.id,
        type: "NEW_REQUEST",
        title: "Permintaan Booking Ruang Rapat",
        message: `${finalBagian} mengajukan permohonan peminjaman ${selectedRoom?.name} untuk agenda "${agenda}"`,
        room: selectedRoom?.name,
        requester: finalBagian,
        date: selectedDate,
        time: `${start} - ${end}`,
        agenda: agenda,
        createdAt: nowIso,
        readBy: [],
        status: "Menunggu Approval",
      };
      storedNotifs.unshift(newNotif);
      localStorage.setItem("app_notifications", JSON.stringify(storedNotifs));
      window.dispatchEvent(new Event("app_notifications_updated"));
      try {
        if (window.parent && window.parent !== window) {
          window.parent.dispatchEvent(new Event("app_notifications_updated"));
        }
      } catch (err) {}
    } catch (e) {}

    // Simpan rincian untuk ditampilkan pada modal konfirmasi sukses
    const displayTimeString = selectedTime
      ? selectedTime.replace(/:/g, ".")
      : `${start.replace(/:/g, ".")} - ${end.replace(/:/g, ".")}`;

    setBookedDetails({
      roomName: selectedRoom?.name,
      bagian: finalBagian,
      dateString: formattedDateString,
      timeString: displayTimeString,
      agenda: agenda,
      participants: peserta,
    });

    // Buka popup modal konfirmasi
    setShowSuccessModal(true);
  };

  const handleFinishBooking = () => {
    // Tutup modal dan reset semua state kembali ke langkah pertama
    setShowSuccessModal(false);
    setBookedDetails(null);
    setSelectedRoom(null);
    setSelectedDate("2026-09-23");
    setSelectedTime(null);
    setStartHour("00");
    setStartMinute("00");
    setEndHour("00");
    setEndMinute("00");
    setAgenda("");
    setBagian("");
    setCustomBagian("");
    setPeserta("");
    setMobileStep(1);
  };

  const getRoomsList = () => {
    try {
      const stored = localStorage.getItem("app_rooms");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((r, idx) => {
            const defaultItem =
              defaultRooms.find(
                (dr) => dr.name.toLowerCase() === (r.name || "").toLowerCase(),
              ) ||
              defaultRooms[idx % defaultRooms.length] ||
              {};
            const imgs =
              Array.isArray(r.images) && r.images.length > 0
                ? r.images
                : [r.image || defaultItem.img || imgRuangRapatBesar];
            return {
              ...defaultItem,
              ...r,
              id: r.id || defaultItem.id || `R_${idx}`,
              name: r.name || defaultItem.name,
              capacity: r.capacity || defaultItem.capacity || 20,
              location:
                r.location || defaultItem.location || "Gedung A - Lantai 3",
              category: (r.name || "").toLowerCase().includes("konsultasi")
                ? "Ruang Konsultasi"
                : "Ruang Besar",
              img: imgs[0],
              images: imgs,
              facilities: defaultItem.facilities || [
                { label: "Kapasitas", value: String(r.capacity || 20) },
                { label: "TV", value: "Smart TV" },
                { label: "AC", value: "Tersedia" },
              ],
            };
          });
        }
      }
    } catch (e) {}
    return defaultRooms.map((r) => ({
      ...r,
      images: Array.isArray(r.images) && r.images.length > 0 ? r.images : [r.img],
    }));
  };

  const allRooms = getRoomsList();
  const filteredRooms =
    selectedCategory === "Semua"
      ? allRooms
      : allRooms.filter((r) => r.category === selectedCategory);

  // Mobile: handle room selection + auto advance
  const handleSelectRoom = (room) => {
    setSelectedRoom(room);
    setMobileStep(2);
  };

  // ---- Shared column content (rendered both desktop & mobile) ----
  const colRoom = (
    <>
      <h2 className="bk-col-title">PILIH RUANG RAPAT</h2>
      <div className="bk-tags">
        {["Semua", "Ruang Besar", "Ruang Konsultasi"].map((cat) => (
          <button
            key={cat}
            className={`bk-tag ${selectedCategory === cat ? "active" : ""}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="bk-room-list">
        {filteredRooms.map((room) => (
          <div
            key={room.id}
            className={`bk-room-card ${selectedRoom?.id === room.id ? "active" : ""}`}
            onClick={() => handleSelectRoom(room)}
          >
            <div
              className="bk-room-img-wrapper"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedRoomDetail(room);
                setActivePhotoIndex(0);
              }}
              title="Klik gambar untuk melihat detail view ruangan"
            >
              <img src={room.img} alt={room.name} className="bk-room-img" />
              {room.images && room.images.length > 1 && (
                <span className="bk-room-img-badge-count">
                  {room.images.length} View
                </span>
              )}
              <div className="bk-room-img-zoom-badge">
                <FaSearchPlus />
              </div>
            </div>
            <div className="bk-room-info">
              <div className="bk-room-header-row">
                <h3>{room.name}</h3>
              </div>
              <div className="bk-room-meta">
                <FaUserFriends className="bk-icon" /> Kapasitas :{" "}
                {room.capacity} Orang
              </div>
              <button
                type="button"
                className="bk-btn-facility"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFacilityRoom(room);
                }}
              >
                <FaInfoCircle className="bk-btn-facility-icon" /> Fasilitas
              </button>
            </div>
            <div className="bk-room-arrow">
              <FaChevronRight />
            </div>
          </div>
        ))}

        {/* Informasi & Ketentuan Peminjaman Ruangan */}
        <div className="bk-room-info-card">
          <div className="bk-rinfo-title">
            <FaInfoCircle className="bk-rinfo-icon" />
            <span>Ketentuan Peminjaman Ruang Rapat:</span>
          </div>
          <ul className="bk-rinfo-list">
            <li>Pilih ruangan sesuai dengan kapasitas peserta rapat.</li>
            <li>
              Pemesanan ruangan diverifikasi oleh Administrator Biro Keuangan
              &amp; BMN.
            </li>
            <li>Jam operasional pemakaian ruangan pukul 08:00 – 17:00 WIB.</li>
          </ul>
        </div>
      </div>
    </>
  );

  const colDateTime = (
    <>
      <h2 className="bk-col-title">PILIH TANGGAL &amp; WAKTU</h2>
      <div className="bk-datetime-scroll">
        <div className="bk-month-selector">
          <h4>September 2026</h4>
          <div className="bk-days-row">
            <FaChevronLeft className="bk-nav-icon" />
            {days.map((d) => (
              <div
                key={d.full}
                className={`bk-day-box ${selectedDate === d.full ? "active" : ""}`}
                onClick={() => setSelectedDate(d.full)}
              >
                <span className="bk-day-name">{d.day}</span>
                <span className="bk-day-num">{d.date}</span>
              </div>
            ))}
            <FaChevronRight className="bk-nav-icon" />
          </div>
        </div>

        <div className="bk-time-selector">
          {/* Horizontal indicator line 1 */}
          <div className="bk-indicator-line"></div>

          {/* Date and legend */}
          <div className="bk-time-header">
            <span className="bk-selected-date-text">{formattedDateString}</span>
            <div className="bk-legend">
              <span className="bk-leg-item">
                <span className="bk-dot green"></span>Tersedia
              </span>
              <span className="bk-leg-item">
                <span className="bk-dot gray"></span>Tidak Tersedia
              </span>
              <span className="bk-leg-item">
                <span className="bk-dot blue"></span>Dipilih
              </span>
            </div>
          </div>

          {/* Time Picker Boxes: Mulai & Selesai (Hour via numpad, Minute via 00 / 30) */}
          <div className="bk-time-boxes">
            {/* Box Mulai */}
            <div className="bk-time-box">
              <div className="bk-clock-icon">
                <CiClock2 className="bk-ci-clock" />
              </div>
              <div className="bk-time-content">
                <span className="bk-time-label">Mulai</span>
                <div className="bk-time-inputs">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={2}
                    className="bk-input-time"
                    value={startHour}
                    onChange={(e) => handleStartHourInput(e.target.value)}
                    onBlur={handleStartHourBlur}
                    onFocus={(e) => e.target.select()}
                    title="Ketik jam mulai dengan numpad (00-23)"
                    placeholder="00"
                  />
                  <span className="bk-time-colon">:</span>
                  <select
                    className="bk-select-time"
                    value={startMinute}
                    onChange={(e) => handleStartMinute(e.target.value)}
                    title="Pilih menit (00 atau 30)"
                  >
                    <option value="00">00</option>
                    <option value="30">30</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Box Selesai */}
            <div className="bk-time-box">
              <div className="bk-clock-icon">
                <CiClock2 className="bk-ci-clock" />
              </div>
              <div className="bk-time-content">
                <span className="bk-time-label">Selesai</span>
                <div className="bk-time-inputs">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={2}
                    className="bk-input-time"
                    value={endHour}
                    onChange={(e) => handleEndHourInput(e.target.value)}
                    onBlur={handleEndHourBlur}
                    onFocus={(e) => e.target.select()}
                    title="Ketik jam selesai dengan numpad (00-23)"
                    placeholder="00"
                  />
                  <span className="bk-time-colon">:</span>
                  <select
                    className="bk-select-time"
                    value={endMinute}
                    onChange={(e) => handleEndMinute(e.target.value)}
                    title="Pilih menit (00 atau 30)"
                  >
                    <option value="00">00</option>
                    <option value="30">30</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Horizontal indicator line 2 */}
          <div className="bk-indicator-line"></div>

          {/* Section: Jam tidak tersedia */}
          <h3 className="bk-unavailable-title">Jam tidak tersedia</h3>
          <div className="bk-unavailable-grid">
            {unavailableSlots.map((slot) => (
              <div
                key={slot}
                className="bk-unavail-slot"
                title="Jam ini tidak tersedia"
                onClick={() =>
                  alert(
                    `Jam ${slot} tidak tersedia karena ruangan sedang digunakan.`,
                  )
                }
              >
                {slot}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  const colDetail = (
    <>
      <h2 className="bk-col-title">DETAIL PEMESANAN</h2>
      <div className="bk-detail-card">
        <div className="bk-detail-room">
          <div
            className="bk-detail-img-wrapper"
            onClick={(e) => {
              if (selectedRoom) {
                e.stopPropagation();
                setSelectedRoomDetail(selectedRoom);
              }
            }}
            title="Klik gambar untuk melihat detail ruangan"
          >
            <img src={selectedRoom?.img} alt={selectedRoom?.name} />
            <div className="bk-room-img-zoom-badge small">
              <FaSearchPlus />
            </div>
          </div>
          <div>
            <h3>{selectedRoom?.name}</h3>
            <div className="bk-room-meta">
              <FaUserFriends className="bk-icon" /> Kapasitas :{" "}
              {selectedRoom?.capacity} Orang
            </div>
            <div className="bk-room-meta">
              <FaMapMarkerAlt className="bk-icon" /> {selectedRoom?.location}
            </div>
          </div>
        </div>
        <div className="bk-detail-datetime">
          <div>
            <FaRegCalendarAlt className="bk-icon-dark" /> <span>Tanggal</span>
          </div>
          <div className="bk-val">{formattedDateString}</div>
          <div>
            <FaRegClock className="bk-icon-dark" /> <span>Waktu</span>
          </div>
          <div className="bk-val">{selectedTime ? selectedTime : "-"}</div>
        </div>
        <div className="bk-form">
          <div className="bk-form-group">
            <label>
              <FaRegListAlt className="bk-icon-dark" /> Agenda Rapat
            </label>
            <textarea
              placeholder="Masukkan agenda rapat..."
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
            ></textarea>
          </div>
          <div className="bk-form-group">
            <label>
              <FaRegBuilding className="bk-icon-dark" /> Bagian
            </label>
            <select
              value={bagian}
              onChange={(e) => {
                setBagian(e.target.value);
                if (e.target.value !== "Other") {
                  setCustomBagian("");
                }
              }}
            >
              <option value="" disabled>
                Pilih bagian
              </option>
              <option value="TU">TU</option>
              <option value="AKLAP">AKLAP</option>
              <option value="BMN">BMN</option>
              <option value="PA">PA</option>
              <option value="PTUK">PTUK</option>
              <option value="Other">Other</option>
            </select>
            {bagian === "Other" && (
              <input
                type="text"
                className="bk-input-custom-bagian"
                placeholder="Ketik nama bagian Anda..."
                value={customBagian}
                onChange={(e) => setCustomBagian(e.target.value)}
                autoFocus
              />
            )}
          </div>
          <div className="bk-form-group inline">
            <label>
              <FaUsers className="bk-icon-dark" /> Jumlah Peserta
            </label>
            <div className="bk-input-row">
              <input
                type="number"
                placeholder="Masukkan jumlah peserta"
                value={peserta}
                onChange={(e) => setPeserta(e.target.value)}
              />
              <span>Orang</span>
            </div>
          </div>
          <button className="bk-submit-btn" onClick={handleBooking}>
            Booking Sekarang
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="bk-container">
      {/* Header */}
      <header className="bk-header">
        <div className="bk-logo-area">
          <div className="bk-logo-left">
            <img src={logo} alt="Logo" className="bk-logo" />
            <span className="bk-logo-text">BIRO KEUANGAN DAN BMN</span>
          </div>
          <a
            href="http://wa.me/+6285122777026"
            target="_blank"
            rel="noopener noreferrer"
            className="bk-header-wa-btn"
            title="Hubungi Bantuan via WhatsApp"
          >
            <IoLogoWhatsapp className="bk-header-wa-icon" />
            <span>Hubungi Bantuan</span>
          </a>
        </div>
        <div className="bk-header-content">
          <h1>BOOKING RUANG RAPAT</h1>
          <p>
            Pesan Ruang Rapat sesuai kebutuhan Anda
            <br />
            dengan mudah dan cepat.
          </p>
        </div>
      </header>

      {/* Stepper */}
      <div className="bk-stepper">
        <div
          className={`bk-step ${currentStep >= 1 ? "active" : ""} ${mobileStep >= 1 ? "mobile-active" : ""}`}
          onClick={() => setMobileStep(1)}
        >
          <span className="step-num">1</span>{" "}
          <span className="step-label">Pilih Ruangan</span>
        </div>
        <div className="bk-line"></div>
        <div
          className={`bk-step ${currentStep >= 2 ? "active" : ""} ${mobileStep >= 2 ? "mobile-active" : ""}`}
          onClick={() => {
            if (selectedRoom) setMobileStep(2);
          }}
        >
          <span className="step-num">2</span>{" "}
          <span className="step-label">Pilih Tanggal &amp; Waktu</span>
        </div>
        <div className="bk-line"></div>
        <div
          className={`bk-step ${currentStep >= 3 ? "active" : ""} ${mobileStep >= 3 ? "mobile-active" : ""}`}
          onClick={() => {
            if (selectedRoom && selectedDate && selectedTime) setMobileStep(3);
          }}
        >
          <span className="step-num">3</span>{" "}
          <span className="step-label">Isi Detail Rapat</span>
        </div>
        <div className="bk-line"></div>
        <div
          className={`bk-step ${currentStep >= 4 ? "active" : ""} ${showSuccessModal ? "mobile-active" : ""}`}
        >
          <span className="step-num">4</span>{" "}
          <span className="step-label">Konfirmasi</span>
        </div>
      </div>

      {/* ── DESKTOP LAYOUT (3 columns, blur effect) ── */}
      <div className="bk-main bk-desktop">
        <div className="bk-col">{colRoom}</div>
        <div className={`bk-col ${!selectedRoom ? "disabled-blur" : ""}`}>
          {colDateTime}
        </div>
        <div
          className={`bk-col ${!selectedDate || !selectedTime ? "disabled-blur" : ""}`}
        >
          {colDetail}
        </div>
      </div>

      {/* ── MOBILE LAYOUT (slide one step at a time, fit screen) ── */}
      <div className="bk-mobile">
        {/* Sliding track */}
        <div
          className="bk-mobile-track"
          style={{ transform: `translateX(${-(mobileStep - 1) * 100}%)` }}
        >
          {/* Slide 1: Pilih Ruangan */}
          <div className="bk-mobile-slide">
            <div className="bk-col">
              {colRoom}
              <div className="bk-mobile-nav">
                <span className="bk-mnav-hint">
                  {selectedRoom
                    ? `Dipilih: ${selectedRoom.name}`
                    : "Ketuk ruangan untuk memilih"}
                </span>
                <button
                  className="bk-mnav-btn primary bk-mnav-single"
                  disabled={!selectedRoom}
                  onClick={() => setMobileStep(2)}
                >
                  Selanjutnya <FaChevronRight />
                </button>
              </div>
            </div>
          </div>

          {/* Slide 2: Pilih Tanggal & Waktu */}
          <div className="bk-mobile-slide">
            <div className="bk-col">
              {colDateTime}
              <div className="bk-mobile-nav">
                <button
                  className="bk-mnav-btn outline"
                  onClick={() => setMobileStep(1)}
                >
                  <FaChevronLeft /> Kembali
                </button>
                <button
                  className="bk-mnav-btn primary"
                  disabled={!selectedDate || !selectedTime}
                  onClick={() => setMobileStep(3)}
                >
                  Selanjutnya <FaChevronRight />
                </button>
              </div>
            </div>
          </div>

          {/* Slide 3: Detail Pemesanan */}
          <div className="bk-mobile-slide">
            <div className="bk-col">
              {colDetail}
              <div className="bk-mobile-nav">
                <button
                  className="bk-mnav-btn outline"
                  onClick={() => setMobileStep(2)}
                >
                  <FaChevronLeft /> Kembali
                </button>
                <button className="bk-mnav-btn primary" onClick={handleBooking}>
                  Booking Sekarang
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL NOTIFIKASI PEMESANAN BERHASIL ── */}
      {showSuccessModal && bookedDetails && (
        <div className="bk-modal-overlay">
          <div className="bk-modal-card">
            {/* Big Blue Checkmark Icon */}
            <div className="bk-modal-icon-wrap">
              <svg
                viewBox="0 0 64 64"
                fill="none"
                className="bk-modal-check-svg"
              >
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="#2563eb"
                  strokeWidth="3.5"
                />
                <path
                  d="M19 32.5L28 41.5L45 22.5"
                  stroke="#2563eb"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <h3 className="bk-modal-title">Pemesanan Berhasil!</h3>
            <p className="bk-modal-subtitle">Ruang rapat berhasil dipesan</p>

            {/* Inner Summary Card */}
            <div className="bk-modal-summary">
              <div className="bk-msum-row">
                <div className="bk-msum-label">
                  <FaUserFriends className="bk-msum-icon" />
                  <span>Ruang Rapat</span>
                </div>
                <div className="bk-msum-value">
                  <div className="bk-msum-room-name">
                    {bookedDetails.roomName}
                  </div>
                  <div className="bk-msum-room-sub">{bookedDetails.bagian}</div>
                </div>
              </div>

              <div className="bk-msum-row">
                <div className="bk-msum-label">
                  <FaRegCalendarAlt className="bk-msum-icon" />
                  <span>Tanggal</span>
                </div>
                <div className="bk-msum-value">{bookedDetails.dateString}</div>
              </div>

              <div className="bk-msum-row">
                <div className="bk-msum-label">
                  <FaRegClock className="bk-msum-icon" />
                  <span>Waktu</span>
                </div>
                <div className="bk-msum-value">{bookedDetails.timeString}</div>
              </div>

              <div className="bk-msum-row">
                <div className="bk-msum-label">
                  <FaRegListAlt className="bk-msum-icon" />
                  <span>Agenda</span>
                </div>
                <div className="bk-msum-value">{bookedDetails.agenda}</div>
              </div>

              <div className="bk-msum-row">
                <div className="bk-msum-label">
                  <FaUsers className="bk-msum-icon" />
                  <span>Jumlah Peserta</span>
                </div>
                <div className="bk-msum-value">
                  {bookedDetails.participants} Orang
                </div>
              </div>

              {/* Selesai & Hubungi Bantuan Buttons */}
              <div className="bk-msum-action">
                <a
                  href="http://wa.me/+6285122777026"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bk-modal-btn-wa"
                  title="Hubungi Bantuan via WhatsApp"
                >
                  <IoLogoWhatsapp className="bk-modal-wa-icon" />
                  <span>Hubungi Bantuan</span>
                </a>
                <button
                  className="bk-modal-btn-selesai"
                  onClick={handleFinishBooking}
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL FASILITAS RUANGAN ── */}
      {selectedFacilityRoom && (
        <div
          className="bk-facility-overlay"
          onClick={() => setSelectedFacilityRoom(null)}
        >
          <div
            className="bk-facility-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="bk-facility-close-btn"
              onClick={() => setSelectedFacilityRoom(null)}
              title="Tutup"
            >
              ✕
            </button>
            <h3 className="bk-facility-title">FASILITAS</h3>
            <div className="bk-facility-list">
              {(selectedFacilityRoom.facilities || []).map((f, idx) => (
                <div key={idx} className="bk-facility-row">
                  <div className="bk-facility-label-wrap">
                    <FacilityIcon type={f.label} />
                    <span className="bk-facility-label">{f.label}</span>
                  </div>
                  <div className="bk-facility-value">{f.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── POPUP FOTO RUANGAN (HANYA FOTO SAJA DENGAN MULTI-VIEW) ── */}
      {selectedRoomDetail && (
        <div
          className="bk-img-lightbox-overlay"
          onClick={() => setSelectedRoomDetail(null)}
        >
          <div
            className="bk-img-lightbox-wrapper"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="bk-img-lightbox-close"
              onClick={() => setSelectedRoomDetail(null)}
              title="Tutup"
            >
              ✕
            </button>

            {/* Navigasi & Counter View jika ada lebih dari 1 foto */}
            {selectedRoomDetail.images && selectedRoomDetail.images.length > 1 && (
              <>
                <div className="bk-img-lightbox-counter">
                  View {activePhotoIndex + 1} dari {selectedRoomDetail.images.length}
                </div>
                <button
                  type="button"
                  className="bk-img-lightbox-nav prev"
                  onClick={() =>
                    setActivePhotoIndex((prev) =>
                      prev === 0 ? selectedRoomDetail.images.length - 1 : prev - 1
                    )
                  }
                  title="Lihat View Sebelumnya"
                >
                  <FaChevronLeft />
                </button>
                <button
                  type="button"
                  className="bk-img-lightbox-nav next"
                  onClick={() =>
                    setActivePhotoIndex((prev) =>
                      prev === selectedRoomDetail.images.length - 1 ? 0 : prev + 1
                    )
                  }
                  title="Lihat View Selanjutnya"
                >
                  <FaChevronRight />
                </button>
              </>
            )}

            <img
              src={
                selectedRoomDetail.images && selectedRoomDetail.images.length > 0
                  ? selectedRoomDetail.images[activePhotoIndex] || selectedRoomDetail.img
                  : selectedRoomDetail.img
              }
              alt={selectedRoomDetail.name}
              className="bk-img-lightbox-content"
            />

            {/* Thumbnails strip jika ada lebih dari 1 foto */}
            {selectedRoomDetail.images && selectedRoomDetail.images.length > 1 && (
              <div className="bk-img-lightbox-thumbs">
                {selectedRoomDetail.images.map((imgUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`bk-img-lightbox-thumb ${activePhotoIndex === idx ? "active" : ""}`}
                    onClick={() => setActivePhotoIndex(idx)}
                    title={`Lihat View ${idx + 1}`}
                  >
                    <img src={imgUrl} alt={`Thumbnail View ${idx + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
