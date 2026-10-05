const state = {
  page: location.hash.replace("#", "") || "dashboard",
  googleCalendarConnected: false,
  calendarMessage: "Menghubungkan ke backend...",
  reportFilter: {
    mode: "bulanan",
    startDate: "2026-09-01",
    endDate: "2026-09-30",
  },
  meetings: JSON.parse(window.parent.localStorage.getItem('app_meetings')) || [
    {
      id: 1,
      title: "Rapat Biro Keuangan",
      requester: "Andi Pratama",
      room: "Ruang Nusantara",
      date: "2026-09-22",
      start: "08:00",
      end: "10:00",
      status: "Berjalan",
      participants: 12,
      desc: "Pembahasan laporan keuangan dan evaluasi program.",
    },
    {
      id: 2,
      title: "Koordinasi Tim IT",
      requester: "Siti Rahma",
      room: "Ruang Garuda",
      date: "2026-09-22",
      start: "10:00",
      end: "12:00",
      status: "Menunggu Approval",
      participants: 8,
      desc: "Koordinasi pengembangan sistem.",
    },
    {
      id: 3,
      title: "Evaluasi Program 2026",
      requester: "Budi Santoso",
      room: "Ruang Merdeka",
      date: "2026-09-22",
      start: "13:00",
      end: "15:00",
      status: "Akan Datang",
      participants: 15,
      desc: "Evaluasi capaian program.",
    },
    {
      id: 901,
      title: "Sosialisasi SOP Baru",
      requester: "Biro SDM",
      room: "Ruang Nusantara",
      date: "2026-09-23",
      start: "09:00",
      end: "11:00",
      status: "Menunggu Approval",
      participants: 25,
      desc: "Pemahaman terkait standar operasional prosedur yang baru dirilis.",
    },
    {
      id: 902,
      title: "Rapat Perencanaan Anggaran",
      requester: "Kepala Bagian Anggaran",
      room: "Ruang Rapat Utama",
      date: "2026-09-24",
      start: "13:00",
      end: "16:00",
      status: "Menunggu Approval",
      participants: 20,
      desc: "Draft awal perencanaan anggaran 2027.",
    },
    {
      id: 4,
      title: "Rapat Internal",
      requester: "Dewi Lestari",
      room: "Ruang Indonesia",
      date: "2026-09-22",
      start: "15:00",
      end: "17:00",
      status: "Akan Datang",
      participants: 10,
      desc: "Rapat internal biro.",
    },
    {
      id: 5,
      title: "Diskusi Anggaran",
      requester: "Rizky Handoko",
      room: "Ruang Kemnaker",
      date: "2026-09-22",
      start: "19:00",
      end: "21:00",
      status: "Selesai",
      participants: 7,
      desc: "Diskusi anggaran.",
    },
    {
      id: 6,
      title: "Rapat Pengembangan SDM",
      requester: "Maya Sari",
      room: "Ruang Pancasila",
      date: "2026-09-23",
      start: "09:00",
      end: "11:00",
      status: "Akan Datang",
      participants: 14,
      desc: "Pengembangan SDM.",
    },
    {
      id: 7,
      title: "Review Kinerja Triwulan",
      requester: "Agus Widodo",
      room: "Ruang Kolaborasi",
      date: "2026-09-23",
      start: "13:00",
      end: "15:00",
      status: "Akan Datang",
      participants: 9,
      desc: "Review kinerja.",
    },
    {
      id: 8,
      title: "Presentasi Program",
      requester: "Nina Kartika",
      room: "Ruang Bhinneka",
      date: "2026-09-23",
      start: "16:00",
      end: "17:30",
      status: "Akan Datang",
      participants: 18,
      desc: "Presentasi program.",
    },
  ],
  rooms: (() => {
    try {
      const saved = window.parent.localStorage.getItem("app_rooms");
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return [
      {
        id: 1,
        name: "Ruang Rapat Besar",
        location: "Gedung A - Lantai 3",
        capacity: 20,
        status: "Tersedia",
        facilities: "Proyektor, TV, WiFi, Sound System",
        image: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=600&h=400",
      },
      {
        id: 2,
        name: "Ruang Konsultasi",
        location: "Gedung A - Lantai 3",
        capacity: 10,
        status: "Tersedia",
        facilities: "TV, WiFi, AC",
        image: "https://images.unsplash.com/photo-1577412647305-991150c7d163?auto=format&fit=crop&q=80&w=600&h=400",
      },
    ];
  })(),
  users: [
    {
      id: 1,
      name: "Windy Nuraini Putri",
      email: "windy@kemnaker.go.id",
      dept: "Biro Keuangan",
      role: "Administrator",
      status: "Aktif",
    },
    {
      id: 2,
      name: "Andi Pratama",
      email: "andi@kemnaker.go.id",
      dept: "Biro Keuangan",
      role: "User",
      status: "Aktif",
    },
    {
      id: 3,
      name: "Siti Rahma",
      email: "siti@kemnaker.go.id",
      dept: "Biro Keuangan",
      role: "User",
      status: "Aktif",
    },
    {
      id: 4,
      name: "Budi Santoso",
      email: "budi@kemnaker.go.id",
      dept: "Biro Umum",
      role: "Admin Ruangan",
      status: "Aktif",
    },
    {
      id: 5,
      name: "Dewi Lestari",
      email: "dewi@kemnaker.go.id",
      dept: "Biro Keuangan",
      role: "User",
      status: "Aktif",
    },
    {
      id: 6,
      name: "Rizky Handoko",
      email: "rizky@kemnaker.go.id",
      dept: "IT Support",
      role: "Admin Sistem",
      status: "Aktif",
    },
    {
      id: 7,
      name: "Maya Sari",
      email: "maya@kemnaker.go.id",
      dept: "Biro SDM",
      role: "User",
      status: "Nonaktif",
    },
    {
      id: 8,
      name: "Agus Widodo",
      email: "agus@kemnaker.go.id",
      dept: "Biro Umum",
      role: "User",
      status: "Aktif",
    },
    {
      id: 9,
      name: "Nina Kartika",
      email: "nina@kemnaker.go.id",
      dept: "Biro Umum",
      role: "Admin Ruangan",
      status: "Aktif",
    },
    {
      id: 10,
      name: "Fajar Maulana",
      email: "fajar@kemnaker.go.id",
      dept: "Biro SDM",
      role: "User",
      status: "Nonaktif",
    },
  ],
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
    `<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M262.29 192.31a64 64 0 1 0 57.4 57.4 64.13 64.13 0 0 0-57.4-57.4M416.39 256a154 154 0 0 1-1.53 20.79l45.21 35.46a10.81 10.81 0 0 1 2.45 13.75l-42.77 74a10.81 10.81 0 0 1-13.14 4.59l-44.9-18.08a16.11 16.11 0 0 0-15.17 1.75A164.5 164.5 0 0 1 325 400.8a15.94 15.94 0 0 0-8.82 12.14l-6.73 47.89a11.08 11.08 0 0 1-10.68 9.17h-85.54a11.11 11.11 0 0 1-10.69-8.87l-6.72-47.82a16.07 16.07 0 0 0-9-12.22 155 155 0 0 1-21.46-12.57 16 16 0 0 0-15.11-1.71l-44.89 18.07a10.81 10.81 0 0 1-13.14-4.58l-42.77-74a10.8 10.8 0 0 1 2.45-13.75l38.21-30a16.05 16.05 0 0 0 6-14.08c-.36-4.17-.58-8.33-.58-12.5s.21-8.27.58-12.35a16 16 0 0 0-6.07-13.94l-38.19-30A10.81 10.81 0 0 1 49.48 186l42.77-74a10.81 10.81 0 0 1 13.14-4.59l44.9 18.08a16.11 16.11 0 0 0 15.17-1.75A164.5 164.5 0 0 1 187 111.2a15.94 15.94 0 0 0 8.82-12.14l6.73-47.89A11.08 11.08 0 0 1 213.23 42h85.54a11.11 11.11 0 0 1 10.69 8.87l6.72 47.82a16.07 16.07 0 0 0 9 12.22 155 155 0 0 1 21.46 12.57 16 16 0 0 0 15.11 1.71l44.89-18.07a10.81 10.81 0 0 1 13.14 4.58l42.77 74a10.8 10.8 0 0 1-2.45 13.75l-38.21 30a16.05 16.05 0 0 0-6.05 14.08c.33 4.14.55 8.3.55 12.47"/>`,
    "0 0 512 512",
    'fill="none"',
  ),
};

