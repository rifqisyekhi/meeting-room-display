const { google } = require("googleapis");
const path = require("path");

const DEFAULT_TIME_ZONE = "Asia/Jakarta";

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(
    __dirname,
    "../../credentials/google-service-account.json"
  ),
  scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
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
    const match = line.match(/^\s*(Ruang|Agenda|Bagian)\s*:\s*(.+?)\s*$/i);
    if (match) fields[match[1].toLowerCase()] = match[2];
  });

  return fields;
}

function getEventStatus(start, end, now = new Date()) {
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
  const normalized = room.trim().toLowerCase();
  if (normalized.includes("rapat besar")) return "ruangRapatBesar";
  if (normalized.includes("konsultasi")) return "ruangKonsultasi";
  return null;
}

function getRoomFromEvent(event, fields) {
  if (fields.ruang) return fields.ruang;
  const match = event.summary?.match(/\(([^)]+)\)\s*$/);
  return match?.[1] || "";
}

function toDashboardEvent(event, now, timeZone) {
  if (!event.start?.dateTime || !event.end?.dateTime) return null;

  const fields = parseDescription(event.description);
  const room = getRoomFromEvent(event, fields);
  const roomKey = getRoomKey(room);
  if (!roomKey) return null;

  const start = new Date(event.start.dateTime);
  const end = new Date(event.end.dateTime);

  return {
    roomKey,
    event: {
      agenda: fields.agenda || event.summary || "Tanpa agenda",
      bagian: fields.bagian || "-",
      tanggal: formatDate(start, timeZone),
      mulai: formatTime(start, timeZone),
      selesai: formatTime(end, timeZone),
      status: getEventStatus(start, end, now),
    },
  };
}

async function getUpcomingEvents(calendarId, options = {}) {
  const now = options.now || new Date();
  const timeZone = options.timeZone || process.env.CALENDAR_TIME_ZONE || DEFAULT_TIME_ZONE;
  const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const response = await calendar.events.list({
    calendarId,
    timeMin: now.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    timeZone,
  });
  const items = response.data.items || [];

  console.info("Google Calendar upcoming response", {
    timeZone,
    timeMin: now.toISOString(),
    timeMax: end.toISOString(),
    totalItems: items.length,
  });

  return groupEventsForDashboard(items, now, timeZone);
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

  const response = await calendar.events.list({
    calendarId,
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    timeZone,
  });

  const items = response.data.items || [];
  console.info("Google Calendar response", {
    timeZone,
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    totalItems: items.length,
    events: items.map((event) => ({
      id: event.id,
      summary: event.summary,
      start: event.start,
      end: event.end,
    })),
  });

  return groupEventsForDashboard(items, now, timeZone);
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
