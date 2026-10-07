const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const STORE_PATH = path.join(__dirname, "../../data/dashboard-store.json");
const CREDENTIALS_PATH = path.join(__dirname, "../../credentials/google-service-account.json");
const DEFAULT_TIME_ZONE = process.env.CALENDAR_TIME_ZONE || "Asia/Jakarta";

function readStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data = fs.readFileSync(STORE_PATH, "utf8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Gagal membaca dashboard store:", err);
  }
  return { rooms: [], users: [], meetings: [] };
}

function writeStore(data) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Gagal menulis dashboard store:", err);
  }
}

const DEFAULT_INITIAL_MEETING = [
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

function resetStoreForDevSession() {
  const store = readStore();
  store.meetings = [...DEFAULT_INITIAL_MEETING];
  writeStore(store);
  console.log("🔄 [DevSession] Backend store di-reset ke 1 dummy meeting untuk one flow run.");
}

// Jalankan reset saat server backend pertama kali menyala (npm run dev)
resetStoreForDevSession();


function parseDescription(description = "") {
  const fields = {};
  description.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*(Ruang|Agenda|Bagian|Pemesan|Nama|Peserta|Jumlah Peserta|Kontak|No HP|Keterangan|Catatan)\s*:\s*(.+?)\s*$/i);
    if (match) {
      fields[match[1].toLowerCase().replace(/\s+/g, "_")] = match[2].trim();
    }
  });
  return fields;
}

function getMeetingStatus(startDate, endDate, now = new Date()) {
  if (now >= startDate && now <= endDate) {
    return "Berjalan";
  }
  if (now < startDate) {
    const isToday =
      startDate.getFullYear() === now.getFullYear() &&
      startDate.getMonth() === now.getMonth() &&
      startDate.getDate() === now.getDate();
    return isToday ? "Segera" : "Akan Datang";
  }
  return "Selesai";
}

function formatTwoDigits(n) {
  return String(n).padStart(2, "0");
}

function formatDateISO(date) {
  return `${date.getFullYear()}-${formatTwoDigits(date.getMonth() + 1)}-${formatTwoDigits(date.getDate())}`;
}

function formatTimeHHMM(date) {
  return `${formatTwoDigits(date.getHours())}:${formatTwoDigits(date.getMinutes())}`;
}

async function getGoogleCalendarEvents() {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) {
    return {
      success: false,
      error: "GOOGLE_CALENDAR_ID belum dikonfigurasi di backend/.env",
    };
  }

  if (!fs.existsSync(CREDENTIALS_PATH)) {
    return {
      success: false,
      error: "File credentials belum ditemukan di backend/credentials/google-service-account.json",
    };
  }

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
    });

    const calendar = google.calendar({ version: "v3", auth });

    const now = new Date();
    // Ambil dari 30 hari ke belakang sampai 90 hari ke depan
    const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const response = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      timeZone: DEFAULT_TIME_ZONE,
      maxResults: 500,
    });

    const items = response.data.items || [];
    const meetings = [];

    items.forEach((item, index) => {
      if (!item.start?.dateTime && !item.start?.date) return;

      const startDate = item.start?.dateTime ? new Date(item.start.dateTime) : new Date(item.start.date);
      const endDate = item.end?.dateTime ? new Date(item.end.dateTime) : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

      const fields = parseDescription(item.description || "");

      let roomName = fields.ruang;
      if (!roomName) {
        const match = item.summary?.match(/\(([^)]+)\)\s*$/);
        roomName = match?.[1] || "Ruang Rapat";
      }

      const requester =
        fields.pemesan ||
        fields.nama ||
        fields.bagian ||
        item.creator?.displayName ||
        item.organizer?.displayName ||
        "Bagian Umum";

      const title = fields.agenda || item.summary || "Rapat Koordinasi";
      const participants = parseInt(fields.peserta || fields.jumlah_peserta) || (item.attendees?.length ? item.attendees.length : 10);
      const desc = fields.keterangan || fields.catatan || item.description || "";

      meetings.push({
        id: item.id || index + 1,
        title,
        requester,
        room: roomName,
        date: formatDateISO(startDate),
        start: formatTimeHHMM(startDate),
        end: formatTimeHHMM(endDate),
        status: getMeetingStatus(startDate, endDate, now),
        participants,
        desc,
      });
    });

    return {
      success: true,
      meetings,
    };
  } catch (err) {
    console.error("Error fetching Google Calendar events:", err.message);
    return {
      success: false,
      error: `Google Calendar API error: ${err.message}`,
    };
  }
}

