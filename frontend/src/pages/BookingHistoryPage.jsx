import { useLockScroll } from "../utils/scrollLock";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaCalendarAlt, FaChevronDown, FaChevronLeft, FaChevronRight, FaClock, FaMapMarkerAlt, FaPlus, FaQrcode, FaStar, FaUsers } from "react-icons/fa";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate } from "react-router-dom";
import BookingAccountBar from "../components/BookingAccountBar";
import imgRuangRapatBesar from "../assets/Ruang Rapat Besar.jpeg";
import imgRuangKonsultasi from "../assets/Ruang Konsultasi.jpeg";
import "./BookingHistoryPage.css";

const roomDefaults = [
  { name: "Ruang Rapat Besar", location: "Gedung A - Lantai 3", capacity: 20, image: imgRuangRapatBesar },
  { name: "Ruang Konsultasi", location: "Gedung B - Lantai 2", capacity: 8, image: imgRuangKonsultasi },
];

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTH_LONG = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const formatDateIso = (d) => {
  if (!d || Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatShortDateIndo = (isoDateStr) => {
  if (!isoDateStr) return "";
  const parts = String(isoDateStr).split("-");
  if (parts.length < 3) return isoDateStr;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return isoDateStr;
  return `${d} ${MONTH_SHORT[m - 1] || ""} ${y}`;
};

const getDateFilterLabel = (from, to) => {
  if (!from && !to) return "Pilih Rentang Tanggal";
  if (from && to) {
    if (from === to) return formatShortDateIndo(from);
    const fp = from.split("-");
    const tp = to.split("-");
    if (fp[0] === tp[0] && fp[1] === tp[1]) {
      const mIdx = Number(tp[1]) - 1;
      return `${Number(fp[2])} - ${Number(tp[2])} ${MONTH_SHORT[mIdx] || ""} ${fp[0]}`;
    }
    if (fp[0] === tp[0]) {
      const fm = Number(fp[1]) - 1;
      const tm = Number(tp[1]) - 1;
      return `${Number(fp[2])} ${MONTH_SHORT[fm] || ""} - ${Number(tp[2])} ${MONTH_SHORT[tm] || ""} ${fp[0]}`;
    }
    return `${Number(fp[2])}/${Number(fp[1])}/${String(fp[0]).slice(2)} - ${Number(tp[2])}/${Number(tp[1])}/${String(tp[0]).slice(2)}`;
  }
  if (from) return `Dari ${formatShortDateIndo(from)}`;
  if (to) return `Sampai ${formatShortDateIndo(to)}`;
  return "Pilih Rentang Tanggal";
};

const statusKey = (status = "") => {
  const value = String(status || "").toLowerCase();
  if (value.includes("tolak") || value.includes("reject") || value.includes("declin") || value.includes("tidak disetujui")) return "rejected";
  if (value.includes("batal") || value.includes("cancel")) return "cancelled";
  if (value.includes("selesai") || value.includes("complete")) return "completed";
  if (value.includes("menunggu") || value.includes("pending")) return "pending";
  return "approved";
};

const timeToMinutes = (value = "") => {
  const [hour, minute] = String(value).split(":").map(Number);
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : NaN;
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

const isMeetingNotEnded = (meeting, now = new Date()) => {
  if (!meeting.date) return false;
  const end = meeting.end || meeting.endTime;
  if (!end) return false;
  const endAt = new Date(`${meeting.date}T${end}:00`);
  return !Number.isNaN(endAt.getTime()) && now < endAt;
};

const isMeetingFinished = (meeting, now = new Date()) => {
  if (!meeting.date || ["rejected", "cancelled", "pending"].includes(statusKey(meeting.status || meeting.approvalStatus))) return false;
  const end = meeting.end || meeting.endTime;
  if (!end) return false;
  const endAt = new Date(`${meeting.date}T${end}:00`);
  return !Number.isNaN(endAt.getTime()) && now >= endAt;
};

const effectiveStatusKey = (meeting, now = new Date()) => {
  const key = statusKey(meeting.status || meeting.approvalStatus);
  return key === "approved" && isMeetingFinished(meeting, now) ? "completed" : key;
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
    try {
      const s =
        sessionStorage.getItem("booking_currentUser") ||
        localStorage.getItem("booking_currentUser");
      return s ? JSON.parse(s) : {};
    } catch {
      return {};
    }
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
    } catch {
      // Use the default room list when the browser cache is unavailable.
    }
    return roomDefaults;
  });
  const [filterStatus, setFilterStatus] = useState("all");
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [extensionTarget, setExtensionTarget] = useState(null);
  const [extensionComplete, setExtensionComplete] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewViewTarget, setReviewViewTarget] = useState(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const fromDateInput = useRef(null);
  const toDateInput = useRef(null);
  const [reviewComplete, setReviewComplete] = useState(null);
  const [clockNow, setClockNow] = useState(() => new Date());
  const [recommendationTarget, setRecommendationTarget] = useState(null);
  const [selectedRecommendationSlots, setSelectedRecommendationSlots] = useState({});
  const [showAllRecommendations, setShowAllRecommendations] = useState(false);
  const [notice, setNotice] = useState("");
  const [qrModalMeeting, setQrModalMeeting] = useState(null);
  const [copiedPassUrl, setCopiedPassUrl] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef(null);

  useEffect(() => {
    if (!statusDropdownOpen) return;
    const handleClickOutside = (e) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target)) {
        setStatusDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [statusDropdownOpen]);

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const dateDropdownRef = useRef(null);
  const [tempFromDate, setTempFromDate] = useState("");
  const [tempToDate, setTempToDate] = useState("");
  const [calViewDate, setCalViewDate] = useState(() => new Date());

  useEffect(() => {
    if (!datePickerOpen) return;
    const handleClickOutside = (e) => {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target)) {
        setDatePickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [datePickerOpen]);

  const handleToggleDatePicker = () => {
    if (!datePickerOpen) {
      setTempFromDate(fromDate);
      setTempToDate(toDate);
      if (fromDate) {
        const parts = fromDate.split("-").map(Number);
        if (parts[0] && parts[1]) {
          setCalViewDate(new Date(parts[0], parts[1] - 1, 1));
        }
      } else {
        setCalViewDate(new Date());
      }
    }
    setDatePickerOpen((prev) => !prev);
  };

  const handlePrevCalMonth = () => {
    setCalViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextCalMonth = () => {
    setCalViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleCalDayClick = (isoStr) => {
    if (!tempFromDate || (tempFromDate && tempToDate)) {
      setTempFromDate(isoStr);
      setTempToDate("");
    } else {
      if (isoStr < tempFromDate) {
        setTempToDate(tempFromDate);
        setTempFromDate(isoStr);
      } else {
        setTempToDate(isoStr);
      }
    }
  };

  const handleApplyCustomDate = () => {
    setFromDate(tempFromDate);
    setToDate(tempToDate || tempFromDate);
    setDatePickerOpen(false);
  };

  const handleResetCustomDate = () => {
    setFromDate("");
    setToDate("");
    setTempFromDate("");
    setTempToDate("");
    setDatePickerOpen(false);
  };

  const calYear = calViewDate.getFullYear();
  const calMonth = calViewDate.getMonth();
  const todayIsoStr = formatDateIso(new Date());

  const calDays = useMemo(() => {
    const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const prevMonthDays = new Date(calYear, calMonth, 0).getDate();
    const list = [];

    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(calYear, calMonth - 1, prevMonthDays - i);
      list.push({
        dayNumber: d.getDate(),
        iso: formatDateIso(d),
        isCurrentMonth: false,
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(calYear, calMonth, i);
      list.push({
        dayNumber: i,
        iso: formatDateIso(d),
        isCurrentMonth: true,
      });
    }

    const remaining = (7 - (list.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(calYear, calMonth + 1, i);
      list.push({
        dayNumber: i,
        iso: formatDateIso(d),
        isCurrentMonth: false,
      });
    }

    return list;
  }, [calYear, calMonth]);

  const hasActiveModal = Boolean(
    qrModalMeeting ||
    extensionTarget ||
    extensionComplete ||
    reviewTarget ||
    reviewViewTarget ||
    reviewComplete ||
    recommendationTarget
  );

  useLockScroll(hasActiveModal);

  useEffect(() => {
    document.body.classList.remove("booking-fitscreen-active");
    document.documentElement.style.overflowY = "auto";
    document.documentElement.style.height = "auto";
    document.body.style.overflowY = "auto";
    document.body.style.height = "auto";
    const root = document.getElementById("root");
    if (root) {
      root.style.overflowY = "visible";
      root.style.height = "auto";
      root.style.maxHeight = "none";
    }
    return () => {
      document.documentElement.style.overflowY = "";
      document.documentElement.style.height = "";
      document.body.style.overflowY = "";
      document.body.style.height = "";
      if (root) {
        root.style.overflowY = "";
        root.style.height = "";
        root.style.maxHeight = "";
      }
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target)) {
        setIsStatusDropdownOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsStatusDropdownOpen(false);
      }
    };
    if (isStatusDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isStatusDropdownOpen]);

  const refreshData = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard/data");
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data.meetings)) {
        const local = readLocalMeetings();

        // Helper untuk mencocokkan meeting lokal dengan server
        const findMatchingLocal = (serverMeeting) => {
          return local.find((lm) => {
            if (String(lm.id) === String(serverMeeting.id)) return true;
            if (serverMeeting.googleId && (String(lm.googleId) === String(serverMeeting.googleId) || String(lm.id) === String(serverMeeting.googleId))) return true;
            const sameDate = lm.date === serverMeeting.date;
            const sameStart = lm.start === serverMeeting.start;
            const normLmRoom = (lm.room || "").toLowerCase().replace(/\s+/g, "");
            const normSmRoom = (serverMeeting.room || "").toLowerCase().replace(/\s+/g, "");
            const sameRoom = normLmRoom && normSmRoom && (normLmRoom.includes(normSmRoom) || normSmRoom.includes(normLmRoom));
            return sameDate && sameStart && sameRoom;
          });
        };

        const matchedLocalIds = new Set();
        const merged = data.meetings.map((meeting) => {
          const localMeeting = findMatchingLocal(meeting);
          if (localMeeting) {
            matchedLocalIds.add(String(localMeeting.id));
            if (localMeeting.googleId) matchedLocalIds.add(String(localMeeting.googleId));
          }
          return {
            ...meeting,
            end: localMeeting?.extensionHistory?.length &&
              timeToMinutes(localMeeting.end || localMeeting.endTime || "") > timeToMinutes(meeting.end || meeting.endTime || "")
              ? (localMeeting.end || localMeeting.endTime)
              : (meeting.end || meeting.endTime),
            extensionHistory: meeting.extensionHistory?.length
              ? meeting.extensionHistory
              : (localMeeting?.extensionHistory || []),
            bookedBy: meeting.bookedBy || localMeeting?.bookedBy || "",
            bookedByUsername: meeting.bookedByUsername || localMeeting?.bookedByUsername || "",
            review: meeting.review || localMeeting?.review
              ? {
                  ...(localMeeting?.review || {}),
                  ...(meeting.review || {}),
                  adminReply: meeting.review?.adminReply || localMeeting?.review?.adminReply || null,
                }
              : null,
            attendees: meeting.attendees || localMeeting?.attendees || [],
            createdAt: meeting.createdAt || localMeeting?.createdAt || null,
          };
        });

        // Sertakan permohonan lokal yang belum ada di server
        const unmergedLocals = local.filter((lm) => !matchedLocalIds.has(String(lm.id)));
        const finalMeetings = [...merged, ...unmergedLocals];

        setMeetings(finalMeetings);
        try {
          localStorage.setItem("app_meetings", JSON.stringify(finalMeetings));
        } catch {
          // Keep the in-memory booking history when local storage is unavailable.
        }
      }
      if (Array.isArray(data.rooms) && data.rooms.length) {
        let localRooms = [];
        try {
          const storedRooms = JSON.parse(localStorage.getItem("app_rooms") || "[]");
          if (Array.isArray(storedRooms)) localRooms = storedRooms;
        } catch {
          // Continue rendering rooms from the server response.
        }
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
    const handleClickOutside = (event) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target)) {
        setIsStatusDropdownOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsStatusDropdownOpen(false);
      }
    };
    if (isStatusDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isStatusDropdownOpen]);

  useEffect(() => {
    const initialFetch = setTimeout(refreshData, 0);
    const interval = setInterval(refreshData, 10000);
    return () => {
      clearTimeout(initialFetch);
      clearInterval(interval);
    };
  }, [refreshData]);

  useEffect(() => {
    const clockInterval = setInterval(() => setClockNow(new Date()), 10000);
    return () => clearInterval(clockInterval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target)) {
        setIsStatusDropdownOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsStatusDropdownOpen(false);
      }
    };
    if (isStatusDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isStatusDropdownOpen]);

  const visibleMeetings = useMemo(() => {
    const query = search.trim().toLowerCase();
    const userUname = (currentUser.username || "").toLowerCase().trim();
    const userName = (currentUser.name || "").toLowerCase().trim();
    const seen = new Set();

    return meetings.filter((meeting) => {
      if (!meeting) return false;
      const bookedUname = (meeting.bookedByUsername || meeting.username || "").toLowerCase().trim();
      const bookedName = (meeting.bookedBy || "").toLowerCase().trim();

      const belongsToUser = Boolean(
        (userUname && bookedUname && bookedUname === userUname) ||
        (userName && bookedName && bookedName === userName) ||
        (userUname && bookedName && bookedName === userUname) ||
        (userName && bookedUname && userName === bookedUname)
      );

      if (!belongsToUser) return false;
      const key = effectiveStatusKey(meeting, clockNow);
      if (filterStatus !== "all" && key !== filterStatus) return false;
      if (fromDate && (meeting.date || "") < fromDate) return false;
      if (toDate && (meeting.date || "") > toDate) return false;
      const searchText = [meeting.room, meeting.title, meeting.agenda, meeting.requester, meeting.bookedBy]
        .filter(Boolean).join(" ").toLowerCase();
      if (query && !searchText.includes(query)) return false;

      const normRoom = String(meeting.room || "").toLowerCase().replace(/\s+/g, "");
      const dedupeKey =
        meeting.originalId ||
        meeting.googleId ||
        meeting.id ||
        `${meeting.date}_${meeting.start}_${normRoom}`;

      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      if (meeting.id) seen.add(String(meeting.id));
      if (meeting.googleId) seen.add(String(meeting.googleId));
      if (meeting.originalId) seen.add(String(meeting.originalId));
      if (meeting.date && meeting.start && normRoom) {
        seen.add(`${meeting.date}_${meeting.start}_${normRoom}`);
      }
      return true;
    }).sort((a, b) => `${b.date || ""} ${b.start || ""}`.localeCompare(`${a.date || ""} ${a.start || ""}`));
  }, [meetings, currentUser, filterStatus, fromDate, toDate, search, clockNow]);

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
    setExtensionTarget(null);
    setNotice("");
    try {
      const response = await fetch("/api/dashboard/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedMeeting),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success === false) {
        throw new Error(result.error || "Gagal menyimpan perubahan booking.");
      }
      const savedMeeting = result.meeting || updatedMeeting;
      const updatedMeetings = meetings.map((item) => String(item.id) === String(meeting.id) ? savedMeeting : item);
      localStorage.setItem("app_meetings", JSON.stringify(updatedMeetings));
      setMeetings(updatedMeetings);
      setExtensionComplete({ meeting: savedMeeting, hours });
    } catch (error) {
      console.warn("Sinkronisasi tambah waktu:", error);
      setNotice(error.message || "Waktu gagal disimpan. Silakan coba lagi.");
    }
  };

  const submitReview = async () => {
    if (!reviewTarget || !reviewRating) return;
    const submittedAt = new Date().toISOString();
    const review = {
      rating: reviewRating,
      text: reviewText.trim(),
      reviewer: currentUser.name || currentUser.username || "User",
      reviewerUsername: currentUser.username || "",
      submittedAt,
    };
    const updatedMeeting = { ...reviewTarget, review };
    const updatedMeetings = meetings.map((meeting) => String(meeting.id) === String(reviewTarget.id) ? updatedMeeting : meeting);
    const notification = {
      id: `review-${reviewTarget.id}-${submittedAt}`,
      meetingId: reviewTarget.id,
      type: "MEETING_REVIEW",
      title: `Ulasan Baru — ${reviewTarget.room || "Ruang Rapat"}`,
      message: `${review.reviewer} memberi rating ${review.rating}/5${review.text ? `: ${review.text}` : "."}`,
      room: reviewTarget.room,
      requester: review.reviewer,
      date: reviewTarget.date,
      time: `${reviewTarget.start || reviewTarget.startTime} - ${reviewTarget.end || reviewTarget.endTime}`,
      rating: review.rating,
      review: review.text,
      status: "Ulasan Baru",
      targetRoles: ["Administrator", "Approval 1", "Approval 2"],
      createdAt: submittedAt,
      readBy: [],
    };

    try {
      const savedNotifications = JSON.parse(localStorage.getItem("app_notifications") || "[]");
      const existingNotifications = Array.isArray(savedNotifications) ? savedNotifications : [];
      localStorage.setItem("app_notifications", JSON.stringify([notification, ...existingNotifications]));
      localStorage.setItem("app_meetings", JSON.stringify(updatedMeetings));
      window.dispatchEvent(new Event("app_notifications_updated"));
      if (window.parent && window.parent !== window) window.parent.dispatchEvent(new Event("app_notifications_updated"));
    } catch (error) {
      console.warn("Gagal menyimpan ulasan lokal:", error);
    }

    setMeetings(updatedMeetings);
    setReviewTarget(null);
    setReviewRating(0);
    setReviewText("");
    try {
      const response = await fetch("/api/dashboard/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedMeeting),
      });
      if (!response.ok) throw new Error("Gagal menyinkronkan ulasan ke server.");
    } catch (error) {
      console.warn("Sinkronisasi ulasan:", error);
      setNotice("Ulasan tersimpan di halaman ini, tetapi gagal disinkronkan ke server.");
    }
    setReviewComplete(review);
  };

  const statusOptions = [
    { key: "pending", label: "Menunggu" },
    { key: "approved", label: "Disetujui" },
    { key: "rejected", label: "Ditolak" },
    { key: "completed", label: "Selesai" },
    { key: "cancelled", label: "Dibatalkan" },
  ];
  const activeStatusOption = statusOptions.find((opt) => opt.key === filterStatus);
  const statusButtonLabel = activeStatusOption ? activeStatusOption.label : "Status";
  const hasActiveFilters = filterStatus !== "all" || fromDate || toDate || search.trim();
  const clearFilters = () => {
    setFilterStatus("all");
    setIsStatusDropdownOpen(false);
    setFromDate("");
    setToDate("");
    setSearch("");
  };

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
            <button
              type="button"
              role="tab"
              aria-selected={filterStatus === "all"}
              className={filterStatus === "all" ? "active" : ""}
              onClick={() => {
                setFilterStatus("all");
                setIsStatusDropdownOpen(false);
              }}
            >
              Semua
            </button>
            <div className="booking-history-status-dropdown" ref={statusDropdownRef}>
              <button
                type="button"
                role="tab"
                aria-selected={filterStatus !== "all"}
                className={`booking-history-dropdown-btn ${filterStatus !== "all" ? "active" : ""}`}
                onClick={() => setIsStatusDropdownOpen((prev) => !prev)}
                aria-haspopup="listbox"
                aria-expanded={isStatusDropdownOpen}
              >
                <span>{statusButtonLabel}</span>
                <FaChevronDown className={`status-dropdown-icon ${isStatusDropdownOpen ? "open" : ""}`} />
              </button>
              {isStatusDropdownOpen && (
                <div className="booking-history-dropdown-menu" role="listbox">
                  {statusOptions.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      role="option"
                      aria-selected={filterStatus === opt.key}
                      className={`booking-history-dropdown-item ${filterStatus === opt.key ? "selected" : ""}`}
                      onClick={() => {
                        setFilterStatus(opt.key);
                        setIsStatusDropdownOpen(false);
                      }}
                    >
                      <span>{opt.label}</span>
                      {filterStatus === opt.key && <span className="status-item-check">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="booking-history-controls">
            <div className="booking-history-controls-top">
              <div className="booking-history-mobile-status-wrap" ref={statusDropdownRef}>
                <button
                  type="button"
                  className={`booking-history-mobile-status-btn ${filterStatus !== "all" ? "is-filtered" : ""} ${statusDropdownOpen ? "is-open" : ""}`}
                  onClick={() => setStatusDropdownOpen((prev) => !prev)}
                  aria-expanded={statusDropdownOpen}
                  aria-haspopup="listbox"
                  title="Pilih status"
                >
                  <span>{tabs.find(([k]) => k === filterStatus)?.[1] || "Semua"}</span>
                  <FaChevronDown className={statusDropdownOpen ? "icon-rotated" : ""} />
                </button>

                {statusDropdownOpen && (
                  <div className="booking-history-mobile-dropdown-menu" role="listbox">
                    {tabs.map(([key, label]) => {
                      const isSelected = filterStatus === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={`booking-history-mobile-dropdown-item ${isSelected ? "selected" : ""}`}
                          onClick={() => {
                            setFilterStatus(key);
                            setStatusDropdownOpen(false);
                          }}
                        >
                          <span>{label}</span>
                          {isSelected && <span className="dropdown-check-icon">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Mobile Custom Date Range Filter */}
              <div className="booking-history-mobile-date-wrap" ref={dateDropdownRef}>
                <button
                  type="button"
                  className={`booking-history-mobile-date-btn ${fromDate || toDate ? "is-filtered" : ""} ${datePickerOpen ? "is-open" : ""}`}
                  onClick={handleToggleDatePicker}
                  aria-expanded={datePickerOpen}
                  title="Pilih rentang tanggal"
                >
                  <div className="bh-mobile-date-btn-content">
                    <FaCalendarAlt className="bh-date-icon" />
                    <span className="bh-date-text">{getDateFilterLabel(fromDate, toDate)}</span>
                  </div>
                  <div className="bh-mobile-date-btn-actions">
                    {(fromDate || toDate) && (
                      <span
                        role="button"
                        tabIndex={0}
                        className="bh-date-clear-pill"
                        title="Hapus filter tanggal"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResetCustomDate();
                        }}
                      >
                        ✕
                      </span>
                    )}
                    <FaChevronDown className={`bh-chevron-icon ${datePickerOpen ? "icon-rotated" : ""}`} />
                  </div>
                </button>

                {datePickerOpen && (
                  <div className="booking-history-mobile-date-popover" role="dialog" aria-label="Pilih Rentang Tanggal">
                    {/* Month Nav */}
                    <div className="bh-cal-header">
                      <button
                        type="button"
                        className="bh-cal-nav-btn"
                        onClick={handlePrevCalMonth}
                        title="Bulan sebelumnya"
                        aria-label="Bulan sebelumnya"
                      >
                        <FaChevronLeft />
                      </button>
                      <span className="bh-cal-month-title">
                        {MONTH_LONG[calMonth]} {calYear}
                      </span>
                      <button
                        type="button"
                        className="bh-cal-nav-btn"
                        onClick={handleNextCalMonth}
                        title="Bulan selanjutnya"
                        aria-label="Bulan selanjutnya"
                      >
                        <FaChevronRight />
                      </button>
                    </div>

                    {/* Weekdays */}
                    <div className="bh-cal-weekdays">
                      {DAY_NAMES.map((d) => (
                        <span key={d}>{d}</span>
                      ))}
                    </div>

                    {/* Days Grid */}
                    <div className="bh-cal-grid">
                      {calDays.map((item) => {
                        const isStart = tempFromDate === item.iso;
                        const isEnd = tempToDate === item.iso;
                        const isInRange = Boolean(
                          tempFromDate && tempToDate && item.iso > tempFromDate && item.iso < tempToDate
                        );
                        const isSingle = (isStart && !tempToDate) || (isStart && isEnd);
                        const isToday = item.iso === todayIsoStr;

                        let classNames = "bh-cal-day";
                        if (!item.isCurrentMonth) classNames += " not-current";
                        if (isToday) classNames += " is-today";
                        if (isStart) classNames += " is-start";
                        if (isEnd) classNames += " is-end";
                        if (isSingle) classNames += " is-single";
                        if (isInRange) classNames += " in-range";

                        return (
                          <button
                            key={item.iso}
                            type="button"
                            className={classNames}
                            onClick={() => handleCalDayClick(item.iso)}
                          >
                            <span>{item.dayNumber}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Footer */}
                    <div className="bh-cal-footer">
                      <div className="bh-cal-summary">
                        {tempFromDate ? (
                          tempToDate && tempToDate !== tempFromDate ? (
                            <span>{formatShortDateIndo(tempFromDate)} – {formatShortDateIndo(tempToDate)}</span>
                          ) : (
                            <span>{formatShortDateIndo(tempFromDate)}</span>
                          )
                        ) : (
                          <span className="bh-cal-hint">Pilih tanggal</span>
                        )}
                      </div>
                      <div className="bh-cal-actions">
                        <button
                          type="button"
                          className="bh-cal-reset-btn"
                          onClick={handleResetCustomDate}
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          className="bh-cal-apply-btn"
                          onClick={handleApplyCustomDate}
                        >
                          Terapkan
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Desktop Standard Date Filter */}
              <div className="booking-history-date-filter booking-history-desktop-date" onClick={(event) => {
                if (event.target.closest("input")) return;
                const input = fromDateInput.current;
                if (typeof input?.showPicker === "function") input.showPicker();
                else input?.focus();
              }}>
                <FaCalendarAlt aria-hidden="true" />
                <span>Pilih Rentang Tanggal</span>
                <input ref={fromDateInput} type="date" aria-label="Tanggal mulai" title="Klik untuk memilih tanggal dari kalender" value={fromDate}
                  onClick={(event) => { try { event.currentTarget.showPicker?.(); } catch { /* Kalender native */ } }}
                  onChange={(event) => setFromDate(event.target.value)} />
                <span>s/d</span>
                <input ref={toDateInput} type="date" aria-label="Tanggal akhir" title="Klik untuk memilih tanggal dari kalender" value={toDate}
                  onClick={(event) => { try { event.currentTarget.showPicker?.(); } catch { /* Kalender native */ } }}
                  onChange={(event) => setToDate(event.target.value)} />
              </div>
            </div>

            <input className="booking-history-search" type="search"
              placeholder="Cari nama ruangan, agenda, atau bagian..." value={search}
              onChange={(event) => setSearch(event.target.value)} />
          </div>
        </div>
      </section>

      <section className="booking-history-list" aria-label="Daftar pemesanan">
        {visibleMeetings.length ? visibleMeetings.map((meeting) => {
          const key = effectiveStatusKey(meeting, clockNow);
          const room = rooms.find((item) => item.name?.toLowerCase() === meeting.room?.toLowerCase()) ||
            roomDefaults.find((item) => meeting.room?.toLowerCase().includes(item.name.toLowerCase())) || roomDefaults[0];
          const end = meeting.end || meeting.endTime || "00:00";
          const canExtend = key === "approved" && isExtensionWindowOpen(meeting, clockNow);
          const showExtensionButton = key === "approved" && isMeetingNotEnded(meeting, clockNow);
          const canRecommend = key === "rejected" || key === "cancelled";
          const canReview = key === "completed" && !meeting.review;
          const canShowQr = (key === "approved" || key === "completed");
          const submittedAt = meeting.createdAt;
          const changedAt = key === "rejected" ? meeting.rejectedAt : meeting.approvedAt || meeting.updatedAt;
          const statusText = {
            pending: "Menunggu Persetujuan", approved: "Disetujui", rejected: "Ditolak",
            completed: "Selesai", cancelled: "Dibatalkan",
          }[key];
          return (
            <article className="booking-history-card" key={meeting.id}>
              <div className="booking-history-row">
                <div className="booking-history-expand">
                  <img className="booking-history-room-image" src={room.image || room.img || imgRuangRapatBesar} alt={meeting.room || "Ruangan"} />
                  <span className="booking-history-room-info">
                    <strong>{meeting.room || "Ruang Rapat"}</strong>
                    <small><FaMapMarkerAlt /> {room.location || "Lokasi ruangan"}</small>
                    <small><FaUsers /> Kapasitas {room.capacity || meeting.participants || "-"} Orang</small>
                    <span><FaCalendarAlt /> {formatDate(meeting.date, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</span>
                    <span><FaClock /> {meeting.start || meeting.startTime} - {end}</span>
                  </span>
                  <span className="booking-history-inline-details">
                    <span title={`Agenda: ${meeting.title || meeting.agenda || "-"}`}><strong>Agenda:</strong> {meeting.title || meeting.agenda || "-"}</span>
                    <span title={`Pemesan: ${meeting.bookedBy || meeting.requester || "-"}`}><strong>Pemesan:</strong> {meeting.bookedBy || meeting.requester || "-"}</span>
                    <span title={`Bagian: ${meeting.requester || meeting.bagian || "-"}`}><strong>Bagian:</strong> {meeting.requester || meeting.bagian || "-"}</span>
                    <span><strong>Jumlah peserta:</strong> {meeting.participants || 0} orang</span>
                    <span title={`Catatan: ${meeting.desc || meeting.notes || "-"}`}><strong>Catatan:</strong> {meeting.desc || meeting.notes || "-"}</span>
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
                </div>
                <div className="booking-history-row-actions">
                  <span className={`booking-history-status ${key}`}>{statusText}</span>
                  {canShowQr && (
                    <button type="button" className="booking-history-qr-button"
                      title="Buka QR Pass Rapat & Presensi"
                      onClick={() => { setCopiedPassUrl(false); setQrModalMeeting(meeting); }}>
                      <FaQrcode /> QR Pass
                    </button>
                  )}
                  {canRecommend && (
                    <button type="button" className="booking-history-recommendation-button"
                      onClick={() => { setSelectedRecommendationSlots({}); setShowAllRecommendations(false); setRecommendationTarget(meeting); }}>
                      Lihat Rekomendasi <FaChevronRight />
                    </button>
                  )}
                  {showExtensionButton && (
                    <button type="button" className="booking-history-add-time" disabled={!canExtend}
                      title={canExtend ? "Tambah waktu rapat" : "Aktif sejak rapat dimulai hingga 30 menit sebelum rapat selesai"}
                      onClick={() => { if (canExtend) { setNotice(""); setExtensionTarget(meeting); } }}>
                      <FaPlus /> Tambah Waktu
                    </button>
                  )}
                  {canReview && (
                    <button type="button" className="booking-history-review-button" onClick={() => {
                      setReviewTarget(meeting);
                      setReviewRating(0);
                      setReviewText("");
                    }}>
                      <FaStar /> Beri Rating
                    </button>
                  )}
                  {meeting.review && (
                    <button type="button" className="booking-history-review-button booking-history-view-review-button"
                      onClick={() => setReviewViewTarget(meeting)}>
                      <FaStar /> Lihat Rating
                    </button>
                  )}
                </div>
              </div>
              {Array.isArray(meeting.extensionHistory) && meeting.extensionHistory.length > 0 && (
                <div className="booking-history-details">
                  <span><strong>Tambahan waktu:</strong> {meeting.extensionHistory.map((item) => `+${item.hours} jam`).join(", ")}</span>
                </div>
              )}
            </article>
          );
        }) : (
          <div className="booking-history-empty" role="status">
            <strong>{hasActiveFilters ? "Tidak ada pemesanan yang cocok" : "Belum ada pemesanan"}</strong>
            <p>{hasActiveFilters ? "Coba ubah kata kunci atau rentang tanggal." : "Pemesanan ruang rapat yang kamu buat akan tampil di sini."}</p>
            {hasActiveFilters ? (
              <button type="button" onClick={clearFilters}>Hapus semua filter</button>
            ) : (
              <button type="button" onClick={() => navigate("/booking")}>Buat pemesanan</button>
            )}
          </div>
        )}
      </section>

      {notice && <div className="booking-history-notice" role="status">{notice}<button onClick={() => setNotice("")}>Tutup</button></div>}

      {extensionTarget && (
        <div className="booking-history-modal-backdrop" role="presentation" onClick={() => setExtensionTarget(null)}>
          <div className="booking-history-modal" role="dialog" aria-modal="true" aria-labelledby="booking-extension-title" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="booking-history-modal-close" onClick={() => setExtensionTarget(null)} aria-label="Tutup">×</button>
            <h2 id="booking-extension-title">Tambah Waktu Booking</h2>
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
          <div className="booking-history-modal booking-history-extension-success" role="dialog" aria-modal="true" aria-labelledby="booking-extension-success-title" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="booking-history-modal-close" onClick={() => setExtensionComplete(null)} aria-label="Tutup">×</button>
            <span className="booking-history-extension-success-icon">✓</span>
            <h2 id="booking-extension-success-title">Waktu Rapat Berhasil Ditambahkan</h2>
            <p>{extensionComplete.meeting.room} berhasil diperpanjang {extensionComplete.hours} jam.</p>
            <strong>{extensionComplete.meeting.start || extensionComplete.meeting.startTime}–{extensionComplete.meeting.end}</strong>
            <button type="button" className="booking-history-extension-success-done" onClick={() => setExtensionComplete(null)}>Selesai</button>
          </div>
        </div>
      )}

      {reviewTarget && (
        <div className="booking-history-modal-backdrop" onClick={() => setReviewTarget(null)}>
          <section className="booking-history-modal booking-history-review-modal" role="dialog" aria-modal="true" aria-labelledby="booking-review-title" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="booking-history-modal-close" onClick={() => setReviewTarget(null)} aria-label="Tutup">×</button>
            <h2 id="booking-review-title">Beri Rating &amp; Ulasan</h2>
            <p>{reviewTarget.room} · {formatDate(reviewTarget.date, { day: "2-digit", month: "long", year: "numeric" })}</p>
            <label className="booking-review-rating-label">Rating ({reviewRating}/5)</label>
            <div className="booking-review-stars" role="radiogroup" aria-label="Pilih rating">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button key={rating} type="button" role="radio" aria-checked={reviewRating === rating}
                  aria-label={`${rating} dari 5 bintang`} onClick={() => setReviewRating(rating)}>
                  <FaStar className={rating <= reviewRating ? "selected" : ""} />
                </button>
              ))}
            </div>
            <label className="booking-review-text-label" htmlFor="booking-review-text">Ulasan</label>
            <textarea id="booking-review-text" value={reviewText} maxLength={1000}
              onChange={(event) => setReviewText(event.target.value)} placeholder="Bagikan pengalaman Anda menggunakan ruangan ini..." />
            <div className="booking-review-actions">
              <button type="button" onClick={() => setReviewTarget(null)}>Batal</button>
              <button type="button" disabled={!reviewRating} onClick={submitReview}>Kirim Ulasan</button>
            </div>
          </section>
        </div>
      )}

      {reviewViewTarget?.review && (
        <div className="booking-history-modal-backdrop" onClick={() => setReviewViewTarget(null)}>
          <section className="booking-history-modal booking-history-review-modal booking-history-view-review-modal" role="dialog" aria-modal="true" aria-labelledby="booking-review-view-title" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="booking-history-modal-close" onClick={() => setReviewViewTarget(null)} aria-label="Tutup">×</button>
            <h2 id="booking-review-view-title">Rating &amp; Ulasan Anda</h2>
            <p>{reviewViewTarget.room} · {formatDate(reviewViewTarget.date, { day: "2-digit", month: "long", year: "numeric" })}</p>
            <span className="booking-review-rating-label">Rating ({reviewViewTarget.review.rating || 0}/5)</span>
            <div className="booking-review-stars booking-review-stars-readonly" aria-label={`Rating ${reviewViewTarget.review.rating || 0} dari 5`}>
              {[1, 2, 3, 4, 5].map((rating) => <FaStar key={rating} className={rating <= (Number(reviewViewTarget.review.rating) || 0) ? "selected" : ""} />)}
            </div>
            <span className="booking-review-text-label">Ulasan</span>
            <div className="booking-review-readonly-text">{reviewViewTarget.review.text?.trim() || "Tidak ada komentar."}</div>
            <div className={`booking-review-admin-reply ${reviewViewTarget.review.adminReply ? "has-reply" : "pending"}`}>
              <strong>Balasan Pengelola Ruangan</strong>
              {reviewViewTarget.review.adminReply?.text ? (
                <>
                  <span>{reviewViewTarget.review.adminReply.sender || "Pengelola Ruang Rapat Kemnaker"}</span>
                  <p>{reviewViewTarget.review.adminReply.text}</p>
                  {reviewViewTarget.review.adminReply.repliedAt && <small>Dibalas {formatStamp(reviewViewTarget.review.adminReply.repliedAt)}</small>}
                </>
              ) : <p>Belum ada balasan dari pengelola ruangan.</p>}
            </div>
            <div className="booking-review-actions booking-review-view-actions">
              <button type="button" onClick={() => setReviewViewTarget(null)}>Tutup</button>
            </div>
          </section>
        </div>
      )}

      {reviewComplete && (
        <div className="booking-history-modal-backdrop" onClick={() => setReviewComplete(null)}>
          <div className="booking-history-modal booking-history-extension-success" role="dialog" aria-modal="true" aria-labelledby="booking-review-success-title" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="booking-history-modal-close" onClick={() => setReviewComplete(null)} aria-label="Tutup">×</button>
            <span className="booking-history-extension-success-icon">✓</span>
            <h2 id="booking-review-success-title">Ulasan Berhasil Dikirim</h2>
            <p>Terima kasih atas ulasan Anda. Rating {reviewComplete.rating}/5 telah dikirim ke Admin dan Approval.</p>
            <button type="button" className="booking-history-extension-success-done" onClick={() => setReviewComplete(null)}>Selesai</button>
          </div>
        </div>
      )}

      {recommendationTarget && (
        <div className="booking-recommendation-backdrop" onClick={() => setRecommendationTarget(null)}>
          <section className="booking-recommendation-modal" role="dialog" aria-modal="true" aria-labelledby="booking-recommendation-title" style={{
            width: recommendedRooms.length <= 1 ? "min(600px, calc(100vw - 40px))" : recommendedRooms.length === 2 ? "min(800px, calc(100vw - 40px))" : "min(1040px, calc(100vw - 40px))",
          }} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="booking-recommendation-close" onClick={() => setRecommendationTarget(null)} aria-label="Tutup">×</button>
            <div className="booking-recommendation-title">
              <span className="booking-recommendation-error">×</span>
              <div>
                <h2 id="booking-recommendation-title">{statusKey(recommendationTarget.status || recommendationTarget.approvalStatus) === "cancelled" ? "Pemesanan Ruang Rapat Dibatalkan" : "Pemesanan Ruang Rapat Ditolak"}</h2>
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

      {qrModalMeeting && (() => {
        const passUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/meeting/${qrModalMeeting.id}`;
        const timeStr = `${qrModalMeeting.start || qrModalMeeting.startTime || "09:00"} - ${qrModalMeeting.end || qrModalMeeting.endTime || "10:00"} WIB`;
        const formattedDate = formatDate(qrModalMeeting.date, { day: "numeric", month: "short", year: "numeric" });
        return (
          <div className="booking-history-modal-backdrop" onClick={() => setQrModalMeeting(null)}>
            <div className="booking-history-modal booking-history-qr-modal" role="dialog" aria-modal="true" aria-labelledby="booking-qr-title" onClick={(event) => event.stopPropagation()}>
              
              {/* Header Bar */}
              <div className="bh-qr-header-bar">
                <span className="bh-qr-badge">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "-1.5px" }}><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                  <span>QR Presensi Mandiri</span>
                </span>
                <button type="button" className="bh-qr-close-btn" onClick={() => setQrModalMeeting(null)} aria-label="Tutup">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              {/* Title & Room / Time */}
              <h2 className="bh-qr-title" id="booking-qr-title">{qrModalMeeting.title || qrModalMeeting.agenda || "Rapat"}</h2>
              <p className="bh-qr-subtitle">
                <span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "-1.5px", marginRight: "2px" }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {qrModalMeeting.room || "Ruang Rapat"}
                </span>
                <span className="bh-qr-dot">•</span>
                <span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "-1.5px", marginRight: "2px" }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  {formattedDate} ({timeStr})
                </span>
              </p>

              {/* Info Banner */}
              <div className="bh-qr-alert">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>
                <div className="bh-qr-alert-text">
                  <strong>Presensi Otomatis:</strong> Scan QR di bawah untuk Check-In &amp; Check-Out mandiri.
                </div>
              </div>

              {/* QR Container */}
              <div className="bh-qr-code-card">
                <div className="bh-qr-wrapper">
                  <QRCodeSVG
                    value={passUrl}
                    size={170}
                    level="M"
                    marginSize={2}
                  />
                </div>
              </div>

              {/* URL & Copy Bar */}
              <div className="bh-qr-url-bar">
                <span className="bh-qr-url-text">{passUrl}</span>
                <button
                  type="button"
                  className="bh-qr-salin-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(passUrl);
                    setCopiedPassUrl(true);
                    setTimeout(() => setCopiedPassUrl(false), 2000);
                  }}
                >
                  {copiedPassUrl ? "Tersalin!" : "Salin"}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="bh-qr-actions-row">
                <a
                  href={passUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bh-qr-btn-primary"
                >
                  <span>Buka Pass Rapat</span>
                  <span style={{ fontSize: "13px", lineHeight: 1 }}>↗</span>
                </a>
                <button
                  type="button"
                  className="bh-qr-btn-secondary"
                  onClick={() => window.open(passUrl, "_blank")}
                >
                  Cetak Pass
                </button>
                <button
                  type="button"
                  className="bh-qr-btn-close"
                  onClick={() => setQrModalMeeting(null)}
                >
                  Tutup
                </button>
              </div>

            </div>
          </div>
        );
      })()}
    </main>
  );
}
