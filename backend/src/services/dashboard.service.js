const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const STORE_PATH = path.join(__dirname, "../../data/dashboard-store.json");
const CREDENTIALS_PATH = path.join(__dirname, "../../credentials/google-service-account.json");
const DEFAULT_TIME_ZONE = process.env.CALENDAR_TIME_ZONE || "Asia/Jakarta";

const DEFAULT_USERS = [
  {
    id: "admin",
    name: "Admin Utama",
    username: process.env.ADMIN_USERNAME || "admin",
    password: process.env.ADMIN_PASSWORD || "",
    email: "admin@kemnaker.go.id",
    dept: "Biro Keuangan dan BMN",
    role: "Admin",
    status: "Aktif",
  },
  {
    id: "approval1",
    name: "Pimpinan",
    username: process.env.APPROVAL1_USERNAME || "approval1",
    password: process.env.APPROVAL1_PASSWORD || "",
    email: "pimpinan@kemnaker.go.id",
    dept: "Biro Keuangan dan BMN",
    role: "Pimpinan",
    status: "Aktif",
  },
  {
    id: "approval2",
    name: "Wakil Pimpinan",
    username: process.env.APPROVAL2_USERNAME || "approval2",
    password: process.env.APPROVAL2_PASSWORD || "",
    email: "wakil.pimpinan@kemnaker.go.id",
    dept: "Biro Keuangan dan BMN",
    role: "Pimpinan",
    status: "Aktif",
  },
];

function readStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data = fs.readFileSync(STORE_PATH, "utf8");
      const parsed = JSON.parse(data);
      if (!parsed.rooms) parsed.rooms = [];
      if (!parsed.meetings) parsed.meetings = [];
      if (!parsed.users) parsed.users = [];

      let storeNeedsUpdate = false;
      DEFAULT_USERS.forEach((defUser) => {
        const existingIdx = parsed.users.findIndex(
          (u) =>
            String(u.id) === String(defUser.id) ||
            (u.username && u.username.toLowerCase() === defUser.username.toLowerCase())
        );
        if (existingIdx === -1) {
          parsed.users.unshift({ ...defUser });
          storeNeedsUpdate = true;
        } else {
          if (!parsed.users[existingIdx].password) {
            parsed.users[existingIdx].password = defUser.password;
            storeNeedsUpdate = true;
          }
          if (!parsed.users[existingIdx].username) {
            parsed.users[existingIdx].username = defUser.username;
            storeNeedsUpdate = true;
          }
        }
      });

      if (storeNeedsUpdate) {
        try {
          fs.writeFileSync(STORE_PATH, JSON.stringify(parsed, null, 2), "utf8");
        } catch (e) {}
      }

      return parsed;
    }
  } catch (err) {
    console.error("Gagal membaca dashboard store:", err);
  }
  return { rooms: [], users: [...DEFAULT_USERS], meetings: [] };
}

function writeStore(data) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Gagal menulis dashboard store:", err);
  }
}

function getGoogleCalendarClient() {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) return null;
  if (!fs.existsSync(CREDENTIALS_PATH)) return null;

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });
    const calendar = google.calendar({ version: "v3", auth });
    return { calendar, calendarId };
  } catch (err) {
    console.error("Gagal inisialisasi Google Calendar client:", err.message);
    return null;
  }
}

