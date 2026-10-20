const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { google } = require("googleapis");
const { query, getIsConnected } = require("../db");

const STORE_PATH = path.join(__dirname, "../../data/dashboard-store.json");
const CREDENTIALS_PATH = path.join(__dirname, "../../credentials/google-service-account.json");
const DEFAULT_TIME_ZONE = process.env.CALENDAR_TIME_ZONE || "Asia/Jakarta";
const SYSTEM_ROLE_NAMES = new Set(["admin", "pimpinan", "user"]);

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

function getMasterAccounts() {
  const adminUsername = (process.env.ADMIN_USERNAME || "admin").trim();
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const adminName = process.env.ADMIN_NAME || "Admin Utama";
  const adminEmail = process.env.ADMIN_EMAIL || "admin@kemnaker.go.id";

  const approvalUsername = (process.env.APPROVAL_USERNAME || "approval").trim();
  const approvalPassword = process.env.APPROVAL_PASSWORD || "approval123";
  const approvalName = process.env.APPROVAL_NAME || "Pimpinan Approval";
  const approvalEmail = process.env.APPROVAL_EMAIL || "approval@kemnaker.go.id";

  const approval1Username = (process.env.APPROVAL1_USERNAME || "approval1").trim();
  const approval1Password = process.env.APPROVAL1_PASSWORD || "approval123";

  const userUsername = (process.env.USER_USERNAME || "user").trim();
  const userPassword = process.env.USER_PASSWORD || "user123";
  const userName = process.env.USER_NAME || "User Pegawai";
  const userEmail = process.env.USER_EMAIL || "user@kemnaker.go.id";

  const userAndiUsername = (process.env.USER_ANDI_USERNAME || "andipratama").trim();
  const userAndiPassword = process.env.USER_ANDI_PASSWORD || "user123";

  return [
    {
      id: "admin",
      username: adminUsername,
      password: adminPassword,
      name: adminName,
      email: adminEmail,
      dept: "Biro Keuangan dan BMN",
      role: "Admin",
      status: "Aktif",
    },
    {
      id: "approval",
      username: approvalUsername,
      password: approvalPassword,
      name: approvalName,
      email: approvalEmail,
      dept: "Biro Keuangan dan BMN",
      role: "Pimpinan",
      status: "Aktif",
    },
    {
      id: "approval1",
      username: approval1Username,
      password: approval1Password,
      name: "Pimpinan",
      email: "pimpinan@kemnaker.go.id",
      dept: "Biro Keuangan dan BMN",
      role: "Pimpinan",
      status: "Aktif",
    },
    {
      id: "user",
      username: userUsername,
      password: userPassword,
      name: userName,
      email: userEmail,
      dept: "Biro Keuangan dan BMN",
      role: "User",
      status: "Aktif",
    },
    {
      id: "andipratama",
      username: userAndiUsername,
      password: userAndiPassword,
      name: "Andi Pratama",
      email: "andi@kemnaker.go.id",
      dept: "Biro Keuangan dan BMN",
      role: "User",
      status: "Aktif",
    },
  ];
}

function getDefaultSystemRoles() {
  return [
    {
      name: "Admin",
      description: "Akses penuh ke seluruh modul sistem",
      permissions: ["approve", "manageMeeting", "checkInOut", "emergencyCancel", "manageRoom", "manageUsers", "manageSettings", "viewReports"],
      isSystem: true,
    },
    {
      name: "Pimpinan",
      description: "Persetujuan permohonan rapat dan monitoring jadwal",
      permissions: ["approve", "manageMeeting", "viewReports"],
      isSystem: true,
    },
    {
      name: "User",
      description: "Pengguna standar peminjaman ruangan",
      permissions: ["checkInOut"],
      isSystem: true,
    },
  ];
}

function readStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data = fs.readFileSync(STORE_PATH, "utf8");
      const parsed = JSON.parse(data);
      if (!parsed.rooms) parsed.rooms = [];
      if (!parsed.meetings) parsed.meetings = [];
      if (!parsed.users) parsed.users = [];

      let storeNeedsUpdate = false;
      if (!Array.isArray(parsed.roles) || parsed.roles.length === 0) {
        parsed.roles = getDefaultSystemRoles();
        storeNeedsUpdate = true;
      } else {
        const sysRoles = getDefaultSystemRoles();
        sysRoles.forEach((sr) => {
          if (!parsed.roles.some((r) => r.name.toLowerCase() === sr.name.toLowerCase())) {
            parsed.roles.push(sr);
            storeNeedsUpdate = true;
          }
        });
      }

      // Pertahankan kredensial akun yang sudah ada, jangan pernah menimpa passwordHash yang sudah diupdate
      getMasterAccounts().forEach((master) => {
        const uIndex = parsed.users.findIndex(
          (u) => (u.username || "").toLowerCase() === master.username.toLowerCase()
        );
        if (uIndex >= 0) {
          const current = parsed.users[uIndex];
          parsed.users[uIndex] = {
            ...current,
            id: current.id || master.id,
            name: current.name || master.name,
            email: current.email || master.email,
            dept: current.dept || master.dept,
            role: current.role || master.role,
            status: current.status || "Aktif",
            passwordHash: current.passwordHash || hashPassword(master.password),
          };
          delete parsed.users[uIndex].password;
        }
      });

      // Jika users di store kosong sama sekali, inisialisasi akun master dari ENV
      if (parsed.users.length === 0) {
        getMasterAccounts().forEach((master) => {
          parsed.users.push({
            id: master.id,
            name: master.name,
            username: master.username,
            email: master.email,
            dept: master.dept,
            role: master.role,
            status: "Aktif",
            passwordHash: hashPassword(master.password),
          });
        });
        storeNeedsUpdate = true;
      }

      // Pastikan akun Admin Utama selalu tersedia agar sistem tidak terkunci
      if (!parsed.users.some((u) => (u.username || "").toLowerCase() === "admin")) {
        const adminMaster = getMasterAccounts().find((m) => m.username.toLowerCase() === "admin");
        if (adminMaster) {
          parsed.users.unshift({
            id: "admin",
            name: adminMaster.name,
            username: adminMaster.username,
            email: adminMaster.email,
            dept: adminMaster.dept,
            role: "Admin",
            status: "Aktif",
            passwordHash: hashPassword(adminMaster.password),
          });
          storeNeedsUpdate = true;
        }
      }

      // Hapus seluruh password plaintext dari file JSON dan migrasikan user custom ke passwordHash
      parsed.users.forEach((u) => {
        if (u.password) {
          const lowerU = (u.username || "").toLowerCase();
          if (!u.passwordHash && !["admin", "approval", "approval1", "approval2", "user"].includes(lowerU)) {
            u.passwordHash = hashPassword(u.password);
          }
          delete u.password;
          storeNeedsUpdate = true;
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
  return { rooms: [], users: [], meetings: [], roles: [] };
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

function sanitizeMeetingMaterials(materials) {
  if (!Array.isArray(materials)) return [];
  const withUrl = materials.filter((m) => Boolean(m && m.url && String(m.url).trim()));
  const withoutUrl = materials.filter((m) => !m || !m.url || !String(m.url).trim());
  const seenNames = new Set();
  const result = [];

  for (const item of withUrl) {
    const key = (item.name || "").trim().toLowerCase();
    if (key && !seenNames.has(key)) {
      seenNames.add(key);
      result.push(item);
    }
  }

  for (const item of withoutUrl) {
    const key = (item?.name || "").trim().toLowerCase();
    if (key && !seenNames.has(key)) {
      seenNames.add(key);
      result.push(item);
    }
  }

  return result;
}

function normalizeMeetingLifecycle(meeting, now = new Date()) {
  if (!meeting) return meeting;
  if (Array.isArray(meeting.materials)) {
    meeting.materials = sanitizeMeetingMaterials(meeting.materials);
  }
  const sLower = String(meeting.status || "").toLowerCase().trim();

  // Rapat yang Dibatalkan atau Ditolak tidak diubah otomatis
  if (sLower.includes("batal") || sLower.includes("tolak")) {
    meeting.status = sLower.includes("tolak") ? "Ditolak" : "Dibatalkan";
    return meeting;
  }

  // Jika masih Menunggu Approval dan belum ada tanda persetujuan, pertahankan
  const isApproved = Boolean(
    meeting.approvedBy ||
    meeting.approvedAt ||
    meeting.googleId ||
    (!sLower.includes("menunggu") && sLower !== "pending")
  );

  if (!isApproved && (sLower.includes("menunggu") || sLower === "pending")) {
    meeting.status = "Menunggu Approval";
    return meeting;
  }

  // Jika sudah ada catatan Check-Out, sesi PASTI sudah Selesai
  if (meeting.checkOutAt) {
    meeting.status = "Selesai";
    return meeting;
  }

  // Hitung status berbasis waktu (Date & Time)
  if (meeting.date) {
    try {
      const [y, mth, d] = String(meeting.date).split("-").map(Number);
      const [sh, sm] = String(meeting.start || meeting.startTime || "08:00").split(":").map(Number);
      const [eh, em] = String(meeting.end || meeting.endTime || "17:00").split(":").map(Number);
      const startDt = new Date(y, mth - 1, d, sh || 0, sm || 0, 0);
      const endDt = new Date(y, mth - 1, d, eh || 0, em || 0, 0);

      // 1. Waktu rapat sudah lewat -> PASTI Selesai
      if (now >= endDt) {
        meeting.status = "Selesai";
        return meeting;
      }

      // 2. Berada dalam rentang waktu rapat -> Berjalan
      if (now >= startDt && now < endDt) {
        meeting.status = "Berjalan";
        return meeting;
      }

      // 3. Masih sebelum waktu mulai
      if (now < startDt) {
        if (meeting.checkInAt || sLower === "berjalan") {
          meeting.status = "Berjalan";
        } else {
          const isToday =
            startDt.getFullYear() === now.getFullYear() &&
            startDt.getMonth() === now.getMonth() &&
            startDt.getDate() === now.getDate();
          meeting.status = isToday ? "Segera" : "Akan Datang";
        }
        return meeting;
      }
    } catch (err) {}
  }

  return meeting;
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
    const rolesRes = await query("SELECT * FROM roles ORDER BY is_system DESC, name ASC");
    const meetingsRes = await query("SELECT * FROM meetings ORDER BY date DESC, start_time DESC");
    const reviewsRes = await query("SELECT * FROM reviews ORDER BY created_at DESC");

    const store = readStore();
    const beforeStr = JSON.stringify(store);

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
    store.roles = rolesRes.rows.map((role) => ({
        name: role.name,
        description: role.description || "",
        permissions: Array.isArray(role.permissions) ? role.permissions : [],
        isSystem: !!role.is_system,
      }));
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
  meetings = uniqueMeetings.map((m) => normalizeMeetingLifecycle(m));

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
    roles: store.roles || [],
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

  // Ekstrak material base64 menjadi file fisik di disk jika ada agar store & DB tetap ringan
  if (Array.isArray(meeting.materials)) {
    const materialsDir = path.join(__dirname, "../../data/materials");
    meeting.materials = meeting.materials.map((mat) => {
      if (mat && mat.url && typeof mat.url === "string" && mat.url.startsWith("data:")) {
        const match = mat.url.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          try {
            if (!fs.existsSync(materialsDir)) {
              fs.mkdirSync(materialsDir, { recursive: true });
            }
            const ext = path.extname(mat.name || "").toLowerCase() || (mat.type === "pdf" ? ".pdf" : ".bin");
            const cleanExt = [".pdf", ".ppt", ".pptx", ".doc", ".docx", ".xls", ".xlsx"].includes(ext) ? ext : ".pdf";
            const fileName = `${crypto.randomUUID()}${cleanExt}`;
            const filePath = path.join(materialsDir, fileName);
            const buffer = Buffer.from(match[2], "base64");
            fs.writeFileSync(filePath, buffer);
            return {
              ...mat,
              url: `/api/dashboard/materials/files/${fileName}`,
              size: buffer.length < 1024 * 1024
                ? `${(buffer.length / 1024).toFixed(1)} KB`
                : `${(buffer.length / (1024 * 1024)).toFixed(1)} MB`,
            };
          } catch (matErr) {
            console.warn("Gagal ekstrak base64 material:", matErr.message);
          }
        }
      }
      return mat;
    });
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

  const mergedMaterials = sanitizeMeetingMaterials([
    ...(idx !== -1 ? (store.meetings[idx].materials || []) : []),
    ...(meeting.materials || []),
  ]);
  meeting.materials = mergedMaterials;

  if (idx !== -1) {
    store.meetings[idx] = {
      ...store.meetings[idx],
      ...meeting,
      originalId: store.meetings[idx].originalId || meeting.originalId || (originalId ? String(originalId) : undefined),
      materials: mergedMaterials,
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
      throw dbErr;
    }
  }

  writeStore(store);
  return meeting;
}

async function deleteMeeting(id) {
  const store = readStore();
  const gcal = getGoogleCalendarClient();
  const target = String(id).trim();
  const storedMeeting = (store.meetings || []).find((meeting) =>
    [meeting.id, meeting.googleId, meeting.originalId].some((value) => String(value || "") === target),
  );
  const identifiers = [...new Set(
    [target, storedMeeting?.id, storedMeeting?.googleId, storedMeeting?.originalId]
      .filter(Boolean)
      .map(String),
  )];
  let deletedFromDatabase = false;
  let deletedFromCalendar = false;
  let calendarError = null;

  if (getIsConnected()) {
    try {
      const deleted = await query(
        "DELETE FROM meetings WHERE id = ANY($1::text[]) OR google_id = ANY($1::text[])",
        [identifiers],
      );
      deletedFromDatabase = deleted.rowCount > 0;
    } catch (dbErr) {
      console.warn("[PostgreSQL] Gagal delete meeting dari DB:", dbErr.message);
      throw dbErr;
    }
  }

  if (gcal) {
    try {
      const targetGoogleId =
        storedMeeting?.googleId ||
        (typeof id === "string" && !/^\d+$/.test(id) ? id : null);

      if (targetGoogleId) {
        await gcal.calendar.events.delete({
          calendarId: gcal.calendarId,
          eventId: targetGoogleId,
        });
        deletedFromCalendar = true;
        console.log(`🗑️ [Google Calendar] Event ${targetGoogleId} berhasil dihapus.`);
      }
    } catch (gcalErr) {
      if ([404, 410].includes(Number(gcalErr.code || gcalErr.response?.status))) {
        deletedFromCalendar = true;
      } else {
        calendarError = gcalErr;
      }
      console.warn("⚠️ [Google Calendar] Gagal hapus event:", gcalErr.message);
    }
  }

  const meetingWasFound = Boolean(storedMeeting || deletedFromDatabase || deletedFromCalendar || calendarError);
  if (!meetingWasFound) return false;

  if (store.meetings) {
    store.meetings = store.meetings.filter(
      (m) => ![m.id, m.googleId, m.originalId].some((value) => identifiers.includes(String(value || "")))
    );
    writeStore(store);
  }

  if (calendarError) {
    const error = new Error(`Rapat terhapus dari database, tetapi Google Calendar gagal menghapus event: ${calendarError.message}`);
    error.statusCode = 502;
    throw error;
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

  if (found) {
    const prevStatus = found.status;
    found = normalizeMeetingLifecycle(found);
    if (found.status === "Selesai" && prevStatus !== "Selesai") {
      const storeIdx = store.meetings.findIndex((m) => String(m.id) === String(found.id));
      if (storeIdx !== -1) {
        store.meetings[storeIdx].status = "Selesai";
        writeStore(store);
      }
      if (getIsConnected()) {
        query(
          `UPDATE meetings SET status = 'Selesai', updated_at = NOW() WHERE id = $1 OR google_id = $1`,
          [String(found.id)]
        ).catch((err) => console.warn("Failed to auto-update meeting status in DB:", err.message));
      }
    }
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

  const bookerPicName = meeting.bookedBy || meeting.bookedByUsername || meeting.requester || "Pemesan Ruangan";
  const finalActor = checkedInBy || bookerPicName;
  const isManual = method === "manual_admin" || (finalActor && finalActor.toLowerCase().includes("admin"));
  meeting.status = "Berjalan";
  meeting.checkInAt = new Date().toISOString();
  meeting.checkedInBy = finalActor;
  meeting.checkInMethod = isManual ? "manual_admin" : "barcode_qr";
  meeting.checkInMethodLabel = isManual ? "Manual oleh Admin" : "Barcode / QR Scanner (Otomatis)";

  return await saveMeeting(meeting);
}

async function checkOutMeeting(id, checkedOutBy, method = "barcode_qr") {
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

  const bookerPicName = meeting.bookedBy || meeting.bookedByUsername || meeting.requester || "Pemesan Ruangan";
  const finalActor = checkedOutBy || bookerPicName;
  const isManual = method === "manual_admin" || (finalActor && finalActor.toLowerCase().includes("admin"));
  meeting.status = "Selesai";
  meeting.checkOutAt = new Date().toISOString();
  meeting.checkedOutBy = finalActor;
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
  if (getIsConnected()) {
    const meetingIds = [...new Set([target, meeting.id, meeting.googleId, meeting.originalId].filter(Boolean).map(String))];
    const dbResult = await query(
      "UPDATE meetings SET attendees = $1, updated_at = NOW() WHERE id = ANY($2::text[]) OR google_id = ANY($2::text[])",
      [JSON.stringify(meeting.attendees), meetingIds]
    );
    if (!dbResult.rowCount) throw new Error("Rapat belum tersimpan di database.");
  }

  writeStore(store);
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

  const existingPlaceholderIdx = meeting.materials.findIndex(
    (m) =>
      m.name &&
      newMaterial.name &&
      m.name.trim().toLowerCase() === newMaterial.name.trim().toLowerCase() &&
      !m.url,
  );

  if (existingPlaceholderIdx !== -1) {
    meeting.materials[existingPlaceholderIdx] = {
      ...meeting.materials[existingPlaceholderIdx],
      ...newMaterial,
      id: meeting.materials[existingPlaceholderIdx].id || newMaterial.id,
    };
  } else {
    meeting.materials = meeting.materials.filter(
      (m) =>
        !(m.name && newMaterial.name && m.name.trim().toLowerCase() === newMaterial.name.trim().toLowerCase() && !m.url),
    );
    meeting.materials.push(newMaterial);
  }

  meeting.materials = sanitizeMeetingMaterials(meeting.materials);
  const persistedInDatabase = getIsConnected();
  if (getIsConnected()) {
    const meetingIds = [...new Set([target, meeting.id, meeting.googleId, meeting.originalId].filter(Boolean).map(String))];
    const dbResult = await query(
      "UPDATE meetings SET materials = $1, updated_at = NOW() WHERE id = ANY($2::text[]) OR google_id = ANY($2::text[])",
      [JSON.stringify(meeting.materials), meetingIds]
    );
    if (!dbResult.rowCount) {
      throw new Error("Rapat belum tersimpan di database; materi tidak disimpan.");
    }
  }

  writeStore(store);
  return {
    meeting,
    material: newMaterial,
    storage: persistedInDatabase ? "database" : "file",
  };
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
    if (getIsConnected()) {
      const meetingIds = [...new Set([target, meeting.id, meeting.googleId, meeting.originalId].filter(Boolean).map(String))];
      const dbResult = await query(
        "UPDATE meetings SET materials = $1, updated_at = NOW() WHERE id = ANY($2::text[]) OR google_id = ANY($2::text[])",
        [JSON.stringify(meeting.materials), meetingIds]
      );
      if (!dbResult.rowCount) {
        throw new Error("Rapat belum tersimpan di database; materi tidak dihapus.");
      }
    }
    writeStore(store);
  }
  return { meeting };
}

async function saveRoom(room) {
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
    await query(`
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
    ]);
  }

  writeStore(store);
  return room;
}

async function deleteRoom(id) {
  const store = readStore();
  const room = (store.rooms || []).find((item) => String(item.id) === String(id) || item.name === String(id));
  if (!room) return false;
  if ((store.meetings || []).some((meeting) => String(meeting.room || meeting.roomName || "") === room.name)) {
    const error = new Error("Ruangan masih digunakan rapat. Hapus atau pindahkan rapat terlebih dahulu.");
    error.statusCode = 409;
    throw error;
  }
  if (getIsConnected()) {
    const usage = await query(
      "SELECT COUNT(*)::int AS count FROM meetings m LEFT JOIN rooms r ON r.id = m.room_id WHERE m.room_name = $1 OR r.name = $1",
      [room.name],
    );
    if (usage.rows[0]?.count > 0) {
      const error = new Error("Ruangan masih digunakan rapat. Hapus atau pindahkan rapat terlebih dahulu.");
      error.statusCode = 409;
      throw error;
    }
    const result = await query("DELETE FROM rooms WHERE name = $1", [room.name]);
    if (!result.rowCount) return false;
  }
  store.rooms = (store.rooms || []).filter((item) => item.name !== room.name);
  writeStore(store);
  return true;
}

async function getUsers() {
  if (getIsConnected()) {
    try {
      const res = await query("SELECT id, name, username, email, dept, role, status FROM users ORDER BY created_at ASC");
      if (res.rows && res.rows.length > 0) {
        return res.rows;
      }
    } catch (e) {
      console.warn("[PostgreSQL] Gagal membaca users:", e.message);
    }
  }
  const store = readStore();
  return (store.users || []).map(({ password, passwordHash, ...safeUser }) => safeUser);
}

async function saveRole(roleData = {}) {
  const store = readStore();
  const name = String(roleData.name || "").trim();
  const originalName = String(roleData.originalName || name).trim();
  const description = String(roleData.description || "").trim();
  const allowedPermissions = new Set([
    "approve", "manageMeeting", "checkInOut", "emergencyCancel",
    "manageRoom", "manageUsers", "manageSettings", "viewReports",
  ]);
  const permissions = [...new Set(
    (Array.isArray(roleData.permissions) ? roleData.permissions : [])
      .filter((permission) => allowedPermissions.has(permission)),
  )];
  if (!name || name.length > 80) throw new Error("Nama role wajib diisi (maksimal 80 karakter).");
  if (SYSTEM_ROLE_NAMES.has(originalName.toLowerCase())) {
    throw new Error("Role bawaan tidak dapat diubah.");
  }
  if (SYSTEM_ROLE_NAMES.has(name.toLowerCase())) {
    throw new Error("Nama tersebut sudah digunakan role bawaan.");
  }
  const roles = Array.isArray(store.roles) ? store.roles : [];
  const conflict = roles.find((role) => role.name.toLowerCase() === name.toLowerCase());
  if (conflict && conflict.name !== originalName) throw new Error("Nama role sudah digunakan.");

  const savedRole = { name, description, permissions, isSystem: false };
  if (getIsConnected()) {
    if (originalName !== name) {
      await query(
        "INSERT INTO roles (name, description, permissions, is_system) VALUES ($1, $2, $3, FALSE)",
        [name, description, JSON.stringify(permissions)],
      );
      await query("UPDATE users SET role = $1, updated_at = NOW() WHERE role = $2", [name, originalName]);
      await query("DELETE FROM roles WHERE name = $1 AND is_system = FALSE", [originalName]);
    } else {
      await query(
        `INSERT INTO roles (name, description, permissions, is_system)
         VALUES ($1, $2, $3, FALSE)
         ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description,
           permissions = EXCLUDED.permissions, updated_at = NOW()
         WHERE roles.is_system = FALSE`,
        [name, description, JSON.stringify(permissions)],
      );
    }
  }

  if (originalName !== name) {
    store.users = (store.users || []).map((user) =>
      user.role === originalName ? { ...user, role: name } : user,
    );
  }
  const index = roles.findIndex((role) => role.name === originalName);
  if (index < 0) roles.push(savedRole);
  else roles[index] = savedRole;
  store.roles = roles;
  writeStore(store);
  return savedRole;
}

async function deleteRole(name) {
  const target = String(name || "").trim();
  const store = readStore();
  const role = (store.roles || []).find((item) => item.name === target);
  if (!role) return false;
  if (role.isSystem || SYSTEM_ROLE_NAMES.has(target.toLowerCase())) {
    throw new Error("Role bawaan sistem tidak dapat dihapus.");
  }
  if ((store.users || []).some((user) => user.role === target)) {
    throw new Error("Role masih digunakan pengguna. Pindahkan pengguna ke role lain terlebih dahulu.");
  }
  if (getIsConnected()) {
    const usage = await query("SELECT COUNT(*)::int AS count FROM users WHERE role = $1", [target]);
    if (usage.rows[0]?.count > 0) {
      throw new Error("Role masih digunakan pengguna. Pindahkan pengguna ke role lain terlebih dahulu.");
    }
    const result = await query("DELETE FROM roles WHERE name = $1 AND is_system = FALSE", [target]);
    if (!result.rowCount) return false;
  }
  store.roles = (store.roles || []).filter((item) => item.name !== target);
  writeStore(store);
  return true;
}

async function getRoles() {
  if (!getIsConnected()) {
    const r = readStore().roles || [];
    return r.length ? r : getDefaultSystemRoles();
  }
  const result = await query("SELECT name, description, permissions, is_system FROM roles ORDER BY is_system DESC, name ASC");
  let roles = result.rows.map((role) => ({
    name: role.name,
    description: role.description || "",
    permissions: Array.isArray(role.permissions) ? role.permissions : [],
    isSystem: !!role.is_system,
  }));
  if (!roles.length) {
    roles = getDefaultSystemRoles();
  } else {
    const sysRoles = getDefaultSystemRoles();
    sysRoles.forEach((sr) => {
      if (!roles.some((r) => r.name.toLowerCase() === sr.name.toLowerCase())) {
        roles.push(sr);
      }
    });
  }
  const store = readStore();
  store.roles = roles;
  writeStore(store);
  return roles;
}

async function authenticateUser(username, password) {
  const uname = (username || "").trim().toLowerCase();
  if (!uname || !password) {
    return {
      success: false,
      message: "Username dan password wajib diisi!",
    };
  }

  const masterAccounts = getMasterAccounts();
  const masterMatch = masterAccounts.find(
    (m) => (m.username || "").toLowerCase() === uname
  );

  // 1. Cek langsung ke database PostgreSQL jika terkoneksi
  if (getIsConnected()) {
    try {
      const dbRes = await query("SELECT * FROM users WHERE LOWER(username) = LOWER($1)", [uname]);
      if (dbRes.rows && dbRes.rows.length > 0) {
        const dbUser = dbRes.rows[0];

        if (dbUser.status === "Nonaktif") {
          return {
            success: false,
            message: "Akun ini sedang dinonaktifkan. Silakan hubungi Admin Utama.",
          };
        }

        let isMatch = false;
        if (dbUser.password_hash) {
          isMatch = verifyPassword(password, dbUser.password_hash);
        } else if (masterMatch && (password === masterMatch.password || verifyPassword(password, hashPassword(masterMatch.password)))) {
          // Hanya fallback ke default ENV jika password_hash di DB belum diset
          isMatch = true;
          try {
            await query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [hashPassword(password), dbUser.id]);
          } catch (e) {}
        }

        if (isMatch) {
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

        return {
          success: false,
          message: "Username atau password salah!",
        };
      }
    } catch (dbErr) {
      console.warn("[PostgreSQL] Gagal autentikasi via database:", dbErr.message);
    }
  }

  // 2. Cek ke memory store lokal (JSON)
  const store = readStore();
  const users = store.users || [];
  const user = users.find(
    (u) => (u.username || "").toLowerCase() === uname
  );

  if (user) {
    if (user.status === "Nonaktif") {
      return {
        success: false,
        message: "Akun ini sedang dinonaktifkan. Silakan hubungi Admin Utama.",
      };
    }

    let isMatch = false;
    if (user.passwordHash) {
      isMatch = verifyPassword(password, user.passwordHash);
    } else if (user.password) {
      isMatch = verifyPassword(password, user.password) || password === user.password;
      if (isMatch) {
        user.passwordHash = hashPassword(password);
        delete user.password;
        writeStore(store);
      }
    } else if (masterMatch && (password === masterMatch.password || verifyPassword(password, hashPassword(masterMatch.password)))) {
      isMatch = true;
      user.passwordHash = hashPassword(password);
      writeStore(store);
    }

    if (isMatch) {
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

    return {
      success: false,
      message: "Username atau password salah!",
    };
  }

  // 3. Fallback jika akun belum tersimpan di DB maupun store tapi merupakan akun master ENV
  if (masterMatch) {
    const isMatch =
      password === masterMatch.password ||
      verifyPassword(password, hashPassword(masterMatch.password));
    if (isMatch) {
      return {
        success: true,
        user: {
          id: masterMatch.id,
          username: masterMatch.username,
          name: masterMatch.name,
          role: masterMatch.role,
          email: masterMatch.email || "",
          dept: masterMatch.dept || "Biro Keuangan dan BMN",
          status: "Aktif",
        },
      };
    }
  }

  return {
    success: false,
    message: "Username atau password salah!",
  };
}

async function changeUserPassword(username, currentPassword, newPassword) {
  const authentication = await authenticateUser(username, currentPassword);
  if (!authentication.success) return authentication;

  const targetUname = String(username || "").trim().toLowerCase();
  const store = readStore();
  let user = (store.users || []).find(
    (entry) => (entry.username || "").toLowerCase() === targetUname
  );

  const newHash = hashPassword(newPassword);

  if (user) {
    user.passwordHash = newHash;
    delete user.password;
  } else {
    user = {
      id: authentication.user?.id || targetUname,
      name: authentication.user?.name || username,
      username: username,
      email: authentication.user?.email || "",
      dept: authentication.user?.dept || "Biro Keuangan dan BMN",
      role: authentication.user?.role || "User",
      status: "Aktif",
      passwordHash: newHash,
    };
    if (!Array.isArray(store.users)) store.users = [];
    store.users.push(user);
  }

  if (getIsConnected()) {
    try {
      const dbResult = await query(
        "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE LOWER(username) = LOWER($2)",
        [newHash, targetUname]
      );
      if (!dbResult.rowCount) {
        await query(`
          INSERT INTO users (id, name, username, email, dept, role, status, password_hash, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, 'Aktif', $7, NOW())
          ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = NOW();
        `, [
          String(user.id || targetUname),
          user.name || username,
          user.username || username,
          user.email || null,
          user.dept || "Biro Keuangan dan BMN",
          user.role || "User",
          newHash,
        ]);
      }
    } catch (dbErr) {
      console.warn("[PostgreSQL] Gagal update password di database:", dbErr.message);
    }
  }

  writeStore(store);
  return { success: true };
}

async function saveUser(user) {
  const store = readStore();
  if (!store.users) store.users = [];

  const lowerUname = (user.username || "").trim().toLowerCase();
  const idx = store.users.findIndex(
    (u) =>
      String(u.id) === String(user.id) ||
      (u.username && user.username && u.username.toLowerCase() === lowerUname)
  );
  const existing = idx !== -1 ? store.users[idx] : null;

  const normalized = {
    id: user.id || existing?.id || "user_" + Date.now(),
    name: user.name || existing?.name || "",
    username: user.username || existing?.username || "",
    email: user.email !== undefined ? user.email : (existing?.email || ""),
    dept: user.dept || existing?.dept || "Biro Keuangan dan BMN",
    role: lowerUname === "admin" ? "Admin" : (user.role || existing?.role || "User"),
    status: user.status || existing?.status || "Aktif",
  };

  if (user.password) {
    normalized.passwordHash = hashPassword(user.password);
  } else if (existing && existing.passwordHash) {
    normalized.passwordHash = existing.passwordHash;
  }

  if (idx !== -1) {
    store.users[idx] = { ...store.users[idx], ...normalized };
    delete store.users[idx].password;
  } else {
    store.users.push(normalized);
  }

  if (getIsConnected()) {
    try {
      await query(`
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
      ]);
    } catch (dbErr) {
      console.warn("[PostgreSQL] Gagal simpan user ke DB:", dbErr.message);
    }
  }

  writeStore(store);
  const { password, passwordHash, ...safeUser } = normalized;
  return safeUser;
}

async function deleteUser(id) {
  const targetId = String(id || "").trim();
  if (!targetId) return false;

  // Akun Admin Utama dilindungi dari penghapusan
  if (targetId.toLowerCase() === "admin") {
    const error = new Error("Akun Admin Utama tidak dapat dihapus.");
    error.statusCode = 400;
    throw error;
  }

  const store = readStore();
  let foundInStore = false;
  if (Array.isArray(store.users)) {
    const prevCount = store.users.length;
    store.users = store.users.filter(
      (u) =>
        String(u.id) !== targetId &&
        (u.username || "").toLowerCase() !== targetId.toLowerCase()
    );
    foundInStore = store.users.length < prevCount;
  }

  let foundInDb = false;
  if (getIsConnected()) {
    try {
      // Lepaskan ketergantungan relasi pemohon di tabel meetings agar tidak error
      await query(
        "UPDATE meetings SET booked_by_id = NULL WHERE booked_by_id = $1 OR LOWER(booked_by_username) = LOWER($1)",
        [targetId]
      );
      const deleted = await query(
        "DELETE FROM users WHERE id = $1 OR LOWER(username) = LOWER($1)",
        [targetId]
      );
      foundInDb = (deleted.rowCount || 0) > 0;
    } catch (dbErr) {
      console.warn("[PostgreSQL] Error saat menghapus user dari DB:", dbErr.message);
    }
  }

  // Jika ada di store ATAU ada di DB, proses penghapusan berhasil
  if (!foundInStore && !foundInDb) {
    return false;
  }

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
  deleteRoom,
  saveUser,
  deleteUser,
  getUsers,
  getRoles,
  saveRole,
  deleteRole,
  authenticateUser,
  changeUserPassword,
  readStore,
  writeStore,
  syncStoreFromDatabase,
};
