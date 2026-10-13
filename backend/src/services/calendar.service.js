const { google } = require("googleapis");
const path = require("path");

const DEFAULT_TIME_ZONE = "Asia/Jakarta";

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(
    __dirname,
    "../../credentials/google-service-account.json"
  ),
  scopes: ["https://www.googleapis.com/auth/calendar"],
});

const calendar = google.calendar({
  version: "v3",
  auth,
});

function getDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value])
  );
}

function getTimeZoneOffset(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value])
  );

  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );

  return asUtc - date.getTime();
}

function getTodayRange(now = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const { year, month, day } = getDateParts(now, timeZone);
  const midnightAsUtc = Date.UTC(Number(year), Number(month) - 1, Number(day));
  const offset = getTimeZoneOffset(new Date(midnightAsUtc), timeZone);
  const start = new Date(midnightAsUtc - offset);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return { start, end };
}

function parseDescription(description = "") {
  const fields = {};

  description.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*(Ruang|Agenda|Bagian|Pemesan|Status|Disetujui Oleh)\s*:\s*(.+?)\s*$/i);
    if (match) fields[match[1].toLowerCase()] = match[2];
  });

  return fields;
}

function getEventStatus(start, end, now = new Date(), customStatus = "") {
  // Jika waktu rapat sudah berakhir, otomatis selesai dan ruangan tersedia kembali
  if (now >= end) return "AVAILABLE";

  if (customStatus) {
    const s = customStatus.toLowerCase().trim();
    if (s.includes("menunggu") || s === "pending") return "AVAILABLE";
    if (s === "berjalan" || s === "in_progress") return "IN_PROGRESS";
    if (s === "selesai" || s === "available") return "AVAILABLE";
    if (s === "akan datang" || s === "upcoming") return "UPCOMING";
  }
  if (now >= start && now < end) return "IN_PROGRESS";
  if (now < start) return "UPCOMING";
  return "AVAILABLE";
}

function formatTime(date, timeZone) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function formatDate(date, timeZone) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(date);
}

function getRoomKey(room = "") {
  if (typeof room === "number") room = String(room);
  const normalized = (room || "").trim().toLowerCase();
  if (normalized.includes("konsultasi") || normalized === "2") return "ruangKonsultasi";
  if (normalized.includes("rapat besar") || normalized.includes("besar") || normalized.includes("rapat") || normalized === "1") {
    return "ruangRapatBesar";
  }
  return "ruangRapatBesar";
}

function getRoomFromEvent(event, fields) {
  if (fields.ruang) return fields.ruang;
  const match = event.summary?.match(/\(([^)]+)\)\s*$/);
  return match?.[1] || "";
}

/* YYYY-MM-DD menurut zona waktu kalender, bukan zona waktu server. */
function isoDate(date, timeZone) {
  const { year, month, day } = getDateParts(date, timeZone);
  return year + "-" + month + "-" + day;
}

function isMeetingActive(status = "") {
  const s = String(status || "").toLowerCase().trim();
  if (!s) return false;
  if (
    s === "dibatalkan" ||
    s === "ditolak" ||
    s === "rejected" ||
    s.includes("batal") ||
    s.includes("menunggu") ||
    s === "pending"
  ) {
    return false;
  }
  return true;
}

function meetingToDashboardEvent(meeting, now = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  if (!meeting || !meeting.date || !meeting.start || !meeting.end) return null;
  if (!isMeetingActive(meeting.status)) return null;

  const roomKey = getRoomKey(meeting.room || "");
  if (!roomKey) return null;

  const start = new Date(`${meeting.date}T${meeting.start}:00+07:00`);
  const end = new Date(`${meeting.date}T${meeting.end}:00+07:00`);

  const sLower = String(meeting.status || "").toLowerCase();
  const isPending = sLower.includes("menunggu") || sLower === "pending";
  const displayAgenda = isPending
    ? `${meeting.title || meeting.agenda || "Rapat"} (Menunggu Persetujuan)`
    : meeting.title || meeting.agenda || "Rapat";

  return {
    roomKey,
    event: {
      id: meeting.googleId || String(meeting.id),
      originalMeetingId: String(meeting.id),
      agenda: displayAgenda,
      bagian: meeting.requester || meeting.bookedBy || "-",
      tanggal: formatDate(start, timeZone),
      tanggalIso: meeting.date,
      mulai: meeting.start,
      selesai: meeting.end,
      status: getEventStatus(start, end, now, meeting.status),
    },
  };
}