function parseDescription(description = "") {
  const fields = {};
  description.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*(Ruang|Agenda|Bagian|Pemesan|Nama|Peserta|Jumlah Peserta|Kontak|No HP|Keterangan|Catatan|Status|Disetujui Oleh)\s*:\s*(.+?)\s*$/i);
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
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });

    const calendar = google.calendar({ version: "v3", auth });

    const now = new Date();
    // Ambil rentang dari 30 hari ke belakang sampai 90 hari ke depan
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

      const rawSummary = item.summary || "Rapat Koordinasi";
      const cleanSummary = rawSummary.replace(/\s*\([^)]+\)\s*$/, "").trim();
      const title = fields.agenda || cleanSummary || "Rapat Koordinasi";
      const participants = parseInt(fields.peserta || fields.jumlah_peserta) || (item.attendees?.length ? item.attendees.length : 10);
      const desc = fields.keterangan || fields.catatan || item.description || "";
      let status = fields.status || getMeetingStatus(startDate, endDate, now);
      // Rapat otomatis selesai jika waktu rapat telah berakhir
      if (now >= endDate && status !== "Dibatalkan" && status !== "Menunggu Approval") {
        status = "Selesai";
      }

      meetings.push({
        id: item.id || String(index + 1),
        googleId: item.id,
        title,
        requester,
        room: roomName,
        date: formatDateISO(startDate),
        start: formatTimeHHMM(startDate),
        end: formatTimeHHMM(endDate),
        status,
        participants,
        desc,
        approvedBy: fields.disetujui_oleh || fields.approved_by || "",
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
    const calendarMeetings = calendarResult.meetings || [];
    const calendarMeetingsWithLocalReviews = calendarMeetings.map((calendarMeeting) => {
      const localMeeting = (store.meetings || []).find((storedMeeting) => {
        if (String(storedMeeting.id) === String(calendarMeeting.id)) return true;
        if (storedMeeting.googleId && String(storedMeeting.googleId) === String(calendarMeeting.id)) return true;
        const sameDate = storedMeeting.date === calendarMeeting.date;
        const sameTime = storedMeeting.start === calendarMeeting.start;
        const storedRoom = (storedMeeting.room || "").toLowerCase().replace(/\s+/g, "");
        const calendarRoom = (calendarMeeting.room || "").toLowerCase().replace(/\s+/g, "");
        return sameDate && sameTime && storedRoom && calendarRoom && (storedRoom.includes(calendarRoom) || calendarRoom.includes(storedRoom));
      });
      return localMeeting?.review ? { ...calendarMeeting, review: localMeeting.review } : calendarMeeting;
    });
    isGoogleConnected = true;
    statusMessage = `Berhasil terhubung ke Google Calendar (${calendarMeetings.length} jadwal disetujui)`;

    // Ambil permohonan dan jadwal lokal dari store yang belum ada di Google Calendar
    const localPendingMeetings = [];
    const localOtherMeetings = [];

    (store.meetings || []).forEach((sm) => {
      if (sm.status === "Dibatalkan") return;

      const alreadyInGcal = calendarMeetings.some((cm) => {
        if (String(cm.id) === String(sm.id)) return true;
        if (sm.googleId && (String(cm.id) === String(sm.googleId) || String(cm.googleId) === String(sm.googleId))) return true;
        const sameDate = cm.date === sm.date;
        const sameTime = cm.start === sm.start;
        const normCmRoom = (cm.room || "").toLowerCase().replace(/\s+/g, "");
        const normSmRoom = (sm.room || "").toLowerCase().replace(/\s+/g, "");
        const sameRoom = normCmRoom.includes(normSmRoom) || normSmRoom.includes(normCmRoom);
        return sameDate && sameTime && sameRoom;
      });

      if (!alreadyInGcal) {
        if (sm.status === "Menunggu Approval") {
          localPendingMeetings.push(sm);
        } else {
          localOtherMeetings.push(sm);
        }
      }
    });

    // Gabungkan jadwal (permohonan Menunggu Approval di urutan teratas, diikuti jadwal lokal aktif, lalu jadwal Google Calendar)
    meetings = [...localPendingMeetings, ...localOtherMeetings, ...calendarMeetingsWithLocalReviews];
  } else {
    isGoogleConnected = false;
    statusMessage = calendarResult.error;

    // Pakai data lokal dari store jika Google Calendar tidak dapat diakses
    const now = new Date();
    meetings = (store.meetings || []).map((m) => {
      try {
        const [y, mth, d] = (m.date || "").split("-").map(Number);
        const [sh, sm] = (m.start || "").split(":").map(Number);
        const [eh, em] = (m.end || "").split(":").map(Number);
        const start = new Date(y, mth - 1, d, sh, sm);
        const end = new Date(y, mth - 1, d, eh, em);
        let s = m.status;
        if (s === "Menunggu Approval" || s === "Dibatalkan") {
          // Tetap status aslinya
        } else if (now >= end) {
          s = "Selesai";
        } else if (s !== "Berjalan") {
          s = getMeetingStatus(start, end, now);
        }
        return {
          ...m,
          status: s,
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
        (m.room || "").toLowerCase().includes(room.name.toLowerCase().replace("ruang ", ""))
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

async function saveMeeting(meeting) {
  const store = readStore();
  if (!store.meetings) store.meetings = [];

  const originalId = meeting.id;
  const normStatus = (meeting.status || "").toLowerCase().trim();
  const isPending = normStatus.includes("menunggu") || normStatus === "pending";
  const isCancelled = normStatus === "dibatalkan" || normStatus === "ditolak" || normStatus === "cancelled";
  if (isPending) {
    meeting.status = "Menunggu Approval";
  } else if (!isCancelled && (!meeting.status || isPending)) {
    meeting.status = "Akan Datang";
  }
  const gcal = getGoogleCalendarClient();
  let googleEvent = null;

  // HANYA sinkronkan / masukkan ke Google Calendar jika SUDAH DISETUJUI (bukan "Menunggu Approval" dan bukan Dibatalkan)
  if (gcal && !isPending && !isCancelled) {
    try {
      const room = meeting.room || "Ruang Rapat Besar";
      const title = meeting.title || meeting.agenda || "Rapat Koordinasi";
      const summary = `${title} (${room})`;

      const descLines = [
        `Ruang: ${room}`,
        `Agenda: ${title}`,
        `Bagian: ${meeting.requester || meeting.bagian || "Bagian Umum"}`,
        `Pemesan: ${meeting.requester || meeting.bagian || "Bagian Umum"}`,
        `Peserta: ${meeting.participants || 0}`,
        `Status: ${meeting.status || "Akan Datang"}`,
      ];
      if (meeting.desc) descLines.push(`Keterangan: ${meeting.desc}`);
      if (meeting.approvedBy) descLines.push(`Disetujui Oleh: ${meeting.approvedBy}`);

      const meetingDate = meeting.date || formatDateISO(new Date());
      const startTime = meeting.start || "08:00";
      const endTime = meeting.end || "10:00";

      const startIso = new Date(`${meetingDate}T${startTime}:00+07:00`).toISOString();
      const endIso = new Date(`${meetingDate}T${endTime}:00+07:00`).toISOString();

      const requestBody = {
        summary,
        description: descLines.join("\n"),
        start: {
          dateTime: startIso,
          timeZone: DEFAULT_TIME_ZONE,
        },
        end: {
          dateTime: endIso,
          timeZone: DEFAULT_TIME_ZONE,
        },
      };

      const existingGoogleId =
        meeting.googleId ||
        (typeof meeting.id === "string" && !/^\d+$/.test(meeting.id) ? meeting.id : null);

      if (existingGoogleId) {
        try {
          const updated = await gcal.calendar.events.patch({
            calendarId: gcal.calendarId,
            eventId: existingGoogleId,
            requestBody,
          });
          googleEvent = updated.data;
          console.log(`✅ [Google Calendar] Event ${existingGoogleId} berhasil diperbarui.`);
        } catch (patchErr) {
          console.warn("[Google Calendar] Gagal patch, mencoba insert:", patchErr.message);
          const inserted = await gcal.calendar.events.insert({
            calendarId: gcal.calendarId,
            requestBody,
          });
          googleEvent = inserted.data;
          console.log(`✅ [Google Calendar] Event baru dibuat setelah approval: ${googleEvent.id}`);
        }
      } else {
        const inserted = await gcal.calendar.events.insert({
          calendarId: gcal.calendarId,
          requestBody,
        });
        googleEvent = inserted.data;
        console.log(`✅ [Google Calendar] Event baru dibuat setelah approval: ${googleEvent.id}`);
      }
    } catch (gcalErr) {
      console.error("❌ [Google Calendar] Error simpan rapat:", gcalErr.message);
    }
  } else if (gcal && isCancelled) {
    // Jika rapat ditolak/dibatalkan, pastikan dihapus dari Google Calendar jika ada
    try {
      const existingGoogleId =
        meeting.googleId ||
        (typeof meeting.id === "string" && !/^\d+$/.test(meeting.id) ? meeting.id : null);
      if (existingGoogleId) {
        await gcal.calendar.events.delete({
          calendarId: gcal.calendarId,
          eventId: existingGoogleId,
        });
        console.log(`🗑️ [Google Calendar] Event ${existingGoogleId} dihapus dari Google Calendar karena dibatalkan/ditolak.`);
        meeting.googleId = null;
      }
    } catch (cancelErr) {
      console.warn("[Google Calendar] Batal event:", cancelErr.message);
    }
  } else if (isPending) {
    console.log(`⏳ [Permohonan Booking] Rapat "${meeting.title || meeting.agenda}" disimpan dengan status Menunggu Approval (belum dikirim ke Google Calendar).`);
  }

  if (googleEvent) {
    meeting.googleId = googleEvent.id;
    meeting.id = googleEvent.id;
  } else if (!meeting.id) {
    meeting.id = Date.now();
  }

  // Simpan di local store sebagai cache
  const idx = store.meetings.findIndex((m) => {
    if (originalId && String(m.id) === String(originalId)) return true;
    if (meeting.id && String(m.id) === String(meeting.id)) return true;
    if (meeting.googleId && m.googleId === meeting.googleId) return true;
    const sameDate = m.date === meeting.date;
    const sameTime = m.start === meeting.start;
    const normMRoom = (m.room || "").toLowerCase().replace(/\s+/g, "");
    const normMeetRoom = (meeting.room || "").toLowerCase().replace(/\s+/g, "");
    const sameRoom = normMRoom.includes(normMeetRoom) || normMeetRoom.includes(normMRoom);
    return sameDate && sameTime && sameRoom;
  });

  if (idx !== -1) {
    store.meetings[idx] = { ...store.meetings[idx], ...meeting };
  } else {
    store.meetings.unshift(meeting);
  }

  const targetIdx = idx !== -1 ? idx : 0;
  const primaryId = String(meeting.id);
  store.meetings = store.meetings.filter((m, i) => {
    if (i === targetIdx) return true;
    if (String(m.id) === primaryId) return false;
    if (originalId && String(m.id) === String(originalId)) return false;
    const sameDate = m.date === meeting.date;
    const sameTime = m.start === meeting.start;
    const normMRoom = (m.room || "").toLowerCase().replace(/\s+/g, "");
    const normMeetRoom = (meeting.room || "").toLowerCase().replace(/\s+/g, "");
    const sameRoom = normMRoom.includes(normMeetRoom) || normMeetRoom.includes(normMRoom);
    if (sameDate && sameTime && sameRoom) {
      return false;
    }
    return true;
  });

  writeStore(store);
  return meeting;
}

async function deleteMeeting(id) {
  const store = readStore();
  const gcal = getGoogleCalendarClient();

  if (gcal) {
    try {
      const meetingInStore = (store.meetings || []).find((m) => String(m.id) === String(id));
      const targetGoogleId =
        meetingInStore?.googleId ||
        (typeof id === "string" && !/^\d+$/.test(id) ? id : null);

      if (targetGoogleId) {
        await gcal.calendar.events.delete({
          calendarId: gcal.calendarId,
          eventId: targetGoogleId,
        });
        console.log(`🗑️ [Google Calendar] Event ${targetGoogleId} berhasil dihapus.`);
      }
    } catch (gcalErr) {
      console.warn("⚠️ [Google Calendar] Gagal hapus event:", gcalErr.message);
    }
  }

  if (store.meetings) {
    store.meetings = store.meetings.filter(
      (m) => String(m.id) !== String(id) && m.googleId !== id
    );
    writeStore(store);
  }
  return true;
}

function getMeetingById(id) {
  const store = readStore();
  const meetings = store.meetings || [];
  return (
    meetings.find(
      (m) => String(m.id) === String(id) || String(m.googleId) === String(id)
    ) || null
  );
}

async function checkInMeeting(id, checkedInBy = "Peserta (QR Code)") {
  const store = readStore();
  const meeting = (store.meetings || []).find(
    (m) => String(m.id) === String(id) || String(m.googleId) === String(id)
  );
  if (!meeting) return null;

  meeting.status = "Berjalan";
  meeting.checkInAt = new Date().toISOString();
  meeting.checkedInBy = checkedInBy;

  return await saveMeeting(meeting);
}

async function checkOutMeeting(id, checkedOutBy = "Peserta (QR Code)") {
  const store = readStore();
  const meeting = (store.meetings || []).find(
    (m) => String(m.id) === String(id) || String(m.googleId) === String(id)
  );
  if (!meeting) return null;

  meeting.status = "Selesai";
  meeting.checkOutAt = new Date().toISOString();
  meeting.checkedOutBy = checkedOutBy;

  return await saveMeeting(meeting);
}

function addMeetingAttendee(id, attendeeData) {
  const store = readStore();
  const meeting = (store.meetings || []).find(
    (m) => String(m.id) === String(id) || String(m.googleId) === String(id)
  );
  if (!meeting) return null;

  if (!Array.isArray(meeting.attendees)) {
    meeting.attendees = [];
  }

  const attendee = {
    id: "att_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    name: (attendeeData?.name || "").trim() || "Peserta / Tamu",
    dept: (attendeeData?.dept || attendeeData?.instansi || "").trim() || "-",
    nip: (attendeeData?.nip || attendeeData?.phone || "").trim() || "",
    role: (attendeeData?.role || attendeeData?.jabatan || "").trim() || "Peserta",
    notes: (attendeeData?.notes || "").trim() || "",
    signedAt: new Date().toISOString(),
  };

  meeting.attendees.push(attendee);
  writeStore(store);
  return { meeting, attendee };
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

function getUsers() {
  const store = readStore();
  return store.users || [];
}

function authenticateUser(username, password) {
  const store = readStore();
  const users = store.users || [];
  const uname = (username || "").trim().toLowerCase();

  const user = users.find(
    (u) => (u.username || "").toLowerCase() === uname
  );

  if (!user) {
    return {
      success: false,
      message: "Username atau password salah!",
    };
  }

  const envPasswords = {
    admin: process.env.ADMIN_PASSWORD,
    approval1: process.env.APPROVAL1_PASSWORD,
    approval2: process.env.APPROVAL2_PASSWORD,
    andipratama: process.env.USER_PASSWORD,
  };
  const expectedPassword = envPasswords[uname] || user.password;

  if (expectedPassword ? (password !== expectedPassword && password !== user.password) : user.password !== password) {
    return {
      success: false,
      message: "Username atau password salah!",
    };
  }

  if (user.status === "Nonaktif") {
    return {
      success: false,
      message: "Akun ini sedang dinonaktifkan. Silakan hubungi Admin Utama.",
    };
  }

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      email: user.email || "",
      dept: user.dept || "",
      status: user.status || "Aktif",
    },
  };
}

function saveUser(user) {
  const store = readStore();
  if (!store.users) store.users = [];

  const normalized = {
    id: user.id || "user_" + Date.now(),
    name: user.name || "",
    username: user.username || "",
    password: user.password || "",
    email: user.email || "",
    dept: user.dept || "Biro Keuangan dan BMN",
    role: user.role || "User",
    status: user.status || "Aktif",
  };

  const idx = store.users.findIndex(
    (u) =>
      String(u.id) === String(normalized.id) ||
      (u.username && normalized.username && u.username.toLowerCase() === normalized.username.toLowerCase())
  );

  if (idx !== -1) {
    store.users[idx] = { ...store.users[idx], ...normalized };
  } else {
    store.users.push(normalized);
  }

  writeStore(store);
  return normalized;
}

function deleteUser(id) {
  const store = readStore();
  if (!store.users) return false;
  store.users = store.users.filter(
    (u) =>
      String(u.id) !== String(id) &&
      (u.username || "").toLowerCase() !== String(id).toLowerCase()
  );
  writeStore(store);
  return true;
}

module.exports = {
  getDashboardData,
  saveMeeting,
  deleteMeeting,
  getMeetingById,
  checkInMeeting,
  checkOutMeeting,
  addMeetingAttendee,
  saveRoom,
  saveUser,
  deleteUser,
  getUsers,
  authenticateUser,
  readStore,
  writeStore,
};
