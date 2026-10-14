const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { google } = require("googleapis");
const { query, getIsConnected } = require("../db");

const STORE_PATH = path.join(__dirname, "../../data/dashboard-store.json");
const EXAMPLE_STORE_PATH = path.join(__dirname, "../../data/dashboard-store.example.json");
const CREDENTIALS_PATH = path.join(__dirname, "../../credentials/google-service-account.json");
const DEFAULT_TIME_ZONE = process.env.CALENDAR_TIME_ZONE || "Asia/Jakarta";

function hashPassword(password) {
  if (!password) return "";
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!password || !storedHash) return false;
  if (!storedHash.includes(":")) {
    return password === storedHash;
  }
  try {
    const [salt, originalHash] = storedHash.split(":");
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(originalHash, "hex"));
  } catch {
    return false;
  }
}

const DEFAULT_USERS = [
  {
    id: "admin",
    name: "Admin Utama",
    username: process.env.ADMIN_USERNAME || "admin",
    email: "admin@kemnaker.go.id",
    dept: "Biro Keuangan dan BMN",
    role: "Admin",
    status: "Aktif",
  },
  {
    id: "approval1",
    name: "Pimpinan",
    username: process.env.APPROVAL1_USERNAME || "approval1",
    email: "pimpinan@kemnaker.go.id",
    dept: "Biro Keuangan dan BMN",
    role: "Pimpinan",
    status: "Aktif",
  },
  {
    id: "approval2",
    name: "Wakil Pimpinan",
    username: process.env.APPROVAL2_USERNAME || "approval2",
    email: "wakil.pimpinan@kemnaker.go.id",
    dept: "Biro Keuangan dan BMN",
    role: "Pimpinan",
    status: "Aktif",
  },
  {
    id: "andipratama",
    name: "Andi Pratama",
    username: process.env.USER_USERNAME || "andipratama",
    email: "andi@kemnaker.go.id",
    dept: "Biro Keuangan dan BMN",
    role: "User",
    status: "Aktif",
  },
];

