import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  FaStar,
  FaFileUpload,
  FaTimes,
} from "react-icons/fa";
import { MdMic, MdOutlineCable } from "react-icons/md";
import { TbAirConditioning } from "react-icons/tb";
import { GrGroup } from "react-icons/gr";
import { PiMonitor } from "react-icons/pi";
import { HiSpeakerWave } from "react-icons/hi2";
import { IoWaterSharp } from "react-icons/io5";
import { IoLogoWhatsapp } from "react-icons/io";
import { sanitizeMeetings } from "../utils/devSession";
import BookingAccountBar from "../components/BookingAccountBar";
import "./BookingPage.css";
import imgRuangRapatBesar from "../assets/Ruang Rapat Besar.jpeg";
import imgRuangKonsultasi from "../assets/Ruang Konsultasi.jpeg";

const initialMeetings = [];

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
      { label: "Kapasitas", value: "46", status: "Tersedia" },
      { label: "TV", value: "Smart TV 85 inch", status: "Tersedia" },
      { label: "AC", value: "Tersedia", status: "Tersedia" },
      { label: "Microphone", value: "Tersedia 6 mic", status: "Tersedia" },
      { label: "Speaker", value: "Tersedia", status: "Tersedia" },
      { label: "Dispenser", value: "Tersedia", status: "Tersedia" },
      { label: "Stopkontak", value: "Tersedia", status: "Tersedia" },
      { label: "Kabel", value: "HDMI", status: "Tersedia" },
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
      { label: "Kapasitas", value: "7", status: "Tersedia" },
      { label: "TV", value: "Smart TV 60 inch", status: "Tersedia" },
      { label: "AC", value: "Tersedia", status: "Tersedia" },
      { label: "Microphone", value: "Tidak Tersedia", status: "Tidak Tersedia" },
      { label: "Speaker", value: "Tidak Tersedia", status: "Tidak Tersedia" },
      { label: "Dispenser", value: "Tidak Tersedia", status: "Tidak Tersedia" },
      { label: "Stopkontak", value: "Tersedia", status: "Tersedia" },
      { label: "Kabel", value: "HDMI", status: "Tersedia" },
    ],
  },
];

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

