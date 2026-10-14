// ----------------------------------------------------------------------
// HELPER ROLE & ACCESS CONTROL (Admin, Pimpinan, User)
// ----------------------------------------------------------------------
function getRoleLabel(role) {
  if (!role) return "User";
  const r = String(role).trim().toLowerCase();
  if (
    r === "admin" ||
    r === "administrator" ||
    (r.includes("admin") && !r.includes("approval") && !r.includes("pimpinan"))
  )
    return "Admin";
  if (r === "pimpinan" || r.includes("approval") || r === "atasan")
    return "Pimpinan";
  return "User";
}

function isAtasanRole(user) {
  if (!user) return false;
  const role = (user.role || "").toLowerCase();
  const uname = (user.username || "").toLowerCase();
  const name = (user.name || "").toLowerCase();
  if (
    role === "admin" ||
    role === "administrator" ||
    uname === "admin" ||
    (role.includes("admin") &&
      !role.includes("approval") &&
      !role.includes("pimpinan"))
  ) {
    return false;
  }
  return (
    role === "pimpinan" ||
    role.includes("approval") ||
    role.includes("pimpinan") ||
    role.includes("atasan") ||
    uname.includes("approval") ||
    uname.includes("pimpinan") ||
    name.includes("pimpinan")
  );
}

function isAdminRole(user) {
  if (!user) return false;
  const role = (user.role || "").toLowerCase();
  const uname = (user.username || "").toLowerCase();
  return (
    role === "admin" ||
    role === "administrator" ||
    role.includes("admin") ||
    uname === "admin"
  );
}

// ----------------------------------------------------------------------
// MATRIKS HAK AKSES (satu-satunya sumber aturan role)
//  - Pimpinan          : fokus Setujui/Tolak, sisanya hanya melihat.
//  - Admin             : operasional & monitoring (rapat, ruangan, pengguna),
//                        TIDAK menyetujui/menolak pengajuan.
//  - User              : pemohon pengajuan & presensi mandiri.
// ----------------------------------------------------------------------
const PERMISSIONS = {
  approve: ["pimpinan", "approval"],
  manageMeeting: ["admin"], // tambah / edit rapat
  checkInOut: ["admin"],
  emergencyCancel: ["admin", "pimpinan", "approval"],
  manageRoom: ["admin"],
  manageUsers: ["admin"],
  manageSettings: ["admin"],
};

function getRoleGroup(user) {
  if (isAtasanRole(user)) return "pimpinan";
  if (isAdminRole(user)) return "admin";
  return "user";
}

function can(action, user) {
  const u =
    user || (typeof getCurrentUser === "function" ? getCurrentUser() : null);
  const allowed = PERMISSIONS[action] || [];
  return allowed.includes(getRoleGroup(u));
}

function denyAccess(message) {
  alert(message || "Hak akses dibatasi untuk role Anda.");
  return false;
}

function isPageAllowed(page, user) {
  if (page === "reports") return isAdminRole(user);
  if (page === "users") return can("manageUsers", user);
  if (page === "settings") return can("manageSettings", user);
  return true;
}

function isPendingApproval(m) {
  const s = String((m && m.status) || "").toLowerCase();
  return (s.includes("menunggu") || s === "pending") && !m.rejectedBy;
}

function getMeetingStatistics() {
  const meetings = state.meetings || [];
  const rooms = state.rooms || [];
  const totalMeetings = meetings.length;

  let totalMinutes = 0;
  meetings.forEach((m) => {
    if (m.start && m.end) {
      const [sh, sm] = m.start.split(":").map(Number);
      const [eh, em] = m.end.split(":").map(Number);
      if (!isNaN(sh) && !isNaN(eh)) {
        const diff = eh * 60 + (em || 0) - (sh * 60 + (sm || 0));
        if (diff > 0) totalMinutes += diff;
      }
    }
  });
  const totalHours = Math.round(totalMinutes / 60);

  const requesters = new Set();
  meetings.forEach((m) => {
    if (m.bookedBy) requesters.add(m.bookedBy);
    else if (m.requester) requesters.add(m.requester);
  });
  const totalUsers = Math.max(
    state.users ? state.users.length : 0,
    requesters.size,
    1,
  );

  const runningCount = meetings.filter(
    (m) => (m.status || "").toLowerCase() === "berjalan",
  ).length;
  const pendingCount = meetings.filter(isPendingApproval).length;
  const soonCount = meetings.filter((m) => {
    const s = (m.status || "").toLowerCase();
    return s === "akan datang" || s === "segera";
  }).length;
  const doneCount = meetings.filter(
    (m) => (m.status || "").toLowerCase() === "selesai",
  ).length;

  const totalRooms = rooms.length || 1;
  const occupiedRooms = rooms.filter((r) => {
    const s = (r.status || "").toLowerCase();
    return s.includes("guna") || s.includes("pakai");
  }).length;
  const roomUtilization = Math.round(
    ((occupiedRooms || (runningCount > 0 ? 1 : 0)) / totalRooms) * 100,
  );

  return {
    totalMeetings,
    totalHours,
    totalUsers,
    runningCount,
    pendingCount,
    soonCount,
    doneCount,
    roomUtilization: Math.min(
      100,
      Math.max(0, roomUtilization || (totalMeetings > 0 ? 50 : 0)),
    ),
  };
}

function getTodayIsoDate() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultMeetingHours() {
  const now = new Date();
  const startH = (now.getHours() + 1) % 24;
  const endH = (startH + 1) % 24;
  return {
    start: `${String(startH).padStart(2, "0")}:00`,
    end: `${String(endH).padStart(2, "0")}:00`,
  };
}

// ----------------------------------------------------------------------
// HELPER STORAGE & PEMBERSIHAN DATA DUMMY
// ----------------------------------------------------------------------
function getAppStorage() {
  try {
    if (window.parent && window.parent.localStorage) {
      return window.parent.localStorage;
    }
  } catch (e) {}
  return window.localStorage;
}

function isDummyMeeting(m) {
  if (!m) return false;
  const title = (m.title || m.agenda || "").toLowerCase();
  const date = m.date || "";
  const organizer = (
    m.organizer ||
    m.requester ||
    m.bagian ||
    ""
  ).toLowerCase();
  if (
    title.includes("biro keuangan") ||
    title.includes("rapat koordinasi biro keuangan")
  )
    return true;
  if (date === "2026-09-22" || date === "22 Sep 2026") return true;
  if (organizer.includes("andi") && title.includes("koordinasi")) return true;
  if (
    (m.id === 1 || m.id === "1") &&
    (title.includes("koordinasi") ||
      date.includes("2026-09-22") ||
      organizer.includes("andi"))
  )
    return true;
  return false;
}

function isMeetingFinished(m, now = new Date()) {
  if (!m || !m.date) return false;
  const end = m.end || m.endTime;
  if (!end) return false;
  try {
    const [y, mth, d] = m.date.split("-").map(Number);
    const [eh, em] = end.split(":").map(Number);
    if (!y || !mth || !d || isNaN(eh) || isNaN(em)) return false;
    const endDateTime = new Date(y, mth - 1, d, eh, em, 0);
    return now >= endDateTime;
  } catch (e) {
    return false;
  }
}

function sanitizeMeetings(list) {
  if (!Array.isArray(list)) return [];
  const now = new Date();
  const updated = list.map((m) => {
    if (!m) return m;
    // Rapat otomatis selesai jika jam berakhir rapat sudah lewat
    if (isMeetingFinished(m, now)) {
      if (
        m.status === "Berjalan" ||
        m.status === "Akan Datang" ||
        m.status === "Segera"
      ) {
        return { ...m, status: "Selesai" };
      }
    }
    return m;
  });
  const filtered = updated.filter((m) => !isDummyMeeting(m));

  // Deduplikasi: jika ada 2 rapat dengan id sama, atau jadwal slot sama (tanggal + jam mulai + ruangan),
  // prioritaskan rapat yang sudah disetujui / memiliki googleId
  const result = [];
  const seenKeys = new Set();

  const sorted = [...filtered].sort((a, b) => {
    if (a.googleId && !b.googleId) return -1;
    if (!a.googleId && b.googleId) return 1;
    if (a.status !== "Menunggu Approval" && b.status === "Menunggu Approval")
      return -1;
    if (a.status === "Menunggu Approval" && b.status !== "Menunggu Approval")
      return 1;
    return 0;
  });

  for (const m of sorted) {
    if (!m) continue;
    const date = m.date || "";
    const start = m.start || m.startTime || "";
    const room = (m.room || "").toLowerCase().trim();
    const idKey = m.googleId ? `gid_${m.googleId}` : `id_${m.id}`;
    const slotKey = `slot_${date}_${start}_${room}`;

    if (
      seenKeys.has(idKey) ||
      (date && start && room && seenKeys.has(slotKey))
    ) {
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

function purgeAllDummyData() {
  try {
    const storages = [window.localStorage];
    if (
      window.parent &&
      window.parent.localStorage &&
      window.parent.localStorage !== window.localStorage
    ) {
      storages.push(window.parent.localStorage);
    }
    storages.forEach((s) => {
      if (!s) return;
      const testResetFlag = s.getItem("app_clean_reset_test_20261010");
      if (!testResetFlag) {
        s.removeItem("app_meetings");
        s.removeItem("app_notifications");
        s.removeItem("app_users");
        s.removeItem("app_login_users");
        s.setItem("app_clean_reset_test_20261010", "true");
      }
      const stored = s.getItem("app_meetings");
      if (stored) {
        try {
          const list = JSON.parse(stored);
          if (Array.isArray(list)) {
            const clean = sanitizeMeetings(list);
            s.setItem("app_meetings", JSON.stringify(clean));
          }
        } catch (e) {}
      }
      const notifs = s.getItem("app_notifications");
      if (notifs) {
        try {
          const listN = JSON.parse(notifs);
          if (Array.isArray(listN)) {
            const cleanN = listN.filter((n) => {
              const text = (
                n.title ||
                n.description ||
                n.message ||
                ""
              ).toLowerCase();
              return !(
                text.includes("biro keuangan") ||
                text.includes("andi pratama") ||
                text.includes("2026-09-22")
              );
            });
            s.setItem("app_notifications", JSON.stringify(cleanN));
          }
        } catch (e) {}
      }
      const rooms = s.getItem("app_rooms");
      if (rooms) {
        try {
          const listR = JSON.parse(rooms);
          if (Array.isArray(listR)) {
            const cleanR = listR.filter((r) => {
              const name = (r.name || "").toLowerCase();
              return !name.includes("nusantara") && !name.includes("garuda");
            });
            s.setItem("app_rooms", JSON.stringify(cleanR));
          }
        } catch (e) {}
      }
    });
  } catch (e) {}
}

// Eksekusi pembersihan dummy secara instan saat script dimuat
purgeAllDummyData();

function tanggalKe(offsetHari = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetHari);
  const bulan = String(d.getMonth() + 1).padStart(2, "0");
  const hari = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + bulan + "-" + hari;
}

function awalBulan() {
  return tanggalKe(1 - new Date().getDate());
}

function akhirBulan() {
  const d = new Date();
  const akhir = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return tanggalKe(akhir - d.getDate());
}

function awalMinggu() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  const bulan = String(monday.getMonth() + 1).padStart(2, "0");
  const hari = String(monday.getDate()).padStart(2, "0");
  return monday.getFullYear() + "-" + bulan + "-" + hari;
}

function akhirMinggu() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? 0 : 7);
  const sunday = new Date(d);
  sunday.setDate(diff);
  const bulan = String(sunday.getMonth() + 1).padStart(2, "0");
  const hari = String(sunday.getDate()).padStart(2, "0");
  return sunday.getFullYear() + "-" + bulan + "-" + hari;
}

const state = {
  page: location.hash.replace("#", "") || "dashboard",
  googleCalendarConnected: false,
  calendarMessage: "Menghubungkan ke backend...",
  reportFilter: {
    mode: "bulanan",
    startDate: awalBulan(),
    endDate: akhirBulan(),
  },
  meetings: (() => {
    try {
      const storage = getAppStorage();
      const stored = storage.getItem("app_meetings");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return sanitizeMeetings(parsed);
      }
    } catch (e) {}
    return [];
  })(),

  rooms: (() => {
    const defaultRooms = [
      {
        id: 1,
        name: "Ruang Rapat Besar",
        location: "Gedung Pusat Kemnaker, Lt. 3",
        capacity: 30,
        status: "Tersedia",
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
        image: "/dashboard-app/assets/Ruang Rapat Besar.jpeg",
        images: ["/dashboard-app/assets/Ruang Rapat Besar.jpeg"],
      },
      {
        id: 2,
        name: "Ruang Konsultasi",
        location: "Gedung Pusat Kemnaker, Lt. 3",
        capacity: 12,
        status: "Tersedia",
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
        image: "/dashboard-app/assets/Ruang Konsultasi.jpeg",
        images: ["/dashboard-app/assets/Ruang Konsultasi.jpeg"],
      },
    ];
    try {
      const saved = getAppStorage().getItem("app_rooms");
      if (saved) {
        const parsed = JSON.parse(saved).filter((r) => {
          const n = (r.name || "").toLowerCase();
          return !n.includes("nusantara") && !n.includes("garuda");
        });
        if (parsed.length > 0) {
          return parsed.map((r) => {
            const n = (r.name || "").toLowerCase();
            let primaryImg = r.image;
            if (!primaryImg || primaryImg.includes("unsplash")) {
              primaryImg = n.includes("konsultasi")
                ? "/dashboard-app/assets/Ruang Konsultasi.jpeg"
                : "/dashboard-app/assets/Ruang Rapat Besar.jpeg";
            }
            let imgs =
              Array.isArray(r.images) && r.images.length > 0
                ? r.images
                : [primaryImg];
            return {
              ...r,
              image: primaryImg,
              images: imgs,
            };
          });
        }
      }
    } catch (e) {}
    return defaultRooms;
  })(),
  users: (() => {
    const defaultUsers = [
      {
        id: "admin",
        name: "Admin Utama",
        username: "admin",
        password: "",
        email: "admin@kemnaker.go.id",
        dept: "Biro Keuangan dan BMN",
        role: "Admin",
        status: "Aktif",
      },
      {
        id: "approval1",
        name: "Pimpinan",
        username: "approval1",
        password: "",
        email: "pimpinan@kemnaker.go.id",
        dept: "Biro Keuangan dan BMN",
        role: "Pimpinan",
        status: "Aktif",
      },
      {
        id: "approval2",
        name: "Wakil Pimpinan",
        username: "approval2",
        password: "",
        email: "wakil.pimpinan@kemnaker.go.id",
        dept: "Biro Keuangan dan BMN",
        role: "Pimpinan",
        status: "Aktif",
      },
    ];
    try {
      const storage = getAppStorage();
      const saved = storage.getItem("app_users");
      let list = saved ? JSON.parse(saved) : defaultUsers;
      const loginUsers = JSON.parse(storage.getItem("app_login_users") || "[]");
      loginUsers.forEach((lu) => {
        if (
          !list.some(
            (u) =>
              u.id === lu.id ||
              (u.username &&
                lu.username &&
                u.username.toLowerCase() === lu.username.toLowerCase()),
          )
        ) {
          list.push(lu);
        }
      });
      // Filter out Andi Pratama and normalize roles to Admin, Pimpinan, User
      list = list
        .filter(
          (u) =>
            (u.name || "").toLowerCase() !== "andi pratama" &&
            (u.username || "").toLowerCase() !== "andipratama",
        )
        .map((u) => {
          return { ...u, role: getRoleLabel(u.role) };
        });
      return list;
    } catch (e) {}
    return defaultUsers;
  })(),
};

// SVG icons — path data extracted directly from installed react-icons package
const svgIcon = (inner, viewBox, extraAttr = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="currentColor" width="18" height="18" style="flex-shrink:0" ${extraAttr}>${inner}</svg>`;

const ICONS = {
  // IoMdHome — react-icons/io (viewBox 0 0 512 512)
  dashboard: svgIcon(
    '<path d="M208 448V320h96v128h97.6V256H464L256 64 48 256h62.4v192z"/>',
    "0 0 512 512",
  ),
  // LiaUsersSolid — react-icons/lia (viewBox 0 0 32 32)
  meetings: svgIcon(
    `<path d="M11.5 6C9.578 6 8 7.578 8 9.5S9.578 13 11.5 13 15 11.422 15 9.5 13.422 6 11.5 6zm9 0C18.578 6 17 7.578 17 9.5S18.578 13 20.5 13 24 11.422 24 9.5 22.422 6 20.5 6zM7 12c-2.2 0-4 1.8-4 4 0 1.113.477 2.117 1.219 2.844C2.887 19.746 2 21.281 2 23h2c0-1.668 1.332-3 3-3s3 1.332 3 3h2c0-1.719-.887-3.254-2.219-4.156C10.523 18.117 11 17.113 11 16c0-2.2-1.8-4-4-4zm18 0c-2.2 0-4 1.8-4 4 0 1.113.477 2.117 1.219 2.844C20.887 19.746 20 21.281 20 23h2c0-1.668 1.332-3 3-3s3 1.332 3 3h2c0-1.719-.887-3.254-2.219-4.156C30.523 18.117 31 17.113 31 16c0-2.2-1.8-4-4-4zm-9 3c-2.2 0-4 1.8-4 4 0 1.113.477 2.117 1.219 2.844C12.75 22.16 12.34 22.547 12 23h2c0-1.668 1.332-3 3-3s3 1.332 3 3h2c0-1.719-.887-3.254-2.219-4.156C21.523 21.117 22 20.113 22 19c0-2.2-1.8-4-4-4z"/>`,
    "0 0 32 32",
  ),
  // BsBuildingFillGear — react-icons/bs (viewBox 0 0 16 16)
  rooms: svgIcon(
    `<path d="M2 1a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v7.256A4.5 4.5 0 0 0 12.5 8a4.5 4.5 0 0 0-3.59 1.787A.5.5 0 0 0 9 9.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .39-.187A4.5 4.5 0 0 0 8.027 12H6.5a.5.5 0 0 0-.5.5V16H3a1 1 0 0 1-1-1zm2 1.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5m3 0v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5m3.5-.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5zM4 5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5M7.5 5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5zm2.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5M4.5 8a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5z"/><path d="M11.886 9.46c.18-.613 1.048-.613 1.229 0l.043.148a.64.64 0 0 0 .921.382l.136-.074c.561-.306 1.175.308.87.869l-.075.136a.64.64 0 0 0 .382.92l.149.045c.612.18.612 1.048 0 1.229l-.15.043a.64.64 0 0 0-.38.921l.074.136c.305.561-.309 1.175-.87.87l-.136-.075a.64.64 0 0 0-.92.382l-.045.149c-.18.612-1.048.612-1.229 0l-.043-.15a.64.64 0 0 0-.921-.38l-.136.074c-.561.305-1.175-.309-.87-.87l.075-.136a.64.64 0 0 0-.382-.92l-.148-.045c-.613-.18-.613-1.048 0-1.229l.148-.043a.64.64 0 0 0 .382-.921l-.074-.136c-.306-.561.308-1.175.869-.87l.136.075a.64.64 0 0 0 .92-.382zM14 12.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0"/>`,
    "0 0 16 16",
  ),
  // FaUserGroup — react-icons/fa6 (viewBox 0 0 640 512)
  users: svgIcon(
    '<path d="M96 128a128 128 0 1 1 256 0A128 128 0 1 1 96 128zM0 482.3C0 383.8 79.8 304 178.3 304l91.4 0C368.2 304 448 383.8 448 482.3c0 16.4-13.3 29.7-29.7 29.7L29.7 512C13.3 512 0 498.7 0 482.3zM609.3 512l-137.8 0c5.4-9.4 8.6-20.3 8.6-32l0-8c0-60.7-27.1-115.2-69.8-151.8c2.4-.1 4.7-.2 7.1-.2l61.4 0C567.8 320 640 392.2 640 481.3c0 17-13.8 30.7-30.7 30.7zM432 256c-31 0-59-12.6-79.3-32.9C372.4 196.5 384 163.6 384 128c0-26.8-6.6-52.1-18.3-74.3C384.3 40.1 407.2 32 432 32c61.9 0 112 50.1 112 112s-50.1 112-112 112z"/>',
    "0 0 640 512",
  ),
  // FaCalendarAlt — react-icons/fa (viewBox 0 0 448 512)
  calendar: svgIcon(
    '<path d="M0 464c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48V192H0v272zm320-196c0-6.6 5.4-12 12-12h40c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12h-40c-6.6 0-12-5.4-12-12v-40zm0 128c0-6.6 5.4-12 12-12h40c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12h-40c-6.6 0-12-5.4-12-12v-40zM192 268c0-6.6 5.4-12 12-12h40c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12h-40c-6.6 0-12-5.4-12-12v-40zm0 128c0-6.6 5.4-12 12-12h40c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12h-40c-6.6 0-12-5.4-12-12v-40zM64 268c0-6.6 5.4-12 12-12h40c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12H76c-6.6 0-12-5.4-12-12v-40zm0 128c0-6.6 5.4-12 12-12h40c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12H76c-6.6 0-12-5.4-12-12v-40zM400 64h-48V16c0-8.8-7.2-16-16-16h-32c-8.8 0-16 7.2-16 16v48H160V16c0-8.8-7.2-16-16-16h-32c-8.8 0-16 7.2-16 16v48H48C21.5 64 0 85.5 0 112v48h448v-48c0-26.5-21.5-48-48-48z"/>',
    "0 0 448 512",
  ),
  // RiBarChart2Fill — react-icons/ri (viewBox 0 0 24 24)
  reports: svgIcon(
    '<path d="M2 13H8V21H2V13ZM9 3H15V21H9V3ZM16 8H22V21H16V8Z"/>',
    "0 0 24 24",
  ),
  // IoSettingsOutline — react-icons/io5 (viewBox 0 0 512 512)
  settings: svgIcon(
    `<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M262.29 192.31a64 64 0 1 0 57.4 57.4 64.13 64.13 0 0 0-57.4-57.4M416.39 256a154 154 0 0 1-1.53 20.79l45.21 35.46a10.81 10.81 0 0 1 2.45 13.75l-42.77 74a10.81 10.81 0 0 1-13.14 4.59l-44.9-18.08a16.11 16.11 0 0 0-15.17 1.75A164.5 164.5 0 0 1 325 400.8a15.94 15.94 0 0 0-8.82 12.14l-6.73 47.89a11.08 11.08 0 0 1-10.68 9.17h-85.54a11.11 11.11 0 0 1-10.69-8.87l-6.72-47.82a16.07 16.07 0 0 0-9-12.22 155 155 0 0 1-21.46-12.57 16 16 0 0 0-15.11-1.71l-44.89 18.07a10.81 10.81 0 0 1-13.14-4.58l-42.77-74a10.8 10.8 0 0 1 2.45-13.75l38.21-30a16.05 16.05 0 0 0 6-14.08c-.36-4.17-.58-8.33-.58-12.5s.21-8.27.58-12.35a16 16 0 0 0-6.07-13.94l-38.19-30A10.81 10.81 0 0 1 49.48 186l42.77-74a10.81 10.81 0 0 1 13.14-4.59l44.9 18.08a16.11 16.11 0 0 0 15.17-1.75A164.5 164.5 0 0 1 187 111.2a15.94 15.94 0 0 0 8.82-12.14l6.73-47.89A11.08 11.08 0 0 1 213.23 42h85.54a11.11 11.11 0 0 1 10.69 8.87l6.72 47.82a16.07 16.07 0 0 0 9 12.22 155 155 0 0 1 21.46 12.57 16 16 0 0 0 15.11 1.71l44.89-18.07a10.81 10.81 0 0 1 13.14 4.58l42.77 74a10.8 10.8 0 0 1-2.45 13.75l-38.21 30a16.05 16.05 0 0 0 6-14.08c.33 4.14.55 8.3.55 12.47"/>`,
    "0 0 512 512",
    'fill="none"',
  ),
  // TiExport — react-icons/ti (viewBox 0 0 24 24)
  export: svgIcon(
    '<path d="M22.711 9.796c-.041-.041-4.055-4.096-5.982-6.146-.42-.414-.999-.65-1.586-.65-1.182 0-2.143.896-2.143 2h-8c-.553 0-1 .448-1 1v14c0 .552.447 1 1 1h14c.553 0 1-.448 1-1v-6.045c1.434-1.461 2.688-2.729 2.711-2.751.387-.39.387-1.018 0-1.408zm-7.432 6.145l-.136.059-.144-.04v-3.96h-1c-1.771.034-3.336.68-4.753 1.958.43-2.215 1.6-4.958 4.753-4.958h1v-3.958l.144-.042.154.05c1.436 1.525 4.051 4.187 5.297 5.45-.253.257-4.342 4.422-5.315 5.441zm-9.279 3.059v-12h8v1c-4.66 0-6 4.871-6 8.5v.5c1.691-2.578 3.6-3.953 6-4v3c0 .551.512 1 1.143 1 .364 0 .676-.158.883-.391.539-.565 1.242-1.291 1.976-2.043v4.434h-12.002z"/>',
    "0 0 24 24",
  ),
};

const nav = [
  ["dashboard", ICONS.dashboard, "Dashboard"],
  ["meetings", ICONS.meetings, "Manajemen Rapat"],
  ["rooms", ICONS.rooms, "Manajemen Ruangan"],
  ["reports", ICONS.reports, "Laporan Penggunaan"],
  ["users", ICONS.users, "Pengguna"],
  ["calendar", ICONS.calendar, "Kalender"],
  ["settings", ICONS.settings, "Pengaturan"],
];

function esc(v) {
  return String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[c],
  );
}

function statusClass(s) {
  if (!s) return "red";
  if (s === "Berjalan" || s === "Aktif" || s === "Tersedia") return "green";
  if (s === "Akan Datang" || s === "Perbaikan") return "yellow";
  if (s === "Menunggu Approval") return "orange";
  if (s === "Selesai") return "blue";
  if (
    s === "Admin" ||
    s === "Administrator" ||
    s === "Pimpinan" ||
    s.startsWith("Approval")
  )
    return "purple";
  return "red";
}

function badge(s) {
  return `<span class="badge ${statusClass(s)}">${esc(s)}</span>`;
}

/* Panel berjudul "Hari Ini" sebelumnya memakai slice(0, 6) tanpa menyaring
   tanggal, jadi rapat besok ikut tampil di bawah judul itu. */
function rapatHariIni() {
  const hariIni = tanggalKe(0);
  return state.meetings.filter((m) => m.date === hariIni);
}

function layout(content) {
  let currentUser = getCurrentUser();

  return `<div class="app-shell"><aside class="sidebar">
    <div class="brand"><img src="/dashboard-app/assets/kemenaker-white.png" alt="Logo Kemenaker" class="brand-logo"><div><b>MEETING DISPLAY ROOM</b><small>BIRO KEUANGAN DAN BMN</small></div></div>
    <nav class="nav">${nav
      .filter(([id]) => isPageAllowed(id, currentUser))
      .map(
        ([id, icon, label]) =>
          `<a href="#${id}" class="nav-item ${state.page === id ? "active" : ""}">${icon}${label}</a>`,
      )
      .join("")}</nav>
    <div class="sidebar-footer">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:0;">
        <a href="/" target="_top" style="flex:1.2;display:flex;align-items:center;justify-content:center;padding:7px 6px;background:rgba(255,255,255,0.14);color:#fff;text-decoration:none;border-radius:6px;font-size:11px;font-weight:600;letter-spacing:0.3px;text-align:center;white-space:nowrap;transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.24)'" onmouseout="this.style.background='rgba(255,255,255,0.14)'">Display TV</a>
        <button onclick="logout()" style="flex:1;display:flex;align-items:center;justify-content:center;padding:7px 6px;background:rgba(220,38,38,0.75);color:#fff;border:none;cursor:pointer;border-radius:6px;font-size:11px;font-weight:600;letter-spacing:0.3px;text-align:center;white-space:nowrap;transition:background 0.2s;" onmouseover="this.style.background='rgba(220,38,38,0.95)'" onmouseout="this.style.background='rgba(220,38,38,0.75)'">Keluar</button>
      </div>

    </div>
  </aside><main class="main">
    ${
      [
        "dashboard",
        "meetings",
        "rooms",
        "reports",
        "users",
        "calendar",
        "settings",
      ].includes(state.page)
        ? ""
        : `<header class="topbar"><input class="search" placeholder="Cari rapat, ruangan, pengguna..." oninput="globalSearch(this.value)">
      <div class="top-actions" style="display:flex;align-items:center;gap:12px;">
        <span class="badge ${state.googleCalendarConnected ? "green" : "yellow"}" style="font-size:11px;cursor:pointer;white-space:nowrap;" title="${esc(state.calendarMessage)}" onclick="alert(state.calendarMessage)">
          ${state.googleCalendarConnected ? "🟢 Google Calendar" : "🟡 Menunggu Kalender"}
        </span>
        <button class="btn btn-light" onclick="fetchDashboardData(true)" style="padding:6px 12px;font-size:12px;display:flex;align-items:center;gap:4px;white-space:nowrap;" title="Sinkronkan data terbaru dari Google Calendar / backend">
          🔄 Sinkron
        </button>
        ${getProfileHTML()}
      </div>
    </header>`
    }<section class="content" ${["dashboard", "meetings", "rooms", "reports", "users", "calendar", "settings"].includes(state.page) ? 'style="padding:0;max-width:none;"' : ""}>${content}</section></main></div><div id="modal" class="modal-backdrop"></div>`;
}

// ----------------------------------------------------------------------
// SISTEM NOTIFIKASI & PENYIMPANAN DASHBOARD
// ----------------------------------------------------------------------
function getNotifications() {
  let notifs = [];
  try {
    const stored = getAppStorage().getItem("app_notifications");
    if (stored) notifs = JSON.parse(stored);
  } catch (e) {}
  if (!Array.isArray(notifs)) notifs = [];

  let changed = false;
  // Bersihkan notifikasi yang rapatnya sudah dihapus dari state.meetings
  if (Array.isArray(state.meetings)) {
    const validMeetingIds = new Set(state.meetings.map((m) => String(m.id)));
    const beforeCount = notifs.length;
    notifs = notifs.filter(
      (n) => !n.meetingId || validMeetingIds.has(String(n.meetingId)),
    );
    if (notifs.length !== beforeCount) changed = true;
  }

  // Sinkronisasi otomatis dengan state.meetings:
  // Setiap meeting dengan status "Menunggu Approval" yang belum ada di notifikasi otomatis didaftarkan
  if (Array.isArray(state.meetings)) {
    state.meetings.forEach((m) => {
      const existing = notifs.find(
        (n) => n.meetingId === m.id && n.type !== "MEETING_REVIEW",
      );
      if (!existing) {
        if (
          m.status === "Menunggu Approval" ||
          m.status === "Akan Datang" ||
          m.status === "Dibatalkan"
        ) {
          const isCancelPri = m.status === "Dibatalkan" && m.cancellationReason;
          notifs.push({
            id: m.id,
            meetingId: m.id,
            type: isCancelPri ? "CANCELED_PRIORITY" : "NEW_REQUEST",
            title: isCancelPri
              ? "⚠️ Pembatalan Ruang Rapat (Prioritas Kepala Biro)"
              : "Permintaan Booking Ruang Rapat",
            message: m.cancellationReason
              ? `Pemesanan ruangan ${m.room} oleh ${m.requester} dibatalkan otomatis karena dialihkan untuk rapat Kepala Biro Keuangan dan BMN.`
              : `${m.requester || "Unit Kerja"} mengajukan peminjaman ${m.room || "Ruang Rapat"}`,
            room: m.room || "-",
            requester: m.requester || "-",
            date: m.date || "-",
            time: `${m.start || ""} - ${m.end || ""}`,
            agenda: m.title || "-",
            status: m.status,
            cancellationReason: m.cancellationReason || "",
            approvedBy: m.approvedBy || "",
            rejectedBy: m.rejectedBy || "",
            createdAt: m.createdAt || new Date().toISOString(),
            readBy: [],
          });
          changed = true;
        }
      } else {
        if (
          existing.status !== m.status ||
          existing.approvedBy !== (m.approvedBy || "") ||
          existing.rejectedBy !== (m.rejectedBy || "") ||
          (m.cancellationReason &&
            existing.cancellationReason !== m.cancellationReason)
        ) {
          existing.status = m.status;
          existing.approvedBy = m.approvedBy || "";
          existing.rejectedBy = m.rejectedBy || "";
          if (m.cancellationReason) {
            existing.cancellationReason = m.cancellationReason;
            if (m.cancellationReason.includes("Kepala Biro")) {
              existing.type = "CANCELED_PRIORITY";
              existing.title =
                "⚠️ Pembatalan Ruang Rapat (Prioritas Kepala Biro)";
            }
          }
          changed = true;
        }
      }
      if (
        m.review &&
        !notifs.some(
          (n) =>
            n.type === "MEETING_REVIEW" && String(n.meetingId) === String(m.id),
        )
      ) {
        const review = m.review;
        const submittedAt = review.submittedAt || new Date().toISOString();
        notifs.unshift({
          id: `review-${m.id}-${submittedAt}`,
          meetingId: m.id,
          type: "MEETING_REVIEW",
          title: `Ulasan Baru — ${m.room || "Ruang Rapat"}`,
          message: `${review.reviewer || m.bookedBy || "User"} memberi rating ${review.rating || 0}/5${review.text ? `: ${review.text}` : "."}`,
          room: m.room || "-",
          requester: review.reviewer || m.bookedBy || m.requester || "User",
          date: m.date || "-",
          time: `${m.start || ""} - ${m.end || ""}`,
          rating: review.rating || 0,
          review: review.text || "",
          status: "Ulasan Baru",
          targetRoles: ["Administrator", "Approval 1", "Approval 2"],
          createdAt: submittedAt,
          readBy: [],
        });
        changed = true;
      }
    });
  }

  if (changed) {
    saveNotifications(notifs);
  }

  return notifs.sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
  );
}

function saveNotifications(notifs) {
  const json = JSON.stringify(notifs);
  try {
    getAppStorage().setItem("app_notifications", json);
  } catch (e) {}
  try {
    window.localStorage.setItem("app_notifications", json);
  } catch (e) {}
  try {
    if (window.parent && window.parent.localStorage && window.parent !== window) {
      window.parent.localStorage.setItem("app_notifications", json);
    }
  } catch (e) {}
  try {
    window.dispatchEvent(new Event("app_notifications_updated"));
  } catch (e) {}
  try {
    if (window.parent && window.parent !== window) {
      window.parent.dispatchEvent(new Event("app_notifications_updated"));
    }
  } catch (e) {}
}

function getUnreadNotifCount(currentUser) {
  const notifs = getNotifications();
  const username = (currentUser?.username || "admin").toLowerCase();
  return notifs.filter(
    (n) =>
      (!n.readBy ||
        !Array.isArray(n.readBy) ||
        !n.readBy.some((u) => String(u).toLowerCase() === username)) &&
      (!Array.isArray(n.targetRoles) ||
        n.targetRoles.some(
          (tr) =>
            tr.toLowerCase() === (currentUser?.role || "").toLowerCase() ||
            ((currentUser?.role || "").toLowerCase().includes("approval") &&
              tr.toLowerCase().includes("approval")),
        )),
  ).length;
}

function getTimeAgo(dateStr) {
  if (!dateStr) return "Baru saja";
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return "Baru saja";
    if (diff < 3600) return `${Math.floor(diff / 60)} mnt lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
    return `${Math.floor(diff / 86400)} hr lalu`;
  } catch (e) {
    return "Baru saja";
  }
}

function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc2.type = "triangle";

    // Nada lonceng dua tingkatan (E5 -> A5)
    osc1.frequency.setValueAtTime(659.25, ctx.currentTime);
    osc1.frequency.setValueAtTime(880.0, ctx.currentTime + 0.12);

    osc2.frequency.setValueAtTime(659.25, ctx.currentTime);
    osc2.frequency.setValueAtTime(880.0, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.5);
    osc2.stop(ctx.currentTime + 0.5);
  } catch (e) {}
}

function toggleNotifDropdown(e) {
  if (e) e.stopPropagation();
}

function closeNotifDropdown(e) {
  if (e) e.stopPropagation();
}

function markAllNotifsRead(e) {
  if (e) {
    if (typeof e.preventDefault === "function") e.preventDefault();
    if (typeof e.stopPropagation === "function") e.stopPropagation();
    if (e.currentTarget && e.currentTarget.style) {
      e.currentTarget.style.display = "none";
    }
  }
  const currentUser = getCurrentUser();
  const rawUsername = currentUser?.username || "admin";
  const username = rawUsername.toLowerCase();
  const notifs = getNotifications();
  let updated = false;
  notifs.forEach((n) => {
    if (!Array.isArray(n.readBy)) n.readBy = [];
    const hasRead = n.readBy.some((u) => String(u).toLowerCase() === username);
    if (!hasRead) {
      n.readBy.push(rawUsername);
      updated = true;
    }
  });
  if (updated) {
    saveNotifications(notifs);
  }
  render();
}

function approveMeetingFromNotif(e, id) {
  if (e) {
    if (typeof e.preventDefault === "function") e.preventDefault();
    if (typeof e.stopPropagation === "function") e.stopPropagation();
  }
  try {
    const currentUser = getCurrentUser();
    const rawUsername = currentUser?.username || "admin";
    const username = rawUsername.toLowerCase();
    const notifs = getNotifications();
    let updated = false;
    notifs.forEach((n) => {
      if (String(n.meetingId) === String(id) || String(n.id) === String(id)) {
        if (!Array.isArray(n.readBy)) n.readBy = [];
        if (!n.readBy.some((u) => String(u).toLowerCase() === username)) {
          n.readBy.push(rawUsername);
          updated = true;
        }
      }
    });
    if (updated) saveNotifications(notifs);
  } catch (err) {}
  approveMeeting(id);
}

function rejectMeetingFromNotif(e, id) {
  if (e) {
    if (typeof e.preventDefault === "function") e.preventDefault();
    if (typeof e.stopPropagation === "function") e.stopPropagation();
  }
  try {
    const currentUser = getCurrentUser();
    const rawUsername = currentUser?.username || "admin";
    const username = rawUsername.toLowerCase();
    const notifs = getNotifications();
    let updated = false;
    notifs.forEach((n) => {
      if (String(n.meetingId) === String(id) || String(n.id) === String(id)) {
        if (!Array.isArray(n.readBy)) n.readBy = [];
        if (!n.readBy.some((u) => String(u).toLowerCase() === username)) {
          n.readBy.push(rawUsername);
          updated = true;
        }
      }
    });
    if (updated) saveNotifications(notifs);
  } catch (err) {}
  rejectMeeting(id);
}

function viewMeetingFromNotif(e, id) {
  if (e) {
    if (typeof e.preventDefault === "function") e.preventDefault();
    if (typeof e.stopPropagation === "function") e.stopPropagation();
  }
  try {
    const currentUser = getCurrentUser();
    const rawUsername = currentUser?.username || "admin";
    const username = rawUsername.toLowerCase();
    const notifs = getNotifications();
    let updated = false;
    notifs.forEach((n) => {
      if (String(n.meetingId) === String(id) || String(n.id) === String(id)) {
        if (!Array.isArray(n.readBy)) n.readBy = [];
        if (!n.readBy.some((u) => String(u).toLowerCase() === username)) {
          n.readBy.push(rawUsername);
          updated = true;
        }
      }
    });
    if (updated) saveNotifications(notifs);
  } catch (err) {}
  if (state.page !== "meetings") {
    state.page = "meetings";
    location.hash = "meetings";
    render();
  }
  setTimeout(() => {
    viewMeeting(id);
  }, 100);
}

function showLiveBookingToast(meeting) {
  let container = document.getElementById("notifToastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "notifToastContainer";
    container.className = "notif-toast-container";
    document.body.appendChild(container);
  }

  const toastEl = document.createElement("div");
  toastEl.className = "notif-toast-banner";
  toastEl.innerHTML = `
    <div class="ntb-icon-wrap">
      <span class="ntb-bell-pulse">🔔</span>
    </div>
    <div class="ntb-body">
      <div class="ntb-title">Permintaan Booking Baru!</div>
      <div class="ntb-msg"><b>${esc(meeting.requester || "Unit Kerja")}</b> mengajukan pemesanan <b>${esc(meeting.room)}</b></div>
      <div class="ntb-meta">Agenda: "${esc(meeting.title)}" · ${formatDate(meeting.date)} (${meeting.start}-${meeting.end})</div>
    </div>
    <div class="ntb-actions">
      <button class="ntb-btn-review" onclick="openNotifFromToast('${meeting.id}', this)">Periksa</button>
      <button class="ntb-btn-close" onclick="this.closest('.notif-toast-banner').remove()">✕</button>
    </div>
  `;

  container.appendChild(toastEl);

  setTimeout(() => {
    if (toastEl && toastEl.parentElement) {
      toastEl.classList.add("fade-out");
      setTimeout(() => toastEl.remove(), 400);
    }
  }, 7000);
}

function openNotifFromToast(id, btn) {
  if (btn) {
    const card = btn.closest(".notif-toast-banner");
    if (card) card.remove();
  }
  state.page = "meetings";
  location.hash = "meetings";
  render();
  setTimeout(() => viewMeeting(id), 120);
}

function getDashboardNotifPanelHTML(currentUser) {
  let notifs = getNotifications().filter((n) => {
    if (!Array.isArray(n.targetRoles)) return true;
    const r = (currentUser?.role || "").toLowerCase();
    return n.targetRoles.some(
      (tr) =>
        tr.toLowerCase() === r ||
        (r.includes("approval") && tr.toLowerCase().includes("approval")),
    );
  });
  const canApprove = can("approve", currentUser);

  // Prioritaskan yang Menunggu Persetujuan di urutan teratas, lalu urutkan waktu terbaru
  notifs.sort((a, b) => {
    const aPending = (a.status || "").toLowerCase().includes("menunggu")
      ? 1
      : 0;
    const bPending = (b.status || "").toLowerCase().includes("menunggu")
      ? 1
      : 0;
    if (aPending !== bPending) return bPending - aPending;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  const pendingCount = notifs.filter((n) =>
    (n.status || "").toLowerCase().includes("menunggu"),
  ).length;

  const currentUsername = (currentUser?.username || "admin").toLowerCase();
  const unreadNotifs = notifs.filter((n) => {
    if (!Array.isArray(n.readBy) || n.readBy.length === 0) return true;
    return !n.readBy.some((u) => String(u).toLowerCase() === currentUsername);
  });
  const hasUnread = unreadNotifs.length > 0;

  let itemsHTML = "";
  if (notifs.length === 0) {
    itemsHTML = `
      <div class="notif-empty-state" style="padding:32px 16px;text-align:center;width:100%;">
        <div style="font-size:28px;margin-bottom:6px;">🔔</div>
        <div style="font-size:13.5px;font-weight:700;color:#0c2d5e;">Tidak Ada Notifikasi</div>
        <div style="font-size:12px;color:#94a3b8;margin-top:2px;">Semua permintaan telah diproses.</div>
      </div>
    `;
  } else {
    // Tampilkan 5 notifikasi terbaru agar tidak memanjang dan tidak menimbulkan dual scrollbar
    const displayNotifs = notifs.slice(0, 5);
    itemsHTML = displayNotifs
      .map((n) => {
        const m =
          state.meetings.find((x) => String(x.id) === String(n.meetingId)) || n;
        const isReview = n.type === "MEETING_REVIEW";
        const isPending = (m.status || "").toLowerCase().includes("menunggu");
        const isApproved =
          m.status === "Akan Datang" ||
          (!isPending && m.status !== "Dibatalkan" && m.approvedBy);
        const isRejected = m.status === "Dibatalkan";
        const isUnread =
          !Array.isArray(n.readBy) ||
          !n.readBy.some((u) => String(u).toLowerCase() === currentUsername);

        let statusBadge = "";
        if (isReview) {
          statusBadge = `<span style="background:#ecfdf5;color:#0f766e;border:1px solid #99f6e4;font-size:10.5px;padding:2px 7px;border-radius:10px;font-weight:600;white-space:nowrap;">Rating ${esc(n.rating || 0)}/5</span>`;
        } else if (isPending) {
          statusBadge = `<span style="background:#fff7ed;color:#ea580c;border:1px solid #fed7aa;font-size:10.5px;padding:2px 7px;border-radius:10px;font-weight:700;white-space:nowrap;">⏳ Perlu Persetujuan</span>`;
        } else if (isApproved) {
          statusBadge = `<span style="background:#ecfdf5;color:#15803d;border:1px solid #bbf7d0;font-size:10.5px;padding:2px 7px;border-radius:10px;font-weight:600;white-space:nowrap;">✓ Disetujui</span>`;
        } else if (isRejected) {
          statusBadge = `<span style="background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;font-size:10.5px;padding:2px 7px;border-radius:10px;font-weight:600;white-space:nowrap;">✕ Dibatalkan</span>`;
        } else {
          statusBadge = `<span style="background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;font-size:10.5px;padding:2px 7px;border-radius:10px;font-weight:600;white-space:nowrap;">${esc(m.status)}</span>`;
        }

        const title = esc(n.title || m.title || "Booking Ruang Rapat");
        const requester = esc(
          isReview ? n.requester || "User" : m.requester || m.bookedBy || "TU",
        );
        const roomName = esc(m.room || "Ruang Rapat");
        const dateStr = formatDate(m.date);
        const timeStr = `${m.start || "09:00"}–${m.end || "10:00"}`;

        return `
          <div class="dash-notif-item ${isPending ? "highlight-pending" : ""}" style="padding:10px 12px;border-radius:10px;background:#fff;border:1px solid ${isPending ? "#fed7aa" : isUnread ? "#bfdbfe" : "#e2e8f0"};${isPending ? "border-left:4px solid #ea580c;background:#fffaf5;" : isUnread ? "border-left:4px solid #2563eb;background:#f8faff;" : ""}">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:4px;">
              <strong style="font-size:12.5px;font-weight:700;color:#0c2d5e;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;" title="${title}">
                ${isUnread && !isPending ? `<span style="display:inline-block;width:6px;height:6px;background:#2563eb;border-radius:50%;margin-right:6px;vertical-align:middle;" title="Belum dibaca"></span>` : ""}${title}
              </strong>
              <span style="font-size:10.5px;color:#94a3b8;white-space:nowrap;flex-shrink:0;">
                ${getTimeAgo(n.createdAt)}
              </span>
            </div>

            <div style="font-size:11.5px;color:#475569;margin-bottom:3px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span>Pemesan: <b>${requester}</b></span>
              <span style="color:#cbd5e1;">·</span>
              <span style="color:#0c2d5e;font-weight:600;">🏛️ ${roomName}</span>
            </div>

            <div style="font-size:11px;color:#64748b;margin-bottom:8px;">
              📅 ${dateStr} · ${timeStr} WIB
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding-top:4px;border-top:1px dashed #f1f5f9;">
              <div>${statusBadge}</div>
              <div style="display:flex;align-items:center;gap:6px;">
                ${
                  isPending && canApprove
                    ? `
                  <button type="button" onclick="approveMeetingFromNotif(event, '${esc(m.id)}')" style="background:#16a34a;color:#fff;border:none;padding:4px 9px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:3px;transition:background 0.15s;" title="Setujui permohonan">✓ Setujui</button>
                  <button type="button" onclick="rejectMeetingFromNotif(event, '${esc(m.id)}')" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;padding:4px 9px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:3px;transition:background 0.15s;" title="Tolak permohonan">✕ Tolak</button>
                `
                    : ""
                }
                <button type="button" onclick="viewMeeting('${esc(m.id)}')" style="background:none;border:none;color:#1769aa;font-size:11.5px;font-weight:700;cursor:pointer;padding:0;text-decoration:none;display:inline-flex;align-items:center;gap:3px;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">
                  Lihat detail →
                </button>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  return `
    <div class="dash-section-header dash-notif-header" style="margin-bottom:12px;padding-bottom:10px;align-items:flex-start;text-align:left;width:100%;">
      <div class="dash-notif-header-title" style="display:flex;align-items:flex-start;gap:8px;width:100%;text-align:left;">
        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0c2d5e" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:2px;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
        <div style="text-align:left;">
          <h2 style="font-size:15px;margin:0;line-height:1.2;text-align:left;">Notifikasi</h2>
          <small style="font-size:11px;color:#64748b;font-weight:500;display:block;text-align:left;">Permintaan terbaru</small>
        </div>
      </div>
      <div class="dash-notif-header-actions">
        ${
          pendingCount > 0
            ? `
          <span class="notif-pending-pill" title="${pendingCount} Permintaan Perlu Persetujuan">
            <span class="notif-pending-dot"></span>
            <span>${pendingCount} Menunggu</span>
          </span>
        `
            : ""
        }
        ${
          hasUnread
            ? `
          <button type="button" class="notif-mark-read-btn" title="Tandai semua notifikasi telah dibaca" onclick="markAllNotifsRead(event)">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Tandai Semua Dibaca</span>
          </button>
        `
            : ""
        }
      </div>
    </div>
    <div id="dashNotifBody" class="dash-notif-body" style="display:flex;flex-direction:column;gap:10px;max-height:400px;overflow-y:auto;">
      ${itemsHTML}
    </div>
    <div style="padding-top:12px;margin-top:auto;border-top:1px solid #eef3f9;display:flex;align-items:center;justify-content:flex-end;">
      <a href="#meetings" style="font-size:12px;font-weight:700;color:#1769aa;text-decoration:none;display:inline-flex;align-items:center;gap:4px;transition:opacity 0.15s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
        <span>Lihat semua notifikasi</span> <span>→</span>
      </a>
    </div>
  `;
}

function getAllAvailableAccounts() {
  const defaultAccounts = [
    { username: "admin", name: "Admin Utama", role: "Admin" },
    { username: "approval1", name: "Pimpinan", role: "Pimpinan" },
    { username: "approval2", name: "Wakil Pimpinan", role: "Pimpinan" },
  ];
  const map = new Map();
  defaultAccounts.forEach((u) => map.set(u.username.toLowerCase(), { ...u }));

  const readFromStorage = (s) => {
    if (!s) return;
    ["savedAccounts", "app_login_users", "app_users"].forEach((key) => {
      try {
        const raw = s.getItem(key);
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            arr.forEach((u) => {
              if (u && u.username) {
                const uname = u.username.toLowerCase();
                if (
                  uname !== "andipratama" &&
                  (u.name || "").toLowerCase() !== "andi pratama"
                ) {
                  map.set(uname, {
                    ...map.get(uname),
                    ...u,
                    role: getRoleLabel(u.role),
                  });
                }
              }
            });
          }
        }
      } catch (e) {}
    });
  };

  try {
    readFromStorage(getAppStorage());
    readFromStorage(window.localStorage);
    readFromStorage(window.sessionStorage);
    if (window.parent) {
      readFromStorage(window.parent.localStorage);
      readFromStorage(window.parent.sessionStorage);
    }
  } catch (e) {}

  return Array.from(map.values());
}

function getProfileHTML() {
  let currentUser = getCurrentUser();

  const savedAccounts = getAllAvailableAccounts();

  const initial = currentUser.name
    ? currentUser.name.charAt(0).toUpperCase()
    : "A";

  const otherAccounts = savedAccounts.filter(
    (u) =>
      (u.username || "").toLowerCase() !==
      (currentUser.username || "").toLowerCase(),
  );

  const savedItems =
    otherAccounts.length > 0
      ? otherAccounts
          .map((u) => {
            const isAtasan = isAtasanRole(u);
            const roleName = getRoleLabel(u.role);
            return `
      <div onclick="switchToAccount(event, '${esc(u.username)}')" style="padding:10px 14px;cursor:pointer;font-size:12px;font-weight:500;border-bottom:1px solid #e2e8f0;color:#333;display:flex;flex-direction:column;gap:2px;transition:background 0.15s;" onmouseover="this.style.background='${isAtasan ? "#f0fdf4" : "#eff6ff"}'" onmouseout="this.style.background='white'">
        <div style="font-weight:600;color:#0f172a;">${esc(u.name)}</div>
        <small style="color:${isAtasan ? "#16a34a" : "#2563eb"};font-weight:600;">Role: ${esc(roleName)}</small>
      </div>
    `;
          })
          .join("")
      : `<div style="padding:10px 14px;font-size:12px;color:#94a3b8;border-bottom:1px solid #e2e8f0;font-style:italic;">Tidak ada akun lain tersimpan</div>`;

  return `
    <div style="display:flex;align-items:center;">
      <!-- Profile Menu -->
      <div class="profile" onclick="toggleProfileMenu()" style="cursor:pointer;position:relative;display:flex;align-items:center;gap:12px;">
        <div class="avatar" style="width:40px;height:40px;border-radius:50%;background:#fff;color:#0c2d5e;font-weight:700;font-size:16px;display:flex;align-items:center;justify-content:center;border:2px solid #d4e6f6;flex-shrink:0;">${initial}</div>
        <div>
          <div style="font-weight:700;font-size:14px;color:#0c2d5e;line-height:1.2;">${esc(currentUser.name)}</div>
          <div style="font-size:12px;color:#4b6a90;font-weight:600;">${esc(getRoleLabel(currentUser.role))}</div>
        </div>
        <div id="profileDropdown" style="display:none;position:absolute;top:120%;right:0;background:white;border-radius:8px;box-shadow:0 10px 25px rgba(0,0,0,0.15);width:260px;z-index:100;overflow:hidden;border:1px solid #e2e8f0;text-align:left;">
          <div style="padding:10px 14px;font-size:11px;font-weight:700;color:#64748b;background:#f8fafc;border-bottom:1px solid #e2e8f0;text-transform:uppercase;letter-spacing:0.5px;">Ganti Akun Cepat</div>
          ${savedItems}
          <div onclick="switchRole(event)" style="padding:11px 14px;cursor:pointer;font-size:12.5px;font-weight:500;border-bottom:1px solid #e2e8f0;color:#334155;display:flex;align-items:center;gap:8px;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">Tambah Akun Lain</div>
          <div onclick="logout(event)" style="padding:11px 14px;cursor:pointer;font-size:12.5px;font-weight:600;color:#dc2626;display:flex;align-items:center;gap:8px;" onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='white'">Log Out</div>
        </div>
      </div>
    </div>
  `;
}

function switchToAccount(e, username) {
  if (e) e.stopPropagation();
  const allAccounts = getAllAvailableAccounts();

  const user = allAccounts.find(
    (u) => (u.username || "").toLowerCase() === (username || "").toLowerCase(),
  );
  if (user) {
    user.role = getRoleLabel(user.role);
    const userStr = JSON.stringify(user);
    try {
      sessionStorage.setItem("currentUser", userStr);
      sessionStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("currentUser", userStr);
      localStorage.setItem("isAuthenticated", "true");
      getAppStorage().setItem("currentUser", userStr);
      getAppStorage().setItem("isAuthenticated", "true");
      if (window.parent) {
        if (window.parent.sessionStorage) {
          window.parent.sessionStorage.setItem("currentUser", userStr);
          window.parent.sessionStorage.setItem("isAuthenticated", "true");
        }
        if (window.parent.localStorage) {
          window.parent.localStorage.setItem("currentUser", userStr);
          window.parent.localStorage.setItem("isAuthenticated", "true");
        }
      }
    } catch (err) {}
    window.location.reload();
  }
}

function toggleProfileMenu() {
  const menu = document.getElementById("profileDropdown");
  const notifDropdown = document.getElementById("notifDropdown");
  if (notifDropdown) notifDropdown.style.display = "none";

  if (menu) {
    menu.style.display =
      menu.style.display === "none" || menu.style.display === ""
        ? "block"
        : "none";
  }
}

document.addEventListener("click", (e) => {
  const notifContainer = document.getElementById("notifContainer");
  const notifDropdown = document.getElementById("notifDropdown");
  if (notifDropdown && notifDropdown.style.display !== "none") {
    if (notifContainer && !notifContainer.contains(e.target)) {
      notifDropdown.style.display = "none";
    }
  }

  const profile = document.querySelector(".profile");
  const menu = document.getElementById("profileDropdown");
  if (profile && !profile.contains(e.target) && menu) {
    menu.style.display = "none";
  }
});

function switchRole(e) {
  if (e) e.stopPropagation();
  try {
    sessionStorage.setItem("isAddingAccount", "true");
    sessionStorage.removeItem("isAuthenticated");
    sessionStorage.removeItem("currentUser");
    sessionStorage.removeItem("dashboard_isAuthenticated");
    sessionStorage.removeItem("dashboard_currentUser");
    if (window.parent && window.parent.sessionStorage) {
      window.parent.sessionStorage.setItem("isAddingAccount", "true");
      window.parent.sessionStorage.removeItem("isAuthenticated");
      window.parent.sessionStorage.removeItem("currentUser");
      window.parent.sessionStorage.removeItem("dashboard_isAuthenticated");
      window.parent.sessionStorage.removeItem("dashboard_currentUser");
    }
  } catch (err) {}
  window.parent.location.href = "/login?portal=dashboard";
}

function stat(icon, num, label, color) {
  return `<div class="stat-card"><div class="stat-icon ${color}">${icon}</div><div><strong>${num}</strong><small>${label}</small></div></div>`;
}

function pageHead(title, desc, button = "") {
  return `<div class="page-head"><div><div class="breadcrumb">Dashboard › ${esc(title)}</div><h1>${esc(title)}</h1><p>${esc(desc)}</p></div>${button}</div>`;
}

function dashboard() {
  const liaUsersSolid = svgIcon(
    '<path d="M 11.5 6 C 9.578125 6 8 7.578125 8 9.5 C 8 11.421875 9.578125 13 11.5 13 C 13.421875 13 15 11.421875 15 9.5 C 15 7.578125 13.421875 6 11.5 6 Z M 20.5 6 C 18.578125 6 17 7.578125 17 9.5 C 17 11.421875 18.578125 13 20.5 13 C 22.421875 13 24 11.421875 24 9.5 C 24 7.578125 22.421875 6 20.5 6 Z M 11.5 8 C 12.339844 8 13 8.660156 13 9.5 C 13 10.339844 12.339844 11 11.5 11 C 10.660156 11 10 10.339844 10 9.5 C 10 8.660156 10.660156 8 11.5 8 Z M 20.5 8 C 21.339844 8 22 8.660156 22 9.5 C 22 10.339844 21.339844 11 20.5 11 C 19.660156 11 19 10.339844 19 9.5 C 19 8.660156 19.660156 8 20.5 8 Z M 7 12 C 4.800781 12 3 13.800781 3 16 C 3 17.113281 3.476563 18.117188 4.21875 18.84375 C 2.886719 19.746094 2 21.28125 2 23 L 4 23 C 4 21.332031 5.332031 20 7 20 C 8.667969 20 10 21.332031 10 23 L 12 23 C 12 21.28125 11.113281 19.746094 9.78125 18.84375 C 10.523438 18.117188 11 17.113281 11 16 C 11 13.800781 9.199219 12 7 12 Z M 12 23 C 11.375 23.835938 11 24.886719 11 26 L 13 26 C 13 24.332031 14.332031 23 16 23 C 17.667969 23 19 24.332031 19 26 L 21 26 C 21 24.886719 20.625 23.835938 20 23 C 19.660156 22.546875 19.25 22.160156 18.78125 21.84375 C 19.523438 21.117188 20 20.113281 20 19 C 20 16.800781 18.199219 15 16 15 C 13.800781 15 12 16.800781 12 19 C 12 20.113281 12.476563 21.117188 13.21875 21.84375 C 12.75 22.160156 12.339844 22.546875 12 23 Z M 20 23 L 22 23 C 22 21.332031 23.332031 20 25 20 C 26.667969 20 28 21.332031 28 23 L 30 23 C 30 21.28125 29.113281 19.746094 27.78125 18.84375 C 28.523438 18.117188 29 17.113281 29 16 C 29 13.800781 27.199219 12 25 12 C 22.800781 12 21 13.800781 21 16 C 21 17.113281 21.476563 18.117188 22.21875 18.84375 C 20.886719 19.746094 20 21.28125 20 23 Z M 7 14 C 8.117188 14 9 14.882813 9 16 C 9 17.117188 8.117188 18 7 18 C 5.882813 18 5 17.117188 5 16 C 5 14.882813 5.882813 14 7 14 Z M 25 14 C 26.117188 14 27 14.882813 27 16 C 27 17.117188 26.117188 18 25 18 C 23.882813 18 23 17.117188 23 16 C 23 14.882813 23.882813 14 25 14 Z M 16 17 C 17.117188 17 18 17.882813 18 19 C 18 20.117188 17.117188 21 16 21 C 14.882813 21 14 20.117188 14 19 C 14 17.882813 14.882813 17 16 17 Z"/>',
    "0 0 32 32",
    'width="28" height="28"',
  );
  const faClock = svgIcon(
    '<path d="M256,8C119,8,8,119,8,256S119,504,256,504,504,393,504,256,393,8,256,8Zm92.49,313h0l-20,25a16,16,0,0,1-22.49,2.5h0l-67-49.72a40,40,0,0,1-15-31.23V112a16,16,0,0,1,16-16h32a16,16,0,0,1,16,16V256l58,42.5A16,16,0,0,1,348.49,321Z"/>',
    "0 0 512 512",
    'width="24" height="24"',
  );
  const faUsers = svgIcon(
    '<path d="M96 224c35.3 0 64-28.7 64-64s-28.7-64-64-64-64 28.7-64 64 28.7 64 64 64zm448 0c35.3 0 64-28.7 64-64s-28.7-64-64-64-64 28.7-64 64 28.7 64 64 64zm32 32h-64c-17.6 0-33.5 7.1-45.1 18.6 40.3 22.1 68.9 62 75.1 109.4h66c17.7 0 32-14.3 32-32v-32c0-35.3-28.7-64-64-64zm-256 0c61.9 0 112-50.1 112-112S381.9 32 320 32 208 82.1 208 144s50.1 112 112 112zm76.8 32h-8.3c-20.8 10-43.9 16-68.5 16s-47.6-6-68.5-16h-8.3C179.6 288 128 339.6 128 403.2V432c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48v-28.8c0-63.6-51.6-115.2-115.2-115.2zm-223.7-13.4C161.5 263.1 145.6 256 128 256H64c-35.3 0-64 28.7-64 64v32c0 17.7 14.3 32 32 32h65.9c6.3-47.4 34.9-87.3 75.2-109.4z"/>',
    "0 0 640 512",
    'width="26" height="26"',
  );
  const bsBuilding = svgIcon(
    '<path d="M2 1a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v7.256A4.5 4.5 0 0 0 12.5 8a4.5 4.5 0 0 0-3.59 1.787A.5.5 0 0 0 9 9.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .39-.187A4.5 4.5 0 0 0 8.027 12H6.5a.5.5 0 0 0-.5.5V16H3a1 1 0 0 1-1-1zm2 1.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5m3 0v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5m3.5-.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5zM4 5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5M7.5 5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5zm2.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5M4.5 8a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5z"/><path d="M11.886 9.46c.18-.613 1.048-.613 1.229 0l.043.148a.64.64 0 0 0 .921.382l.136-.074c.561-.306 1.175.308.87.869l-.075.136a.64.64 0 0 0 .382.92l.149.045c.612.18.612 1.048 0 1.229l-.15.043a.64.64 0 0 0-.38.921l.074.136c.305.561-.309 1.175-.87.87l-.136-.075a.64.64 0 0 0-.92.382l-.045.149c-.18.612-1.048.612-1.229 0l-.043-.15a.64.64 0 0 0-.921-.38l-.136.074c-.561.305-1.175-.309-.87-.87l.075-.136a.64.64 0 0 0-.382-.92l-.148-.045c-.613-.18-.613-1.048 0-1.229l.148-.043a.64.64 0 0 0 .382-.921l-.074-.136c-.306-.561.308-1.175.869-.87l.136.075a.64.64 0 0 0 .92-.382zM14 12.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0"/>',
    "0 0 16 16",
    'width="24" height="24" fill="currentColor"',
  );
  // TiExport — react-icons/ti (viewBox 0 0 24 24)
  const tiExport = svgIcon(
    '<path d="M22.711 9.796c-.041-.041-4.055-4.096-5.982-6.146-.42-.414-.999-.65-1.586-.65-1.182 0-2.143.896-2.143 2h-8c-.553 0-1 .448-1 1v14c0 .552.447 1 1 1h14c.553 0 1-.448 1-1v-6.045c1.434-1.461 2.688-2.729 2.711-2.751.387-.39.387-1.018 0-1.408zm-7.432 6.145l-.136.059-.144-.04v-3.96h-1c-1.771.034-3.336.68-4.753 1.958.43-2.215 1.6-4.958 4.753-4.958h1v-3.958l.144-.042.154.05c1.436 1.525 4.051 4.187 5.297 5.45-.253.257-4.342 4.422-5.315 5.441zm-9.279 3.059v-12h8v1c-4.66 0-6 4.871-6 8.5v.5c1.691-2.578 3.6-3.953 6-4v3c0 .551.512 1 1.143 1 .364 0 .676-.158.883-.391.539-.565 1.242-1.291 1.976-2.043v4.434h-12.002z"/>',
    "0 0 24 24",
  );
  const faEye = svgIcon(
    '<path d="M572.52 241.4C518.29 135.59 410.93 64 288 64S57.68 135.64 3.48 241.41a32.35 32.35 0 0 0 0 29.19C57.71 376.41 165.07 448 288 448s230.32-71.64 284.52-177.41a32.35 32.35 0 0 0 0-29.19zM288 400a144 144 0 1 1 144-144 143.93 143.93 0 0 1-144 144zm0-240a95.31 95.31 0 0 0-25.31 3.79 47.85 47.85 0 0 1-66.9 66.9A95.78 95.78 0 1 0 288 160z"/>',
    "0 0 576 512",
    'width="16" height="16"',
  );

  const currentUser = getCurrentUser();
  const isAdmin = isAdminRole(currentUser);
  const stats = getMeetingStatistics();

  const selectedRoom = state.dashboardRoomFilter || "semua";
  const f = state.reportFilter;
  let meetingsToDisplay = [...(state.meetings || [])];

  // 1. Filter Ruangan jika dipilih
  if (selectedRoom && selectedRoom !== "semua") {
    meetingsToDisplay = meetingsToDisplay.filter(
      (m) => m.room === selectedRoom,
    );
  }

  // 2. Filter Periode Rapat
  if (f) {
    if (f.mode === "harian") {
      const today = getTodayIsoDate();
      meetingsToDisplay = meetingsToDisplay.filter((m) => m.date === today);
    } else if (f.mode === "mingguan") {
      const start = f.startDate || awalMinggu();
      const end = f.endDate || akhirMinggu();
      meetingsToDisplay = meetingsToDisplay.filter(
        (m) => m.date >= start && m.date <= end,
      );
    } else if (f.mode === "date" && f.startDate && f.endDate) {
      meetingsToDisplay = meetingsToDisplay.filter(
        (m) => m.date >= f.startDate && m.date <= f.endDate,
      );
    } else if (f.mode === "bulanan" && f.startDate && f.endDate) {
      meetingsToDisplay = meetingsToDisplay.filter(
        (m) => m.date >= f.startDate && m.date <= f.endDate,
      );
    }
  }

  // Urutkan jadwal: kronologis tanggal & jam
  meetingsToDisplay.sort((a, b) => {
    if (a.date !== b.date) return (b.date || "").localeCompare(a.date || "");
    return (a.start || "").localeCompare(b.start || "");
  });

  // Hitung tren aktivitas mingguan (Bulan Ini) & live monitoring ruangan untuk Admin
  const todayIso = getTodayIsoDate();
  const ym = todayIso.slice(0, 7);
  const monthMeetings = (state.meetings || []).filter((m) =>
    (m.date || "").startsWith(ym),
  );
  const targetMeetings =
    monthMeetings.length > 0 ? monthMeetings : state.meetings || [];

  const weekRanges = [
    { label: "Mgg 1", sub: "1–7 Okt", minDay: 1, maxDay: 7 },
    { label: "Mgg 2", sub: "8–14 Okt", minDay: 8, maxDay: 14 },
    { label: "Mgg 3", sub: "15–21 Okt", minDay: 15, maxDay: 21 },
    { label: "Mgg 4", sub: "22–28 Okt", minDay: 22, maxDay: 28 },
    { label: "Mgg 5", sub: "29–31 Okt", minDay: 29, maxDay: 31 },
  ];

  const weekCounts = weekRanges.map((w) => {
    const count = targetMeetings.filter((m) => {
      const parts = (m.date || "").split("-");
      const d = parseInt(parts[2], 10);
      return !isNaN(d) && d >= w.minDay && d <= w.maxDay;
    }).length;
    return { ...w, count };
  });

  const maxWeekCount = Math.max(...weekCounts.map((w) => w.count), 3);

  const weekBarsHTML = weekCounts
    .map((w) => {
      const heightPct =
        w.count > 0
          ? Math.min(
              100,
              Math.max(22, Math.round((w.count / maxWeekCount) * 85)),
            )
          : 10;
      const barColor = w.count > 0 ? "#1769aa" : "#cbd5e1";
      return `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end;">
          <span style="font-size:12px;font-weight:700;color:${w.count > 0 ? "#0c2d5e" : "#94a3b8"};margin-bottom:6px;">${w.count}</span>
          <div style="width:100%;max-width:44px;background:#f8fafc;border-radius:6px 6px 0 0;height:110px;display:flex;align-items:flex-end;overflow:hidden;border:1px solid #eef2f6;" title="${w.label} (${w.sub}): ${w.count} Rapat">
            <div style="width:100%;height:${heightPct}%;background:${barColor};border-radius:5px 5px 0 0;transition:height 0.3s ease;"></div>
          </div>
          <span style="font-size:11.5px;font-weight:700;color:#0c2d5e;margin-top:8px;">${w.label}</span>
          <span style="font-size:10px;color:#64748b;font-weight:500;">${w.sub}</span>
        </div>
      `;
    })
    .join("");

  const roomsMonitoringHTML = (state.rooms || [])
    .map((room) => {
      const activeMeeting = (state.meetings || []).find(
        (m) =>
          m.room === room.name && (m.status || "").toLowerCase() === "berjalan",
      );
      const nextMeetingToday = !activeMeeting
        ? (state.meetings || []).find(
            (m) =>
              m.room === room.name &&
              m.date === todayIso &&
              ((m.status || "").toLowerCase() === "akan datang" ||
                (m.status || "").toLowerCase() === "segera"),
          )
        : null;

      const isOccupied = !!activeMeeting;
      const roomMeetings = (state.meetings || []).filter(
        (m) => m.room === room.name,
      ).length;
      const roomPct =
        stats.totalMeetings > 0
          ? Math.round((roomMeetings / stats.totalMeetings) * 100)
          : room.id === 1
            ? 65
            : 35;

      return `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
          <div style="min-width:0;">
            <strong style="font-size:13px;color:#0c2d5e;display:block;">${esc(room.name)}</strong>
            <small style="font-size:11px;color:#64748b;">${esc(room.location || "Lt. 3")} · Kapasitas ${room.capacity || 20} org</small>
          </div>
          <div>
            ${
              isOccupied
                ? `<span style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;padding:3px 9px;border-radius:12px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:4px;">
                    <span style="width:6px;height:6px;border-radius:50%;background:#dc2626;"></span>
                    <span>Sedang Digunakan</span>
                  </span>`
                : `<span style="background:#dcfce7;color:#15803d;border:1px solid #bbf7d0;padding:3px 9px;border-radius:12px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:4px;">
                    <span style="width:6px;height:6px;border-radius:50%;background:#16a34a;"></span>
                    <span>Tersedia Saat Ini</span>
                  </span>`
            }
          </div>
        </div>

        <div style="font-size:11px;color:#475569;display:flex;align-items:center;gap:6px;">
          ${
            isOccupied
              ? `<span>📋 Rapat: <b>${esc(activeMeeting.title)}</b> (${activeMeeting.start}–${activeMeeting.end})</span>`
              : nextMeetingToday
                ? `<span>🕒 Jadwal Berikutnya: <b>${esc(nextMeetingToday.title)}</b> (${nextMeetingToday.start})</span>`
                : `<span style="color:#94a3b8;">Tidak ada rapat berikutnya hari ini</span>`
          }
        </div>

        <div>
          <div style="display:flex;justify-content:space-between;font-size:10.5px;color:#64748b;margin-bottom:3px;font-weight:600;">
            <span>Pemanfaatan Ruangan</span>
            <span>${roomPct}% (${roomMeetings} rapat)</span>
          </div>
          <div style="height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${roomPct}%;background:${isOccupied ? "#dc2626" : "#1769aa"};border-radius:3px;transition:width 0.3s ease;"></div>
          </div>
        </div>
      </div>
    `;
    })
    .join("");

  let customTableHTML = `
    <div class="dash-table-card" style="margin:0;">
      <div class="dash-section-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #eef3f9;">
        <div style="display:flex;align-items:center;gap:10px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0c2d5e" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          <div>
            <h2 style="font-size:16px;font-weight:700;color:#0c2d5e;margin:0;line-height:1.2;">${isAdmin ? "Jadwal Rapat & Operasional" : "Jadwal Rapat"}</h2>
            <small style="font-size:11px;color:#64748b;font-weight:500;">${isAdmin ? "Pantau pelaksanaan rapat, quick check-in, dan check-out." : "Daftar jadwal seluruh permohonan rapat."}</small>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
        ${
          isAdmin
            ? `
            <div class="rep-export-wrapper" style="position: relative; display: inline-block;">
              <button class="rep-export-btn" id="exportBtn" type="button" onclick="toggleExportMenu(event)" style="height:32px;padding:0 12px;border-radius:7px;border:1px solid #cbd5e1;background:#fff;color:#0c2d5e;font-size:11.5px;font-weight:600;display:inline-flex;align-items:center;gap:5px;cursor:pointer;">
                ${tiExport}
                <span>Export</span>
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style="margin-left: 2px;">
                  <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <div id="exportMenuDropdown" class="rep-export-menu" style="display: none; position: absolute; top: calc(100% + 6px); right: 0; background: #ffffff; border-radius: 8px; box-shadow: 0 10px 25px rgba(12, 45, 94, 0.12); border: 1px solid #e2e8f0; min-width: 140px; z-index: 1000; overflow: hidden;">
                <button type="button" onclick="exportExcel(); closeExportMenu();" style="width: 100%; display: flex; align-items: center; gap: 8px; padding: 10px 16px; border: none; background: transparent; font-size: 13px; font-weight: 600; color: #0c2d5e; cursor: pointer; text-align: left; transition: background 0.15s;" onmouseover="this.style.background='#f0f4fa'" onmouseout="this.style.background='transparent'">
                  <span>📊</span> Export Excel
                </button>
                <button type="button" onclick="exportPDF(); closeExportMenu();" style="width: 100%; display: flex; align-items: center; gap: 8px; padding: 10px 16px; border: none; background: transparent; font-size: 13px; font-weight: 600; color: #0c2d5e; cursor: pointer; text-align: left; border-top: 1px solid #f1f5f9; transition: background 0.15s;" onmouseover="this.style.background='#f0f4fa'" onmouseout="this.style.background='transparent'">
                  <span>📄</span> Export PDF
                </button>
              </div>
            </div>
            <button type="button" class="btn btn-primary" onclick="openMeetingModal()" style="background:#0c2d5e;color:#fff;border:none;padding:7px 14px;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:background 0.15s;box-shadow:0 2px 6px rgba(12,45,94,0.15);" onmouseover="this.style.background='#133b75'" onmouseout="this.style.background='#0c2d5e'">
              <span style="font-size:14px;font-weight:700;line-height:1;">+</span>
              <span>Tambah Rapat</span>
            </button>
            `
            : ""
        }
        </div>
      </div>

      <!-- Filter Bar Terpadu (Filter Ruangan · Periode Rapat · Terapkan Filter) -->
      <div class="dash-inline-filters" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px;padding:9px 12px;background:#f8fafc;border:1px solid #eef2f6;border-radius:10px;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <select id="trafficRoom" onchange="state.dashboardRoomFilter=this.value;render();" style="padding:7px 11px;border-radius:7px;font-size:12px;font-weight:600;color:#0c2d5e;border:1px solid #cbd5e1;background:#fff;cursor:pointer;outline:none;">
            <option value="semua">Semua Ruangan</option>
            ${state.rooms.map((r) => `<option value="${r.name}" ${selectedRoom === r.name ? "selected" : ""}>${esc(r.name)}</option>`).join("")}
          </select>

          <button type="button" onclick="openFilterModal()" style="display:inline-flex;align-items:center;gap:5px;font-weight:600;font-size:12px;padding:7px 12px;background:#fff;border:1px solid #cbd5e1;border-radius:7px;color:#0c2d5e;cursor:pointer;" title="Klik untuk mengubah periode jadwal yang ditampilkan">
            <span>📅 Periode:</span> <strong>${getActivePeriodLabel()}</strong>
          </button>

          <button type="button" onclick="applyDashboardFilter()" style="padding:7px 14px;background:#1769aa;color:#fff;border:none;border-radius:7px;font-weight:600;font-size:12px;cursor:pointer;transition:background 0.15s;" onmouseover="this.style.background='#0c2d5e'" onmouseout="this.style.background='#1769aa'">
            Terapkan Filter
          </button>
        </div>

        ${
          selectedRoom !== "semua" ||
          (f && f.mode !== "bulanan" && f.mode !== "semua")
            ? `<button type="button" onclick="resetDashboardFilter()" style="background:none;border:none;color:#64748b;font-size:11.5px;font-weight:600;cursor:pointer;text-decoration:underline;">Reset Filter</button>`
            : ""
        }
      </div>

      <div class="dash-table-wrapper" style="overflow-x:auto;width:100%;">
        <table style="width:100%;border-collapse:collapse;table-layout:auto;">
          <thead>
            <tr>
              <th style="width:32px;text-align:center;padding:10px 4px;">No</th>
              <th style="padding:10px 8px;">Judul Rapat</th>
              <th style="padding:10px 8px;">Pemesan</th>
              <th style="padding:10px 8px;">Ruangan</th>
              <th style="padding:10px 8px;">Waktu</th>
              <th style="padding:10px 8px;">Status</th>
              <th style="text-align:center;padding:10px 8px;min-width:${isAdmin ? "170px" : "115px"};width:${isAdmin ? "170px" : "115px"};">Aksi</th>
            </tr>
          </thead>
          <tbody>
  `;

  if (!meetingsToDisplay || meetingsToDisplay.length === 0) {
    customTableHTML += `<tr><td colspan="7" style="text-align:center;padding:36px;color:#8c9ba5;font-weight:500;">Belum ada jadwal rapat pada periode ini</td></tr>`;
  } else {
    meetingsToDisplay.forEach((m, i) => {
      let statusColor = "#e0f2fe";
      let statusText = "#0284c7";
      const sLower = (m.status || "").toLowerCase();
      if (sLower === "berjalan") {
        statusColor = "#dcfce7";
        statusText = "#15803d";
      } else if (sLower === "selesai") {
        statusColor = "#e0f2fe";
        statusText = "#0284c7";
      } else if (sLower === "akan datang" || sLower === "segera") {
        statusColor = "#fef3c7";
        statusText = "#b45309";
      } else if (sLower === "dibatalkan") {
        statusColor = "#fee2e2";
        statusText = "#dc2626";
      } else if (sLower.includes("menunggu")) {
        statusColor = "#fff7ed";
        statusText = "#ea580c";
      }

      const isCompleted = sLower === "selesai";
      const rev =
        typeof getMeetingReview === "function" ? getMeetingReview(m) : m.review;
      const isPendingStatus =
        sLower.includes("menunggu") || sLower === "pending";
      const isCanceledOrRejected =
        sLower === "ditolak" ||
        sLower === "dibatalkan" ||
        sLower === "rejected" ||
        sLower === "cancelled";
      const canShowQr = !isPendingStatus && !isCanceledOrRejected;

      const starSvg = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
      const qrSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`;

      const viewBtn = `<button type="button" style="background-color:#f1f5f9;color:#0c2d5e;border:1px solid #e2e8f0;border-radius:6px;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:background 0.15s;" title="Lihat Detail Rapat" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'" onclick="viewMeeting('${m.id}')">${faEye}</button>`;
      const qrBtn = canShowQr
        ? `<button type="button" style="background-color:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:6px;padding:0 7px;height:28px;display:inline-flex;align-items:center;gap:3px;cursor:pointer;font-size:11px;font-weight:700;transition:background 0.15s;" title="Buka QR Pass & Presensi Rapat" onclick="openMeetingQRModal('${m.id}')">${qrSvg}<span>QR</span></button>`
        : "";
      const revBtn =
        isCompleted && rev
          ? `<button type="button" style="background-color:#fff8e6;color:#d97706;border:1px solid #fde68a;border-radius:6px;padding:0 6px;height:28px;display:inline-flex;align-items:center;gap:3px;cursor:pointer;font-size:11px;font-weight:700;" title="Lihat Rating & Review Pengguna" onclick="openMeetingReviewModal('${m.id}')">${starSvg}<span>${rev.rating ? Number(rev.rating).toFixed(1) : "5.0"}</span></button>`
          : "";

      let actionButtons = "";
      if (isPendingStatus) {
        if (m.rejectedBy) {
          actionButtons += `<span style="font-size:10.5px;color:#ff4d4f;background:#ffebee;padding:3px 8px;border-radius:12px;font-weight:700;">Ditolak (${esc(m.rejectedBy)})</span>`;
        } else if (can("approve", currentUser)) {
          actionButtons += `<button type="button" onclick="approveMeeting('${m.id}')" style="background:#219653;color:#fff;border:none;border-radius:6px;padding:0 9px;height:28px;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:3px;transition:background 0.15s;" title="Setujui permohonan">✓ Setujui</button>`;
          actionButtons += `<button type="button" onclick="rejectMeeting('${m.id}')" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:6px;padding:0 9px;height:28px;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:3px;transition:background 0.15s;" title="Tolak permohonan">✕ Tolak</button>`;
        } else {
          actionButtons += `<span style="font-size:10.5px;color:#d97706;background:#fef3c7;padding:3px 7px;border-radius:6px;font-weight:600;">⏳ Menunggu Pimpinan</span>`;
        }
        actionButtons += viewBtn;
      } else if (isAdmin) {
        if (sLower === "berjalan") {
          actionButtons += `<button type="button" onclick="checkOutMeetingManual('${m.id}')" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:6px;padding:0 8px;height:28px;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:3px;transition:all 0.15s;" title="Check-Out Manual oleh Admin (Catatan: Peserta juga dapat Check-Out mandiri via Barcode/QR)"><span>Check Out (Manual)</span></button>`;
        } else if (
          sLower === "akan datang" ||
          sLower === "segera" ||
          sLower === "disetujui"
        ) {
          actionButtons += `<button type="button" onclick="checkInMeetingManual('${m.id}')" style="background:#dcfce7;color:#15803d;border:1px solid #bbf7d0;border-radius:6px;padding:0 8px;height:28px;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:3px;transition:all 0.15s;" title="Check-In Manual oleh Admin (Gunakan ini jika peserta tidak scan Barcode/QR di ruangan)"><span>✓ Check In (Manual)</span></button>`;
        }
        actionButtons += qrBtn;
        actionButtons += viewBtn;
        if (revBtn) actionButtons += revBtn;
      } else {
        actionButtons = `${viewBtn}${qrBtn}${revBtn}`;
      }

      const isQrMethod =
        m.checkInMethod === "barcode_qr" ||
        (m.checkedInBy &&
          (m.checkedInBy.toLowerCase().includes("qr") ||
            m.checkedInBy.toLowerCase().includes("barcode")));
      const isManualMethod =
        m.checkInMethod === "manual_admin" ||
        (m.checkedInBy && m.checkedInBy.toLowerCase().includes("admin"));
      const methodBadge =
        sLower === "berjalan"
          ? isQrMethod
            ? `<div style="margin-top:3px;"><span style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;padding:1px 6px;border-radius:8px;font-size:9.5px;font-weight:700;display:inline-flex;align-items:center;gap:2px;" title="Check-In otomatis via Barcode/QR oleh ${esc(m.checkedInBy || "Peserta")}"><span>📱</span><span>Scan QR</span></span></div>`
            : isManualMethod
              ? `<div style="margin-top:3px;"><span style="background:#fef3c7;color:#b45309;border:1px solid #fde68a;padding:1px 6px;border-radius:8px;font-size:9.5px;font-weight:700;display:inline-flex;align-items:center;gap:2px;" title="Check-In manual oleh Admin"><span>👤</span><span>Manual Admin</span></span></div>`
              : ""
          : "";

      const actionBtn = `<div style="display:inline-flex;align-items:center;gap:5px;white-space:nowrap;justify-content:center;">${actionButtons}</div>`;

      customTableHTML += `<tr>
        <td style="text-align:center;padding:10px 4px;font-size:12px;color:#64748b;">${i + 1}</td>
        <td style="font-weight:700;white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis;padding:10px 8px;" title="${esc(m.title)}">${esc(m.title)}</td>
        <td style="white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis;padding:10px 8px;" title="${esc(m.requester || m.bookedBy || "TU")}">${esc(m.requester || m.bookedBy || "TU")}</td>
        <td style="white-space:nowrap;max-width:140px;overflow:hidden;text-overflow:ellipsis;padding:10px 8px;" title="${esc(m.room)}">${esc(m.room)}</td>
        <td style="white-space:nowrap;font-size:12px;padding:10px 8px;">${formatDate(m.date)} · ${m.start}-${m.end}</td>
        <td style="padding:10px 8px;"><span style="background:${statusColor};color:${statusText};padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap;display:inline-block;">${esc(m.status)}</span>${methodBadge}</td>
        <td style="text-align:center;padding:10px 6px;white-space:nowrap;">${actionBtn}</td>
      </tr>`;
    });
  }

  customTableHTML += `
          </tbody>
        </table>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:auto;padding-top:14px;border-top:1px solid #f1f5f9;">
        <a href="#meetings" style="font-size:12.5px;font-weight:700;color:#1769aa;text-decoration:none;display:inline-flex;align-items:center;gap:6px;transition:opacity 0.15s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
          <span>Lihat Semua di Manajemen Rapat</span>
          <span style="font-size:14px;line-height:1;">→</span>
        </a>
      </div>
    </div>
  `;

  return `
    <div class="rep-page-wrapper">
      <div class="rep-header">
        <div>
          <div class="rep-breadcrumb">${isAdmin ? "Dashboard · Administrator" : "Dashboard · Pimpinan"}</div>
          <h1>${isAdmin ? "Dashboard Operasional" : "Dashboard"}</h1>
          <p>${isAdmin ? "Pusat komando operasional dan pemantauan ruang rapat real-time." : "Ringkasan statistik penggunaan rapat."}</p>
        </div>
        <div class="dash-actions">
          ${getProfileHTML()}
        </div>
      </div>
      
      ${
        isAdmin
          ? `
          <!-- 4 Kartu Statistik Ringkas Admin (Full Width di Bawah Header) -->
          <div class="rep-cards-compact" style="padding: 0 40px 20px;">
            <div class="rep-card-compact" style="cursor:pointer;" onclick="location.hash='#meetings';" title="Buka Manajemen Rapat">
              <div class="rc-icon-compact" style="background:#e0f2fe;color:#0284c7;">${liaUsersSolid}</div>
              <div class="rc-text-compact">
                <strong>${stats.totalMeetings}</strong>
                <span>Total Rapat <small style="font-weight:500;color:#64748b;font-size:11px;">(Bulan ini)</small></span>
              </div>
            </div>
            <div class="rep-card-compact" style="cursor:pointer;" onclick="location.hash='#calendar';" title="Buka Kalender Jadwal Rapat">
              <div class="rc-icon-compact" style="background:#fef3c7;color:#b45309;">${faClock}</div>
              <div class="rc-text-compact">
                <strong>${stats.totalHours} Jam</strong>
                <span>Total Durasi <small style="font-weight:500;color:#64748b;font-size:11px;">(Bulan ini)</small></span>
              </div>
            </div>
            <div class="rep-card-compact" style="cursor:pointer;" onclick="location.hash='#users';" title="Buka Manajemen Pengguna">
              <div class="rc-icon-compact" style="background:#f3e8ff;color:#7e22ce;">${faUsers}</div>
              <div class="rc-text-compact">
                <strong>${stats.totalUsers}</strong>
                <span>Total Pengguna <small style="font-weight:500;color:#64748b;font-size:11px;">(Terdaftar)</small></span>
              </div>
            </div>
            <div class="rep-card-compact" style="cursor:pointer;" onclick="location.hash='#rooms';" title="Buka Manajemen Ruangan">
              <div class="rc-icon-compact" style="background:#dcfce7;color:#15803d;">${bsBuilding}</div>
              <div class="rc-text-compact">
                <strong>${stats.roomUtilization}%</strong>
                <span>Pemanfaatan <small style="font-weight:500;color:#64748b;font-size:11px;">(${stats.runningCount > 0 ? stats.runningCount + " ruang aktif" : "Siap digunakan"})</small></span>
              </div>
            </div>
          </div>

          <!-- Middle Section: 2 Balanced Monitoring Charts -->
          <div class="rep-charts-admin">
            <!-- Chart 1: Tren Aktivitas Rapat (Mingguan Bulan Ini) -->
            <div class="admin-chart-card">
              <div class="admin-chart-header">
                <div>
                  <h2>Tren Aktivitas Rapat</h2>
                  <small>Distribusi pelaksanaan rapat per minggu (Bulan Ini)</small>
                </div>
                <span style="font-size:11.5px;font-weight:700;color:#1769aa;background:#e6f0fa;border:1px solid #cce3f8;padding:4px 10px;border-radius:12px;">
                  📅 ${stats.totalMeetings} Rapat Bulan Ini
                </span>
              </div>
              <div style="display:flex;align-items:flex-end;gap:12px;height:140px;padding-top:10px;">
                ${weekBarsHTML}
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;padding-top:12px;margin-top:14px;border-top:1px solid #f1f5f9;font-size:11.5px;color:#64748b;flex-wrap:wrap;gap:8px;">
                <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                  <span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:8px;height:8px;border-radius:50%;background:#16a34a;"></span> <b>${stats.runningCount}</b> Sedang Berjalan</span>
                  <span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:8px;height:8px;border-radius:50%;background:#b45309;"></span> <b>${stats.soonCount}</b> Mendatang</span>
                  <span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:8px;height:8px;border-radius:50%;background:#0284c7;"></span> <b>${stats.doneCount}</b> Selesai</span>
                </div>
                <span style="font-weight:600;color:#0c2d5e;">Durasi Total: <b>${stats.totalHours} Jam</b></span>
              </div>
            </div>

            <!-- Chart 2: Status & Okupansi Ruangan Real-Time -->
            <div class="admin-chart-card">
              <div class="admin-chart-header">
                <div>
                  <h2>Status & Okupansi Ruangan</h2>
                  <small>Pemantauan ketersediaan ruangan real-time</small>
                </div>
                <span style="font-size:11px;font-weight:700;color:#15803d;background:#dcfce7;border:1px solid #bbf7d0;padding:4px 9px;border-radius:12px;display:inline-flex;align-items:center;gap:4px;">
                  <span style="width:6px;height:6px;border-radius:50%;background:#16a34a;"></span>
                  <span>Real-Time</span>
                </span>
              </div>
              <div style="display:flex;flex-direction:column;gap:10px;">
                ${roomsMonitoringHTML}
              </div>
              <div style="padding-top:12px;margin-top:auto;border-top:1px solid #f1f5f9;display:flex;align-items:center;justify-content:flex-end;">
                <a href="#rooms" style="font-size:12px;font-weight:700;color:#1769aa;text-decoration:none;display:inline-flex;align-items:center;gap:4px;transition:opacity 0.15s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
                  <span>Kelola Fasilitas di Manajemen Ruangan</span> <span>→</span>
                </a>
              </div>
            </div>
          </div>

          <!-- Bottom Area 2 Kolom: Jadwal Rapat Operasional (Kiri Span 3) & Notifikasi (Kanan Span 1) -->
          <div class="dash-approval-layout" style="padding-top:0;">
            <div class="dash-approval-left">
              ${customTableHTML}
            </div>
            <div class="dash-approval-right">
              <div class="dash-notif-card" style="margin:0; width:100%; box-sizing:border-box;">
                ${getDashboardNotifPanelHTML(currentUser)}
              </div>
            </div>
          </div>
          `
          : `
          <!-- 4 Kartu Statistik Ringkas Pimpinan (Full Width di Bawah Header) -->
          <div class="rep-cards-compact" style="padding: 0 40px 24px;">
            <div class="rep-card-compact" style="cursor:pointer;${stats.pendingCount > 0 ? "border:1.5px solid #fed7aa;background:#fffaf3;" : ""}" onclick="location.hash='#meetings';" title="Klik untuk meninjau permohonan rapat">
              <div class="rc-icon-compact" style="${stats.pendingCount > 0 ? "background:#ffedd5;color:#ea580c;" : ""}">${faClock}</div>
              <div class="rc-text-compact"><strong style="${stats.pendingCount > 0 ? "color:#ea580c;" : ""}">${stats.pendingCount}</strong><span>Perlu Persetujuan</span></div>
            </div>
            <div class="rep-card-compact">
              <div class="rc-icon-compact" style="background:#dcfce7;color:#15803d;">${liaUsersSolid}</div>
              <div class="rc-text-compact"><strong style="color:#15803d;">${stats.runningCount}</strong><span>Sedang Berlangsung</span></div>
            </div>
            <div class="rep-card-compact">
              <div class="rc-icon-compact" style="background:#fef3c7;color:#b45309;">${faClock}</div>
              <div class="rc-text-compact"><strong style="color:#b45309;">${stats.soonCount}</strong><span>Rapat Mendatang</span></div>
            </div>
            <div class="rep-card-compact">
              <div class="rc-icon-compact" style="background:#e0f2fe;color:#0284c7;">${bsBuilding}</div>
              <div class="rc-text-compact"><strong style="color:#0284c7;">${stats.doneCount}</strong><span>Rapat Selesai</span></div>
            </div>
          </div>

          <!-- Main Area 2 Kolom: Jadwal Rapat (Kiri) & Notifikasi Ringkas (Kanan) -->
          <div class="dash-approval-layout">
            <div class="dash-approval-left">
              ${customTableHTML}
            </div>
            <div class="dash-approval-right">
              <div class="dash-notif-card" style="margin:0; width:100%; box-sizing:border-box;">
                ${getDashboardNotifPanelHTML(currentUser)}
              </div>
            </div>
          </div>
          `
      }
    </div>
  `;
}

// ----------------------------------------------------------------------
// BAGIAN YANG DIUBAH: Penambahan parameter "allowDelete" agar tombol
// hapus bisa disembunyikan secara kondisional
// ----------------------------------------------------------------------
function meetingTable(data, actions = true, allowDelete = true) {
  const user = getCurrentUser();
  const isAtasan = isAtasanRole(user);
  const isAdmin = isAdminRole(user);

  const rows =
    !data || data.length === 0
      ? `<tr><td colspan="9" style="text-align:center;padding:36px;color:#8c9ba5;font-weight:500;">Belum ada jadwal rapat</td></tr>`
      : data
          .map((m, i) => {
            const faEye = svgIcon(
              '<path d="M572.52 241.4C518.29 135.59 410.93 64 288 64S57.68 135.64 3.48 241.41a32.35 32.35 0 0 0 0 29.19C57.71 376.41 165.07 448 288 448s230.32-71.64 284.52-177.41a32.35 32.35 0 0 0 0-29.19zM288 400a144 144 0 1 1 144-144 143.93 143.93 0 0 1-144 144zm0-240a95.31 95.31 0 0 0-25.31 3.79 47.85 47.85 0 0 1-66.9 66.9A95.78 95.78 0 1 0 288 160z"/>',
              "0 0 576 512",
              'width="16" height="16"',
            );

            const isCompleted =
              (m.status || "").toLowerCase() === "selesai" ||
              (m.status || "").toLowerCase() === "completed";
            const rev =
              typeof getMeetingReview === "function"
                ? getMeetingReview(m)
                : m.review;
            const hasRev = isCompleted && !!rev;
            const starSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

            const reviewBtn = hasRev
              ? `<button style="background-color:#fff8e6;color:#d97706;border:1px solid #fde68a;border-radius:10px;padding:0 10px;height:34px;display:inline-flex;align-items:center;gap:5px;cursor:pointer;margin-right:8px;font-size:12px;font-weight:700;box-shadow:0 2px 4px rgba(217,119,6,0.08);transition:all 0.15s ease;" title="Lihat Rating & Review Pengguna" onclick="openMeetingReviewModal('${m.id}')">${starSvg}<span>${rev.rating ? Number(rev.rating).toFixed(1) : "5.0"}</span></button>`
              : `<button style="background-color:#f8fafc;color:#94a3b8;border:1px solid #e2e8f0;border-radius:10px;padding:0 9px;height:34px;display:inline-flex;align-items:center;gap:4px;cursor:pointer;margin-right:8px;font-size:11.5px;font-weight:600;transition:all 0.15s ease;" title="Rating & Review Ruangan (Tersedia setelah rapat selesai)" onclick="openMeetingReviewModal('${m.id}')">${starSvg}<span>Review</span></button>`;

            const statusStr = (m.status || "").trim();
            const statusLower = statusStr.toLowerCase();
            const isPending =
              statusLower.includes("menunggu") || statusLower === "pending";
            const isUpcoming =
              statusLower === "akan datang" ||
              statusLower === "disetujui" ||
              statusLower === "approved";
            const isRunning =
              statusLower === "berjalan" ||
              statusLower === "ongoing" ||
              statusLower === "running";
            const isCanceled =
              statusLower === "dibatalkan" ||
              statusLower === "canceled" ||
              statusLower === "cancelled";
            const isRejected =
              statusLower === "ditolak" || statusLower === "rejected";
            const canShowQr = !isPending && !isCanceled && !isRejected;

            const qrSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`;
            const qrBtn = canShowQr
              ? `<button style="background-color:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:10px;padding:0 9px;height:34px;display:inline-flex;align-items:center;gap:4px;cursor:pointer;margin-right:8px;font-size:11.5px;font-weight:700;transition:all 0.15s ease;" title="Tampilkan QR Code Rapat" onclick="openMeetingQRModal('${m.id}')">${qrSvg}<span>QR</span></button>`
              : "";

            let actionButtons = `<button style="background-color:#f4f6f9;color:#0c2d5e;border:none;border-radius:10px;width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;margin-right:8px;box-shadow:0 2px 5px rgba(0,0,0,0.03);" title="Lihat Detail Rapat" onclick="viewMeeting('${m.id}')">${faEye}</button>${qrBtn}${reviewBtn}`;

            if (actions) {
              if (isPending) {
                if (m.rejectedBy) {
                  actionButtons += `<span style="font-size:11px;color:#ff4d4f;margin-right:8px;font-weight:700;background:#ffebee;padding:6px 12px;border-radius:12px;">Ditolak (${esc(m.rejectedBy)})</span>`;
                } else if (can("approve", user)) {
                  // HANYA PIMPINAN YANG MENYETUJUI & MENOLAK
                  actionButtons += `<button style="background-color:#219653;color:#fff;border:none;border-radius:24px;padding:8px 16px;font-weight:700;font-size:12px;cursor:pointer;margin-right:6px;" title="Setujui" onclick="approveMeeting('${m.id}')">✓ Setujui</button>`;
                  actionButtons += `<button style="background-color:#ff4d4f;color:#fff;border:none;border-radius:24px;padding:8px 16px;font-weight:700;font-size:12px;cursor:pointer;" title="Tolak" onclick="rejectMeeting('${m.id}')">✕ Tolak</button>`;
                } else {
                  actionButtons += `<span style="font-size:11px;color:#d97706;background:#fef3c7;padding:5px 10px;border-radius:12px;font-weight:600;">⏳ Menunggu Persetujuan Pimpinan</span>`;
                }
              } else if (isUpcoming && can("checkInOut", user)) {
                actionButtons += `<button style="background-color:#219653;color:#fff;border:none;border-radius:24px;padding:8px 14px;font-weight:700;font-size:12px;cursor:pointer;box-shadow:0 4px 10px rgba(33,150,83,0.2);display:inline-flex;align-items:center;gap:4px;" title="Check-In Manual oleh Admin (Catatan: Peserta juga dapat Check-In mandiri via Barcode/QR di ruangan)" onclick="checkInMeetingManual('${m.id}')"><span>✓ Check In (Manual)</span></button>`;
              } else if (isRunning && can("checkInOut", user)) {
                actionButtons += `<button style="background-color:#ff4d4f;color:#fff;border:none;border-radius:24px;padding:8px 14px;font-weight:700;font-size:12px;cursor:pointer;box-shadow:0 4px 10px rgba(255,77,79,0.2);display:inline-flex;align-items:center;gap:4px;" title="Check-Out Manual oleh Admin (Catatan: Peserta juga dapat Check-Out mandiri via Barcode/QR)" onclick="checkOutMeetingManual('${m.id}')"><span>Check Out (Manual)</span></button>`;
              }

              // Tombol Canceling System Darurat (Emergency Cancellation)
              if (!isCompleted && !isCanceled && can("emergencyCancel", user)) {
                const emgCancelBtn = `<button style="background-color:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:20px;padding:6px 12px;font-weight:700;font-size:11.5px;cursor:pointer;margin-left:6px;display:inline-flex;align-items:center;gap:4px;box-shadow:0 2px 5px rgba(220,38,38,0.08);transition:all 0.15s ease;" title="Batalkan Rapat Darurat (Hanya jika diperlukan)" onclick="openEmergencyCancelModal('${m.id}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg><span>Batal Darurat</span></button>`;
                actionButtons += emgCancelBtn;
              } else if (isCanceled) {
                actionButtons += `<span style="font-size:11px;color:#dc2626;background:#fef2f2;border:1px solid #fecaca;padding:4px 9px;border-radius:12px;font-weight:700;margin-left:6px;display:inline-flex;align-items:center;gap:3px;">✕ Dibatalkan</span>`;
              }
            }

            const isQrMethod =
              m.checkInMethod === "barcode_qr" ||
              (m.checkedInBy &&
                (m.checkedInBy.toLowerCase().includes("qr") ||
                  m.checkedInBy.toLowerCase().includes("barcode")));
            const isManualMethod =
              m.checkInMethod === "manual_admin" ||
              (m.checkedInBy && m.checkedInBy.toLowerCase().includes("admin"));
            const methodTag = isRunning
              ? isQrMethod
                ? `<div style="margin-top:3px;"><span style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700;display:inline-flex;align-items:center;gap:3px;" title="Check-In otomatis via Barcode/QR oleh ${esc(m.checkedInBy || "Peserta")}"><span>📱</span><span>Scan Barcode/QR</span></span></div>`
                : isManualMethod
                  ? `<div style="margin-top:3px;"><span style="background:#fef3c7;color:#b45309;border:1px solid #fde68a;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700;display:inline-flex;align-items:center;gap:3px;" title="Check-In manual oleh Admin (${esc(m.checkedInBy || "Admin")})"><span>👤</span><span>Manual Admin</span></span></div>`
                  : ""
              : isCompleted && (m.checkInMethod || m.checkOutMethod)
                ? m.checkInMethod === "barcode_qr" ||
                  m.checkOutMethod === "barcode_qr"
                  ? `<div style="margin-top:3px;"><span style="background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;padding:2px 7px;border-radius:10px;font-size:9.5px;font-weight:600;" title="Selesai via Barcode/QR">📱 Barcode/QR</span></div>`
                  : `<div style="margin-top:3px;"><span style="background:#f8fafc;color:#64748b;border:1px solid #e2e8f0;padding:2px 7px;border-radius:10px;font-size:9.5px;font-weight:600;" title="Selesai Manual Admin">👤 Manual Admin</span></div>`
                : "";

            const rating = Math.max(
              0,
              Math.min(5, Number(m.review?.rating) || 0),
            );
            const reviewCell = isCompleted
              ? m.review
                ? `<div style="display:flex;flex-direction:column;align-items:flex-start;gap:3px;min-width:105px;"><span style="color:#e4a719;letter-spacing:1px;white-space:nowrap;" aria-label="Rating ${rating} dari 5">${"★".repeat(rating)}<span style="color:#cbd5e1;">${"☆".repeat(5 - rating)}</span></span><button type="button" onclick="viewMeeting('${m.id}')" style="padding:3px 7px;border:1px solid #c9d9ef;border-radius:6px;color:#15508d;background:#f3f8ff;font:600 10px inherit;cursor:pointer;">Lihat Review</button></div>`
                : `<span style="color:#8291a5;font-size:11px;">Belum ada review</span>`
              : `<span style="color:#9aa8b8;">-</span>`;

            return `<tr><td>${i + 1}</td><td><b>${esc(m.title)}</b></td><td>${esc(m.requester)}</td><td>${esc(m.room)}</td><td>${formatDate(m.date)}</td><td>${m.start}-${m.end}</td><td>${badge(m.status)}${methodTag}</td><td>${reviewCell}</td><td><div class="actions">${actionButtons}</div></td></tr>`;
          })
          .join("");

  return `<div class="table-wrap"><table class="table"><thead><tr><th>No</th><th>Judul Rapat</th><th>Pemesan</th><th>Ruangan</th><th>Tanggal</th><th>Waktu</th><th>Status</th><th>Rating &amp; Review</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function meetings() {
  const currentUser = getCurrentUser();
  const isApproval = can("approve", currentUser);
  const stats = getMeetingStatistics();
  const running = stats.runningCount;
  const soon = stats.soonCount;
  const done = stats.doneCount;
  const pending = stats.pendingCount;

  const faCheck = svgIcon(
    '<path d="M173.898 439.404l-166.4-166.4c-9.997-9.997-9.997-26.206 0-36.204l36.203-36.204c9.997-9.998 26.207-9.998 36.204 0L192 312.69 432.095 72.596c9.997-9.997 26.207-9.997 36.204 0l36.203 36.204c9.997 9.997 9.997 26.206 0 36.204l-294.4 294.401c-9.998 9.997-26.207 9.997-36.204-.001z"/>',
    "0 0 512 512",
    'width="24" height="24"',
  );
  const faClock = svgIcon(
    '<path d="M256,8C119,8,8,119,8,256S119,504,256,504,504,393,504,256,393,8,256,8Zm92.49,313h0l-20,25a16,16,0,0,1-22.49,2.5h0l-67-49.72a40,40,0,0,1-15-31.23V112a16,16,0,0,1,16-16h32a16,16,0,0,1,16,16V256l58,42.5A16,16,0,0,1,348.49,321Z"/>',
    "0 0 512 512",
    'width="24" height="24"',
  );
  const faPlay = svgIcon(
    '<path d="M424.4 214.7L72.4 6.6C43.8-10.3 0 6.1 0 47.9V464c0 37.5 40.7 60.1 72.4 41.3l352-208c31.4-18.5 31.5-64.1 0-82.6z"/>',
    "0 0 448 512",
    'width="20" height="20"',
  );
  const faCalendarAlt = svgIcon(
    '<path d="M0 464c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48V192H0v272zm320-196c0-6.6 5.4-12 12-12h40c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12h-40c-6.6 0-12-5.4-12-12v-40zm0 128c0-6.6 5.4-12 12-12h40c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12h-40c-6.6 0-12-5.4-12-12v-40zM192 268c0-6.6 5.4-12 12-12h40c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12h-40c-6.6 0-12-5.4-12-12v-40zm0 128c0-6.6 5.4-12 12-12h40c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12h-40c-6.6 0-12-5.4-12-12v-40zM64 268c0-6.6 5.4-12 12-12h40c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12H76c-6.6 0-12-5.4-12-12v-40zm0 128c0-6.6 5.4-12 12-12h40c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12H76c-6.6 0-12-5.4-12-12v-40zM400 64h-48V16c0-8.8-7.2-16-16-16h-32c-8.8 0-16 7.2-16 16v48H160V16c0-8.8-7.2-16-16-16h-32c-8.8 0-16 7.2-16 16v48H48C21.5 64 0 85.5 0 112v48h448v-48c0-26.5-21.5-48-48-48z"/>',
    "0 0 448 512",
    'width="20" height="20"',
  );
  const ioSearch = svgIcon(
    '<path d="M456.69 421.39 362.6 327.3a173.8 173.8 0 0 0 34.84-104.58C397.44 126.38 319.06 48 222.72 48S48 126.38 48 222.72s78.38 174.72 174.72 174.72A173.8 173.8 0 0 0 327.3 362.6l94.09 94.09a25 25 0 0 0 35.3-35.3M97.92 222.72a124.8 124.8 0 1 1 124.8 124.8 124.95 124.95 0 0 1-124.8-124.8"/>',
    "0 0 512 512",
    'width="18" height="18"',
  );

  return `
    <div class="dashboard-wrapper">
      <div class="dash-header">
        <div class="dash-title">
          <div class="dash-breadcrumb">Dashboard > Manajemen Rapat</div>
          <h1>Manajemen Rapat</h1>
          <p>${
            isApproval
              ? "Pantau seluruh jadwal rapat dan setujui atau tolak permohonan yang menunggu persetujuan Anda."
              : "Kelola data rapat, pantau jadwal, lakukan check-in/out, dan pastikan setiap rapat berjalan dengan lancar."
          }</p>
        </div>
        <div class="dash-actions">
          ${getProfileHTML()}
        </div>
      </div>
      
      <div class="dash-cards">
        ${
          isApproval
            ? `
        <div class="d-card" style="${pending > 0 ? "border:1.5px solid #fed7aa;background:#fffaf3;" : ""}">
          <div class="dc-icon yellow" style="${pending > 0 ? "background:#ffedd5;color:#ea580c;" : ""}">${faClock}</div>
          <div class="dc-text">
            <strong style="${pending > 0 ? "color:#ea580c;" : ""}">${pending}</strong>
            <span>Perlu Persetujuan</span>
            <small>Menunggu approval Anda</small>
          </div>
        </div>
        <div class="d-card">
          <div class="dc-icon green">${faPlay}</div>
          <div class="dc-text">
            <strong>${running}</strong>
            <span>Rapat Berjalan</span>
            <small>Sedang berlangsung</small>
          </div>
        </div>
        <div class="d-card">
          <div class="dc-icon blue">${faClock}</div>
          <div class="dc-text">
            <strong>${soon}</strong>
            <span>Akan Datang</span>
            <small>Jadwal mendatang</small>
          </div>
        </div>
        <div class="d-card">
          <div class="dc-icon purple">${faCheck}</div>
          <div class="dc-text">
            <strong>${done}</strong>
            <span>Rapat Selesai</span>
            <small>Telah selesai</small>
          </div>
        </div>
            `
            : `
        <div class="d-card">
          <div class="dc-icon blue">${faCalendarAlt}</div>
          <div class="dc-text">
            <strong>${stats.totalMeetings}</strong>
            <span>Total Rapat</span>
            <small>Semua jadwal terdaftar</small>
          </div>
        </div>
        <div class="d-card">
          <div class="dc-icon green">${faPlay}</div>
          <div class="dc-text">
            <strong>${running}</strong>
            <span>Rapat Berjalan</span>
            <small>Sedang berlangsung</small>
          </div>
        </div>
        <div class="d-card">
          <div class="dc-icon yellow">${faClock}</div>
          <div class="dc-text">
            <strong>${soon}</strong>
            <span>Rapat Segera</span>
            <small>Akan datang</small>
          </div>
        </div>
        <div class="d-card">
          <div class="dc-icon purple">${faCheck}</div>
          <div class="dc-text">
            <strong>${done}</strong>
            <span>Rapat Selesai</span>
            <small>Telah selesai</small>
          </div>
        </div>
            `
        }
      </div>
      
      <div class="dash-table-container">
        <div class="dash-tabs">
          ${
            isApproval
              ? `<button class="tab ${pending > 0 ? "active" : ""}" onclick="filterMeetings('Menunggu Approval',this)" style="color:#ea580c;font-weight:700;">⏳ Perlu Persetujuan (${pending})</button>`
              : ""
          }
          <button class="tab ${isApproval && pending > 0 ? "" : "active"}" onclick="filterMeetings('Semua',this)">Semua Rapat (${state.meetings.length})</button>
          <button class="tab" onclick="filterMeetings('Berjalan',this)">Rapat Berjalan (${running})</button>
          <button class="tab" onclick="filterMeetings('Akan Datang',this)">Akan Datang (${soon})</button>
          <button class="tab" onclick="filterMeetings('Selesai',this)">Rapat Selesai (${done})</button>
          ${
            !isApproval
              ? `<button class="tab" onclick="filterMeetings('Menunggu Approval',this)">Menunggu Approval (${pending})</button>`
              : ""
          }
        </div>
        
        <div class="dash-filters">
          <div class="dash-search-box">
            ${ioSearch}
            <input id="meetingSearch" placeholder="Cari rapat..." oninput="filterMeetingTable()">
          </div>
          <select id="meetingRoom" onchange="filterMeetingTable()">
            <option value="">Semua Ruangan</option>
            ${state.rooms.map((r) => `<option>${esc(r.name)}</option>`).join("")}
          </select>
          <select id="meetingStatus" onchange="filterMeetingTable()">
            <option value="">Semua Status</option>
            <option>Berjalan</option>
            <option>Akan Datang</option>
            <option>Selesai</option>
            <option>Menunggu Approval</option>
            <option>Dibatalkan</option>
          </select>
        </div>
        
        <div id="meetingTable">${meetingTable(state.meetings)}</div>
      </div>
    </div>
  `;
}

function getRoomImage(r) {
  if (
    r &&
    Array.isArray(r.images) &&
    r.images.length > 0 &&
    r.images[0] &&
    !r.images[0].includes("unsplash")
  ) {
    return r.images[0];
  }
  if (r && r.image && !r.image.includes("unsplash")) return r.image;
  const n = (r && r.name ? r.name : "").toLowerCase();
  if (n.includes("konsultasi")) {
    return "/dashboard-app/assets/Ruang Konsultasi.jpeg";
  }
  return "/dashboard-app/assets/Ruang Rapat Besar.jpeg";
}

function rooms() {
  // SVG Icons
  // BsBuildingFillGear
  const bsBuildingGear = svgIcon(
    '<path d="M2 1a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v7.256A4.5 4.5 0 0 0 12.5 8a4.5 4.5 0 0 0-3.59 1.787A.5.5 0 0 0 9 9.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .39-.187A4.5 4.5 0 0 0 8.027 12H6.5a.5.5 0 0 0-.5.5V16H3a1 1 0 0 1-1-1zm2 1.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5m3 0v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5m3.5-.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5zM4 5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5M7.5 5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5zm2.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5M4.5 8a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5z"/><path d="M11.886 9.46c.18-.613 1.048-.613 1.229 0l.043.148a.64.64 0 0 0 .921.382l.136-.074c.561-.306 1.175.308.87.869l-.075.136a.64.64 0 0 0 .382.92l.149.045c.612.18.612 1.048 0 1.229l-.15.043a.64.64 0 0 0-.38.921l.074.136c.305.561-.309 1.175-.87.87l-.136-.075a.64.64 0 0 0-.92.382l-.045.149c-.18.612-1.048.612-1.229 0l-.043-.15a.64.64 0 0 0-.921-.38l-.136.074c-.561.305-1.175-.309-.87-.87l.075-.136a.64.64 0 0 0-.382-.92l-.148-.045c-.613-.18-.613-1.048 0-1.229l.148-.043a.64.64 0 0 0 .382-.921l-.074-.136c-.306-.561.308-1.175.869-.87l.136.075a.64.64 0 0 0 .92-.382zM14 12.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0"/>',
    "0 0 16 16",
    'width="36" height="36" fill="#1769aa"',
  );

  // FaCheck
  const faCheck = svgIcon(
    '<path d="M173.898 439.404l-166.4-166.4c-9.997-9.997-9.997-26.206 0-36.204l36.203-36.204c9.997-9.998 26.207-9.998 36.204 0L192 312.69 432.095 72.596c9.997-9.997 26.207-9.997 36.204 0l36.203 36.204c9.997 9.997 9.997 26.206 0 36.204l-294.4 294.401c-9.998 9.997-26.207 9.997-36.204-.001z"/>',
    "0 0 512 512",
    'width="22" height="22" fill="#0c2d5e"',
  );

  // FaTimes
  const faTimes = svgIcon(
    '<path d="M242.72 256l100.07-100.07c12.28-12.28 12.28-32.19 0-44.48l-22.24-22.24c-12.28-12.28-32.19-12.28-44.48 0L176 189.28 75.93 89.21c-12.28-12.28-32.19-12.28-44.48 0L9.21 111.45c-12.28 12.28-12.28 32.19 0 44.48L109.28 256 9.21 356.07c-12.28 12.28-12.28 32.19 0 44.48l22.24 22.24c12.28 12.28 32.2 12.28 44.48 0L176 322.72l100.07 100.07c12.28 12.28 32.2 12.28 44.48 0l22.24-22.24c12.28-12.28 12.28-32.19 0-44.48L242.72 256z"/>',
    "0 0 352 512",
    'width="18" height="18" fill="#1769aa"',
  );

  // IoSearch
  const ioSearch = svgIcon(
    '<path d="M456.69 421.39 362.6 327.3a173.8 173.8 0 0 0 34.84-104.58C397.44 126.38 319.06 48 222.72 48S48 126.38 48 222.72s78.38 174.72 174.72 174.72A173.8 173.8 0 0 0 327.3 362.6l94.09 94.09a25 25 0 0 0 35.3-35.3M97.92 222.72a124.8 124.8 0 1 1 124.8 124.8 124.95 124.95 0 0 1-124.8-124.8"/>',
    "0 0 512 512",
    'width="18" height="18"',
  );

  const totalRooms = state.rooms.length;
  const tersediaRooms = state.rooms.filter(
    (r) => r.status === "Tersedia",
  ).length;
  const terpakaiRooms = state.rooms.filter(
    (r) => r.status === "Sedang Digunakan" || r.status === "Terpakai",
  ).length;
  const perbaikanRooms = state.rooms.filter(
    (r) => r.status === "Dalam Perbaikan" || r.status === "Perbaikan",
  ).length;

  return `
    <div class="rooms-wrapper">
      <div class="rooms-header">
        <div class="rooms-title">
          <div class="rooms-breadcrumb">Dashboard &gt; Manajemen Ruangan</div>
          <h1>Manajemen Ruangan</h1>
          <p>Kelola data ruang rapat, fasilitas, dan ketersediaannya.</p>
        </div>
        <div class="rooms-actions">
          ${getProfileHTML()}
        </div>
      </div>

      <!-- Stat Cards -->
      <div class="rooms-stat-grid">
        <div class="r-card">
          <div class="r-icon-box plain">
            ${bsBuildingGear}
          </div>
          <div class="r-info">
            <strong>${totalRooms}</strong>
            <span>Total Ruangan</span>
          </div>
        </div>

        <div class="r-card">
          <div class="r-icon-box circle-blue">
            ${faCheck}
          </div>
          <div class="r-info">
            <strong>${tersediaRooms}</strong>
            <span>Tersedia</span>
          </div>
        </div>

        <div class="r-card">
          <div class="r-icon-box circle-blue">
            <div class="r-dot-red"></div>
          </div>
          <div class="r-info">
            <strong>${terpakaiRooms}</strong>
            <span>Sedang Digunakan</span>
          </div>
        </div>

        <div class="r-card">
          <div class="r-icon-box circle-blue">
            ${faTimes}
          </div>
          <div class="r-info">
            <strong>${perbaikanRooms}</strong>
            <span>Dalam Perbaikan</span>
          </div>
        </div>
      </div>

      <!-- Main Panel -->
      <div class="rooms-panel">
        <div class="rooms-filter-row">
          <div class="rooms-filter-left">
            <div class="rooms-search-box">
              ${ioSearch}
              <input id="roomSearch" placeholder="Cari nama ruangan..." oninput="filterRooms()">
            </div>
            <select id="roomStatus" onchange="filterRooms()">
              <option value="">Semua Status</option>
              <option value="Tersedia">Tersedia</option>
              <option value="Sedang Digunakan">Sedang Digunakan</option>
              <option value="Dalam Perbaikan">Dalam Perbaikan</option>
            </select>
          </div>
          ${
            can("manageRoom")
              ? `<button class="btn-add-room" onclick="openRoomModal()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Tambah Ruangan
          </button>`
              : ""
          }
        </div>

        <div id="roomGrid" class="room-grid-custom">
          ${roomCards(state.rooms)}
        </div>
      </div>
    </div>
  `;
}

function roomCards(data) {
  if (!data || data.length === 0) {
    return '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #4b6a90; font-weight: 500;">Tidak ada ruangan yang sesuai filter.</div>';
  }
  return data
    .map((r) => {
      const count =
        Array.isArray(r.images) && r.images.length > 1
          ? r.images.length
          : r.image
            ? 1
            : 0;
      return `
        <div class="custom-room-card" onclick="editRoom(${r.id})">
          <div class="crc-img-wrap" style="position:relative;">
            <img src="${getRoomImage(r)}" alt="${esc(r.name)}" class="crc-img">
            ${count > 1 ? `<span style="position:absolute;bottom:10px;right:10px;background:rgba(12,45,94,0.85);color:#fff;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:0.3px;display:flex;align-items:center;gap:4px;backdrop-filter:blur(4px);box-shadow:0 2px 6px rgba(0,0,0,0.25);">${count} View</span>` : ""}
          </div>
          <div class="crc-footer">
            <span>${esc(r.name)}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function users() {
  const faUsers = svgIcon(
    '<path d="M96 224c35.3 0 64-28.7 64-64s-28.7-64-64-64-64 28.7-64 64 28.7 64 64 64zm448 0c35.3 0 64-28.7 64-64s-28.7-64-64-64-64 28.7-64 64 28.7 64 64 64zm32 32h-64c-17.6 0-33.5 7.1-45.1 18.6 40.3 22.1 68.9 62 75.1 109.4h66c17.7 0 32-14.3 32-32v-32c0-35.3-28.7-64-64-64zm-256 0c61.9 0 112-50.1 112-112S381.9 32 320 32 208 82.1 208 144s50.1 112 112 112zm76.8 32h-8.3c-20.8 10-43.9 16-68.5 16s-47.6-6-68.5-16h-8.3C179.6 288 128 339.6 128 403.2V432c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48v-28.8c0-63.6-51.6-115.2-115.2-115.2zm-223.7-13.4C161.5 263.1 145.6 256 128 256H64c-35.3 0-64 28.7-64 64v32c0 17.7 14.3 32 32 32h65.9c6.3-47.4 34.9-87.3 75.2-109.4z"/>',
    "0 0 640 512",
    'width="26" height="26"',
  );
  const ioShield = svgIcon(
    '<path d="M479.07 111.36a16 16 0 0 0-13.15-14.74c-86.5-15.52-122.61-26.74-203.33-63.2a16 16 0 0 0-13.18 0C168.69 69.88 132.58 81.1 46.08 96.62a16 16 0 0 0-13.15 14.74c-3.85 61.11 4.36 118.05 24.43 169.24A349.5 349.5 0 0 0 129 393.11c53.47 56.73 110.24 81.37 121.07 85.73a16 16 0 0 0 12 0c10.83-4.36 67.6-29 121.07-85.73a349.5 349.5 0 0 0 71.5-112.51c20.07-51.19 28.28-108.13 24.43-169.24m-131 75.11-110.8 128a16 16 0 0 1-11.41 5.53h-.66a16 16 0 0 1-11.2-4.57l-49.2-48.2a16 16 0 1 1 22.4-22.86l37 36.29 99.7-115.13a16 16 0 0 1 24.2 20.94z"/>',
    "0 0 512 512",
    'width="28" height="28"',
  );
  const ioSearch = svgIcon(
    '<path d="M456.69 421.39 362.6 327.3a173.8 173.8 0 0 0 34.84-104.58C397.44 126.38 319.06 48 222.72 48S48 126.38 48 222.72s78.38 174.72 174.72 174.72A173.8 173.8 0 0 0 327.3 362.6l94.09 94.09a25 25 0 0 0 35.3-35.3M97.92 222.72a124.8 124.8 0 1 1 124.8 124.8 124.95 124.95 0 0 1-124.8-124.8"/>',
    "0 0 512 512",
    'width="18" height="18"',
  );

  const numUsers = state.users.length;
  const numAdmins = state.users.filter(
    (u) => (u.role || "").includes("Admin") || u.role === "Administrator",
  ).length;

  return `
    <div class="dashboard-wrapper">
      <div class="dash-header">
        <div class="dash-title">
          <div class="dash-breadcrumb">Dashboard > Manajemen Pengguna</div>
          <h1>Manajemen Pengguna</h1>
          <p>Kelola data pengguna sistem booking ruang rapat.</p>
        </div>
        <div class="dash-actions">
          ${getProfileHTML()}
        </div>
      </div>
      
      <div class="dash-cards-users">
        <div class="d-card-user">
          <div class="dc-icon-user blue">${faUsers}</div>
          <div class="dc-text-user">
            <strong>${numUsers}</strong>
            <span>Total Pengguna</span>
          </div>
        </div>
        <div class="d-card-user">
          <div class="dc-icon-user orange" style="background:#fef5ec; color:#e79848;">${ioShield}</div>
          <div class="dc-text-user">
            <strong>${numAdmins}</strong>
            <span>Administrator</span>
          </div>
        </div>
      </div>
      
      <div class="dash-table-container">
        <div class="dash-filters">
          <div class="dash-filters-left">
            <div class="dash-search-box">
              ${ioSearch}
              <input id="userSearch" placeholder="Cari nama, username, email..." oninput="filterUsers()">
            </div>
            <select id="userRole" onchange="filterUsers()">
              <option value="">Semua Role</option>
              <option value="User">User</option>
              <option value="Admin">Admin</option>
              <option value="Pimpinan">Pimpinan</option>
            </select>
          </div>
          ${
            isMainAdmin()
              ? `
          <button class="btn-add-user" onclick="openUserModal()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Tambah Pengguna
          </button>
          `
              : ""
          }
        </div>
        
        <div id="userTable">${userTable(state.users)}</div>
      </div>
    </div>
  `;
}

function userTable(data) {
  const faPencilAlt = svgIcon(
    '<path d="M497.9 142.1l-46.1 46.1c-4.7 4.7-12.3 4.7-17 0l-111-111c-4.7-4.7-4.7-12.3 0-17l46.1-46.1c18.7-18.7 49.1-18.7 67.9 0l60.1 60.1c18.8 18.7 18.8 49.1 0 67.9zM284.2 99.8L21.6 362.4.4 483.9c-2.9 16.4 11.4 30.6 27.8 27.8l121.5-21.3 262.6-262.6c4.7-4.7 4.7-12.3 0-17l-111-111c-4.8-4.7-12.4-4.7-17.1 0zM124.1 339.9c-5.5-5.5-5.5-14.3 0-19.8l154-154c5.5-5.5 14.3-5.5 19.8 0s5.5 14.3 0 19.8l-154 154c-5.5 5.5-14.3 5.5-19.8 0zM88 424h48v36.3l-64.5 11.3-31.1-31.1L51.7 376H88v48z"/>',
    "0 0 512 512",
    'width="14" height="14"',
  );
  const faTrashAlt = svgIcon(
    '<path d="M32 464a48 48 0 0 0 48 48h288a48 48 0 0 0 48-48V128H32zm272-256a16 16 0 0 1 32 0v224a16 16 0 0 1-32 0zm-96 0a16 16 0 0 1 32 0v224a16 16 0 0 1-32 0zm-96 0a16 16 0 0 1 32 0v224a16 16 0 0 1-32 0zM432 32H312l-9.4-18.7A24 24 0 0 0 281.1 0H166.8a23.72 23.72 0 0 0-21.4 13.3L136 32H16A16 16 0 0 0 0 48v32a16 16 0 0 0 16 16h416a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16z"/>',
    "0 0 448 512",
    'width="14" height="14"',
  );

  const mainAdmin = isMainAdmin();

  return `<div class="table-wrap"><table class="table"><thead><tr><th>No</th><th>Nama & Akun</th><th>Email</th><th>Jabatan/Unit</th><th>Role</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${data
    .map((u, i) => {
      const roleName = getRoleLabel(u.role);
      let roleColor = "#f1f5f9";
      if (roleName === "User") roleColor = "#e6f0fa";
      else if (roleName === "Admin") roleColor = "#e0f5ec";
      else if (roleName === "Pimpinan") roleColor = "#fef3c7";
      const badgeStyle = `background:${roleColor};color:#0c2d5e;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:700;`;
      const statusStyle =
        (u.status || "Aktif") === "Aktif"
          ? "background:#d1fae5;color:#047857;padding:3px 8px;border-radius:8px;font-size:11px;font-weight:600;"
          : "background:#fee2e2;color:#b91c1c;padding:3px 8px;border-radius:8px;font-size:11px;font-weight:600;";
      const uid = typeof u.id === "string" ? `'${u.id}'` : u.id;
      return `<tr>
        <td>${i + 1}</td>
        <td>
          <div style="font-weight:700;color:#0c2d5e;">${esc(u.name)}</div>
          ${u.username ? `<small style="color:#718dae;font-size:11px;">Username: <b>${esc(u.username)}</b></small>` : ""}
        </td>
        <td>${esc(u.email || "-")}</td>
        <td>${esc(u.dept || "-")}</td>
        <td><span style="${badgeStyle}">${esc(roleName)}</span></td>
        <td><span style="${statusStyle}">${esc(u.status || "Aktif")}</span></td>
        <td>
          ${
            mainAdmin
              ? `
            <div class="actions" style="gap:12px;">
              <button style="background:none;border:none;color:#4b6a90;cursor:pointer;" title="Edit" onclick="editUser(${uid})">${faPencilAlt}</button>
              ${u.username !== "admin" ? `<button style="background:none;border:none;color:#e53e3e;cursor:pointer;" title="Hapus" onclick="deleteUser(${uid})">${faTrashAlt}</button>` : ""}
            </div>
          `
              : `<span style="font-size:11px;color:#94a3b8;font-style:italic;">Hanya Baca</span>`
          }
        </td>
      </tr>`;
    })
    .join("")}</tbody></table></div>`;
}

function getMeetingDateIso(m) {
  if (!m) return "";
  const dStr = String(m.date || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) return dStr;
  try {
    const d = new Date(dStr);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const da = String(d.getDate()).padStart(2, "0");
      return `${y}-${mo}-${da}`;
    }
  } catch (e) {}
  return dStr;
}

function prevCalendarMonth(e) {
  if (e) e.stopPropagation();
  if (state.calendarMonth === undefined) {
    const now = new Date();
    state.calendarYear = now.getFullYear();
    state.calendarMonth = now.getMonth();
  }
  if (state.calendarMonth === 0) {
    state.calendarMonth = 11;
    state.calendarYear -= 1;
  } else {
    state.calendarMonth -= 1;
  }
  render();
}
window.prevCalendarMonth = prevCalendarMonth;

function nextCalendarMonth(e) {
  if (e) e.stopPropagation();
  if (state.calendarMonth === undefined) {
    const now = new Date();
    state.calendarYear = now.getFullYear();
    state.calendarMonth = now.getMonth();
  }
  if (state.calendarMonth === 11) {
    state.calendarMonth = 0;
    state.calendarYear += 1;
  } else {
    state.calendarMonth += 1;
  }
  render();
}
window.nextCalendarMonth = nextCalendarMonth;

function selectCalendarToday(e) {
  if (e) e.stopPropagation();
  const now = new Date();
  state.calendarYear = now.getFullYear();
  state.calendarMonth = now.getMonth();
  state.calendarSelectedDate = getTodayIsoDate();
  render();
}
window.selectCalendarToday = selectCalendarToday;

function selectCalendarDate(dateIso) {
  state.calendarSelectedDate = dateIso;
  try {
    const parts = dateIso.split("-").map(Number);
    if (parts[0] && parts[1]) {
      state.calendarYear = parts[0];
      state.calendarMonth = parts[1] - 1;
    }
  } catch (e) {}
  render();
}
window.selectCalendarDate = selectCalendarDate;

function calendar() {
  const now = new Date();
  if (state.calendarYear === undefined) state.calendarYear = now.getFullYear();
  if (state.calendarMonth === undefined) state.calendarMonth = now.getMonth();
  if (!state.calendarSelectedDate)
    state.calendarSelectedDate = getTodayIsoDate();

  const year = state.calendarYear;
  const month = state.calendarMonth;
  const todayIso = getTodayIsoDate();
  const selectedDate = state.calendarSelectedDate;

  // Header nama bulan & tahun dalam Bahasa Indonesia
  const monthDate = new Date(year, month, 1);
  const monthName = monthDate.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  // Kelompokkan rapat berdasarkan tanggal ISO dari live state.meetings
  const meetings = state.meetings || [];
  const meetingsByDate = {};
  meetings.forEach((m) => {
    const dateIso = getMeetingDateIso(m);
    if (!dateIso) return;
    if (!meetingsByDate[dateIso]) meetingsByDate[dateIso] = [];
    meetingsByDate[dateIso].push(m);
  });

  const days = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
  let cells = days.map((d) => `<div class="cal-head">${d}</div>`).join("");

  // Offset hari Senin = index 0 (getDay: 0=Minggu -> index 6)
  const firstDayIndex = (monthDate.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let blank = 0; blank < firstDayIndex; blank++) {
    cells += `<div class="cal-empty"></div>`;
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const dateIso = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
    const isSelected = dateIso === selectedDate;
    const isToday = dateIso === todayIso;
    const dayMeetings = meetingsByDate[dateIso] || [];
    const hasMeeting = dayMeetings.length > 0;
    const hasPending = dayMeetings.some((m) =>
      (m.status || "").toLowerCase().includes("menunggu"),
    );

    const colIndex = (firstDayIndex + i - 1) % 7;
    const isSat = colIndex === 5;
    const isSun = colIndex === 6;
    const colorCls = isSat ? "cal-sat" : isSun ? "cal-sun" : "";

    let extraCls = "";
    if (isSelected) extraCls += " cal-selected";
    if (isToday) extraCls += " cal-is-today";
    if (hasMeeting) extraCls += " cal-has";

    const titleAttr = hasMeeting
      ? `${i} ${monthName}: ${dayMeetings.length} Rapat (${dayMeetings.map((x) => x.title || x.agenda || "Rapat").join(", ")})`
      : `${i} ${monthName}: Tidak ada jadwal`;

    cells += `
      <div class="cal-day ${extraCls} ${colorCls}" 
           title="${esc(titleAttr)}"
           onclick="selectCalendarDate('${dateIso}')">
        <span>${i}</span>
      </div>
    `;
  }

  // Panel Kanan: Jadwal untuk tanggal yang dipilih
  const selParts = (selectedDate || todayIso).split("-").map(Number);
  const selDateObj = new Date(
    selParts[0],
    (selParts[1] || 1) - 1,
    selParts[2] || 1,
  );
  const isSelectedToday = selectedDate === todayIso;

  const dateHeading = isSelectedToday ? "Jadwal Hari Ini" : `Jadwal Tanggal`;

  const fullDateFormatted = selDateObj.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const selectedMeetings = (meetingsByDate[selectedDate] || []).slice();
  selectedMeetings.sort((a, b) => (a.start || "").localeCompare(b.start || ""));

  let scheduleItems = "";
  if (selectedMeetings.length === 0) {
    scheduleItems = `
      <div class="cal-schedule-empty">
        <div style="font-size:24px;margin-bottom:6px;">📅</div>
        <div style="font-weight:700;color:#0c2d5e;margin-bottom:2px;">Tidak Ada Jadwal</div>
        <div style="font-size:12px;color:#64748b;">Belum ada kegiatan rapat yang dijadwalkan pada tanggal ini.</div>
      </div>
    `;
  } else {
    scheduleItems = selectedMeetings
      .map((m) => {
        const status = m.status || "Menunggu Approval";
        let statusBg = "#e3f2fd";
        let statusText = "#1769aa";
        let statusBorder = "#bfdbfe";
        let dotColor = "#1769aa";

        if (status.includes("Menunggu")) {
          statusBg = "#fff7ed";
          statusText = "#c2410c";
          statusBorder = "#fed7aa";
          dotColor = "#ea580c";
        } else if (status === "Berjalan") {
          statusBg = "#e0f5ec";
          statusText = "#13865b";
          statusBorder = "#bbf7d0";
          dotColor = "#16a34a";
        } else if (status === "Selesai") {
          statusBg = "#f3f0ff";
          statusText = "#5b3dd3";
          statusBorder = "#e9d5ff";
          dotColor = "#8b5cf6";
        } else if (status === "Dibatalkan") {
          statusBg = "#fee2e2";
          statusText = "#dc2626";
          statusBorder = "#fecaca";
          dotColor = "#ef4444";
        }

        const title = m.title || m.agenda || "Rapat";
        const room = m.room || "Ruang Rapat";
        const timeRange = `${m.start || "-"} - ${m.end || "-"} WIB`;
        const requester = m.organizer || m.requester || m.bagian || "-";

        return `
          <div class="cal-meeting-item" onclick="viewMeeting('${esc(m.id)}')" title="Klik untuk melihat detail rapat">
            <div style="width:10px;height:10px;border-radius:50%;background:${dotColor};margin-top:4px;flex-shrink:0;"></div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:700;font-size:13.5px;color:#0c2d5e;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${esc(title)}
              </div>
              <div style="font-size:11.5px;color:#475569;margin-bottom:4px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <span>⏰ ${timeRange}</span>
                <span style="color:#cbd5e1;">·</span>
                <span>🏛️ ${esc(room)}</span>
              </div>
              <div style="font-size:11px;color:#64748b;margin-bottom:6px;">
                Pemesan: <b>${esc(requester)}</b>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
                <span style="background:${statusBg};color:${statusText};border:1px solid ${statusBorder};padding:2px 8px;border-radius:12px;font-size:10.5px;font-weight:700;">
                  ${esc(status)}
                </span>
                <span style="font-size:11px;font-weight:600;color:#1769aa;">Lihat detail →</span>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  return `
  <div class="cal-page-wrapper">
    <div class="cal-header">
      <div>
        <div class="cal-breadcrumb">Dashboard > Kalender</div>
        <h1>Kalender</h1>
        <p>Lihat jadwal rapat dan kegiatan ruangan.</p>
      </div>
      <div class="dash-actions">
        ${getProfileHTML()}
      </div>
    </div>

    <div class="cal-body">
      <div class="cal-card">
        <div class="cal-card-header">
          <div style="display:flex;align-items:center;gap:12px;">
            <h2>${monthName}</h2>
            <button type="button" class="cal-today-btn" onclick="selectCalendarToday(event)" title="Kembali ke hari ini">Hari Ini</button>
          </div>
          <div style="display:flex;gap:6px;">
            <button type="button" class="cal-nav-btn" onclick="prevCalendarMonth(event)" title="Bulan sebelumnya">‹</button>
            <button type="button" class="cal-nav-btn" onclick="nextCalendarMonth(event)" title="Bulan berikutnya">›</button>
          </div>
        </div>
        <div class="cal-grid">${cells}</div>
      </div>

      <div class="cal-card">
        <div class="cal-schedule-header">
          <div>
            <div class="cal-schedule-title">${dateHeading}</div>
            <div class="cal-schedule-subtitle">${fullDateFormatted}</div>
          </div>
          <span class="cal-schedule-count">${selectedMeetings.length} Rapat</span>
        </div>
        <div class="cal-schedule-list">
          ${scheduleItems}
        </div>
      </div>
    </div>
  </div>`;
}

// ----------------------------------------------------------------------
// LAPORAN PENGGUNAAN RUANG RAPAT (MINGGUAN & BULANAN)
// ----------------------------------------------------------------------
function getFilteredReportMeetings() {
  const selectedRoom = state.dashboardRoomFilter || "semua";
  const f = state.reportFilter || {
    mode: "bulanan",
    startDate: awalBulan(),
    endDate: akhirBulan(),
  };
  let list = [...(state.meetings || [])];

  if (selectedRoom && selectedRoom !== "semua") {
    list = list.filter((m) => m.room === selectedRoom);
  }

  if (f.mode === "harian") {
    const today = getTodayIsoDate();
    list = list.filter((m) => m.date === today);
  } else if (f.mode === "mingguan") {
    const start = f.startDate || awalMinggu();
    const end = f.endDate || akhirMinggu();
    list = list.filter((m) => m.date >= start && m.date <= end);
  } else if (f.mode === "bulanan") {
    const start = f.startDate || awalBulan();
    const end = f.endDate || akhirBulan();
    list = list.filter((m) => m.date >= start && m.date <= end);
  } else if (f.mode === "date" && f.startDate && f.endDate) {
    list = list.filter((m) => m.date >= f.startDate && m.date <= f.endDate);
  }

  list.sort((a, b) => {
    if (a.date !== b.date) return (b.date || "").localeCompare(a.date || "");
    return (a.start || "").localeCompare(b.start || "");
  });

  return list;
}
window.getFilteredReportMeetings = getFilteredReportMeetings;

function setReportPeriod(mode) {
  if (mode === "mingguan") {
    state.reportFilter = {
      mode: "mingguan",
      startDate: awalMinggu(),
      endDate: akhirMinggu(),
    };
  } else if (mode === "bulanan") {
    state.reportFilter = {
      mode: "bulanan",
      startDate: awalBulan(),
      endDate: akhirBulan(),
    };
  } else if (mode === "harian") {
    state.reportFilter = {
      mode: "harian",
      startDate: getTodayIsoDate(),
      endDate: getTodayIsoDate(),
    };
  } else if (mode === "semua") {
    state.reportFilter = {
      mode: "semua",
      startDate: "",
      endDate: "",
    };
  }
  render();
  toast(`✓ Periode laporan diubah: ${getActivePeriodLabel()}`);
}
window.setReportPeriod = setReportPeriod;

function onReportRoomChange(room) {
  state.dashboardRoomFilter = room;
  render();
  toast(
    room === "semua"
      ? "✓ Menampilkan semua ruangan"
      : `✓ Filter ruangan: ${room}`,
  );
}
window.onReportRoomChange = onReportRoomChange;

function reports() {
  const currentUser = getCurrentUser();
  const isAdmin = isAdminRole(currentUser);

  const liaUsersSolid = svgIcon(
    '<path d="M 11.5 6 C 9.578125 6 8 7.578125 8 9.5 C 8 11.421875 9.578125 13 11.5 13 C 13.421875 13 15 11.421875 15 9.5 C 15 7.578125 13.421875 6 11.5 6 Z M 20.5 6 C 18.578125 6 17 7.578125 17 9.5 C 17 11.421875 18.578125 13 20.5 13 C 22.421875 13 24 11.421875 24 9.5 C 24 7.578125 22.421875 6 20.5 6 Z M 11.5 8 C 12.339844 8 13 8.660156 13 9.5 C 13 10.339844 12.339844 11 11.5 11 C 10.660156 11 10 10.339844 10 9.5 C 10 8.660156 10.660156 8 11.5 8 Z M 20.5 8 C 21.339844 8 22 8.660156 22 9.5 C 22 10.339844 21.339844 11 20.5 11 C 19.660156 11 19 10.339844 19 9.5 C 19 8.660156 19.660156 8 20.5 8 Z M 7 12 C 4.800781 12 3 13.800781 3 16 C 3 17.113281 3.476563 18.117188 4.21875 18.84375 C 2.886719 19.746094 2 21.28125 2 23 L 4 23 C 4 21.332031 5.332031 20 7 20 C 8.667969 20 10 21.332031 10 23 L 12 23 C 12 21.28125 11.113281 19.746094 9.78125 18.84375 C 10.523438 18.117188 11 17.113281 11 16 C 11 13.800781 9.199219 12 7 12 Z M 12 23 C 11.375 23.835938 11 24.886719 11 26 L 13 26 C 13 24.332031 14.332031 23 16 23 C 17.667969 23 19 24.332031 19 26 L 21 26 C 21 24.886719 20.625 23.835938 20 23 C 19.660156 22.546875 19.25 22.160156 18.78125 21.84375 C 19.523438 21.117188 20 20.113281 20 19 C 20 16.800781 18.199219 15 16 15 C 13.800781 15 12 16.800781 12 19 C 12 20.113281 12.476563 21.117188 13.21875 21.84375 C 12.75 22.160156 12.339844 22.546875 12 23 Z M 20 23 L 22 23 C 22 21.332031 23.332031 20 25 20 C 26.667969 20 28 21.332031 28 23 L 30 23 C 30 21.28125 29.113281 19.746094 27.78125 18.84375 C 28.523438 18.117188 29 17.113281 29 16 C 29 13.800781 27.199219 12 25 12 C 22.800781 12 21 13.800781 21 16 C 21 17.113281 21.476563 18.117188 22.21875 18.84375 C 20.886719 19.746094 20 21.28125 20 23 Z M 7 14 C 8.117188 14 9 14.882813 9 16 C 9 17.117188 8.117188 18 7 18 C 5.882813 18 5 17.117188 5 16 C 5 14.882813 5.882813 14 7 14 Z M 25 14 C 26.117188 14 27 14.882813 27 16 C 27 17.117188 26.117188 18 25 18 C 23.882813 18 23 17.117188 23 16 C 23 14.882813 23.882813 14 25 14 Z M 16 17 C 17.117188 17 18 17.882813 18 19 C 18 20.117188 17.117188 21 16 21 C 14.882813 21 14 20.117188 14 19 C 14 17.882813 14.882813 17 16 17 Z"/>',
    "0 0 32 32",
    'width="28" height="28"',
  );
  const faClock = svgIcon(
    '<path d="M256,8C119,8,8,119,8,256S119,504,256,504,504,393,504,256,393,8,256,8Zm92.49,313h0l-20,25a16,16,0,0,1-22.49,2.5h0l-67-49.72a40,40,0,0,1-15-31.23V112a16,16,0,0,1,16-16h32a16,16,0,0,1,16,16V256l58,42.5A16,16,0,0,1,348.49,321Z"/>',
    "0 0 512 512",
    'width="24" height="24"',
  );
  const faUsers = svgIcon(
    '<path d="M96 224c35.3 0 64-28.7 64-64s-28.7-64-64-64-64 28.7-64 64 28.7 64 64zm448 0c35.3 0 64-28.7 64-64s-28.7-64-64-64-64 28.7-64 64 28.7 64 64zm32 32h-64c-17.6 0-33.5 7.1-45.1 18.6 40.3 22.1 68.9 62 75.1 109.4h66c17.7 0 32-14.3 32-32v-32c0-35.3-28.7-64-64-64zm-256 0c61.9 0 112-50.1 112-112S381.9 32 320 32 208 82.1 208 144s50.1 112 112 112zm76.8 32h-8.3c-20.8 10-43.9 16-68.5 16s-47.6-6-68.5-16h-8.3C179.6 288 128 339.6 128 403.2V432c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48v-28.8c0-63.6-51.6-115.2-115.2-115.2zm-223.7-13.4C161.5 263.1 145.6 256 128 256H64c-35.3 0-64 28.7-64 64v32c0 17.7 14.3 32 32 32h65.9c6.3-47.4 34.9-87.3 75.2-109.4z"/>',
    "0 0 640 512",
    'width="26" height="26"',
  );
  const bsBuilding = svgIcon(
    '<path d="M2 1a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v7.256A4.5 4.5 0 0 0 12.5 8a4.5 4.5 0 0 0-3.59 1.787A.5.5 0 0 0 9 9.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .39-.187A4.5 4.5 0 0 0 8.027 12H6.5a.5.5 0 0 0-.5.5V16H3a1 1 0 0 1-1-1zm2 1.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5m3 0v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5m3.5-.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5zM4 5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5M7.5 5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5zm2.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5M4.5 8a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5z"/><path d="M11.886 9.46c.18-.613 1.048-.613 1.229 0l.043.148a.64.64 0 0 0 .921.382l.136-.074c.561-.306 1.175.308.87.869l-.075.136a.64.64 0 0 0 .382.92l.149.045c.612.18.612 1.048 0 1.229l-.15.043a.64.64 0 0 0-.38.921l.074.136c.305.561-.309 1.175-.87.87l-.136-.075a.64.64 0 0 0-.92.382l-.045.149c-.18.612-1.048.612-1.229 0l-.043-.15a.64.64 0 0 0-.921-.38l-.136.074c-.561.305-1.175-.309-.87-.87l.075-.136a.64.64 0 0 0-.382-.92l-.148-.045c-.613-.18-.613-1.048 0-1.229l.148-.043a.64.64 0 0 0 .382-.921l-.074-.136c-.306-.561.308-1.175.869-.87l.136.075a.64.64 0 0 0 .92-.382zM14 12.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0"/>',
    "0 0 16 16",
    'width="24" height="24" fill="currentColor"',
  );
  const tiExport = svgIcon(
    '<path d="M22.711 9.796c-.041-.041-4.055-4.096-5.982-6.146-.42-.414-.999-.65-1.586-.65-1.182 0-2.143.896-2.143 2h-8c-.553 0-1 .448-1 1v14c0 .552.447 1 1 1h14c.553 0 1-.448 1-1v-6.045c1.434-1.461 2.688-2.729 2.711-2.751.387-.39.387-1.018 0-1.408zm-7.432 6.145l-.136.059-.144-.04v-3.96h-1c-1.771.034-3.336.68-4.753 1.958.43-2.215 1.6-4.958 4.753-4.958h1v-3.958l.144-.042.154.05c1.436 1.525 4.051 4.187 5.297 5.45-.253.257-4.342 4.422-5.315 5.441zm-9.279 3.059v-12h8v1c-4.66 0-6 4.871-6 8.5v.5c1.691-2.578 3.6-3.953 6-4v3c0 .551.512 1 1.143 1 .364 0 .676-.158.883-.391.539-.565 1.242-1.291 1.976-2.043v4.434h-12.002z"/>',
    "0 0 24 24",
    'width="18" height="18"',
  );
  const faEye = svgIcon(
    '<path d="M572.52 241.4C518.29 135.59 410.93 64 288 64S57.68 135.64 3.48 241.41a32.35 32.35 0 0 0 0 29.19C57.71 376.41 165.07 448 288 448s230.32-71.64 284.52-177.41a32.35 32.35 0 0 0 0-29.19zM288 400a144 144 0 1 1 144-144 143.93 143.93 0 0 1-144 144zm0-240a95.31 95.31 0 0 0-25.31 3.79 47.85 47.85 0 0 1-66.9 66.9A95.78 95.78 0 1 0 288 160z"/>',
    "0 0 576 512",
    'width="16" height="16"',
  );

  const selectedRoom = state.dashboardRoomFilter || "semua";
  const f = state.reportFilter || {
    mode: "bulanan",
    startDate: awalBulan(),
    endDate: akhirBulan(),
  };
  const currentMode = f.mode || "bulanan";

  const filteredMeetings = getFilteredReportMeetings();
  const totalMeetings = filteredMeetings.length;

  let totalMinutes = 0;
  let totalParticipants = 0;
  const statusCounts = {
    berjalan: 0,
    selesai: 0,
    menunggu: 0,
    akandatang: 0,
  };
  const deptCounts = {};

  filteredMeetings.forEach((m) => {
    if (m.start && m.end) {
      const [sh, sm] = m.start.split(":").map(Number);
      const [eh, em] = m.end.split(":").map(Number);
      if (!isNaN(sh) && !isNaN(eh)) {
        const diff = eh * 60 + (em || 0) - (sh * 60 + (sm || 0));
        if (diff > 0) totalMinutes += diff;
      }
    }
    const p = parseInt(m.participants, 10);
    if (!isNaN(p) && p > 0) totalParticipants += p;

    const st = (m.status || "").toLowerCase();
    if (st.includes("berjalan")) statusCounts.berjalan++;
    else if (st.includes("selesai")) statusCounts.selesai++;
    else if (st.includes("menunggu") || st.includes("pending"))
      statusCounts.menunggu++;
    else statusCounts.akandatang++;

    const req = (m.requester || m.organizer || "Biro Keuangan / BMN").trim();
    if (req) {
      deptCounts[req] = (deptCounts[req] || 0) + 1;
    }
  });

  const totalHours = (totalMinutes / 60).toFixed(1);
  const avgHours =
    totalMeetings > 0 ? (totalMinutes / totalMeetings / 60).toFixed(1) : "0.0";

  // Perhitungan Okupansi Ruangan
  const activeRoomsCount =
    selectedRoom !== "semua" ? 1 : Math.max(state.rooms.length, 1);
  let businessHours = 40 * activeRoomsCount; // baseline mingguan (5 hari kerja x 8 jam)
  if (currentMode === "harian") businessHours = 8 * activeRoomsCount;
  else if (currentMode === "bulanan")
    businessHours = 176 * activeRoomsCount; // ~22 hari kerja x 8 jam
  else if (currentMode === "date" && f.startDate && f.endDate) {
    const d1 = new Date(f.startDate);
    const d2 = new Date(f.endDate);
    const days = Math.max(
      1,
      Math.round(Math.abs((d2 - d1) / (1000 * 60 * 60 * 24))) + 1,
    );
    businessHours = Math.max(8, days * 8) * activeRoomsCount;
  }
  const occupancyPct =
    businessHours > 0
      ? Math.min(100, Math.round((totalMinutes / 60 / businessHours) * 100))
      : 0;

  // Tren Aktivitas (Bar Chart)
  let trendBarsData = [];
  if (currentMode === "mingguan") {
    const daysOfWeek = [
      { key: "Sen", name: "Senin", dayIdx: 1 },
      { key: "Sel", name: "Selasa", dayIdx: 2 },
      { key: "Rab", name: "Rabu", dayIdx: 3 },
      { key: "Kam", name: "Kamis", dayIdx: 4 },
      { key: "Jum", name: "Jumat", dayIdx: 5 },
      { key: "Sab", name: "Sabtu", dayIdx: 6 },
      { key: "Min", name: "Minggu", dayIdx: 0 },
    ];
    const mStart = new Date(f.startDate || awalMinggu());
    trendBarsData = daysOfWeek.map((d, i) => {
      const curDate = new Date(mStart);
      curDate.setDate(curDate.getDate() + i);
      const dateStr =
        curDate.getFullYear() +
        "-" +
        String(curDate.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(curDate.getDate()).padStart(2, "0");
      const count = filteredMeetings.filter((m) => m.date === dateStr).length;
      return {
        label: d.key,
        sub:
          curDate.getDate() +
          " " +
          curDate.toLocaleDateString("id-ID", { month: "short" }),
        count: count,
      };
    });
  } else if (currentMode === "harian") {
    const timeSlots = [
      { label: "08–10", sub: "Pagi", startH: 8, endH: 10 },
      { label: "10–12", sub: "Siang", startH: 10, endH: 12 },
      { label: "13–15", sub: "Siang", startH: 13, endH: 15 },
      { label: "15–17", sub: "Sore", startH: 15, endH: 17 },
      { label: "17+", sub: "Malam", startH: 17, endH: 24 },
    ];
    trendBarsData = timeSlots.map((slot) => {
      const count = filteredMeetings.filter((m) => {
        if (!m.start) return false;
        const [h] = m.start.split(":").map(Number);
        return h >= slot.startH && h < slot.endH;
      }).length;
      return {
        label: slot.label,
        sub: slot.sub,
        count: count,
      };
    });
  } else {
    // Bulanan, date range, atau semua
    const weekRanges = [
      { label: "Mgg 1", sub: "1–7", minDay: 1, maxDay: 7 },
      { label: "Mgg 2", sub: "8–14", minDay: 8, maxDay: 14 },
      { label: "Mgg 3", sub: "15–21", minDay: 15, maxDay: 21 },
      { label: "Mgg 4", sub: "22–28", minDay: 22, maxDay: 28 },
      { label: "Mgg 5", sub: "29–31", minDay: 29, maxDay: 31 },
    ];
    trendBarsData = weekRanges.map((w) => {
      const count = filteredMeetings.filter((m) => {
        const parts = (m.date || "").split("-");
        const dayNum = parseInt(parts[2], 10);
        return !isNaN(dayNum) && dayNum >= w.minDay && dayNum <= w.maxDay;
      }).length;
      return {
        label: w.label,
        sub: w.sub,
        count: count,
      };
    });
  }

  const maxTrendCount = Math.max(...trendBarsData.map((t) => t.count), 2);
  const trendBarsHTML = trendBarsData
    .map((t) => {
      const heightPct =
        t.count > 0
          ? Math.min(
              100,
              Math.max(18, Math.round((t.count / maxTrendCount) * 85)),
            )
          : 8;
      const barColor = t.count > 0 ? "#1769aa" : "#e2e8f0";
      return `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end;">
        <span style="font-size:12px;font-weight:700;color:${t.count > 0 ? "#0c2d5e" : "#94a3b8"};margin-bottom:6px;">${t.count}</span>
        <div style="width:100%;max-width:38px;background:#f8fafc;border-radius:6px 6px 0 0;height:110px;display:flex;align-items:flex-end;overflow:hidden;border:1px solid #eef2f6;" title="${t.label} (${t.sub}): ${t.count} Rapat">
          <div style="width:100%;height:${heightPct}%;background:${barColor};border-radius:5px 5px 0 0;transition:height 0.3s ease;"></div>
        </div>
        <span style="font-size:11.5px;font-weight:700;color:#0c2d5e;margin-top:8px;">${t.label}</span>
        <span style="font-size:10px;color:#64748b;font-weight:500;">${t.sub}</span>
      </div>
    `;
    })
    .join("");

  // Pemanfaatan per Ruangan
  const roomUsageHTML = state.rooms
    .map((room) => {
      const rMeetings = filteredMeetings.filter((m) => m.room === room.name);
      const count = rMeetings.length;
      let rMin = 0;
      rMeetings.forEach((m) => {
        if (m.start && m.end) {
          const [sh, sm] = m.start.split(":").map(Number);
          const [eh, em] = m.end.split(":").map(Number);
          if (!isNaN(sh) && !isNaN(eh)) {
            const diff = eh * 60 + (em || 0) - (sh * 60 + (sm || 0));
            if (diff > 0) rMin += diff;
          }
        }
      });
      const rHours = (rMin / 60).toFixed(1);
      const rPct =
        totalMinutes > 0 ? Math.round((rMin / totalMinutes) * 100) : 0;
      return `
      <div style="margin-bottom: 12px; background:#f8fafc; border:1px solid #eef3f9; border-radius:10px; padding:10px 14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
          <div>
            <strong style="font-size: 13px; color: #0c2d5e; display:block;">${esc(room.name)}</strong>
            <small style="font-size: 11px; color: #64748b;">${esc(room.location || "Lt. 3")} · Kapasitas ${room.capacity || 20} org</small>
          </div>
          <div style="text-align:right;">
            <span style="font-size: 13px; font-weight: 700; color: #1769aa;">${count} Rapat</span>
            <div style="font-size: 11px; color: #64748b; font-weight: 500;">${rHours} Jam (${rPct}%)</div>
          </div>
        </div>
        <div style="height: 8px; background: #e2eaf5; border-radius: 6px; overflow: hidden; display: flex;">
          <div style="width: ${rPct}%; background: linear-gradient(90deg, #1769aa, #38bdf8); border-radius: 6px; transition: width 0.3s ease;"></div>
        </div>
      </div>
    `;
    })
    .join("");

  // Status & Pemohon Teraktif
  const sortedDepts = Object.entries(deptCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const deptHTML =
    sortedDepts.length > 0
      ? sortedDepts
          .map(
            ([dept, count]) => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding: 7px 0; border-bottom: 1px dashed #eef2f6;">
      <span style="font-size: 12px; color: #334155; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px;" title="${esc(dept)}">${esc(dept)}</span>
      <span style="background: #e0f2fe; color: #0369a1; font-weight: 700; font-size: 11px; padding: 2px 8px; border-radius: 10px;">${count} Rapat</span>
    </div>
  `,
          )
          .join("")
      : `<div style="font-size:12px; color:#94a3b8; text-align:center; padding:12px 0;">Belum ada data pemohon</div>`;

  const statusSummaryHTML = `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
      <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:8px 10px;">
        <span style="font-size:10.5px; color:#15803d; font-weight:600; display:block;">Selesai</span>
        <strong style="font-size:16px; color:#15803d;">${statusCounts.selesai}</strong>
      </div>
      <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:8px 10px;">
        <span style="font-size:10.5px; color:#1d4ed8; font-weight:600; display:block;">Berjalan</span>
        <strong style="font-size:16px; color:#1d4ed8;">${statusCounts.berjalan}</strong>
      </div>
      <div style="background:#fefce8; border:1px solid #fef08a; border-radius:8px; padding:8px 10px;">
        <span style="font-size:10.5px; color:#854d0e; font-weight:600; display:block;">Akan Datang</span>
        <strong style="font-size:16px; color:#854d0e;">${statusCounts.akandatang}</strong>
      </div>
      <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:8px; padding:8px 10px;">
        <span style="font-size:10.5px; color:#c2410c; font-weight:600; display:block;">Menunggu Approval</span>
        <strong style="font-size:16px; color:#c2410c;">${statusCounts.menunggu}</strong>
      </div>
    </div>
  `;

  // Meeting Table HTML
  let customTableHTML = "";
  if (filteredMeetings.length === 0) {
    customTableHTML = `
      <div class="rep-list" style="margin: 0 40px 40px; text-align:center; padding: 48px 20px;">
        <div style="font-size: 38px; margin-bottom: 10px;">📋</div>
        <h3 style="font-size: 16px; font-weight: 700; color: #0c2d5e; margin: 0 0 6px;">Tidak ada riwayat rapat pada periode ini</h3>
        <p style="font-size: 13px; color: #64748b; margin: 0 0 16px;">Silakan pilih filter Mingguan, Bulanan, atau Semua Jadwal untuk melihat rekapitulasi penggunaan ruang rapat.</p>
        <button class="btn btn-primary" onclick="setReportPeriod('bulanan')" style="font-size: 12.5px; padding: 8px 18px; border-radius: 8px; background: #0c2d5e; cursor:pointer;">Tampilkan Bulan Ini</button>
      </div>
    `;
  } else {
    customTableHTML = `
      <div class="rep-list" style="margin: 0 40px 40px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 18px; flex-wrap: wrap; gap: 10px;">
          <div>
            <h2 style="font-size: 16px; font-weight: 700; color: #0c2d5e; margin: 0 0 3px;">Rekapitulasi Penggunaan Ruangan</h2>
            <p style="font-size: 12px; color: #64748b; margin: 0;">Daftar seluruh agenda rapat tercatat pada periode <strong>${getActivePeriodLabel()}</strong></p>
          </div>
          <span style="font-size: 12px; font-weight: 700; color: #1769aa; background: #e0f2fe; padding: 5px 12px; border-radius: 20px;">
            Total: ${filteredMeetings.length} Rapat
          </span>
        </div>
        <div style="overflow-x: auto;">
          <table>
            <thead>
              <tr>
                <th style="width: 40px;">No</th>
                <th>Nama / Agenda Rapat</th>
                <th>Pemesan / Bagian</th>
                <th>Ruangan</th>
                <th>Tanggal</th>
                <th>Waktu</th>
                <th>Durasi</th>
                <th>Peserta</th>
                <th>Status</th>
                <th style="text-align: center; width: 60px;">Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${filteredMeetings
                .map((m, i) => {
                  let statusBadge = "";
                  const s = (m.status || "").toLowerCase();
                  if (s.includes("berjalan")) {
                    statusBadge = `<span style="background:#e0f5ec;color:#13865b;padding:5px 10px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap;">● Berjalan</span>`;
                  } else if (s.includes("selesai")) {
                    statusBadge = `<span style="background:#f3f0ff;color:#5b3dd3;padding:5px 10px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap;">✓ Selesai</span>`;
                  } else if (s.includes("menunggu") || s.includes("pending")) {
                    statusBadge = `<span style="background:#fff7ed;color:#ea580c;padding:5px 10px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap;">⏳ Menunggu Approval</span>`;
                  } else {
                    statusBadge = `<span style="background:#e0f2fe;color:#0284c7;padding:5px 10px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap;">📅 ${esc(m.status || "Akan Datang")}</span>`;
                  }

                  let durasiStr = "-";
                  if (m.start && m.end) {
                    const [sh, sm] = m.start.split(":").map(Number);
                    const [eh, em] = m.end.split(":").map(Number);
                    if (!isNaN(sh) && !isNaN(eh)) {
                      const diff = eh * 60 + (em || 0) - (sh * 60 + (sm || 0));
                      if (diff > 0) {
                        const h = Math.floor(diff / 60);
                        const min = diff % 60;
                        durasiStr =
                          h > 0
                            ? min > 0
                              ? `${h}j ${min}m`
                              : `${h} Jam`
                            : `${min} Menit`;
                      }
                    }
                  }

                  const actionBtn = `<button style="background-color:#f0f4fa;color:#0c2d5e;border:1px solid #dbeafe;border-radius:8px;width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:background 0.15s;" title="Lihat Detail Rapat" onclick="viewMeeting('${m.id}')" onmouseover="this.style.background='#e0f2fe'" onmouseout="this.style.background='#f0f4fa'">${faEye}</button>`;

                  return `
                  <tr>
                    <td>${i + 1}</td>
                    <td>
                      <strong style="color:#0c2d5e; display:block;">${esc(m.title)}</strong>
                      ${m.desc ? `<small style="color:#64748b; font-size:11px; font-weight:400;">${esc(m.desc.slice(0, 45))}${m.desc.length > 45 ? "..." : ""}</small>` : ""}
                    </td>
                    <td>${esc(m.requester || m.organizer || "-")}</td>
                    <td><span style="font-weight:600; color:#1769aa;">${esc(m.room)}</span></td>
                    <td>${formatDate(m.date)}</td>
                    <td style="font-weight:600;">${m.start} – ${m.end}</td>
                    <td>${durasiStr}</td>
                    <td>${m.participants ? `${m.participants} org` : "-"}</td>
                    <td>${statusBadge}</td>
                    <td style="text-align: center;">${actionBtn}</td>
                  </tr>
                `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  return `
    <div class="rep-page-wrapper">
      <div class="rep-header">
        <div>
          <div class="rep-breadcrumb">Dashboard › Laporan Penggunaan</div>
          <h1>Laporan Penggunaan Ruang Rapat</h1>
          <p>Ringkasan statistik pemanfaatan dan rekapitulasi penggunaan ruang rapat mingguan dan bulanan.</p>
        </div>
        <div class="dash-actions">
          ${getProfileHTML()}
        </div>
      </div>

      <!-- Quick Filter Row -->
      <div class="rep-filters-row">
        <div class="rep-filters-left" style="flex-wrap: wrap;">
          <div style="display:flex; background:#eef3f9; padding:3px; border-radius:10px; gap:4px;">
            <button type="button" class="${currentMode === "mingguan" ? "btn-blue" : "btn-white"}" onclick="setReportPeriod('mingguan')" style="border:none; padding:7px 14px; border-radius:7px; font-size:12.5px;">
              📆 Mingguan
            </button>
            <button type="button" class="${currentMode === "bulanan" ? "btn-blue" : "btn-white"}" onclick="setReportPeriod('bulanan')" style="border:none; padding:7px 14px; border-radius:7px; font-size:12.5px;">
              🗓️ Bulanan
            </button>
            <button type="button" class="${currentMode === "harian" ? "btn-blue" : "btn-white"}" onclick="setReportPeriod('harian')" style="border:none; padding:7px 14px; border-radius:7px; font-size:12.5px;">
              📅 Hari Ini
            </button>
            <button type="button" class="${currentMode === "semua" ? "btn-blue" : "btn-white"}" onclick="setReportPeriod('semua')" style="border:none; padding:7px 14px; border-radius:7px; font-size:12.5px;">
              🌐 Semua
            </button>
          </div>

          <button class="btn-white" type="button" onclick="openFilterModal()" style="display:flex; align-items:center; gap:6px;">
            <span>⚙️</span> Filter Kustom
          </button>

          <select id="trafficRoom" onchange="onReportRoomChange(this.value)" style="min-width: 170px;">
            <option value="semua" ${selectedRoom === "semua" ? "selected" : ""}>Semua Ruangan</option>
            ${state.rooms.map((r) => `<option value="${esc(r.name)}" ${selectedRoom === r.name ? "selected" : ""}>${esc(r.name)}</option>`).join("")}
          </select>
        </div>

        <div class="rep-export-wrapper" style="position: relative; display: inline-block;">
          <button class="rep-export-btn" id="exportBtn" type="button" onclick="toggleExportMenu(event)">
            ${tiExport}
            <span>Export Laporan</span>
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style="margin-left: 4px;">
              <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div id="exportMenuDropdown" class="rep-export-menu" style="display: none; position: absolute; top: calc(100% + 6px); right: 0; background: #ffffff; border-radius: 8px; box-shadow: 0 10px 25px rgba(12, 45, 94, 0.12); border: 1px solid #e2e8f0; min-width: 170px; z-index: 1000; overflow: hidden;">
            <button type="button" onclick="exportExcel(); closeExportMenu();" style="width: 100%; display: flex; align-items: center; gap: 8px; padding: 11px 16px; border: none; background: transparent; font-size: 13px; font-weight: 600; color: #0c2d5e; cursor: pointer; text-align: left; transition: background 0.15s;" onmouseover="this.style.background='#f0f4fa'" onmouseout="this.style.background='transparent'">
              <span style="font-size:16px;">📊</span> Export Excel (.xlsx)
            </button>
            <button type="button" onclick="exportPDF(); closeExportMenu();" style="width: 100%; display: flex; align-items: center; gap: 8px; padding: 11px 16px; border: none; background: transparent; font-size: 13px; font-weight: 600; color: #0c2d5e; cursor: pointer; text-align: left; border-top: 1px solid #f1f5f9; transition: background 0.15s;" onmouseover="this.style.background='#f0f4fa'" onmouseout="this.style.background='transparent'">
              <span style="font-size:16px;">📄</span> Export PDF (.pdf)
            </button>
          </div>
        </div>
      </div>

      <!-- Stat Cards -->
      <div class="rep-cards">
        <div class="rep-card">
          <div class="rc-icon blue1" style="background:#e0f2fe; color:#0284c7;">${liaUsersSolid}</div>
          <div class="rc-text">
            <strong>${totalMeetings} Rapat</strong>
            <span>Total Rapat Dilaksanakan</span>
          </div>
        </div>
        <div class="rep-card">
          <div class="rc-icon blue1" style="background:#fef3c7; color:#b45309;">${faClock}</div>
          <div class="rc-text">
            <strong>${totalHours} Jam</strong>
            <span>Total Durasi Pemakaian</span>
          </div>
        </div>
        <div class="rep-card">
          <div class="rc-icon blue1" style="background:#dcfce7; color:#15803d;">${bsBuilding}</div>
          <div class="rc-text">
            <strong>${occupancyPct}% Okupansi</strong>
            <span>Tingkat Pemanfaatan Ruang</span>
          </div>
        </div>
        <div class="rep-card">
          <div class="rc-icon blue1" style="background:#f3e8ff; color:#7e22ce;">${faUsers}</div>
          <div class="rc-text">
            <strong>${avgHours} Jam/Rapat</strong>
            <span>Rata-rata Durasi Rapat</span>
          </div>
        </div>
      </div>

      <!-- Charts Grid -->
      <div class="rep-charts">
        <div class="rep-chart-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
            <div>
              <h2 style="margin:0 0 2px;">Tren Penggunaan Ruang Rapat</h2>
              <small style="color:#64748b; font-weight:500;">Distribusi rapat: <strong>${getActivePeriodLabel()}</strong></small>
            </div>
            <span style="font-size:11px; font-weight:700; color:#1769aa; background:#e0f2fe; padding:3px 8px; border-radius:6px;">
              ${currentMode === "mingguan" ? "Harian (Minggu Ini)" : currentMode === "bulanan" ? "Mingguan (Bulan Ini)" : "Tren Periode"}
            </span>
          </div>
          <div class="mock-bar-chart" style="align-items:flex-end;">
            ${trendBarsHTML}
          </div>
        </div>

        <div class="rep-chart-card">
          <div style="margin-bottom:16px;">
            <h2 style="margin:0 0 2px;">Pemanfaatan per Ruangan</h2>
            <small style="color:#64748b; font-weight:500;">Proporsi penggunaan setiap ruang rapat</small>
          </div>
          <div style="display:flex; flex-direction:column;">
            ${roomUsageHTML}
          </div>
        </div>

        <div class="rep-chart-card">
          <div style="margin-bottom:14px;">
            <h2 style="margin:0 0 2px;">Status & Unit Pemohon</h2>
            <small style="color:#64748b; font-weight:500;">Rekap status & unit kerja teraktif</small>
          </div>
          ${statusSummaryHTML}
          <strong style="font-size:12px; color:#0c2d5e; display:block; margin: 12px 0 6px;">Top Unit Pemesan:</strong>
          <div style="display:flex; flex-direction:column;">
            ${deptHTML}
          </div>
        </div>
      </div>

      ${customTableHTML}
    </div>
  `;
}

function getActivePeriodLabel() {
  const f = state.reportFilter;
  if (!f) return "Semua Jadwal";
  if (f.mode === "harian") {
    return `Hari Ini (${formatDate(getTodayIsoDate())})`;
  }
  if (f.mode === "mingguan") {
    const start = f.startDate || awalMinggu();
    const end = f.endDate || akhirMinggu();
    return `Minggu Ini (${formatDate(start)} – ${formatDate(end)})`;
  }
  if (f.mode === "bulanan") {
    const d = new Date();
    const monthName = d.toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric",
    });
    return `Bulan Ini (${monthName})`;
  }
  if (f.mode === "date" && f.startDate && f.endDate) {
    return `${formatDate(f.startDate)} – ${formatDate(f.endDate)}`;
  }
  if (f.mode === "semua") {
    return "Semua Jadwal";
  }
  return "Periode Rapat";
}
window.getActivePeriodLabel = getActivePeriodLabel;

function openFilterModal() {
  const f = state.reportFilter || {
    mode: "bulanan",
    startDate: awalBulan(),
    endDate: akhirBulan(),
  };
  const body = `
    <div style="display:flex; flex-direction:column; gap:12px; padding-top: 6px; font-family:'Poppins',sans-serif;">
      <h3 style="font-size: 13.5px; font-weight:700; color: #0c2d5e; margin: 0 0 4px;">Pilih Periode Rapat & Laporan</h3>

      <label style="display:flex; align-items:center; justify-content:space-between; cursor:pointer; padding: 10px 12px; border-radius:8px; border: 1px solid #e2e8f0; background: #fff;">
        <span style="font-size:13px; font-weight:600; color:#1e293b;">📅 Hari Ini saja (${formatDate(getTodayIsoDate())})</span>
        <input type="radio" name="modalFilterMode" value="harian" onchange="toggleModalFilter()" ${f.mode === "harian" ? "checked" : ""}>
      </label>

      <label style="display:flex; align-items:center; justify-content:space-between; cursor:pointer; padding: 10px 12px; border-radius:8px; border: 1px solid #e2e8f0; background: #fff;">
        <span style="font-size:13px; font-weight:600; color:#1e293b;">📆 Laporan Mingguan (Minggu Ini: ${formatDate(awalMinggu())} – ${formatDate(akhirMinggu())})</span>
        <input type="radio" name="modalFilterMode" value="mingguan" onchange="toggleModalFilter()" ${f.mode === "mingguan" ? "checked" : ""}>
      </label>

      <label style="display:flex; align-items:center; justify-content:space-between; cursor:pointer; padding: 10px 12px; border-radius:8px; border: 1px solid #e2e8f0; background: #fff;">
        <span style="font-size:13px; font-weight:600; color:#1e293b;">🗓️ Laporan Bulanan (Bulan Ini)</span>
        <input type="radio" name="modalFilterMode" value="bulanan" onchange="toggleModalFilter()" ${f.mode === "bulanan" ? "checked" : ""}>
      </label>

      <label style="display:flex; align-items:center; justify-content:space-between; cursor:pointer; padding: 10px 12px; border-radius:8px; border: 1px solid #e2e8f0; background: #fff;">
        <span style="font-size:13px; font-weight:600; color:#1e293b;">🌐 Semua Jadwal Rapat</span>
        <input type="radio" name="modalFilterMode" value="semua" onchange="toggleModalFilter()" ${f.mode === "semua" ? "checked" : ""}>
      </label>

      <label style="display:flex; align-items:center; justify-content:space-between; cursor:pointer; padding: 10px 12px; border-radius:8px; border: 1px solid #e2e8f0; background: #fff;">
        <span style="font-size:13px; font-weight:600; color:#1e293b;">⚙️ Rentang Tanggal Khusus</span>
        <input type="radio" name="modalFilterMode" value="date" onchange="toggleModalFilter()" ${f.mode === "date" ? "checked" : ""}>
      </label>

      <div id="modalDateInputs" style="display:flex; gap:10px; margin-top: 4px; opacity: ${f.mode === "date" ? "1" : "0.5"}; pointer-events: ${f.mode === "date" ? "auto" : "none"};">
        <div style="flex:1; background: #f8fafc; padding: 10px 12px; border:1px solid #e2e8f0; border-radius: 8px;">
          <label style="display:block; font-size:11px; font-weight:600; color:#64748b; margin-bottom:4px;">Dari Tanggal</label>
          <input type="date" id="mStartDate" value="${f.startDate || awalBulan()}" style="width:100%; border:none; background:transparent; outline:none; font-weight:600; font-size:12.5px; color:#0c2d5e;" ${f.mode !== "date" ? "disabled" : ""}>
        </div>
        <div style="flex:1; background: #f8fafc; padding: 10px 12px; border:1px solid #e2e8f0; border-radius: 8px;">
          <label style="display:block; font-size:11px; font-weight:600; color:#64748b; margin-bottom:4px;">Sampai Tanggal</label>
          <input type="date" id="mEndDate" value="${f.endDate || akhirBulan()}" style="width:100%; border:none; background:transparent; outline:none; font-weight:600; font-size:12.5px; color:#0c2d5e;" ${f.mode !== "date" ? "disabled" : ""}>
        </div>
      </div>

      <div style="margin-top: 14px; display:flex; gap:10px;">
        <button type="button" class="btn btn-light" style="flex:1; padding: 11px; font-size: 13px; border-radius: 8px; font-weight:600;" onclick="closeModal()">Batal</button>
        <button type="button" class="btn btn-primary" style="flex:2; padding: 11px; font-size: 13px; border-radius: 8px; font-weight:700; background:#0c2d5e;" onclick="applyFilter()">Terapkan Filter</button>
      </div>
    </div>
  `;
  openModal("Periode Rapat & Laporan", body);
}

function toggleModalFilter() {
  const checked = document.querySelector(
    'input[name="modalFilterMode"]:checked',
  );
  if (!checked) return;
  const mode = checked.value;
  const container = document.getElementById("modalDateInputs");
  const sd = document.getElementById("mStartDate");
  const ed = document.getElementById("mEndDate");

  if (mode === "date") {
    if (container) {
      container.style.opacity = "1";
      container.style.pointerEvents = "auto";
    }
    if (sd) sd.disabled = false;
    if (ed) ed.disabled = false;
  } else {
    if (container) {
      container.style.opacity = "0.5";
      container.style.pointerEvents = "none";
    }
    if (sd) sd.disabled = true;
    if (ed) ed.disabled = true;
  }
}

function applyFilter() {
  const checked = document.querySelector(
    'input[name="modalFilterMode"]:checked',
  );
  const mode = checked ? checked.value : "bulanan";
  let sd = "";
  let ed = "";
  if (mode === "harian") {
    sd = getTodayIsoDate();
    ed = getTodayIsoDate();
  } else if (mode === "mingguan") {
    sd = awalMinggu();
    ed = akhirMinggu();
  } else if (mode === "bulanan") {
    sd = awalBulan();
    ed = akhirBulan();
  } else if (mode === "date") {
    sd = document.getElementById("mStartDate")?.value || awalBulan();
    ed = document.getElementById("mEndDate")?.value || akhirBulan();
  }
  state.reportFilter = {
    mode: mode,
    startDate: sd,
    endDate: ed,
  };
  closeModal();
  render();
  toast(`✓ Periode diterapkan: ${getActivePeriodLabel()}`);
}

function applyDashboardFilter() {
  const r = document.getElementById("trafficRoom");
  if (r) {
    state.dashboardRoomFilter = r.value;
  }
  render();
  toast("✓ Filter jadwal diterapkan.");
}
window.applyDashboardFilter = applyDashboardFilter;

function resetDashboardFilter() {
  state.dashboardRoomFilter = "semua";
  state.reportFilter = {
    mode: "bulanan",
    startDate: awalBulan(),
    endDate: akhirBulan(),
  };
  render();
  toast("✓ Filter jadwal telah direset ke default.");
}
window.resetDashboardFilter = resetDashboardFilter;

function generateTrafficReport() {
  applyDashboardFilter();
}

function toggleExportMenu(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const menu = document.getElementById("exportMenuDropdown");
  if (menu) {
    const isHidden = menu.style.display === "none";
    menu.style.display = isHidden ? "block" : "none";
  }
}

function closeExportMenu() {
  const menu = document.getElementById("exportMenuDropdown");
  if (menu) menu.style.display = "none";
}

document.addEventListener("click", (e) => {
  const wrapper = document.querySelector(".rep-export-wrapper");
  if (wrapper && !wrapper.contains(e.target)) {
    closeExportMenu();
  }
});

function handleExportDropdown(el) {
  if (el.value === "pdf") {
    exportPDF();
  } else if (el.value === "excel") {
    exportExcel();
  }
  el.value = ""; // Reset opsi kembali ke "Export Pilihan"
}

function formatDate(s) {
  if (!s) return "";
  try {
    const str = String(s).trim();
    const d = str.includes("T") ? new Date(str) : new Date(str + "T00:00:00");
    if (isNaN(d.getTime())) return str;
    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch (e) {
    return String(s);
  }
}

function settings() {
  const faUsers = svgIcon(
    '<path d="M96 224c35.3 0 64-28.7 64-64s-28.7-64-64-64-64 28.7-64 64 28.7 64 64 64zm448 0c35.3 0 64-28.7 64-64s-28.7-64-64-64-64 28.7-64 64 28.7 64 64 64zm32 32h-64c-17.6 0-33.5 7.1-45.1 18.6 40.3 22.1 68.9 62 75.1 109.4h66c17.7 0 32-14.3 32-32v-32c0-35.3-28.7-64-64-64zm-256 0c61.9 0 112-50.1 112-112S381.9 32 320 32 208 82.1 208 144s50.1 112 112 112zm76.8 32h-8.3c-20.8 10-43.9 16-68.5 16s-47.6-6-68.5-16h-8.3C179.6 288 128 339.6 128 403.2V432c0 26.5 21.5 48 48 48h288c26.5 0 48-21.5 48-48v-28.8c0-63.6-51.6-115.2-115.2-115.2zm-223.7-13.4C161.5 263.1 145.6 256 128 256H64c-35.3 0-64 28.7-64 64v32c0 17.7 14.3 32 32 32h65.9c6.3-47.4 34.9-87.3 75.2-109.4z"/>',
    "0 0 640 512",
    'width="24" height="24" fill="#047857"',
  );

  const faUserCog = svgIcon(
    '<path d="M610.5 373.3c2.6-14.1 2.6-28.5 0-42.6l25.8-14.9c3-1.7 4.3-5.2 3.3-8.5-6.7-21.6-18.2-41.2-33.2-57.4-2.3-2.5-6-3.1-9-1.4l-25.8 14.9c-10.9-9.3-23.4-16.5-36.9-21.3v-29.8c0-3.4-2.4-6.4-5.7-7.1-22.3-5-45-4.8-66.2 0-3.3.7-5.7 3.7-5.7 7.1v29.8c-13.5 4.8-26 12-36.9 21.3l-25.8-14.9c-2.9-1.7-6.7-1.1-9 1.4-15 16.2-26.5 35.8-33.2 57.4-1 3.3.4 6.8 3.3 8.5l25.8 14.9c-2.6 14.1-2.6 28.5 0 42.6l-25.8 14.9c-3 1.7-4.3 5.2-3.3 8.5 6.7 21.6 18.2 41.1 33.2 57.4 2.3 2.5 6 3.1 9 1.4l25.8-14.9c10.9 9.3 23.4 16.5 36.9 21.3v29.8c0 3.4 2.4 6.4 5.7 7.1 22.3 5 45 4.8 66.2 0 3.3-.7 5.7-3.7 5.7-7.1v-29.8c13.5-4.8 26-12 36.9-21.3l25.8 14.9c2.9 1.7 6.7 1.1 9-1.4 15-16.2 26.5-35.8 33.2-57.4 1-3.3-.4-6.8-3.3-8.5l-25.8-14.9zM496 400.5c-26.8 0-48.5-21.8-48.5-48.5s21.8-48.5 48.5-48.5 48.5 21.8 48.5 48.5-21.7 48.5-48.5 48.5zM224 256c70.7 0 128-57.3 128-128S294.7 0 224 0 96 57.3 96 128s57.3 128 128 128zm201.2 226.5c-2.3-1.2-4.6-2.6-6.8-3.9l-7.9 4.6c-6 3.4-12.8 5.3-19.6 5.3-10.9 0-21.4-4.6-28.9-12.6-18.3-19.8-32.3-43.9-40.2-69.6-5.5-17.7 1.9-36.4 17.9-45.7l7.9-4.6c-.1-2.6-.1-5.2 0-7.8l-7.9-4.6c-16-9.2-23.4-28-17.9-45.7.9-2.9 2.2-5.8 3.2-8.7-3.8-.3-7.5-1.2-11.4-1.2h-16.7c-22.2 10.2-46.9 16-72.9 16s-50.6-5.8-72.9-16h-16.7C60.2 288 0 348.2 0 422.4V464c0 26.5 21.5 48 48 48h352c10.1 0 19.5-3.2 27.2-8.5-1.2-3.8-2-7.7-2-11.8v-9.2z"/>',
    "0 0 640 512",
    'width="24" height="24" fill="#1769aa"',
  );

  const faCheck = svgIcon(
    '<path d="M173.898 439.404l-166.4-166.4c-9.997-9.997-9.997-26.206 0-36.204l36.203-36.204c9.997-9.998 26.207-9.998 36.204 0L192 312.69 432.095 72.596c9.997-9.997 26.207-9.997 36.204 0l36.203 36.204c9.997 9.997 9.997 26.206 0 36.204l-294.4 294.401c-9.998 9.997-26.207 9.997-36.204-.001z"/>',
    "0 0 512 512",
    'width="20" height="20" fill="#d97706"',
  );

  const fiAlertTriangle = `
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  `;

  const adminAktif = (state.users || []).filter((u) => isAdminRole(u)).length;
  const pimpinanAktif = (state.users || []).filter((u) =>
    isAtasanRole(u),
  ).length;
  const userAktif = (state.users || []).filter(
    (u) => !isAdminRole(u) && !isAtasanRole(u),
  ).length;
  const totalRoles = 3;
  const totalUsers = (state.users || []).length;
  const aksesBermasalah = 0;

  const rolesData = [
    {
      no: 1,
      name: "Admin",
      access:
        "Operasional Rapat, Kelola Fasilitas Ruangan, Quick Check-In/Out, Manajemen Pengguna",
      usersCount: adminAktif,
    },
    {
      no: 2,
      name: "Pimpinan",
      access:
        "Otorisasi Persetujuan/Penolakan Booking Rapat, Pembatalan Darurat",
      usersCount: pimpinanAktif,
    },
    {
      no: 3,
      name: "User",
      access:
        "Pengajuan Booking Ruang Rapat, Presensi Daftar Hadir Digital, Review Kepuasan",
      usersCount: userAktif,
    },
  ];

  return `
    <div class="settings-wrapper">
      <div class="settings-header">
        <div class="settings-title">
          <div class="settings-breadcrumb">Dashboard &gt; Pengaturan</div>
          <h1>Pengaturan &amp; Hak Akses</h1>
          <p>Kelola daftar role dan akses fitur aplikasi.</p>
        </div>
        <div class="settings-actions">
          ${getProfileHTML()}
        </div>
      </div>

      <!-- Stat Cards -->
      <div class="settings-stat-grid">
        <div class="s-card">
          <div class="s-icon-box blue">
            ${faUserCog}
          </div>
          <div class="s-info">
            <strong>${totalRoles}</strong>
            <span>Total Role</span>
          </div>
        </div>

        <div class="s-card">
          <div class="s-icon-box green">
            ${faUsers}
          </div>
          <div class="s-info">
            <strong>${totalUsers}</strong>
            <span>Total Pengguna</span>
          </div>
        </div>

        <div class="s-card">
          <div class="s-icon-box yellow">
            ${faCheck}
          </div>
          <div class="s-info">
            <strong>${adminAktif}</strong>
            <span>Admin Aktif</span>
          </div>
        </div>

        <div class="s-card">
          <div class="s-icon-box purple">
            ${fiAlertTriangle}
          </div>
          <div class="s-info">
            <strong>${aksesBermasalah}</strong>
            <span>Akses Bermasalah</span>
          </div>
        </div>
      </div>

      <!-- Main Panel: Daftar Role Sistem -->
      <div class="settings-panel">
        <h2>Daftar Role Sistem</h2>
        <div class="settings-table-wrap">
          <table class="settings-table">
            <thead>
              <tr>
                <th class="td-no">No</th>
                <th class="td-role">Nama Role</th>
                <th class="td-access">Hak Akses Utama</th>
                <th class="td-count" style="text-align: center;">Jumlah Pengguna</th>
              </tr>
            </thead>
            <tbody>
              ${rolesData
                .map(
                  (r) => `
                <tr>
                  <td class="td-no">${r.no}</td>
                  <td class="td-role">${r.name}</td>
                  <td class="td-access">${r.access}</td>
                  <td class="td-count" style="text-align: center;">
                    <span class="role-pill">${r.usersCount} Pengguna</span>
                  </td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function render() {
  const pages = {
    dashboard,
    meetings,
    rooms,
    users,
    calendar,
    reports,
    settings,
  };

  const curUser = getCurrentUser();
  if (curUser && !isAdminRole(curUser) && !isAtasanRole(curUser)) {
    if (
      window.parent &&
      window.parent.location &&
      window.parent.location.pathname.startsWith("/dashboard")
    ) {
      window.parent.location.href = "/booking";
      return;
    }
  }

  if (!isPageAllowed(state.page, curUser)) {
    state.page = "dashboard";
    if (location.hash !== "#dashboard") location.hash = "#dashboard";
  }
  const page = pages[state.page] || dashboard;
  document.getElementById("app").innerHTML = layout(page());
}

window.addEventListener("hashchange", () => {
  let page = location.hash.replace("#", "") || "dashboard";

  const validPages = [
    "dashboard",
    "meetings",
    "rooms",
    "reports",
    "users",
    "calendar",
    "settings",
  ];

  state.page = validPages.includes(page) ? page : "dashboard";
  render();
});

function openModal(title, body) {
  document.getElementById("modal").innerHTML =
    `<div class="modal"><div class="modal-head"><h2>${title}</h2><button class="btn-icon" onclick="closeModal()">×</button></div>${body}</div>`;
  document.getElementById("modal").classList.add("show");
}

function closeModal() {
  document.getElementById("modal").classList.remove("show");
}

const ICON_FA_CHECK = `<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" style="width:16px;height:16px;display:block;" xmlns="http://www.w3.org/2000/svg"><path d="M173.898 439.404l-166.4-166.4c-9.997-9.997-9.997-26.206 0-36.204l36.203-36.204c9.997-9.998 26.207-9.998 36.204 0L192 312.69 432.095 72.596c9.997-9.997 26.207-9.997 36.204 0l36.203 36.204c9.997 9.997 9.997 26.206 0 36.204l-294.4 294.401c-9.998 9.997-26.207 9.997-36.205-.001z"></path></svg>`;
const ICON_FA_EXCLAMATION = `<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 192 512" style="width:11px;height:11px;display:block;" xmlns="http://www.w3.org/2000/svg"><path d="M176 432c0 44.112-35.888 80-80 80s-80-35.888-80-80 35.888-80 80-80 80 35.888 80 80zM25.26 25.199l13.6 272C39.499 309.972 50.041 320 62.83 320h66.34c12.789 0 23.331-10.028 23.97-22.801l13.6-272C167.425 11.49 156.496 0 142.77 0H49.23C35.504 0 24.575 11.49 25.26 25.199z"></path></svg>`;

function showConfirmModal({
  title = "Konfirmasi",
  icon = ICON_FA_CHECK,
  iconBg = "#dcfce7",
  iconColor = "#15803d",
  message = "",
  infoText = "",
  subtext = "",
  confirmText = "Lanjutkan",
  confirmBg = "#16a34a",
  onConfirm = null,
}) {
  const modalEl = document.getElementById("modal");
  if (!modalEl) return;

  modalEl.innerHTML = `
    <div class="modal" style="max-width:440px;width:92%;background:#ffffff;border-radius:18px;padding:26px 28px 22px;box-shadow:0 24px 60px rgba(12,45,94,0.2);box-sizing:border-box;font-family:'Poppins',sans-serif;margin:auto;border:1px solid #eef3f9;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:38px;height:38px;border-radius:12px;background:${iconBg};color:${iconColor};display:grid;place-items:center;font-size:17px;font-weight:700;flex-shrink:0;">
            ${icon}
          </div>
          <div>
            <h3 style="font-size:16px;font-weight:700;color:#0c2d5e;margin:0;line-height:1.2;">${esc(title)}</h3>
          </div>
        </div>
        <button type="button" onclick="closeModal()" style="border:none;background:#f1f5f9;color:#64748b;width:30px;height:30px;border-radius:8px;cursor:pointer;display:grid;place-items:center;font-size:15px;line-height:1;transition:all 0.15s;" onmouseover="this.style.background='#e2e8f0';this.style.color='#0c2d5e'" onmouseout="this.style.background='#f1f5f9';this.style.color='#64748b'" title="Tutup">✕</button>
      </div>

      <div style="font-size:13.5px;color:#1e293b;line-height:1.5;margin-bottom:12px;">
        ${message}
      </div>

      ${
        infoText
          ? `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:3.5px solid ${iconColor};border-radius:10px;padding:11px 13px;margin:14px 0;font-size:12px;color:#475569;line-height:1.55;">
          <div style="font-weight:700;color:#0c2d5e;margin-bottom:5px;display:flex;align-items:center;gap:7px;">
            <span style="display:inline-flex;align-items:center;justify-content:center;width:19px;height:19px;border-radius:50%;background:#e0f2fe;color:#0284c7;flex-shrink:0;">${ICON_FA_EXCLAMATION}</span>
            <span>Info Sistem</span>
          </div>
          ${infoText}
        </div>
      `
          : ""
      }

      ${
        subtext
          ? `
        <div style="font-size:12px;color:#64748b;line-height:1.45;margin-bottom:18px;">
          ${subtext}
        </div>
      `
          : ""
      }

      <div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:20px;padding-top:14px;border-top:1px solid #f1f5f9;">
        <button type="button" onclick="closeModal()" style="padding:9px 18px;border:1px solid #cbd5e1;background:#ffffff;color:#475569;border-radius:9px;font-size:12.5px;font-weight:600;cursor:pointer;transition:all 0.15s ease;" onmouseover="this.style.background='#f8fafc';this.style.borderColor='#94a3b8'" onmouseout="this.style.background='#ffffff';this.style.borderColor='#cbd5e1'">
          Batal
        </button>
        <button type="button" id="confirmModalSubmitBtn" style="padding:9px 20px;border:none;background:${confirmBg};color:#ffffff;border-radius:9px;font-size:12.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all 0.15s ease;box-shadow:0 3px 10px rgba(0,0,0,0.12);" onmouseover="this.style.opacity='0.9';this.style.transform='translateY(-1px)'" onmouseout="this.style.opacity='1';this.style.transform='translateY(0)'">
          ${confirmText}
        </button>
      </div>
    </div>
  `;

  modalEl.classList.add("show");

  const btn = document.getElementById("confirmModalSubmitBtn");
  if (btn) {
    btn.onclick = () => {
      closeModal();
      if (typeof onConfirm === "function") {
        onConfirm();
      }
    };
  }
}
window.showConfirmModal = showConfirmModal;

function onToggleKepalaBiro(checkbox) {
  if (checkbox && checkbox.checked) {
    const reqInput = document.getElementById("fRequester");
    if (
      reqInput &&
      (!reqInput.value ||
        reqInput.value.trim() === "" ||
        reqInput.value === "Unit Kerja")
    ) {
      reqInput.value = "Kepala Biro Keuangan dan BMN";
    }
    const statusSelect = document.getElementById("fStatus");
    if (statusSelect && statusSelect.value === "Menunggu Approval") {
      statusSelect.value = "Akan Datang";
    }
  }
}
window.onToggleKepalaBiro = onToggleKepalaBiro;

function openMeetingModal(id = null) {
  if (!can("manageMeeting"))
    return denyAccess("Tambah / edit rapat dilakukan oleh Admin.");
  const defaultHours = getDefaultMeetingHours();
  const m = id
    ? state.meetings.find((x) => String(x.id) === String(id))
    : {
        title: "",
        requester: "",
        room: state.rooms[0]?.name || "Ruang Rapat Besar",
        date: getTodayIsoDate(),
        start: defaultHours.start,
        end: defaultHours.end,
        participants: 10,
        status: "Menunggu Approval",
        desc: "",
        isKepalaBiro: false,
      };

  const isKepalaBiro =
    m.isKepalaBiro ||
    (m.requester && m.requester.toLowerCase().includes("kepala biro")) ||
    (m.title && m.title.toLowerCase().includes("kepala biro"));

  openModal(
    id ? "Edit Rapat" : "Tambah Rapat",
    `<div class="form-grid">
      <div class="field full" style="background:#eaf2fb;padding:12px 16px;border-radius:12px;border:1.5px solid #b8d4f4;margin-bottom:6px;">
        <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;margin:0;">
          <input type="checkbox" id="fIsKepalaBiro" style="width:18px;height:18px;margin-top:2px;cursor:pointer;accent-color:#0c2d5e;" ${isKepalaBiro ? "checked" : ""} onchange="onToggleKepalaBiro(this)">
          <div>
            <span style="font-weight:700;font-size:13.5px;color:#0c2d5e;">Rapat Kepala Biro Keuangan dan BMN (Prioritas Utama)</span>
            <span style="display:block;font-size:11.5px;color:#3d5a80;font-weight:400;margin-top:3px;line-height:1.4;">
              Jika diaktifkan, jadwal rapat lain pada ruangan dan waktu yang sama akan <b>otomatis dibatalkan</b> (meskipun sudah disetujui / approve), dan <b>notifikasi pembatalan</b> akan langsung dikirimkan kepada pemesan sebelumnya.
            </span>
          </div>
        </label>
      </div>
      <div class="field full"><label>Judul Rapat</label><input id="fTitle" value="${esc(m.title)}" placeholder="Contoh: Arahan Rencana Anggaran Biro Keuangan dan BMN"></div>
      <div class="field"><label>Pemesan</label><input id="fRequester" list="requesterList" value="${esc(m.requester)}" placeholder="Contoh: TU, PA, Bagian Keuangan, dsb">
        <datalist id="requesterList">
          <option value="TU">
          <option value="PA">
          <option value="Bagian Keuangan">
          <option value="Bagian BMN">
          <option value="Bagian Umum">
          <option value="Kepala Biro Keuangan dan BMN">
        </datalist>
      </div>
      <div class="field"><label>Ruangan</label><select id="fRoom">${state.rooms.map((r) => `<option ${r.name === m.room ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select></div>
      <div class="field"><label>Tanggal</label><input id="fDate" type="date" value="${m.date}"></div>
      <div class="field"><label>Peserta</label><input id="fParticipants" type="number" value="${m.participants}"></div>
      <div class="field"><label>Mulai</label><input id="fStart" type="time" value="${m.start}"></div><div class="field"><label>Selesai</label><input id="fEnd" type="time" value="${m.end}"></div>
      <div class="field full"><label>Status</label><select id="fStatus">${["Menunggu Approval", "Akan Datang", "Segera", "Berjalan", "Selesai", "Dibatalkan"].map((s) => `<option ${s === m.status ? "selected" : ""}>${s}</option>`).join("")}</select></div>
      <div class="field full"><label>Deskripsi</label><textarea id="fDesc" rows="3" placeholder="Deskripsi atau agenda pembahasan...">${esc(m.desc)}</textarea></div>
    </div>
    <div class="modal-actions"><button class="btn btn-light" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="saveMeeting('${id ? esc(m.id) : ""}')">Simpan</button></div>`,
  );
}
window.openMeetingModal = openMeetingModal;

async function saveMeeting(id) {
  const isCheckboxChecked =
    document.getElementById("fIsKepalaBiro") &&
    document.getElementById("fIsKepalaBiro").checked;
  const titleVal = f("fTitle").trim();
  const requesterVal = f("fRequester").trim();
  const roomVal = f("fRoom");
  const dateVal = f("fDate");
  const startVal = f("fStart");
  const endVal = f("fEnd");
  const participantsVal = Number(f("fParticipants")) || 10;
  let statusVal = f("fStatus");
  const descVal = f("fDesc");

  if (!titleVal) {
    alert("Judul rapat tidak boleh kosong");
    return;
  }
  if (!startVal || !endVal) {
    alert("Waktu mulai dan selesai harus diisi");
    return;
  }

  const reqLower = requesterVal.toLowerCase();
  const titleLower = titleVal.toLowerCase();
  const descLower = (descVal || "").toLowerCase();

  const isKepalaBiro =
    isCheckboxChecked ||
    reqLower.includes("kepala biro keuangan") ||
    reqLower.includes("ka. biro keuangan") ||
    reqLower.includes("kepala biro") ||
    reqLower.includes("biro keuangan dan bmn") ||
    titleLower.includes("kepala biro keuangan") ||
    titleLower.includes("ka. biro keuangan") ||
    descLower.includes("kepala biro keuangan");

  // Jika untuk Kepala Biro dan status default Menunggu Approval, otomatis menjadi Akan Datang
  if (isKepalaBiro && statusVal === "Menunggu Approval") {
    statusVal = "Akan Datang";
  }

  const obj = {
    id: id || Date.now(),
    title: titleVal,
    requester:
      requesterVal ||
      (isKepalaBiro ? "Kepala Biro Keuangan dan BMN" : "Unit Kerja"),
    room: roomVal,
    date: dateVal,
    start: startVal,
    end: endVal,
    participants: participantsVal,
    status: statusVal,
    desc: descVal,
    isKepalaBiro: isKepalaBiro,
    approvedBy: isKepalaBiro
      ? "Kepala Biro Keuangan dan BMN"
      : id
        ? state.meetings.find((x) => x.id === id)?.approvedBy || ""
        : "",
  };

  let cancelledMeetings = [];

  // Jika rapat ini adalah untuk Kepala Biro Keuangan dan BMN:
  // Batalkan otomatis rapat lain di ruangan dan tanggal yang sama jika waktunya bertabrakan (overlap)
  if (isKepalaBiro) {
    state.meetings = state.meetings.map((m) => {
      const isSameRoom = m.room === obj.room;
      const isSameDate = m.date === obj.date;
      const isDifferentMeeting = m.id !== obj.id;
      const isNotCancelled =
        m.status !== "Dibatalkan" && m.status !== "Selesai";
      // Cek bentrok jam (overlapping)
      const isTimeOverlap = obj.start < m.end && obj.end > m.start;

      if (
        isSameRoom &&
        isSameDate &&
        isDifferentMeeting &&
        isNotCancelled &&
        isTimeOverlap
      ) {
        cancelledMeetings.push({ ...m });
        return {
          ...m,
          status: "Dibatalkan",
          cancellationReason:
            "Ruangan dialihkan untuk rapat Kepala Biro Keuangan dan BMN",
          cancelledBy: "Kepala Biro Keuangan dan BMN",
          cancelledAt: new Date().toISOString(),
          desc:
            (m.desc || "") +
            "\n[Dibatalkan otomatis: Ruangan digunakan untuk rapat Kepala Biro Keuangan dan BMN]",
        };
      }
      return m;
    });
  }

  if (id) {
    state.meetings = state.meetings.map((x) => (x.id === id ? obj : x));
  } else {
    state.meetings.unshift(obj);
  }

  // Simpan data rapat ke LocalStorage agar tersinkronisasi
  try {
    getAppStorage().setItem("app_meetings", JSON.stringify(state.meetings));
  } catch (e) {}

  // Jika ada rapat yang dibatalkan karena bentrok dengan Kepala Biro:
  if (cancelledMeetings.length > 0) {
    const notifs = getNotifications();
    const nowIso = new Date().toISOString();

    cancelledMeetings.forEach((cm) => {
      // 1. Kirim notifikasi pembatalan spesifik untuk pemesan sebelumnya
      const cancelNotif = {
        id: Date.now() + Math.floor(Math.random() * 10000),
        meetingId: cm.id,
        type: "CANCELED_PRIORITY",
        title: "⚠️ Pembatalan Ruang Rapat (Prioritas Kepala Biro)",
        message: `Yth. ${cm.requester || "Pemesan"}, pemesanan ruangan ${cm.room} pada tanggal ${formatDate(cm.date)} (${cm.start} - ${cm.end}) untuk agenda "${cm.title}" otomatis DIBATALKAN karena ruangan akan digunakan untuk rapat Kepala Biro Keuangan dan BMN.`,
        room: cm.room,
        requester: cm.requester,
        date: cm.date,
        time: `${cm.start} - ${cm.end}`,
        agenda: cm.title,
        status: "Dibatalkan",
        cancellationReason:
          "Ruangan dialihkan untuk rapat Kepala Biro Keuangan dan BMN",
        createdAt: nowIso,
        readBy: [],
        isUrgent: true,
      };

      // 2. Perbarui notifikasi permintaan sebelumnya jika ada
      const existingNotif = notifs.find((n) => n.meetingId === cm.id);
      if (existingNotif) {
        existingNotif.status = "Dibatalkan";
        existingNotif.cancellationReason =
          "Ruangan dialihkan untuk rapat Kepala Biro Keuangan dan BMN";
        existingNotif.message = `[DIBATALKAN] Pemesanan ${cm.room} oleh ${cm.requester} otomatis dibatalkan karena ruangan akan digunakan untuk rapat Kepala Biro Keuangan dan BMN.`;
      }

      notifs.unshift(cancelNotif);
    });

    saveNotifications(notifs);
    playNotificationSound();

    // Trigger update notifikasi lintas frame/tab
    try {
      getAppStorage().setItem("app_notifications", JSON.stringify(notifs));
      if (window.parent && window.parent.dispatchEvent) {
        window.parent.dispatchEvent(new Event("app_notifications_updated"));
      }
    } catch (e) {}

    const cancelSummary = cancelledMeetings
      .map(
        (cm) =>
          `• "${cm.title}" (Pemesan: ${cm.requester}, Waktu: ${cm.start}-${cm.end})`,
      )
      .join("\n");

    setTimeout(() => {
      alert(
        `⚠️ PEMBERITAHUAN PRIORITAS KEPALA BIRO KEUANGAN DAN BMN:\n\n` +
          `Rapat berikut yang sebelumnya berada di jadwal yang sama otomatis DIBATALKAN (walaupun sudah disetujui):\n\n` +
          cancelSummary +
          `\n\n` +
          `Notifikasi pembatalan resmi telah dikirimkan ke pemesan ruangan terkait.`,
      );
    }, 150);
  }

  closeModal();
  render();
  toast(
    cancelledMeetings.length > 0
      ? "Rapat Kepala Biro berhasil ditambahkan. Rapat yang bertabrakan otomatis dibatalkan."
      : id
        ? "Rapat berhasil diedit"
        : "Rapat berhasil ditambahkan",
  );

  try {
    await fetch("/api/dashboard/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(obj),
    });
  } catch (err) {
    console.error("Gagal menyimpan ke backend:", err);
  }
}

function approveMeeting(id) {
  const user = getCurrentUser();
  if (!can("approve", user)) {
    alert(
      "Hak Akses Dibatasi:\nHanya akun Pimpinan yang dapat menyetujui permohonan rapat.",
    );
    return;
  }

  let targetMeeting = state.meetings.find((m) => String(m.id) === String(id));
  if (!targetMeeting) {
    try {
      const stored = JSON.parse(
        getAppStorage().getItem("app_meetings") || "[]",
      );
      targetMeeting = stored.find((m) => String(m.id) === String(id));
      if (targetMeeting) {
        state.meetings.unshift(targetMeeting);
      }
    } catch (e) {}
  }

  if (!targetMeeting) {
    try {
      const notifs = getNotifications();
      const notif = notifs.find(
        (n) =>
          String(n.meetingId) === String(id) || String(n.id) === String(id),
      );
      if (notif) {
        const timeParts = (notif.time || "").split("-").map((t) => t.trim());
        targetMeeting = {
          id: notif.meetingId || notif.id,
          title: notif.agenda || notif.title || "Rapat",
          requester: notif.requester || "Unit Kerja",
          room: notif.room || "Ruang Rapat",
          date: notif.date || getTodayIsoDate(),
          start: timeParts[0] || "08:00",
          end: timeParts[1] || "09:00",
          status: notif.status || "Menunggu Approval",
          participants: notif.participants || 10,
          desc: notif.agenda || notif.message || "",
        };
        state.meetings.unshift(targetMeeting);
      }
    } catch (e) {}
  }

  if (!targetMeeting) {
    alert("Data rapat tidak ditemukan.");
    return;
  }

  const statusLower = (targetMeeting.status || "").toLowerCase().trim();
  const isPending =
    statusLower.includes("menunggu") || statusLower === "pending";

  if (!isPending) {
    alert(
      "Rapat ini tidak dalam status menunggu persetujuan (Status saat ini: " +
        targetMeeting.status +
        (targetMeeting.approvedBy ? " oleh " + targetMeeting.approvedBy : "") +
        ").",
    );
    return;
  }

  const approverName = user.name || "Pimpinan";
  const approverRole = getRoleLabel(user.role);
  const approvedTag = `${approverName} - ${approverRole}`;

  targetMeeting.status = "Akan Datang";
  targetMeeting.approvedBy = approvedTag;
  targetMeeting.approvedAt = new Date().toISOString();

  state.meetings = state.meetings.map((m) => {
    if (String(m.id) === String(id)) {
      return {
        ...m,
        status: "Akan Datang",
        approvedBy: approvedTag,
        approvedAt: new Date().toISOString(),
      };
    }
    return m;
  });

  try {
    const jsonStr = JSON.stringify(state.meetings);
    getAppStorage().setItem("app_meetings", jsonStr);
    localStorage.setItem("app_meetings", jsonStr);
    sessionStorage.setItem("app_meetings", jsonStr);
    if (window.parent) {
      if (window.parent.localStorage)
        window.parent.localStorage.setItem("app_meetings", jsonStr);
      if (window.parent.sessionStorage)
        window.parent.sessionStorage.setItem("app_meetings", jsonStr);
      window.parent.dispatchEvent(new Event("storage"));
      window.parent.dispatchEvent(
        new CustomEvent("app_meetings_updated", { detail: state.meetings }),
      );
    }
    window.dispatchEvent(new Event("meeting_approved"));
    window.dispatchEvent(new Event("storage"));
  } catch (e) {}

  // Update notification item status
  try {
    const notifs = getNotifications();
    const notif = notifs.find(
      (n) => String(n.meetingId) === String(id) || String(n.id) === String(id),
    );
    if (notif) {
      notif.status = "Akan Datang";
      notif.approvedBy = approvedTag;
      if (!Array.isArray(notif.readBy)) notif.readBy = [];
      const u = (user?.username || "admin").toLowerCase();
      if (!notif.readBy.some((x) => String(x).toLowerCase() === u)) {
        notif.readBy.push(user?.username || "admin");
      }
      saveNotifications(notifs);
    }
  } catch (e) {}

  fetch("/api/dashboard/meetings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(targetMeeting),
  })
    .then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        if (data?.meeting?.googleId) {
          targetMeeting.googleId = data.meeting.googleId;
          targetMeeting.id = data.meeting.id;
          try {
            getAppStorage().setItem(
              "app_meetings",
              JSON.stringify(state.meetings),
            );
          } catch (e) {}
        }
        await fetchDashboardData(false);
      }
    })
    .catch((e) => console.warn("Sync approved meeting:", e));

  render();
  toast("✓ Rapat berhasil disetujui oleh " + approvedTag);
}

function executeCheckInMeetingManual(id) {
  const user = getCurrentUser();
  const nowIso = new Date().toISOString();
  const adminName = user?.name ? `${user.name} (Admin)` : "Admin (Manual)";

  state.meetings = state.meetings.map((item) => {
    if (String(item.id) === String(id)) {
      return {
        ...item,
        status: "Berjalan",
        checkInAt: nowIso,
        checkedInBy: adminName,
        checkInMethod: "manual_admin",
        checkInMethodLabel: "Manual oleh Admin",
      };
    }
    return item;
  });

  try {
    getAppStorage().setItem("app_meetings", JSON.stringify(state.meetings));
  } catch (e) {}

  [
    "storage",
    "meeting_checkin",
    "meeting_status_changed",
    "app_meetings_updated",
  ].forEach((ev) => {
    window.dispatchEvent(new Event(ev));
    try {
      if (window.parent && window.parent !== window)
        window.parent.dispatchEvent(new Event(ev));
    } catch (e) {}
  });

  fetch(`/api/dashboard/meetings/${id}/checkin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ by: adminName, method: "manual_admin" }),
  })
    .then(async () => {
      await fetchDashboardData(false);
    })
    .catch((e) => console.warn("Sync checkin manual error:", e));

  render();
  toast(
    "✓ Berhasil Check-In Manual oleh Admin. Sesi rapat kini berstatus Berjalan.",
  );
}

function checkInMeetingManual(id) {
  const user = getCurrentUser();
  if (!can("checkInOut", user))
    return denyAccess("Check-In rapat dilakukan oleh Admin.");

  const m = state.meetings.find((x) => String(x.id) === String(id));
  const title = m ? `"${m.title}"` : "rapat ini";

  showConfirmModal({
    title: "Check-In Manual",
    icon: ICON_FA_CHECK,
    iconBg: "#dcfce7",
    iconColor: "#15803d",
    message: `Lakukan <b>Check-In MANUAL</b> untuk <b>${esc(title)}</b>?`,
    infoText: `Peserta rapat / PIC sebenarnya dapat melakukan <b>Check-In mandiri</b> dengan memindai <b>Barcode / QR Code</b> di ruangan tanpa perlu Admin menekan tombol ini.`,
    subtext: `Gunakan tombol ini jika Anda ingin mengaktifkan sesi secara manual sekarang.`,
    confirmText: `<span style="display:inline-flex;align-items:center;gap:6px;">${ICON_FA_CHECK} Ya, Check-In Sekarang</span>`,
    confirmBg: "#16a34a",
    onConfirm: () => executeCheckInMeetingManual(id),
  });
}

function executeCheckOutMeetingManual(id) {
  const user = getCurrentUser();
  const nowIso = new Date().toISOString();
  const adminName = user?.name ? `${user.name} (Admin)` : "Admin (Manual)";

  state.meetings = state.meetings.map((item) => {
    if (String(item.id) === String(id)) {
      return {
        ...item,
        status: "Selesai",
        checkOutAt: nowIso,
        checkedOutBy: adminName,
        checkOutMethod: "manual_admin",
        checkOutMethodLabel: "Manual oleh Admin",
      };
    }
    return item;
  });

  try {
    getAppStorage().setItem("app_meetings", JSON.stringify(state.meetings));
  } catch (e) {}

  [
    "storage",
    "meeting_checkout",
    "meeting_status_changed",
    "app_meetings_updated",
  ].forEach((ev) => {
    window.dispatchEvent(new Event(ev));
    try {
      if (window.parent && window.parent !== window)
        window.parent.dispatchEvent(new Event(ev));
    } catch (e) {}
  });

  fetch(`/api/dashboard/meetings/${id}/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ by: adminName, method: "manual_admin" }),
  })
    .then(async () => {
      await fetchDashboardData(false);
    })
    .catch((e) => console.warn("Sync checkout manual error:", e));

  render();
  toast("✓ Berhasil Check-Out Manual oleh Admin. Rapat telah selesai.");
}

function checkOutMeetingManual(id) {
  const user = getCurrentUser();
  if (!can("checkInOut", user))
    return denyAccess("Check-Out rapat dilakukan oleh Admin.");

  const m = state.meetings.find((x) => String(x.id) === String(id));
  const title = m ? `"${m.title}"` : "rapat ini";

  showConfirmModal({
    title: "Check-Out Manual",
    icon: "⏹",
    iconBg: "#f3e8ff",
    iconColor: "#7e22ce",
    message: `Selesaikan sesi <b>${esc(title)}</b> secara <b>MANUAL</b> sebagai Admin?`,
    infoText: `Peserta / PIC sebenarnya dapat melakukan <b>Check-Out mandiri</b> di ruangan dengan memindai <b>Barcode / QR Code</b> tanpa perlu Admin menekan tombol ini.`,
    subtext: `Apakah Anda yakin ingin menyelesaikan dan mengakhiri sesi rapat ini sekarang?`,
    confirmText: "✓ Ya, Selesaikan Sesi",
    confirmBg: "#7c3aed",
    onConfirm: () => executeCheckOutMeetingManual(id),
  });
}

function checkInMeeting(id) {
  return checkInMeetingManual(id);
}

function checkOutMeeting(id) {
  return checkOutMeetingManual(id);
}
window.checkInMeeting = checkInMeeting;
window.checkOutMeeting = checkOutMeeting;
window.checkInMeetingManual = checkInMeetingManual;
window.checkOutMeetingManual = checkOutMeetingManual;

function rejectMeeting(id) {
  const user = getCurrentUser();
  if (!can("approve", user)) {
    alert(
      "Hak Akses Dibatasi:\nHanya akun Pimpinan yang dapat menolak permohonan rapat.",
    );
    return;
  }

  let targetMeeting = state.meetings.find((m) => String(m.id) === String(id));
  if (!targetMeeting) {
    try {
      const stored = JSON.parse(
        getAppStorage().getItem("app_meetings") || "[]",
      );
      targetMeeting = stored.find((m) => String(m.id) === String(id));
    } catch (e) {}
  }
  if (!targetMeeting) return;

  const statusLower = (targetMeeting.status || "").toLowerCase().trim();
  const isPending =
    statusLower.includes("menunggu") || statusLower === "pending";

  if (!isPending) {
    alert(
      "Rapat ini tidak dalam status menunggu persetujuan (Status saat ini: " +
        targetMeeting.status +
        (targetMeeting.approvedBy ? " oleh " + targetMeeting.approvedBy : "") +
        ") sehingga tidak dapat ditolak.",
    );
    return;
  }
  openModal(
    "Tolak Request Rapat",
    `<div class="form-grid">
       <div class="field full">
         <label>Alasan Penolakan</label>
         <textarea id="fRejectReason" rows="4" placeholder="Masukkan alasan mengapa request ini ditolak..." style="width:100%; border:1px solid #cbd5e0; border-radius:6px; padding:10px; font-family:inherit;"></textarea>
       </div>
     </div>
     <div class="modal-actions" style="margin-top:20px; display:flex; justify-content:flex-end; gap:8px;">
       <button class="btn btn-light" onclick="closeModal()">Batal</button>
       <button class="btn btn-primary" style="background:#c9363d;border-color:#c9363d;" onclick="confirmReject('${id}')">Tolak Rapat</button>
     </div>`,
  );
}

function confirmReject(id) {
  const user = getCurrentUser();
  if (!can("approve", user)) {
    alert("Hanya role Pimpinan yang berhak menolak permohonan rapat.");
    return;
  }
  const reason =
    document.getElementById("fRejectReason")?.value.trim() ||
    "Tidak ada alasan yang diberikan";
  const rejecterName = user.name || "Pimpinan";
  const rejecterRole = getRoleLabel(user.role);
  const rejecterTag = `${rejecterName} - ${rejecterRole}`;

  state.meetings = state.meetings.map((m) => {
    if (String(m.id) === String(id))
      return {
        ...m,
        status: "Dibatalkan",
        rejectedBy: rejecterTag,
        desc:
          (m.desc || "") +
          "\n\n[Dibatalkan oleh " +
          rejecterName +
          ": " +
          reason +
          "]",
      };
    return m;
  });

  try {
    const jsonStr = JSON.stringify(state.meetings);
    getAppStorage().setItem("app_meetings", jsonStr);
    localStorage.setItem("app_meetings", jsonStr);
    sessionStorage.setItem("app_meetings", jsonStr);
    if (window.parent) {
      if (window.parent.localStorage)
        window.parent.localStorage.setItem("app_meetings", jsonStr);
      if (window.parent.sessionStorage)
        window.parent.sessionStorage.setItem("app_meetings", jsonStr);
      window.parent.dispatchEvent(new Event("storage"));
      window.parent.dispatchEvent(
        new CustomEvent("app_meetings_updated", { detail: state.meetings }),
      );
    }
    window.dispatchEvent(new Event("storage"));
  } catch (e) {}

  // Update notification item status
  try {
    const notifs = getNotifications();
    const notif = notifs.find(
      (n) => String(n.meetingId) === String(id) || String(n.id) === String(id),
    );
    if (notif) {
      notif.status = "Dibatalkan";
      notif.rejectedBy = rejecterTag;
      if (!Array.isArray(notif.readBy)) notif.readBy = [];
      const u = (user?.username || "admin").toLowerCase();
      if (!notif.readBy.some((x) => String(x).toLowerCase() === u)) {
        notif.readBy.push(user?.username || "admin");
      }
      saveNotifications(notifs);
    }
  } catch (e) {}

  const targetRejected = state.meetings.find(
    (m) => String(m.id) === String(id),
  );
  if (targetRejected) {
    fetch("/api/dashboard/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(targetRejected),
    }).catch((e) => console.warn("Sync rejected meeting:", e));
  }

  closeModal();
  render();
  toast("Rapat berhasil ditolak & dibatalkan");
}

function editMeeting(id) {
  openMeetingModal(id);
}

function viewMeeting(id) {
  let m = state.meetings.find((x) => String(x.id) === String(id));
  if (!m) {
    try {
      const stored = JSON.parse(
        getAppStorage().getItem("app_meetings") || "[]",
      );
      m = stored.find((x) => String(x.id) === String(id));
      if (m) state.meetings.unshift(m);
    } catch (e) {}
  }
  if (!m) {
    try {
      const notifs = getNotifications();
      const notif = notifs.find(
        (n) =>
          String(n.meetingId) === String(id) || String(n.id) === String(id),
      );
      if (notif) {
        const timeParts = (notif.time || "").split("-").map((t) => t.trim());
        m = {
          id: notif.meetingId || notif.id,
          title: notif.agenda || notif.title || "Rapat",
          requester: notif.requester || "Unit Kerja",
          room: notif.room || "Ruang Rapat",
          date: notif.date || getTodayIsoDate(),
          start: timeParts[0] || "08:00",
          end: timeParts[1] || "09:00",
          status: notif.status || "Menunggu Approval",
          participants: notif.participants || 10,
          desc: notif.agenda || notif.message || "",
        };
        state.meetings.unshift(m);
      }
    } catch (e) {}
  }
  if (!m) return;
  const user = getCurrentUser();
  const isAtasan = isAtasanRole(user);
  const isAdmin = isAdminRole(user);

  try {
    const rawUsername = user?.username || "admin";
    const username = rawUsername.toLowerCase();
    const notifs = getNotifications();
    let updated = false;
    notifs.forEach((n) => {
      if (String(n.meetingId) === String(id) || String(n.id) === String(id)) {
        if (!Array.isArray(n.readBy)) n.readBy = [];
        if (!n.readBy.some((u) => String(u).toLowerCase() === username)) {
          n.readBy.push(rawUsername);
          updated = true;
        }
      }
    });
    if (updated) saveNotifications(notifs);
  } catch (err) {}

  const isCanceled = m.status === "Dibatalkan";
  const cancelBox = isCanceled
    ? `<div style="background:#fee2e2;border:1.5px solid #fca5a5;color:#991b1b;padding:12px 16px;border-radius:10px;margin:14px 0;font-size:13px;line-height:1.45;">
        <div style="font-weight:700;display:flex;align-items:center;gap:6px;margin-bottom:4px;">
          <span>⚠️</span> Status: Dibatalkan
        </div>
        <div>${esc(m.cancellationReason || "Ruangan telah dialihkan untuk rapat prioritas Kepala Biro Keuangan dan BMN.")}</div>
       </div>`
    : "";

  const reviewRating = Math.max(0, Math.min(5, Number(m.review?.rating) || 0));
  const reviewBox = m.review
    ? `<div style="margin:14px 0;padding:13px 15px;border:1px solid #d9e6f4;border-radius:10px;background:#f6faff;">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px;">
          <b style="color:#123760;">Rating &amp; Review</b>
          <span style="color:#e4a719;letter-spacing:1px;" aria-label="Rating ${reviewRating} dari 5">${"★".repeat(reviewRating)}<span style="color:#cbd5e1;">${"☆".repeat(5 - reviewRating)}</span></span>
          <b style="color:#526a85;">${reviewRating}/5</b>
        </div>
        <div style="color:#405d7e;white-space:pre-wrap;">${esc(m.review.text || "Tidak ada komentar.")}</div>
        ${m.review.reviewer ? `<small style="display:block;margin-top:7px;color:#75869b;">Dari ${esc(m.review.reviewer)}</small>` : ""}
      </div>`
    : m.status === "Selesai"
      ? `<div style="margin:14px 0;padding:11px 14px;border-radius:9px;color:#75869b;background:#f3f6fa;font-size:12px;">Belum ada rating dan review untuk rapat ini.</div>`
      : "";

  const statusStr = (m.status || "").trim();
  const statusLower = statusStr.toLowerCase();
  const isPending =
    statusLower.includes("menunggu") || statusLower === "pending";
  const isUpcoming =
    statusLower === "akan datang" ||
    statusLower === "disetujui" ||
    statusLower === "approved";
  const isRunning =
    statusLower === "berjalan" ||
    statusLower === "ongoing" ||
    statusLower === "running";
  const isCompleted = statusLower === "selesai" || statusLower === "completed";
  const isRejected = statusLower === "ditolak" || statusLower === "rejected";
  const canShowQr = !isPending && !isCanceled && !isRejected;

  let actionBtns = `<button class="btn btn-light" style="display:inline-flex;align-items:center;gap:6px;" onclick="exportNotulensiPDF('${m.id}')">${ICONS.export} <span>Notulensi</span></button>`;
  if (canShowQr) {
    actionBtns += `<button class="btn btn-light" style="display:inline-flex;align-items:center;gap:6px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;font-weight:700;" onclick="closeModal(); openMeetingQRModal('${m.id}')"><span>📱 QR Pass &amp; Presensi</span></button>`;
  }

  if (isPending) {
    if (can("approve")) {
      actionBtns += `<button class="btn btn-primary" style="background:#219653;border-color:#219653;font-weight:700;" onclick="closeModal(); approveMeeting('${m.id}')">✓ Setujui Rapat</button>`;
      actionBtns += `<button class="btn btn-primary" style="background:#ff4d4f;border-color:#ff4d4f;font-weight:700;" onclick="closeModal(); rejectMeeting('${m.id}')">✕ Tolak Rapat</button>`;
    } else {
      actionBtns += `<div style="font-size:12px;color:#d97706;background:#fef3c7;padding:7px 12px;border-radius:8px;font-weight:600;display:inline-flex;align-items:center;">⏳ Menunggu Persetujuan Pimpinan</div>`;
    }
  } else if (isUpcoming && can("checkInOut")) {
    actionBtns += `<button class="btn btn-primary" style="background:#219653;border-color:#219653;font-weight:700;" onclick="closeModal(); checkInMeetingManual('${m.id}')" title="Sistem 2: Check-In Manual oleh Admin Dashboard">✓ Check In (Manual Admin)</button>`;
  } else if (isRunning && can("checkInOut")) {
    actionBtns += `<button class="btn btn-primary" style="background:#ff4d4f;border-color:#ff4d4f;font-weight:700;" onclick="closeModal(); checkOutMeetingManual('${m.id}')" title="Sistem 2: Check-Out Manual oleh Admin Dashboard">Check Out (Manual Admin)</button>`;
  }

  if (can("manageMeeting")) {
    actionBtns += `<button class="btn btn-primary" onclick="closeModal(); editMeeting('${m.id}')">Edit Rapat</button>`;
  }

  if (!isCompleted && !isCanceled && can("emergencyCancel")) {
    actionBtns += `<button class="btn btn-primary" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;font-weight:700;display:inline-flex;align-items:center;gap:4px;" title="Batalkan Rapat Darurat (Hanya jika diperlukan)" onclick="closeModal(); openEmergencyCancelModal('${m.id}')">🚨 Batal Darurat</button>`;
  }

  const materialsList = Array.isArray(m.materials) ? m.materials : [];
  let materialsHtml = "";
  if (materialsList.length > 0) {
    materialsHtml = materialsList
      .map((mat) => {
        const isLink = mat.type === "link";
        const icon =
          mat.type === "pdf"
            ? "📄"
            : mat.type === "ppt"
              ? "📊"
              : isLink
                ? "🔗"
                : "📁";
        return `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:6px;">
          <div style="display:flex;align-items:center;gap:8px;min-width:0;">
            <span style="font-size:16px;">${icon}</span>
            <div style="min-width:0;">
              <div style="font-size:12.5px;font-weight:600;color:#0c2d5e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(mat.name)}</div>
              <div style="font-size:11px;color:#64748b;">${mat.size ? `${esc(mat.size)} · ` : ""}${esc(mat.uploadedBy || "Materi")}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
            <a href="${esc(mat.url)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:6px;font-size:11.5px;font-weight:600;text-decoration:none;" download="${!isLink ? esc(mat.name) : ""}">
              <span>${isLink ? "Buka Link" : "Unduh / Buka"}</span>
            </a>
            <button type="button" onclick="deleteMaterialFromMeeting('${esc(m.id)}', '${esc(mat.id)}')" style="border:none;background:transparent;color:#ef4444;cursor:pointer;padding:4px 6px;border-radius:4px;font-size:12px;" title="Hapus materi">🗑️</button>
          </div>
        </div>`;
      })
      .join("");
  } else {
    materialsHtml = `<div style="font-size:12px;color:#64748b;font-style:italic;padding:6px 0;">Belum ada dokumen materi atau paparan yang diunggah.</div>`;
  }

  const materialsBox = `
    <div style="margin:16px 0;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <b style="color:#0c2d5e;font-size:13px;display:flex;align-items:center;gap:6px;">📎 Materi Rapat (PDF &amp; Paparan)</b>
        <button type="button" onclick="openAddMaterialModal('${esc(m.id)}')" style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;background:#0c2d5e;color:#fff;border:none;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer;">
          + Tambah Materi
        </button>
      </div>
      <div>${materialsHtml}</div>
    </div>
  `;

  // Info Audit Presensi: Sistem 1 (Barcode/QR Mandiri) vs Sistem 2 (Manual Admin)
  let presensiAuditBox = "";
  if (m.checkInAt || m.checkOutAt) {
    presensiAuditBox = `
      <div style="margin:14px 0;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:12.5px;">
        <div style="font-weight:700;color:#0c2d5e;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
          <span>📋</span> Riwayat Presensi &amp; Metode Check-In/Out
        </div>
        ${
          m.checkInAt
            ? `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
            <div>
              <span style="color:#15803d;font-weight:600;">✓ Check-In:</span>
              <span style="color:#334155;">${formatDate(m.checkInAt)} · ${new Date(m.checkInAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB</span>
              ${m.checkedInBy ? `<small style="color:#64748b;">(${esc(m.checkedInBy)})</small>` : ""}
            </div>
            <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;background:${m.checkInMethod === "barcode_qr" ? "#e0f2fe;color:#0369a1;border:1px solid #bae6fd;" : "#fef3c7;color:#b45309;border:1px solid #fde68a;"}">
              ${m.checkInMethod === "barcode_qr" ? "📱 [Sistem 1] Barcode / QR Mandiri" : "👤 [Sistem 2] Manual Admin"}
            </span>
          </div>`
            : ""
        }
        ${
          m.checkOutAt
            ? `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
            <div>
              <span style="color:#b91c1c;font-weight:600;">✓ Check-Out:</span>
              <span style="color:#334155;">${formatDate(m.checkOutAt)} · ${new Date(m.checkOutAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB</span>
              ${m.checkedOutBy ? `<small style="color:#64748b;">(${esc(m.checkedOutBy)})</small>` : ""}
            </div>
            <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;background:${m.checkOutMethod === "barcode_qr" ? "#e0f2fe;color:#0369a1;border:1px solid #bae6fd;" : "#fef3c7;color:#b45309;border:1px solid #fde68a;"}">
              ${m.checkOutMethod === "barcode_qr" ? "📱 [Sistem 1] Barcode / QR Mandiri" : "👤 [Sistem 2] Manual Admin"}
            </span>
          </div>`
            : ""
        }
      </div>
    `;
  }

  openModal(
    "Detail Rapat",
    `<p style="font-size:16px;color:#0c2d5e;"><b>${esc(m.title)}</b></p>
    ${cancelBox}
    ${reviewBox}
    <p class="muted" style="margin:12px 0">${formatDate(m.date)} · ${m.start}-${m.end}</p>
    <p>📍 ${esc(m.room)}</p>
    <p>👤 <b>Pemesan:</b> ${esc(m.requester)}</p>
    <p>👥 ${m.participants} peserta</p>
    <p>🏷️ <b>Status:</b> ${badge(m.status)}</p>
    ${m.approvedBy ? `<p>✓ <b>Disetujui Oleh:</b> <span style="color:#15803d;font-weight:600;">${esc(m.approvedBy)}</span></p>` : ""}
    ${m.rejectedBy ? `<p style="color:#dc2626;">✕ <b>Ditolak Oleh:</b> ${esc(m.rejectedBy)}</p>` : ""}
    ${presensiAuditBox}
    <p style="margin-top:15px;color:#334155;white-space:pre-line;">${esc(m.desc)}</p>
    ${materialsBox}
    <div class="modal-actions" style="margin-top:20px;display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;align-items:center;">
      <button class="btn btn-light" style="display:inline-flex;align-items:center;gap:6px;background:#fff8e6;color:#d97706;border:1px solid #fde68a;font-weight:700;" onclick="closeModal(); openMeetingReviewModal('${m.id}')">★ <span>Rating & Review</span></button>
      ${actionBtns}
    </div>`,
  );
}

let adminUploadedFileData = null;

function toggleAdminMatInput(type) {
  const fSec = document.getElementById("adminMatFileSection");
  const lSec = document.getElementById("adminMatLinkSection");
  if (type === "link") {
    if (fSec) fSec.style.display = "none";
    if (lSec) lSec.style.display = "block";
  } else {
    if (fSec) fSec.style.display = "block";
    if (lSec) lSec.style.display = "none";
  }
}
window.toggleAdminMatInput = toggleAdminMatInput;

function onAdminMatFilePicked(input) {
  const file = input.files?.[0];
  if (!file) {
    adminUploadedFileData = null;
    return;
  }
  const ext = file.name.split(".").pop().toLowerCase();
  let type = "file";
  if (ext === "pdf") type = "pdf";
  else if (ext === "ppt" || ext === "pptx") type = "ppt";
  else if (ext === "doc" || ext === "docx") type = "doc";
  else if (ext === "xls" || ext === "xlsx") type = "excel";

  const sizeStr =
    file.size < 1024 * 1024
      ? (file.size / 1024).toFixed(1) + " KB"
      : (file.size / (1024 * 1024)).toFixed(1) + " MB";

  const reader = new FileReader();
  reader.onload = (e) => {
    adminUploadedFileData = {
      name: file.name,
      url: e.target?.result,
      size: sizeStr,
      type,
    };
    const titleInput = document.getElementById("adminMatTitleInput");
    if (titleInput && !titleInput.value.trim()) {
      titleInput.value = file.name.replace(/\.[^/.]+$/, "");
    }
    const hint = document.getElementById("adminMatFileHint");
    if (hint) hint.textContent = `✓ File siap: ${file.name} (${sizeStr})`;
  };
  reader.readAsDataURL(file);
}
window.onAdminMatFilePicked = onAdminMatFilePicked;

function openAddMaterialModal(meetingId) {
  const m = state.meetings.find((x) => String(x.id) === String(meetingId));
  if (!m) {
    alert("Data rapat tidak ditemukan.");
    return;
  }
  adminUploadedFileData = null;
  openModal(
    "Tambah Materi Rapat",
    `<div class="form-grid" style="font-family:'Poppins',sans-serif;">
      <div class="field full">
        <label>Pilih Jenis Sumber Dokumen</label>
        <div style="display:flex;gap:16px;margin-top:6px;">
          <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
            <input type="radio" name="adminMatType" value="file" checked onchange="toggleAdminMatInput('file')"> Upload Dokumen (PDF / PPT / Paparan)
          </label>
          <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
            <input type="radio" name="adminMatType" value="link" onchange="toggleAdminMatInput('link')"> Link / Tautan Online
          </label>
        </div>
      </div>
      <div class="field full" id="adminMatFileSection">
        <label>Pilih File Dokumen</label>
        <input type="file" id="adminMatFileInput" accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx" onchange="onAdminMatFilePicked(this)" style="font-size:12.5px;">
        <small id="adminMatFileHint" style="display:block;margin-top:4px;color:#16a34a;font-weight:600;"></small>
      </div>
      <div class="field full" id="adminMatLinkSection" style="display:none;">
        <label>Tautan / URL Dokumen (Google Drive, OneDrive, Web)</label>
        <input type="url" id="adminMatUrlInput" placeholder="https://drive.google.com/file/d/..." style="font-size:13px;">
      </div>
      <div class="field full">
        <label>Judul / Nama Materi</label>
        <input type="text" id="adminMatTitleInput" placeholder="Contoh: Bahan Paparan Rapat" style="font-size:13px;">
      </div>
      <div class="field full">
        <label>Pengunggah (Admin / PIC)</label>
        <input type="text" id="adminMatUploaderInput" value="${esc(getCurrentUser()?.name || "Admin")}" style="font-size:13px;">
      </div>
    </div>
    <div class="modal-actions" style="margin-top:20px;">
      <button class="btn btn-light" onclick="closeModal(); viewMeeting('${esc(m.id)}')">Kembali</button>
      <button class="btn btn-primary" onclick="submitAdminMaterial('${esc(m.id)}')">Simpan Materi</button>
    </div>`,
  );
}
window.openAddMaterialModal = openAddMaterialModal;

async function submitAdminMaterial(meetingId) {
  const isLink =
    document.querySelector('input[name="adminMatType"]:checked')?.value ===
    "link";
  let url = "";
  let type = "pdf";
  let size = "";
  let name = (
    document.getElementById("adminMatTitleInput")?.value || ""
  ).trim();
  const uploader =
    (document.getElementById("adminMatUploaderInput")?.value || "").trim() ||
    "Admin";

  if (isLink) {
    url = (document.getElementById("adminMatUrlInput")?.value || "").trim();
    if (!url) {
      alert("Mohon masukkan tautan / link dokumen materi.");
      return;
    }
    type = "link";
    size = "Link";
    if (!name) name = "Tautan Materi";
  } else {
    if (!adminUploadedFileData?.url) {
      alert("Mohon pilih file materi yang ingin diunggah.");
      return;
    }
    url = adminUploadedFileData.url;
    type = adminUploadedFileData.type;
    size = adminUploadedFileData.size;
    if (!name) name = adminUploadedFileData.name;
  }

  const payload = { name, type, url, size, uploadedBy: uploader };

  try {
    const res = await fetch(`/api/dashboard/meetings/${meetingId}/materials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.meeting) {
        const idx = state.meetings.findIndex(
          (m) => String(m.id) === String(meetingId),
        );
        if (idx !== -1) {
          state.meetings[idx] = {
            ...state.meetings[idx],
            materials: data.meeting.materials,
          };
        }
      }
    } else {
      const idx = state.meetings.findIndex(
        (m) => String(m.id) === String(meetingId),
      );
      if (idx !== -1) {
        if (!Array.isArray(state.meetings[idx].materials))
          state.meetings[idx].materials = [];
        state.meetings[idx].materials.push({
          id: "mat_" + Date.now(),
          ...payload,
          uploadedAt: new Date().toISOString(),
        });
      }
    }
    try {
      getAppStorage().setItem("app_meetings", JSON.stringify(state.meetings));
    } catch (e) {}

    toast("✓ Materi rapat berhasil ditambahkan.");
    closeModal();
    viewMeeting(meetingId);
  } catch (err) {
    alert("Gagal menyimpan materi: " + err.message);
  }
}
window.submitAdminMaterial = submitAdminMaterial;

async function deleteMaterialFromMeeting(meetingId, matId) {
  if (!confirm("Hapus materi ini dari rapat?")) return;
  try {
    await fetch(`/api/dashboard/meetings/${meetingId}/materials/${matId}`, {
      method: "DELETE",
    });
    const idx = state.meetings.findIndex(
      (m) => String(m.id) === String(meetingId),
    );
    if (idx !== -1 && Array.isArray(state.meetings[idx].materials)) {
      state.meetings[idx].materials = state.meetings[idx].materials.filter(
        (x) => String(x.id) !== String(matId),
      );
      try {
        getAppStorage().setItem("app_meetings", JSON.stringify(state.meetings));
      } catch (e) {}
    }
    toast("Dokumen materi berhasil dihapus.");
    viewMeeting(meetingId);
  } catch (e) {
    alert("Gagal menghapus materi.");
  }
}
window.deleteMaterialFromMeeting = deleteMaterialFromMeeting;

// ----------------------------------------------------------------------
// RATING & REVIEW RUANGAN
// ----------------------------------------------------------------------
function getMeetingReview(m) {
  if (!m) return null;
  if (m.review) return m.review;
  const isFinished = (m.status || "").toLowerCase() === "selesai";
  if (isFinished) {
    const isKonsultasi = (m.room || "").toLowerCase().includes("konsultasi");
    return {
      rating: isKonsultasi ? 4.8 : 5.0,
      cleanliness: 5,
      facilities: isKonsultasi ? 4.8 : 5,
      comfort: 5,
      service: 5,
      comment: isKonsultasi
        ? "Ruangan sangat representatif dan kondusif untuk konsultasi. Smart TV dan koneksi berjalan sangat lancar. Suasana nyaman dan ber-AC dingin."
        : "Ruangan bersih, tertata rapi, dan fasilitas Smart TV 85 inch serta sound system/mic berfungsi sempurna selama presentasi berlangsung.",
      reviewer: m.requester || "User Pemesan",
      submittedAt: m.date
        ? `${m.date}T${m.end || "12:00"}:00.000Z`
        : new Date().toISOString(),
      tags: ["Fasilitas Lengkap", "Sangat Bersih", "AC Dingin", "Tepat Waktu"],
    };
  }
  return null;
}
window.getMeetingReview = getMeetingReview;

function openMeetingReviewModal(id) {
  const m = state.meetings.find((x) => String(x.id) === String(id));
  if (!m) {
    alert("Data rapat tidak ditemukan.");
    return;
  }

  const isCompleted = (m.status || "").toLowerCase() === "selesai";
  const rev = getMeetingReview(m);

  const renderStars = (rating = 5, size = 18) => {
    let stars = "";
    for (let i = 1; i <= 5; i++) {
      const isFilled = i <= Math.round(rating);
      stars += `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${isFilled ? "#f59e0b" : "#e2e8f0"}" style="margin-right:2px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    }
    return stars;
  };

  const contentHTML =
    isCompleted && rev
      ? `
    <div style="font-family:'Poppins',sans-serif;color:#0c2d5e;">
      <!-- Header Ruangan & Rapat Info -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div>
          <div style="font-size:12px;font-weight:700;color:#1769aa;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">📍 ${esc(m.room)}</div>
          <div style="font-size:15px;font-weight:700;color:#0c2d5e;">${esc(m.title)}</div>
          <div style="font-size:12.5px;color:#64748b;margin-top:2px;">
            👤 Pemesan: <b>${esc(m.requester)}</b> · 📅 ${formatDate(m.date)} (${m.start} - ${m.end})
          </div>
        </div>
        <div>
          <span style="background:#ecfdf5;color:#059669;border:1px solid #a7f3d0;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:4px;">
            ✓ Rapat Selesai Digunakan
          </span>
        </div>
      </div>

      <!-- Overall Rating Big Box -->
      <div style="background:linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);border:1.5px solid #fde68a;border-radius:16px;padding:20px;display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;box-shadow:0 4px 14px rgba(245,158,11,0.08);flex-wrap:wrap;gap:16px;">
        <div style="display:flex;align-items:center;gap:18px;">
          <div style="font-size:46px;font-weight:800;color:#b45309;line-height:1;letter-spacing:-1px;">
            ${rev.rating ? Number(rev.rating).toFixed(1) : "5.0"}
          </div>
          <div>
            <div style="display:flex;align-items:center;margin-bottom:4px;">
              ${renderStars(rev.rating || 5, 20)}
            </div>
            <div style="font-size:13.5px;font-weight:700;color:#92400e;">
              ${(rev.rating || 5) >= 4.5 ? "Sangat Puas & Direkomendasikan" : "Puas"}
            </div>
            <div style="font-size:11.5px;color:#b45309;">
              Berdasarkan evaluasi langsung dari pengguna setelah selesai rapat
            </div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;color:#92400e;font-weight:600;text-transform:uppercase;">Status Ulasan</div>
          <div style="background:#ffffff;color:#b45309;border:1px solid #fde68a;font-weight:700;font-size:12px;padding:4px 12px;border-radius:20px;display:inline-block;margin-top:4px;">
            ★ Terverifikasi
          </div>
        </div>
      </div>

      <!-- Kategori Penilaian Fasilitas Ruangan -->
      <div style="margin-bottom:20px;">
        <div style="font-size:13px;font-weight:700;color:#0c2d5e;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.4px;">
          Aspek Penilaian Ruangan
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div style="background:#ffffff;border:1px solid #eef2f6;border-radius:10px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:12.5px;color:#334155;font-weight:500;">✨ Kebersihan & Kerapian</span>
            <span style="font-size:12.5px;font-weight:700;color:#b45309;display:flex;align-items:center;gap:3px;">
              ${renderStars(rev.cleanliness || 5, 13)} ${rev.cleanliness || 5}.0
            </span>
          </div>
          <div style="background:#ffffff;border:1px solid #eef2f6;border-radius:10px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:12.5px;color:#334155;font-weight:500;">🖥️ Fungsi Fasilitas (TV, Mic, dll)</span>
            <span style="font-size:12.5px;font-weight:700;color:#b45309;display:flex;align-items:center;gap:3px;">
              ${renderStars(rev.facilities || 5, 13)} ${rev.facilities || 5}.0
            </span>
          </div>
          <div style="background:#ffffff;border:1px solid #eef2f6;border-radius:10px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:12.5px;color:#334155;font-weight:500;">❄️ Kenyamanan & Suhu AC</span>
            <span style="font-size:12.5px;font-weight:700;color:#b45309;display:flex;align-items:center;gap:3px;">
              ${renderStars(rev.comfort || 5, 13)} ${rev.comfort || 5}.0
            </span>
          </div>
          <div style="background:#ffffff;border:1px solid #eef2f6;border-radius:10px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:12.5px;color:#334155;font-weight:500;">⚡ Kesiapan Ruang & Layanan</span>
            <span style="font-size:12.5px;font-weight:700;color:#b45309;display:flex;align-items:center;gap:3px;">
              ${renderStars(rev.service || 5, 13)} ${rev.service || 5}.0
            </span>
          </div>
        </div>
      </div>

      <!-- Testimoni / Ulasan User -->
      <div style="margin-bottom:22px;">
        <div style="font-size:13px;font-weight:700;color:#0c2d5e;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.4px;">
          Ulasan & Masukan dari Pengguna
        </div>
        <div style="background:#f8fafc;border-left:4px solid #f59e0b;border-top:1px solid #e2e8f0;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;border-radius:0 12px 12px 0;padding:16px 18px;position:relative;">
          <div style="font-size:13.5px;line-height:1.6;color:#1e293b;font-style:italic;margin-bottom:12px;">
            "${esc(rev.comment || "Ruangan dan seluruh fasilitas berfungsi dengan sangat baik dan memuaskan.")}"
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;padding-top:10px;border-top:1px dashed #cbd5e1;">
            <div style="font-size:12px;color:#64748b;">
              👤 <b>${esc(rev.reviewer || m.requester)}</b> · 🕒 ${formatDate(rev.submittedAt || m.date)}
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              ${(rev.tags || ["Fasilitas Berfungsi Baik", "Sangat Bersih"])
                .map(
                  (t) => `
                <span style="background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:600;padding:3px 9px;border-radius:12px;border:1px solid #dbeafe;">${esc(t)}</span>
              `,
                )
                .join("")}
            </div>
          </div>
        </div>
      </div>

      <!-- Balasan dari Pengelola Ruangan (Terkirim ke Booking Page) -->
      <div style="margin-bottom:22px;">
        <div style="font-size:13px;font-weight:700;color:#0c2d5e;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.4px;display:flex;align-items:center;justify-content:space-between;">
          <span>🏢 Balasan Pengelola Ruangan (Tampil di Booking Page)</span>
          ${
            rev.adminReply
              ? `
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:11px;font-weight:700;color:#16a34a;background:#ecfdf5;padding:3px 10px;border-radius:12px;border:1px solid #bbf7d0;">✓ Sudah Dibalas</span>
              <button type="button" onclick="openReviewReplyModal('${m.id}')" style="background:#f0f9ff;color:#0284c7;border:1px solid #bae6fd;padding:3px 10px;border-radius:6px;font-size:11.5px;font-weight:700;cursor:pointer;">✏️ Ubah Balasan</button>
            </div>
          `
              : `<span style="font-size:11px;font-weight:600;color:#64748b;background:#f1f5f9;padding:3px 10px;border-radius:12px;">Belum Dibalas</span>`
          }
        </div>
        ${
          rev.adminReply
            ? `
          <div style="background:#f0fdf4;border-left:4px solid #16a34a;border-top:1px solid #bbf7d0;border-right:1px solid #bbf7d0;border-bottom:1px solid #bbf7d0;border-radius:0 12px 12px 0;padding:14px 16px;">
            <div style="font-size:13.5px;line-height:1.6;color:#14532d;">
              "${esc(rev.adminReply.text || "")}"
            </div>
            <div style="font-size:11.5px;color:#15803d;margin-top:8px;font-weight:600;display:flex;align-items:center;gap:6px;">
              <span>👤 ${esc(rev.adminReply.sender || "Pengelola Ruang Rapat Kemnaker")}</span>
              <span>·</span>
              <span>🕒 ${formatDate(rev.adminReply.repliedAt || "")}</span>
            </div>
          </div>
        `
            : `
          <div style="background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:10px;padding:14px 16px;color:#64748b;font-size:12.5px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
            <span>Belum ada balasan dari pengelola untuk ulasan ini. Balas sekarang agar pengguna dapat membacanya di Booking Page.</span>
            <button type="button" onclick="openReviewReplyModal('${m.id}')" style="background:#0284c7;color:#fff;border:none;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">
              + Tulis Balasan
            </button>
          </div>
        `
        }
      </div>

      <!-- Actions Footer -->
      <div style="display:flex;justify-content:flex-end;align-items:center;padding-top:14px;border-top:1px solid #f1f5f9;margin-top:10px;">
        <button type="button" class="btn btn-primary" onclick="closeModal()" style="background:#0c2d5e;border-color:#0c2d5e;padding:8px 26px;font-weight:700;font-size:13px;border-radius:8px;">
          Tutup
        </button>
      </div>
    </div>
  `
      : `
    <div style="font-family:'Poppins',sans-serif;color:#0c2d5e;text-align:center;padding:10px 0 10px;">
      <!-- Meeting Context -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:20px;text-align:left;">
        <div style="font-size:12px;font-weight:700;color:#1769aa;text-transform:uppercase;margin-bottom:2px;">📍 ${esc(m.room)}</div>
        <div style="font-size:15px;font-weight:700;color:#0c2d5e;">${esc(m.title)}</div>
        <div style="font-size:12.5px;color:#64748b;margin-top:2px;">
          👤 Pemesan: <b>${esc(m.requester)}</b> · 📅 ${formatDate(m.date)} (${m.start} - ${m.end}) · Status: ${badge(m.status)}
        </div>
      </div>

      <!-- Empty / Pending State -->
      <div style="background:#fffbeb;border:1.5px dashed #fde68a;border-radius:16px;padding:32px 20px;margin-bottom:22px;">
        <div style="width:56px;height:56px;border-radius:50%;background:#fef3c7;display:grid;place-items:center;margin:0 auto 14px;color:#d97706;font-size:24px;">
          ⏳
        </div>
        <div style="font-size:17px;font-weight:700;color:#92400e;margin-bottom:6px;">
          Rating & Review Belum Tersedia
        </div>
        <p style="font-size:13px;color:#b45309;max-width:440px;margin:0 auto 18px;line-height:1.55;">
          Rapat ini saat ini berstatus <b>${esc(m.status)}</b>. Ulasan dan penilaian fasilitas ruangan dari pemesan (<b>${esc(m.requester)}</b>) akan otomatis muncul setelah rapat selesai digunakan (Check Out / Selesai).
        </p>
        <button type="button" onclick="openReviewEditForm('${m.id}')" style="background:#d97706;color:#ffffff;border:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 4px 12px rgba(217,119,6,0.25);">
          ⭐ Simulasi / Beri Rating Sekarang
        </button>
      </div>

      <div style="display:flex;justify-content:flex-end;">
        <button type="button" class="btn btn-primary" onclick="closeModal()" style="background:#0c2d5e;border-color:#0c2d5e;padding:8px 22px;font-weight:700;font-size:13px;border-radius:8px;">
          Tutup
        </button>
      </div>
    </div>
  `;

  openModal("Rating & Review Ruangan", contentHTML);
}
window.openMeetingReviewModal = openMeetingReviewModal;

function openReviewReplyModal(id) {
  const m = state.meetings.find((x) => String(x.id) === String(id));
  if (!m) return;
  const rev = getMeetingReview(m);
  if (!rev) return;

  const currentReplyText = rev.adminReply
    ? rev.adminReply.text || ""
    : "Terima kasih banyak atas ulasan dan penilaian yang diberikan. Kami senang fasilitas dan kenyamanan ruangan dapat mendukung kelancaran rapat Anda.";
  const currentSender = rev.adminReply
    ? rev.adminReply.sender || ""
    : "Pengelola Ruang Rapat Kemnaker";

  const formHTML = `
    <div style="font-family:'Poppins',sans-serif;color:#0c2d5e;">
      <!-- Ringkasan Ulasan Pemesan -->
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 14px;margin-bottom:16px;">
        <div style="font-size:12px;font-weight:700;color:#b45309;margin-bottom:4px;">
          Ulasan dari ${esc(rev.reviewer || m.requester)} (⭐ ${rev.rating ? Number(rev.rating).toFixed(1) : "5.0"})
        </div>
        <div style="font-size:13px;font-style:italic;color:#78350f;line-height:1.5;">
          "${esc(rev.comment || "Ruangan dan fasilitas sangat memuaskan.")}"
        </div>
      </div>

      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;color:#0c2d5e;">
          Nama Pengirim Balasan <span style="color:#e53e3e;">*</span>
        </label>
        <input id="replySenderInput" type="text" value="${esc(currentSender)}" style="width:100%;padding:10px 14px;border:1px solid #cbd5e1;border-radius:8px;font-size:13.5px;color:#0c2d5e;box-sizing:border-box;outline:none;" placeholder="Contoh: Pengelola Ruang Rapat Kemnaker">
      </div>

      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;color:#0c2d5e;">
          Teks Balasan Review (Akan Tampil di Booking Page) <span style="color:#e53e3e;">*</span>
        </label>
        <textarea id="replyTextInput" rows="4" style="width:100%;padding:10px 14px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;color:#0c2d5e;box-sizing:border-box;outline:none;font-family:'Poppins',sans-serif;line-height:1.5;" placeholder="Tuliskan ucapan terima kasih atau tanggapan resmi dari pengelola...">${esc(currentReplyText)}</textarea>
        <small style="display:block;color:#64748b;font-size:11.5px;margin-top:4px;">
          💡 Balasan ini akan dikirimkan ke Booking Page sehingga pengguna lain dan pemesan dapat membaca tanggapan resmi pengelola.
        </small>
      </div>

      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;padding-top:14px;border-top:1px solid #f1f5f9;">
        <button type="button" class="btn btn-light" onclick="openMeetingReviewModal('${m.id}')">Batal</button>
        <button type="button" class="btn btn-primary" onclick="submitReviewReply('${m.id}')" style="background:#0284c7;border-color:#0284c7;color:#fff;padding:8px 22px;font-weight:700;font-size:13px;border-radius:8px;display:inline-flex;align-items:center;gap:6px;">
          🚀 Kirim Balasan ke Booking Page
        </button>
      </div>
    </div>
  `;

  openModal("Balasan Review Pengguna", formHTML);
}
window.openReviewReplyModal = openReviewReplyModal;

async function submitReviewReply(id) {
  const text = document.getElementById("replyTextInput")?.value?.trim();
  const sender =
    document.getElementById("replySenderInput")?.value?.trim() ||
    "Pengelola Ruang Rapat Kemnaker";

  if (!text) {
    alert("Harap masukkan teks balasan review.");
    return;
  }

  const m = state.meetings.find((x) => String(x.id) === String(id));
  if (!m) return;
  const currentRev = getMeetingReview(m) || {};

  const updatedRev = {
    ...currentRev,
    adminReply: {
      text: text,
      sender: sender,
      repliedAt: new Date().toISOString(),
    },
  };

  state.meetings = state.meetings.map((item) => {
    if (String(item.id) === String(id)) {
      return {
        ...item,
        review: updatedRev,
      };
    }
    return item;
  });

  try {
    getAppStorage().setItem("app_meetings", JSON.stringify(state.meetings));
    localStorage.setItem("app_meetings", JSON.stringify(state.meetings));
  } catch (e) {}

  window.dispatchEvent(new Event("app_meetings_updated"));
  try {
    if (window.parent && window.parent !== window) {
      window.parent.dispatchEvent(new Event("app_meetings_updated"));
    }
  } catch (e) {}

  const updatedMeeting = state.meetings.find(
    (x) => String(x.id) === String(id),
  );
  if (updatedMeeting) {
    fetch("/api/dashboard/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedMeeting),
    }).catch((err) =>
      console.error("Gagal sync review reply ke backend:", err),
    );
  }

  toast("Balasan review berhasil dikirimkan ke Booking Page!");
  render();
  setTimeout(() => {
    openMeetingReviewModal(id);
  }, 200);
}
window.submitReviewReply = submitReviewReply;

// ----------------------------------------------------------------------
// HELPER GENERATE QR CODE SVG SECARA OFFLINE / STANDALONE
// ----------------------------------------------------------------------
function generateQrSvg(text, size = 210) {
  try {
    const qrc = window.qrcodegen || (typeof qrcodegen !== "undefined" ? qrcodegen : null);
    if (qrc && qrc.QrCode) {
      const qr = qrc.QrCode.encodeText(text, qrc.QrCode.Ecc.MEDIUM);
      const border = 2;
      const qrSize = qr.size + border * 2;
      let path = "";
      for (let y = 0; y < qr.size; y++) {
        for (let x = 0; x < qr.size; x++) {
          if (qr.getModule(x, y)) {
            path += `M${x + border},${y + border}h1v1h-1z `;
          }
        }
      }
      return `<svg viewBox="0 0 ${qrSize} ${qrSize}" width="${size}" height="${size}" style="display:block;border-radius:6px;shape-rendering:crispEdges;" role="img" aria-label="QR Code"><path fill="#ffffff" d="M0,0 h${qrSize}v${qrSize}H0z"/><path fill="#000000" d="${path}"/></svg>`;
    }
  } catch (e) {
    console.error("Local QR generation error:", e);
  }
  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(text)}`;
  return `<img src="${qrImgUrl}" alt="QR Code Rapat" style="width:${size}px;height:${size}px;display:block;border-radius:6px;" />`;
}
window.generateQrSvg = generateQrSvg;

// ----------------------------------------------------------------------
// MODAL QR CODE & BARCODE DINAMIS (SISTEM 1: PRESENSI MANDIRI TANPA ADMIN)
// ----------------------------------------------------------------------
function openMeetingQRModal(id) {
  let m = state.meetings.find((x) => String(x.id) === String(id));
  if (!m) {
    try {
      const stored = JSON.parse(
        getAppStorage().getItem("app_meetings") || "[]",
      );
      m = stored.find((x) => String(x.id) === String(id));
    } catch (e) {}
  }
  if (!m) {
    toast("Data rapat tidak ditemukan");
    return;
  }

  const meetingUrl = `${window.location.origin}/meeting/${m.id}`;
  const qrSvgHtml = generateQrSvg(meetingUrl, 195);

  let modalBackdrop = document.getElementById("modal");
  if (!modalBackdrop) {
    modalBackdrop = document.createElement("div");
    modalBackdrop.id = "modal";
    modalBackdrop.className = "modal-backdrop";
    document.body.appendChild(modalBackdrop);
  }

  const phoneSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1.5px;"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`;
  const closeSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  const pinSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1.5px;margin-right:2px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
  const calSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1.5px;margin-right:2px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
  const bulbSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>`;
  const camSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px;margin-right:4px;"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
  const userSvg = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1px;margin-right:2px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  const docSvg = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1px;margin-right:2px;"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`;

  modalBackdrop.innerHTML = `
    <style>
      .qr-custom-modal::-webkit-scrollbar { display: none; }
    </style>
    <div class="modal qr-custom-modal" style="max-width:440px;width:92%;margin:auto;max-height:calc(100vh - 30px);overflow-y:auto;scrollbar-width:none;-ms-overflow-style:none;text-align:center;padding:22px 24px;border-radius:24px;font-family:'Poppins',sans-serif;box-sizing:border-box;box-shadow:0 20px 48px rgba(12,45,94,0.16);background:#fff;">
      <!-- Header Bar -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="font-size:12px;font-weight:600;color:#0284c7;background:#e0f2fe;padding:4px 12px;border-radius:20px;display:inline-flex;align-items:center;gap:6px;">
          ${phoneSvg} <span>QR Presensi Mandiri</span>
        </span>
        <button type="button" onclick="closeModal()" style="background:#f1f5f9;border:none;width:28px;height:28px;border-radius:50%;color:#64748b;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:all 0.15s;" onmouseover="this.style.background='#e2e8f0';this.style.color='#0f172a'" onmouseout="this.style.background='#f1f5f9';this.style.color='#64748b'" title="Tutup">${closeSvg}</button>
      </div>

      <!-- Agenda Title & Details -->
      <h3 style="margin:4px 0 4px;font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.3px;line-height:1.2;">${esc(m.title)}</h3>
      <p style="margin:0 0 12px;font-size:12px;color:#64748b;display:flex;align-items:center;justify-content:center;gap:4px;flex-wrap:wrap;line-height:1.3;">
        <span>${pinSvg}${esc(m.room)}</span>
        <span style="color:#cbd5e1;margin:0 4px;">•</span>
        <span>${calSvg}${formatDate(m.date)} (${m.start} - ${m.end} WIB)</span>
      </p>

      <!-- Alert: Sistem Presensi Mandiri Otomatis -->
      <div style="background:#ebfbf0;border:1px solid #c7f3d6;border-radius:12px;padding:10px 14px;margin-bottom:12px;text-align:left;display:flex;align-items:center;gap:10px;">
        ${bulbSvg}
        <div style="font-size:11.5px;color:#166534;line-height:1.45;">
          <strong style="font-weight:700;">Presensi Otomatis:</strong> Scan QR di bawah untuk Check-In &amp; Check-Out mandiri.
        </div>
      </div>

      <!-- Single QR Code Container -->
      <div style="background:#ffffff;border:1.5px solid #edf2f7;border-radius:20px;padding:16px 14px 14px;display:flex;flex-direction:column;align-items:center;margin-bottom:12px;box-shadow:0 2px 10px rgba(0,0,0,0.02);">
        <div style="background:#ffffff;padding:8px;border-radius:16px;box-shadow:0 4px 16px rgba(12,45,94,0.05);border:1px solid #f1f5f9;margin-bottom:10px;display:flex;justify-content:center;align-items:center;">
          ${qrSvgHtml}
        </div>

        <div style="font-size:11.5px;color:#64748b;font-weight:500;display:flex;align-items:center;justify-content:center;margin-bottom:8px;">
          ${camSvg}Pindai dengan Kamera Smartphone:
        </div>
        <div style="display:flex;gap:5px;flex-wrap:nowrap;justify-content:center;align-items:center;width:100%;">
          <span style="background:#dcfce7;color:#15803d;padding:3.5px 8px;border-radius:6px;font-size:10.5px;font-weight:600;white-space:nowrap;display:inline-flex;align-items:center;gap:3px;">✓ Check-In</span>
          <span style="background:#e0f2fe;color:#0284c7;padding:3.5px 8px;border-radius:6px;font-size:10.5px;font-weight:600;white-space:nowrap;display:inline-flex;align-items:center;">${userSvg}Daftar Hadir</span>
          <span style="background:#fee2e2;color:#dc2626;padding:3.5px 8px;border-radius:6px;font-size:10.5px;font-weight:600;white-space:nowrap;display:inline-flex;align-items:center;">Check-Out</span>
          <span style="background:#f1f5f9;color:#475569;padding:3.5px 8px;border-radius:6px;font-size:10.5px;font-weight:600;white-space:nowrap;display:inline-flex;align-items:center;">${docSvg}Materi</span>
        </div>
      </div>

      <!-- URL Link & Copy Button -->
      <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:5px 6px 5px 12px;font-size:11.5px;color:#334155;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:monospace;flex:1;text-align:left;color:#64748b;font-size:11px;">${meetingUrl}</span>
        <button type="button" onclick="navigator.clipboard.writeText('${meetingUrl}'); toast('✓ Link QR Pass berhasil disalin!');" style="background:#2563eb;color:#fff;border:none;border-radius:8px;padding:6.5px 16px;font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0;transition:background 0.15s;" onmouseover="this.style.background='#1d4ed8'" onmouseout="this.style.background='#2563eb'">Salin</button>
      </div>

      <!-- Action Buttons -->
      <div style="display:flex;gap:8px;width:100%;">
        <a href="${meetingUrl}" target="_blank" style="flex:1.2;background:#16a34a;color:#fff;border:none;border-radius:10px;height:40px;font-size:12px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:4px;white-space:nowrap;transition:background 0.15s;padding:0 6px;box-sizing:border-box;" onmouseover="this.style.background='#15803d'" onmouseout="this.style.background='#16a34a'">
          <span>Buka Pass Rapat</span>
          <span style="font-size:13px;line-height:1;">↗</span>
        </a>
        <button type="button" onclick="window.open('${meetingUrl}', '_blank')" style="flex:1;background:#ffffff;color:#1e293b;border:1px solid #cbd5e1;border-radius:10px;height:40px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background 0.15s;padding:0 6px;box-sizing:border-box;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">
          Cetak Pass
        </button>
        <button type="button" onclick="closeModal()" style="flex:0.85;background:#f1f5f9;color:#475569;border:none;border-radius:10px;height:40px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background 0.15s;padding:0 6px;box-sizing:border-box;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">
          Tutup
        </button>
      </div>
    </div>
  `;

  modalBackdrop.onclick = function (e) {
    if (e.target === modalBackdrop) closeModal();
  };
  modalBackdrop.classList.add("show");
}
window.openMeetingQRModal = openMeetingQRModal;

// ----------------------------------------------------------------------
// SISTEM PEMBATALAN RAPAT DARURAT (EMERGENCY CANCELLATION SYSTEM)
// ----------------------------------------------------------------------
function openEmergencyCancelModal(id) {
  const m = state.meetings.find((x) => String(x.id) === String(id));
  if (!m) {
    alert("Data rapat tidak ditemukan.");
    return;
  }

  const modalHTML = `
    <div style="font-family:'Poppins',sans-serif;color:#0c2d5e;">
      <!-- Header Alert -->
      <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:14px;padding:16px;margin-bottom:18px;display:flex;align-items:flex-start;gap:12px;">
        <div style="width:40px;height:40px;border-radius:50%;background:#fee2e2;color:#dc2626;display:grid;place-items:center;font-size:20px;flex-shrink:0;">
          🚨
        </div>
        <div>
          <h4 style="margin:0 0 4px;font-size:16px;font-weight:800;color:#991b1b;">
            Sistem Pembatalan Darurat (Emergency Cancellation)
          </h4>
          <p style="margin:0;font-size:12.5px;color:#b91c1c;line-height:1.5;">
            Fasilitas ini digunakan untuk membatalkan rapat mendesak/darurat <b>walaupun jadwal sudah disetujui (Approved)</b>. Ruangan akan segera dikosongkan dan notifikasi darurat langsung dikirimkan ke pemesan.
          </p>
        </div>
      </div>

      <!-- Detail Jadwal Rapat -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:16px;">
        <div style="font-size:11.5px;font-weight:700;color:#1769aa;text-transform:uppercase;margin-bottom:2px;">📍 ${esc(m.room)}</div>
        <div style="font-size:15px;font-weight:700;color:#0c2d5e;margin-bottom:6px;">${esc(m.title)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12.5px;color:#475569;">
          <div>👤 Pemesan: <b>${esc(m.requester)}</b></div>
          <div>👥 Peserta: <b>${m.participants || "-"} orang</b></div>
          <div>📅 Tanggal: <b>${formatDate(m.date)}</b></div>
          <div>🕒 Waktu: <b>${m.start} - ${m.end}</b></div>
        </div>
        <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #cbd5e1;display:flex;align-items:center;gap:6px;font-size:12px;">
          <span>Status Rapat Saat Ini:</span> ${badge(m.status)}
        </div>
      </div>

      <!-- Pilihan Alasan Darurat Cepat -->
      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:13px;font-weight:700;color:#0c2d5e;margin-bottom:6px;">
          Pilih Kategori Alasan Darurat
        </label>
        <select id="emgCancelCategory" onchange="applyEmergencyReasonTemplate(this.value)" style="width:100%;padding:10px 14px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;color:#0c2d5e;outline:none;background:#fff;font-family:'Poppins',sans-serif;">
          <option value="pimpinan">Rapat Prioritas Pimpinan / Kepala Biro Keuangan & BMN</option>
          <option value="kementerian">Rapat Koordinasi Mendesak Tingkat Kementerian / Menteri</option>
          <option value="maintenance">Kendala Teknis / Perbaikan Sarana Darurat Ruangan (AC/Listrik)</option>
          <option value="custom">Alasan Lainnya (Ketik Manual)</option>
        </select>
      </div>

      <!-- Input Detail Alasan Pembatalan Darurat -->
      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:13px;font-weight:700;color:#0c2d5e;margin-bottom:6px;">
          Pesan Alasan Pembatalan ke Pemesan <span style="color:#e53e3e;">*</span>
        </label>
        <textarea id="emgCancelReason" rows="3" style="width:100%;padding:10px 14px;border:1.5px solid #fca5a5;border-radius:8px;font-size:13px;color:#0c2d5e;box-sizing:border-box;outline:none;font-family:'Poppins',sans-serif;line-height:1.5;" placeholder="Tuliskan alasan pembatalan darurat...">Ruangan dialihkan untuk kebutuhan Rapat Darurat Prioritas Pimpinan / Kepala Biro Keuangan & BMN. Jadwal pemesanan Anda dibatalkan secara darurat.</textarea>
      </div>

      <!-- Notifikasi Otomatis Box -->
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px 14px;margin-bottom:20px;font-size:12px;color:#1e40af;line-height:1.5;">
        <div style="font-weight:700;display:flex;align-items:center;gap:6px;margin-bottom:4px;">
          <span>📲</span> Notifikasi Otomatis yang Akan Dikirim:
        </div>
        <ul style="margin:0;padding-left:18px;">
          <li>Notifikasi sistem darurat terkirim langsung ke akun pemesan (<b>${esc(m.requester)}</b>).</li>
          <li>Slot jadwal pada Booking Page & Display Ruang otomatis kembali <b>Tersedia</b>.</li>
          <li>Sinkronisasi status pembatalan ke Google Calendar & Dashboard.</li>
        </ul>
      </div>

      <!-- Tombol Aksi Modal -->
      <div style="display:flex;justify-content:flex-end;gap:10px;border-top:1px solid #f1f5f9;padding-top:14px;">
        <button type="button" class="btn btn-light" onclick="closeModal()">
          Batal
        </button>
        <button type="button" onclick="confirmEmergencyCancel('${m.id}')" style="background:#dc2626;border:none;color:#ffffff;padding:10px 22px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 4px 12px rgba(220,38,38,0.25);">
          🚨 Batalkan Rapat &amp; Kirim Notifikasi
        </button>
      </div>
    </div>
  `;

  openModal("Sistem Pembatalan Darurat", modalHTML);
}
window.openEmergencyCancelModal = openEmergencyCancelModal;

window.applyEmergencyReasonTemplate = function (val) {
  const area = document.getElementById("emgCancelReason");
  if (!area) return;
  if (val === "pimpinan") {
    area.value =
      "Ruangan dialihkan untuk kebutuhan Rapat Darurat Prioritas Pimpinan / Kepala Biro Keuangan & BMN. Jadwal pemesanan Anda dibatalkan secara darurat.";
  } else if (val === "kementerian") {
    area.value =
      "Ruangan dialihkan untuk kebutuhan Rapat Koordinasi Mendesak Tingkat Kementerian Ketenagakerjaan RI.";
  } else if (val === "maintenance") {
    area.value =
      "Ruangan mendadak dalam pemeliharaan sarana darurat (AC/perangkat kelistrikan) demi keamanan dan kelancaran kegiatan.";
  } else {
    area.value = "";
    area.focus();
  }
};

async function confirmEmergencyCancel(id) {
  const m = state.meetings.find((x) => String(x.id) === String(id));
  if (!m) return;

  const reason =
    document.getElementById("emgCancelReason")?.value?.trim() ||
    "Ruangan dialihkan untuk rapat darurat prioritas pimpinan.";
  const currentUser = getCurrentUser() || { name: "Administrator" };

  // Update status rapat menjadi Dibatalkan
  m.status = "Dibatalkan";
  m.cancellationReason = reason;
  m.canceledBy = currentUser.name || "Administrator";
  m.canceledAt = new Date().toISOString();
  m.isEmergency = true;

  // 1. Simpan ke state.meetings & localStorage
  state.meetings = state.meetings.map((x) =>
    String(x.id) === String(id) ? { ...m } : x,
  );
  try {
    getAppStorage().setItem("app_meetings", JSON.stringify(state.meetings));
    localStorage.setItem("app_meetings", JSON.stringify(state.meetings));
  } catch (e) {}

  // 2. Kirim notifikasi sistem darurat ke antrean notifikasi (app_notifications)
  try {
    let notifs = [];
    const stored =
      getAppStorage().getItem("app_notifications") ||
      localStorage.getItem("app_notifications");
    if (stored) notifs = JSON.parse(stored);

    const cancelNotif = {
      id: "notif_cancel_" + Date.now(),
      meetingId: m.id,
      title: "🚨 PEMBATALAN DARURAT: " + m.title,
      room: m.room,
      requester: m.requester,
      date: m.date,
      start: m.start,
      end: m.end,
      status: "Dibatalkan",
      type: "CANCELED_PRIORITY",
      cancellationReason: reason,
      message: `Yth. ${m.requester || "Pemesan"}, pemesanan ruangan ${m.room} pada tanggal ${formatDate(m.date)} (${m.start} - ${m.end}) untuk agenda "${m.title}" TELAH DIBATALKAN DARURAT karena: ${reason}.`,
      createdAt: new Date().toISOString(),
      read: false,
      isEmergency: true,
    };

    // Update notifikasi lama yang terkait atau masukkan notifikasi baru di paling atas
    const existingIdx = notifs.findIndex(
      (n) => String(n.meetingId) === String(m.id),
    );
    if (existingIdx !== -1) {
      notifs[existingIdx] = { ...notifs[existingIdx], ...cancelNotif };
    } else {
      notifs.unshift(cancelNotif);
    }

    getAppStorage().setItem("app_notifications", JSON.stringify(notifs));
    localStorage.setItem("app_notifications", JSON.stringify(notifs));
  } catch (e) {
    console.error("Gagal simpan notifikasi:", e);
  }

  // 3. Dispatch real-time events
  window.dispatchEvent(new Event("app_meetings_updated"));
  window.dispatchEvent(new Event("app_notifications_updated"));
  try {
    if (window.parent && window.parent !== window) {
      window.parent.dispatchEvent(new Event("app_meetings_updated"));
      window.parent.dispatchEvent(new Event("app_notifications_updated"));
    }
  } catch (e) {}

  // 4. Kirim update ke backend API
  try {
    await fetch("/api/dashboard/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(m),
    });
  } catch (err) {
    console.error("Gagal sync pembatalan ke backend:", err);
  }

  closeModal();
  toast(
    "🚨 Rapat berhasil dibatalkan darurat dan notifikasi telah dikirimkan ke pemesan!",
  );
  render();
}
window.confirmEmergencyCancel = confirmEmergencyCancel;

function openReviewEditForm(id) {
  const m = state.meetings.find((x) => String(x.id) === String(id));
  if (!m) return;
  const rev = getMeetingReview(m) || {
    rating: 5,
    cleanliness: 5,
    facilities: 5,
    comfort: 5,
    service: 5,
    comment: "",
    reviewer: m.requester || "User Pemesan",
    tags: ["Fasilitas Lengkap", "Sangat Bersih"],
  };

  const formHTML = `
    <div style="font-family:'Poppins',sans-serif;color:#0c2d5e;">
      <p style="font-size:13px;color:#64748b;margin:0 0 16px;">
        Masukkan penilaian rating dan ulasan pengalaman pemakaian ruangan <b>${esc(m.room)}</b> untuk rapat <b>${esc(m.title)}</b>.
      </p>

      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;">Rating Keseluruhan (1 - 5 Bintang) <span style="color:#e53e3e;">*</span></label>
        <select id="revRatingInput" style="width:100%;padding:10px 14px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;font-weight:600;color:#0c2d5e;outline:none;">
          <option value="5" ${Math.round(rev.rating) === 5 ? "selected" : ""}>⭐⭐⭐⭐⭐ (5.0 - Sangat Memuaskan)</option>
          <option value="4" ${Math.round(rev.rating) === 4 ? "selected" : ""}>⭐⭐⭐⭐ (4.0 - Bagus & Memuaskan)</option>
          <option value="3" ${Math.round(rev.rating) === 3 ? "selected" : ""}>⭐⭐⭐ (3.0 - Cukup Baik)</option>
          <option value="2" ${Math.round(rev.rating) === 2 ? "selected" : ""}>⭐⭐ (2.0 - Kurang Memuaskan)</option>
          <option value="1" ${Math.round(rev.rating) === 1 ? "selected" : ""}>⭐ (1.0 - Sangat Kurang)</option>
        </select>
      </div>

      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;">Nama Pengulas / Pemesan</label>
        <input id="revReviewerInput" type="text" value="${esc(rev.reviewer || m.requester)}" style="width:100%;padding:10px 14px;border:1px solid #cbd5e1;border-radius:8px;font-size:13.5px;color:#0c2d5e;box-sizing:border-box;outline:none;">
      </div>

      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px;">Komentar & Ulasan Fasilitas Ruangan <span style="color:#e53e3e;">*</span></label>
        <textarea id="revCommentInput" rows="4" style="width:100%;padding:10px 14px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;color:#0c2d5e;box-sizing:border-box;outline:none;font-family:'Poppins',sans-serif;" placeholder="Tuliskan pengalaman penggunaan ruangan, kondisi fasilitas TV/Mic/AC, dll...">${esc(rev.comment || "")}</textarea>
      </div>

      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;padding-top:14px;border-top:1px solid #f1f5f9;">
        <button type="button" class="btn btn-light" onclick="openMeetingReviewModal('${m.id}')">Batal</button>
        <button type="button" class="btn btn-primary" onclick="submitMeetingReview('${m.id}')" style="background:#0c2d5e;border-color:#0c2d5e;padding:8px 22px;font-weight:700;">Simpan Review</button>
      </div>
    </div>
  `;

  openModal("Input / Edit Rating & Review", formHTML);
}
window.openReviewEditForm = openReviewEditForm;

async function submitMeetingReview(id) {
  const rating = Number(document.getElementById("revRatingInput")?.value) || 5;
  const reviewer =
    document.getElementById("revReviewerInput")?.value?.trim() ||
    "User Pemesan";
  const comment =
    document.getElementById("revCommentInput")?.value?.trim() || "";

  if (!comment) {
    alert("Harap masukkan komentar / ulasan fasilitas ruangan.");
    return;
  }

  const reviewObj = {
    rating: rating,
    cleanliness: rating,
    facilities: rating,
    comfort: rating,
    service: rating,
    comment: comment,
    reviewer: reviewer,
    submittedAt: new Date().toISOString(),
    tags:
      rating >= 4.5
        ? ["Fasilitas Lengkap", "Sangat Bersih", "Sangat Puas"]
        : ["Cukup Baik"],
  };

  state.meetings = state.meetings.map((m) => {
    if (String(m.id) === String(id)) {
      return {
        ...m,
        status: "Selesai",
        review: reviewObj,
      };
    }
    return m;
  });

  try {
    getAppStorage().setItem("app_meetings", JSON.stringify(state.meetings));
    localStorage.setItem("app_meetings", JSON.stringify(state.meetings));
  } catch (e) {}

  const updatedMeeting = state.meetings.find(
    (x) => String(x.id) === String(id),
  );
  if (updatedMeeting) {
    fetch("/api/dashboard/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedMeeting),
    }).catch((err) => console.error("Gagal sync review ke backend:", err));
  }

  toast("Rating & review ruangan berhasil disimpan!");
  render();
  setTimeout(() => {
    openMeetingReviewModal(id);
  }, 200);
}
window.submitMeetingReview = submitMeetingReview;

async function deleteMeeting(id) {
  if (!can("manageMeeting"))
    return denyAccess("Penghapusan rapat dilakukan oleh Admin.");
  if (confirm("Hapus rapat ini?")) {
    state.meetings = state.meetings.filter((x) => x.id !== id);
    render();
    toast("Rapat berhasil dihapus");

    try {
      await fetch(`/api/dashboard/meetings/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("Gagal menghapus di backend:", err);
    }
  }
}

// State foto ruangan saat modal dibuka
window._currentRoomImages = [];
window._activeRoomImageIndex = 0;

function renderRoomImagesGallery() {
  const wrap = document.getElementById("rGalleryWrap");
  if (!wrap) return;

  const images = window._currentRoomImages || [];
  if (images.length === 0) {
    wrap.innerHTML = `
      <div class="crm-upload-box" id="crmUploadBox" onclick="document.getElementById('rImageInput').click()" ondragover="event.preventDefault(); this.classList.add('dragover');" ondragleave="this.classList.remove('dragover');" ondrop="handleRoomImageDrop(event)">
        <div class="crm-upload-placeholder">
          <div class="crm-upload-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1769aa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
          </div>
          <div class="crm-upload-text">
            <strong>Klik atau seret foto ruangan ke sini untuk upload</strong>
            <small>Bisa memilih <b>lebih dari satu foto sekaligus</b> untuk berbagai sudut pandang/view ruangan (JPG, PNG, WebP maks. 5MB)</small>
          </div>
        </div>
      </div>
    `;
    return;
  }

  const activeIdx = Math.min(
    Math.max(0, window._activeRoomImageIndex || 0),
    images.length - 1,
  );
  window._activeRoomImageIndex = activeIdx;
  const activeImg = images[activeIdx];
  const total = images.length;

  wrap.innerHTML = `
    <div class="crm-gallery-wrapper">
      <!-- Main Active Image Display -->
      <div class="crm-main-preview-container">
        <img src="${activeImg}" alt="Preview View ${activeIdx + 1}" class="crm-main-img-preview">
        
        <div class="crm-main-badge">
          <span>View ${activeIdx + 1} dari ${total}</span>
          ${activeIdx === 0 ? '<span class="crm-tag-primary">★ Foto Utama</span>' : ""}
        </div>

        ${
          total > 1
            ? `
          <button type="button" class="crm-nav-btn prev" onclick="navigateRoomImage(-1)" title="Lihat View Sebelumnya">‹</button>
          <button type="button" class="crm-nav-btn next" onclick="navigateRoomImage(1)" title="Lihat View Selanjutnya">›</button>
        `
            : ""
        }

        <div class="crm-main-actions">
          ${
            activeIdx !== 0
              ? `<button type="button" class="crm-act-btn" onclick="setPrimaryRoomImage(${activeIdx})" title="Jadikan sebagai foto utama">★ Jadikan Foto Utama</button>`
              : ""
          }
          <button type="button" class="crm-act-btn danger" onclick="removeRoomImage(${activeIdx})" title="Hapus foto view ini">🗑 Hapus Foto</button>
        </div>
      </div>

      <!-- Thumbnails Grid & Add Button -->
      <div class="crm-thumbs-bar">
        <div class="crm-thumbs-list">
          ${images
            .map(
              (img, idx) => `
            <div class="crm-thumb-item ${idx === activeIdx ? "active" : ""}" onclick="selectRoomImage(${idx})" title="View ${idx + 1}${idx === 0 ? " (Foto Utama)" : ""}">
              <img src="${img}" alt="Thumb ${idx + 1}">
              ${idx === 0 ? '<span class="crm-thumb-star">★</span>' : ""}
              <button type="button" class="crm-thumb-del" onclick="event.stopPropagation(); removeRoomImage(${idx})" title="Hapus foto">&times;</button>
            </div>
          `,
            )
            .join("")}

          <!-- Tombol Tambah View Foto Lain -->
          <div class="crm-thumb-add" onclick="document.getElementById('rImageInput').click()" title="Tambah view foto ruangan lain">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1769aa" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>+ View Lain</span>
          </div>
        </div>
      </div>
    </div>
  `;
}
window.renderRoomImagesGallery = renderRoomImagesGallery;

function handleRoomImageUpload(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;
  processMultipleRoomImageFiles(Array.from(files));
  event.target.value = "";
}
window.handleRoomImageUpload = handleRoomImageUpload;

function handleRoomImageDrop(event) {
  event.preventDefault();
  const box = document.getElementById("crmUploadBox");
  if (box) box.classList.remove("dragover");
  const files = event.dataTransfer && event.dataTransfer.files;
  if (!files || files.length === 0) return;
  processMultipleRoomImageFiles(Array.from(files));
}
window.handleRoomImageDrop = handleRoomImageDrop;

function processMultipleRoomImageFiles(files) {
  const validFiles = files.filter((f) => {
    if (!f.type.startsWith("image/")) {
      alert(`File "${f.name}" bukan gambar yang valid (JPG, PNG, WebP)`);
      return false;
    }
    if (f.size > 5 * 1024 * 1024) {
      alert(`Ukuran file "${f.name}" melebihi batas 5MB`);
      return false;
    }
    return true;
  });

  if (validFiles.length === 0) return;

  let loaded = 0;
  validFiles.forEach((file) => {
    const reader = new FileReader();
    reader.onload = function (e) {
      window._currentRoomImages.push(e.target.result);
      loaded++;
      if (loaded === validFiles.length) {
        window._activeRoomImageIndex = window._currentRoomImages.length - 1;
        renderRoomImagesGallery();
        toast(`${validFiles.length} foto view ruangan berhasil ditambahkan`);
      }
    };
    reader.readAsDataURL(file);
  });
}
window.processMultipleRoomImageFiles = processMultipleRoomImageFiles;

function selectRoomImage(index) {
  window._activeRoomImageIndex = index;
  renderRoomImagesGallery();
}
window.selectRoomImage = selectRoomImage;

function navigateRoomImage(direction) {
  const len = window._currentRoomImages.length;
  if (len <= 1) return;
  window._activeRoomImageIndex =
    (window._activeRoomImageIndex + direction + len) % len;
  renderRoomImagesGallery();
}
window.navigateRoomImage = navigateRoomImage;

function setPrimaryRoomImage(index) {
  if (index <= 0 || index >= window._currentRoomImages.length) return;
  const [target] = window._currentRoomImages.splice(index, 1);
  window._currentRoomImages.unshift(target);
  window._activeRoomImageIndex = 0;
  renderRoomImagesGallery();
  toast("Foto utama berhasil diubah");
}
window.setPrimaryRoomImage = setPrimaryRoomImage;

function removeRoomImage(index) {
  if (index < 0 || index >= window._currentRoomImages.length) return;
  window._currentRoomImages.splice(index, 1);
  if (window._activeRoomImageIndex >= window._currentRoomImages.length) {
    window._activeRoomImageIndex = Math.max(
      0,
      window._currentRoomImages.length - 1,
    );
  }
  renderRoomImagesGallery();
  toast("Foto view ruangan dihapus");
}
window.removeRoomImage = removeRoomImage;

function getFacilitySvgIcon(label) {
  const norm = (label || "").toLowerCase();
  if (
    norm.includes("kapasitas") ||
    norm.includes("peserta") ||
    norm.includes("orang")
  ) {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
  }
  if (
    norm.includes("tv") ||
    norm.includes("monitor") ||
    norm.includes("layar")
  ) {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;
  }
  if (
    norm.includes("ac") ||
    norm.includes("air") ||
    norm.includes("pendingin")
  ) {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/><path d="M7 17v2"/><path d="M12 17v3"/><path d="M17 17v2"/></svg>`;
  }
  if (
    norm.includes("mic") ||
    norm.includes("sound") ||
    norm.includes("audio")
  ) {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
  }
  if (norm.includes("speaker")) {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
  }
  if (
    norm.includes("dispenser") ||
    norm.includes("minum") ||
    norm.includes("water")
  ) {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`;
  }
  if (
    norm.includes("stopkontak") ||
    norm.includes("stop kontak") ||
    norm.includes("plug") ||
    norm.includes("colokan") ||
    norm.includes("outlet")
  ) {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a6 6 0 0 1-12 0V8z"/></svg>`;
  }
  if (
    norm.includes("kabel") ||
    norm.includes("cable") ||
    norm.includes("hdmi") ||
    norm.includes("vga")
  ) {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="6" height="7" rx="1"/><rect x="14" y="2" width="6" height="7" rx="1"/><path d="M7 9v4a5 5 0 0 0 10 0V9"/><line x1="12" y1="18" x2="12" y2="22"/></svg>`;
  }
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
}

function renderFacilityRowHTML(fac, isCustom = false) {
  const label = fac.label || "";
  let rawVal = fac.value || "";
  let status = fac.status || "";
  if (!status) {
    if (rawVal.trim().toLowerCase() === "tidak tersedia") {
      status = "Tidak Tersedia";
    } else {
      status = "Tersedia";
    }
  }
  // Jangan masukkan kata "Tersedia" atau "Tidak Tersedia" ke dalam input spesifikasi barang
  if (
    rawVal.trim().toLowerCase() === "tersedia" ||
    rawVal.trim().toLowerCase() === "tidak tersedia"
  ) {
    rawVal = "";
  }
  const iconSvg = getFacilitySvgIcon(label);
  const isTersedia = status === "Tersedia";
  const isTidakTersedia = status === "Tidak Tersedia";

  return `
    <div class="crm-facility-row">
      <div class="crm-fac-left">
        <div class="crm-fac-icon-box">
          ${iconSvg}
        </div>
        <div class="crm-fac-label-box">
          ${
            isCustom
              ? `<input type="text" class="crm-fac-label-input" value="${esc(label)}" placeholder="Nama Kategori" oninput="updateFacilityRowIcon(this)">`
              : `<span class="crm-fac-label-text" title="${esc(label)}">${esc(label)}</span><input type="hidden" class="crm-fac-label-input" value="${esc(label)}">`
          }
        </div>
      </div>
      <div class="crm-fac-right">
        <input type="text" class="crm-fac-val-input" value="${esc(rawVal)}" placeholder="Nama fasilitas / detail (opsional)">
        <input type="hidden" class="crm-fac-status-input" value="${status}">
        <div class="crm-fac-pills">
          <button type="button" class="crm-fac-pill ${isTersedia ? "active" : ""}" onclick="setFacStatus(this, 'Tersedia')" title="Tandai Tersedia">Tersedia</button>
          <button type="button" class="crm-fac-pill danger ${isTidakTersedia ? "active" : ""}" onclick="setFacStatus(this, 'Tidak Tersedia')" title="Tandai Tidak Tersedia">Tidak Tersedia</button>
        </div>
        <button type="button" class="crm-fac-remove-btn" onclick="removeFacilityRow(this)" title="Hapus Fasilitas">&times;</button>
      </div>
    </div>
  `;
}

window.setFacStatus = function (btn, newStatus) {
  const row = btn.closest(".crm-facility-row");
  if (!row) return;
  const statusInput = row.querySelector(".crm-fac-status-input");
  if (statusInput) statusInput.value = newStatus;
  const pills = row.querySelectorAll(".crm-fac-pill");
  pills.forEach((p) => {
    const isTersediaBtn = p.textContent.trim().toLowerCase() === "tersedia";
    if (newStatus === "Tersedia") {
      if (isTersediaBtn) p.classList.add("active");
      else p.classList.remove("active");
    } else {
      if (!isTersediaBtn) p.classList.add("active");
      else p.classList.remove("active");
    }
  });
};

window.addCustomFacilityRow = function () {
  const list = document.getElementById("crmFacilityList");
  if (!list) return;
  const div = document.createElement("div");
  div.innerHTML = renderFacilityRowHTML(
    { label: "", value: "", status: "Tersedia" },
    true,
  );
  const row = div.firstElementChild;
  list.appendChild(row);
  const labelInput = row.querySelector(".crm-fac-label-input");
  if (labelInput) labelInput.focus();
};

window.removeFacilityRow = function (btn) {
  const row = btn.closest(".crm-facility-row");
  if (row) row.remove();
};

window.updateFacilityRowIcon = function (input) {
  const row = input.closest(".crm-facility-row");
  if (!row) return;
  const iconBox = row.querySelector(".crm-fac-icon-box");
  if (iconBox) {
    iconBox.innerHTML = getFacilitySvgIcon(input.value);
  }
};

function openRoomModal(id = null) {
  if (!can("manageRoom"))
    return denyAccess("Pengelolaan ruangan dilakukan oleh Admin.");
  const isEdit = id !== null && id !== undefined;
  const r = isEdit
    ? state.rooms.find((x) => x.id === id)
    : {
        name: "",
        location: "",
        capacity: "",
        status: "Tersedia",
        facilities: [],
        image: "",
        images: [],
      };

  if (isEdit && r) {
    if (Array.isArray(r.images) && r.images.length > 0) {
      window._currentRoomImages = [...r.images];
    } else if (r.image && !r.image.includes("unsplash")) {
      window._currentRoomImages = [r.image];
    } else {
      const defaultImg = getRoomImage(r);
      window._currentRoomImages = defaultImg ? [defaultImg] : [];
    }
  } else {
    // Tambah Ruangan: WAJIB KOSONG di awal
    window._currentRoomImages = [];
  }
  window._activeRoomImageIndex = 0;

  // Kategori fasilitas standar persis sesuai dengan yang ada pada Booking Page
  const isKonsultasi = (r.name || "").toLowerCase().includes("konsultasi");
  const standardFacilityCategories = [
    {
      label: "Kapasitas",
      defaultVal: r.capacity ? String(r.capacity) : "20",
      status: "Tersedia",
    },
    {
      label: "TV",
      defaultVal: isKonsultasi ? "Smart TV 60 inch" : "Smart TV 85 inch",
      status: "Tersedia",
    },
    { label: "AC", defaultVal: "", status: "Tersedia" },
    {
      label: "Microphone",
      defaultVal: isKonsultasi ? "" : "6 mic",
      status: isKonsultasi ? "Tidak Tersedia" : "Tersedia",
    },
    {
      label: "Speaker",
      defaultVal: "",
      status: isKonsultasi ? "Tidak Tersedia" : "Tersedia",
    },
    {
      label: "Dispenser",
      defaultVal: "",
      status: isKonsultasi ? "Tidak Tersedia" : "Tersedia",
    },
    { label: "Stopkontak", defaultVal: "", status: "Tersedia" },
    { label: "Kabel", defaultVal: "HDMI", status: "Tersedia" },
  ];

  let currentFacilities = [];
  if (isEdit && r && Array.isArray(r.facilities) && r.facilities.length > 0) {
    currentFacilities = r.facilities.map((f) => {
      let rawVal = f.value || "";
      let status = f.status || "";
      if (!status) {
        if (rawVal.trim().toLowerCase() === "tidak tersedia") {
          status = "Tidak Tersedia";
        } else {
          status = "Tersedia";
        }
      }
      if (
        rawVal.trim().toLowerCase() === "tersedia" ||
        rawVal.trim().toLowerCase() === "tidak tersedia"
      ) {
        rawVal = "";
      }
      return {
        label: f.label || "",
        value: rawVal,
        status: status,
      };
    });
  } else if (
    isEdit &&
    r &&
    typeof r.facilities === "string" &&
    r.facilities.trim()
  ) {
    const parsedFromStr = r.facilities
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    currentFacilities = standardFacilityCategories.map((std) => {
      const match = parsedFromStr.find((p) =>
        p.toLowerCase().includes(std.label.toLowerCase()),
      );
      return {
        label: std.label,
        value: match || std.defaultVal,
        status: std.status,
      };
    });
    parsedFromStr.forEach((p) => {
      const exists = standardFacilityCategories.some((std) =>
        p.toLowerCase().includes(std.label.toLowerCase()),
      );
      if (!exists) {
        currentFacilities.push({ label: p, value: "", status: "Tersedia" });
      }
    });
  } else {
    // Tambah Ruangan: template kategori tetap sama, namun nama/spesifikasi fasilitas dibuat kosong
    currentFacilities = standardFacilityCategories.map((std) => ({
      label: std.label,
      value: "",
      status: "Tersedia",
    }));
  }

  const modalBackdrop = document.getElementById("modal");
  modalBackdrop.innerHTML = `
    <div class="custom-room-modal" onclick="event.stopPropagation()">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 20px;">
        <div>
          <h2 style="margin:0 0 4px; font-size:22px; font-weight:800; color:#0c2d5e;">
            ${id ? "Edit Ruangan" : "Tambah Ruangan"}
          </h2>
          <p style="margin:0; font-size:13px; color:#4b6a90;">
            Kelola data ruangan, fasilitas, dan unggah berbagai foto sudut pandang/view ruangan
          </p>
        </div>
        <button type="button" onclick="closeModal()" style="background:none; border:none; font-size:26px; color:#a0aec0; cursor:pointer; line-height:1; padding:0 4px;" title="Tutup">&times;</button>
      </div>

      <div class="crm-field full">
        <label style="display:flex; justify-content:space-between; align-items:center;">
          <span>Foto Ruangan (Mendukung Multi-View)</span>
          <span style="font-size:12px; font-weight:500; color:#1769aa;">Bisa unggah lebih dari 1 foto</span>
        </label>
        <input type="file" id="rImageInput" accept="image/*" multiple style="display:none;" onchange="handleRoomImageUpload(event)">
        <div id="rGalleryWrap"></div>
      </div>

      <div class="crm-field full">
        <label>Nama Ruangan <span style="color:#e53e3e;">*</span></label>
        <input id="rName" value="${esc(r.name)}" placeholder="Contoh: Ruang Rapat Utama">
      </div>
      <div class="crm-row">
        <div class="crm-field">
          <label>Lokasi</label>
          <input id="rLocation" value="${esc(r.location)}" placeholder="Contoh: Gedung A - Lantai 3">
        </div>
        <div class="crm-field">
          <label>Kapasitas</label>
          <input id="rCapacity" type="number" value="${r.capacity || ""}" placeholder="Contoh: 20">
        </div>
      </div>
      <div class="crm-field full">
        <label>Status Ruangan</label>
        <select id="rStatus">
          <option value="Tersedia" ${r.status === "Tersedia" ? "selected" : ""}>Tersedia</option>
          <option value="Sedang Digunakan" ${r.status === "Sedang Digunakan" || r.status === "Terpakai" ? "selected" : ""}>Sedang Digunakan</option>
          <option value="Dalam Perbaikan" ${r.status === "Dalam Perbaikan" || r.status === "Perbaikan" ? "selected" : ""}>Dalam Perbaikan</option>
        </select>
      </div>

      <div class="crm-field full" style="margin-top: 14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div>
            <label style="margin:0 0 2px; font-size:13.5px; font-weight:700; color:#0c2d5e;">Daftar Fasilitas Ruangan</label>
            <small style="color:#718dae; font-size:12px;">Pilih status ketersediaan fasilitas (barang berstatus Tidak Tersedia tidak ditampilkan di Booking Page)</small>
          </div>
          <button type="button" class="crm-btn-add-fac" onclick="addCustomFacilityRow()" title="Tambah kategori fasilitas kustom">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>Tambah Kategori</span>
          </button>
        </div>
        <div id="crmFacilityList" class="crm-facility-list-wrap">
          ${currentFacilities
            .map((fac) =>
              renderFacilityRowHTML(
                fac,
                !standardFacilityCategories.some(
                  (s) => s.label.toLowerCase() === fac.label.toLowerCase(),
                ),
              ),
            )
            .join("")}
        </div>
      </div>

      <div class="crm-actions">
        <button type="button" class="crm-btn-cancel" onclick="closeModal()">Batal</button>
        <button type="button" class="crm-btn-save" onclick="saveRoom(${id || "null"})">Simpan Ruangan</button>
      </div>
    </div>
  `;
  modalBackdrop.onclick = function (e) {
    if (e.target === modalBackdrop) closeModal();
  };
  modalBackdrop.classList.add("show");
  renderRoomImagesGallery();

  // Sinkronisasi otomatis kapasitas input dengan fasilitas "Kapasitas"
  const capInput = document.getElementById("rCapacity");
  if (capInput) {
    capInput.addEventListener("input", (e) => {
      const capVal = e.target.value;
      const rows = document.querySelectorAll(
        "#crmFacilityList .crm-facility-row",
      );
      rows.forEach((row) => {
        const labelText =
          row.querySelector(".crm-fac-label-input")?.value ||
          row.querySelector(".crm-fac-label-text")?.textContent ||
          "";
        if (labelText.toLowerCase().includes("kapasitas")) {
          const valInput = row.querySelector(".crm-fac-val-input");
          if (valInput && (!valInput.value || /^\d+/.test(valInput.value))) {
            valInput.value = capVal ? capVal : "";
          }
        }
      });
    });
  }
}

async function saveRoom(id) {
  const name = f("rName").trim();
  if (!name) {
    alert("Nama ruangan tidak boleh kosong");
    return;
  }
  const images =
    window._currentRoomImages && window._currentRoomImages.length > 0
      ? [...window._currentRoomImages]
      : id
        ? state.rooms.find((x) => x.id === id)?.images || [
            getRoomImage({ name }),
          ]
        : [getRoomImage({ name })];
  const primaryImage = images[0] || getRoomImage({ name });

  // Ambil seluruh baris fasilitas dari list
  const facRows = document.querySelectorAll(
    "#crmFacilityList .crm-facility-row",
  );
  const facilitiesList = Array.from(facRows)
    .map((row) => {
      const labelInput = row.querySelector(".crm-fac-label-input");
      const labelText = row.querySelector(".crm-fac-label-text");
      const valInput = row.querySelector(".crm-fac-val-input");
      const statusInput = row.querySelector(".crm-fac-status-input");
      const label = labelInput
        ? labelInput.value.trim()
        : labelText
          ? labelText.textContent.trim()
          : "";
      const val = valInput ? valInput.value.trim() : "";
      const status = statusInput ? statusInput.value.trim() : "Tersedia";
      return { label, value: val, status: status };
    })
    .filter((f) => f.label);

  const obj = {
    id: id || Date.now(),
    name: name,
    location: f("rLocation") || "Gedung A - Lantai 3",
    capacity: Number(f("rCapacity")) || 10,
    status: f("rStatus") || "Tersedia",
    facilities: facilitiesList,
    image: primaryImage,
    images: images,
  };

  if (id) {
    state.rooms = state.rooms.map((x) => (x.id === id ? { ...x, ...obj } : x));
  } else {
    state.rooms.push(obj);
  }

  try {
    getAppStorage().setItem("app_rooms", JSON.stringify(state.rooms));
  } catch (e) {}

  try {
    localStorage.setItem("app_rooms", JSON.stringify(state.rooms));
  } catch (e) {}

  closeModal();
  render();
  toast("Data ruangan & fasilitas berhasil disimpan");

  try {
    await fetch("/api/dashboard/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(obj),
    });
  } catch (err) {
    console.error("Gagal menyimpan ruangan ke backend:", err);
  }
}

function editRoom(id) {
  if (!can("manageRoom")) {
    viewRoomDetail(id);
    return;
  }
  openRoomModal(id);
}

// Detail ruangan read-only (untuk Pimpinan / role tanpa hak kelola ruangan)
function viewRoomDetail(id) {
  const r = state.rooms.find((x) => String(x.id) === String(id));
  if (!r) return;
  const facilities = Array.isArray(r.facilities) ? r.facilities : [];
  const today = getTodayIsoDate();
  const todays = state.meetings
    .filter((m) => m.room === r.name && m.date === today)
    .sort((a, b) => (a.start || "").localeCompare(b.start || ""));

  openModal(
    "Detail Ruangan",
    `<img src="${getRoomImage(r)}" alt="${esc(r.name)}" style="width:100%;height:190px;object-fit:cover;border-radius:10px;margin-bottom:14px;">
    <p style="font-size:17px;font-weight:700;color:#0c2d5e;margin:0 0 4px;">${esc(r.name)}</p>
    <p class="muted" style="margin:0 0 12px;">📍 ${esc(r.location || "-")} · 👥 Kapasitas ${esc(r.capacity || "-")} orang · ${badge(r.status || "Tersedia")}</p>
    ${
      facilities.length
        ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 14px;margin-bottom:14px;font-size:12.5px;">${facilities
            .map(
              (f) =>
                `<div><b style="color:#0c2d5e;">${esc(f.label)}:</b> <span style="color:#4b6a90;">${esc(f.value)}</span></div>`,
            )
            .join("")}</div>`
        : ""
    }
    <p style="font-weight:700;color:#0c2d5e;margin:6px 0;">Jadwal Hari Ini</p>
    ${
      todays.length
        ? todays
            .map(
              (m) =>
                `<div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid #eef3f9;font-size:12.5px;"><span><b>${m.start}-${m.end}</b> · ${esc(m.title)}</span>${badge(m.status)}</div>`,
            )
            .join("")
        : `<p class="muted" style="font-size:12.5px;">Tidak ada jadwal hari ini.</p>`
    }
    <div class="modal-actions" style="margin-top:14px;display:flex;justify-content:flex-end;"><button class="btn btn-light" onclick="closeModal()">Tutup</button></div>`,
  );
}

function openUserModal(id = null) {
  if (!isMainAdmin()) {
    alert(
      "Hanya Admin Utama yang berhak menambah atau mengubah data pengguna.",
    );
    return;
  }

  let u = {
    name: "",
    username: "",
    password: "",
    email: "",
    dept: "",
    role: "User",
    status: "Aktif",
  };
  if (id !== null && id !== undefined) {
    const found = state.users.find((x) => x.id === id);
    if (found) {
      u = { ...found };
      try {
        const loginUsers = JSON.parse(
          getAppStorage().getItem("app_login_users") || "[]",
        );
        const lu = loginUsers.find(
          (x) =>
            x.id === id ||
            (x.username &&
              found.username &&
              x.username.toLowerCase() === found.username.toLowerCase()),
        );
        if (lu) {
          u.username = lu.username || u.username || "";
          u.password = lu.password || u.password || "";
        }
      } catch (e) {}
    }
  }

  const isEditingAdmin =
    id && (u.username === "admin" || u.name === "Admin Utama");

  const modalBackdrop = document.getElementById("modal");
  modalBackdrop.innerHTML = `
    <div class="custom-user-modal" style="width: min(540px, 94vw); background: #ffffff !important; border-radius: 20px; padding: 32px 36px 36px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28); font-family: 'Poppins', sans-serif; box-sizing: border-box; position: relative; z-index: 10000;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 22px;">
        <div>
          <h2 style="margin:0 0 4px; font-size:22px; font-weight:800; color:#0c2d5e;">
            ${id ? "Edit Pengguna" : "Tambah Pengguna Baru"}
          </h2>
          <p style="margin:0; font-size:13px; color:#4b6a90;">
            ${id ? "Perbarui informasi akun dan kredensial login" : "Tambahkan pengguna baru yang dapat login ke sistem"}
          </p>
        </div>
        <button type="button" onclick="closeModal()" style="background:none; border:none; font-size:26px; color:#a0aec0; cursor:pointer; line-height:1; padding:0 4px;" title="Tutup">&times;</button>
      </div>

      <div class="crm-field full">
        <label>Nama Lengkap <span style="color:#e53e3e;">*</span></label>
        <input id="uName" value="${esc(u.name || "")}" placeholder="Contoh: Budi Santoso">
      </div>

      <div class="crm-row">
        <div class="crm-field">
          <label>Username (Untuk Login) <span style="color:#e53e3e;">*</span></label>
          <input id="uUsername" value="${esc(u.username || "")}" placeholder="Contoh: budi123" ${isEditingAdmin ? "readonly style='background:#e2e8f0; cursor:not-allowed;'" : ""}>
        </div>
        <div class="crm-field">
          <label>Password (Untuk Login) ${id ? '<span style="font-size:11px;color:#718096;font-weight:normal;">(Opsional, kosongkan jika tidak diubah)</span>' : '<span style="color:#e53e3e;">*</span>'}</label>
          <input id="uPassword" type="password" placeholder="${id ? "Kosongkan jika tidak ingin mengubah password" : "Masukkan password"}">
        </div>
      </div>

      <div class="crm-row">
        <div class="crm-field">
          <label>Email</label>
          <input id="uEmail" type="email" value="${esc(u.email || "")}" placeholder="Contoh: budi@kemnaker.go.id">
        </div>
        <div class="crm-field">
          <label>Unit / Jabatan</label>
          <input id="uDept" value="${esc(u.dept || "")}" placeholder="Contoh: Biro Keuangan dan BMN">
        </div>
      </div>

      <div class="crm-row">
        <div class="crm-field">
          <label>Role Akun</label>
          <select id="uRole" ${isEditingAdmin ? "disabled style='background:#e2e8f0; cursor:not-allowed;'" : ""}>
            ${[
              { value: "User", label: "User" },
              { value: "Admin", label: "Admin" },
              { value: "Pimpinan", label: "Pimpinan" },
            ]
              .map(
                (r) =>
                  `<option value="${r.value}" ${getRoleLabel(u.role) === r.value ? "selected" : ""}>${r.label}</option>`,
              )
              .join("")}
          </select>
        </div>
        <div class="crm-field">
          <label>Status Akun</label>
          <select id="uStatus" ${isEditingAdmin ? "disabled style='background:#e2e8f0; cursor:not-allowed;'" : ""}>
            <option value="Aktif" ${u.status === "Aktif" ? "selected" : ""}>Aktif</option>
            <option value="Nonaktif" ${u.status === "Nonaktif" ? "selected" : ""}>Nonaktif</option>
          </select>
        </div>
      </div>

      <div class="crm-actions" style="margin-top: 24px;">
        <button type="button" class="crm-btn-cancel" onclick="closeModal()">Batal</button>
        <button type="button" class="crm-btn-save" onclick="saveUser(${id ? (typeof id === "string" ? `'${id}'` : id) : "null"})">
          ${id ? "Simpan Perubahan" : "Tambah Pengguna"}
        </button>
      </div>
    </div>
  `;
  modalBackdrop.onclick = function (e) {
    if (e.target === modalBackdrop) closeModal();
  };
  modalBackdrop.classList.add("show");
}

async function saveUser(id) {
  if (!isMainAdmin()) {
    alert(
      "Hanya Admin Utama yang berhak menambah atau mengubah data pengguna.",
    );
    return;
  }

  const name = (document.getElementById("uName")?.value || "").trim();
  const username = (document.getElementById("uUsername")?.value || "").trim();
  const password = (document.getElementById("uPassword")?.value || "").trim();
  const email = (document.getElementById("uEmail")?.value || "").trim();
  const dept =
    (document.getElementById("uDept")?.value || "").trim() ||
    "Biro Keuangan dan BMN";
  const roleEl = document.getElementById("uRole");
  const role = roleEl ? roleEl.value : "User";
  const statusEl = document.getElementById("uStatus");
  const status = statusEl ? statusEl.value : "Aktif";

  if (!name) {
    alert("Nama lengkap tidak boleh kosong!");
    return;
  }
  if (!username) {
    alert("Username untuk login tidak boleh kosong!");
    return;
  }
  if (!id && !password) {
    alert("Password untuk login tidak boleh kosong!");
    return;
  }

  const lowerUsername = username.toLowerCase();
  let loginUsers = [];
  try {
    loginUsers = JSON.parse(getAppStorage().getItem("app_login_users") || "[]");
  } catch (e) {}

  const currentEditing = id ? state.users.find((x) => x.id === id) : null;
  const oldUsername = (currentEditing?.username || "").toLowerCase();

  // Cek duplikasi jika membuat akun baru atau mengganti username
  if (!id || oldUsername !== lowerUsername) {
    const isDuplicateInState = state.users.some(
      (u) =>
        (id ? u.id !== id : true) &&
        (u.username || "").toLowerCase() === lowerUsername,
    );
    const isDuplicateInLogin = loginUsers.some(
      (u) =>
        (id ? u.id !== id : true) &&
        (u.username || "").toLowerCase() === lowerUsername,
    );
    const defaultReserved = ["admin", "approval1", "approval2"];
    if (
      isDuplicateInState ||
      isDuplicateInLogin ||
      (defaultReserved.includes(lowerUsername) && lowerUsername !== oldUsername)
    ) {
      alert(
        `Username "${username}" sudah digunakan! Silakan pilih username yang lain.`,
      );
      return;
    }
  }

  const userId = id || "user_" + Date.now();
  const userObj = {
    id: userId,
    name: name,
    username: username,
    email: email || `${lowerUsername}@kemnaker.go.id`,
    dept: dept,
    role: role,
    status: status,
  };
  if (password) {
    userObj.password = password;
  }

  if (id) {
    state.users = state.users.map((x) =>
      x.id === id ? { ...x, ...userObj } : x,
    );
  } else {
    state.users.push(userObj);
  }

  try {
    getAppStorage().setItem("app_users", JSON.stringify(state.users));
  } catch (e) {}

  try {
    let allLogin = JSON.parse(
      getAppStorage().getItem("app_login_users") || "[]",
    );
    const existingIdx = allLogin.findIndex(
      (x) =>
        x.id === userId ||
        (x.username && x.username.toLowerCase() === lowerUsername),
    );
    if (existingIdx >= 0) {
      allLogin[existingIdx] = userObj;
    } else {
      allLogin.push(userObj);
    }
    getAppStorage().setItem("app_login_users", JSON.stringify(allLogin));
  } catch (e) {}

  try {
    let savedAcc = JSON.parse(getAppStorage().getItem("savedAccounts") || "[]");
    const accData = {
      username: username,
      name: name,
      role: role,
      email: email,
      dept: dept,
    };
    const sIdx = savedAcc.findIndex(
      (x) => (x.username || "").toLowerCase() === lowerUsername,
    );
    if (sIdx >= 0) {
      if (status === "Nonaktif") {
        savedAcc.splice(sIdx, 1);
      } else {
        savedAcc[sIdx] = accData;
      }
    } else if (status === "Aktif") {
      savedAcc.push(accData);
    }
    getAppStorage().setItem("savedAccounts", JSON.stringify(savedAcc));
  } catch (e) {}

  try {
    const res = await fetch("/api/dashboard/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userObj),
    });
    if (res.ok) {
      await fetchDashboardData(false);
    }
  } catch (err) {
    console.warn("Gagal simpan pengguna ke database server:", err);
  }

  closeModal();
  render();
  toast(
    id
      ? "Data pengguna berhasil diperbarui"
      : "Pengguna baru berhasil ditambahkan dan dapat login",
  );
}

function editUser(id) {
  if (!isMainAdmin()) {
    alert("Hanya Admin Utama yang berhak mengubah data pengguna.");
    return;
  }
  openUserModal(id);
}

async function deleteUser(id) {
  if (!isMainAdmin()) {
    alert("Hanya Admin Utama yang berhak menghapus pengguna.");
    return;
  }
  const target = state.users.find((x) => x.id === id);
  if (!target) return;

  if (target.username === "admin" || target.name === "Admin Utama") {
    alert("Akun Admin Utama tidak dapat dihapus!");
    return;
  }

  if (
    confirm(
      `Hapus pengguna "${target.name}"? Pengguna ini tidak akan dapat login lagi.`,
    )
  ) {
    state.users = state.users.filter((x) => x.id !== id);

    try {
      getAppStorage().setItem("app_users", JSON.stringify(state.users));
    } catch (e) {}

    try {
      let allLogin = JSON.parse(
        getAppStorage().getItem("app_login_users") || "[]",
      );
      allLogin = allLogin.filter(
        (x) =>
          x.id !== id &&
          (x.username || "").toLowerCase() !==
            (target.username || "").toLowerCase(),
      );
      getAppStorage().setItem("app_login_users", JSON.stringify(allLogin));
    } catch (e) {}

    try {
      let savedAcc = JSON.parse(
        getAppStorage().getItem("savedAccounts") || "[]",
      );
      savedAcc = savedAcc.filter(
        (x) =>
          (x.username || "").toLowerCase() !==
          (target.username || "").toLowerCase(),
      );
      getAppStorage().setItem("savedAccounts", JSON.stringify(savedAcc));
    } catch (e) {}

    try {
      await fetch(`/api/dashboard/users/${id}`, { method: "DELETE" });
      await fetchDashboardData(false);
    } catch (err) {
      console.warn("Gagal hapus pengguna dari backend:", err);
    }

    render();
    toast("Pengguna berhasil dihapus");
  }
}

function f(id) {
  return document.getElementById(id).value;
}

function filterMeetingTable() {
  const q = (
      document.getElementById("meetingSearch")?.value || ""
    ).toLowerCase(),
    room = document.getElementById("meetingRoom")?.value || "",
    status = document.getElementById("meetingStatus")?.value || "";
  const data = state.meetings.filter(
    (m) =>
      (m.title + " " + m.requester).toLowerCase().includes(q) &&
      (!room || m.room === room) &&
      (!status ||
        (status === "Menunggu Approval"
          ? isPendingApproval(m)
          : m.status === status)),
  );
  document.getElementById("meetingTable").innerHTML = meetingTable(data);
}

function filterMeetings(status, el) {
  document
    .querySelectorAll(".tab")
    .forEach((x) => x.classList.remove("active"));
  el.classList.add("active");
  document.getElementById("meetingStatus").value =
    status === "Semua" ? "" : status;
  filterMeetingTable();
}

function filterRooms() {
  const q = (document.getElementById("roomSearch")?.value || "")
    .toLowerCase()
    .trim();
  const s = document.getElementById("roomStatus")?.value || "";

  const filtered = state.rooms.filter((r) => {
    const matchName =
      r.name.toLowerCase().includes(q) ||
      (r.location && r.location.toLowerCase().includes(q));
    if (!matchName) return false;
    if (!s) return true;
    if (s === "Tersedia") return r.status === "Tersedia";
    if (s === "Sedang Digunakan")
      return r.status === "Sedang Digunakan" || r.status === "Terpakai";
    if (s === "Dalam Perbaikan")
      return r.status === "Dalam Perbaikan" || r.status === "Perbaikan";
    return r.status === s;
  });

  const grid = document.getElementById("roomGrid");
  if (grid) {
    grid.innerHTML = roomCards(filtered);
  }
}

function filterUsers() {
  const q = (document.getElementById("userSearch")?.value || "")
    .toLowerCase()
    .trim();
  const r = document.getElementById("userRole")?.value || "";
  const tableEl = document.getElementById("userTable");
  if (!tableEl) return;
  tableEl.innerHTML = userTable(
    state.users.filter((u) => {
      const matchText = (
        (u.name || "") +
        " " +
        (u.username || "") +
        " " +
        (u.email || "") +
        " " +
        (u.dept || "")
      )
        .toLowerCase()
        .includes(q);
      if (!matchText) return false;
      if (!r) return true;
      return getRoleLabel(u.role) === r;
    }),
  );
}

function globalSearch(q) {
  if (!q) return;
}

/* =========================
   EXPORT EXCEL & PDF
   ========================= */

function getReportData() {
  const isReportsPage = state.page === "reports";
  const list =
    isReportsPage && typeof getFilteredReportMeetings === "function"
      ? getFilteredReportMeetings()
      : state.meetings;
  return list.map((m, i) => ({
    No: i + 1,
    "Judul Rapat": m.title || "",
    Pemesan: m.requester || "",
    Ruangan: m.room || "",
    Tanggal: formatDate(m.date),
    "Waktu Mulai": m.start || "",
    "Waktu Selesai": m.end || "",
    Peserta: m.participants || 0,
    Status: m.status || "",
    Deskripsi: m.desc || "",
  }));
}

function loadScriptOnce(src, globalName) {
  return new Promise((resolve, reject) => {
    if (window[globalName]) {
      resolve();
      return;
    }

    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(`Gagal memuat ${src}`)),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Gagal memuat ${src}`));
    document.head.appendChild(script);
  });
}

async function exportExcel() {
  try {
    toast("Menyiapkan file Excel...");

    await loadScriptOnce(
      "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js",
      "XLSX",
    );

    const data = getReportData();
    const ws = XLSX.utils.json_to_sheet(data);

    ws["!cols"] = [
      { wch: 6 },
      { wch: 30 },
      { wch: 24 },
      { wch: 22 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 10 },
      { wch: 16 },
      { wch: 45 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Rapat");

    const now = new Date();
    const stamp =
      now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0") +
      "_" +
      String(now.getHours()).padStart(2, "0") +
      String(now.getMinutes()).padStart(2, "0");

    XLSX.writeFile(wb, `Laporan_Rapat_${stamp}.xlsx`);
    toast("Excel berhasil diexport");
  } catch (error) {
    console.error("Export Excel error:", error);
    toast("Gagal export Excel");
  }
}

async function exportPDF() {
  try {
    toast("Menyiapkan file PDF...");

    await loadScriptOnce(
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
      "jspdf",
    );

    await loadScriptOnce(
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.4/jspdf.plugin.autotable.min.js",
      "jspdf",
    );

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const isReportsPage = state.page === "reports";
    const data =
      isReportsPage && typeof getFilteredReportMeetings === "function"
        ? getFilteredReportMeetings()
        : state.meetings;

    doc.setFontSize(16);
    doc.text(
      isReportsPage
        ? `Laporan Penggunaan Ruang Rapat (${getActivePeriodLabel()})`
        : "Laporan Rapat",
      14,
      15,
    );

    doc.setFontSize(9);
    doc.text(`Dicetak: ${new Date().toLocaleString("id-ID")}`, 14, 21);

    doc.autoTable({
      startY: 27,
      head: [
        [
          "No",
          "Judul Rapat",
          "Pemesan",
          "Ruangan",
          "Tanggal",
          "Waktu",
          "Peserta",
          "Status",
        ],
      ],
      body: data.map((m, i) => [
        i + 1,
        m.title,
        m.requester,
        m.room,
        formatDate(m.date),
        `${m.start}-${m.end}`,
        m.participants,
        m.status,
      ]),
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fontStyle: "bold",
      },
    });

    const now = new Date();
    const stamp =
      now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0") +
      "_" +
      String(now.getHours()).padStart(2, "0") +
      String(now.getMinutes()).padStart(2, "0");

    doc.save(`Laporan_Rapat_${stamp}.pdf`);
    toast("PDF berhasil diexport");
  } catch (error) {
    console.error("Export PDF error:", error);
    toast("Gagal export PDF");
  }
}

async function exportNotulensiPDF(id) {
  try {
    toast("Menyiapkan file Notulensi PDF...");

    await loadScriptOnce(
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
      "jspdf",
    );

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const m = state.meetings.find((x) => String(x.id) === String(id));

    if (!m) {
      toast("Data rapat tidak ditemukan");
      return;
    }

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Notulensi Rapat", 14, 20);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Judul Rapat   : ${m.title}`, 14, 32);
    doc.text(`Tanggal       : ${formatDate(m.date)}`, 14, 39);
    doc.text(`Waktu         : ${m.start} - ${m.end}`, 14, 46);
    doc.text(`Ruangan       : ${m.room}`, 14, 53);
    doc.text(`Pemesan       : ${m.requester}`, 14, 60);
    doc.text(`Total Peserta : ${m.participants} orang`, 14, 67);

    doc.setFont("helvetica", "bold");
    doc.text("Agenda / Deskripsi Singkat:", 14, 82);
    doc.setFont("helvetica", "normal");

    const splitDesc = doc.splitTextToSize(m.desc || "-", 180);
    doc.text(splitDesc, 14, 89);

    const nextY = 89 + splitDesc.length * 6 + 12;
    doc.setFont("helvetica", "bold");
    doc.text("Hasil Pembahasan / Keputusan:", 14, nextY);
    doc.setFont("helvetica", "normal");

    doc.text(
      "1. ..................................................................................................................................................",
      14,
      nextY + 10,
    );
    doc.text(
      "2. ..................................................................................................................................................",
      14,
      nextY + 20,
    );
    doc.text(
      "3. ..................................................................................................................................................",
      14,
      nextY + 30,
    );
    doc.text(
      "4. ..................................................................................................................................................",
      14,
      nextY + 40,
    );

    const finalY = nextY + 80;
    doc.text("Mengetahui,", 140, finalY);
    doc.text(m.requester, 140, finalY + 25);

    const safeTitle = m.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    doc.save(`Notulensi_${safeTitle}.pdf`);
    toast("Notulensi berhasil diexport");
  } catch (error) {
    console.error("Export Notulensi PDF error:", error);
    toast("Gagal export Notulensi");
  }
}

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

async function fetchDashboardData(showToast = false) {
  try {
    const res = await fetch("/api/dashboard/data");
    if (!res.ok) throw new Error("Gagal mengambil data dari backend");
    const data = await res.json();
    if (Array.isArray(data.meetings)) {
      state.meetings = sanitizeMeetings(data.meetings);
      getAppStorage().setItem("app_meetings", JSON.stringify(state.meetings));
    }
    if (Array.isArray(data.rooms) && data.rooms.length > 0) {
      state.rooms = data.rooms.filter((r) => {
        const n = (r.name || "").toLowerCase();
        return !n.includes("nusantara") && !n.includes("garuda");
      });
      getAppStorage().setItem("app_rooms", JSON.stringify(state.rooms));
    }
    if (Array.isArray(data.users) && data.users.length > 0) {
      state.users = data.users;
      try {
        getAppStorage().setItem("app_users", JSON.stringify(state.users));
        getAppStorage().setItem("app_login_users", JSON.stringify(state.users));
      } catch (e) {}
    }
    state.googleCalendarConnected = !!data.googleCalendarConnected;
    state.calendarMessage = data.message || "";
    render();
    if (showToast) {
      if (data.googleCalendarConnected) {
        toast(
          `✅ Sinkron: ${data.meetings.length} jadwal dari Google Calendar`,
        );
      } else {
        toast(data.message || "Data backend berhasil dimuat");
      }
    }
  } catch (err) {
    console.warn("Koneksi backend:", err.message);
    if (showToast) toast("⚠️ Tidak dapat terhubung ke server backend");
  }
}

// ----------------------------------------------------------------------
// SINKRONISASI REAL-TIME & NOTIFIKASI LIVE
// ----------------------------------------------------------------------
let knownMeetingIds = new Set();
let hasInitializedSync = false;

function initNotificationSync() {
  if (hasInitializedSync) return;
  hasInitializedSync = true;

  if (Array.isArray(state.meetings)) {
    state.meetings.forEach((m) => knownMeetingIds.add(m.id));
  }

  const checkSync = () => {
    try {
      const stored = getAppStorage().getItem("app_meetings");
      if (!stored) return;
      const rawMeetings = JSON.parse(stored);
      if (!Array.isArray(rawMeetings)) return;
      const latestMeetings = sanitizeMeetings(rawMeetings);
      if (latestMeetings.length !== rawMeetings.length) {
        getAppStorage().setItem("app_meetings", JSON.stringify(latestMeetings));
      }

      // Temukan pesanan baru berstatus "Menunggu Approval"
      const newRequests = latestMeetings.filter(
        (m) => !knownMeetingIds.has(m.id) && m.status === "Menunggu Approval",
      );

      // Cek apakah ada rapat yang otomatis selesai
      const autoCompleted = latestMeetings.filter((lm) => {
        const prev = state.meetings.find(
          (sm) => String(sm.id) === String(lm.id),
        );
        return (
          prev &&
          (prev.status === "Berjalan" || prev.status === "Akan Datang") &&
          lm.status === "Selesai"
        );
      });

      if (autoCompleted.length > 0) {
        autoCompleted.forEach((ac) => {
          fetch("/api/dashboard/meetings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ac),
          }).catch((e) => console.warn("Sync auto-complete:", e));
        });
      }

      if (newRequests.length > 0) {
        state.meetings = latestMeetings;
        newRequests.forEach((r) => knownMeetingIds.add(r.id));

        // Bunyikan nada notifikasi & munculkan pop-up toast
        playNotificationSound();
        showLiveBookingToast(newRequests[newRequests.length - 1]);

        render();
      } else if (
        latestMeetings.length !== state.meetings.length ||
        JSON.stringify(latestMeetings) !== JSON.stringify(state.meetings)
      ) {
        state.meetings = latestMeetings;
        latestMeetings.forEach((m) => knownMeetingIds.add(m.id));
        render();
      }
    } catch (e) {}
  };

  // Cek berkala setiap 2.5 detik
  setInterval(checkSync, 2500);

  // Listener storage lintas tab/window
  window.addEventListener("storage", (e) => {
    if (e.key === "app_meetings" || e.key === "app_notifications") {
      checkSync();
    }
  });

  try {
    if (window.parent && window.parent !== window) {
      window.parent.addEventListener("storage", (e) => {
        if (e.key === "app_meetings" || e.key === "app_notifications") {
          checkSync();
        }
      });
      window.parent.addEventListener("app_notifications_updated", checkSync);
    }
  } catch (e) {}
}

// ----------------------------------------------------------------------
// SINKRONISASI DAUR HIDUP DEV RUN (ONE FLOW RUN)
// ----------------------------------------------------------------------
async function checkDevSessionLifecycle() {
  try {
    const res = await fetch("/api/dev-session");
    if (res.ok) {
      const data = await res.json();
      if (data && data.sessionId) {
        const storage = getAppStorage();
        const lastSession = storage.getItem("app_dev_run_id");
        if (lastSession && lastSession !== data.sessionId) {
          console.info(
            "[DevSession] Sesi baru npm run dev terdeteksi di dashboard. Mereset data ke 1 dummy item.",
          );
          storage.removeItem("app_meetings");
          storage.removeItem("app_notifications");
          storage.removeItem("app_rooms");
          storage.removeItem("app_users");
          storage.removeItem("app_login_users");
          storage.setItem("app_dev_run_id", data.sessionId);
          state.meetings = [];
          storage.setItem("app_meetings", JSON.stringify([]));
          render();
        } else if (!lastSession) {
          storage.setItem("app_dev_run_id", data.sessionId);
        }
      }
    }
  } catch (e) {}
}

render();
initNotificationSync();
checkDevSessionLifecycle();
fetchDashboardData(false);
setInterval(() => fetchDashboardData(false), 30000);

// ----------------------------------------------------------------------
// LOGOUT FUNCTION
// ----------------------------------------------------------------------
function logout(e) {
  if (e) e.stopPropagation();
  if (confirm("Apakah Anda yakin ingin keluar?")) {
    const storage = getAppStorage();
    storage.removeItem("isAuthenticated");
    storage.removeItem("currentUser");
    storage.removeItem("savedAccounts");
    storage.removeItem("dashboard_isAuthenticated");
    storage.removeItem("dashboard_currentUser");
    storage.removeItem("dashboard_savedAccounts");
    try {
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("currentUser");
      localStorage.removeItem("savedAccounts");
      localStorage.removeItem("dashboard_isAuthenticated");
      localStorage.removeItem("dashboard_currentUser");
      localStorage.removeItem("dashboard_savedAccounts");

      sessionStorage.removeItem("isAuthenticated");
      sessionStorage.removeItem("currentUser");
      sessionStorage.removeItem("savedAccounts");
      sessionStorage.removeItem("isAddingAccount");
      sessionStorage.removeItem("dashboard_isAuthenticated");
      sessionStorage.removeItem("dashboard_currentUser");
      sessionStorage.removeItem("dashboard_savedAccounts");

      if (window.parent) {
        if (window.parent.localStorage) {
          window.parent.localStorage.removeItem("isAuthenticated");
          window.parent.localStorage.removeItem("currentUser");
          window.parent.localStorage.removeItem("savedAccounts");
          window.parent.localStorage.removeItem("dashboard_isAuthenticated");
          window.parent.localStorage.removeItem("dashboard_currentUser");
          window.parent.localStorage.removeItem("dashboard_savedAccounts");
        }
        if (window.parent.sessionStorage) {
          window.parent.sessionStorage.removeItem("isAuthenticated");
          window.parent.sessionStorage.removeItem("currentUser");
          window.parent.sessionStorage.removeItem("savedAccounts");
          window.parent.sessionStorage.removeItem("isAddingAccount");
          window.parent.sessionStorage.removeItem("dashboard_isAuthenticated");
          window.parent.sessionStorage.removeItem("dashboard_currentUser");
          window.parent.sessionStorage.removeItem("dashboard_savedAccounts");
        }
      }
    } catch (err) {}
    window.parent.location.href = "/login?portal=dashboard";
  }
}

function getCurrentUser() {
  let u = null;
  try {
    const storages = [
      window.sessionStorage,
      window.parent && window.parent.sessionStorage,
      getAppStorage(),
      window.localStorage,
      window.parent && window.parent.localStorage,
    ];
    for (const s of storages) {
      if (s) {
        const raw = s.getItem("currentUser");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && (parsed.username || parsed.name || parsed.role)) {
            u = parsed;
            break;
          }
        }
      }
    }
  } catch (e) {}
  if (!u) {
    u = { username: "admin", role: "Admin", name: "Admin Utama" };
  }
  u.role = getRoleLabel(u.role);
  return u;
}

function isMainAdmin() {
  const u = getCurrentUser();
  if (!u) return false;
  return (
    u.username === "admin" ||
    u.name === "Admin Utama" ||
    ((u.role === "Admin" || u.role === "Administrator") &&
      (!u.username || u.username === "admin"))
  );
}

// Global window exposure for inline HTML event handlers
window.getCurrentUser = getCurrentUser;
window.approveMeeting = approveMeeting;
window.rejectMeeting = rejectMeeting;
window.confirmReject = confirmReject;
window.approveMeetingFromNotif = approveMeetingFromNotif;
window.rejectMeetingFromNotif = rejectMeetingFromNotif;
window.viewMeetingFromNotif = viewMeetingFromNotif;
window.markAllNotifsRead = markAllNotifsRead;
window.switchToAccount = switchToAccount;
window.toggleProfileMenu = toggleProfileMenu;
window.switchRole = switchRole;
window.logout = logout;
window.viewMeeting = viewMeeting;
window.filterMeetingTable = filterMeetingTable;
window.getAllAvailableAccounts = getAllAvailableAccounts;
window.openMeetingQRModal = openMeetingQRModal;
window.generateQrSvg = generateQrSvg;
window.closeModal = closeModal;
