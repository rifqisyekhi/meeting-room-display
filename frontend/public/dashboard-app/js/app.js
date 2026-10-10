// ----------------------------------------------------------------------
// HELPER ROLE & ACCESS CONTROL
// ----------------------------------------------------------------------
function isAtasanRole(user) {
  if (!user) return false;
  const role = (user.role || "").toLowerCase();
  const uname = (user.username || "").toLowerCase();
  const name = (user.name || "").toLowerCase();
  if (role === "administrator" || uname === "admin" || (role.includes("admin") && !role.includes("approval"))) {
    return false;
  }
  return (
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
    role === "administrator" || role.includes("admin") || uname === "admin"
  );
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
        facilities: "Proyektor, Sound System, Mic Wireless, AC, WiFi",
        image: "/dashboard-app/assets/Ruang Rapat Besar.jpeg",
        images: ["/dashboard-app/assets/Ruang Rapat Besar.jpeg"],
      },
      {
        id: 2,
        name: "Ruang Konsultasi",
        location: "Gedung Pusat Kemnaker, Lt. 3",
        capacity: 12,
        status: "Tersedia",
        facilities: "Smart TV, Whiteboard, AC, WiFi",
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
        role: "Administrator",
        status: "Aktif",
      },
      {
        id: "approval1",
        name: "Pimpinan",
        username: "approval1",
        password: "",
        email: "pimpinan@kemnaker.go.id",
        dept: "Biro Keuangan dan BMN",
        role: "Approval",
        status: "Aktif",
      },
      {
        id: "approval2",
        name: "Wakil Pimpinan",
        username: "approval2",
        password: "",
        email: "wakil.pimpinan@kemnaker.go.id",
        dept: "Biro Keuangan dan BMN",
        role: "Approval",
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
      // Filter out Andi Pratama and normalize Approval roles
      list = list
        .filter(
          (u) =>
            (u.name || "").toLowerCase() !== "andi pratama" &&
            (u.username || "").toLowerCase() !== "andipratama",
        )
        .map((u) => {
          if (u.role === "Approval 1" || u.role === "Approval 2") {
            return { ...u, role: "Approval" };
          }
          return u;
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
    s === "Administrator" ||
    s === "Admin Ruangan" ||
    s === "Admin Sistem" ||
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
  let currentUser = { role: "Administrator" };
  try {
    const stored = window.parent.localStorage.getItem("currentUser");
    if (stored) currentUser = JSON.parse(stored);
  } catch (e) {}

  return `<div class="app-shell"><aside class="sidebar">
    <div class="brand"><img src="/dashboard-app/assets/kemenaker-white.png" alt="Logo Kemenaker" class="brand-logo"><div><b>MEETING DISPLAY ROOM</b><small>BIRO KEUANGAN DAN BMN</small></div></div>
    <nav class="nav">${nav
      .filter(
        ([id]) => id !== "settings" || currentUser.role === "Administrator",
      )
      .map(
        ([id, icon, label]) =>
          `<a href="#${id}" class="nav-item ${state.page === id ? "active" : ""}">${icon}${label}</a>`,
      )
      .join("")}</nav>
    <div class="sidebar-footer">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <a href="/" target="_top" style="flex:1.2;display:flex;align-items:center;justify-content:center;padding:7px 6px;background:rgba(255,255,255,0.14);color:#fff;text-decoration:none;border-radius:6px;font-size:11px;font-weight:600;letter-spacing:0.3px;text-align:center;white-space:nowrap;transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.24)'" onmouseout="this.style.background='rgba(255,255,255,0.14)'">Display TV</a>
        <button onclick="logout()" style="flex:1;display:flex;align-items:center;justify-content:center;padding:7px 6px;background:rgba(220,38,38,0.75);color:#fff;border:none;cursor:pointer;border-radius:6px;font-size:11px;font-weight:600;letter-spacing:0.3px;text-align:center;white-space:nowrap;transition:background 0.2s;" onmouseover="this.style.background='rgba(220,38,38,0.95)'" onmouseout="this.style.background='rgba(220,38,38,0.75)'">Keluar</button>
      </div>
      Bekerja Bersama<br>untuk Tenaga Kerja<br>yang Lebih Baik
    </div>
  </aside><main class="main">
    ${
      [
        "dashboard",
        "meetings",
        "rooms",
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
    }<section class="content" ${["dashboard", "meetings", "rooms", "users", "calendar", "settings"].includes(state.page) ? 'style="padding:0;max-width:none;"' : ""}>${content}</section></main></div><div id="modal" class="modal-backdrop"></div>`;
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

  // Sinkronisasi otomatis dengan state.meetings:
  // Setiap meeting dengan status "Menunggu Approval" yang belum ada di notifikasi otomatis didaftarkan
  let changed = false;
  if (Array.isArray(state.meetings)) {
    state.meetings.forEach((m) => {
      const existing = notifs.find((n) => n.meetingId === m.id && n.type !== "MEETING_REVIEW");
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
    if (m.review && !notifs.some((n) => n.type === "MEETING_REVIEW" && String(n.meetingId) === String(m.id))) {
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
  try {
    getAppStorage().setItem("app_notifications", JSON.stringify(notifs));
  } catch (e) {}
}

function getUnreadNotifCount(currentUser) {
  const notifs = getNotifications();
  const username = currentUser?.username || "admin";
  return notifs.filter(
    (n) =>
      (n.status === "Menunggu Approval" || n.type === "CANCELED_PRIORITY" || n.type === "MEETING_REVIEW") &&
      (!n.readBy || !n.readBy.includes(username)) &&
      (!Array.isArray(n.targetRoles) || n.targetRoles.includes(currentUser?.role)),
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
  if (e) e.stopPropagation();
  const currentUser = getCurrentUser();
  const username = currentUser?.username || "admin";
  const notifs = getNotifications();
  notifs.forEach((n) => {
    if (!n.readBy) n.readBy = [];
    if (!n.readBy.includes(username)) {
      n.readBy.push(username);
    }
  });
  saveNotifications(notifs);
  render();
}

function approveMeetingFromNotif(e, id) {
  if (e) e.stopPropagation();
  approveMeeting(id);
}

function rejectMeetingFromNotif(e, id) {
  if (e) e.stopPropagation();
  rejectMeeting(id);
}

function viewMeetingFromNotif(e, id) {
  if (e) e.stopPropagation();
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
  const notifs = getNotifications().filter((notification) =>
    !Array.isArray(notification.targetRoles) || notification.targetRoles.includes(currentUser?.role),
  );
  const canApprove = isAtasanRole(currentUser);
  const pendingCount = notifs.filter((n) =>
    (n.status || "").toLowerCase().includes("menunggu"),
  ).length;

  let itemsHTML = "";
  if (notifs.length === 0) {
    itemsHTML = `
      <div class="notif-empty-state" style="padding:40px 20px;text-align:center;width:100%;">
        <div style="font-size:32px;margin-bottom:8px;">🔔</div>
        <div style="font-size:14px;font-weight:700;color:#0c2d5e;">Tidak Ada Notifikasi</div>
        <div style="font-size:12px;color:#94a3b8;margin-top:2px;">Belum ada request peminjaman ruangan saat ini.</div>
      </div>
    `;
  } else {
    itemsHTML = notifs
      .map((n) => {
        const m =
          state.meetings.find((x) => String(x.id) === String(n.meetingId)) || n;
        const isReview = n.type === "MEETING_REVIEW";
        const isPending = (m.status || "").toLowerCase().includes("menunggu");
        const isApproved =
          m.status === "Akan Datang" ||
          (!isPending && m.status !== "Dibatalkan" && m.approvedBy);
        const isRejected = m.status === "Dibatalkan";
        const isPriorityCancel =
          n.type === "CANCELED_PRIORITY" ||
          (m.cancellationReason &&
            m.cancellationReason.includes("Kepala Biro")) ||
          (n.cancellationReason &&
            n.cancellationReason.includes("Kepala Biro"));

        let statusBadge = "";
        if (isReview) {
          statusBadge = `<span class="notif-status-badge approved" style="background:#ecfdf5;color:#0f766e;border:1px solid #99f6e4;font-size:10.5px;padding:3px 8px;border-radius:10px;font-weight:600;display:inline-block;white-space:nowrap;">Rating ${esc(n.rating || 0)}/5</span>`;
        } else if (isPriorityCancel) {
          statusBadge = `<span class="notif-status-badge rejected" style="background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;font-size:10.5px;padding:3px 8px;border-radius:10px;font-weight:600;display:inline-block;white-space:nowrap;">✕ Dibatalkan (Prioritas)</span>`;
        } else if (isPending) {
          statusBadge = `<span class="notif-status-badge pending" style="background:#fff7ed;color:#ea580c;border:1px solid #fed7aa;font-size:10.5px;padding:3px 8px;border-radius:10px;font-weight:600;display:inline-block;white-space:nowrap;">⏳ Menunggu Persetujuan</span>`;
        } else if (isApproved) {
          statusBadge = `<span class="notif-status-badge approved" style="background:#ecfdf5;color:#15803d;border:1px solid #bbf7d0;font-size:10.5px;padding:3px 8px;border-radius:10px;font-weight:600;display:inline-block;white-space:nowrap;">✓ Disetujui (${esc(m.approvedBy || "Pimpinan")})</span>`;
        } else if (isRejected) {
          statusBadge = `<span class="notif-status-badge rejected" style="background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;font-size:10.5px;padding:3px 8px;border-radius:10px;font-weight:600;display:inline-block;white-space:nowrap;">✕ Dibatalkan</span>`;
        } else {
          statusBadge = `<span class="notif-status-badge default" style="background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;font-size:10.5px;padding:3px 8px;border-radius:10px;font-weight:600;display:inline-block;white-space:nowrap;">${esc(m.status)}</span>`;
        }

        let actionsHTML = "";
        if (isReview) {
          actionsHTML = `<div class="notif-action-row"><button class="notif-btn-view" onclick="viewMeetingFromNotif(event, '${esc(m.id)}')">Detail Rapat</button></div>`;
        } else if (isPending) {
          if (canApprove) {
            actionsHTML = `
              <div class="notif-action-row" style="display:flex;gap:6px;">
                <button class="notif-btn-approve" onclick="approveMeetingFromNotif(event, '${esc(m.id)}')" style="background:#16a34a;color:#fff;border:none;padding:5px 10px;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:3px;transition:background 0.15s;" onmouseover="this.style.background='#15803d'" onmouseout="this.style.background='#16a34a'">✓ Setujui</button>
                <button class="notif-btn-reject" onclick="rejectMeetingFromNotif(event, '${esc(m.id)}')" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;padding:5px 10px;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:3px;transition:background 0.15s;" onmouseover="this.style.background='#fecaca'" onmouseout="this.style.background='#fee2e2'">✕ Tolak</button>
              </div>
            `;
          } else {
            actionsHTML = `
              <div class="notif-action-row">
                <button class="notif-btn-view" onclick="viewMeeting('${esc(m.id)}')" style="background:#1d4ed8;color:#fff;border:none;padding:5px 12px;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;transition:background 0.15s;" onmouseover="this.style.background='#1e40af'" onmouseout="this.style.background='#1d4ed8'">Lihat Detail</button>
              </div>
            `;
          }
        } else {
          actionsHTML = `
            <div class="notif-action-row">
              <button class="notif-btn-view" onclick="viewMeeting('${esc(m.id)}')" style="background:#1d4ed8;color:#fff;border:none;padding:5px 12px;border-radius:6px;font-size:11.5px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;transition:background 0.15s;" onmouseover="this.style.background='#1e40af'" onmouseout="this.style.background='#1d4ed8'">Detail Rapat</button>
            </div>
          `;
        }

        const iconBg = isReview
          ? "#ccfbf1"
          : isPriorityCancel
          ? "#fee2e2"
          : isPending
            ? "#fff7ed"
            : isApproved
              ? "#ecfdf5"
              : "#fef2f2";
        const iconColor = isReview
          ? "#0f766e"
          : isPriorityCancel
          ? "#b91c1c"
          : isPending
            ? "#ea580c"
            : isApproved
              ? "#16a34a"
              : "#dc2626";

        return `
          <div class="dash-notif-item ${isPending ? "highlight-pending" : ""}" style="${isPriorityCancel ? "border-left: 4px solid #ef4444;" : isApproved ? "border-left: 4px solid #16a34a;" : ""}">
            <!-- Top: Icon, Judul, Waktu -->
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
              <div style="display:flex;align-items:flex-start;gap:8px;min-width:0;flex:1;">
                <div style="width:28px;height:28px;border-radius:8px;background:${iconBg};color:${iconColor};display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;margin-top:1px;">
                  ${isPriorityCancel ? "⚠️" : isPending ? "⏳" : isApproved ? "✓" : "✕"}
                </div>
                <div style="min-width:0;flex:1;">
                  <div class="notif-item-title" style="font-size:13px;font-weight:700;${isPriorityCancel ? "color:#b91c1c;" : "color:#0c2d5e;"}white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3;" title="${esc(n.title || m.title || "Permintaan Booking")}">
                    ${esc(n.title || m.title || "Permintaan Booking")}
                  </div>
                  <div class="notif-item-requester" style="font-size:11.5px;color:#4b6a90;margin-top:2px;">
                    ${isReview ? "Pemberi ulasan" : "Pemohon"}: <b style="color:#0c2d5e;">${esc(isReview ? n.requester || "User" : m.requester || "Bagian")}</b>
                  </div>
                </div>
              </div>
              <span class="notif-item-time" style="font-size:10.5px;color:#94a3b8;white-space:nowrap;flex-shrink:0;margin-top:2px;">
                ${getTimeAgo(n.createdAt)}
              </span>
            </div>

            <!-- Detail Ruang & Jadwal -->
            <div class="notif-item-meta-box" style="background:#f8fafc;border:1px solid #eef2f6;border-radius:8px;padding:7px 10px;font-size:11.5px;color:#334155;display:flex;flex-direction:column;gap:3px;margin:2px 0;">
              <div>🏛️ <b>Ruang:</b> <span style="font-weight:600;color:#0c2d5e;">${esc(m.room)}</span></div>
              <div style="color:#64748b;">📅 <b>Jadwal:</b> ${formatDate(m.date)} (${m.start || ""}-${m.end || ""})</div>
            </div>

            ${isReview && n.review ? `<div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:#f0fdfa;color:#334155;font-size:11.5px;line-height:1.45;"><b>Ulasan:</b> ${esc(n.review)}</div>` : ""}

            ${
              isPriorityCancel
                ? `
              <div style="font-size:11px;color:#991b1b;background:#fef2f2;border:1px solid #fecaca;padding:5px 8px;border-radius:6px;line-height:1.35;">
                ⚠️ Dialihkan untuk <b>Ka. Biro Keuangan</b>.
              </div>
            `
                : ""
            }

            <!-- Bottom: Status Badge & Aksi -->
            <div class="notif-item-bottom" style="display:flex;align-items:center;justify-content:space-between;margin-top:3px;flex-wrap:wrap;gap:8px;">
              <div>
                ${statusBadge}
              </div>
              <div>
                ${actionsHTML}
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  return `
    <div class="dash-section-header" style="margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid #eef3f9;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0c2d5e" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
          <h2 style="font-size:16px;font-weight:700;color:#0c2d5e;margin:0;">Notifikasi & Permintaan</h2>
        </div>
        ${pendingCount > 0 ? `<span class="notif-pending-pill" style="font-size:11px;padding:3px 9px;background:#ffedd5;color:#c2410c;border-radius:12px;font-weight:700;">${pendingCount} Menunggu</span>` : ""}
      </div>
      ${notifs.length > 0 ? `<button type="button" class="notif-mark-read-btn" style="font-size:12px;color:#1769aa;font-weight:600;padding:5px 10px;border-radius:6px;background:#f0f7ff;border:none;cursor:pointer;transition:background 0.15s;" onmouseover="this.style.background='#e0f0fe'" onmouseout="this.style.background='#f0f7ff'" onclick="markAllNotifsRead(event)">Tandai Dibaca</button>` : ""}
    </div>
    <div id="dashNotifBody" class="dash-notif-body">
      ${itemsHTML}
    </div>
    <div style="padding-top:12px;margin-top:auto;border-top:1px solid #eef3f9;display:flex;align-items:center;justify-content:flex-end;">
      <a href="#meetings" style="font-size:12px;font-weight:600;color:#1769aa;text-decoration:none;display:flex;align-items:center;gap:4px;transition:opacity 0.15s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
        Buka Semua di Manajemen Rapat <span>→</span>
      </a>
    </div>
  `;
}

function getProfileHTML() {
  let currentUser = {
    username: "admin",
    name: "Admin Utama",
    role: "Administrator",
  };
  try {
    const stored = getAppStorage().getItem("currentUser");
    if (stored) currentUser = JSON.parse(stored);
  } catch (e) {}

  if (currentUser.role === "Approval 1" || currentUser.role === "Approval 2") {
    currentUser.role = "Approval";
  }

  let savedAccounts = [];
  try {
    const storedSaved = getAppStorage().getItem("savedAccounts");
    if (storedSaved) {
      const parsed = JSON.parse(storedSaved);
      if (Array.isArray(parsed)) {
        savedAccounts = parsed;
      }
    }
  } catch (e) {}

  savedAccounts = savedAccounts
    .filter(
      (u) =>
        (u.name || "").toLowerCase() !== "andi pratama" &&
        (u.username || "").toLowerCase() !== "andipratama",
    )
    .map((u) => {
      if (u.role === "Approval 1" || u.role === "Approval 2") {
        return { ...u, role: "Approval" };
      }
      return u;
    });

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
            const isAtasan =
              (u.role || "").toLowerCase().includes("approval") ||
              (u.role || "").toLowerCase().includes("pimpinan");
            return `
      <div onclick="switchToAccount(event, '${esc(u.username)}')" style="padding:10px 14px;cursor:pointer;font-size:12px;font-weight:500;border-bottom:1px solid #e2e8f0;color:#333;display:flex;flex-direction:column;gap:2px;transition:background 0.15s;" onmouseover="this.style.background='${isAtasan ? "#f0fdf4" : "#eff6ff"}'" onmouseout="this.style.background='white'">
        <div style="font-weight:600;color:#0f172a;">${esc(u.name)}</div>
        <small style="color:${isAtasan ? "#16a34a" : "#2563eb"};font-weight:600;">Role: ${esc(u.role)} ${isAtasan ? "(Hak Akses Approve)" : "(Monitoring & Check In)"}</small>
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
          <div style="font-size:12px;color:#4b6a90;font-weight:600;">${esc(currentUser.role)}</div>
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
  let allAccounts = [];
  try {
    const storedSaved = getAppStorage().getItem("savedAccounts");
    if (storedSaved) {
      allAccounts = JSON.parse(storedSaved) || [];
    }
  } catch (err) {}

  const user = allAccounts.find(
    (u) => (u.username || "").toLowerCase() === (username || "").toLowerCase(),
  );
  if (user) {
    if (user.role === "Approval 1" || user.role === "Approval 2") {
      user.role = "Approval";
    }
    getAppStorage().setItem("currentUser", JSON.stringify(user));
    getAppStorage().setItem("isAuthenticated", "true");
    try {
      localStorage.setItem("currentUser", JSON.stringify(user));
      localStorage.setItem("isAuthenticated", "true");
    } catch (e) {}
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
    if (window.parent && window.parent.sessionStorage) {
      window.parent.sessionStorage.setItem("isAddingAccount", "true");
    }
  } catch (err) {}
  getAppStorage().removeItem("isAuthenticated");
  try {
    localStorage.removeItem("isAuthenticated");
  } catch (err) {}
  window.parent.location.href = "/login";
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

  const customCSS = `
    <style>
      .rep-page-wrapper { background: linear-gradient(180deg, #d4e6f6 0%, #edf5fc 300px); min-height: 100vh; display: flex; flex-direction: column; }
      .rep-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 30px 40px 24px; }
      .rep-breadcrumb { font-size: 12px; color: #4b6a90; margin-bottom: 8px; font-weight: 500; }
      .rep-header h1 { font-size: 28px; font-weight: 700; color: #0c2d5e; margin-bottom: 6px; }
      .rep-header p { color: #4b6a90; font-size: 14px; font-weight: 500; }
      
      .rep-filters-row { display: flex; justify-content: space-between; align-items: center; padding: 0 40px 20px; }
      .rep-filters-left { display: flex; gap: 12px; align-items: center; }
      .rep-filters-left select, .rep-filters-left button { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; outline: none; border: 1px solid #e2eaf5; cursor: pointer; }
      .rep-filters-left select { background: #fff; color: #0c2d5e; min-width: 150px; appearance: none; -webkit-appearance: none; padding-right: 32px; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%230c2d5e' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; }
      .rep-filters-left .btn-white { background: #fff; color: #4b6a90; }
      .rep-filters-left .btn-blue { background: #1769aa; color: #fff; }
      .rep-export-btn { background: #0c2d5e; color: #fff; border: none; padding: 8px 20px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; }
      
      .rep-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; padding: 0 40px 24px; }
      .rep-card { background: rgba(255,255,255,0.85); border-radius: 12px; padding: 20px; display: flex; align-items: center; gap: 16px; box-shadow: 0 4px 20px rgba(12, 45, 94, 0.04); }
      .rc-icon { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; }
      .rc-icon.blue1 { background: #e6f0fa; color: #1769aa; }
      .rc-text strong { display: block; font-size: 24px; font-weight: 700; color: #0c2d5e; line-height: 1.1; }
      .rc-text span { display: block; font-size: 12px; font-weight: 500; color: #4b6a90; margin-top: 4px; }
      
      .rep-charts { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 20px; padding: 0 40px 24px; }
      .rep-chart-card { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 4px 20px rgba(12, 45, 94, 0.04); }
      .rep-chart-card h2 { font-size: 16px; font-weight: 700; color: #0c2d5e; margin-bottom: 20px; }
      
      .rep-list { background: #fff; margin: 0 40px 40px; border-radius: 12px; padding: 24px; box-shadow: 0 4px 20px rgba(12, 45, 94, 0.04); }
      .rep-list table { width: 100%; border-collapse: collapse; }
      .rep-list th { text-align: left; padding: 12px 16px; color: #4b6a90; font-weight: 600; font-size: 13px; border-bottom: 1px solid #eef3f9; }
      .rep-list td { padding: 16px; color: #0c2d5e; font-size: 13px; font-weight: 500; border-bottom: 1px solid #f4f8fc; }

      /* Middle Grid: Charts on the left, Notifications & Requests on the right */
      .dash-middle-grid { display: grid; grid-template-columns: 1.55fr 1fr; gap: 20px; padding: 0 40px 24px; align-items: stretch; }
      @media (max-width: 1200px) { .dash-middle-grid { grid-template-columns: 1fr; } }
      .dash-charts-col { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
      .dash-charts-subgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; min-width: 0; }
      @media (max-width: 768px) { .dash-charts-subgrid { grid-template-columns: 1fr; } }
      /* Bottom Grid: Meetings Table & Notifications side-by-side */
      .dash-bottom-grid { display: grid; grid-template-columns: 1.65fr 1fr; gap: 20px; padding: 0 40px 40px; align-items: stretch; }
      @media (max-width: 1200px) { .dash-bottom-grid { grid-template-columns: 1fr; } }
      .dash-table-col { min-width: 0; display: flex; flex-direction: column; }
      .dash-table-col .dash-table-card { width: 100%; flex: 1; display: flex; flex-direction: column; box-sizing: border-box; }
      .dash-table-col .dash-table-wrapper { flex: 1; }
      .dash-notif-col { min-width: 0; display: flex; flex-direction: column; }
      .dash-notif-col .dash-notif-card { width: 100%; height: 100%; flex: 1; display: flex; flex-direction: column; box-sizing: border-box; }
      .dash-notif-col .dash-notif-body { flex: 1; min-height: 250px; max-height: 560px; overflow-y: auto; }

      /* Layout Template Khusus Approval & Non-Admin (Sesuai Sketsa) */
      .dash-approval-layout {
        display: grid;
        grid-template-columns: 1.7fr 1fr;
        gap: 20px;
        padding: 0 40px 40px;
        align-items: stretch;
      }
      @media (max-width: 1200px) {
        .dash-approval-layout {
          grid-template-columns: 1fr;
        }
      }
      .dash-approval-left {
        display: flex;
        flex-direction: column;
        gap: 20px;
        min-width: 0;
      }
      .dash-approval-left .dash-table-card {
        flex: 1;
        display: flex;
        flex-direction: column;
        margin: 0;
        box-sizing: border-box;
      }
      .dash-approval-left .dash-table-wrapper {
        flex: 1;
      }
      .dash-approval-right {
        min-width: 0;
        display: flex;
        flex-direction: column;
      }
      .dash-approval-right .dash-notif-card {
        width: 100%;
        height: 100%;
        flex: 1;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
      }
      .dash-approval-right .dash-notif-body {
        flex: 1;
        min-height: 250px;
        max-height: 560px;
        overflow-y: auto;
      }

      /* Compact Stat Cards (Sejajar dengan Tabel Rapat) */
      .rep-cards-compact {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
      }
      @media (max-width: 900px) {
        .rep-cards-compact {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      .rep-card-compact {
        background: #ffffff;
        border-radius: 12px;
        padding: 12px 14px;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 4px 18px rgba(12, 45, 94, 0.04);
        border: 1px solid #eef3f9;
        min-width: 0;
      }
      .rc-icon-compact {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        display: grid;
        place-items: center;
        flex-shrink: 0;
        background: #e6f0fa;
        color: #1769aa;
      }
      .rc-icon-compact svg {
        width: 20px !important;
        height: 20px !important;
      }
      .rc-text-compact {
        min-width: 0;
      }
      .rc-text-compact strong {
        display: block;
        font-size: 18px;
        font-weight: 700;
        color: #0c2d5e;
        line-height: 1.15;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .rc-text-compact span {
        display: block;
        font-size: 11px;
        font-weight: 500;
        color: #4b6a90;
        margin-top: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .dash-notif-card { background: #fff; border-radius: 12px; padding: 22px 24px; box-shadow: 0 4px 20px rgba(12, 45, 94, 0.04); display: flex; flex-direction: column; min-width: 0; }
      .dash-section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid #eef3f9; }
      .dash-notif-body {
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-height: 480px;
        overflow-y: auto;
        overflow-x: hidden;
        padding-right: 4px;
        scroll-behavior: smooth;
      }
      .dash-notif-body::-webkit-scrollbar { width: 5px; }
      .dash-notif-body::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
      .dash-notif-body::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      .dash-notif-body::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      .dash-notif-item {
        width: 100%;
        box-sizing: border-box;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 13px 15px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        transition: all 0.15s ease;
        box-shadow: 0 2px 6px rgba(12, 45, 94, 0.03);
      }
      .dash-notif-item:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
        box-shadow: 0 4px 12px rgba(12, 45, 94, 0.06);
      }
      .dash-notif-item.highlight-pending {
        background: #fffcf8;
        border: 1.5px solid #fed7aa;
        border-left: 4px solid #ea580c;
        box-shadow: 0 3px 12px rgba(234, 88, 12, 0.08);
      }
      
      /* Bottom Meeting Table Card */
      .dash-table-card { background: #fff; margin: 0; border-radius: 12px; padding: 24px; box-shadow: 0 4px 20px rgba(12, 45, 94, 0.04); display: flex; flex-direction: column; }
      .dash-table-wrapper { overflow-x: auto; width: 100%; -webkit-overflow-scrolling: touch; }
      .dash-table-wrapper table { width: 100%; border-collapse: collapse; }
      .dash-table-wrapper th { text-align: left; padding: 12px 14px; color: #4b6a90; font-weight: 600; font-size: 13px; border-bottom: 1px solid #eef3f9; white-space: nowrap; }
      .dash-table-wrapper td { padding: 14px; color: #0c2d5e; font-size: 13px; font-weight: 500; border-bottom: 1px solid #f4f8fc; }
      
      /* Chart Mocks */
      .mock-bar-chart { display: flex; align-items: flex-end; gap: 12px; height: 200px; padding-top: 20px; }
      .mock-bar { background: #82b1ff; width: 100%; border-radius: 4px 4px 0 0; position: relative; }
      .mock-bar.dark { background: #1769aa; }
      .mock-bar span { position: absolute; top: -20px; width: 100%; text-align: center; font-size: 10px; color: #4b6a90; }
      
      .mock-donut { width: 180px; height: 180px; border-radius: 50%; margin: 0 auto; background: conic-gradient(#1f9e5c 0 57%, #f8b449 57% 83%, #8ab4f8 83% 100%); position: relative; }
      .mock-donut::after { content: ''; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 0; height: 0; background: #fff; border-radius: 50%; }
      
      .mock-stacked-bar { height: 70px; background: #4a4a4a; display: flex; margin-bottom: 24px; }
      .mock-stacked-bar-fill { height: 100%; background: #4285f4; }
    </style>
  `;

  const currentUser = getCurrentUser();
  const isAdmin = isAdminRole(currentUser);

  let customTableHTML = `
    <div class="dash-table-card" style="margin:0;">
      <div class="dash-section-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid #eef3f9;">
        <div style="display:flex;align-items:center;gap:10px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0c2d5e" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          <h2 style="font-size:16px;font-weight:700;color:#0c2d5e;margin:0;">Jadwal Rapat Hari Ini</h2>
        </div>
        <button type="button" class="btn btn-primary" onclick="openMeetingModal()" style="background:#0c2d5e;color:#fff;border:none;padding:9px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:background 0.15s;box-shadow:0 2px 6px rgba(12,45,94,0.15);" onmouseover="this.style.background='#133b75'" onmouseout="this.style.background='#0c2d5e'">
          <span style="font-size:16px;font-weight:700;line-height:1;">+</span>
          <span>Tambah Rapat</span>
        </button>
      </div>
      <div class="dash-table-wrapper">
        <table>
          <thead>
            <tr>
              <th style="width:36px;text-align:center;">No</th>
              <th>Judul Rapat</th>
              <th>Pemesan</th>
              <th>Ruangan</th>
              <th>Tanggal</th>
              <th>Waktu</th>
              <th>Status</th>
              <th style="text-align:center;">Aksi</th>
            </tr>
          </thead>
          <tbody>
  `;

  if (!state.meetings || state.meetings.length === 0) {
    customTableHTML += `<tr><td colspan="8" style="text-align:center;padding:36px;color:#8c9ba5;font-weight:500;">Belum ada jadwal rapat</td></tr>`;
  } else {
    state.meetings.forEach((m, i) => {
      let statusColor = "#e0f2fe";
      let statusText = "#0284c7";
      if (m.status === "Berjalan") {
        statusColor = "#dcfce7";
        statusText = "#15803d";
      } else if (m.status === "Selesai") {
        statusColor = "#e0f2fe";
        statusText = "#0284c7";
      } else if (m.status === "Akan Datang") {
        statusColor = "#fef3c7";
        statusText = "#b45309";
      } else if (m.status === "Dibatalkan") {
        statusColor = "#fee2e2";
        statusText = "#dc2626";
      } else if (m.status === "Segera") {
        statusColor = "#ffedd5";
        statusText = "#c2410c";
      } else {
        statusColor = "#fff7ed";
        statusText = "#ea580c";
      }

      let actionBtn = `<button style="background-color:#f1f5f9;color:#0c2d5e;border:none;border-radius:50%;width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:background 0.15s;" title="Lihat Detail" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'" onclick="viewMeeting('${m.id}')">${faEye}</button>`;

      customTableHTML += `<tr>
        <td style="text-align:center;">${i + 1}</td>
        <td style="font-weight:700;white-space:nowrap;max-width:200px;overflow:hidden;text-overflow:ellipsis;" title="${esc(m.title)}">${esc(m.title)}</td>
        <td style="white-space:nowrap;">${esc(m.requester)}</td>
        <td style="white-space:nowrap;">${esc(m.room)}</td>
        <td style="white-space:nowrap;">${formatDate(m.date)}</td>
        <td style="white-space:nowrap;">${m.start}-${m.end}</td>
        <td><span style="background:${statusColor};color:${statusText};padding:5px 12px;border-radius:14px;font-size:11.5px;font-weight:700;white-space:nowrap;">${esc(m.status)}</span></td>
        <td style="text-align:center;">${actionBtn}</td>
      </tr>`;
    });
  }
  customTableHTML += `
          </tbody>
        </table>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:auto;padding-top:14px;">
        <a href="#meetings" style="font-size:13px;font-weight:700;color:#1769aa;text-decoration:none;display:inline-flex;align-items:center;gap:6px;transition:opacity 0.15s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
          <span>Lihat Semua</span>
          <span style="font-size:15px;line-height:1;">→</span>
        </a>
      </div>
    </div>
  `;

  return (
    customCSS +
    `
    <div class="rep-page-wrapper">
      <div class="rep-header">
        <div>
          <div class="rep-breadcrumb">Dashboard</div>
          <h1>Dashboard</h1>
          <p>Ringkasan statistik penggunaan rapat.</p>
        </div>
        <div class="dash-actions">
          ${getProfileHTML()}
        </div>
      </div>
      
      <div class="rep-filters-row">
        <div class="rep-filters-left">
          <select id="trafficRoom">
            <option value="semua">Semua Ruangan</option>
            ${state.rooms.map((r) => `<option value="${r.name}">${esc(r.name)}</option>`).join("")}
          </select>
          <button class="btn-white" onclick="openFilterModal()">Filter Waktu</button>
          <button class="btn-blue" onclick="generateTrafficReport()">Tampilkan</button>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="rep-export-wrapper" style="position: relative; display: inline-block;">
            <button class="rep-export-btn" id="exportBtn" type="button" onclick="toggleExportMenu(event)">
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
        </div>
      </div>
      
      ${
        isAdmin
          ? `
          <div class="rep-cards">
            <div class="rep-card">
              <div class="rc-icon blue1">${liaUsersSolid}</div>
              <div class="rc-text"><strong>128</strong><span>Total Rapat</span></div>
            </div>
            <div class="rep-card">
              <div class="rc-icon blue1">${faClock}</div>
              <div class="rc-text"><strong>256 Jam</strong><span>Total Durasi Rapat</span></div>
            </div>
            <div class="rep-card">
              <div class="rc-icon blue1">${faUsers}</div>
              <div class="rc-text"><strong>1.240</strong><span>Total Pengguna</span></div>
            </div>
            <div class="rep-card">
              <div class="rc-icon blue1">${bsBuilding}</div>
              <div class="rc-text"><strong>78%</strong><span>Tingkat Pemanfaatan Ruangan</span></div>
            </div>
          </div>
          `
          : ""
      }
      
      <!-- Charts: Khusus Akun Admin -->
      ${
        isAdmin
          ? `
          <div class="rep-charts" style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 20px; padding: 0 40px 24px;">
              <div class="rep-chart-card" style="margin:0;">
                <div style="display:flex;justify-content:space-between;">
                  <h2>Tren Jumlah Rapat</h2>
                  <span id="chartLabel" style="font-size:12px;color:#4b6a90;">Bulan Ini</span>
                </div>
                <div class="mock-bar-chart">
                  ${[20, 35, 45, 50, 60, 65, 75, 80, 85, 95, 100].map((h, i) => `<div class="mock-bar ${i % 2 === 0 ? "dark" : ""}" style="height:${h}%"><span>${i + 2}</span></div>`).join("")}
                </div>
              </div>
                <div class="rep-chart-card" style="margin:0;">
                  <h2>Status Rapat</h2>
                  <div class="mock-donut">
                     <div style="position:absolute; top:-10px; left:-5px; font-size:9px;">Selesai<br>15.8%</div>
                     <div style="position:absolute; bottom:10px; left:-10px; font-size:9px;">Segera<br>26.3%</div>
                     <div style="position:absolute; bottom:10px; right:-10px; font-size:9px;">Berjalan<br>57.9%</div>
                  </div>
                </div>
                <div class="rep-chart-card" style="margin:0;">
                  <h2>Penggunaan Ruangan</h2>
                  <div style="font-size:11px; margin-bottom:4px; display:flex; gap:10px; justify-content:center; color:#4b6a90;">
                    <span style="display:flex;align-items:center;gap:4px;"><div style="width:6px;height:6px;background:#4285f4;border-radius:50%;"></div> Penggunaan</span>
                    <span style="display:flex;align-items:center;gap:4px;"><div style="width:6px;height:6px;background:#4a4a4a;border-radius:50%;"></div> Kosong</span>
                  </div>
                  <div style="font-size:10px;margin-bottom:2px;">Ruang Rapat Besar</div>
                  <div class="mock-stacked-bar"><div class="mock-stacked-bar-fill" style="width:85%"></div></div>
                  <div style="font-size:10px;margin-bottom:2px;">Ruang Konsultasi</div>
                  <div class="mock-stacked-bar"><div class="mock-stacked-bar-fill" style="width:75%"></div></div>
                </div>
          </div>
          `
          : ""
      }
      
      ${
        isAdmin
          ? `
          <!-- Bottom Grid Admin: Jadwal Rapat Hari Ini & Notifikasi & Permintaan (Berdampingan) -->
          <div class="dash-bottom-grid">
            <div class="dash-table-col">
              ${customTableHTML}
            </div>
            <div class="dash-notif-col">
              <div class="dash-notif-card" style="margin:0;">
                ${getDashboardNotifPanelHTML(currentUser)}
              </div>
            </div>
          </div>
          `
          : `
          <!-- Layout Template Khusus Approval & Akun Lain Sesuai Sketsa Template -->
          <div class="dash-approval-layout">
            <div class="dash-approval-left">
              <div class="rep-cards-compact">
                <div class="rep-card-compact">
                  <div class="rc-icon-compact">${liaUsersSolid}</div>
                  <div class="rc-text-compact"><strong>128</strong><span>Total Rapat</span></div>
                </div>
                <div class="rep-card-compact">
                  <div class="rc-icon-compact">${faClock}</div>
                  <div class="rc-text-compact"><strong>256 Jam</strong><span>Total Durasi</span></div>
                </div>
                <div class="rep-card-compact">
                  <div class="rc-icon-compact">${faUsers}</div>
                  <div class="rc-text-compact"><strong>1.240</strong><span>Total Pengguna</span></div>
                </div>
                <div class="rep-card-compact">
                  <div class="rc-icon-compact">${bsBuilding}</div>
                  <div class="rc-text-compact"><strong>78%</strong><span>Pemanfaatan</span></div>
                </div>
              </div>

              ${customTableHTML}
            </div>
            <div class="dash-approval-right">
              <div class="dash-notif-card" style="margin:0; width:100%; height:100%; display:flex; flex-direction:column;">
                ${getDashboardNotifPanelHTML(currentUser)}
              </div>
            </div>
          </div>
          `
      }
    </div>
  `
  );
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

            let actionButtons = `<button style="background-color:#f4f6f9;color:#0c2d5e;border:none;border-radius:10px;width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;margin-right:8px;box-shadow:0 2px 5px rgba(0,0,0,0.03);" title="Lihat" onclick="viewMeeting('${m.id}')">${faEye}</button>`;

            if (actions) {
              const isPending = (m.status || "")
                .toLowerCase()
                .includes("menunggu");
              if (isPending) {
                if (m.rejectedBy) {
                  actionButtons += `<span style="font-size:11px;color:#ff4d4f;margin-right:8px;font-weight:700;background:#ffebee;padding:6px 12px;border-radius:12px;">Ditolak (${esc(m.rejectedBy)})</span>`;
                } else if (isAtasan) {
                  // HANYA ROLE ATASAN YANG MELIHAT TOMBOL SETUJUI DAN TOLAK
                  actionButtons += `<button style="background-color:#219653;color:#fff;border:none;border-radius:24px;padding:8px 16px;font-weight:700;font-size:12px;cursor:pointer;margin-right:6px;" title="Setujui" onclick="approveMeeting('${m.id}')">✓ Setujui</button>`;
                  actionButtons += `<button style="background-color:#ff4d4f;color:#fff;border:none;border-radius:24px;padding:8px 16px;font-weight:700;font-size:12px;cursor:pointer;" title="Tolak" onclick="rejectMeeting('${m.id}')">✕ Tolak</button>`;
                } else {
                  // ADMIN HANYA MONITORING
                  actionButtons += `<span style="font-size:11px;color:#d97706;background:#fef3c7;padding:5px 10px;border-radius:12px;font-weight:600;">⏳ Menunggu Atasan</span>`;
                }
              } else if (m.status === "Akan Datang") {
                if (isAdmin) {
                  // ADMIN BERTANGGUNG JAWAB CHECK IN
                  actionButtons += `<button style="background-color:#219653;color:#fff;border:none;border-radius:24px;padding:8px 16px;font-weight:700;font-size:13px;cursor:pointer;box-shadow:0 4px 10px rgba(33,150,83,0.2);" title="Check In" onclick="checkInMeeting('${m.id}')">Check In</button>`;
                } else {
                  actionButtons += `<span style="font-size:11px;color:#219653;background:#e0f5ec;padding:5px 10px;border-radius:12px;font-weight:600;">✓ Disetujui</span>`;
                }
              } else if (m.status === "Berjalan") {
                if (isAdmin) {
                  // ADMIN BERTANGGUNG JAWAB CHECK OUT
                  actionButtons += `<button style="background-color:#ff4d4f;color:#fff;border:none;border-radius:24px;padding:8px 16px;font-weight:700;font-size:13px;cursor:pointer;box-shadow:0 4px 10px rgba(255,77,79,0.2);" title="Check Out" onclick="checkOutMeeting('${m.id}')">Check Out</button>`;
                } else {
                  actionButtons += `<span style="font-size:11px;color:#2563eb;background:#dbeafe;padding:5px 10px;border-radius:12px;font-weight:600;">Sedang Berjalan</span>`;
                }
              }
            }

            const isCompleted = String(m.status || "").toLowerCase() === "selesai";
            const rating = Math.max(0, Math.min(5, Number(m.review?.rating) || 0));
            const reviewCell = isCompleted
              ? m.review
                ? `<div style="display:flex;flex-direction:column;align-items:flex-start;gap:3px;min-width:105px;"><span style="color:#e4a719;letter-spacing:1px;white-space:nowrap;" aria-label="Rating ${rating} dari 5">${"★".repeat(rating)}<span style="color:#cbd5e1;">${"☆".repeat(5 - rating)}</span></span><button type="button" onclick="viewMeeting('${m.id}')" style="padding:3px 7px;border:1px solid #c9d9ef;border-radius:6px;color:#15508d;background:#f3f8ff;font:600 10px inherit;cursor:pointer;">Lihat Review</button></div>`
                : `<span style="color:#8291a5;font-size:11px;">Belum ada review</span>`
              : `<span style="color:#9aa8b8;">-</span>`;

            return `<tr><td>${i + 1}</td><td><b>${esc(m.title)}</b></td><td>${esc(m.requester)}</td><td>${esc(m.room)}</td><td>${formatDate(m.date)}</td><td>${m.start}-${m.end}</td><td>${badge(m.status)}</td><td>${reviewCell}</td><td><div class="actions">${actionButtons}</div></td></tr>`;
          })
          .join("");

  return `<div class="table-wrap"><table class="table"><thead><tr><th>No</th><th>Judul Rapat</th><th>Pemesan</th><th>Ruangan</th><th>Tanggal</th><th>Waktu</th><th>Status</th><th>Rating &amp; Review</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function meetings() {
  const running = state.meetings.filter((x) => x.status === "Berjalan").length;
  const soon = state.meetings.filter((x) => x.status === "Akan Datang").length;
  const done = state.meetings.filter((x) => x.status === "Selesai").length;

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

  const customCSS = `
    <style>
      .dashboard-wrapper {
        background: linear-gradient(180deg, #d4e6f6 0%, #edf5fc 300px);
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }
      .dash-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 30px 40px 30px;
      }
      .dash-breadcrumb {
        font-size: 12px;
        color: #4b6a90;
        margin-bottom: 8px;
        font-weight: 500;
      }
      .dash-title h1 {
        font-size: 28px;
        font-weight: 700;
        color: #0c2d5e;
        margin-bottom: 6px;
      }
      .dash-title p {
        color: #4b6a90;
        font-size: 14px;
        font-weight: 500;
      }
      .dash-actions {
        display: flex;
        align-items: center;
        gap: 24px;
      }
      .dash-bell {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: rgba(255,255,255,0.7);
        display: grid;
        place-items: center;
        position: relative;
        cursor: pointer;
        font-size: 16px;
      }
      .dash-bell::after {
        content: '';
        position: absolute;
        top: 12px;
        right: 14px;
        width: 6px;
        height: 6px;
        background: red;
        border-radius: 50%;
      }
      .dash-actions .profile {
        margin: 0;
        background: transparent;
      }
      .dash-actions .avatar {
        background: rgba(255,255,255,0.6);
        color: #0c2d5e;
        border: 1px solid #d4e6f6;
      }
      
      .dash-cards {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 20px;
        padding: 0 40px 30px;
      }
      .d-card {
        background: rgba(255,255,255,0.85);
        border: 1px solid #fff;
        border-radius: 16px;
        padding: 24px;
        display: flex;
        align-items: center;
        gap: 18px;
        box-shadow: 0 10px 30px rgba(12, 45, 94, 0.05);
        backdrop-filter: blur(10px);
      }
      .dc-icon {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        display: grid;
        place-items: center;
      }
      .dc-icon.blue { background: #e6f0fa; color: #1769aa; }
      .dc-icon.green { background: #e2f7ec; color: #13865b; }
      .dc-icon.yellow { background: #fff5da; color: #aa7600; }
      .dc-icon.purple { background: #efeaff; color: #1769aa; }
      
      .dc-text strong {
        display: block;
        font-size: 26px;
        font-weight: 700;
        color: #0c2d5e;
        line-height: 1.1;
      }
      .dc-text span {
        display: block;
        font-size: 14px;
        font-weight: 600;
        color: #0c2d5e;
        margin-top: 4px;
      }
      .dc-text small {
        display: block;
        font-size: 11px;
        color: #4b6a90;
        margin-top: 2px;
        font-weight: 500;
      }
      
      .dash-table-container {
        flex: 1;
        background: #fff;
        border-radius: 20px 20px 0 0;
        padding: 30px 40px;
        box-shadow: 0 -4px 20px rgba(0,0,0,0.02);
        margin: 0;
      }
      
      /* Tabs override */
      .dash-tabs {
        display: flex;
        gap: 30px;
        border-bottom: 1px solid #edf3f9;
        margin-bottom: 24px;
      }
      .dash-tabs button {
        background: none;
        border: none;
        padding: 10px 0;
        font-size: 15px;
        font-weight: 600;
        color: #607490;
        cursor: pointer;
        position: relative;
        transition: color 0.2s;
      }
      .dash-tabs button.active {
        color: #0c2d5e;
      }
      .dash-tabs button.active::after {
        content: '';
        position: absolute;
        bottom: -1px;
        left: 0;
        right: 0;
        height: 3px;
        background: #1769aa;
        border-radius: 3px 3px 0 0;
      }
      
      /* Filters override */
      .dash-filters {
        display: flex;
        gap: 16px;
        margin-bottom: 24px;
      }
      .dash-search-box {
        position: relative;
        display: flex;
        align-items: center;
        width: 320px;
      }
      .dash-search-box svg {
        position: absolute;
        left: 14px;
        color: #1769aa;
      }
      .dash-search-box input {
        width: 100%;
        padding: 10px 14px 10px 40px;
        border: 1px solid #edf3f9;
        border-radius: 8px;
        font-size: 14px;
        outline: none;
        color: #0c2d5e;
        transition: border-color 0.2s;
      }
      .dash-search-box input:focus { border-color: #1769aa; }
      .dash-filters select {
        padding: 10px 36px 10px 14px;
        border: 1px solid #edf3f9;
        border-radius: 8px;
        font-size: 14px;
        color: #0c2d5e;
        outline: none;
        background-color: #fff;
        appearance: none;
        -webkit-appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%230c2d5e' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 12px center;
        cursor: pointer;
      }
      
      /* Force table style */
      .dash-table-container .table th {
        background: #f4f8fc;
        color: #0c2d5e;
        font-weight: 600;
        border-bottom: 1px solid #eef3f9;
      }
      .dash-table-container .table td {
        border-bottom: 1px solid #f4f8fc;
      }
      .dash-table-container .table tr:hover td {
        background: #f9fbff;
      }
    </style>
  `;

  return (
    customCSS +
    `
    <div class="dashboard-wrapper">
      <div class="dash-header">
        <div class="dash-title">
          <div class="dash-breadcrumb">Dashboard > Manajemen Rapat</div>
          <h1>Manajemen Rapat</h1>
          <p>Kelola data rapat, pantau jadwal, dan pastikan setiap rapat berjalan dengan lancar.</p>
        </div>
        <div class="dash-actions">
          ${getProfileHTML()}
        </div>
      </div>
      
      <div class="dash-cards">
        <div class="d-card">
          <div class="dc-icon blue">${faCalendarAlt}</div>
          <div class="dc-text">
            <strong>${state.meetings.length}</strong>
            <span>Total Rapat</span>
            <small>4 x dari minggu lalu</small>
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
            <small>Dalam 2 jam ke depan</small>
          </div>
        </div>
        <div class="d-card">
          <div class="dc-icon purple">${faCheck}</div>
          <div class="dc-text">
            <strong>${done}</strong>
            <span>Rapat Selesai</span>
            <small>Hari ini</small>
          </div>
        </div>
      </div>
      
      <div class="dash-table-container">
        <div class="dash-tabs">
          <button class="tab active" onclick="filterMeetings('Semua',this)">Semua Rapat (${state.meetings.length})</button>
          <button class="tab" onclick="filterMeetings('Berjalan',this)">Rapat Berjalan</button>
          <button class="tab" onclick="filterMeetings('Akan Datang',this)">Akan Datang</button>
          <button class="tab" onclick="filterMeetings('Selesai',this)">Rapat Selesai</button>
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
  `
  );
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

  const customCSS = `
    <style>
      .rooms-wrapper {
        background: linear-gradient(180deg, #d4e6f6 0%, #edf5fc 320px);
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        font-family: 'Poppins', sans-serif;
      }
      .rooms-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 30px 40px 24px;
      }
      .rooms-breadcrumb {
        font-size: 13px;
        color: #4b6a90;
        margin-bottom: 6px;
        font-weight: 500;
      }
      .rooms-title h1 {
        font-size: 28px;
        font-weight: 700;
        color: #0c2d5e;
        margin: 0 0 4px;
      }
      .rooms-title p {
        color: #4b6a90;
        font-size: 14px;
        font-weight: 500;
        margin: 0;
      }
      .rooms-actions {
        display: flex;
        align-items: center;
        gap: 24px;
      }
      .rooms-stat-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 20px;
        padding: 0 40px 28px;
      }
      .r-card {
        background: #ffffff;
        border-radius: 14px;
        padding: 22px 24px;
        display: flex;
        align-items: center;
        gap: 18px;
        box-shadow: 0 4px 20px rgba(12, 45, 94, 0.05);
        position: relative;
        overflow: hidden;
      }
      .r-card::after {
        content: '';
        position: absolute;
        right: -20px;
        bottom: -25px;
        width: 90px;
        height: 90px;
        border-radius: 50%;
        background: #edf6fd;
        z-index: 0;
        pointer-events: none;
      }
      .r-icon-box {
        width: 52px;
        height: 52px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        flex-shrink: 0;
        position: relative;
        z-index: 1;
      }
      .r-icon-box.plain {
        border-radius: 0;
        background: transparent;
        color: #1769aa;
      }
      .r-icon-box.circle-blue {
        background: #bce0fd;
        color: #0c2d5e;
      }
      .r-dot-red {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #e53e3e;
      }
      .r-info {
        position: relative;
        z-index: 1;
      }
      .r-info strong {
        display: block;
        font-size: 28px;
        font-weight: 700;
        color: #0c2d5e;
        line-height: 1.1;
      }
      .r-info span {
        display: block;
        font-size: 13px;
        font-weight: 500;
        color: #4b6a90;
        margin-top: 4px;
      }
      .rooms-panel {
        background: #ffffff;
        margin: 0 40px 40px;
        border-radius: 16px;
        padding: 28px 32px 36px;
        box-shadow: 0 4px 24px rgba(12, 45, 94, 0.05);
      }
      .rooms-filter-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 28px;
        flex-wrap: wrap;
        gap: 16px;
      }
      .rooms-filter-left {
        display: flex;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
      }
      .rooms-search-box {
        position: relative;
        display: flex;
        align-items: center;
        width: 250px;
      }
      .rooms-search-box svg {
        position: absolute;
        left: 14px;
        color: #1769aa;
        pointer-events: none;
      }
      .rooms-search-box input {
        width: 100%;
        padding: 10px 14px 10px 40px;
        border: 1px solid #edf3f9;
        border-radius: 8px;
        font-size: 14px;
        font-family: 'Poppins', sans-serif;
        outline: none;
        color: #0c2d5e;
        background: #fff;
        box-sizing: border-box;
      }
      .rooms-filter-left select {
        padding: 10px 36px 10px 16px;
        border: 1px solid #edf3f9;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 700;
        font-family: 'Poppins', sans-serif;
        color: #0c2d5e;
        outline: none;
        background-color: #fff;
        appearance: none;
        -webkit-appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%230c2d5e' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 14px center;
        cursor: pointer;
      }
      .btn-add-room {
        background: #0c2d5e;
        color: #ffffff;
        border: none;
        padding: 11px 24px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 700;
        font-family: 'Poppins', sans-serif;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: background 0.2s;
      }
      .btn-add-room:hover {
        background: #1769aa;
      }
      .room-grid-custom {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 350px));
        gap: 28px;
      }
      .custom-room-card {
        border-radius: 12px;
        overflow: hidden;
        background: #ffffff;
        border: 1px solid #eef3f9;
        box-shadow: 0 2px 10px rgba(12, 45, 94, 0.04);
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        display: flex;
        flex-direction: column;
      }
      .custom-room-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 24px rgba(12, 45, 94, 0.09);
      }
      .crc-img-wrap {
        width: 100%;
        height: 190px;
        background: #eef3f9;
        overflow: hidden;
      }
      .crc-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .crc-footer {
        background: #e9eff6;
        padding: 16px 14px;
        text-align: center;
      }
      .crc-footer span {
        font-size: 15px;
        font-weight: 700;
        color: #0c2d5e;
        font-family: 'Poppins', sans-serif;
      }

      /* Modal Style for Tambahan Ruangan */
      .custom-room-modal {
        width: min(520px, 94vw);
        max-height: 90vh;
        overflow-y: auto;
        background: #ffffff;
        border-radius: 20px;
        padding: 32px 36px 36px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
        font-family: 'Poppins', sans-serif;
        box-sizing: border-box;
      }
      .custom-room-modal h2 {
        font-size: 24px;
        font-weight: 800;
        color: #0c2d5e;
        margin: 0 0 24px;
        letter-spacing: -0.3px;
      }
      .crm-field {
        margin-bottom: 18px;
      }
      .crm-field.full {
        width: 100%;
      }
      .crm-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
      .crm-field label {
        display: block;
        font-size: 14px;
        font-weight: 700;
        color: #0c2d5e;
        margin-bottom: 8px;
      }
      .crm-field input,
      .crm-field select {
        width: 100%;
        padding: 12px 18px;
        border-radius: 14px;
        border: none;
        background: #eef2f8;
        font-size: 14px;
        font-family: 'Poppins', sans-serif;
        color: #0c2d5e;
        outline: none;
        box-sizing: border-box;
      }
      .crm-field select {
        appearance: none;
        -webkit-appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%230c2d5e' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 16px center;
        cursor: pointer;
      }
      .crm-upload-box {
        border: 2px dashed #b9cde3;
        border-radius: 14px;
        background: #f7fafe;
        cursor: pointer;
        transition: all 0.2s ease;
        overflow: hidden;
        position: relative;
      }
      .crm-upload-box:hover,
      .crm-upload-box.dragover {
        border-color: #1769aa;
        background: #edf5fc;
      }
      .crm-image-preview-wrap {
        width: 100%;
        min-height: 110px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }
      .crm-image-preview-wrap.has-image {
        min-height: 140px;
        max-height: 180px;
      }
      .crm-img-preview {
        width: 100%;
        height: 150px;
        object-fit: cover;
        display: block;
        border-radius: 12px;
      }
      .crm-upload-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 20px 16px;
        text-align: center;
      }
      .crm-upload-icon {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: #e1effa;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #1769aa;
      }
      .crm-upload-text strong {
        font-size: 13.5px;
        color: #0c2d5e;
        display: block;
        font-weight: 600;
      }
      .crm-upload-text small {
        font-size: 11.5px;
        color: #718dae;
        display: block;
        margin-top: 3px;
      }
      .crm-upload-overlay {
        position: absolute;
        inset: 0;
        background: rgba(12, 45, 94, 0.65);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        color: #ffffff;
        font-size: 13px;
        font-weight: 600;
        opacity: 0;
        transition: opacity 0.2s ease;
        border-radius: 12px;
      }
      .crm-upload-box:hover .crm-upload-overlay {
        opacity: 1;
      }
      .crm-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 28px;
      }
      .crm-btn-cancel {
        background: #eef2f8;
        color: #0c2d5e;
        font-weight: 700;
        font-size: 14px;
        font-family: 'Poppins', sans-serif;
        border: none;
        padding: 10px 24px;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.2s;
      }
      .crm-btn-cancel:hover {
        background: #dfe6f0;
      }
      .crm-btn-save {
        background: #0c2d5e;
        color: #ffffff;
        font-weight: 700;
        font-size: 14px;
        font-family: 'Poppins', sans-serif;
        border: none;
        padding: 10px 28px;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.2s;
      }
      .crm-btn-save:hover {
        background: #1769aa;
      }
    </style>
  `;

  return `
    ${customCSS}
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
          <button class="btn-add-room" onclick="openRoomModal()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Tambah Ruangan
          </button>
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

  const customCSS = `
    <style>
      .dashboard-wrapper {
        background: linear-gradient(180deg, #d4e6f6 0%, #edf5fc 300px);
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }
      .dash-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 30px 40px 30px;
      }
      .dash-breadcrumb {
        font-size: 12px;
        color: #4b6a90;
        margin-bottom: 8px;
        font-weight: 500;
      }
      .dash-title h1 {
        font-size: 28px;
        font-weight: 700;
        color: #0c2d5e;
        margin-bottom: 6px;
      }
      .dash-title p {
        color: #4b6a90;
        font-size: 14px;
        font-weight: 500;
      }
      .dash-actions {
        display: flex;
        align-items: center;
        gap: 24px;
      }
      .dash-bell {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: rgba(255,255,255,0.7);
        display: grid;
        place-items: center;
        position: relative;
        cursor: pointer;
        font-size: 16px;
      }
      .dash-bell::after {
        content: '';
        position: absolute;
        top: 12px;
        right: 14px;
        width: 6px;
        height: 6px;
        background: red;
        border-radius: 50%;
      }
      .dash-actions .profile { margin: 0; background: transparent; }
      .dash-actions .avatar { background: rgba(255,255,255,0.6); color: #0c2d5e; border: 1px solid #d4e6f6; }
      
      .dash-cards-users {
        display: flex;
        gap: 20px;
        padding: 0 40px 30px;
      }
      .d-card-user {
        background: rgba(255,255,255,0.85);
        border: 1px solid #fff;
        border-radius: 16px;
        padding: 16px 24px;
        display: flex;
        align-items: center;
        gap: 24px;
        box-shadow: 0 10px 30px rgba(12, 45, 94, 0.05);
        backdrop-filter: blur(10px);
        width: 320px;
      }
      .dc-icon-user {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        display: grid;
        place-items: center;
      }
      .dc-icon-user.blue { background: #e6f0fa; color: #1769aa; }
      .dc-icon-user.orange { background: #fdf2e9; color: #e89540; fill: transparent; stroke: #e89540; stroke-width: 20px; }
      .dc-icon-user.orange svg path { fill: transparent; stroke: #e89540; stroke-width: 20px; }
      
      .dc-text-user strong { display: block; font-size: 32px; font-weight: 700; color: #0c2d5e; line-height: 1.1; }
      .dc-text-user span { display: block; font-size: 15px; font-weight: 600; color: #4b6a90; margin-top: 4px; }
      
      .dash-table-container {
        flex: 1;
        background: #fff;
        border-radius: 20px 20px 0 0;
        padding: 30px 40px;
        box-shadow: 0 -4px 20px rgba(0,0,0,0.02);
        margin: 0;
      }
      
      .btn-add-user {
        background: #0c2d5e;
        color: #ffffff;
        border: none;
        padding: 10px 22px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 700;
        font-family: 'Poppins', sans-serif;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: background 0.2s;
      }
      .btn-add-user:hover {
        background: #1769aa;
      }
      
      .dash-filters {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 16px;
        margin-bottom: 24px;
      }
      .dash-filters-left {
        display: flex;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
      }
      .dash-search-box { position: relative; display: flex; align-items: center; width: 320px; }
      .dash-search-box svg { position: absolute; left: 14px; color: #1769aa; }
      .dash-search-box input {
        width: 100%; padding: 10px 14px 10px 40px; border: 1px solid #edf3f9; border-radius: 8px; font-size: 14px; outline: none; color: #0c2d5e;
      }
      .dash-filters select {
        padding: 10px 36px 10px 14px; border: 1px solid #edf3f9; border-radius: 8px; font-size: 14px; color: #0c2d5e; outline: none; background-color: #fff; appearance: none; -webkit-appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%230c2d5e' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
        background-repeat: no-repeat; background-position: right 12px center; cursor: pointer;
      }
      
      .dash-table-container .table th { background: #fff; color: #0c2d5e; font-weight: 700; border-bottom: 1px solid #eef3f9; }
      .dash-table-container .table td { border-bottom: 1px solid #f4f8fc; padding: 16px 12px; }
    </style>
  `;

  const numUsers = state.users.length;
  const numAdmins = state.users.filter(
    (u) => (u.role || "").includes("Admin") || u.role === "Administrator",
  ).length;

  return (
    customCSS +
    `
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
              <option value="Administrator">Administrator</option>
              <option value="Approval">Approval</option>
              <option value="Admin Ruangan">Admin Ruangan</option>
              <option value="Admin Sistem">Admin Sistem</option>
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
  `
  );
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
      let roleColor = "#f1f5f9";
      if (u.role === "User") roleColor = "#e6f0fa";
      else if (u.role === "Administrator") roleColor = "#e0f5ec";
      else if ((u.role || "").includes("Approval")) roleColor = "#fef3c7";
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
        <td><span style="${badgeStyle}">${esc(u.role)}</span></td>
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

function calendar() {
  const days = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
  let cells = days.map((d) => `<div class="cal-head">${d}</div>`).join("");

  // Generate calendar days for September 2026
  // Sep 1 2026 is a Tuesday (index 1 in Mon-Sun)
  const startOffset = 1; // Tuesday = index 1
  for (let blank = 0; blank < startOffset; blank++)
    cells += `<div class="cal-empty"></div>`;
  for (let i = 1; i <= 30; i++) {
    const hasMeeting = state.meetings.some((m) => {
      const d = new Date(m.date);
      return d.getDate() === i;
    });
    const isSat = (startOffset + i - 1) % 7 === 5;
    const isSun = (startOffset + i - 1) % 7 === 6;
    const colorCls = isSat ? "cal-sat" : isSun ? "cal-sun" : "";
    cells += `<div class="cal-day ${i === 22 ? "cal-today" : ""} ${hasMeeting ? "cal-has" : ""} ${colorCls}">${i}</div>`;
  }

  const scheduleItems = state.meetings
    .map((m) => {
      let statusColor = "#e3f2fd";
      let statusText = "#1769aa";
      if (m.status === "Berjalan") {
        statusColor = "#e0f5ec";
        statusText = "#13865b";
      } else if (m.status === "Selesai") {
        statusColor = "#f3f0ff";
        statusText = "#5b3dd3";
      } else if (m.status === "Akan Datang") {
        statusColor = "#fff7e0";
        statusText = "#b38600";
      }
      return `<div style="display:flex;align-items:flex-start;gap:14px;padding:14px 0;border-bottom:1px solid #f0f4f9;">
      <div style="width:10px;height:10px;border-radius:50%;background:#1769aa;margin-top:5px;flex-shrink:0;"></div>
      <div>
        <div style="font-weight:700;font-size:14px;color:#0c2d5e;margin-bottom:3px;">${esc(m.title)}</div>
        <div style="font-size:12px;color:#4b6a90;margin-bottom:6px;">${m.start}-${m.end} · ${esc(m.room)}</div>
        <span style="background:${statusColor};color:${statusText};padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;">${esc(m.status)}</span>
      </div>
    </div>`;
    })
    .join("");

  const customCSS = `<style>
    .cal-page-wrapper {
      background: linear-gradient(180deg, #d4e6f6 0%, #edf5fc 280px);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .cal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 30px 40px 24px;
    }
    .cal-breadcrumb { font-size: 12px; color: #4b6a90; margin-bottom: 8px; font-weight: 500; }
    .cal-header h1 { font-size: 28px; font-weight: 700; color: #0c2d5e; margin-bottom: 6px; }
    .cal-header p { color: #4b6a90; font-size: 14px; font-weight: 500; }
    .dash-bell {
      width: 44px; height: 44px; border-radius: 50%;
      background: rgba(255,255,255,0.7);
      display: grid; place-items: center;
      position: relative; cursor: pointer;
    }
    .dash-bell::after {
      content: ''; position: absolute; top: 12px; right: 14px;
      width: 6px; height: 6px; background: red; border-radius: 50%;
    }
    .dash-actions { display: flex; align-items: center; gap: 24px; }
    .dash-actions .profile { margin: 0; background: transparent; }
    .dash-actions .avatar { background: rgba(255,255,255,0.6); color: #0c2d5e; border: 1px solid #d4e6f6; }
    
    .cal-body {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 320px;
      gap: 24px;
      padding: 0 40px 40px;
    }
    .cal-card {
      background: #fff;
      border-radius: 16px;
      padding: 28px;
      box-shadow: 0 4px 20px rgba(12,45,94,0.06);
    }
    .cal-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    .cal-card-header h2 { font-size: 18px; font-weight: 700; color: #0c2d5e; }
    .cal-nav-btn {
      background: #f4f6f9; border: none; border-radius: 8px;
      width: 32px; height: 32px; cursor: pointer;
      color: #0c2d5e; font-size: 16px; font-weight: 700;
      display: grid; place-items: center; transition: background 0.2s;
    }
    .cal-nav-btn:hover { background: #e2eaf5; }
    
    .cal-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
    }
    .cal-head {
      text-align: center; font-size: 12px; font-weight: 700;
      color: #4b6a90; padding: 8px 0;
    }
    .cal-empty { padding: 8px; }
    .cal-day {
      text-align: center; font-size: 13px; font-weight: 500;
      color: #0c2d5e; padding: 10px 4px;
      border-radius: 8px; cursor: pointer;
      transition: background 0.15s;
      position: relative;
    }
    .cal-day:hover { background: #edf5fc; }
    .cal-sat { color: #13865b; }
    .cal-sun { color: #e53e3e; }
    .cal-today {
      background: #0c2d5e !important; color: #fff !important;
      font-weight: 700; border-radius: 8px;
    }
    .cal-has::after {
      content: ''; position: absolute; bottom: 3px;
      left: 50%; transform: translateX(-50%);
      width: 4px; height: 4px; border-radius: 50%;
      background: #1769aa;
    }
    .cal-today.cal-has::after { background: #fff; }
    
    .cal-schedule-title { font-size: 16px; font-weight: 700; color: #0c2d5e; margin-bottom: 4px; }
    .cal-schedule-empty { color: #4b6a90; font-size: 14px; padding: 20px 0; }
  </style>`;

  return (
    customCSS +
    `
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
          <h2>${new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</h2>
          <div style="display:flex;gap:6px;">
            <button class="cal-nav-btn">‹</button>
            <button class="cal-nav-btn">›</button>
          </div>
        </div>
        <div class="cal-grid">${cells}</div>
      </div>

      <div class="cal-card">
        <div class="cal-schedule-title">Jadwal Hari Ini</div>
        <div>
          ${scheduleItems || `<div class="cal-schedule-empty">Tidak ada jadwal hari ini.</div>`}
        </div>
      </div>
    </div>
  </div>`
  );
}

// ----------------------------------------------------------------------
// BAGIAN YANG DIUBAH: meetingTable pada Laporan diset tanpa tombol Hapus
// `meetingTable(state.meetings, false)`
// ----------------------------------------------------------------------
function reports() {
  return dashboard();
}

function openFilterModal() {
  const f = state.reportFilter;
  const body = `
    <div style="display:flex; flex-direction:column; gap:10px; padding-top: 10px;">
      <h3 style="font-size: 14px; color: #718096; margin-bottom: 5px;">Rentang waktu</h3>

      <label style="display:flex; align-items:center; justify-content:space-between; cursor:pointer; padding: 12px 0; border-bottom: 1px solid var(--border);">
        <span>Laporan Traffic Harian</span>
        <input type="radio" name="modalFilterMode" value="harian" onchange="toggleModalFilter()" ${f.mode === "harian" ? "checked" : ""}>
      </label>

      <label style="display:flex; align-items:center; justify-content:space-between; cursor:pointer; padding: 12px 0; border-bottom: 1px solid var(--border);">
        <span>Laporan Traffic Bulanan</span>
        <input type="radio" name="modalFilterMode" value="bulanan" onchange="toggleModalFilter()" ${f.mode === "bulanan" ? "checked" : ""}>
      </label>

      <label style="display:flex; align-items:center; justify-content:space-between; cursor:pointer; padding: 12px 0; border-bottom: 1px solid var(--border);">
        <span>Laporan Traffic Tahunan</span>
        <input type="radio" name="modalFilterMode" value="tahunan" onchange="toggleModalFilter()" ${f.mode === "tahunan" ? "checked" : ""}>
      </label>

      <label style="display:flex; align-items:center; justify-content:space-between; cursor:pointer; padding: 12px 0;">
        <span>Atur rentang tanggal</span>
        <input type="radio" name="modalFilterMode" value="date" onchange="toggleModalFilter()" ${f.mode === "date" ? "checked" : ""}>
      </label>

      <div id="modalDateInputs" style="display:flex; gap:10px; margin-top: 10px; opacity: ${f.mode === "date" ? "1" : "0.5"}; pointer-events: ${f.mode === "date" ? "auto" : "none"};">
        <div style="flex:1; background: #f7fafc; padding: 12px; border-radius: 8px;">
          <label style="display:block; font-size:12px; color:#718096; margin-bottom:4px;">Dari</label>
          <input type="date" id="mStartDate" value="${f.startDate}" style="width:100%; border:none; background:transparent; outline:none; font-weight:600;" ${f.mode !== "date" ? "disabled" : ""}>
        </div>
        <div style="flex:1; background: #f7fafc; padding: 12px; border-radius: 8px;">
          <label style="display:block; font-size:12px; color:#718096; margin-bottom:4px;">Ke</label>
          <input type="date" id="mEndDate" value="${f.endDate}" style="width:100%; border:none; background:transparent; outline:none; font-weight:600;" ${f.mode !== "date" ? "disabled" : ""}>
        </div>
      </div>

      <div style="margin-top: 25px;">
        <button class="btn btn-primary" style="width: 100%; padding: 14px; font-size: 15px; border-radius: 8px;" onclick="applyFilter()">Terapkan Filter</button>
      </div>
    </div>
  `;
  openModal("Filter Laporan", body);
}

function toggleModalFilter() {
  const mode = document.querySelector(
    'input[name="modalFilterMode"]:checked',
  ).value;
  const container = document.getElementById("modalDateInputs");
  const sd = document.getElementById("mStartDate");
  const ed = document.getElementById("mEndDate");

  if (mode === "date") {
    container.style.opacity = "1";
    container.style.pointerEvents = "auto";
    sd.disabled = false;
    ed.disabled = false;
  } else {
    container.style.opacity = "0.5";
    container.style.pointerEvents = "none";
    sd.disabled = true;
    ed.disabled = true;
  }
}

function applyFilter() {
  const mode = document.querySelector(
    'input[name="modalFilterMode"]:checked',
  ).value;
  state.reportFilter = {
    mode: mode,
    startDate: document.getElementById("mStartDate").value,
    endDate: document.getElementById("mEndDate").value,
  };
  closeModal();
  generateTrafficReport();
}

function generateTrafficReport() {
  const f = state.reportFilter;
  const label = document.getElementById("chartLabel");

  if (f.mode === "date") {
    if (label)
      label.innerText = `${formatDate(f.startDate)} - ${formatDate(f.endDate)}`;
    toast(`Menampilkan data tanggal ${f.startDate} s/d ${f.endDate}`);
  } else {
    let text = "";
    if (f.mode === "harian") text = "Hari Ini";
    else if (f.mode === "bulanan") text = "Bulan Ini";
    else if (f.mode === "tahunan") text = "Tahun Ini";

    if (label) label.innerText = text;
    toast(
      `Menampilkan Laporan Traffic ${f.mode.charAt(0).toUpperCase() + f.mode.slice(1)}`,
    );
  }
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
  return new Date(s + "T00:00:00").toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

  const faPencilAlt = svgIcon(
    '<path d="M497.9 142.1l-46.1 46.1c-4.7 4.7-12.3 4.7-17 0l-111-111c-4.7-4.7-4.7-12.3 0-17l46.1-46.1c18.7-18.7 49.1-18.7 67.9 0l60.1 60.1c18.8 18.7 18.8 49.1 0 67.9zM284.2 99.8L21.6 362.4.4 483.9c-2.9 16.4 11.4 30.6 27.8 27.8l121.5-21.3 262.6-262.6c4.7-4.7 4.7-12.3 0-17l-111-111c-4.8-4.7-12.4-4.7-17.1 0zM124.1 339.9c-5.5-5.5-5.5-14.3 0-19.8l154-154c5.5-5.5 14.3-5.5 19.8 0s5.5 14.3 0 19.8l-154 154c-5.5 5.5-14.3 5.5-19.8 0zM88 424h48v36.3l-64.5 11.3-31.1-31.1L51.7 376H88v48z"/>',
    "0 0 512 512",
    'width="15" height="15" fill="#0c2d5e"',
  );

  const totalRoles = 4;
  const totalUsers = state.users ? state.users.length : 10;
  const adminAktif = state.users
    ? state.users.filter((u) => u.role === "Administrator").length
    : 1;
  const aksesBermasalah = 0;

  const rolesData = [
    {
      no: 1,
      name: "Administrator",
      access: "Akses Penuh, Pengaturan, Manajemen Pengguna",
      usersCount: 1,
    },
    {
      no: 2,
      name: "Admin Sistem",
      access: "Konfigurasi Kalender, Laporan, Manajemen Ruangan",
      usersCount: 1,
    },
    {
      no: 3,
      name: "Admin Ruangan",
      access: "Kelola Jadwal Rapat, Status Ruangan",
      usersCount: 1,
    },
    {
      no: 4,
      name: "User",
      access: "Melihat Jadwal, Tambah Pemesanan",
      usersCount: 1,
    },
  ];

  const customCSS = `
    <style>
      .settings-wrapper {
        background: linear-gradient(180deg, #d4e6f6 0%, #edf5fc 320px);
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        font-family: 'Poppins', sans-serif;
      }
      .settings-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 30px 40px 24px;
      }
      .settings-breadcrumb {
        font-size: 13px;
        color: #4b6a90;
        margin-bottom: 6px;
        font-weight: 500;
      }
      .settings-title h1 {
        font-size: 28px;
        font-weight: 700;
        color: #0c2d5e;
        margin: 0 0 4px;
      }
      .settings-title p {
        color: #4b6a90;
        font-size: 14px;
        font-weight: 500;
        margin: 0;
      }
      .settings-actions {
        display: flex;
        align-items: center;
        gap: 24px;
      }
      .settings-stat-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 20px;
        padding: 0 40px 28px;
      }
      .s-card {
        background: #ffffff;
        border-radius: 14px;
        padding: 22px 24px;
        display: flex;
        align-items: center;
        gap: 18px;
        box-shadow: 0 4px 20px rgba(12, 45, 94, 0.05);
        position: relative;
        overflow: hidden;
      }
      .s-card::after {
        content: '';
        position: absolute;
        right: -20px;
        bottom: -25px;
        width: 90px;
        height: 90px;
        border-radius: 50%;
        background: #edf6fd;
        z-index: 0;
        pointer-events: none;
      }
      .s-icon-box {
        width: 52px;
        height: 52px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        flex-shrink: 0;
        position: relative;
        z-index: 1;
      }
      .s-icon-box.blue {
        background: #d8ebfd;
      }
      .s-icon-box.green {
        background: #d1fae5;
      }
      .s-icon-box.yellow {
        background: #fef3c7;
      }
      .s-icon-box.purple {
        background: #ede9fe;
      }
      .s-info {
        position: relative;
        z-index: 1;
      }
      .s-info strong {
        display: block;
        font-size: 28px;
        font-weight: 700;
        color: #0c2d5e;
        line-height: 1.1;
      }
      .s-info span {
        display: block;
        font-size: 13px;
        font-weight: 500;
        color: #4b6a90;
        margin-top: 4px;
      }
      .settings-panel {
        background: #ffffff;
        margin: 0 40px 40px;
        border-radius: 16px;
        padding: 28px 32px 36px;
        box-shadow: 0 4px 24px rgba(12, 45, 94, 0.05);
      }
      .settings-panel h2 {
        font-size: 20px;
        font-weight: 800;
        color: #0c2d5e;
        margin: 0 0 24px;
      }
      .settings-table-wrap {
        width: 100%;
        overflow-x: auto;
      }
      .settings-table {
        width: 100%;
        border-collapse: collapse;
      }
      .settings-table th {
        text-align: left;
        padding: 16px 20px;
        font-size: 14px;
        font-weight: 700;
        color: #0c2d5e;
        border-bottom: 2px solid #edf3f9;
        white-space: nowrap;
      }
      .settings-table td {
        padding: 20px;
        font-size: 14px;
        color: #0c2d5e;
        border-bottom: 1px solid #f4f8fc;
      }
      .settings-table tr:hover td {
        background: #fafcfe;
      }
      .td-no {
        font-weight: 700;
        color: #0c2d5e;
        width: 60px;
      }
      .td-role {
        font-weight: 700;
        color: #0c2d5e;
        width: 220px;
      }
      .td-access {
        color: #4b6a90;
        font-weight: 500;
      }
      .td-count {
        font-weight: 600;
        color: #0c2d5e;
        width: 160px;
        text-align: center;
      }
      .td-action {
        width: 80px;
      }
      .btn-role-action {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background: #bce0fd;
        border: none;
        display: grid;
        place-items: center;
        cursor: pointer;
        transition: all 0.2s;
      }
      .btn-role-action:hover {
        background: #9bd0fa;
        transform: translateY(-1px);
      }
    </style>
  `;

  return `
    ${customCSS}
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
                <th class="td-role">Judul Rapat</th>
                <th class="td-access">Hak Akses Utama</th>
                <th class="td-count" style="text-align: center;">Jumlah Pengguna</th>
                <th class="td-action">Aksi</th>
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
                  <td class="td-count" style="text-align: center;">${r.usersCount}</td>
                  <td class="td-action">
                    <button class="btn-role-action" title="Edit Akses ${r.name}" onclick="alert('Pengaturan akses untuk role ${r.name}')">
                      ${faPencilAlt}
                    </button>
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

  const page = pages[state.page] || dashboard;
  document.getElementById("app").innerHTML = layout(page());
}

window.addEventListener("hashchange", () => {
  let page = location.hash.replace("#", "") || "dashboard";
  if (page === "reports") {
    location.hash = "#dashboard";
    return;
  }

  const validPages = [
    "dashboard",
    "meetings",
    "rooms",
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
  if (!isAtasanRole(user)) {
    alert(
      "Hak Akses Dibatasi:\nHanya akun role Atasan (Pimpinan / Approval) yang dapat menyetujui permohonan rapat.\n\nAkun Administrator bertugas memonitor dashboard dan melakukan Check In / Check Out saat peserta hadir.",
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
  const approverRole = user.role || "Approval";
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
    getAppStorage().setItem("app_meetings", JSON.stringify(state.meetings));
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

function checkInMeeting(id) {
  state.meetings = state.meetings.map((m) => {
    if (String(m.id) === String(id)) return { ...m, status: "Berjalan" };
    return m;
  });
  try {
    getAppStorage().setItem("app_meetings", JSON.stringify(state.meetings));
  } catch (e) {}
  const targetCheckIn = state.meetings.find((m) => String(m.id) === String(id));
  if (targetCheckIn) {
    fetch("/api/dashboard/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(targetCheckIn),
    })
      .then(async () => {
        await fetchDashboardData(false);
      })
      .catch((e) => console.warn("Sync check-in meeting:", e));
  }
  render();
  toast("Berhasil Check-In! Rapat telah berjalan.");
}

function checkOutMeeting(id) {
  if (confirm("Tandai rapat ini sebagai selesai?")) {
    state.meetings = state.meetings.map((m) => {
      if (String(m.id) === String(id)) return { ...m, status: "Selesai" };
      return m;
    });
    try {
      getAppStorage().setItem("app_meetings", JSON.stringify(state.meetings));
    } catch (e) {}
    const targetCheckOut = state.meetings.find(
      (m) => String(m.id) === String(id),
    );
    if (targetCheckOut) {
      fetch("/api/dashboard/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(targetCheckOut),
      })
        .then(async () => {
          await fetchDashboardData(false);
        })
        .catch((e) => console.warn("Sync check-out meeting:", e));
    }
    render();
    toast("Berhasil Check-Out! Rapat telah selesai.");
  }
}

function rejectMeeting(id) {
  const user = getCurrentUser();
  if (!isAtasanRole(user)) {
    alert(
      "Hak Akses Dibatasi:\nHanya akun role Atasan (Pimpinan / Approval) yang dapat menolak permohonan rapat.",
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
  if (!isAtasanRole(user)) {
    alert("Hanya role Atasan yang berhak menolak permohonan rapat.");
    return;
  }
  const reason =
    document.getElementById("fRejectReason")?.value.trim() ||
    "Tidak ada alasan yang diberikan";
  const rejecterName = user.name || "Pimpinan";
  const rejecterRole = user.role || "Approval";
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
    getAppStorage().setItem("app_meetings", JSON.stringify(state.meetings));
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

  let actionBtns = `<button class="btn btn-light" style="display:inline-flex;align-items:center;gap:6px;" onclick="exportNotulensiPDF('${m.id}')">${ICONS.export} <span>Notulensi</span></button>`;

  const isPending = (m.status || "").toLowerCase().includes("menunggu");
  if (isPending) {
    if (isAtasan) {
      // HANYA ROLE ATASAN YANG BISA SETUJUI DAN TOLAK
      actionBtns += `<button class="btn btn-primary" style="background:#219653;border-color:#219653;font-weight:700;" onclick="closeModal(); approveMeeting('${m.id}')">✓ Setujui Rapat</button>`;
      actionBtns += `<button class="btn btn-primary" style="background:#ff4d4f;border-color:#ff4d4f;font-weight:700;" onclick="closeModal(); rejectMeeting('${m.id}')">✕ Tolak Rapat</button>`;
    } else {
      actionBtns += `<div style="font-size:12px;color:#d97706;background:#fef3c7;padding:7px 12px;border-radius:8px;font-weight:600;display:inline-flex;align-items:center;">⏳ Menunggu Persetujuan Atasan</div>`;
    }
  } else if (m.status === "Akan Datang" && isAdmin) {
    // ADMIN CHECK IN
    actionBtns += `<button class="btn btn-primary" style="background:#219653;border-color:#219653;font-weight:700;" onclick="closeModal(); checkInMeeting('${m.id}')">Check In</button>`;
  } else if (m.status === "Berjalan" && isAdmin) {
    // ADMIN CHECK OUT
    actionBtns += `<button class="btn btn-primary" style="background:#ff4d4f;border-color:#ff4d4f;font-weight:700;" onclick="closeModal(); checkOutMeeting('${m.id}')">Check Out</button>`;
  }

  if (isAdmin || isAtasan) {
    actionBtns += `<button class="btn btn-primary" onclick="closeModal(); editMeeting('${m.id}')">Edit Rapat</button>`;
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
    <p style="margin-top:15px;color:#334155;white-space:pre-line;">${esc(m.desc)}</p>
    <div class="modal-actions" style="margin-top:20px;display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;align-items:center;">
      ${actionBtns}
    </div>`,
  );
}

async function deleteMeeting(id) {
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

function openRoomModal(id = null) {
  const isEdit = id !== null && id !== undefined;
  const r = isEdit
    ? state.rooms.find((x) => x.id === id)
    : {
        name: "",
        location: "",
        capacity: "",
        status: "Tersedia",
        facilities: "",
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

  const modalBackdrop = document.getElementById("modal");
  modalBackdrop.innerHTML = `
    <div class="custom-room-modal" onclick="event.stopPropagation()">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 20px;">
        <div>
          <h2 style="margin:0 0 4px; font-size:22px; font-weight:800; color:#0c2d5e;">
            ${id ? "Edit Ruangan" : "Tambah Ruangan"}
          </h2>
          <p style="margin:0; font-size:13px; color:#4b6a90;">
            Kelola data ruangan dan unggah berbagai foto sudut pandang/view ruangan
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
      <div class="crm-row">
        <div class="crm-field">
          <label>Status</label>
          <select id="rStatus">
            <option value="Tersedia" ${r.status === "Tersedia" ? "selected" : ""}>Tersedia</option>
            <option value="Sedang Digunakan" ${r.status === "Sedang Digunakan" || r.status === "Terpakai" ? "selected" : ""}>Sedang Digunakan</option>
            <option value="Dalam Perbaikan" ${r.status === "Dalam Perbaikan" || r.status === "Perbaikan" ? "selected" : ""}>Dalam Perbaikan</option>
          </select>
        </div>
        <div class="crm-field">
          <label>Fasilitas</label>
          <input id="rFacilities" value="${esc(r.facilities)}" placeholder="Contoh: TV, WiFi, AC">
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

  const obj = {
    id: id || Date.now(),
    name: name,
    location: f("rLocation") || "Gedung A - Lantai 3",
    capacity: Number(f("rCapacity")) || 10,
    status: f("rStatus") || "Tersedia",
    facilities: f("rFacilities") || "",
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

  closeModal();
  render();
  toast("Data ruangan & foto view berhasil disimpan");

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
  openRoomModal(id);
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
          <label>Password (Untuk Login) <span style="color:#e53e3e;">*</span></label>
          <input id="uPassword" type="text" value="${esc(u.password || "")}" placeholder="Masukkan password">
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
              "User",
              "Administrator",
              "Approval",
              "Admin Ruangan",
              "Admin Sistem",
            ]
              .map(
                (r) =>
                  `<option value="${r}" ${r === u.role ? "selected" : ""}>${r}</option>`,
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
  if (!password) {
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
    password: password,
    email: email || `${lowerUsername}@kemnaker.go.id`,
    dept: dept,
    role: role,
    status: status,
  };

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

  closeModal();
  render();
  toast(
    id
      ? "Data pengguna berhasil diperbarui"
      : "Pengguna baru berhasil ditambahkan dan dapat login",
  );

  try {
    await fetch("/api/dashboard/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userObj),
    });
  } catch (err) {}
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

    render();
    toast("Pengguna berhasil dihapus");

    try {
      await fetch(`/api/dashboard/users/${id}`, { method: "DELETE" });
    } catch (err) {}
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
      (!status || m.status === status),
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
    state.users.filter(
      (u) =>
        (
          (u.name || "") +
          " " +
          (u.username || "") +
          " " +
          (u.email || "") +
          " " +
          (u.dept || "")
        )
          .toLowerCase()
          .includes(q) &&
        (!r || u.role === r),
    ),
  );
}

function globalSearch(q) {
  if (!q) return;
}

/* =========================
   EXPORT EXCEL & PDF
   ========================= */

function getReportData() {
  return state.meetings.map((m, i) => ({
    No: i + 1,
    "Judul Rapat": m.title,
    Pemesan: m.requester,
    Ruangan: m.room,
    Tanggal: formatDate(m.date),
    "Waktu Mulai": m.start,
    "Waktu Selesai": m.end,
    Peserta: m.participants,
    Status: m.status,
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

    const data = state.meetings;

    doc.setFontSize(16);
    doc.text("Laporan Rapat", 14, 15);

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
    try {
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("currentUser");
      localStorage.removeItem("savedAccounts");
      sessionStorage.removeItem("isAuthenticated");
      sessionStorage.removeItem("currentUser");
      sessionStorage.removeItem("savedAccounts");
      sessionStorage.removeItem("isAddingAccount");
      if (window.parent) {
        if (window.parent.localStorage) {
          window.parent.localStorage.removeItem("isAuthenticated");
          window.parent.localStorage.removeItem("currentUser");
          window.parent.localStorage.removeItem("savedAccounts");
        }
        if (window.parent.sessionStorage) {
          window.parent.sessionStorage.removeItem("isAuthenticated");
          window.parent.sessionStorage.removeItem("currentUser");
          window.parent.sessionStorage.removeItem("savedAccounts");
          window.parent.sessionStorage.removeItem("isAddingAccount");
        }
      }
    } catch (err) {}
    window.parent.location.href = "/login";
  }
}

function getCurrentUser() {
  let u = { username: "admin", role: "Administrator", name: "Admin Utama" };
  try {
    const s = getAppStorage().getItem("currentUser");
    if (s) u = JSON.parse(s);
  } catch (e) {}
  return u;
}

function isMainAdmin() {
  const u = getCurrentUser();
  if (!u) return false;
  return (
    u.username === "admin" ||
    u.name === "Admin Utama" ||
    (u.role === "Administrator" && (!u.username || u.username === "admin"))
  );
}