const nav = [
  ["dashboard", ICONS.dashboard, "Dashboard"],
  ["meetings", ICONS.meetings, "Manajemen Rapat"],
  ["rooms", ICONS.rooms, "Manajemen Ruangan"],
  ["users", ICONS.users, "Pengguna"],
  ["calendar", ICONS.calendar, "Kalender"],
  ["reports", ICONS.reports, "Laporan"],
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

function layout(content) {
  let currentUser = { role: "Administrator" };
  try {
    const stored = window.parent.localStorage.getItem("currentUser");
    if (stored) currentUser = JSON.parse(stored);
  } catch (e) {}

  return `<div class="app-shell"><aside class="sidebar">
    <div class="brand"><img src="/dashboard/assets/kemenaker-white.png" alt="Logo Kemenaker" class="brand-logo"><div><b>MEETING DISPLAY ROOM</b><small>BIRO KEUANGAN DAN BMN</small></div></div>
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
      <a href="/" target="_top" style="display:inline-block;margin-bottom:12px;padding:6px 12px;background:rgba(255,255,255,0.12);color:#fff;text-decoration:none;border-radius:6px;font-size:11px;font-weight:600;letter-spacing:0.3px;">📺 Ke Display TV</a><br>
      <button onclick="logout()" style="display:inline-block;margin-bottom:12px;padding:6px 12px;background:rgba(255,0,0,0.6);color:#fff;border:none;cursor:pointer;border-radius:6px;font-size:11px;font-weight:600;letter-spacing:0.3px;width:100%;">🚪 Keluar</button><br>
      Bekerja Bersama<br>untuk Tenaga Kerja<br>yang Lebih Baik
    </div>
  </aside><main class="main">
    ${
      ["dashboard", "meetings", "rooms", "users", "calendar", "reports", "settings"].includes(
        state.page,
      )
        ? ""
        : `<header class="topbar"><input class="search" placeholder="Cari rapat, ruangan, pengguna..." oninput="globalSearch(this.value)">
      <div class="top-actions" style="display:flex;align-items:center;gap:12px;">
        <span class="badge ${state.googleCalendarConnected ? "green" : "yellow"}" style="font-size:11px;cursor:pointer;white-space:nowrap;" title="${esc(state.calendarMessage)}" onclick="alert(state.calendarMessage)">
          ${state.googleCalendarConnected ? "🟢 Google Calendar" : "🟡 Menunggu Kalender"}
        </span>
        <button class="btn btn-light" onclick="fetchDashboardData(true)" style="padding:6px 12px;font-size:12px;display:flex;align-items:center;gap:4px;white-space:nowrap;" title="Sinkronkan data terbaru dari Google Calendar / backend">
          🔄 Sinkron
        </button>
        <span>🔔</span>
        ${getProfileHTML()}
      </div>
    </header>`
    }<section class="content" ${["dashboard", "meetings", "rooms", "users", "calendar", "reports", "settings"].includes(state.page) ? 'style="padding:0;max-width:none;"' : ""}>${content}</section></main></div><div id="modal" class="modal-backdrop"></div>`;
}

function getProfileHTML() {
  const defaultUser = {
    username: "admin",
    name: "Admin Utama",
    role: "Administrator",
  };
  let currentUser = defaultUser;
  try {
    const stored = window.parent.localStorage.getItem("currentUser");
    if (stored) currentUser = JSON.parse(stored);
  } catch (e) {}

  let savedAccounts = [];
  try {
    const storedSaved = window.parent.localStorage.getItem("savedAccounts");
    if (storedSaved) savedAccounts = JSON.parse(storedSaved);
  } catch (e) {}

  const initial = currentUser.name
    ? currentUser.name.charAt(0).toUpperCase()
    : "A";

  const savedItems = savedAccounts
    .filter((u) => u.username !== currentUser.username)
    .map(
      (u) => `
    <div onclick="switchToAccount(event, '${esc(u.username)}')" style="padding:12px 16px;cursor:pointer;font-size:12px;font-weight:500;border-bottom:1px solid #e2e8f0;color:#333;display:flex;flex-direction:column;gap:2px;" onmouseover="this.style.background='#f7fafc'" onmouseout="this.style.background='white'">
      <div style="display:flex;align-items:center;gap:8px;">👤 ${esc(u.name)}</div>
      <small style="color:#718096;margin-left:22px;">Role: ${esc(u.role)}</small>
    </div>
  `,
    )
    .join("");

  return `
    <div style="display:flex;align-items:center;gap:16px;">
      <div style="position:relative;cursor:pointer;">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0c2d5e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
        <span style="position:absolute;top:-3px;right:-3px;width:8px;height:8px;background:#e53e3e;border-radius:50%;border:1.5px solid #fff;"></span>
      </div>
      <div class="profile" onclick="toggleProfileMenu()" style="cursor:pointer;position:relative;display:flex;align-items:center;gap:12px;">
        <div class="avatar" style="width:40px;height:40px;border-radius:50%;background:#fff;color:#0c2d5e;font-weight:700;font-size:16px;display:flex;align-items:center;justify-content:center;border:2px solid #d4e6f6;flex-shrink:0;">${initial}</div>
        <div>
          <div style="font-weight:700;font-size:14px;color:#0c2d5e;line-height:1.2;">${esc(currentUser.name)}</div>
          <div style="font-size:12px;color:#4b6a90;font-weight:500;">${esc(currentUser.role)}</div>
        </div>
        <div id="profileDropdown" style="display:none;position:absolute;top:120%;right:0;background:white;border-radius:8px;box-shadow:0 10px 25px rgba(0,0,0,0.15);width:220px;z-index:100;overflow:hidden;border:1px solid #e2e8f0;text-align:left;">
          <div style="padding:10px 16px;font-size:11px;font-weight:600;color:#a0aec0;background:#f7fafc;border-bottom:1px solid #e2e8f0;text-transform:uppercase;">Ganti Akun Cepat</div>
          ${savedItems}
          <div onclick="switchRole(event)" style="padding:12px 16px;cursor:pointer;font-size:13px;font-weight:500;border-bottom:1px solid #e2e8f0;color:#333;display:flex;align-items:center;gap:8px;" onmouseover="this.style.background='#f7fafc'" onmouseout="this.style.background='white'">➕ Tambah Akun Lain</div>
          <div onclick="logout(event)" style="padding:12px 16px;cursor:pointer;font-size:13px;font-weight:500;color:#e53e3e;display:flex;align-items:center;gap:8px;" onmouseover="this.style.background='#fff5f5'" onmouseout="this.style.background='white'">🚪 Log Out</div>
        </div>
      </div>
    </div>
  `;
}

function switchToAccount(e, username) {
  if (e) e.stopPropagation();
  let savedAccounts = [];
  try {
    const storedSaved = window.parent.localStorage.getItem("savedAccounts");
    if (storedSaved) savedAccounts = JSON.parse(storedSaved);
  } catch (err) {}

  const user = savedAccounts.find((u) => u.username === username);
  if (user) {
    window.parent.localStorage.setItem("currentUser", JSON.stringify(user));
    window.parent.localStorage.setItem("isAuthenticated", "true");
    window.location.reload();
  }
}

function toggleProfileMenu() {
  const menu = document.getElementById("profileDropdown");
  if (menu) {
    menu.style.display =
      menu.style.display === "none" || menu.style.display === ""
        ? "block"
        : "none";
  }
}

document.addEventListener("click", (e) => {
  const profile = document.querySelector(".profile");
  const menu = document.getElementById("profileDropdown");
  if (profile && !profile.contains(e.target) && menu) {
    menu.style.display = "none";
  }
});

function switchRole(e) {
  if (e) e.stopPropagation();
  // Don't clear savedAccounts, just clear current session
  window.parent.localStorage.removeItem("isAuthenticated");
  window.parent.location.href = "/login";
}

function stat(icon, num, label, color) {
  return `<div class="stat-card"><div class="stat-icon ${color}">${icon}</div><div><strong>${num}</strong><small>${label}</small></div></div>`;
}

function pageHead(title, desc, button = "") {
  return `<div class="page-head"><div><div class="breadcrumb">Dashboard › ${esc(title)}</div><h1>${esc(title)}</h1><p>${esc(desc)}</p></div>${button}</div>`;
}

function dashboard() {
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
        padding: 40px 40px 30px;
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
      /* Inherited profile styling is slightly adjusted here */
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
      .dc-icon.purple { background: #efeaff; color: #1769aa; } /* used purple bg but blue icon matching mockup */
      
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
        border-radius: 30px 30px 0 0;
        padding: 30px 40px;
        box-shadow: 0 -4px 20px rgba(0,0,0,0.02);
        margin: 0;
      }
      .dash-table-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
      }
      .dash-table-title {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 16px;
        font-weight: 600;
        color: #0c2d5e;
      }
      .dash-table-title svg { color: #1769aa; }
      
      .dash-btn-add {
        background: #0d2d5e;
        color: #fff;
        padding: 10px 18px;
        border-radius: 8px;
        font-weight: 600;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        border: none;
        box-shadow: 0 4px 12px rgba(13, 45, 94, 0.2);
        transition: transform 0.15s, background 0.15s;
      }
      .dash-btn-add:hover {
        background: #154182;
        transform: translateY(-1px);
      }
      
      .dash-link {
        color: #1769aa;
        font-size: 14px;
        font-weight: 600;
        text-decoration: none;
        transition: opacity 0.2s;
      }
      .dash-link:hover { opacity: 0.8; }
      
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
          <h1>Dashboard Admin</h1>
          <p>Pantau dan kelola peminjaman ruang rapat dengan mudah.</p>
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
        <div class="dash-table-header">
          <div class="dash-table-title">${faCalendarAlt} Jadwal Rapat Hari Ini</div>
          <button class="dash-btn-add" onclick="openMeetingModal()">＋ Tambah Rapat</button>
          <a href="#meetings" class="dash-link">Lihat Semua →</a>
        </div>
        ${meetingTable(state.meetings.slice(0, 6), false)}
      </div>
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
  // Hanya role yang mengandung kata "Approval" yang berhak memberi persetujuan
  const canApprove = user.role.includes("Approval");
  const isAdmin = user.role === "Administrator";

  return `<div class="table-wrap"><table class="table"><thead><tr><th>No</th><th>Judul Rapat</th><th>Pemesan</th><th>Ruangan</th><th>Tanggal</th><th>Waktu</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
  ${data
    .map((m, i) => {
      const faEye = svgIcon(
        '<path d="M572.52 241.4C518.29 135.59 410.93 64 288 64S57.68 135.64 3.48 241.41a32.35 32.35 0 0 0 0 29.19C57.71 376.41 165.07 448 288 448s230.32-71.64 284.52-177.41a32.35 32.35 0 0 0 0-29.19zM288 400a144 144 0 1 1 144-144 143.93 143.93 0 0 1-144 144zm0-240a95.31 95.31 0 0 0-25.31 3.79 47.85 47.85 0 0 1-66.9 66.9A95.78 95.78 0 1 0 288 160z"/>',
        "0 0 576 512",
        'width="16" height="16"',
      );

      let actionButtons = `<button style="background-color:#f4f6f9;color:#0c2d5e;border:none;border-radius:10px;width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;margin-right:12px;box-shadow:0 2px 5px rgba(0,0,0,0.03);" title="Lihat" onclick="viewMeeting(${m.id})">${faEye}</button>`;

      if (actions) {
        if (m.status === "Menunggu Approval") {
          if (m.approvedBy) {
            actionButtons += `<span style="font-size:11px;color:#219653;margin-right:8px;font-weight:700;background:#e2f7ec;padding:6px 12px;border-radius:12px;" title="Disetujui oleh ${esc(m.approvedBy)}">Disetujui: ${esc(m.approvedBy)}</span>`;
          } else if (m.rejectedBy) {
            actionButtons += `<span style="font-size:11px;color:#ff4d4f;margin-right:8px;font-weight:700;background:#ffebee;padding:6px 12px;border-radius:12px;">Ditolak (${esc(m.rejectedBy)})</span>`;
          } else if (canApprove) {
            actionButtons += `<button style="background-color:#219653;color:#fff;border:none;border-radius:24px;padding:8px 16px;font-weight:700;font-size:12px;cursor:pointer;margin-right:6px;" title="Setujui" onclick="approveMeeting(${m.id})">Setujui</button>`;
            actionButtons += `<button style="background-color:#ff4d4f;color:#fff;border:none;border-radius:24px;padding:8px 16px;font-weight:700;font-size:12px;cursor:pointer;" title="Tolak" onclick="rejectMeeting(${m.id})">Tolak</button>`;
          } else {
            actionButtons += `<span style="font-size:11px;color:#718096;margin-right:8px;font-weight:600;">Menunggu Approval</span>`;
          }
        } else if (m.status === "Akan Datang") {
          if (m.approvedBy) {
            actionButtons += `<span style="font-size:11px;color:#219653;margin-right:8px;font-weight:600;" title="Disetujui oleh ${esc(m.approvedBy)}">✓ Disetujui (${esc(m.approvedBy)})</span>`;
          }
          if (isAdmin) {
            actionButtons += `<button style="background-color:#219653;color:#fff;border:none;border-radius:24px;padding:8px 16px;font-weight:700;font-size:13px;cursor:pointer;box-shadow:0 4px 10px rgba(33,150,83,0.2);" title="Check In" onclick="checkInMeeting(${m.id})">Check In</button>`;
          }
        } else if (m.status === "Berjalan") {
          if (isAdmin) {
            actionButtons += `<button style="background-color:#ff4d4f;color:#fff;border:none;border-radius:24px;padding:8px 16px;font-weight:700;font-size:13px;cursor:pointer;box-shadow:0 4px 10px rgba(255,77,79,0.2);" title="Check Out" onclick="checkOutMeeting(${m.id})">Check Out</button>`;
          }
        }
      }
      return `<tr><td>${i + 1}</td><td><b>${esc(m.title)}</b></td><td>${esc(m.requester)}</td><td>${esc(m.room)}</td><td>${formatDate(m.date)}</td><td>${m.start}-${m.end}</td><td>${badge(m.status)}</td><td><div class="actions">${actionButtons}</div></td></tr>`;
    })
    .join("")}</tbody></table></div>`;
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
  if (r.image) return r.image;
  const n = (r.name || "").toLowerCase();
  if (n.includes("konsultasi")) {
    return "https://images.unsplash.com/photo-1577412647305-991150c7d163?auto=format&fit=crop&q=80&w=600&h=400";
  }
  return "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=600&h=400";
}


function rooms() {
  // SVG Icons
  // BsBuildingFillGear
  const bsBuildingGear = svgIcon(
    '<path d="M2 1a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v7.256A4.5 4.5 0 0 0 12.5 8a4.5 4.5 0 0 0-3.59 1.787A.5.5 0 0 0 9 9.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .39-.187A4.5 4.5 0 0 0 8.027 12H6.5a.5.5 0 0 0-.5.5V16H3a1 1 0 0 1-1-1zm2 1.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5m3 0v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5m3.5-.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5zM4 5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5M7.5 5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5zm2.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5M4.5 8a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5z"/><path d="M11.886 9.46c.18-.613 1.048-.613 1.229 0l.043.148a.64.64 0 0 0 .921.382l.136-.074c.561-.306 1.175.308.87.869l-.075.136a.64.64 0 0 0 .382.92l.149.045c.612.18.612 1.048 0 1.229l-.15.043a.64.64 0 0 0-.38.921l.074.136c.305.561-.309 1.175-.87.87l-.136-.075a.64.64 0 0 0-.92.382l-.045.149c-.18.612-1.048.612-1.229 0l-.043-.15a.64.64 0 0 0-.921-.38l-.136.074c-.561.305-1.175-.309-.87-.87l.075-.136a.64.64 0 0 0-.382-.92l-.148-.045c-.613-.18-.613-1.048 0-1.229l.148-.043a.64.64 0 0 0 .382-.921l-.074-.136c-.306-.561.308-1.175.869-.87l.136.075a.64.64 0 0 0 .92-.382zM14 12.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0"/>',
    '0 0 16 16',
    'width="36" height="36" fill="#1769aa"'
  );

  // FaCheck
  const faCheck = svgIcon(
    '<path d="M173.898 439.404l-166.4-166.4c-9.997-9.997-9.997-26.206 0-36.204l36.203-36.204c9.997-9.998 26.207-9.998 36.204 0L192 312.69 432.095 72.596c9.997-9.997 26.207-9.997 36.204 0l36.203 36.204c9.997 9.997 9.997 26.206 0 36.204l-294.4 294.401c-9.998 9.997-26.207 9.997-36.204-.001z"/>',
    '0 0 512 512',
    'width="22" height="22" fill="#0c2d5e"'
  );

  // FaTimes
  const faTimes = svgIcon(
    '<path d="M242.72 256l100.07-100.07c12.28-12.28 12.28-32.19 0-44.48l-22.24-22.24c-12.28-12.28-32.19-12.28-44.48 0L176 189.28 75.93 89.21c-12.28-12.28-32.19-12.28-44.48 0L9.21 111.45c-12.28 12.28-12.28 32.19 0 44.48L109.28 256 9.21 356.07c-12.28 12.28-12.28 32.19 0 44.48l22.24 22.24c12.28 12.28 32.2 12.28 44.48 0L176 322.72l100.07 100.07c12.28 12.28 32.2 12.28 44.48 0l22.24-22.24c12.28-12.28 12.28-32.19 0-44.48L242.72 256z"/>',
    '0 0 352 512',
    'width="18" height="18" fill="#1769aa"'
  );

  // IoSearch
  const ioSearch = svgIcon(
    '<path d="M456.69 421.39 362.6 327.3a173.8 173.8 0 0 0 34.84-104.58C397.44 126.38 319.06 48 222.72 48S48 126.38 48 222.72s78.38 174.72 174.72 174.72A173.8 173.8 0 0 0 327.3 362.6l94.09 94.09a25 25 0 0 0 35.3-35.3M97.92 222.72a124.8 124.8 0 1 1 124.8 124.8 124.95 124.95 0 0 1-124.8-124.8"/>',
    '0 0 512 512',
    'width="18" height="18"'
  );

  const totalRooms = state.rooms.length;
  const tersediaRooms = state.rooms.filter(r => r.status === "Tersedia").length;
  const terpakaiRooms = state.rooms.filter(r => r.status === "Sedang Digunakan" || r.status === "Terpakai").length;
  const perbaikanRooms = state.rooms.filter(r => r.status === "Dalam Perbaikan" || r.status === "Perbaikan").length;

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
    .map(
      (r) => `
        <div class="custom-room-card" onclick="editRoom(${r.id})">
          <div class="crc-img-wrap">
            <img src="${getRoomImage(r)}" alt="${esc(r.name)}" class="crc-img">
          </div>
          <div class="crc-footer">
            <span>${esc(r.name)}</span>
          </div>
        </div>
      `
    )
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
      
      .dash-filters {
        display: flex;
        gap: 16px;
        margin-bottom: 24px;
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
    (u) => u.role.includes("Admin") || u.role === "Administrator",
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
          <div class="dash-search-box">
            ${ioSearch}
            <input id="userSearch" placeholder="Cari pengguna..." oninput="filterUsers()">
          </div>
          <select id="userRole" onchange="filterUsers()">
            <option value="">Semua Role</option>
            <option>User</option>
            <option>Admin Utama</option>
            <option>Admin Persetujuan</option>
          </select>
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

  return `<div class="table-wrap"><table class="table"><thead><tr><th>No</th><th>Nama</th><th>Email</th><th>Jabatan/Unit</th><th>Role</th><th>Aksi</th></tr></thead><tbody>${data
    .map((u, i) => {
      let roleColor = "#ffe6e6"; // Default/pinkish
      if (u.role === "User") roleColor = "#ffe5d9"; // Peach
      const badgeStyle = `background:${roleColor};color:#0c2d5e;padding:6px 12px;border-radius:12px;font-size:11px;font-weight:700;`;
      return `<tr><td>${i + 1}</td><td><b>${esc(u.name)}</b></td><td>${esc(u.email)}</td><td>${esc(u.dept)}</td><td><span style="${badgeStyle}">${esc(u.role)}</span></td><td><div class="actions" style="gap:12px;"><button style="background:none;border:none;color:#4b6a90;cursor:pointer;" title="Edit" onclick="editUser(${u.id})">${faPencilAlt}</button><button style="background:none;border:none;color:#4b6a90;cursor:pointer;" title="Hapus" onclick="deleteUser(${u.id})">${faTrashAlt}</button></div></td></tr>`;
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
          <h2>September 2026</h2>
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
// `meetingTable(state.meetings, true, false)`
// ----------------------------------------------------------------------
function reports() {
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
  const biExport = svgIcon(
    '<path d="M11 16h2V7h3l-4-5-4 5h3z"/><path d="M5 22h14c1.103 0 2-.897 2-2v-9c0-1.103-.897-2-2-2h-4v2h4v9H5v-9h4V9H5c-1.103 0-2 .897-2 2v9c0 1.103.897 2 2 2z"/>',
    "0 0 24 24",
    'width="18" height="18"',
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

  let customTableHTML = `<div class="rep-list"><table><thead><tr><th>No</th><th>Nama Rapat</th><th>Pembicara</th><th>Ruangan</th><th>Tanggal</th><th>Waktu</th><th>Status</th><th>Aksi</th></tr></thead><tbody>`;
  state.meetings.forEach((m, i) => {
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
    } else if (m.status === "Sesuai") {
      statusColor = "#d4e6f6";
      statusText = "#1769aa";
    } else {
      statusColor = "#fff7e0";
      statusText = "#b38600";
    } // Segera etc

    let actionBtn = `<button style="background-color:#f4f6f9;color:#0c2d5e;border:none;border-radius:10px;width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;" title="Lihat" onclick="viewMeeting(${m.id})">${faEye}</button>`;

    customTableHTML += `<tr>
      <td>${i + 1}</td>
      <td style="font-weight:700;">${esc(m.title)}</td>
      <td>${esc(m.requester)}</td>
      <td>${esc(m.room)}</td>
      <td>${formatDate(m.date)}</td>
      <td>${m.start}-${m.end}</td>
      <td><span style="background:${statusColor};color:${statusText};padding:6px 12px;border-radius:12px;font-size:11px;font-weight:700;">${esc(m.status)}</span></td>
      <td>${actionBtn}</td>
    </tr>`;
  });
  customTableHTML += `</tbody></table></div>`;

  return (
    customCSS +
    `
    <div class="rep-page-wrapper">
      <div class="rep-header">
        <div>
          <div class="rep-breadcrumb">Dashboard > Laporan</div>
          <h1>Laporan</h1>
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
        <div>
          <select class="rep-export-btn" id="exportDropdown" onchange="handleExportDropdown(this)" style="appearance:none; padding-right:10px;">
            <option value="" disabled selected>📄 Export</option>
            <option value="excel" style="background: white; color: black; text-align: left;">📊 Excel</option>
            <option value="pdf" style="background: white; color: black; text-align: left;">📄 PDF</option>
          </select>
        </div>
      </div>
      
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
      
      <div class="rep-charts">
        <div class="rep-chart-card">
          <div style="display:flex;justify-content:space-between;">
            <h2>Tren Jumlah Rapat</h2>
            <span style="font-size:12px;color:#4b6a90;">Bulan Ini</span>
          </div>
          <div class="mock-bar-chart">
            ${[20, 35, 45, 50, 60, 65, 75, 80, 85, 95, 100].map((h, i) => `<div class="mock-bar ${i % 2 === 0 ? "dark" : ""}" style="height:${h}%"><span>${i + 2}</span></div>`).join("")}
          </div>
        </div>
        <div class="rep-chart-card">
          <h2>Status Rapat</h2>
          <div class="mock-donut">
             <div style="position:absolute; top:-10px; left:-5px; font-size:9px;">Selesai<br>15.8%</div>
             <div style="position:absolute; bottom:10px; left:-10px; font-size:9px;">Segera<br>26.3%</div>
             <div style="position:absolute; bottom:10px; right:-10px; font-size:9px;">Berjalan<br>57.9%</div>
          </div>
        </div>
        <div class="rep-chart-card">
          <h2>Penggunaan Ruangan</h2>
          <div style="font-size:11px; margin-bottom:4px; display:flex; gap:10px; justify-content:center; color:#4b6a90;">
            <span style="display:flex;align-items:center;gap:4px;"><div style="width:6px;height:6px;background:#4285f4;border-radius:50%;"></div> Penggunaan</span>
            <span style="display:flex;align-items:center;gap:4px;"><div style="width:6px;height:6px;background:#4a4a4a;border-radius:50%;"></div> Kosong</span>
          </div>
          <div style="font-size:10px;margin-bottom:2px;">Ruang Nusantara</div>
          <div class="mock-stacked-bar"><div class="mock-stacked-bar-fill" style="width:85%"></div></div>
          <div style="font-size:10px;margin-bottom:2px;">Ruang Garuda</div>
          <div class="mock-stacked-bar"><div class="mock-stacked-bar-fill" style="width:75%"></div></div>
        </div>
      </div>
      
      ${customTableHTML}
    </div>
  `
  );
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
    'width="24" height="24" fill="#047857"'
  );

  const faUserCog = svgIcon(
    '<path d="M610.5 373.3c2.6-14.1 2.6-28.5 0-42.6l25.8-14.9c3-1.7 4.3-5.2 3.3-8.5-6.7-21.6-18.2-41.2-33.2-57.4-2.3-2.5-6-3.1-9-1.4l-25.8 14.9c-10.9-9.3-23.4-16.5-36.9-21.3v-29.8c0-3.4-2.4-6.4-5.7-7.1-22.3-5-45-4.8-66.2 0-3.3.7-5.7 3.7-5.7 7.1v29.8c-13.5 4.8-26 12-36.9 21.3l-25.8-14.9c-2.9-1.7-6.7-1.1-9 1.4-15 16.2-26.5 35.8-33.2 57.4-1 3.3.4 6.8 3.3 8.5l25.8 14.9c-2.6 14.1-2.6 28.5 0 42.6l-25.8 14.9c-3 1.7-4.3 5.2-3.3 8.5 6.7 21.6 18.2 41.1 33.2 57.4 2.3 2.5 6 3.1 9 1.4l25.8-14.9c10.9 9.3 23.4 16.5 36.9 21.3v29.8c0 3.4 2.4 6.4 5.7 7.1 22.3 5 45 4.8 66.2 0 3.3-.7 5.7-3.7 5.7-7.1v-29.8c13.5-4.8 26-12 36.9-21.3l25.8 14.9c2.9 1.7 6.7 1.1 9-1.4 15-16.2 26.5-35.8 33.2-57.4 1-3.3-.4-6.8-3.3-8.5l-25.8-14.9zM496 400.5c-26.8 0-48.5-21.8-48.5-48.5s21.8-48.5 48.5-48.5 48.5 21.8 48.5 48.5-21.7 48.5-48.5 48.5zM224 256c70.7 0 128-57.3 128-128S294.7 0 224 0 96 57.3 96 128s57.3 128 128 128zm201.2 226.5c-2.3-1.2-4.6-2.6-6.8-3.9l-7.9 4.6c-6 3.4-12.8 5.3-19.6 5.3-10.9 0-21.4-4.6-28.9-12.6-18.3-19.8-32.3-43.9-40.2-69.6-5.5-17.7 1.9-36.4 17.9-45.7l7.9-4.6c-.1-2.6-.1-5.2 0-7.8l-7.9-4.6c-16-9.2-23.4-28-17.9-45.7.9-2.9 2.2-5.8 3.2-8.7-3.8-.3-7.5-1.2-11.4-1.2h-16.7c-22.2 10.2-46.9 16-72.9 16s-50.6-5.8-72.9-16h-16.7C60.2 288 0 348.2 0 422.4V464c0 26.5 21.5 48 48 48h352c10.1 0 19.5-3.2 27.2-8.5-1.2-3.8-2-7.7-2-11.8v-9.2z"/>',
    "0 0 640 512",
    'width="24" height="24" fill="#1769aa"'
  );

  const faCheck = svgIcon(
    '<path d="M173.898 439.404l-166.4-166.4c-9.997-9.997-9.997-26.206 0-36.204l36.203-36.204c9.997-9.998 26.207-9.998 36.204 0L192 312.69 432.095 72.596c9.997-9.997 26.207-9.997 36.204 0l36.203 36.204c9.997 9.997 9.997 26.206 0 36.204l-294.4 294.401c-9.998 9.997-26.207 9.997-36.204-.001z"/>',
    "0 0 512 512",
    'width="20" height="20" fill="#d97706"'
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
    'width="15" height="15" fill="#0c2d5e"'
  );

  const totalRoles = 4;
  const totalUsers = state.users ? state.users.length : 10;
  const adminAktif = state.users ? state.users.filter(u => u.role === "Administrator").length : 1;
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
              ${rolesData.map(r => `
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
              `).join("")}
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
  const page = location.hash.replace("#", "") || "dashboard";

  const validPages = [
    "dashboard",
    "meetings",
    "rooms",
    "users",
    "calendar",
    "reports",
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

function openMeetingModal(id = null) {
  const m = id
    ? state.meetings.find((x) => x.id === id)
    : {
        title: "",
        requester: "",
        room: state.rooms[0].name,
        date: "2026-09-24",
        start: "09:00",
        end: "10:00",
        participants: 10,
        status: "Menunggu Approval",
        desc: "",
      };
  openModal(
    id ? "Edit Rapat" : "Tambah Rapat",
    `<div class="form-grid">
 <div class="field full"><label>Judul Rapat</label><input id="fTitle" value="${esc(m.title)}"></div>
 <div class="field"><label>Pemesan</label><input id="fRequester" value="${esc(m.requester)}"></div>
 <div class="field"><label>Ruangan</label><select id="fRoom">${state.rooms.map((r) => `<option ${r.name === m.room ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select></div>
 <div class="field"><label>Tanggal</label><input id="fDate" type="date" value="${m.date}"></div>
 <div class="field"><label>Peserta</label><input id="fParticipants" type="number" value="${m.participants}"></div>
 <div class="field"><label>Mulai</label><input id="fStart" type="time" value="${m.start}"></div><div class="field"><label>Selesai</label><input id="fEnd" type="time" value="${m.end}"></div>
 <div class="field full"><label>Status</label><select id="fStatus">${["Menunggu Approval", "Akan Datang", "Segera", "Berjalan", "Selesai", "Dibatalkan"].map((s) => `<option ${s === m.status ? "selected" : ""}>${s}</option>`).join("")}</select></div>
 <div class="field full"><label>Deskripsi</label><textarea id="fDesc" rows="3">${esc(m.desc)}</textarea></div></div>
 <div class="modal-actions"><button class="btn btn-light" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="saveMeeting(${id || "null"})">Simpan</button></div>`,
  );
}

async function saveMeeting(id) {
  const obj = {
    id: id || Date.now(),
    title: f("fTitle"),
    requester: f("fRequester"),
    room: f("fRoom"),
    date: f("fDate"),
    start: f("fStart"),
    end: f("fEnd"),
    participants: Number(f("fParticipants")),
    status: f("fStatus"),
    desc: f("fDesc"),
  };

  const reqLower = obj.requester.toLowerCase();
  if (reqLower.includes("pimpinan") || reqLower.includes("kepala")) {
    let cancelled = false;
    state.meetings = state.meetings.map((m) => {
      if (
        m.room === obj.room &&
        m.date === obj.date &&
        m.id !== obj.id &&
        m.status !== "Dibatalkan" &&
        m.status !== "Selesai"
      ) {
        if (obj.start < m.end && obj.end > m.start) {
          cancelled = true;
          return {
            ...m,
            status: "Dibatalkan",
            desc:
              m.desc +
              "\n[Dibatalkan otomatis: Jadwal diambil alih oleh Pimpinan/Kepala Bagian]",
          };
        }
      }
      return m;
    });
    if (cancelled)
      toast("Beberapa rapat otomatis dibatalkan karena prioritas pimpinan.");
  }

  if (id) state.meetings = state.meetings.map((x) => (x.id === id ? obj : x));
  else state.meetings.unshift(obj);

  closeModal();
  render();
  toast(id ? "Rapat berhasil diedit" : "Rapat berhasil ditambahkan");

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
  const targetMeeting = state.meetings.find((m) => m.id === id);

  if (!targetMeeting) return;

  // Jika sudah di approve oleh salah satu akun maka di akun lain tidak bisa approve lagi
  if (targetMeeting.approvedBy || targetMeeting.status !== "Menunggu Approval") {
    alert("Rapat ini sudah disetujui sebelumnya oleh " + (targetMeeting.approvedBy || "akun lain") + " dan tidak dapat disetujui kembali.");
    return;
  }

  const approverName = user.name || user.username || user.role || "Admin Persetujuan";
  const approverRole = user.role || "Approval";
  const approvedTag = approverName + (approverRole ? " - " + approverRole : "");

  state.meetings = state.meetings.map((m) => {
    if (m.id === id) {
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
    window.parent.localStorage.setItem("app_meetings", JSON.stringify(state.meetings));
  } catch (e) {}

  render();
  toast("Rapat berhasil disetujui oleh " + approverName);
}

function checkInMeeting(id) {
  state.meetings = state.meetings.map((m) => {
    if (m.id === id) return { ...m, status: "Berjalan" };
    return m;
  });
  try {
    window.parent.localStorage.setItem("app_meetings", JSON.stringify(state.meetings));
  } catch (e) {}
  render();
  toast("Berhasil Check-In! Rapat telah berjalan.");
}

function checkOutMeeting(id) {
  if (confirm("Tandai rapat ini sebagai selesai?")) {
    state.meetings = state.meetings.map((m) => {
      if (m.id === id) return { ...m, status: "Selesai" };
      return m;
    });
    try {
      window.parent.localStorage.setItem("app_meetings", JSON.stringify(state.meetings));
    } catch (e) {}
    render();
    toast("Berhasil Check-Out! Rapat telah selesai.");
  }
}

function rejectMeeting(id) {
  const targetMeeting = state.meetings.find((m) => m.id === id);
  if (targetMeeting && (targetMeeting.approvedBy || targetMeeting.status !== "Menunggu Approval")) {
    alert("Rapat ini sudah disetujui oleh " + (targetMeeting.approvedBy || "akun lain") + " sehingga tidak dapat ditolak.");
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
       <button class="btn btn-primary" style="background:#c9363d;border-color:#c9363d;" onclick="confirmReject(${id})">Tolak Rapat</button>
     </div>`,
  );
}

function confirmReject(id) {
  const user = getCurrentUser();
  const reason =
    document.getElementById("fRejectReason").value.trim() ||
    "Tidak ada alasan yang diberikan";
  const rejecterName = user.name || user.username || user.role || "Admin Persetujuan";
  const rejecterRole = user.role || "Approval";
  const rejecterTag = rejecterName + (rejecterRole ? " - " + rejecterRole : "");

  state.meetings = state.meetings.map((m) => {
    if (m.id === id)
      return {
        ...m,
        status: "Dibatalkan",
        rejectedBy: rejecterTag,
        desc: m.desc + "\n\n[Dibatalkan oleh " + rejecterName + ": " + reason + "]",
      };
    return m;
  });

  try {
    window.parent.localStorage.setItem("app_meetings", JSON.stringify(state.meetings));
  } catch (e) {}

  closeModal();
  render();
  toast("Rapat berhasil ditolak & dibatalkan");
}

function editMeeting(id) {
  openMeetingModal(id);
}

function viewMeeting(id) {
  const m = state.meetings.find((x) => x.id === id);
  openModal(
    "Detail Rapat",
    `<p><b>${esc(m.title)}</b></p><p class="muted" style="margin:12px 0">${formatDate(m.date)} · ${m.start}-${m.end}</p><p>📍 ${esc(m.room)}</p><p>👤 ${esc(m.requester)}</p><p>👥 ${m.participants} peserta</p><p style="margin-top:15px">${esc(m.desc)}</p>
    <div class="modal-actions" style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px;">
      <button class="btn btn-primary" style="background-color: #4a5568; border-color: #4a5568;" onclick="exportNotulensiPDF(${id})">📄 Notulensi</button>
      
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


function openRoomModal(id = null) {
  const r = id
    ? state.rooms.find((x) => x.id === id)
    : {
        name: "",
        location: "",
        capacity: "",
        status: "Tersedia",
        facilities: "",
      };

  const modalBackdrop = document.getElementById("modal");
  modalBackdrop.innerHTML = `
    <div class="custom-room-modal" onclick="event.stopPropagation()">
      <h2>Tambahan Ruangan</h2>
      <div class="crm-field full">
        <label>Nama Ruangan</label>
        <input id="rName" value="${esc(r.name)}" placeholder="">
      </div>
      <div class="crm-row">
        <div class="crm-field">
          <label>Lokasi</label>
          <input id="rLocation" value="${esc(r.location)}" placeholder="">
        </div>
        <div class="crm-field">
          <label>Kapasitas</label>
          <input id="rCapacity" type="number" value="${r.capacity || ''}" placeholder="">
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
          <input id="rFacilities" value="${esc(r.facilities)}" placeholder="">
        </div>
      </div>
      <div class="crm-actions">
        <button type="button" class="crm-btn-cancel" onclick="closeModal()">Batal</button>
        <button type="button" class="crm-btn-save" onclick="saveRoom(${id || "null"})">Simpan</button>
      </div>
    </div>
  `;
  modalBackdrop.onclick = function(e) {
    if (e.target === modalBackdrop) closeModal();
  };
  modalBackdrop.classList.add("show");
}

async function saveRoom(id) {
  const name = f("rName").trim();
  if (!name) {
    alert("Nama ruangan tidak boleh kosong");
    return;
  }
  const obj = {
    id: id || Date.now(),
    name: name,
    location: f("rLocation") || "Gedung A - Lantai 3",
    capacity: Number(f("rCapacity")) || 10,
    status: f("rStatus") || "Tersedia",
    facilities: f("rFacilities") || "",
  };
  obj.image = getRoomImage(obj);

  if (id) {
    state.rooms = state.rooms.map((x) => (x.id === id ? { ...x, ...obj } : x));
  } else {
    state.rooms.push(obj);
  }

  try {
    window.parent.localStorage.setItem("app_rooms", JSON.stringify(state.rooms));
  } catch(e) {}

  closeModal();
  render();
  toast("Data ruangan disimpan");

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
  const u = id
    ? state.users.find((x) => x.id === id)
    : { name: "", email: "", dept: "", role: "User", status: "Aktif" };
  openModal(
    id ? "Edit Pengguna" : "Tambah Pengguna",
    `<div class="form-grid"><div class="field full"><label>Nama</label><input id="uName" value="${esc(u.name)}"></div><div class="field"><label>Email</label><input id="uEmail" type="email" value="${esc(u.email)}"></div><div class="field"><label>Unit/Jabatan</label><input id="uDept" value="${esc(u.dept)}"></div><div class="field"><label>Role</label><select id="uRole">${["User", "Admin Ruangan", "Admin Sistem", "Administrator"].map((s) => `<option ${s === u.role ? "selected" : ""}>${s}</option>`).join("")}</select></div><div class="field"><label>Status</label><select id="uStatus"><option ${u.status === "Aktif" ? "selected" : ""}>Aktif</option><option ${u.status === "Nonaktif" ? "selected" : ""}>Nonaktif</option></select></div></div><div class="modal-actions"><button class="btn btn-light" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="saveUser(${id || "null"})">Simpan</button></div>`,
  );
}

async function saveUser(id) {
  const obj = {
    id: id || Date.now(),
    name: f("uName"),
    email: f("uEmail"),
    dept: f("uDept"),
    role: f("uRole"),
    status: f("uStatus"),
  };
  if (id) state.users = state.users.map((x) => (x.id === id ? obj : x));
  else state.users.push(obj);
  closeModal();
  render();
  toast("Data pengguna disimpan");

  try {
    await fetch("/api/dashboard/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(obj),
    });
  } catch (err) {
    console.error("Gagal menyimpan pengguna ke backend:", err);
  }
}

function editUser(id) {
  openUserModal(id);
}

async function deleteUser(id) {
  if (confirm("Hapus pengguna ini?")) {
    state.users = state.users.filter((x) => x.id !== id);
    render();
    toast("Pengguna dihapus");

    try {
      await fetch(`/api/dashboard/users/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("Gagal menghapus pengguna di backend:", err);
    }
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
  const q = (document.getElementById("roomSearch")?.value || "").toLowerCase().trim();
  const s = document.getElementById("roomStatus")?.value || "";

  const filtered = state.rooms.filter((r) => {
    const matchName = r.name.toLowerCase().includes(q) || (r.location && r.location.toLowerCase().includes(q));
    if (!matchName) return false;
    if (!s) return true;
    if (s === "Tersedia") return r.status === "Tersedia";
    if (s === "Sedang Digunakan") return r.status === "Sedang Digunakan" || r.status === "Terpakai";
    if (s === "Dalam Perbaikan") return r.status === "Dalam Perbaikan" || r.status === "Perbaikan";
    return r.status === s;
  });

  const grid = document.getElementById("roomGrid");
  if (grid) {
    grid.innerHTML = roomCards(filtered);
  }
}


function filterUsers() {
  const q = (document.getElementById("userSearch").value || "").toLowerCase(),
    r = document.getElementById("userRole").value;
  document.getElementById("userTable").innerHTML = userTable(
    state.users.filter(
      (u) =>
        (u.name + " " + u.email).toLowerCase().includes(q) &&
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

    const m = state.meetings.find((x) => x.id === id);

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
    if (Array.isArray(data.meetings) && data.meetings.length > 0) {
      state.meetings = data.meetings;
    }
    if (Array.isArray(data.rooms) && data.rooms.length > 0) {
      state.rooms = data.rooms;
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

render();
fetchDashboardData(false);
setInterval(() => fetchDashboardData(false), 30000);

// ----------------------------------------------------------------------
// LOGOUT FUNCTION
// ----------------------------------------------------------------------
function logout(e) {
  if (e) e.stopPropagation();
  if (confirm("Apakah Anda yakin ingin keluar?")) {
    window.parent.localStorage.removeItem("isAuthenticated");
    window.parent.location.href = "/login";
  }
}

function getCurrentUser() {
  let u = { role: "User", name: "User" };
  try {
    const s = window.parent.localStorage.getItem("currentUser");
    if (s) u = JSON.parse(s);
  } catch (e) {}
  return u;
}