async function getDashboardData() {
  const store = readStore();
  const calendarResult = await getGoogleCalendarEvents();

  let meetings = [];
  let isGoogleConnected = false;
  let statusMessage = "";

  if (calendarResult.success) {
    meetings = calendarResult.meetings;
    isGoogleConnected = true;
    statusMessage = `Berhasil terhubung ke Google Calendar (${meetings.length} rapat)`;
  } else {
    isGoogleConnected = false;
    statusMessage = calendarResult.error;

    // Pakai data lokal dari store
    const now = new Date();
    meetings = (store.meetings || []).map((m) => {
      try {
        const [y, mth, d] = m.date.split("-").map(Number);
        const [sh, sm] = m.start.split(":").map(Number);
        const [eh, em] = m.end.split(":").map(Number);
        const start = new Date(y, mth - 1, d, sh, sm);
        const end = new Date(y, mth - 1, d, eh, em);
        return {
          ...m,
          status: getMeetingStatus(start, end, now),
        };
      } catch {
        return m;
      }
    });
  }

  // Update status ruangan secara dinamis berdasarkan rapat yang sedang berjalan
  const rooms = (store.rooms || []).map((room) => {
    const isBusy = meetings.some(
      (m) =>
        m.status === "Berjalan" &&
        m.room.toLowerCase().includes(room.name.toLowerCase().replace("ruang ", ""))
    );
    return {
      ...room,
      status: isBusy ? "Terpakai" : room.status === "Perbaikan" ? "Perbaikan" : "Tersedia",
    };
  });

  const users = store.users || [];

  // Hitung ringkasan statistik
  const running = meetings.filter((x) => x.status === "Berjalan").length;
  const soon = meetings.filter((x) => x.status === "Segera").length;
  const done = meetings.filter((x) => x.status === "Selesai").length;
  const total = meetings.length;

  return {
    googleCalendarConnected: isGoogleConnected,
    message: statusMessage,
    meetings,
    rooms,
    users,
    stats: {
      totalMeetings: total,
      runningMeetings: running,
      soonMeetings: soon,
      doneMeetings: done,
    },
  };
}

function saveMeeting(meeting) {
  const store = readStore();
  if (!store.meetings) store.meetings = [];

  if (meeting.id) {
    const idx = store.meetings.findIndex((m) => String(m.id) === String(meeting.id));
    if (idx !== -1) {
      store.meetings[idx] = { ...store.meetings[idx], ...meeting };
    } else {
      store.meetings.unshift(meeting);
    }
  } else {
    meeting.id = Date.now();
    store.meetings.unshift(meeting);
  }

  writeStore(store);
  return meeting;
}

function deleteMeeting(id) {
  const store = readStore();
  if (!store.meetings) return false;
  store.meetings = store.meetings.filter((m) => String(m.id) !== String(id));
  writeStore(store);
  return true;
}

function saveRoom(room) {
  const store = readStore();
  if (!store.rooms) store.rooms = [];

  if (room.id) {
    const idx = store.rooms.findIndex((r) => String(r.id) === String(room.id));
    if (idx !== -1) {
      store.rooms[idx] = { ...store.rooms[idx], ...room };
    } else {
      store.rooms.push(room);
    }
  } else {
    room.id = Date.now();
    store.rooms.push(room);
  }

  writeStore(store);
  return room;
}

function saveUser(user) {
  const store = readStore();
  if (!store.users) store.users = [];

  if (user.id) {
    const idx = store.users.findIndex((u) => String(u.id) === String(user.id));
    if (idx !== -1) {
      store.users[idx] = { ...store.users[idx], ...user };
    } else {
      store.users.push(user);
    }
  } else {
    user.id = Date.now();
    store.users.push(user);
  }

  writeStore(store);
  return user;
}

function deleteUser(id) {
  const store = readStore();
  if (!store.users) return false;
  store.users = store.users.filter((u) => String(u.id) !== String(id));
  writeStore(store);
  return true;
}

module.exports = {
  getDashboardData,
  saveMeeting,
  deleteMeeting,
  saveRoom,
  saveUser,
  deleteUser,
};