function toDashboardEvent(event, now, timeZone) {
  if (!event.start?.dateTime && !event.start?.date) return null;

  const start = event.start?.dateTime ? new Date(event.start.dateTime) : new Date(event.start.date);
  const end = event.end?.dateTime ? new Date(event.end.dateTime) : new Date(start.getTime() + 2 * 60 * 60 * 1000);

  const fields = parseDescription(event.description);
  const room = getRoomFromEvent(event, fields);
  const roomKey = getRoomKey(room);
  if (!roomKey) return null;

  const rawSummary = event.summary || "Tanpa agenda";
  const cleanSummary = rawSummary.replace(/\s*\([^)]+\)\s*$/, "").trim();

  return {
    roomKey,
    event: {
      id: event.id,
      agenda: fields.agenda || cleanSummary || rawSummary,
      bagian: fields.bagian || fields.pemesan || fields.nama || "-",
      tanggal: formatDate(start, timeZone),
      tanggalIso: isoDate(start, timeZone),
      mulai: formatTime(start, timeZone),
      selesai: formatTime(end, timeZone),
      status: getEventStatus(start, end, now, fields.status),
    },
  };
}

async function getUpcomingEvents(calendarId, options = {}) {
  const now = options.now || new Date();
  const timeZone = options.timeZone || process.env.CALENDAR_TIME_ZONE || DEFAULT_TIME_ZONE;
  const end = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const todayIsoStr = isoDate(now, timeZone);

  let items = [];
  if (calendarId) {
    try {
      const response = await calendar.events.list({
        calendarId,
        timeMin: now.toISOString(),
        timeMax: end.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        timeZone,
      });
      items = response.data.items || [];
    } catch (gcalErr) {
      console.warn("[Calendar Service] Google Calendar upcoming error:", gcalErr.message);
    }
  }

  const rooms = groupEventsForDashboard(items, now, timeZone);

  // Merge rapat yang SUDAH DISETUJUI dari database/store lokal agar langsung tampil di Display TV
  try {
    const dashboardService = require("./dashboard.service");
    const store = dashboardService.readStore();
    const localMeetings = store.meetings || [];

    localMeetings.forEach((m) => {
      if (m.date >= todayIsoStr) {
        const parsed = meetingToDashboardEvent(m, now, timeZone);
        if (parsed && (parsed.event.status === "UPCOMING" || parsed.event.status === "IN_PROGRESS")) {
          const list = rooms[parsed.roomKey];
          const exists = list.findIndex(
            (e) =>
              String(e.id) === String(parsed.event.id) ||
              String(e.id) === String(m.googleId) ||
              (e.tanggalIso === parsed.event.tanggalIso && e.mulai === parsed.event.mulai)
          );
          if (exists !== -1) {
            list[exists] = { ...list[exists], ...parsed.event };
          } else {
            list.push(parsed.event);
          }
        }
      }
    });

    Object.keys(rooms).forEach((key) => {
      rooms[key] = rooms[key].filter((e) => e.status === "UPCOMING" || e.status === "IN_PROGRESS");
      rooms[key].sort((a, b) => {
        if (a.tanggalIso !== b.tanggalIso) return (a.tanggalIso || "").localeCompare(b.tanggalIso || "");
        return (a.mulai || "").localeCompare(b.mulai || "");
      });
    });
  } catch (err) {
    console.warn("[Calendar Service] Gagal merge upcoming local events:", err.message);
  }

  return rooms;
}