function readStore() {
  try {
    if (!fs.existsSync(STORE_PATH) && fs.existsSync(EXAMPLE_STORE_PATH)) {
      try {
        fs.copyFileSync(EXAMPLE_STORE_PATH, STORE_PATH);
      } catch (e) {}
    }

    if (fs.existsSync(STORE_PATH)) {
      const data = fs.readFileSync(STORE_PATH, "utf8");
      const parsed = JSON.parse(data);
      if (!parsed.rooms) parsed.rooms = [];
      if (!parsed.meetings) parsed.meetings = [];
      if (!parsed.users) parsed.users = [];

      let storeNeedsUpdate = false;

      // Hapus seluruh password plaintext dari file JSON dan migrasikan user custom ke passwordHash
      parsed.users.forEach((u) => {
        if (u.password) {
          const lowerU = (u.username || "").toLowerCase();
          if (!u.passwordHash && !["admin", "approval1", "approval2"].includes(lowerU)) {
            u.passwordHash = hashPassword(u.password);
          }
          delete u.password;
          storeNeedsUpdate = true;
        }
      });

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
          if (!parsed.users[existingIdx].username) {
            parsed.users[existingIdx].username = defUser.username;
            storeNeedsUpdate = true;
          }
          if (parsed.users[existingIdx].password) {
            delete parsed.users[existingIdx].password;
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
    const match = line.match(/^\s*(Ruang|Agenda|Bagian|Pemesan|Booked By|Username|User|Nama|Peserta|Jumlah Peserta|Kontak|No HP|Keterangan|Catatan|Status|Disetujui Oleh)\s*:\s*(.+?)\s*$/i);
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
        fields.bagian ||
        fields.pemesan ||
        fields.nama ||
        item.creator?.displayName ||
        item.organizer?.displayName ||
        "Bagian Umum";

      const bookedBy = fields.pemesan || fields.booked_by || fields.nama || requester;
      const bookedByUsername = fields.username || fields.user || fields.booked_by_username || "";

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
        bookedBy,
        bookedByUsername,
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

async function syncStoreFromDatabase() {
  if (!getIsConnected()) return;
  try {
    const roomsRes = await query("SELECT * FROM rooms ORDER BY id ASC");
    const usersRes = await query("SELECT * FROM users ORDER BY created_at ASC");
    const meetingsRes = await query("SELECT * FROM meetings ORDER BY date DESC, start_time DESC");
    const reviewsRes = await query("SELECT * FROM reviews ORDER BY created_at DESC");

    const store = readStore();
    const beforeStr = JSON.stringify(store);

    if (roomsRes.rows && roomsRes.rows.length > 0) {
      store.rooms = roomsRes.rows.map((r) => ({
        id: r.id,
        name: r.name,
        location: r.location,
        capacity: r.capacity,
        status: r.status,
        category: r.category,
        desc: r.description,
        facilities: r.facilities || [],
        images: r.images || [],
        img: r.img || (r.images && r.images[0]) || "",
      }));
    }
    if (usersRes.rows && usersRes.rows.length > 0) {
      store.users = usersRes.rows.map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        email: u.email,
        dept: u.dept,
        role: u.role,
        status: u.status,
        passwordHash: u.password_hash,
      }));
    }
    if (meetingsRes.rows && meetingsRes.rows.length > 0) {
      store.meetings = meetingsRes.rows.map((m) => ({
        id: m.id,
        googleId: m.google_id,
        title: m.title,
        agenda: m.agenda,
        desc: m.description,
        requester: m.requester,
        bookedBy: m.booked_by_name,
        bookedByUsername: m.booked_by_username,
        room: m.room_name,
        date: m.date,
        start: m.start_time,
        end: m.end_time,
        status: m.status,
        participants: m.participants,
        approvedBy: m.approved_by,
        attendees: m.attendees || [],
        materials: m.materials || [],
        checkInAt: m.checked_in_at,
        checkedInBy: m.checked_in_by,
        checkInMethod: m.check_in_method,
        checkInMethodLabel: m.check_in_method_label,
        checkOutAt: m.checked_out_at,
        checkedOutBy: m.checked_out_by,
        checkOutMethod: m.check_out_method,
        checkOutMethodLabel: m.check_out_method_label,
        createdAt: m.created_at,
      }));
    }
    if (reviewsRes.rows && reviewsRes.rows.length > 0) {
      reviewsRes.rows.forEach((rev) => {
        const m = (store.meetings || []).find((meet) => String(meet.id) === String(rev.meeting_id));
        if (m && !m.review) {
          m.review = {
            rating: rev.rating,
            text: rev.comment,
            reviewer: rev.user_name,
            submittedAt: rev.created_at,
          };
        }
      });
    }

    if (JSON.stringify(store) !== beforeStr) {
      writeStore(store);
    }
  } catch (err) {
    console.warn("[PostgreSQL] Gagal sinkronisasi data ke store lokal:", err.message);
  }
}

async function getDashboardData() {
  if (getIsConnected()) {
    await syncStoreFromDatabase();
  }
  const store = readStore();
  const calendarResult = await getGoogleCalendarEvents();

  let meetings = [];
  let isGoogleConnected = false;
  let statusMessage = "";

  if (calendarResult.success) {
    const calendarMeetings = calendarResult.meetings || [];
    const calendarMeetingsWithLocalMetadata = calendarMeetings.map((calendarMeeting) => {
      const localMeeting = (store.meetings || []).find((storedMeeting) => {
        if (String(storedMeeting.id) === String(calendarMeeting.id)) return true;
        if (storedMeeting.googleId && (String(storedMeeting.googleId) === String(calendarMeeting.id) || String(storedMeeting.googleId) === String(calendarMeeting.googleId))) return true;
        if (storedMeeting.originalId && (String(storedMeeting.originalId) === String(calendarMeeting.id) || String(storedMeeting.originalId) === String(calendarMeeting.googleId))) return true;
        const sameDate = storedMeeting.date === calendarMeeting.date;
        const sameTime = storedMeeting.start === calendarMeeting.start;
        const storedRoom = (storedMeeting.room || "").toLowerCase().replace(/\s+/g, "");
        const calendarRoom = (calendarMeeting.room || "").toLowerCase().replace(/\s+/g, "");
        return sameDate && sameTime && storedRoom && calendarRoom && (storedRoom.includes(calendarRoom) || calendarRoom.includes(storedRoom));
      });
      if (localMeeting) {
        return {
          ...calendarMeeting,
          originalId: localMeeting.originalId || localMeeting.id,
          status: calendarMeeting.status || localMeeting.status || "Akan Datang",
          approvedBy: localMeeting.approvedBy || calendarMeeting.approvedBy || "",
          approvedAt: localMeeting.approvedAt || calendarMeeting.approvedAt || "",
          materials: localMeeting.materials || calendarMeeting.materials || [],
          bookedBy: localMeeting.bookedBy || localMeeting.requester || calendarMeeting.bookedBy || "",
          bookedByUsername: localMeeting.bookedByUsername || calendarMeeting.bookedByUsername || "",
          attendees: localMeeting.attendees || calendarMeeting.attendees || [],
          review: localMeeting.review || calendarMeeting.review || null,
          checkInAt: localMeeting.checkInAt || calendarMeeting.checkInAt || null,
          checkedInBy: localMeeting.checkedInBy || calendarMeeting.checkedInBy || null,
          checkInMethod: localMeeting.checkInMethod || calendarMeeting.checkInMethod || null,
          checkInMethodLabel: localMeeting.checkInMethodLabel || calendarMeeting.checkInMethodLabel || null,
          checkOutAt: localMeeting.checkOutAt || calendarMeeting.checkOutAt || null,
          checkedOutBy: localMeeting.checkedOutBy || calendarMeeting.checkedOutBy || null,
          checkOutMethod: localMeeting.checkOutMethod || calendarMeeting.checkOutMethod || null,
          checkOutMethodLabel: localMeeting.checkOutMethodLabel || calendarMeeting.checkOutMethodLabel || null,
          createdAt: localMeeting.createdAt || calendarMeeting.createdAt || null,
        };
      }
      return calendarMeeting;
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
    meetings = [...localPendingMeetings, ...localOtherMeetings, ...calendarMeetingsWithLocalMetadata];
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
        const sLower = String(m.status || "").toLowerCase().trim();
        let s = m.status;
        if (sLower.includes("menunggu") || sLower === "pending" || sLower === "dibatalkan" || sLower === "ditolak") {
          // Tetap status aslinya, tidak boleh diubah otomatis menjadi Berjalan/Segera/Akan Datang
          s = m.status;
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

  // Deduplikasi ketat jadwal rapat berdasarkan ID, googleId, dan slot waktu (tanggal + jam mulai + ruangan)
  const uniqueMeetings = [];
  const seenSlotKeys = new Set();
  const seenMeetingIds = new Set();

  for (const m of meetings) {
    if (!m) continue;
    const idKey = String(m.id || "").trim();
    const gidKey = m.googleId ? String(m.googleId).trim() : "";
    const origKey = m.originalId ? String(m.originalId).trim() : "";
    const normRoom = String(m.room || "").toLowerCase().replace(/\s+/g, "");
    const slotKey = `${m.date}_${m.start}_${normRoom}`;

    if (idKey && seenMeetingIds.has(idKey)) continue;
    if (gidKey && seenMeetingIds.has(gidKey)) continue;
    if (origKey && seenMeetingIds.has(origKey)) continue;
    if (m.date && m.start && normRoom && seenSlotKeys.has(slotKey)) continue;

    if (idKey) seenMeetingIds.add(idKey);
    if (gidKey) seenMeetingIds.add(gidKey);
    if (origKey) seenMeetingIds.add(origKey);
    if (m.date && m.start && normRoom) seenSlotKeys.add(slotKey);

    uniqueMeetings.push(m);
  }
  meetings = uniqueMeetings;

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

  const users = (store.users || []).map(({ password, passwordHash, ...safeUser }) => safeUser);

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
  const isPending = normStatus.includes("menunggu") || normStatus === "pending" || !meeting.status;
  const isCancelled = normStatus === "dibatalkan" || normStatus === "ditolak" || normStatus === "cancelled";
  if (isPending) {
    meeting.status = "Menunggu Approval";
  }

  // Cari apakah rapat ini sudah ada di store lokal (berdasarkan ID, originalId, googleId, atau slot ruangan)
  const matchedStored = (store.meetings || []).find((m) => {
    if (originalId && (String(m.id) === String(originalId) || (m.originalId && String(m.originalId) === String(originalId)))) return true;
    if (meeting.id && (String(m.id) === String(meeting.id) || (m.originalId && String(m.originalId) === String(meeting.id)))) return true;
    if (meeting.googleId && (m.googleId === meeting.googleId || String(m.id) === String(meeting.googleId))) return true;
    const sameDate = m.date === meeting.date;
    const sameTime = m.start === meeting.start;
    const normMRoom = (m.room || "").toLowerCase().replace(/\s+/g, "");
    const normMeetRoom = (meeting.room || "").toLowerCase().replace(/\s+/g, "");
    const sameRoom = normMRoom && normMeetRoom && (normMRoom.includes(normMeetRoom) || normMeetRoom.includes(normMRoom));
    return sameDate && sameTime && sameRoom;
  });

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
        `Pemesan: ${meeting.bookedBy || meeting.requester || meeting.bagian || "Bagian Umum"}`,
      ];
      if (meeting.bookedByUsername) {
        descLines.push(`Username: ${meeting.bookedByUsername}`);
      }
      descLines.push(`Peserta: ${meeting.participants || 0}`);
      descLines.push(`Status: ${meeting.status || "Akan Datang"}`);
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
        matchedStored?.googleId ||
        (typeof meeting.id === "string" && !/^\d+$/.test(meeting.id) ? meeting.id : null) ||
        (matchedStored && typeof matchedStored.id === "string" && !/^\d+$/.test(matchedStored.id) ? matchedStored.id : null);

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
        matchedStored?.googleId ||
        (typeof meeting.id === "string" && !/^\d+$/.test(meeting.id) ? meeting.id : null) ||
        (matchedStored && typeof matchedStored.id === "string" && !/^\d+$/.test(matchedStored.id) ? matchedStored.id : null);
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
  } else if (matchedStored?.googleId) {
    meeting.googleId = matchedStored.googleId;
    meeting.id = matchedStored.googleId;
  } else if (!meeting.id) {
    meeting.id = Date.now();
  }

  // Simpan originalId agar permohonan yang disetujui tetap dapat diakses dengan ID lokal / link QR sebelumnya
  if (originalId && String(originalId) !== String(meeting.id)) {
    meeting.originalId = meeting.originalId || String(originalId);
  }
  if (matchedStored?.originalId && String(matchedStored.originalId) !== String(meeting.id)) {
    meeting.originalId = meeting.originalId || String(matchedStored.originalId);
  }

  // Simpan di local store sebagai cache
  const idx = store.meetings.findIndex((m) => {
    if (originalId && (String(m.id) === String(originalId) || (m.originalId && String(m.originalId) === String(originalId)))) return true;
    if (meeting.id && (String(m.id) === String(meeting.id) || (m.originalId && String(m.originalId) === String(meeting.id)))) return true;
    if (meeting.googleId && (m.googleId === meeting.googleId || String(m.id) === String(meeting.googleId))) return true;
    const sameDate = m.date === meeting.date;
    const sameTime = m.start === meeting.start;
    const normMRoom = (m.room || "").toLowerCase().replace(/\s+/g, "");
    const normMeetRoom = (meeting.room || "").toLowerCase().replace(/\s+/g, "");
    const sameRoom = normMRoom.includes(normMeetRoom) || normMeetRoom.includes(normMRoom);
    return sameDate && sameTime && sameRoom;
  });

  if (idx !== -1) {
    store.meetings[idx] = {
      ...store.meetings[idx],
      ...meeting,
      originalId: store.meetings[idx].originalId || meeting.originalId || (originalId ? String(originalId) : undefined),
      materials: meeting.materials || store.meetings[idx].materials || [],
      attendees: meeting.attendees || store.meetings[idx].attendees || [],
      bookedBy: meeting.bookedBy || store.meetings[idx].bookedBy || "",
      bookedByUsername: meeting.bookedByUsername || store.meetings[idx].bookedByUsername || "",
    };
  } else {
    store.meetings.unshift(meeting);
  }

  const targetIdx = idx !== -1 ? idx : 0;
  const primaryId = String(meeting.id);
  store.meetings = store.meetings.filter((m, i) => {
    if (i === targetIdx) return true;
    if (String(m.id) === primaryId) return false;
    if (originalId && String(m.id) === String(originalId)) return false;
    if (matchedStored?.id && String(m.id) === String(matchedStored.id)) return false;
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

  if (getIsConnected()) {
    try {
      // Hapus baris lama di database yang menggunakan ID sementara (originalId) atau ID duplikat
      const oldIdsToDelete = new Set();
      if (originalId && String(originalId) !== String(meeting.id)) {
        oldIdsToDelete.add(String(originalId));
      }
      if (matchedStored?.id && String(matchedStored.id) !== String(meeting.id)) {
        oldIdsToDelete.add(String(matchedStored.id));
      }
      if (matchedStored?.originalId && String(matchedStored.originalId) !== String(meeting.id)) {
        oldIdsToDelete.add(String(matchedStored.originalId));
      }
      for (const oldId of oldIdsToDelete) {
        await query(`DELETE FROM meetings WHERE id = $1`, [oldId]);
      }

      // Hapus baris lama yang memiliki slot ruangan dan jam yang persis sama tapi ID berbeda
      await query(`
        DELETE FROM meetings 
        WHERE date = $1 AND start_time = $2 AND room_name = $3 AND id <> $4
      `, [meeting.date, meeting.start, meeting.room, String(meeting.id)]);

      await query(`
        INSERT INTO meetings (
          id, google_id, title, agenda, requester, booked_by_name, booked_by_username,
          room_name, date, start_time, end_time, status, participants, approved_by,
          attendees, materials,
          checked_in_at, checked_in_by, check_in_method, check_in_method_label,
          checked_out_at, checked_out_by, check_out_method, check_out_method_label,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, NOW())
        ON CONFLICT (id) DO UPDATE SET
          google_id = EXCLUDED.google_id,
          title = EXCLUDED.title,
          agenda = EXCLUDED.agenda,
          requester = EXCLUDED.requester,
          booked_by_name = EXCLUDED.booked_by_name,
          booked_by_username = EXCLUDED.booked_by_username,
          room_name = EXCLUDED.room_name,
          date = EXCLUDED.date,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          status = EXCLUDED.status,
          participants = EXCLUDED.participants,
          approved_by = EXCLUDED.approved_by,
          attendees = EXCLUDED.attendees,
          materials = EXCLUDED.materials,
          checked_in_at = COALESCE(EXCLUDED.checked_in_at, meetings.checked_in_at),
          checked_in_by = COALESCE(EXCLUDED.checked_in_by, meetings.checked_in_by),
          check_in_method = COALESCE(EXCLUDED.check_in_method, meetings.check_in_method),
          check_in_method_label = COALESCE(EXCLUDED.check_in_method_label, meetings.check_in_method_label),
          checked_out_at = COALESCE(EXCLUDED.checked_out_at, meetings.checked_out_at),
          checked_out_by = COALESCE(EXCLUDED.checked_out_by, meetings.checked_out_by),
          check_out_method = COALESCE(EXCLUDED.check_out_method, meetings.check_out_method),
          check_out_method_label = COALESCE(EXCLUDED.check_out_method_label, meetings.check_out_method_label),
          updated_at = NOW();
      `, [
        String(meeting.id),
        meeting.googleId || null,
        meeting.title || meeting.agenda || "Rapat",
        meeting.agenda || meeting.desc || "",
        meeting.requester || "Umum",
        meeting.bookedBy || meeting.bookedByName || "",
        meeting.bookedByUsername || "",
        meeting.room || meeting.roomName || "",
        meeting.date,
        meeting.start,
        meeting.end,
        meeting.status || "Akan Datang",
        meeting.participants || 0,
        meeting.approvedBy || null,
        JSON.stringify(meeting.attendees || []),
        JSON.stringify(meeting.materials || []),
        meeting.checkInAt ? new Date(meeting.checkInAt) : null,
        meeting.checkedInBy || null,
        meeting.checkInMethod || null,
        meeting.checkInMethodLabel || null,
        meeting.checkOutAt ? new Date(meeting.checkOutAt) : null,
        meeting.checkedOutBy || null,
        meeting.checkOutMethod || null,
        meeting.checkOutMethodLabel || null,
        meeting.createdAt ? new Date(meeting.createdAt) : new Date(),
      ]);

      if (meeting.review) {
        await query(`
          INSERT INTO reviews (id, meeting_id, room_name, user_name, rating, comment, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
          ON CONFLICT (id) DO UPDATE SET
            rating = EXCLUDED.rating,
            comment = EXCLUDED.comment;
        `, [
          `rev_${meeting.id}`,
          String(meeting.id),
          meeting.room || meeting.roomName || "",
          meeting.review.reviewer || meeting.requester || "User",
          Number(meeting.review.rating) || 5,
          meeting.review.text || ""
        ]);
      }
    } catch (dbErr) {
      console.warn("[PostgreSQL] Gagal sync meeting ke DB:", dbErr.message);
    }
  }

  writeStore(store);
  return meeting;
}

async function deleteMeeting(id) {
  const store = readStore();
  const gcal = getGoogleCalendarClient();

  if (getIsConnected()) {
    try {
      await query("DELETE FROM meetings WHERE id = $1 OR google_id = $1", [String(id)]);
    } catch (dbErr) {
      console.warn("[PostgreSQL] Gagal delete meeting dari DB:", dbErr.message);
    }
  }

  if (gcal) {
    try {
      const target = String(id).trim();
      const meetingInStore = (store.meetings || []).find(
        (m) =>
          String(m.id) === target ||
          (m.googleId && String(m.googleId) === target) ||
          (m.originalId && String(m.originalId) === target)
      );
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
    const target = String(id).trim();
    store.meetings = store.meetings.filter(
      (m) =>
        String(m.id) !== target &&
        String(m.googleId) !== target &&
        String(m.originalId) !== target
    );
    writeStore(store);
  }
  return true;
}

async function getMeetingById(id) {
  const store = readStore();
  const target = String(id).trim();
  const meetings = store.meetings || [];
  let found = meetings.find(
    (m) =>
      String(m.id) === target ||
      (m.googleId && String(m.googleId) === target) ||
      (m.originalId && String(m.originalId) === target) ||
      (m.localId && String(m.localId) === target)
  );

  if (!found) {
    try {
      const dashData = await getDashboardData();
      found = (dashData.meetings || []).find(
        (m) =>
          String(m.id) === target ||
          (m.googleId && String(m.googleId) === target) ||
          (m.originalId && String(m.originalId) === target) ||
          (m.localId && String(m.localId) === target)
      );
    } catch (e) {}
  }

  return found || null;
}

async function checkInMeeting(id, checkedInBy = "Peserta (Barcode / QR)", method = "barcode_qr") {
  const store = readStore();
  const target = String(id).trim();
  let meeting = (store.meetings || []).find(
    (m) =>
      String(m.id) === target ||
      (m.googleId && String(m.googleId) === target) ||
      (m.originalId && String(m.originalId) === target)
  );
  if (!meeting) {
    meeting = await getMeetingById(id);
    if (meeting) store.meetings.unshift(meeting);
  }
  if (!meeting) return null;

  const isManual = method === "manual_admin" || (checkedInBy && checkedInBy.toLowerCase().includes("admin"));
  meeting.status = "Berjalan";
  meeting.checkInAt = new Date().toISOString();
  meeting.checkedInBy = checkedInBy;
  meeting.checkInMethod = isManual ? "manual_admin" : "barcode_qr";
  meeting.checkInMethodLabel = isManual ? "Manual oleh Admin" : "Barcode / QR Scanner (Otomatis)";

  return await saveMeeting(meeting);
}

async function checkOutMeeting(id, checkedOutBy = "Peserta (Barcode / QR)", method = "barcode_qr") {
  const store = readStore();
  const target = String(id).trim();
  let meeting = (store.meetings || []).find(
    (m) =>
      String(m.id) === target ||
      (m.googleId && String(m.googleId) === target) ||
      (m.originalId && String(m.originalId) === target)
  );
  if (!meeting) {
    meeting = await getMeetingById(id);
    if (meeting) store.meetings.unshift(meeting);
  }
  if (!meeting) return null;

  const isManual = method === "manual_admin" || (checkedOutBy && checkedOutBy.toLowerCase().includes("admin"));
  meeting.status = "Selesai";
  meeting.checkOutAt = new Date().toISOString();
  meeting.checkedOutBy = checkedOutBy;
  meeting.checkOutMethod = isManual ? "manual_admin" : "barcode_qr";
  meeting.checkOutMethodLabel = isManual ? "Manual oleh Admin" : "Barcode / QR Scanner (Otomatis)";

  return await saveMeeting(meeting);
}

async function addMeetingAttendee(id, attendeeData) {
  const store = readStore();
  const target = String(id).trim();
  let meeting = (store.meetings || []).find(
    (m) =>
      String(m.id) === target ||
      (m.googleId && String(m.googleId) === target) ||
      (m.originalId && String(m.originalId) === target)
  );
  if (!meeting) {
    try {
      const dash = await getDashboardData();
      meeting = (dash.meetings || []).find(
        (m) =>
          String(m.id) === target ||
          (m.googleId && String(m.googleId) === target) ||
          (m.originalId && String(m.originalId) === target)
      );
      if (meeting) {
        store.meetings.unshift(meeting);
      }
    } catch (e) {}
  }
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

  if (getIsConnected()) {
    query(
      "UPDATE meetings SET attendees = $1, updated_at = NOW() WHERE id = $2 OR google_id = $2",
      [JSON.stringify(meeting.attendees), target]
    ).catch((err) => console.warn("[PostgreSQL] Gagal sync attendees ke DB:", err.message));
  }

  return { meeting, attendee };
}

async function addMeetingMaterial(id, materialData) {
  const store = readStore();
  const target = String(id).trim();
  let meeting = (store.meetings || []).find(
    (m) =>
      String(m.id) === target ||
      (m.googleId && String(m.googleId) === target) ||
      (m.originalId && String(m.originalId) === target)
  );
  if (!meeting) {
    try {
      const dash = await getDashboardData();
      meeting = (dash.meetings || []).find(
        (m) =>
          String(m.id) === target ||
          (m.googleId && String(m.googleId) === target) ||
          (m.originalId && String(m.originalId) === target)
      );
      if (meeting) {
        store.meetings.unshift(meeting);
      }
    } catch (e) {}
  }
  if (!meeting) return null;

  if (!Array.isArray(meeting.materials)) {
    meeting.materials = [];
  }

  const newMaterial = {
    id: "mat_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    name: (materialData?.name || "Materi Rapat").trim(),
    type: (materialData?.type || "pdf").toLowerCase(),
    url: materialData?.url || "",
    size: materialData?.size || "",
    uploadedBy: (materialData?.uploadedBy || "Pengguna").trim(),
    uploadedAt: new Date().toISOString(),
  };

  meeting.materials.push(newMaterial);
  writeStore(store);

  if (getIsConnected()) {
    query(
      "UPDATE meetings SET materials = $1, updated_at = NOW() WHERE id = $2 OR google_id = $2",
      [JSON.stringify(meeting.materials), target]
    ).catch((err) => console.warn("[PostgreSQL] Gagal sync materials ke DB:", err.message));
  }

  return { meeting, material: newMaterial };
}

async function deleteMeetingMaterial(id, materialId) {
  const store = readStore();
  const target = String(id).trim();
  const meeting = (store.meetings || []).find(
    (m) =>
      String(m.id) === target ||
      (m.googleId && String(m.googleId) === target) ||
      (m.originalId && String(m.originalId) === target)
  );
  if (!meeting) return null;

  if (Array.isArray(meeting.materials)) {
    meeting.materials = meeting.materials.filter((mat) => String(mat.id) !== String(materialId));
    writeStore(store);

    if (getIsConnected()) {
      query(
        "UPDATE meetings SET materials = $1, updated_at = NOW() WHERE id = $2 OR google_id = $2",
        [JSON.stringify(meeting.materials), target]
      ).catch((err) => console.warn("[PostgreSQL] Gagal sync delete materials ke DB:", err.message));
    }
  }
  return { meeting };
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

  if (getIsConnected()) {
    query(`
      INSERT INTO rooms (name, location, capacity, status, category, description, facilities, images, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (name) DO UPDATE SET
        location = EXCLUDED.location,
        capacity = EXCLUDED.capacity,
        status = EXCLUDED.status,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        facilities = EXCLUDED.facilities,
        images = EXCLUDED.images,
        updated_at = NOW();
    `, [
      room.name,
      room.location || "-",
      room.capacity || 10,
      room.status || "Tersedia",
      room.category || null,
      room.desc || null,
      JSON.stringify(room.facilities || []),
      JSON.stringify(room.images || (room.img ? [room.img] : [])),
    ]).catch((err) => console.warn("[PostgreSQL] Gagal sync room ke DB:", err.message));
  }

  writeStore(store);
  return room;
}

function getUsers() {
  const store = readStore();
  return (store.users || []).map(({ password, passwordHash, ...safeUser }) => safeUser);
}

async function authenticateUser(username, password) {
  const uname = (username || "").trim().toLowerCase();
  if (!uname || !password) {
    return {
      success: false,
      message: "Username dan password wajib diisi!",
    };
  }

  const envPasswords = {
    admin: process.env.ADMIN_PASSWORD || "admin123",
    approval1: process.env.APPROVAL1_PASSWORD || "approval123",
    approval2: process.env.APPROVAL2_PASSWORD || "approval234",
    andipratama: process.env.USER_PASSWORD || "user123",
  };
  const expectedPassword = envPasswords[uname];

  // 1. Prioritaskan pengecekan langsung ke basis data PostgreSQL
  if (getIsConnected()) {
    try {
      const dbRes = await query("SELECT * FROM users WHERE LOWER(username) = LOWER($1)", [uname]);
      if (dbRes.rows && dbRes.rows.length > 0) {
        const dbUser = dbRes.rows[0];
        let isMatch = false;
        if (dbUser.password_hash) {
          isMatch = verifyPassword(password, dbUser.password_hash);
        } else if (expectedPassword && password === expectedPassword) {
          isMatch = true;
        }

        if (!isMatch) {
          return {
            success: false,
            message: "Username atau password salah!",
          };
        }

        if (dbUser.status === "Nonaktif") {
          return {
            success: false,
            message: "Akun ini sedang dinonaktifkan. Silakan hubungi Admin Utama.",
          };
        }

        return {
          success: true,
          user: {
            id: dbUser.id,
            username: dbUser.username,
            name: dbUser.name,
            role: dbUser.role,
            email: dbUser.email || "",
            dept: dbUser.dept || "",
            status: dbUser.status || "Aktif",
          },
        };
      }
    } catch (dbErr) {
      console.warn("[PostgreSQL] Gagal autentikasi via database:", dbErr.message);
    }
  }

  // 2. Fallback ke memory store lokal
  const store = readStore();
  const users = store.users || [];

  const user = users.find(
    (u) => (u.username || "").toLowerCase() === uname
  );

  if (!user) {
    return {
      success: false,
      message: "Username atau password salah!",
    };
  }

  let isMatch = false;
  if (user.passwordHash) {
    isMatch = verifyPassword(password, user.passwordHash);
  } else if (expectedPassword && password === expectedPassword) {
    isMatch = true;
  } else if (user.password && verifyPassword(password, user.password)) {
    isMatch = true;
    user.passwordHash = hashPassword(password);
    delete user.password;
    writeStore(store);
  }

  if (!isMatch) {
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

async function changeUserPassword(username, currentPassword, newPassword) {
  const authentication = await authenticateUser(username, currentPassword);
  if (!authentication.success) return authentication;

  const store = readStore();
  const user = (store.users || []).find(
    (entry) => (entry.username || "").toLowerCase() === String(username || "").trim().toLowerCase()
  );
  if (!user) return { success: false, message: "Akun tidak ditemukan." };

  user.passwordHash = hashPassword(newPassword);
  delete user.password;
  writeStore(store);

  if (getIsConnected()) {
    query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE username = $2", [
      user.passwordHash,
      user.username,
    ]).catch((err) => console.warn("[PostgreSQL] Gagal memperbarui password:", err.message));
  }

  return { success: true };
}

function saveUser(user) {
  const store = readStore();
  if (!store.users) store.users = [];

  const lowerUname = (user.username || "").trim().toLowerCase();
  const normalized = {
    id: user.id || "user_" + Date.now(),
    name: user.name || "",
    username: user.username || "",
    email: user.email || "",
    dept: user.dept || "Biro Keuangan dan BMN",
    role: user.role || "User",
    status: user.status || "Aktif",
  };

  const idx = store.users.findIndex(
    (u) =>
      String(u.id) === String(normalized.id) ||
      (u.username && normalized.username && u.username.toLowerCase() === lowerUname)
  );

  if (user.password) {
    normalized.passwordHash = hashPassword(user.password);
  } else if (idx !== -1 && store.users[idx].passwordHash) {
    normalized.passwordHash = store.users[idx].passwordHash;
  }

  if (idx !== -1) {
    store.users[idx] = { ...store.users[idx], ...normalized };
    delete store.users[idx].password;
  } else {
    store.users.push(normalized);
  }

  if (getIsConnected()) {
    query(`
      INSERT INTO users (id, name, username, email, dept, role, status, password_hash, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (username) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        dept = EXCLUDED.dept,
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
        updated_at = NOW();
    `, [
      String(normalized.id),
      normalized.name,
      normalized.username,
      normalized.email || null,
      normalized.dept || "Biro Keuangan dan BMN",
      normalized.role || "User",
      normalized.status || "Aktif",
      normalized.passwordHash || null,
    ]).catch((err) => console.warn("[PostgreSQL] Gagal sync user ke DB:", err.message));
  }

  writeStore(store);
  const { password, passwordHash, ...safeUser } = normalized;
  return safeUser;
}

function deleteUser(id) {
  const store = readStore();
  if (!store.users) return false;

  if (getIsConnected()) {
    query("DELETE FROM users WHERE id = $1 OR username = $1", [String(id)])
      .catch((err) => console.warn("[PostgreSQL] Gagal delete user dari DB:", err.message));
  }

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
  addMeetingMaterial,
  deleteMeetingMaterial,
  saveRoom,
  saveUser,
  deleteUser,
  getUsers,
  authenticateUser,
  changeUserPassword,
  readStore,
  writeStore,
  syncStoreFromDatabase,
};
