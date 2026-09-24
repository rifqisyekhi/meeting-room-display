const state = {
  page: location.hash.replace("#", "") || "dashboard",
  reportFilter: {
    mode: "bulanan",
    startDate: "2026-09-01",
    endDate: "2026-09-30",
  },
  meetings: [
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
      status: "Berjalan",
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
      status: "Segera",
      participants: 15,
      desc: "Evaluasi capaian program.",
    },
    {
      id: 4,
      title: "Rapat Internal",
      requester: "Dewi Lestari",
      room: "Ruang Indonesia",
      date: "2026-09-22",
      start: "15:00",
      end: "17:00",
      status: "Segera",
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
  rooms: [
    {
      id: 1,
      name: "Ruang Nusantara",
      location: "Gedung Pusat, Lt. 3",
      capacity: 20,
      status: "Tersedia",
      facilities: "Proyektor, TV, WiFi, Sound System",
    },
    {
      id: 2,
      name: "Ruang Garuda",
      location: "Gedung Pusat, Lt. 3",
      capacity: 15,
      status: "Tersedia",
      facilities: "TV, WiFi, AC",
    },
  ],
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

const nav = [
  ["dashboard", "🏠", "Dashboard"],
  ["meetings", "📅", "Manajemen Rapat"],
  ["rooms", "🏢", "Manajemen Ruangan"],
  ["users", "👥", "Pengguna"],
  ["calendar", "🗓️", "Kalender"],
  ["reports", "📊", "Laporan"],
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
  return s === "Berjalan" || s === "Aktif" || s === "Tersedia"
    ? "green"
    : s === "Segera" || s === "Akan Datang" || s === "Perbaikan"
      ? "yellow"
      : s === "Selesai"
        ? "blue"
        : s === "Administrator" || s === "Admin Ruangan" || s === "Admin Sistem"
          ? "purple"
          : "red";
}

function badge(s) {
  return `<span class="badge ${statusClass(s)}">${esc(s)}</span>`;
}

function layout(content) {
  return `<div class="app-shell"><aside class="sidebar">
    <div class="brand"><img src="/dashboard/assets/kemnaker.png" alt="Logo Kemnaker" class="brand-logo"><div>KEMNAKER<small style="display:block;font-size:9px;font-weight:500">Kementerian Ketenagakerjaan</small></div></div>
    <nav class="nav">${nav.map(([id, icon, label]) => `<a href="#${id}" class="nav-item ${state.page === id ? "active" : ""}"><span>${icon}</span>${label}</a>`).join("")}</nav>
    <div class="sidebar-footer">
      <a href="/" target="_top" style="display:inline-block;margin-bottom:12px;padding:6px 12px;background:rgba(255,255,255,0.12);color:#fff;text-decoration:none;border-radius:6px;font-size:11px;font-weight:600;letter-spacing:0.3px;">📺 Ke Display TV</a><br>
      Bekerja Bersama<br>untuk Tenaga Kerja<br>yang Lebih Baik
    </div>
  </aside><main class="main">
    <header class="topbar"><input class="search" placeholder="Cari rapat, ruangan, pengguna..." oninput="globalSearch(this.value)">
      <div class="top-actions"><span>🔔</span><div class="profile"><div class="avatar">W</div><div><b>Windy Nuraini Putri</b><small style="display:block;color:#718096">Administrator</small></div></div></div>
    </header><section class="content">${content}</section></main></div><div id="modal" class="modal-backdrop"></div>`;
}

function stat(icon, num, label, color) {
  return `<div class="stat-card"><div class="stat-icon ${color}">${icon}</div><div><strong>${num}</strong><small>${label}</small></div></div>`;
}

function pageHead(title, desc, button = "") {
  return `<div class="page-head"><div><div class="breadcrumb">Dashboard › ${esc(title)}</div><h1>${esc(title)}</h1><p>${esc(desc)}</p></div>${button}</div>`;
}

function dashboard() {
  const running = state.meetings.filter((x) => x.status === "Berjalan").length;
  const soon = state.meetings.filter((x) => x.status === "Segera").length;
  const done = state.meetings.filter((x) => x.status === "Selesai").length;
  return (
    pageHead(
      "Dashboard Admin",
      "Pantau dan kelola peminjaman ruang rapat dengan mudah.",
      `<button class="btn btn-primary" onclick="openMeetingModal()">＋ Tambah Rapat</button>`,
    ) +
    `<div class="cards">${stat("📅", state.meetings.length, "Total Rapat", "blue")}${stat("▶", running, "Rapat Berjalan", "green")}${stat("◷", soon, "Rapat Segera", "yellow")}${stat("✓", done, "Rapat Selesai", "purple")}</div>
 <div class="layout-2"><div class="panel"><div class="panel-head"><h2>Jadwal Rapat Hari Ini</h2><a href="#meetings">Lihat Semua →</a></div>${meetingTable(state.meetings.slice(0, 6), false)}</div>
 <div class="panel"><div class="panel-head"><h2>Rapat Hari Ini</h2></div>${state.meetings
   .slice(0, 6)
   .map(
     (m) =>
       `<div style="padding:12px 0;border-bottom:1px solid var(--border)"><b>${esc(m.title)}</b><div class="muted" style="font-size:12px">${m.start} - ${m.end} ·${esc(m.room)}</div></div>`,
   )
   .join("")}</div></div>`
  );
}

// ----------------------------------------------------------------------
// BAGIAN YANG DIUBAH: Penambahan parameter "allowDelete" agar tombol
// hapus bisa disembunyikan secara kondisional
// ----------------------------------------------------------------------
function meetingTable(data, actions = true, allowDelete = true) {
  return `<div class="table-wrap"><table class="table"><thead><tr><th>No</th><th>Judul Rapat</th><th>Pemesan</th><th>Ruangan</th><th>Tanggal</th><th>Waktu</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
 ${data.map((m, i) => `<tr><td>${i + 1}</td><td><b>${esc(m.title)}</b></td><td>${esc(m.requester)}</td><td>${esc(m.room)}</td><td>${formatDate(m.date)}</td><td>${m.start}-${m.end}</td><td>${badge(m.status)}</td><td><div class="actions"><button class="btn-icon" title="Lihat" onclick="viewMeeting(${m.id})">👁</button>${actions ? `<button class="btn-icon" title="Edit" onclick="editMeeting(${m.id})">✎</button>${allowDelete ? `<button class="btn-icon" title="Hapus" onclick="deleteMeeting(${m.id})">🗑</button>` : ""}` : ""}</div></td></tr>`).join("")}</tbody></table></div>`;
}

function meetings() {
  return (
    pageHead(
      "Manajemen Rapat",
      "Kelola data rapat, pantau jadwal, dan pastikan setiap rapat berjalan dengan lancar.",
      `<button class="btn btn-primary" onclick="openMeetingModal()">＋ Tambah Rapat</button>`,
    ) +
    `<div class="cards">${stat("▶", state.meetings.filter((x) => x.status === "Berjalan").length, "Rapat Berjalan", "green")}${stat("◷", state.meetings.filter((x) => x.status === "Segera").length, "Rapat Segera", "yellow")}${stat("📅", state.meetings.length, "Total Rapat", "purple")}${stat("✓", state.meetings.filter((x) => x.status === "Selesai").length, "Rapat Selesai", "blue")}</div>
 <div class="panel"><div class="tabs"><button class="tab active" onclick="filterMeetings('Semua',this)">Semua Rapat (${state.meetings.length})</button><button class="tab" onclick="filterMeetings('Berjalan',this)">Rapat Berjalan</button><button class="tab" onclick="filterMeetings('Segera',this)">Rapat Segera</button><button class="tab" onclick="filterMeetings('Selesai',this)">Rapat Selesai</button></div>
 <div class="filters"><input id="meetingSearch" placeholder="🔎 Cari rapat..." oninput="filterMeetingTable()"><select id="meetingRoom" onchange="filterMeetingTable()"><option value="">Semua Ruangan</option>${state.rooms.map((r) => `<option>${esc(r.name)}</option>`).join("")}</select><select id="meetingStatus" onchange="filterMeetingTable()"><option value="">Semua Status</option><option>Berjalan</option><option>Segera</option><option>Akan Datang</option><option>Selesai</option></select></div>
 <div id="meetingTable">${meetingTable(state.meetings)}</div></div>`
  );
}

function rooms() {
  return (
    pageHead(
      "Manajemen Ruangan",
      "Kelola data ruangan rapat, fasilitas, dan ketersediaannya.",
      `<button class="btn btn-primary" onclick="openRoomModal()">＋ Tambah Ruangan</button>`,
    ) +
    `<div class="cards">${stat("🏢", state.rooms.length, "Total Ruangan", "blue")}${stat("✓", state.rooms.filter((r) => r.status === "Tersedia").length, "Tersedia", "green")}${stat("●", state.rooms.filter((r) => r.status === "Terpakai").length, "Sedang Digunakan", "yellow")}${stat("×", state.rooms.filter((r) => r.status === "Perbaikan").length, "Dalam Perbaikan", "red")}</div>
 <div class="panel"><div class="filters"><input id="roomSearch" placeholder="🔎 Cari nama ruangan..." oninput="filterRooms()"><select id="roomStatus" onchange="filterRooms()"><option value="">Semua Status</option><option>Tersedia</option><option>Terpakai</option><option>Perbaikan</option></select></div><div id="roomGrid" class="room-grid">${roomCards(state.rooms)}</div></div>`
  );
}

function roomCards(data) {
  return data
    .map(
      (r) =>
        `<div class="room-card"><div class="room-photo">🏢</div><div class="room-body"><h3>${esc(r.name)}</h3>${badge(r.status)}<div class="room-meta">📍 ${esc(r.location)}<br>👥 Kapasitas ${r.capacity} orang<br>🖥 ${esc(r.facilities)}</div><button class="btn btn-light" onclick="editRoom(${r.id})">Lihat / Edit</button></div></div>`,
    )
    .join("");
}

function users() {
  return (
    pageHead(
      "Manajemen Pengguna",
      "Kelola data pengguna sistem booking ruang rapat.",
      `<button class="btn btn-primary" onclick="openUserModal()">＋ Tambah Pengguna</button>`,
    ) +
    `<div class="cards">${stat("👥", state.users.length, "Total Pengguna", "blue")}${stat("✓", state.users.filter((u) => u.status === "Aktif").length, "Aktif", "green")}${stat("●", state.users.filter((u) => u.status === "Nonaktif").length, "Nonaktif", "red")}${stat("🛡", state.users.filter((u) => u.role.includes("Admin") || u.role === "Administrator").length, "Administrator", "yellow")}</div>
 <div class="panel"><div class="filters"><input id="userSearch" placeholder="🔎 Cari pengguna..." oninput="filterUsers()"><select id="userRole" onchange="filterUsers()"><option value="">Semua Role</option><option>User</option><option>Admin Ruangan</option><option>Admin Sistem</option><option>Administrator</option></select><select id="userStatus" onchange="filterUsers()"><option value="">Semua Status</option><option>Aktif</option><option>Nonaktif</option></select></div><div id="userTable">${userTable(state.users)}</div></div>`
  );
}

function userTable(data) {
  return `<div class="table-wrap"><table class="table"><thead><tr><th>No</th><th>Nama</th><th>Email</th><th>Jabatan/Unit</th><th>Role</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${data.map((u, i) => `<tr><td>${i + 1}</td><td><b>${esc(u.name)}</b></td><td>${esc(u.email)}</td><td>${esc(u.dept)}</td><td>${badge(u.role)}</td><td>${badge(u.status)}</td><td><div class="actions"><button class="btn-icon" onclick="editUser(${u.id})">✎</button><button class="btn-icon" onclick="deleteUser(${u.id})">🗑</button></div></td></tr>`).join("")}</tbody></table></div>`;
}

function calendar() {
  const days = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
  let cells = days.map((d) => `<div class="head">${d}</div>`).join("");
  for (let i = 1; i <= 30; i++)
    cells += `<div class="${i === 22 ? "today" : ""} ${[2, 8, 12, 15, 22, 23, 28].includes(i) ? "has" : ""}">${i}</div>`;
  return (
    pageHead(
      "Kalender",
      "Lihat jadwal rapat dan ketersediaan ruangan dalam tampilan kalender.",
    ) +
    `<div class="layout-2"><div class="panel"><div class="panel-head"><h2>September 2026</h2><div><button class="btn btn-light">‹</button> <button class="btn btn-light">›</button></div></div><div class="calendar">${cells}</div></div><div class="panel"><div class="panel-head"><h2>Jadwal Hari Ini</h2><button class="btn btn-primary" onclick="openMeetingModal()">＋ Rapat</button></div>${state.meetings.map((m) => `<div style="padding:12px 0;border-bottom:1px solid var(--border)"><b>${esc(m.title)}</b><div class="muted">${m.start}-${m.end} · ${esc(m.room)}</div>${badge(m.status)}</div>`).join("")}</div></div>`
  );
}

// ----------------------------------------------------------------------
// BAGIAN YANG DIUBAH: meetingTable pada Laporan diset tanpa tombol Hapus
// `meetingTable(state.meetings, true, false)`
// ----------------------------------------------------------------------
function reports() {
  return (
    pageHead(
      "Laporan",
      "Ringkasan dan analisis penggunaan ruang rapat.",
      `<div style="display:flex;gap:8px;flex-wrap:wrap">
        <select class="btn btn-primary" id="exportDropdown" onchange="handleExportDropdown(this)" style="cursor: pointer; text-align-last: center;">
          <option value="" disabled selected>📄 Export Pilihan</option>
          <option value="excel" style="background: white; color: black; text-align: left;">📊 Export ke Excel</option>
          <option value="pdf" style="background: white; color: black; text-align: left;">📄 Export ke PDF</option>
        </select>
      </div>`,
    ) +
    `<div class="filters" style="display:flex; gap:12px; align-items:center;">
       <select id="trafficRoom" style="padding:8px 12px; border:1px solid var(--border); border-radius:4px; outline:none;">
         <option value="semua">Semua Ruangan</option>
         ${state.rooms.map((r) => `<option value="${r.name}">${esc(r.name)}</option>`).join("")}
       </select>
       <button class="btn btn-primary" onclick="openFilterModal()" style="background: white; color: var(--primary); border: 1px solid var(--primary);">Filter Waktu</button>
       <button class="btn btn-primary" onclick="generateTrafficReport()">Tampilkan</button>
     </div>
 <div class="cards">${stat("👥", 128, "Total Rapat", "blue")}${stat("◷", "256 Jam", "Total Durasi Rapat", "green")}${stat("👤", "1.240", "Total Peserta", "yellow")}${stat("🏢", "78%", "Tingkat Pemakaian Ruangan", "purple")}</div>
 <div class="chart-grid"><div class="panel"><div class="panel-head"><h2>Tren Jumlah Rapat</h2><span class="muted" id="chartLabel">Bulan Ini</span></div><div class="chart">${[35, 48, 42, 62, 51, 70, 58, 76, 65, 82, 72, 88].map((h, i) => `<div class="bar" style="height:${h}\%"><span>${i + 1}</span></div>`).join("")}</div></div><div class="panel"><div class="panel-head"><h2>Status Rapat</h2></div><div class="donut"></div><div style="text-align:center">${badge("Berjalan")} ${badge("Segera")} ${badge("Selesai")}</div></div><div class="panel"><div class="panel-head"><h2>Penggunaan Ruangan</h2></div>${state.rooms
   .slice(0, 5)
   .map(
     (r, i) =>
       `<div style="margin:15px 0"><div style="display:flex;justify-content:space-between;font-size:12px"><span>${esc(r.name)}</span><b>${90 - i * 12}%</b></div><div style="height:8px;background:#edf2f7;border-radius:5px;margin-top:6px"><div style="height:100%;width:${90 - i * 12}%;background:#1769aa;border-radius:5px"></div></div></div>`,
   )
   .join("")}</div></div>
 <div class="panel"><div class="panel-head"><h2>Detail Laporan Rapat</h2></div>${meetingTable(state.meetings, true, false)}</div>`
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

function render() {
  const pages = {
    dashboard,
    meetings,
    rooms,
    users,
    calendar,
    reports,
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
        status: "Akan Datang",
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
 <div class="field full"><label>Status</label><select id="fStatus">${["Akan Datang", "Segera", "Berjalan", "Selesai"].map((s) => `<option ${s === m.status ? "selected" : ""}>${s}</option>`).join("")}</select></div>
 <div class="field full"><label>Deskripsi</label><textarea id="fDesc" rows="3">${esc(m.desc)}</textarea></div></div>
 <div class="modal-actions"><button class="btn btn-light" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="saveMeeting(${id || "null"})">Simpan</button></div>`,
  );
}

function saveMeeting(id) {
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
  if (id) state.meetings = state.meetings.map((x) => (x.id === id ? obj : x));
  else state.meetings.unshift(obj);
  closeModal();
  render();
  toast(id ? "Rapat berhasil diedit" : "Rapat berhasil ditambahkan");
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
      <button class="btn btn-primary" onclick="editMeeting(${id})">Edit Rapat</button>
    </div>`,
  );
}

function deleteMeeting(id) {
  if (confirm("Hapus rapat ini?")) {
    state.meetings = state.meetings.filter((x) => x.id !== id);
    render();
    toast("Rapat berhasil dihapus");
  }
}

function openRoomModal(id = null) {
  const r = id
    ? state.rooms.find((x) => x.id === id)
    : {
        name: "",
        location: "",
        capacity: 10,
        status: "Tersedia",
        facilities: "",
      };
  openModal(
    id ? "Edit Ruangan" : "Tambah Ruangan",
    `<div class="form-grid"><div class="field full"><label>Nama Ruangan</label><input id="rName" value="${esc(r.name)}"></div><div class="field"><label>Lokasi</label><input id="rLocation" value="${esc(r.location)}"></div><div class="field"><label>Kapasitas</label><input id="rCapacity" type="number" value="${r.capacity}"></div><div class="field"><label>Status</label><select id="rStatus">${["Tersedia", "Terpakai", "Perbaikan"].map((s) => `<option ${s === r.status ? "selected" : ""}>${s}</option>`).join("")}</select></div><div class="field"><label>Fasilitas</label><input id="rFacilities" value="${esc(r.facilities)}"></div></div><div class="modal-actions"><button class="btn btn-light" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="saveRoom(${id || "null"})">Simpan</button></div>`,
  );
}

function saveRoom(id) {
  const obj = {
    id: id || Date.now(),
    name: f("rName"),
    location: f("rLocation"),
    capacity: Number(f("rCapacity")),
    status: f("rStatus"),
    facilities: f("rFacilities"),
  };
  if (id) state.rooms = state.rooms.map((x) => (x.id === id ? obj : x));
  else state.rooms.push(obj);
  closeModal();
  render();
  toast("Data ruangan disimpan");
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

function saveUser(id) {
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
}

function editUser(id) {
  openUserModal(id);
}

function deleteUser(id) {
  if (confirm("Hapus pengguna ini?")) {
    state.users = state.users.filter((x) => x.id !== id);
    render();
    toast("Pengguna dihapus");
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
  const q = (document.getElementById("roomSearch").value || "").toLowerCase(),
    s = document.getElementById("roomStatus").value;
  document.getElementById("roomGrid").innerHTML = roomCards(
    state.rooms.filter(
      (r) => r.name.toLowerCase().includes(q) && (!s || r.status === s),
    ),
  );
}

function filterUsers() {
  const q = (document.getElementById("userSearch").value || "").toLowerCase(),
    r = document.getElementById("userRole").value,
    s = document.getElementById("userStatus").value;
  document.getElementById("userTable").innerHTML = userTable(
    state.users.filter(
      (u) =>
        (u.name + " " + u.email).toLowerCase().includes(q) &&
        (!r || u.role === r) &&
        (!s || u.status === s),
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

render();