function groupEventsForDashboard(events, now = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const rooms = { ruangRapatBesar: [], ruangKonsultasi: [] };

  events.forEach((event) => {
    const parsed = toDashboardEvent(event, now, timeZone);
    if (parsed) rooms[parsed.roomKey].push(parsed.event);
  });

  return rooms;
}

function summarizeEvents(events, days, now, timeZone) {
  const allEvents = Object.values(groupEventsForDashboard(events, now, timeZone)).flat();
  const totalDurationMinutes = allEvents.reduce((total, event) => {
    const [startHour, startMinute] = event.mulai.split(":").map(Number);
    const [endHour, endMinute] = event.selesai.split(":").map(Number);
    return total + Math.max(0, endHour * 60 + endMinute - startHour * 60 - startMinute);
  }, 0);

  return {
    totalMeeting: allEvents.length,
    totalDurationMinutes,
    utilization: Math.round((totalDurationMinutes / Math.max(1, days * 12 * 60 * 2)) * 100),
  };
}

async function getTodayEvents(calendarId, options = {}) {
  const now = options.now || new Date();
  const timeZone = options.timeZone || process.env.CALENDAR_TIME_ZONE || DEFAULT_TIME_ZONE;
  const { start, end } = getTodayRange(now, timeZone);
  const todayIsoStr = isoDate(now, timeZone);

  let items = [];
  if (calendarId) {
    try {
      const response = await calendar.events.list({
        calendarId,
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        timeZone,
      });
      items = response.data.items || [];
    } catch (gcalErr) {
      console.warn("[Calendar Service] Google Calendar today error:", gcalErr.message);
    }
  }

  const rooms = groupEventsForDashboard(items, now, timeZone);

  // Merge rapat yang SUDAH DISETUJUI hari ini dari database/store lokal agar langsung tampil di Display TV
  try {
    const dashboardService = require("./dashboard.service");
    const store = dashboardService.readStore();
    const localMeetings = store.meetings || [];

    localMeetings.forEach((m) => {
      if (m.date === todayIsoStr) {
        const parsed = meetingToDashboardEvent(m, now, timeZone);
        if (parsed) {
          const list = rooms[parsed.roomKey];
          const exists = list.findIndex(
            (e) =>
              String(e.id) === String(parsed.event.id) ||
              String(e.id) === String(m.googleId) ||
              (e.tanggalIso === parsed.event.tanggalIso && e.mulai === parsed.event.mulai)
          );
          if (exists !== -1) {
            list[exists] = { ...list[exists], ...parsed.event };
          } else {
            list.push(parsed.event);
          }
        }
      }
    });

    Object.keys(rooms).forEach((key) => {
      rooms[key].sort((a, b) => (a.mulai || "").localeCompare(b.mulai || ""));
    });
  } catch (err) {
    console.warn("[Calendar Service] Gagal merge today local events:", err.message);
  }

  return rooms;
}

async function getYearSummary(calendarId, options = {}) {
  const now = options.now || new Date();
  const timeZone = options.timeZone || process.env.CALENDAR_TIME_ZONE || DEFAULT_TIME_ZONE;
  const { year } = getDateParts(now, timeZone);
  const yearStartAsUtc = Date.UTC(Number(year), 0, 1);
  const start = new Date(yearStartAsUtc - getTimeZoneOffset(new Date(yearStartAsUtc), timeZone));
  const response = await calendar.events.list({
    calendarId,
    timeMin: start.toISOString(),
    timeMax: now.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 2500,
    timeZone,
  });
  const items = response.data.items || [];
  const days = Math.max(1, Math.floor((now - start) / (24 * 60 * 60 * 1000)) + 1);
  console.info("Google Calendar year summary response", { timeZone, totalItems: items.length });

  return { year: Number(year), ...summarizeEvents(items, days, now, timeZone) };
}

module.exports = {
  DEFAULT_TIME_ZONE,
  getTodayRange,
  parseDescription,
  getEventStatus,
  groupEventsForDashboard,
  getTodayEvents,
  getUpcomingEvents,
  getYearSummary,
};