const timeToMinutes = (timeStr) => {
  const [h, m] = (timeStr || "00:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

const quickTimePresets = [
  "08:00 - 10:00",
  "10:00 - 12:00",
  "13:00 - 15:00",
  "15:00 - 17:00",
];

export default function BookingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const suggestedBooking = location.state?.bookingRecommendation;
  const currentUser = useMemo(() => {
    try {
      const s =
        sessionStorage.getItem("booking_currentUser") ||
        localStorage.getItem("booking_currentUser");
      return s ? JSON.parse(s) : {};
    } catch {
      return {};
    }
  }, []);

  useEffect(() => {
    try {
      const stored =
        sessionStorage.getItem("booking_currentUser") ||
        localStorage.getItem("booking_currentUser");
      if (stored && !sessionStorage.getItem("booking_currentUser")) {
        sessionStorage.setItem("booking_currentUser", stored);
        sessionStorage.setItem("booking_isAuthenticated", "true");
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    document.body.classList.add("booking-fitscreen-active");
    return () => {
      document.body.classList.remove("booking-fitscreen-active");
    };
  }, []);
  const [selectedCategory, setSelectedCategory] = useState("Semua");
  const [selectedRoom, setSelectedRoom] = useState(() => {
    if (!suggestedBooking?.room) return null;
    const template = defaultRooms.find((room) => room.name.toLowerCase() === suggestedBooking.room.toLowerCase());
    return {
      ...(template || {}),
      id: template?.id || `recommended-${suggestedBooking.room}`,
      name: suggestedBooking.room,
      capacity: suggestedBooking.capacity || template?.capacity || 20,
      location: suggestedBooking.location || template?.location || "",
      img: suggestedBooking.image || template?.img || imgRuangRapatBesar,
      images: template?.images || [suggestedBooking.image || template?.img || imgRuangRapatBesar],
    };
  });
  const [weekOffset, setWeekOffset] = useState(0);

  const getWeekDays = (offset = 0) => {
    const now = new Date();
    const currentDay = now.getDay();
    const distanceToMonday = (currentDay === 0 ? -6 : 1) - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMonday + offset * 7);

    const dayNames = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
    const monthNames = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    return dayNames.map((name, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dateNum = String(d.getDate()).padStart(2, "0");
      return {
        day: name,
        date: dateNum,
        monthName: monthNames[d.getMonth()],
        year: y,
        full: `${y}-${m}-${dateNum}`,
      };
    });
  };

  const days = getWeekDays(weekOffset);
  const monthLabel = days.length > 0
    ? days[0].monthName === days[days.length - 1].monthName
      ? `${days[0].monthName} ${days[0].year}`
      : days[0].year === days[days.length - 1].year
      ? `${days[0].monthName} - ${days[days.length - 1].monthName} ${days[0].year}`
      : `${days[0].monthName} ${days[0].year} - ${days[days.length - 1].monthName} ${days[days.length - 1].year}`
    : "";
  const [selectedDate, setSelectedDate] = useState(() => {
    if (suggestedBooking?.date) return suggestedBooking.date;
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });
  useEffect(() => {
    if (!suggestedBooking?.date) return;
    const requestedDate = new Date(`${suggestedBooking.date}T00:00:00`);
    if (Number.isNaN(requestedDate.getTime())) return;
    const mondayOf = (date) => {
      const value = new Date(date);
      value.setHours(0, 0, 0, 0);
      value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
      return value;
    };
    const weeks = Math.round((mondayOf(requestedDate) - mondayOf(new Date())) / (7 * 24 * 60 * 60 * 1000));
    setWeekOffset(weeks);
  }, [suggestedBooking?.date]);
  const [selectedTime, setSelectedTime] = useState(() =>
    suggestedBooking?.start && suggestedBooking?.end
      ? `${suggestedBooking.start} - ${suggestedBooking.end}`
      : null,
  );

  // Time picker state: start & end hours (numpad input) & 10-minute increments.
  const [startHour, setStartHour] = useState(() => suggestedBooking?.start?.split(":")[0] || "00");
  const [startMinute, setStartMinute] = useState(() => suggestedBooking?.start?.split(":")[1] || "00");
  const [endHour, setEndHour] = useState(() => suggestedBooking?.end?.split(":")[0] || "00");
  const [endMinute, setEndMinute] = useState(() => suggestedBooking?.end?.split(":")[1] || "00");

  const [agenda, setAgenda] = useState(suggestedBooking?.title || "");
  const [bagian, setBagian] = useState(() => {
    try {
      const s =
        sessionStorage.getItem("booking_currentUser") ||
        localStorage.getItem("booking_currentUser");
      const user = JSON.parse(s || "{}");
      const department = (user.dept || "").trim().toUpperCase();
      return ["TU", "AKLAP", "BMN", "PA", "PTUK"].includes(department)
        ? department
        : department ? "Other" : "";
    } catch {
      return "";
    }
  });
  const [customBagian, setCustomBagian] = useState(() => {
    try {
      const s =
        sessionStorage.getItem("booking_currentUser") ||
        localStorage.getItem("booking_currentUser");
      const user = JSON.parse(s || "{}");
      const department = (user.dept || "").trim();
      return department && !["TU", "AKLAP", "BMN", "PA", "PTUK"].includes(department.toUpperCase())
        ? department
        : "";
    } catch {
      return "";
    }
  });
  const [peserta, setPeserta] = useState(suggestedBooking?.participants ? String(suggestedBooking.participants) : "");
  const [bookingMaterials, setBookingMaterials] = useState([]);
  const materialInputRef = useRef(null);

  const handleBookingMaterialSelect = (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (!selectedFiles.length) return;
    const currentSize = bookingMaterials.reduce((total, item) => total + (item.rawSize || 0), 0);
    const incomingSize = selectedFiles.reduce((total, file) => total + file.size, 0);
    if (currentSize + incomingSize > 20 * 1024 * 1024) {
      alert("Total ukuran file materi maksimal 20 MB.");
      event.target.value = "";
      return;
    }

    const newItems = selectedFiles.map((file) => {
      const extension = file.name.split(".").pop().toLowerCase();
      const type =
        extension === "ppt" || extension === "pptx"
          ? "ppt"
          : extension === "doc" || extension === "docx"
          ? "doc"
          : extension === "xls" || extension === "xlsx"
          ? "excel"
          : "pdf";
      return {
        id: `mat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        size:
          file.size < 1024 * 1024
            ? `${(file.size / 1024).toFixed(1)} KB`
            : `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        rawSize: file.size,
        type,
        file,
        uploadedBy: currentUser.name || currentUser.username || "Pemesan",
      };
    });

    setBookingMaterials((current) => [...current, ...newItems]);
    event.target.value = "";
  };

  // Modal notification state, facility modal state, review modal state & room detail modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookedDetails, setBookedDetails] = useState(null);
  const [selectedFacilityRoom, setSelectedFacilityRoom] = useState(null);
  const [selectedReviewRoom, setSelectedReviewRoom] = useState(null);
  const [selectedRoomDetail, setSelectedRoomDetail] = useState(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [mobileStep, setMobileStep] = useState(() => {
    if (suggestedBooking?.room && suggestedBooking?.start && suggestedBooking?.end) {
      return 3;
    }
    if (suggestedBooking?.room) {
      return 2;
    }
    return 1;
  });

  const [slideDirection, setSlideDirection] = useState("next");
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);

  const changeMobileStep = (targetStep) => {
    if (targetStep === mobileStep) return;
    setSlideDirection(targetStep > mobileStep ? "next" : "prev");
    setMobileStep(targetStep);
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      window.scrollTo(0, 0);
    }
  };

  // Ensure mobileStep never exceeds the valid progression
  useEffect(() => {
    if (!selectedRoom && mobileStep > 1) {
      setMobileStep(1);
    } else if ((!selectedDate || !selectedTime) && mobileStep > 2) {
      setMobileStep(2);
    }
  }, [mobileStep, selectedRoom, selectedDate, selectedTime]);

  const finalBagianValue = bagian === "Other" ? customBagian.trim() : bagian;
  const isFormFilled = Boolean(agenda.trim() && finalBagianValue && peserta && Number(peserta) > 0);

  const desktopStep = showSuccessModal
    ? 4
    : selectedRoom
      ? selectedDate && selectedTime
        ? isFormFilled
          ? 4
          : 3
        : 2
      : 1;

  const activeStep = isMobile ? (showSuccessModal ? 4 : mobileStep) : desktopStep;

  const handleStepClick = (targetStep) => {
    if (targetStep === mobileStep) return;
    if (targetStep === 1) {
      if (isMobile) changeMobileStep(1);
      return;
    }
    if (targetStep === 2) {
      if (!selectedRoom) {
        alert("Silakan pilih ruangan terlebih dahulu.");
        return;
      }
      if (isMobile) changeMobileStep(2);
      return;
    }
    if (targetStep === 3) {
      if (!selectedRoom) {
        alert("Silakan pilih ruangan terlebih dahulu.");
        return;
      }
      if (!selectedDate || !selectedTime) {
        alert("Silakan pilih tanggal dan jam rapat terlebih dahulu.");
        return;
      }
      if (isMobile) changeMobileStep(3);
      return;
    }
    if (targetStep === 4) {
      if (!selectedRoom) {
        alert("Silakan pilih ruangan terlebih dahulu.");
        return;
      }
      if (!selectedDate || !selectedTime) {
        alert("Silakan pilih tanggal dan jam rapat terlebih dahulu.");
        return;
      }
      if (!isFormFilled) {
        alert("Silakan lengkapi agenda, bagian, dan jumlah peserta terlebih dahulu.");
        return;
      }
      if (isMobile) changeMobileStep(4);
    }
  };

  const handleGoToStep4 = () => {
    if (!agenda.trim()) {
      alert("Mohon masukkan agenda rapat!");
      return;
    }
    const currentBagian = bagian === "Other" ? customBagian.trim() : bagian;
    if (!currentBagian) {
      alert("Mohon masukkan nama bagian Anda!");
      return;
    }
    if (!peserta || Number(peserta) <= 0) {
      alert("Mohon masukkan jumlah peserta!");
      return;
    }
    changeMobileStep(4);
  };

  // Touch gesture swipe handler for fluid mobile page changes
  const handleTouchStart = (e) => {
    if (e.touches && e.touches.length > 0) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e) => {
    if (!touchStartXRef.current) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - touchStartXRef.current;
    const deltaY = endY - touchStartYRef.current;

    // Trigger only if horizontal swipe dominates over vertical scrolling
    if (Math.abs(deltaX) > 65 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX < 0) {
        // Swipe left -> advance to next step
        if (mobileStep === 1 && selectedRoom) {
          changeMobileStep(2);
        } else if (mobileStep === 2 && selectedDate && selectedTime && !currentConflict) {
          changeMobileStep(3);
        } else if (mobileStep === 3 && isFormFilled) {
          handleGoToStep4();
        }
      } else {
        // Swipe right -> return to previous step
        if (mobileStep > 1) {
          changeMobileStep(mobileStep - 1);
        }
      }
    }
    touchStartXRef.current = 0;
    touchStartYRef.current = 0;
  };

  const [allMeetings, setAllMeetings] = useState([]);
  // Ruangan dari database. null = belum terjawab, sehingga daftar bawaan di
  // kode masih dipakai. Daftar kosong dari server tidak pernah dipasang:
  // tabel rooms yang belum terisi bukan alasan menyembunyikan ruangan dari
  // pegawai yang mau memesan.
  const [apiRooms, setApiRooms] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchMeetings = async () => {
      try {
        const res = await fetch("/api/dashboard/data");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data.meetings)) {
            setAllMeetings(data.meetings);
          }
          if (isMounted && Array.isArray(data.rooms) && data.rooms.length > 0) {
            setApiRooms(data.rooms);
            // Disimpan supaya halaman lain yang masih membaca app_rooms
            // (riwayat booking) ikut memakai data database yang sama.
            try {
              localStorage.setItem("app_rooms", JSON.stringify(data.rooms));
            } catch {
              /* Mode privat atau kuota penuh. Daftar ruangan tetap jalan dari
                 apiRooms, jadi kegagalan menyimpan salinan ini tidak fatal. */
            }
          }
        }
      } catch (err) {
        console.warn("Gagal mengambil jadwal rapat:", err);
      }
    };

    fetchMeetings();
    const interval = setInterval(fetchMeetings, 10000);

    const handleSync = () => {
      fetchMeetings();
    };
    window.addEventListener("app_meetings_updated", handleSync);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener("app_meetings_updated", handleSync);
    };
  }, []);

  // Hitung jadwal tidak tersedia berdasarkan ruangan & tanggal yang dipilih (hanya yang sudah diapprove)
  const unavailableSlots = useMemo(() => {
    if (!selectedRoom || !selectedDate) return [];

    let sourceMeetings = [...allMeetings];
    try {
      const stored = localStorage.getItem("app_meetings");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          sourceMeetings = [...sourceMeetings, ...parsed];
        }
      }
    } catch (e) {}

    const normSelectedRoom = (selectedRoom.name || "").toLowerCase().trim();

    // Syarat dari user:
    // 1. Ruangan sama
    // 2. Tanggal sama dengan selectedDate
    // 3. SUDAH DI-APPROVE (bukan Menunggu Approval, bukan Dibatalkan, bukan Ditolak)
    const approvedMeetings = sourceMeetings.filter((m) => {
      if (!m) return false;
      const mDate = m.date || "";
      if (mDate !== selectedDate) return false;

      const normRoom = (m.room || "").toLowerCase().trim();
      const roomMatch =
        normRoom.includes(normSelectedRoom) ||
        normSelectedRoom.includes(normRoom) ||
        (normSelectedRoom.includes("besar") && normRoom.includes("besar")) ||
        (normSelectedRoom.includes("konsultasi") && normRoom.includes("konsultasi"));
      if (!roomMatch) return false;

      const status = (m.status || "").toLowerCase().trim();
      if (
        status === "menunggu approval" ||
        status === "dibatalkan" ||
        status === "ditolak"
      ) {
        return false;
      }
      return true;
    });

    const slotMap = new Map();
    approvedMeetings.forEach((m) => {
      const start = (m.start || m.startTime || "").trim();
      const end = (m.end || m.endTime || "").trim();
      if (!start || !end) return;

      const timeLabel = `${start} - ${end}`;
      if (!slotMap.has(timeLabel)) {
        slotMap.set(timeLabel, {
          time: timeLabel,
          start,
          end,
          agenda: m.title || m.agenda || "Rapat Terjadwal",
          requester:
            m.requester ||
            m.bagian ||
            m.organizer ||
            m.nama ||
            m.pemesan ||
            "-",
        });
      }
    });

    return Array.from(slotMap.values()).sort((a, b) =>
      a.start.localeCompare(b.start),
    );
  }, [allMeetings, selectedRoom, selectedDate]);

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

  const handleSelectPreset = (preset) => {
    const [pStart, pEnd] = preset.split(" - ");
    const [sh, sm] = pStart.split(":");
    const [eh, em] = pEnd.split(":");
    updateTimes(sh, sm, eh, em);
  };

  const currentConflict = useMemo(() => {
    if (!startHour || !endHour || (startHour === "00" && endHour === "00") || !unavailableSlots.length) return null;
    const reqStart = timeToMinutes(`${startHour}:${startMinute}`);
    const reqEnd = timeToMinutes(`${endHour}:${endMinute}`);
    if (reqEnd <= reqStart) return null;
    return (
      unavailableSlots.find((slot) => {
        const slotStart = timeToMinutes(slot.start);
        const slotEnd = timeToMinutes(slot.end);
        return reqStart < slotEnd && reqEnd > slotStart;
      }) || null
    );
  }, [startHour, startMinute, endHour, endMinute, unavailableSlots]);

  const isOutsideOperational = useMemo(() => {
    if (!startHour || !endHour || (startHour === "00" && endHour === "00")) return false;
    const reqStart = timeToMinutes(`${startHour}:${startMinute}`);
    const reqEnd = timeToMinutes(`${endHour}:${endMinute}`);
    if (reqEnd <= reqStart) return false;
    return reqStart < 8 * 60 || reqEnd > 17 * 60;
  }, [startHour, startMinute, endHour, endMinute]);

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
  const formattedDateString = useMemo(() => {
    if (selectedDayObj) {
      return `${selectedDayObj.day}, ${selectedDayObj.date} ${selectedDayObj.monthName || ""} ${selectedDayObj.year || ""}`.trim();
    }
    if (!selectedDate) return "-";
    try {
      const parsed = new Date(`${selectedDate}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) {
        return new Intl.DateTimeFormat("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(parsed);
      }
    } catch {}
    return selectedDate;
  }, [selectedDayObj, selectedDate]);

  const handleBooking = async () => {
    if (isSubmitting) return;

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

    // Periksa apakah waktu yang dipilih bertabrakan dengan jadwal yang sudah disetujui
    const toMinutes = (timeStr) => {
      const [h, m] = (timeStr || "00:00").split(":").map(Number);
      return h * 60 + m;
    };
    const reqStart = toMinutes(start);
    const reqEnd = toMinutes(end);

    if (reqEnd <= reqStart) {
      alert("Jam selesai harus lebih akhir daripada jam mulai rapat!");
      return;
    }

    const conflictingSlot = unavailableSlots.find((slot) => {
      const slotStart = toMinutes(slot.start);
      const slotEnd = toMinutes(slot.end);
      return reqStart < slotEnd && reqEnd > slotStart;
    });

    if (conflictingSlot) {
      alert(
        `Waktu yang Anda pilih (${start} - ${end}) bertabrakan dengan jadwal yang sudah disetujui sebelumnya:\n` +
          `Pemesan: ${conflictingSlot.requester} (${conflictingSlot.time}).\n\n` +
          `Silakan pilih jam lain yang masih tersedia.`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const tempId = Date.now();

      // Hanya sertakan materi yang sudah memiliki URL (non-file/link) pada pembuatan awal rapat.
      // File biner diunggah via endpoint /materials/file dan otomatis dimasukkan dengan URL resminya.
      const initialMaterials = bookingMaterials
        .filter((m) => Boolean(m.url) && !(m.file instanceof File))
        .map(({ rawSize, file, ...material }) => material);

      const newMeeting = {
        id: tempId,
        title: agenda,
        requester: finalBagian,
        bookedBy: currentUser.name || currentUser.username || "",
        bookedByUsername: currentUser.username || "",
        room: selectedRoom?.name,
        date: selectedDate,
        start,
        end,
        status: "Menunggu Approval",
        participants: parseInt(peserta) || 0,
        desc: agenda,
        materials: initialMaterials,
        createdAt: nowIso,
      };

      // Simpan lokal dengan penanganan exception aman
      try {
        const stored = localStorage.getItem("app_meetings");
        let currentMeetings = stored ? sanitizeMeetings(JSON.parse(stored)) : [];
        if (!Array.isArray(currentMeetings)) currentMeetings = [];
        currentMeetings.push(newMeeting);
        localStorage.setItem("app_meetings", JSON.stringify(currentMeetings));
      } catch (storageErr) {
        console.warn("Penyimpanan lokal app_meetings gagal:", storageErr);
      }

      // Picu event sinkronisasi agar Dashboard langsung terupdate
      try {
        window.dispatchEvent(new Event("storage"));
        window.dispatchEvent(new Event("app_meetings_updated"));
        if (window.parent && window.parent !== window) {
          window.parent.dispatchEvent(new Event("storage"));
          window.parent.dispatchEvent(new Event("app_meetings_updated"));
        }
      } catch (err) {}

      // Tambahkan notifikasi ke antrean untuk Dashboard Admin & Akun Approval
      try {
        const storedNotifs = JSON.parse(
          localStorage.getItem("app_notifications") || "[]",
        );
        const newNotif = {
          id: String(newMeeting.id),
          meetingId: String(newMeeting.id),
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
        const isAlreadyInNotifs = storedNotifs.some(
          (n) =>
            String(n.meetingId || n.id) === String(newMeeting.id) ||
            (n.room === newNotif.room && n.date === newNotif.date && n.time === newNotif.time),
        );
        if (!isAlreadyInNotifs) {
          storedNotifs.unshift(newNotif);
          localStorage.setItem("app_notifications", JSON.stringify(storedNotifs));
          window.dispatchEvent(new Event("app_notifications_updated"));
          if (window.parent && window.parent !== window) {
            window.parent.dispatchEvent(new Event("app_notifications_updated"));
          }
        }
      } catch (e) {}

      // Kirim ke backend & Google Calendar
      let backendMeetingId = String(tempId);
      try {
        const res = await fetch("/api/dashboard/meetings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newMeeting),
        });

        if (res.ok) {
          const result = await res.json();
          if (result?.meeting?.id) {
            backendMeetingId = String(result.meeting.id);
            newMeeting.id = result.meeting.id;
            newMeeting.googleId = result.meeting.googleId;

            let freshMeeting = result.meeting;
            // Jika ada file biner yang diunggah, unggah langsung ke endpoint server
            const filesToUpload = bookingMaterials.filter((m) => m.file instanceof File);
            if (filesToUpload.length > 0) {
              for (const mat of filesToUpload) {
                try {
                  const uploadRes = await fetch(`/api/dashboard/meetings/${backendMeetingId}/materials/file`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/octet-stream",
                      "X-File-Name": encodeURIComponent(mat.file.name),
                      "X-Material-Name": encodeURIComponent(mat.name),
                      "X-Uploaded-By": encodeURIComponent(mat.uploadedBy || currentUser.name || "Pemesan"),
                    },
                    body: mat.file,
                  });
                  if (uploadRes.ok) {
                    const uploadData = await uploadRes.json();
                    if (uploadData.meeting) {
                      freshMeeting = uploadData.meeting;
                    }
                  }
                } catch (uploadErr) {
                  console.warn("Gagal unggah file materi biner:", uploadErr);
                }
              }
            }

            // Perbarui app_meetings dengan data ID resmi dan materi ber-URL dari backend
            try {
              const stored = JSON.parse(localStorage.getItem("app_meetings") || "[]");
              const updated = stored.map((m) =>
                String(m.id) === String(tempId) ||
                String(m.id) === backendMeetingId ||
                (m.date === newMeeting.date && m.start === newMeeting.start && m.room === newMeeting.room)
                  ? { ...m, ...freshMeeting }
                  : m,
              );
              localStorage.setItem("app_meetings", JSON.stringify(updated));
              window.dispatchEvent(new Event("storage"));
              window.dispatchEvent(new Event("app_meetings_updated"));
              if (window.parent && window.parent !== window) {
                window.parent.dispatchEvent(new Event("storage"));
                window.parent.dispatchEvent(new Event("app_meetings_updated"));
              }
            } catch (e) {}

            // Perbarui app_notifications agar ID selaras dengan ID backend
            try {
              const storedNotifs = JSON.parse(localStorage.getItem("app_notifications") || "[]");
              let updatedNotifs = false;
              const updatedN = storedNotifs.map((n) => {
                if (
                  String(n.meetingId || n.id) === String(tempId) ||
                  (n.room === newMeeting.room && n.date === newMeeting.date && n.time === `${start} - ${end}`)
                ) {
                  updatedNotifs = true;
                  return { ...n, id: backendMeetingId, meetingId: backendMeetingId };
                }
                return n;
              });
              if (updatedNotifs) {
                localStorage.setItem("app_notifications", JSON.stringify(updatedN));
                window.dispatchEvent(new Event("app_notifications_updated"));
                if (window.parent && window.parent !== window) {
                  window.parent.dispatchEvent(new Event("app_notifications_updated"));
                }
              }
            } catch (e) {}
          }
        }
      } catch (err) {
        console.warn("Sinkronisasi ke Google Calendar/Backend:", err);
      }

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
    } catch (globalErr) {
      console.error("Gagal melakukan booking:", globalErr);
      alert("Terjadi kesalahan saat memproses booking: " + (globalErr.message || "Silakan coba lagi."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinishBooking = () => {
    // Tutup modal dan reset semua state kembali ke langkah pertama
    setShowSuccessModal(false);
    setBookedDetails(null);
    setSelectedRoom(null);
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    setSelectedDate(`${y}-${m}-${d}`);
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
    navigate("/booking/history");
  };

  /* Melengkapi data ruangan apa pun asalnya (database atau localStorage) dengan
     nilai bawaan di kode, supaya kolom yang belum diisi admin tidak membuat
     kartu ruangan tampak rusak. */
  const normalisasiRuangan = (list) =>
    list.map((r, idx) => {
      /* Hanya ruangan dengan nama yang sama yang boleh meminjam nilai bawaan.
         Sebelumnya ada cadangan defaultRooms[idx % panjang], sehingga ruangan
         baru yang admin tambah ikut mewarisi fasilitas ruangan lain — "Ruang
         Rapat Kecil" tampil dengan kapasitas 46, Smart TV 85 inch, dan 6 mic.
         Lebih baik tampil apa adanya daripada menjanjikan fasilitas yang
         tidak ada di ruangan itu. */
      const defaultItem =
        defaultRooms.find(
          (dr) => dr.name.toLowerCase() === (r.name || "").toLowerCase(),
        ) || {};
      const imgs =
        Array.isArray(r.images) && r.images.length > 0
          ? r.images
          : [r.img || r.image || defaultItem.img || imgRuangRapatBesar];
      return {
        ...defaultItem,
        ...r,
        id: r.id || defaultItem.id || `R_${idx}`,
        name: r.name || defaultItem.name,
        capacity: r.capacity || defaultItem.capacity || 20,
        location: r.location || defaultItem.location || "Gedung A - Lantai 3",
        category: (r.name || "").toLowerCase().includes("konsultasi")
          ? "Ruang Konsultasi"
          : "Ruang Besar",
        img: imgs[0],
        images: imgs,
        facilities:
          Array.isArray(r.facilities) && r.facilities.length > 0
            ? r.facilities
            : defaultItem.facilities || [
                { label: "Kapasitas", value: String(r.capacity || 20) },
                { label: "TV", value: "Smart TV" },
                { label: "AC", value: "Tersedia" },
              ],
      };
    });

  /* Urutan sumber: database dulu, lalu salinan terakhir di browser, baru
     daftar bawaan. Database didahulukan supaya ruangan yang admin tambah atau
     ubah terlihat oleh semua pegawai, bukan hanya di browser admin sendiri. */
  const getRoomsList = () => {
    if (Array.isArray(apiRooms) && apiRooms.length > 0) {
      return normalisasiRuangan(apiRooms);
    }
    try {
      const stored = localStorage.getItem("app_rooms");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return normalisasiRuangan(parsed);
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
    if (isMobile) {
      changeMobileStep(2);
    }
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
                <strong>{room.capacity} Orang</strong>
              </div>
              <div className="bk-room-meta location">
                <FaMapMarkerAlt className="bk-icon" /> {room.location || "-"}
              </div>
              <div className="bk-room-btns-row">
                <button
                  type="button"
                  className="bk-btn-facility"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFacilityRoom(room);
                  }}
                  title="Lihat kelengkapan fasilitas ruangan"
                >
                  <FaInfoCircle className="bk-btn-facility-icon" /> Fasilitas
                </button>
                <button
                  type="button"
                  className="bk-btn-review"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedReviewRoom(room);
                  }}
                  title="Lihat Rating, Ulasan, dan Balasan Pengelola Ruangan"
                >
                  <FaStar className="bk-btn-review-icon" /> Ulasan
                </button>
              </div>
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
            <span>Ketentuan Peminjaman Ruang Rapat</span>
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

      {/* Mini banner ruangan terpilih khusus mobile di atas kalender */}
      {isMobile && selectedRoom && (
        <div className="bk-mobile-step-summary-bar">
          <div className="bk-mssb-info">
            <strong>{selectedRoom.name}</strong>
            <span>Kapasitas: {selectedRoom.capacity} Orang · {selectedRoom.location || "-"}</span>
          </div>
          <button
            type="button"
            className="bk-mssb-change"
            onClick={() => changeMobileStep(1)}
            title="Ganti Ruangan Rapat"
          >
            Ganti Ruang
          </button>
        </div>
      )}

      <div className="bk-datetime-scroll">
        <div className="bk-month-selector">
          <div className="bk-month-header-row">
            <button
              type="button"
              className="bk-month-nav-btn prev"
              title="Minggu Sebelumnya"
              aria-label="Minggu Sebelumnya"
              onClick={() => setWeekOffset((prev) => prev - 1)}
            >
              <FaChevronLeft />
            </button>
            <div className="bk-month-title-wrap">
              <h4>{monthLabel}</h4>
              <label className="bk-custom-date-picker-label" title="Pilih tanggal langsung dari kalender">
                <FaRegCalendarAlt />
                <input
                  type="date"
                  className="bk-hidden-date-input"
                  value={selectedDate}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const targetVal = e.target.value;
                    setSelectedDate(targetVal);
                    const target = new Date(`${targetVal}T00:00:00`);
                    if (!Number.isNaN(target.getTime())) {
                      const mondayOf = (date) => {
                        const v = new Date(date);
                        v.setHours(0, 0, 0, 0);
                        v.setDate(v.getDate() - ((v.getDay() + 6) % 7));
                        return v;
                      };
                      const weeks = Math.round((mondayOf(target) - mondayOf(new Date())) / (7 * 24 * 60 * 60 * 1000));
                      setWeekOffset(weeks);
                    }
                  }}
                />
              </label>
            </div>
            <button
              type="button"
              className="bk-month-nav-btn next"
              title="Minggu Berikutnya"
              aria-label="Minggu Berikutnya"
              onClick={() => setWeekOffset((prev) => prev + 1)}
            >
              <FaChevronRight />
            </button>
          </div>
          <div className="bk-days-row">
            <button
              type="button"
              className="bk-day-nav-btn prev"
              title="Minggu Sebelumnya"
              aria-label="Minggu Sebelumnya"
              onClick={() => setWeekOffset((prev) => prev - 1)}
            >
              <FaChevronLeft />
            </button>
            {days.map((d) => (
              <div
                key={d.full}
                className={`bk-day-box ${selectedDate === d.full ? "active" : ""} ${d.day === "Sabtu" || d.day === "Minggu" ? "weekend" : ""}`}
                onClick={() => {
                  setSelectedDate(d.full);
                }}
              >
                <span className="bk-day-name">{d.day}</span>
                <span className="bk-day-num">{d.date}</span>
              </div>
            ))}
            <button
              type="button"
              className="bk-day-nav-btn next"
              title="Minggu Berikutnya"
              aria-label="Minggu Berikutnya"
              onClick={() => setWeekOffset((prev) => prev + 1)}
            >
              <FaChevronRight />
            </button>
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

          {/* Quick preset chips */}
          <div className="bk-quick-presets-section">
            <span className="bk-quick-presets-label">Pilihan Slot Waktu Cepat:</span>
            <div className="bk-quick-presets-chips">
              {quickTimePresets.map((preset) => {
                const isSelected = selectedTime === preset;
                const [pStart, pEnd] = preset.split(" - ");
                const pS = timeToMinutes(pStart);
                const pE = timeToMinutes(pEnd);
                const isPresetConflicted = unavailableSlots.some((slot) => {
                  const sS = timeToMinutes(slot.start);
                  const sE = timeToMinutes(slot.end);
                  return pS < sE && pE > sS;
                });
                return (
                  <button
                    key={preset}
                    type="button"
                    className={`bk-quick-chip ${isSelected ? "active" : ""} ${isPresetConflicted ? "conflicted" : ""}`}
                    disabled={isPresetConflicted}
                    title={isPresetConflicted ? "Slot waktu ini sudah terisi oleh pemesan lain" : `Pilih rentang ${preset}`}
                    onClick={() => handleSelectPreset(preset)}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Picker Boxes: Mulai & Selesai (hour via numpad, minute in 10-minute increments) */}
          <div className="bk-time-boxes">
            {/* Box Mulai */}
            <div className={`bk-time-box ${currentConflict ? "has-conflict" : ""}`}>
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
                    title="Pilih menit dengan kelipatan 10"
                  >
                    {["00", "10", "20", "30", "40", "50"].map((minute) => (
                      <option key={minute} value={minute}>{minute}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Box Selesai */}
            <div className={`bk-time-box ${currentConflict ? "has-conflict" : ""}`}>
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
                    title="Pilih menit dengan kelipatan 10"
                  >
                    {["00", "10", "20", "30", "40", "50"].map((minute) => (
                      <option key={minute} value={minute}>{minute}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Live Conflict Warning Banner */}
          {currentConflict && (
            <div className="bk-time-conflict-banner">
              <FaInfoCircle className="bk-conflict-icon" />
              <div>
                <strong>Jadwal Bentrok:</strong> Waktu pilihan Anda ({startHour}:{startMinute} - {endHour}:{endMinute}) berbenturan dengan jadwal <strong>{currentConflict.requester}</strong> ({currentConflict.time}). Silakan pilih jam lain.
              </div>
            </div>
          )}

          {/* Operational Hours Note */}
          {isOutsideOperational && !currentConflict && (
            <div className="bk-time-operational-banner">
              <FaInfoCircle className="bk-operational-icon" />
              <div>
                <strong>Catatan Jam Kerja:</strong> Jam operasional pemakaian ruangan adalah pukul 08:00 – 17:00 WIB.
              </div>
            </div>
          )}

          {/* Horizontal indicator line 2 */}
          <div className="bk-indicator-line"></div>

          {/* Section: Jam tidak tersedia */}
          <div className="bk-unavailable-section-header">
            <h3 className="bk-unavailable-title">Jadwal yang Sudah Dipesan</h3>
            <span className="bk-unavailable-subtitle">Waktu yang telah disetujui untuk pemesan lain pada tanggal ini</span>
          </div>
          <div className="bk-unavailable-grid">
            {unavailableSlots.length > 0 ? (
              unavailableSlots.map((slot) => {
                const isConflict = currentConflict && currentConflict.time === slot.time;
                return (
                  <div
                    key={slot.time}
                    className={`bk-unavail-slot ${isConflict ? "conflict-highlight" : ""}`}
                    title={`Jam ${slot.time} sudah terisi oleh ${slot.requester}`}
                    onClick={() =>
                      alert(
                        `Jam ${slot.time} tidak tersedia karena sudah disetujui untuk pemesan:\n` +
                          `• Pemesan: ${slot.requester}\n` +
                          `• Agenda: ${slot.agenda}`,
                      )
                    }
                  >
                    <div className="bk-unavail-slot-top">
                      <span className="bk-unavail-slot-time">{slot.time}</span>
                      <span className={`bk-unavail-slot-badge ${isConflict ? "conflict" : ""}`}>
                        {isConflict ? "Bentrok" : "Sudah Dipesan"}
                      </span>
                    </div>
                    <div className="bk-unavail-slot-requester" title={slot.requester}>
                      {slot.requester}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bk-unavailable-empty">
                {!selectedRoom
                  ? "Pilih ruangan terlebih dahulu untuk melihat jadwal yang terisi"
                  : "Semua jam tersedia untuk tanggal ini (belum ada rapat yang disetujui)"}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  const colDetail = (
    <>
      <h2 className="bk-col-title">DETAIL PEMESANAN</h2>
      <div className="bk-detail-card">
        {/* Structured Booking Summary Card */}
        <div className="bk-booking-summary-card">
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
            <div className="bk-detail-room-info">
              <h3>{selectedRoom?.name || "Pilih Ruangan"}</h3>
              <div className="bk-room-meta">
                <FaUserFriends className="bk-icon" /> Kapasitas :{" "}
                <strong>{selectedRoom?.capacity || "-"} Orang</strong>
              </div>
              <div className="bk-room-meta location">
                <FaMapMarkerAlt className="bk-icon" /> {selectedRoom?.location || "-"}
              </div>
            </div>
          </div>
          <div className="bk-detail-datetime">
            <div>
              <FaRegCalendarAlt className="bk-icon-dark" /> <span>Tanggal</span>
            </div>
            <div className="bk-val">{formattedDateString || "-"}</div>
            <div>
              <FaRegClock className="bk-icon-dark" /> <span>Waktu</span>
            </div>
            <div className={`bk-val ${selectedTime ? "selected-time" : ""}`}>
              {selectedTime ? selectedTime : "Belum dipilih"}
            </div>
          </div>
        </div>

        <div className="bk-form">
          <div className="bk-form-group">
            <label>
              <FaRegListAlt className="bk-icon-dark" /> Agenda Rapat
            </label>
            <textarea
              placeholder="Masukkan agenda rapat secara spesifik..."
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
          <div className="bk-form-group">
            <label>
              <FaUsers className="bk-icon-dark" /> Jumlah Peserta
            </label>
            <div className="bk-peserta-input-wrap">
              <input
                type="number"
                min="1"
                placeholder="Masukkan jumlah peserta"
                value={peserta}
                onChange={(e) => setPeserta(e.target.value)}
              />
              <span className="bk-peserta-suffix">Orang</span>
            </div>
          </div>
          <div className="bk-booking-materials">
            <input
              ref={materialInputRef}
              type="file"
              accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              multiple
              onChange={handleBookingMaterialSelect}
              hidden
            />
            <button type="button" className="bk-add-material-btn" onClick={() => materialInputRef.current?.click()}>
              <FaFileUpload /> Tambah File Materi
            </button>
            <small>PDF, PowerPoint, Word, atau Excel · total maksimal 20 MB</small>
            {bookingMaterials.length > 0 && <ul className="bk-selected-materials">
              {bookingMaterials.map((material) => <li key={material.id}>
                <span><FaFileUpload /> {material.name} <small>{material.size}</small></span>
                <button type="button" aria-label={`Hapus ${material.name}`} onClick={() => setBookingMaterials((items) => items.filter((item) => item.id !== material.id))}><FaTimes /></button>
              </li>)}
            </ul>}
          </div>
          <button
            className="bk-submit-btn"
            onClick={handleBooking}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Memproses..." : "Booking Sekarang"}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="bk-container">
      {/* Header */}
      <header className="bk-header">
        <BookingAccountBar currentUser={currentUser} />
        <div className="bk-header-content">
          <h1>BOOKING RUANG RAPAT</h1>
          <p>Pesan ruang rapat sesuai kebutuhan Anda dengan mudah dan cepat.</p>
        </div>
      </header>

      {/* Stepper (Timeline 1 - 4) */}
      <div className="bk-stepper">
        {/* Progress track bar for mobile animation */}
        <div className="bk-stepper-progress-track">
          <div
            className="bk-stepper-progress-fill"
            style={{ width: `${(activeStep / 4) * 100}%` }}
          />
        </div>

        <div className="bk-stepper-steps-row">
          <div
            className={`bk-step ${showSuccessModal || activeStep > 1 ? "completed" : activeStep === 1 ? "active" : "upcoming"}`}
            onClick={() => handleStepClick(1)}
            title="Langkah 1: Pilih Ruangan"
          >
            <span className="step-num">{showSuccessModal || activeStep > 1 ? "✓" : "1"}</span>{" "}
            <span className="step-label">Pilih Ruangan</span>
          </div>
          <div className={`bk-line ${showSuccessModal || activeStep > 1 ? "completed" : ""}`}></div>

          <div
            className={`bk-step ${showSuccessModal || activeStep > 2 ? "completed" : activeStep === 2 ? "active" : "upcoming"}`}
            onClick={() => handleStepClick(2)}
            title="Langkah 2: Pilih Tanggal & Waktu"
          >
            <span className="step-num">{showSuccessModal || activeStep > 2 ? "✓" : "2"}</span>{" "}
            <span className="step-label">Pilih Tanggal &amp; Waktu</span>
          </div>
          <div className={`bk-line ${showSuccessModal || activeStep > 2 ? "completed" : ""}`}></div>

          <div
            className={`bk-step ${showSuccessModal || activeStep > 3 ? "completed" : activeStep === 3 ? "active" : "upcoming"}`}
            onClick={() => handleStepClick(3)}
            title="Langkah 3: Isi Detail Rapat"
          >
            <span className="step-num">{showSuccessModal || activeStep > 3 ? "✓" : "3"}</span>{" "}
            <span className="step-label">Isi Detail Rapat</span>
          </div>
          <div className={`bk-line ${showSuccessModal || activeStep > 3 ? "completed" : ""}`}></div>

          <div
            className={`bk-step ${showSuccessModal ? "completed" : activeStep === 4 ? "active" : "upcoming"}`}
            onClick={() => handleStepClick(4)}
            title="Langkah 4: Konfirmasi"
          >
            <span className="step-num">{showSuccessModal ? "✓" : "4"}</span>{" "}
            <span className="step-label">Konfirmasi</span>
          </div>
        </div>

        {/* Dynamic Mobile Step Badge with subtle entrance animation */}
        <div className="bk-mobile-step-badge" key={`badge-${activeStep}`}>
          <span className="bk-msb-counter">Langkah {activeStep} / 4</span>
          <span className="bk-msb-sep">•</span>
          <span className="bk-msb-name">
            {activeStep === 1
              ? "Pilih Ruang Rapat"
              : activeStep === 2
              ? "Pilih Tanggal & Waktu"
              : activeStep === 3
              ? "Isi Detail Rapat"
              : "Konfirmasi Pemesanan"}
          </span>
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

      {/* ── MOBILE LAYOUT (slide 1-4, fit screen) ── */}
      <div
        className="bk-mobile"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Sliding track with 4 steps */}
        <div
          className="bk-mobile-track"
          style={{ transform: `translate3d(${-(mobileStep - 1) * 100}%, 0, 0)` }}
        >
          {/* Slide 1: Pilih Ruangan */}
          <div className={`bk-mobile-slide ${mobileStep === 1 ? `is-active anim-${slideDirection}` : ""}`}>
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
                  onClick={() => changeMobileStep(2)}
                >
                  Selanjutnya <FaChevronRight />
                </button>
              </div>
            </div>
          </div>

          {/* Slide 2: Pilih Tanggal & Waktu */}
          <div className={`bk-mobile-slide ${mobileStep === 2 ? `is-active anim-${slideDirection}` : ""}`}>
            <div className="bk-col">
              {colDateTime}
              <div className="bk-mobile-nav">
                <button
                  className="bk-mnav-btn outline"
                  onClick={() => changeMobileStep(1)}
                >
                  <FaChevronLeft /> Kembali
                </button>
                <button
                  className="bk-mnav-btn primary"
                  disabled={!selectedDate || !selectedTime || Boolean(currentConflict)}
                  onClick={() => changeMobileStep(3)}
                >
                  Selanjutnya <FaChevronRight />
                </button>
              </div>
            </div>
          </div>

          {/* Slide 3: Isi Detail Rapat */}
          <div className={`bk-mobile-slide ${mobileStep === 3 ? `is-active anim-${slideDirection}` : ""}`}>
            <div className="bk-col">
              <h2 className="bk-col-title">ISI DETAIL RAPAT</h2>
              {/* Summary Chip of selected room & time */}
              <div className="bk-mobile-step-summary-bar">
                <div className="bk-mssb-info">
                  <strong>{selectedRoom?.name || "Ruangan belum dipilih"}</strong>
                  <span>{formattedDateString} · {selectedTime || "Waktu belum dipilih"}</span>
                </div>
                <button
                  type="button"
                  className="bk-mssb-change"
                  onClick={() => changeMobileStep(2)}
                >
                  Ubah Waktu
                </button>
              </div>

              <div className="bk-mobile-form-scroll">
                <div className="bk-form">
                  <div className="bk-form-group">
                    <label>
                      <FaRegListAlt className="bk-icon-dark" /> Agenda Rapat
                    </label>
                    <textarea
                      placeholder="Masukkan agenda rapat secara spesifik..."
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
                  <div className="bk-form-group">
                    <label>
                      <FaUsers className="bk-icon-dark" /> Jumlah Peserta
                    </label>
                    <div className="bk-peserta-input-wrap">
                      <input
                        type="number"
                        min="1"
                        placeholder="Masukkan jumlah peserta"
                        value={peserta}
                        onChange={(e) => setPeserta(e.target.value)}
                      />
                      <span className="bk-peserta-suffix">Orang</span>
                    </div>
                  </div>
                  <div className="bk-booking-materials">
                    <input
                      ref={materialInputRef}
                      type="file"
                      accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                      multiple
                      onChange={handleBookingMaterialSelect}
                      hidden
                    />
                    <button type="button" className="bk-add-material-btn" onClick={() => materialInputRef.current?.click()}>
                      <FaFileUpload /> Tambah File Materi
                    </button>
                    <small>PDF, PowerPoint, Word, atau Excel · total maksimal 20 MB</small>
                    {bookingMaterials.length > 0 && (
                      <ul className="bk-selected-materials">
                        {bookingMaterials.map((material) => (
                          <li key={material.id}>
                            <span><FaFileUpload /> {material.name} <small>{material.size}</small></span>
                            <button type="button" aria-label={`Hapus ${material.name}`} onClick={() => setBookingMaterials((items) => items.filter((item) => item.id !== material.id))}><FaTimes /></button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              <div className="bk-mobile-nav">
                <button
                  className="bk-mnav-btn outline"
                  onClick={() => changeMobileStep(2)}
                >
                  <FaChevronLeft /> Kembali
                </button>
                <button
                  className="bk-mnav-btn primary"
                  onClick={handleGoToStep4}
                  disabled={!isFormFilled}
                >
                  Konfirmasi <FaChevronRight />
                </button>
              </div>
            </div>
          </div>

          {/* Slide 4: Konfirmasi Pemesanan */}
          <div className={`bk-mobile-slide ${mobileStep === 4 ? `is-active anim-${slideDirection}` : ""}`}>
            <div className="bk-col">
              <h2 className="bk-col-title">KONFIRMASI PEMESANAN</h2>
              <div className="bk-confirmation-scroll">
                <div className="bk-conf-banner">
                  <span className="bk-conf-badge">Langkah 4 / 4</span>
                  <h3>Periksa Rincian Pemesanan</h3>
                  <p>Pastikan informasi ruangan, jadwal, dan agenda sudah benar sebelum mengajukan pemesanan.</p>
                </div>

                <div className="bk-conf-card">
                  <div className="bk-conf-room-header">
                    <img src={selectedRoom?.img} alt={selectedRoom?.name} className="bk-conf-room-img" />
                    <div className="bk-conf-room-details">
                      <h4>{selectedRoom?.name || "-"}</h4>
                      <span className="bk-conf-room-meta"><FaUserFriends /> Kapasitas: {selectedRoom?.capacity || "-"} Orang</span>
                      <span className="bk-conf-room-meta"><FaMapMarkerAlt /> {selectedRoom?.location || "-"}</span>
                    </div>
                  </div>

                  <div className="bk-conf-divider" />

                  <div className="bk-conf-details-list">
                    <div className="bk-conf-row">
                      <span className="bk-conf-label"><FaRegCalendarAlt /> Tanggal Rapat</span>
                      <strong className="bk-conf-val">{formattedDateString || "-"}</strong>
                    </div>
                    <div className="bk-conf-row">
                      <span className="bk-conf-label"><FaRegClock /> Waktu Rapat</span>
                      <strong className="bk-conf-val bk-time-highlight">{selectedTime || "-"} WIB</strong>
                    </div>
                    <div className="bk-conf-row">
                      <span className="bk-conf-label"><FaRegListAlt /> Agenda Rapat</span>
                      <strong className="bk-conf-val">{agenda || "-"}</strong>
                    </div>
                    <div className="bk-conf-row">
                      <span className="bk-conf-label"><FaRegBuilding /> Bagian / Unit Kerja</span>
                      <strong className="bk-conf-val">{finalBagianValue || "-"}</strong>
                    </div>
                    <div className="bk-conf-row">
                      <span className="bk-conf-label"><FaUsers /> Jumlah Peserta</span>
                      <strong className="bk-conf-val">{peserta ? `${peserta} Orang` : "-"}</strong>
                    </div>
                    <div className="bk-conf-row">
                      <span className="bk-conf-label"><FaFileUpload /> File Materi</span>
                      <strong className="bk-conf-val">
                        {bookingMaterials.length > 0
                          ? `${bookingMaterials.length} file dilampirkan`
                          : "Tidak ada materi"}
                      </strong>
                    </div>
                    {bookingMaterials.length > 0 && (
                      <div className="bk-conf-materials-preview">
                        {bookingMaterials.map((m) => (
                          <div key={m.id} className="bk-conf-mat-pill">
                            <FaFileUpload />
                            <span>{m.name}</span>
                            <small>({m.size})</small>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bk-mobile-nav">
                <button
                  className="bk-mnav-btn outline"
                  onClick={() => changeMobileStep(3)}
                >
                  <FaChevronLeft /> Ubah Data
                </button>
                <button
                  className="bk-mnav-btn primary"
                  onClick={handleBooking}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Memproses..." : "✓ Booking Sekarang"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL NOTIFIKASI PEMESANAN BERHASIL ── */}
      {showSuccessModal && bookedDetails && (
        <div className="bk-modal-overlay" role="presentation">
          <div className="bk-modal-card" role="dialog" aria-modal="true" aria-labelledby="booking-success-title">
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

            <h3 className="bk-modal-title" id="booking-success-title">Pemesanan Berhasil!</h3>
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

              {/* Bantuan & selesai */}
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
          role="presentation"
          onClick={() => setSelectedFacilityRoom(null)}
        >
          <div
            className="bk-facility-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-facility-title"
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
            <h3 className="bk-facility-title" id="booking-facility-title">FASILITAS</h3>
            <div className="bk-facility-list">
              {(selectedFacilityRoom.facilities || [])
                .filter((f) => {
                  if (f.status === "Tidak Tersedia" || f.status === false) return false;
                  if ((f.value || "").trim().toLowerCase() === "tidak tersedia") return false;
                  return true;
                })
                .map((f, idx) => {
                  const rawVal = (f.value || "").trim();
                  const displayValue = rawVal || "Tersedia";

                  return (
                    <div key={idx} className="bk-facility-row">
                      <div className="bk-facility-label-wrap">
                        <FacilityIcon type={f.label} />
                        <span className="bk-facility-label">{f.label}</span>
                      </div>
                      <div className="bk-facility-value">{displayValue}</div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ULASAN & BALASAN RUANGAN ── */}
      {selectedReviewRoom && (() => {
        const normSelected = (selectedReviewRoom.name || "").toLowerCase().trim();
        let sourceMeetings = [...allMeetings];
        try {
          const stored = localStorage.getItem("app_meetings");
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              const localMeetings = parsed;
              const findLocalMeeting = (meeting) => localMeetings.find((local) =>
                String(local.id || local.googleId || "") === String(meeting.id || meeting.googleId || "") ||
                (local.date === meeting.date && local.start === meeting.start && local.room === meeting.room),
              );
              sourceMeetings = allMeetings.map((meeting) => {
                const local = findLocalMeeting(meeting);
                if (!local) return meeting;
                const apiReview = meeting.review || null;
                const localReview = local.review || null;
                return {
                  ...local,
                  ...meeting,
                  review: apiReview || localReview
                    ? {
                        ...(localReview || {}),
                        ...(apiReview || {}),
                        adminReply: apiReview?.adminReply || localReview?.adminReply || null,
                      }
                    : null,
                };
              });
              const represented = new Set(sourceMeetings.map((meeting) => String(meeting.id || meeting.googleId || "")));
              sourceMeetings.push(...localMeetings.filter((meeting) => !represented.has(String(meeting.id || meeting.googleId || ""))));
            }
          }
        } catch (e) {}

        const roomReviews = sourceMeetings
          .filter((m) => {
            if (!m) return false;
            const normRoom = (m.room || "").toLowerCase().trim();
            const match =
              normRoom.includes(normSelected) ||
              normSelected.includes(normRoom) ||
              (normSelected.includes("besar") && normRoom.includes("besar")) ||
              (normSelected.includes("konsultasi") && normRoom.includes("konsultasi"));
            return match && Boolean(m.review);
          })
          .map((m) => {
            return { meeting: m, review: m.review };
          });

        return (
          <div
            className="bk-facility-overlay"
            role="presentation"
            onClick={() => setSelectedReviewRoom(null)}
          >
            <div
              className="bk-review-modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="booking-room-review-title"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="bk-facility-close-btn"
                onClick={() => setSelectedReviewRoom(null)}
                title="Tutup"
              >
                ✕
              </button>

              <div className="bk-review-modal-header">
                <div className="bk-review-modal-tag">⭐ RATING &amp; TESTIMONI</div>
                <h3 className="bk-review-modal-title" id="booking-room-review-title">{selectedReviewRoom.name}</h3>
                <p className="bk-review-modal-desc">
                  Ulasan langsung dari pengguna dan balasan resmi dari pengelola ruangan
                </p>
              </div>

              <div className="bk-review-modal-list">
                {roomReviews.length === 0 ? (
                  <div className="bk-review-empty">
                    <span className="bk-review-empty-icon">💬</span>
                    <strong>Belum ada ulasan untuk ruangan ini</strong>
                    <p>Ulasan dan balasan resmi dari pengelola ruangan akan muncul setelah rapat selesai digunakan.</p>
                  </div>
                ) : (
                  roomReviews.map((item, idx) => {
                    const r = item.review;
                    const stars = [];
                    const ratingNum = Math.round(r.rating || 5);
                    for (let s = 1; s <= 5; s++) {
                      stars.push(
                        <FaStar
                          key={s}
                          style={{
                            color: s <= ratingNum ? "#f59e0b" : "#cbd5e1",
                            fontSize: "13px",
                            marginRight: "2px",
                          }}
                        />
                      );
                    }

                    return (
                      <div key={idx} className="bk-review-item-card">
                        <div className="bk-review-item-top">
                          <div className="bk-review-item-user">
                            <strong>{r.reviewer || item.meeting.requester || "User Pemesan"}</strong>
                            <span className="bk-review-item-agenda">· {item.meeting.title}</span>
                          </div>
                          <div className="bk-review-item-stars">
                            {stars}
                            <span className="bk-review-item-score">{r.rating ? Number(r.rating).toFixed(1) : "5.0"}</span>
                          </div>
                        </div>

                        <p className="bk-review-item-comment">
                          "{r.comment || r.text || "Pengguna tidak menambahkan komentar tertulis."}"
                        </p>

                        {/* Tag fasilitas */}
                        {r.tags && r.tags.length > 0 && (
                          <div className="bk-review-item-tags">
                            {r.tags.map((t, tIdx) => (
                              <span key={tIdx} className="bk-review-tag">{t}</span>
                            ))}
                          </div>
                        )}

                        {/* Balasan dari Pengelola Ruangan */}
                        {r.adminReply ? (
                          <div className="bk-review-admin-reply">
                            <div className="bk-admin-reply-head">
                              <span className="bk-admin-reply-label"><FaRegBuilding aria-hidden="true" /> Balasan Pengelola Ruangan</span>
                              <span className="bk-admin-reply-sender">{r.adminReply.sender || "Pengelola Ruang Rapat Kemnaker"}</span>
                            </div>
                            <p className="bk-admin-reply-body">
                              "{r.adminReply.text}"
                            </p>
                          </div>
                        ) : (
                          <div className="bk-review-admin-reply-pending">
                            <span><FaRegClock aria-hidden="true" /> Menunggu balasan dari pengelola ruangan</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── POPUP FOTO RUANGAN (HANYA FOTO SAJA DENGAN MULTI-VIEW) ── */}
      {selectedRoomDetail && (
        <div
          className="bk-img-lightbox-overlay"
          role="presentation"
          onClick={() => setSelectedRoomDetail(null)}
        >
          <div
            className="bk-img-lightbox-wrapper"
            role="dialog"
            aria-modal="true"
            aria-label={`Foto ruangan ${selectedRoomDetail.name}`}
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
