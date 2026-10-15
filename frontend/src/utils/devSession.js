// Utilitas manajemen sesi dev & pembersihan data dummy

export const DEFAULT_INITIAL_MEETINGS = [];

export function isDummyMeeting(m) {
  if (!m) return false;
  const title = (m.title || m.agenda || "").toLowerCase();
  const date = m.date || "";
  const organizer = (m.organizer || m.requester || m.bagian || "").toLowerCase();
  if (title.includes("biro keuangan") || title.includes("rapat koordinasi biro keuangan")) return true;
  if (date === "2026-09-22" || date === "22 Sep 2026") return true;
  if (organizer.includes("andi") && title.includes("koordinasi")) return true;
  if ((m.id === 1 || m.id === "1") && (title.includes("koordinasi") || date.includes("2026-09-22") || organizer.includes("andi"))) return true;
  return false;
}

export function sanitizeMeetings(list) {
  if (!Array.isArray(list)) return [];
  const filtered = list.filter((m) => !isDummyMeeting(m));

  // Deduplikasi: jika ada 2 rapat dengan id sama atau slot jadwal sama persis, prioritaskan yang sudah disetujui / memiliki googleId
  const result = [];
  const seenKeys = new Set();

  const sorted = [...filtered].sort((a, b) => {
    if (a.googleId && !b.googleId) return -1;
    if (!a.googleId && b.googleId) return 1;
    if (a.status !== "Menunggu Approval" && b.status === "Menunggu Approval") return -1;
    if (a.status === "Menunggu Approval" && b.status !== "Menunggu Approval") return 1;
    return 0;
  });

  for (const m of sorted) {
    if (!m) continue;
    const date = m.date || "";
    const start = m.start || m.startTime || "";
    const room = (m.room || "").toLowerCase().trim();
    const idKey = m.googleId ? `gid_${m.googleId}` : `id_${m.id}`;
    const slotKey = `slot_${date}_${start}_${room}`;

    if (seenKeys.has(idKey) || (date && start && room && seenKeys.has(slotKey))) {
      continue;
    }

    seenKeys.add(idKey);
    if (date && start && room) {
      seenKeys.add(slotKey);
    }
    result.push(m);
  }
  return result;
}

export const MASTER_ENV_SEED_USERS = [
  {
    username: (import.meta.env?.VITE_ADMIN_USERNAME || "admin").trim().toLowerCase(),
    password: import.meta.env?.VITE_ADMIN_PASSWORD || "admin123",
    name: import.meta.env?.VITE_ADMIN_NAME || "Admin Utama",
    role: "Admin",
    dept: "Biro Keuangan dan BMN",
    email: import.meta.env?.VITE_ADMIN_EMAIL || "admin@kemnaker.go.id",
    status: "Aktif",
  },
  {
    username: (import.meta.env?.VITE_APPROVAL_USERNAME || "approval").trim().toLowerCase(),
    password: import.meta.env?.VITE_APPROVAL_PASSWORD || "approval123",
    name: import.meta.env?.VITE_APPROVAL_NAME || "Pimpinan Approval",
    role: "Pimpinan",
    dept: "Biro Keuangan dan BMN",
    email: import.meta.env?.VITE_APPROVAL_EMAIL || "approval@kemnaker.go.id",
    status: "Aktif",
  },
  {
    username: (import.meta.env?.VITE_APPROVAL1_USERNAME || "approval1").trim().toLowerCase(),
    password: import.meta.env?.VITE_APPROVAL1_PASSWORD || "approval123",
    name: "Pimpinan",
    role: "Pimpinan",
    dept: "Biro Keuangan dan BMN",
    email: "pimpinan@kemnaker.go.id",
    status: "Aktif",
  },
  {
    username: (import.meta.env?.VITE_USER_USERNAME || "user").trim().toLowerCase(),
    password: import.meta.env?.VITE_USER_PASSWORD || "user123",
    name: import.meta.env?.VITE_USER_NAME || "User Pegawai",
    role: "User",
    dept: "Biro Keuangan dan BMN",
    email: import.meta.env?.VITE_USER_EMAIL || "user@kemnaker.go.id",
    status: "Aktif",
  },
  {
    username: (import.meta.env?.VITE_USER_ANDI_USERNAME || "andipratama").trim().toLowerCase(),
    password: import.meta.env?.VITE_USER_ANDI_PASSWORD || "user123",
    name: "Andi Pratama",
    role: "User",
    dept: "Biro Keuangan dan BMN",
    email: "andi@kemnaker.go.id",
    status: "Aktif",
  },
];

export function ensureDevSessionSync() {
  try {
    const storages = [window.localStorage];
    if (window.parent && window.parent.localStorage && window.parent.localStorage !== window.localStorage) {
      storages.push(window.parent.localStorage);
    }

    storages.forEach((storage) => {
      try {
        const testResetFlag = storage.getItem('app_clean_reset_test_20261010');
        if (!testResetFlag) {
          storage.removeItem('app_meetings');
          storage.removeItem('app_notifications');
          storage.removeItem('app_users');
          storage.removeItem('app_login_users');
          storage.setItem('app_clean_reset_test_20261010', 'true');
        }

        const storedUsers = storage.getItem('app_login_users');
        if (!storedUsers || storedUsers === '[]') {
          storage.setItem('app_login_users', JSON.stringify(MASTER_ENV_SEED_USERS));
          storage.setItem('app_users', JSON.stringify(MASTER_ENV_SEED_USERS));
        }

        const storedMeetings = storage.getItem('app_meetings');
        if (storedMeetings) {
          const parsed = JSON.parse(storedMeetings);
          if (Array.isArray(parsed)) {
            const clean = sanitizeMeetings(parsed);
            storage.setItem('app_meetings', JSON.stringify(clean));
          }
        } else {
          storage.setItem('app_meetings', JSON.stringify([]));
        }

        const storedNotifs = storage.getItem('app_notifications');
        if (storedNotifs) {
          const parsedNotifs = JSON.parse(storedNotifs);
          if (Array.isArray(parsedNotifs)) {
            const cleanNotifs = parsedNotifs.filter((n) => {
              const text = (n.title || n.message || n.text || '').toLowerCase();
              return !(text.includes('biro keuangan') || text.includes('andi pratama') || text.includes('2026-09-22'));
            });
            storage.setItem('app_notifications', JSON.stringify(cleanNotifs));
          }
        } else {
          storage.setItem('app_notifications', JSON.stringify([]));
        }

        const storedRooms = storage.getItem('app_rooms');
        if (storedRooms) {
          const parsedRooms = JSON.parse(storedRooms);
          if (Array.isArray(parsedRooms)) {
            const cleanRooms = parsedRooms.filter((r) => {
              const name = (r.name || '').toLowerCase();
              return !name.includes('nusantara') && !name.includes('garuda');
            });
            storage.setItem('app_rooms', JSON.stringify(cleanRooms));
          }
        }
      } catch (e) {}
    });
  } catch (err) {
    console.warn('[DevSession] Gagal sinkronisasi sesi dev:', err);
  }
}

