/* ===== NOTULEN OTOMATIS (khusus Admin) ===================================
   Redesigned UI matching target card layout, colors, and components.
   Preserves 100% of existing functionality + notulen-sakeh updates:
   - Live browser recording with 30s chunk upload (idempotent, resilient)
   - Audio file upload (up to 500MB) with XHR progress bar
   - Audio player & file list management
   - AI Model selection (Whisper & Ollama LLM + Claude option if configured)
   - Speaker diarization & custom speaker rename
   - RAM memory warning box & lightweight 1B model fallback button
   - Background polling for processing status with progress stepper & ETA
   - Tabs for Transcript & AI Summary Notulen
   - Live transcript search filter
   - Export dropdown (.TXT, .MD, PDF)
   - Room Recorder mode
   - Klasifikasi rapat (Rahasia vs Biasa) & Hapus Hasil
   ====================================================================== */

(function () {
  "use strict";

  const API = "/api/notulen";
  const TIMESLICE_MS = 30000;
  const POLL_MS = 3000;

  const TAHAP = [
    ["reading_audio", "Membaca audio"],
    ["transcribing", "Transkripsi"],
    ["diarizing", "Pemisahan pembicara"],
    ["summarizing", "Menyusun notulen"],
  ];

  const nv = {
    meetingId: null,
    data: null, // { meeting, files, minutes }
    ai: null,
    tab: "transkrip",
    editing: false,
    pollTimer: null,
    rec: null, // status perekam aktif
    models: null, // pilihan model dari service AI
    pilih: { whisper: "", llm: "" }, // "" = model default server
    numSpeakers: "",
    searchQuery: "",
    showModelConfig: true,
    info: null, // panel (i) yang terbuka: "whisper" | "llm" | null
    membatalkan: false, // permintaan batal sudah dikirim, menunggu worker berhenti
  };

  const SPEK_WHISPER = {
    tiny: { cpu: "2 core", gpu: "-", cepat: "±0,1× durasi", rapat6: "±40 menit", catatan: "Akurasi bahasa Indonesia rendah" },
    base: { cpu: "2 core", gpu: "-", cepat: "±0,1–0,2× durasi", rapat6: "±1 jam", catatan: "Akurasi bahasa Indonesia rendah" },
    small: { cpu: "4 core", gpu: "Tidak perlu", cepat: "±0,3–0,5× durasi (terukur)", rapat6: "±2–3 jam", catatan: "Cocok untuk server sekarang" },
    medium: { cpu: "4 core (disarankan 8)", gpu: "Opsional, VRAM ≥ 4 GB", cepat: "±0,8–1,2× durasi*", rapat6: "±5–7 jam*", catatan: "Lebih akurat dari small" },
    turbo: { cpu: "8 core disarankan", gpu: "Opsional, VRAM ≥ 4 GB", cepat: "±0,5–1× durasi*", rapat6: "±3–6 jam*", catatan: "Pilihan utama setelah server di-upgrade" },
    "large-v3-turbo": { cpu: "8 core disarankan", gpu: "Opsional, VRAM ≥ 4 GB", cepat: "±0,5–1× durasi*", rapat6: "±3–6 jam*", catatan: "Sama dengan turbo" },
    "large-v3": { cpu: "16 core", gpu: "Disarankan, VRAM ≥ 6 GB", cepat: "±2–3× durasi di CPU*", rapat6: "≥ 12 jam di CPU*", catatan: "Paling akurat; praktis hanya dengan GPU" },
  };

  const SPEK_LLM = {
    "qwen3:4b": { ram: "≥ 4 GB", cpu: "4 core", gpu: "Opsional, VRAM ≥ 4 GB", cepat: "±2–3 menit per potongan*", catatan: "Cocok untuk server sekarang" },
    "qwen3:8b": { ram: "≥ 7 GB", cpu: "8 core", gpu: "Opsional, VRAM ≥ 8 GB", cepat: "±2× lebih lambat dari 4b*", catatan: "Untuk server RAM 32 GB" },
    "qwen3:14b": { ram: "≥ 12 GB", cpu: "16 core", gpu: "Disarankan, VRAM ≥ 12–16 GB", cepat: "Sangat lambat tanpa GPU*", catatan: "Untuk server ber-GPU" },
  };

  // Claude berjalan di server Anthropic (cloud); hanya untuk rapat berklasifikasi Biasa.
  const SPEK_CLAUDE = {
    ram: "Tidak memakai RAM server", cpu: "-", gpu: "-", cepat: "±1–3 menit per rapat*",
    catatan: "☁ Cloud (Anthropic), berbayar ±Rp3.000–6.000 per jam rapat* · hanya rapat Biasa",
  };

  function modelCloud(nama) { return /^claude-/i.test(String(nama || "")); }

  function rapatBiasa() { return nv.data?.minutes?.classification === "BIASA"; }

  const KETERANGAN_WHISPER = {
    tiny: "sangat cepat, akurasi rendah",
    base: "cepat, akurasi rendah",
    small: "cepat, akurasi cukup",
    medium: "lebih akurat, lebih lambat",
    turbo: "akurat, cukup cepat",
    "large-v3-turbo": "akurat, cukup cepat",
    "large-v3": "paling akurat, sangat lambat tanpa GPU",
  };

  /* ---------- SVG Icons ---------- */
  const SVGS = {
    back: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`,
    shield: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
    cal: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`,
    pin: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    building: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>`,
    mic: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`,
    cloud: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`,
    upload: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>`,
    play: `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>`,
    trash: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`,
    sparkle: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`,
    alert: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`,
    refresh: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>`,
    download: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>`,
    chevronDown: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
    search: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></svg>`,
    pause: `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect width="4" height="16" x="6" y="4" rx="1"/><rect width="4" height="16" x="14" y="4" rx="1"/></svg>`,
    stop: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect width="16" height="16" x="4" y="4" rx="2"/></svg>`,
    lightning: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
    check: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    lines: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="6" y2="6"/><line x1="3" x2="21" y1="12" y2="12"/><line x1="3" x2="21" y1="18" y2="18"/></svg>`,
    doc: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>`,
    clock: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  };

  /* ---------- Utilitas ---------- */

  function e(v) {
    return String(v ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
    })[c]);
  }

  function beritahu(pesan) {
    if (typeof window.toast === "function") window.toast(pesan);
    else info(pesan);
  }

  /* Pop-up pengganti alert()/confirm() bawaan browser. Hasilnya Promise:
     true bila tombol utama ditekan, false bila ditutup (Batal, ✕, Esc, klik di luar).
     centang: { label, nilai } opsional; nilai diperbarui sesuai kotak centang saat ditutup. */
  const DLG_IKON = { info: "i", peringatan: "!", bahaya: "!", error: "✕" };

  function dialog({ judul = "Informasi", pesan = "", jenis = "info", ok = "Mengerti", batal = "", centang = null } = {}) {
    return new Promise((selesai) => {
      document.querySelector(".nv-dlg")?.remove();
      const fokusLama = document.activeElement;
      const el = document.createElement("div");
      el.className = "nv-dlg";
      el.innerHTML = `<div class="nv-dlg-box nv-dlg-${e(jenis)}" role="${batal ? "dialog" : "alertdialog"}" aria-modal="true"
          aria-labelledby="nvDlgJudul" aria-describedby="nvDlgPesan">
          <div class="nv-dlg-head">
            <span class="nv-dlg-ikon">${DLG_IKON[jenis] || "i"}</span>
            <h3 id="nvDlgJudul">${e(judul)}</h3>
            <button type="button" class="nv-dlg-x" data-v="0" title="Tutup" aria-label="Tutup">✕</button>
          </div>
          <p id="nvDlgPesan">${e(pesan)}</p>
          ${centang ? `<label class="nv-dlg-cek"><input type="checkbox" ${centang.nilai ? "checked" : ""}> ${e(centang.label)}</label>` : ""}
          <div class="nv-dlg-aksi">
            ${batal ? `<button type="button" class="nv-btn-outline-download" data-v="0">${e(batal)}</button>` : ""}
            <button type="button" class="nv-btn-blue-cta ${jenis === "bahaya" ? "nv-dlg-merah" : ""}" data-v="1">${e(ok)}</button>
          </div>
        </div>`;
      const tutup = (v) => {
        if (centang) centang.nilai = el.querySelector(".nv-dlg-cek input").checked;
        document.removeEventListener("keydown", onKey, true);
        el.remove();
        if (fokusLama instanceof HTMLElement && fokusLama.isConnected) fokusLama.focus();
        selesai(v);
      };
      const onKey = (ev) => {
        if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); tutup(false); return; }
        if (ev.key !== "Tab") return;
        const tombol = [...el.querySelectorAll("button, input")];
        const i = tombol.indexOf(document.activeElement);
        ev.preventDefault();
        tombol[(i + (ev.shiftKey ? -1 : 1) + tombol.length) % tombol.length].focus();
      };
      el.addEventListener("click", (ev) => {
        const b = ev.target.closest("[data-v]");
        if (b) tutup(b.dataset.v === "1");
        else if (ev.target === el) tutup(false);
      });
      document.addEventListener("keydown", onKey, true);
      document.body.appendChild(el);
      el.querySelector('[data-v="1"]').focus();
    });
  }

  const tanya = (pesan, opsi = {}) =>
    dialog({ judul: "Konfirmasi", jenis: "peringatan", ok: "Lanjutkan", batal: "Batal", ...opsi, pesan });
  const gagal = (pesan, judul = "Terjadi kesalahan") => dialog({ judul, pesan, jenis: "error", ok: "Tutup" });
  const info = (pesan, judul = "Informasi") => dialog({ judul, pesan, jenis: "info" });

  function tanyaTinggalkan() {
    return tanya("Perubahan notulen belum disimpan dan akan hilang.",
      { judul: "Tinggalkan tanpa menyimpan?", ok: "Tinggalkan", batal: "Tetap di sini", jenis: "bahaya" });
  }

  async function api(path, opts = {}) {
    let res;
    try {
      res = await fetch(API + path, { credentials: "same-origin", ...opts });
    } catch {
      throw new Error("Tidak dapat terhubung ke server. Periksa koneksi jaringan Anda.");
    }
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok || (data && data.success === false)) {
      const pesan = (data && (data.error || data.message)) ||
        (res.status === 401 ? "Sesi Anda sudah berakhir. Silakan masuk kembali." :
          res.status === 403 ? "Akun Anda tidak memiliki wewenang untuk fitur notulen." :
            res.status === 502 ? "Backend tidak dapat dihubungi." :
              `Permintaan gagal (kode ${res.status}).`);
      const err = new Error(pesan);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function jam(detik) {
    const s = Math.max(0, Math.floor(Number(detik) || 0));
    return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
      .map((n) => String(n).padStart(2, "0")).join(":");
  }

  function menitDetik(detik) {
    const s = Math.max(0, Math.floor(Number(detik) || 0));
    return [Math.floor(s / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
  }

  function sisaWaktu(detik) {
    if (detik == null) return "";
    const s = Math.round(detik);
    if (s < 60) return "kurang dari 1 menit lagi";
    if (s < 3600) return `± ${Math.round(s / 60)} menit lagi`;
    return `± ${Math.floor(s / 3600)} jam ${Math.round((s % 3600) / 60)} menit lagi`;
  }

  function ukuran(b) {
    b = Number(b) || 0;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
    return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  function waktuLokal(iso) {
    if (!iso) return "-";
    try {
      return new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
    } catch { return iso; }
  }

  function waktuLokalRingkas(iso) {
    if (!iso) return "-";
    try {
      const d = new Date(iso);
      const tgl = d.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short" });
      const jamMnt = d.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });
      return `${tgl}, ${jamMnt}`;
    } catch { return iso; }
  }

  /* Markdown sederhana → HTML */
  function markdown(md) {
    const baris = String(md || "").replace(/\r\n/g, "\n").split("\n");
    const inline = (t) => e(t)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, "$1<em>$2</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
    const out = [];
    let i = 0;
    while (i < baris.length) {
      const l = baris[i];
      if (!l.trim()) { i++; continue; }
      const h = l.match(/^(#{1,4})\s+(.*)$/);
      if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
      if (/^\s*\|.*\|\s*$/.test(l)) {
        const rows = [];
        while (i < baris.length && /^\s*\|.*\|\s*$/.test(baris[i])) rows.push(baris[i++]);
        const sel = (r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        const isSep = (r) => /^\s*\|?\s*:?-{2,}/.test(r.replace(/\|/g, "|"));
        let head = null;
        let body = rows;
        if (rows.length > 1 && isSep(rows[1])) { head = sel(rows[0]); body = rows.slice(2); }
        out.push(`<table>${head ? `<thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>` : ""}<tbody>${
          body.map((r) => `<tr>${sel(r).map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
        continue;
      }
      if (/^\s*[-*]\s+/.test(l)) {
        const items = [];
        while (i < baris.length && /^\s*[-*]\s+/.test(baris[i])) items.push(baris[i++].replace(/^\s*[-*]\s+/, ""));
        out.push(`<ul>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</ul>`);
        continue;
      }
      if (/^\s*\d+[.)]\s+/.test(l)) {
        const items = [];
        while (i < baris.length && /^\s*\d+[.)]\s+/.test(baris[i])) items.push(baris[i++].replace(/^\s*\d+[.)]\s+/, ""));
        out.push(`<ol>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</ol>`);
        continue;
      }
      if (/^\s*>/.test(l)) {
        const items = [];
        while (i < baris.length && /^\s*>/.test(baris[i])) items.push(baris[i++].replace(/^\s*>\s?/, ""));
        out.push(`<blockquote>${items.map(inline).join("<br>")}</blockquote>`);
        continue;
      }
      const para = [];
      while (i < baris.length && baris[i].trim() && !/^(#{1,4}\s|\s*[-*]\s|\s*\d+[.)]\s|\s*\||\s*>)/.test(baris[i])) para.push(baris[i++]);
      if (!para.length) { out.push(`<p>${inline(baris[i++])}</p>`); continue; }
      out.push(`<p>${para.map(inline).join("<br>")}</p>`);
    }
    return out.join("\n");
  }

  /* ---------- Root container ---------- */

  function root() {
    let el = document.getElementById("notulenView");
    if (!el) {
      el = document.createElement("div");
      el.id = "notulenView";
      el.className = "nv-root";
      document.body.appendChild(el);
    }
    return el;
  }

  async function openNotulen(meetingId) {
    nv.meetingId = String(meetingId);
    nv.view = "rapat";
    nv.tab = "transkrip";
    nv.editing = false;
    nv.searchQuery = "";
    nv.showModelConfig = true;
    nv.membatalkan = false;
    nv.info = null;
    const el = root();
    el.innerHTML = `<div class="nv-loading">Memuat data notulen...</div>`;
    el.classList.add("show");
    document.body.classList.add("nv-open");
    await muatUlang();
    cekAI();
  }

  async function closeNotulen() {
    if (nv.view === "perekam") return nvTutupPerekam();
    if (nv.rec) {
      info("Tekan \"Selesai\" dan tunggu semua potongan terkirim sebelum menutup layar ini.", "Rekaman masih berjalan");
      return;
    }
    if (nv.editing && !(await tanya("Perubahan notulen belum disimpan. Tutup tanpa menyimpan?",
      { judul: "Perubahan belum disimpan", ok: "Tutup tanpa menyimpan", batal: "Kembali", jenis: "bahaya" }))) return;
    berhentiPolling();
    nv.meetingId = null;
    nv.data = null;
    const el = document.getElementById("notulenView");
    if (el) { el.classList.remove("show"); el.innerHTML = ""; }
    document.body.classList.remove("nv-open");
  }

  async function muatUlang() {
    try {
      nv.data = await api(`/meetings/${encodeURIComponent(nv.meetingId)}`);
      render();
      if (nv.data.minutes?.status === "PROCESSING") mulaiPolling();
    } catch (err) {
      root().innerHTML = `<div class="nv-shell">
        <div class="nv-topbar">
          <div class="nv-topbar-left">
            <button class="nv-nav-back" onclick="closeNotulen()">${SVGS.back} Manajemen Rapat</button>
          </div>
        </div>
        <div class="nv-alert-box nv-alert-err">${e(err.message)}
          ${err.status === 401 ? `<div style="margin-top:10px;"><button class="nv-btn-blue-cta" onclick="nvMasukUlang()">Masuk kembali</button>
            <div style="font-size:12px;color:#64748b;margin-top:4px;">Sesi login Anda sudah berakhir. Silakan masuk kembali.</div></div>` : ""}
        </div>
      </div>`;
    }
  }

  async function cekAI() {
    try {
      nv.ai = (await api("/status-ai")).ai;
    } catch {
      nv.ai = { reachable: false, error: "Status service AI tidak dapat dibaca." };
    }
    try {
      nv.models = nv.ai.reachable ? await api("/models") : null;
    } catch {
      nv.models = null;
    }
    const slot = document.getElementById("nvTopAiStatus");
    if (slot) slot.innerHTML = htmlTopAiBadge();
    const selGrid = document.getElementById("nvModelFormGrid");
    if (selGrid) selGrid.innerHTML = htmlModelFormCols();
    const ramAlert = document.getElementById("nvRamAlertSlot");
    if (ramAlert) ramAlert.innerHTML = htmlRamWarningAlert();
    const infoSlot = document.getElementById("nvInfoSlot");
    if (infoSlot) infoSlot.innerHTML = nv.info ? htmlInfoSpek(nv.info) : "";
    const privasi = document.getElementById("nvPrivasiPill");
    if (privasi) privasi.outerHTML = htmlPrivasiPill();
  }

  /* ---------- HTML Component Builders ---------- */

  function htmlTopAiBadge() {
    const a = nv.ai;
    if (!a) return `<div class="nv-pill-badge nv-pill-ai"><span class="nv-dot-pulse"></span> Memeriksa AI...</div>`;
    if (!a.reachable) {
      return `<div class="nv-pill-badge nv-pill-ai-err" title="${e(a.error)}">⚠️ AI Tidak Aktif</div>`;
    }
    const ram = a.ram || {};
    const gb = ram.available_mb ? (ram.available_mb / 1024).toFixed(1) + " GB" : "1.0 GB";
    const cukup = ram.enough_for_whisper !== false;
    return `<div class="nv-pill-badge ${cukup ? "nv-pill-ai" : "nv-pill-ai-warn"}">
      <span class="nv-dot-pulse" style="${cukup ? "" : "background:#f59e0b;"}"></span> AI Aktif · ${gb}
    </div>`;
  }

  function htmlHeaderStatusBadge(status, minutesError) {
    if (status === "FAILED" || minutesError) {
      return `<span class="nv-status-tag nv-status-failed">${SVGS.alert} Notulen Gagal</span>`;
    }
    if (status === "DONE") {
      return `<span class="nv-status-tag nv-status-done">${SVGS.check} Selesai</span>`;
    }
    if (status === "PROCESSING") {
      return `<span class="nv-status-tag nv-status-proc">${SVGS.refresh} Sedang Diproses</span>`;
    }
    return `<span class="nv-status-tag nv-status-draft">Belum Diproses</span>`;
  }

  function htmlModelFormCols() {
    const m = nv.models || {};
    const currentW = nv.pilih.whisper || (m.default_whisper || "small");
    const currentL = nv.pilih.llm || (m.default_llm || "qwen3:4b");

    // Whisper options
    let opsiW = "";
    if (m.whisper && m.whisper.length) {
      opsiW = m.whisper.map((w) => {
        const val = w.name;
        const sel = currentW === val ? "selected" : "";
        const desc = KETERANGAN_WHISPER[w.name] ? ` · ${KETERANGAN_WHISPER[w.name]}` : "";
        const ram = w.required_ram_mb ? ` · ~${(w.required_ram_mb / 1024).toFixed(0)} GB RAM` : "";
        return `<option value="${e(val)}" ${sel}>${e(w.name)}${w.default ? " (Default)" : ""}${desc}${ram}</option>`;
      }).join("");
    } else {
      // Daftar model belum terbaca (service AI mati): jangan tawarkan model yang belum tentu terpasang.
      opsiW = `<option value="">Default server</option>`;
    }

    // LLM options
    let opsiL = "";
    const biasa = rapatBiasa();
    if (m.llm && m.llm.length) {
      opsiL = m.llm.map((l) => {
        const val = l.name;
        const sel = currentL === val ? "selected" : "";
        if (l.cloud) {
          // Claude (cloud) hanya boleh dipilih untuk rapat Biasa; backend juga menolaknya untuk rapat Rahasia.
          return `<option value="${e(val)}" ${sel} ${biasa ? "" : "disabled"}>☁ ${e(l.name)} · ${biasa ? "cloud" : "hanya rapat Biasa"}</option>`;
        }
        const ram = l.size_mb ? ` · Butuh ~${((l.size_mb + 1500) / 1024).toFixed(1)} GB RAM` : "";
        return `<option value="${e(val)}" ${sel}>${e(l.name)}${l.default ? " (Default)" : ""}${ram}</option>`;
      }).join("");
    } else {
      opsiL = `<option value="">Default server</option>`;
    }
    const adaCloud = (m.llm || []).some((l) => l.cloud);
    const catatanCloud = modelCloud(nv.pilih.llm)
      ? `<p class="nv-cloud-note">☁ Teks transkrip rapat ini akan dikirim ke Anthropic (Claude) untuk menyusun notulen.
          Audio dan transkripsi tetap di server instansi.</p>`
      : adaCloud && !biasa ? `<p class="nv-help-note">Claude (cloud) hanya bisa dipilih untuk rapat berklasifikasi Biasa.</p>` : "";
    const tombolInfo = (jenis) => `<button type="button" class="nv-info-btn ${nv.info === jenis ? "open" : ""}"
      onclick="nvInfo('${jenis}')" aria-expanded="${nv.info === jenis}" title="Spesifikasi minimal tiap model">i</button>`;

    // Diarization options
    const curSpk = nv.numSpeakers || "";
    const opsiSpk = `
      <option value="" ${curSpk === "" ? "selected" : ""}>Otomatis</option>
      <option value="1" ${curSpk === "1" ? "selected" : ""}>1 Pembicara</option>
      <option value="2" ${curSpk === "2" ? "selected" : ""}>2 Pembicara</option>
      <option value="3" ${curSpk === "3" ? "selected" : ""}>3 Pembicara</option>
      <option value="4" ${curSpk === "4" ? "selected" : ""}>4 Pembicara</option>
      <option value="5" ${curSpk === "5" ? "selected" : ""}>5 Pembicara</option>
    `;

    return `
      <div>
        <label class="nv-form-label">Model Transkripsi (Whisper) ${tombolInfo("whisper")}</label>
        <select class="nv-select-field" onchange="nvPilihModel('whisper', this.value)">${opsiW}</select>
      </div>
      <div>
        <label class="nv-form-label">Model Notulen ${tombolInfo("llm")}</label>
        <select class="nv-select-field" onchange="nvPilihModel('llm', this.value)">${opsiL}</select>
        ${catatanCloud}
      </div>
      <div>
        <label class="nv-form-label">Deteksi Jumlah Pembicara</label>
        <select class="nv-select-field" onchange="nvGantiNumSpk(this.value)">${opsiSpk}</select>
      </div>
    `;
  }

  function htmlRamWarningAlert() {
    const mn = nv.data?.minutes;
    const a = nv.ai;
    const ram = a?.ram || {};
    const availMb = ram.available_mb;
    const currentL = nv.pilih.llm || nv.models?.default_llm || "qwen3:4b";
    if (modelCloud(currentL)) return ""; // Claude tidak memakai RAM server
    // Hanya peringatan RAM bila memang kurang; galat lain ditampilkan apa adanya di tab Notulen.
    const ramKurang = availMb != null && availMb < 2500 && /4b|8b|12b|14b/.test(currentL);
    if (!ramKurang) return "";

    return `
      <div class="nv-ram-alert">
        <div class="nv-ram-alert-left">
          <span class="nv-ram-alert-icon">⚠️</span>
          <span>
            <b>Memori RAM tidak cukup untuk membuat Notulen ( ${e(currentL)} ).</b>
            Tersedia ${availMb} MB. Transkrip Anda tetap aman tersimpan.
          </span>
        </div>
        <button type="button" class="nv-btn-ram-fallback" onclick="nvGunakanModelRingan()">
          ${SVGS.lightning} Gunakan Model Ringan (1B)
        </button>
      </div>
    `;
  }

  function htmlDaftarFileRows(files, proses) {
    if (!files || !files.length) {
      return `<div style="padding: 16px; color: #94a3b8; font-size: 13px; text-align: center; border: 1px dashed #e2e8f0; border-radius: 8px;">
        Belum ada rekaman atau file audio yang diunggah.
      </div>`;
    }

    return files.map((f) => `
      <div class="nv-file-row">
        <div class="nv-file-left">
          <button type="button" class="nv-file-play-btn" onclick="nvPutar('${e(f.id)}')" title="Putar audio">
            ${SVGS.play}
          </button>
          <div>
            <div class="nv-file-title-line">
              <span class="nv-file-filename">${e(f.originalName || f.id)}</span>
              <span class="nv-file-type-pill">${f.kind === "rekaman" ? "Rekaman" : "Unggahan"}</span>
              ${f.status === "merekam" ? `<span class="nv-file-type-pill" style="background:#e0f2fe;color:#0284c7;">belum ditutup</span>` : ""}
            </div>
            <div class="nv-file-meta-sub">
              ${ukuran(f.sizeBytes)} &bull; ${waktuLokalRingkas(f.createdAt)} &bull; Oleh ${e(f.createdBy || "Admin Utama")}
            </div>
          </div>
        </div>
        <button type="button" class="nv-file-trash-btn" onclick="nvHapusFile('${e(f.id)}')" ${proses || (nv.rec && nv.rec.fileId === f.id) ? "disabled" : ""} title="Hapus file audio">
          ${SVGS.trash}
        </button>
      </div>
    `).join("");
  }

  /* ---------- Render Utama ---------- */

  function render() {
    if (nv.view === "perekam") return renderPerekam();
    const d = nv.data;
    if (!d) return;

    const m = d.meeting;
    const mn = d.minutes || { status: "DRAFT", transcript: [], speakers: {} };
    const proses = mn.status === "PROCESSING";
    const files = d.files || [];
    const adaFile = files.some((f) => f.sizeBytes > 0);

    const currentW = nv.pilih.whisper || (nv.models?.default_whisper || "small");
    const currentL = nv.pilih.llm || (nv.models?.default_llm || "qwen3:4b");
    const currentSpk = nv.numSpeakers ? `${nv.numSpeakers} Pembicara` : "Otomatis";

    // Durasi & finished at info
    const durasiSec = mn.durationSeconds || 0;
    const durasiStr = durasiSec > 0 ? menitDetik(durasiSec) : "-";
    const diprosesStr = mn.finishedAt ? waktuLokalRingkas(mn.finishedAt) : "";

    root().innerHTML = `
      <div class="nv-shell">
        <!-- Topbar Navigation -->
        <div class="nv-topbar">
          <div class="nv-topbar-left">
            <button type="button" class="nv-nav-back" onclick="closeNotulen()">${SVGS.back} Manajemen Rapat</button>
            <span class="nv-nav-slash">/</span>
            <span class="nv-nav-title">Notulen Otomatis</span>
          </div>
          <div class="nv-topbar-right">
            ${htmlPrivasiPill()}
            <div id="nvTopAiStatus">${htmlTopAiBadge()}</div>
          </div>
        </div>

        <!-- Meeting Header Card -->
        <div class="nv-header-card">
          <div class="nv-header-row-1">
            <div class="nv-title-group">
              <h1 class="nv-meeting-h1">${e(m.title)}</h1>
              ${htmlHeaderStatusBadge(mn.status, mn.minutesError)}
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              <button type="button" class="nv-btn-outline-perekam" onclick="nvBukaPerekam()">
                ${SVGS.mic} Mode Perekam Ruangan
              </button>
            </div>
          </div>
          <div class="nv-header-meta-row">
            <span class="nv-meta-cell">${SVGS.cal} ${e(m.date)} &bull; ${e(m.start)}–${e(m.end)} WIB</span>
            <span class="nv-meta-cell">${SVGS.pin} ${e(m.room)}${m.location ? ", " + e(m.location) : ""}</span>
            <span class="nv-meta-cell">${SVGS.building} ${e(m.organizer || m.requester || m.bagian || "Biro Keuangan & BMN")}</span>
          </div>
          ${htmlKlasifikasi(mn, proses)}
        </div>

        <!-- Section 1: Sumber Audio Rapat -->
        <div class="nv-sec-card">
          <div class="nv-sec-header">
            <div class="nv-sec-title-wrap">
              <span class="nv-step-num">1</span>
              <h2 class="nv-sec-title">Sumber Audio Rapat</h2>
            </div>
            <div class="nv-sec-subnote">${SVGS.cloud} Auto-save tiap 30 dtk saat merekam</div>
          </div>

          <div class="nv-audio-grid">
            <!-- Left Box: Mic Recorder -->
            <div class="nv-mic-card">
              <div class="nv-mic-left-block">
                <div class="nv-mic-icon-bubble">${SVGS.mic}</div>
                <div class="nv-mic-details">
                  <div class="nv-mic-timer-line">
                    <span id="nvTimer" class="nv-timer-digits">00:00:00</span>
                    <span id="nvRecState" class="nv-timer-state">${nv.rec ? (nv.rec.paused ? "Dijeda" : "Merekam") : "Siap"}</span>
                  </div>
                  <div class="nv-mic-select-line">
                    <select id="nvMic" class="nv-mic-dropdown" ${nv.rec ? "disabled" : ""} onfocus="nvMuatMic()">
                      <option value="">Mikrofon Bawaan (Default)</option>
                    </select>
                    <button type="button" class="nv-mic-reload-btn" onclick="nvMuatMic(true)" ${nv.rec ? "disabled" : ""} title="Muat ulang daftar mikrofon">
                      ${SVGS.refresh}
                    </button>
                  </div>
                  <div class="nv-meter-bar"><div id="nvLevel" class="nv-meter-fill"></div></div>
                </div>
              </div>
              <div class="nv-mic-buttons">
                <button type="button" id="nvBtnStart" class="nv-btn-red-record" onclick="nvRekamMulai()" ${proses || nv.rec ? "disabled" : ""}>
                  <span class="nv-record-dot"></span> Rekam
                </button>
                <button type="button" id="nvBtnPause" class="nv-btn-icon-sq" onclick="nvRekamJeda()" ${nv.rec ? "" : "disabled"} title="${nv.rec?.paused ? "Lanjutkan" : "Jeda"}">
                  ${nv.rec?.paused ? SVGS.play : SVGS.pause}
                </button>
                <button type="button" id="nvBtnStop" class="nv-btn-icon-sq" onclick="nvRekamSelesai()" ${nv.rec ? "" : "disabled"} title="Selesai dan simpan rekaman">
                  ${SVGS.stop}
                </button>
              </div>
            </div>

            <!-- Right Box: Upload File Audio -->
            <div class="nv-upload-card">
              <div class="nv-upload-left-block">
                <div class="nv-upload-icon-bubble">${SVGS.upload}</div>
                <div>
                  <div class="nv-upload-title">Unggah File Audio</div>
                  <div class="nv-upload-subtitle">MP3, M4A, WAV, OGG (Maks 500MB)</div>
                </div>
              </div>
              <label class="nv-btn-pilih ${proses ? "nv-disabled" : ""}">
                Pilih
                <input type="file" accept="audio/*,video/mp4,.m4a,.mp3,.wav,.webm,.ogg,.opus,.flac,.aac" multiple
                  onchange="nvUnggah(this)" ${proses ? "disabled" : ""} hidden>
              </label>
            </div>
          </div>

          <div id="nvUpload"></div>

          <!-- Subheading & Daftar Rekaman -->
          <div class="nv-recordings-subhead">Daftar Rekaman (Diproses Berurutan)</div>
          <div id="nvFilesList">${htmlDaftarFileRows(files, proses)}</div>
          <div id="nvPlayer"></div>
        </div>

        <!-- Section 2: Konversi Transkrip & Notulen AI -->
        <div class="nv-sec-card">
          <div class="nv-sec-header">
            <div>
              <div class="nv-sec-title-wrap">
                <span class="nv-step-num">2</span>
                <h2 class="nv-sec-title">Konversi Transkrip & Notulen AI</h2>
                <button type="button" class="nv-config-toggle" onclick="nvToggleModelConfig()">
                  🎛️ Whisper: ${e(currentW)} &bull; Notulen: ${e(currentL)} &bull; Pembicara: ${e(currentSpk)} ${SVGS.chevronDown}
                </button>
              </div>
              <div class="nv-sec-instruction">Klik pengaturan di atas jika ingin mengganti kapasitas model AI.</div>
            </div>
            <div id="nvAksiProses">${htmlAksiProses(mn, adaFile)}</div>
          </div>

          <!-- 3-Column Model Controls -->
          <div id="nvModelFormGrid" class="nv-model-form-grid" style="${nv.showModelConfig ? "" : "display:none;"}">
            ${htmlModelFormCols()}
          </div>

          <div id="nvInfoSlot">${nv.info ? htmlInfoSpek(nv.info) : ""}</div>

          <!-- Processing Progress (if active) -->
          <div id="nvProgressSlot">${proses ? htmlProcessingProgress(mn) : ""}</div>

          <!-- RAM Warning Alert Box -->
          <div id="nvRamAlertSlot">${htmlRamWarningAlert()}</div>
        </div>

        <!-- Section 3: Transkrip & Ringkasan Notulen -->
        <div class="nv-sec-card">
          <div class="nv-tabs-bar">
            <div class="nv-tabs-left">
              <button type="button" class="nv-tab-item ${nv.tab === "transkrip" ? "active" : ""}" onclick="nvTab('transkrip')">
                ${SVGS.lines} Transkrip
                <span class="nv-tab-badge-blue">${mn.hasTranscript ? "Selesai" : "Draf"}</span>
              </button>
              <button type="button" class="nv-tab-item ${nv.tab === "notulen" ? "active" : ""}" onclick="nvTab('notulen')">
                ${SVGS.doc} Ringkasan Notulen
                <span class="${mn.minutesError ? "nv-tab-badge-red" : mn.hasMinutes ? "nv-tab-badge-green" : "nv-tab-badge-amber"}">
                  ${mn.minutesError ? "Gagal" : mn.hasMinutes ? "Selesai" : "Draf"}
                </span>
              </button>
            </div>
            <div class="nv-tabs-meta">
              ${SVGS.clock} Durasi ${durasiStr}${diprosesStr ? ` &bull; Diproses ${diprosesStr}` : ""}
            </div>
          </div>

          <!-- Action Toolbar -->
          <div class="nv-toolbar-row">
            <div class="nv-search-container">
              ${SVGS.search}
              <input type="text" id="nvSearchInput" class="nv-search-input" placeholder="Cari kata di transkrip..."
                value="${e(nv.searchQuery)}" oninput="nvCariTranskrip(this.value)">
            </div>
            <div class="nv-toolbar-actions">
              <button type="button" class="nv-btn-blue-cta" onclick="nvBuatUlang()" ${proses ? "disabled" : ""}>
                ${SVGS.refresh} Buat Ulang Notulen
              </button>
              <div class="nv-dropdown-export">
                <button type="button" class="nv-btn-outline-download" onclick="nvToggleExportMenu()">
                  ${SVGS.download} Unduh .TXT ${SVGS.chevronDown}
                </button>
                <div id="nvExportMenu" class="nv-export-menu">
                  <a href="javascript:void(0)" onclick="nvUnduhTranskrip(); nvCloseExportMenu();">📄 Unduh Transkrip (.txt)</a>
                  <a href="javascript:void(0)" onclick="nvUnduhMd(); nvCloseExportMenu();">📝 Unduh Notulen (.md)</a>
                  <a href="javascript:void(0)" onclick="nvCetak(); nvCloseExportMenu();">🖨️ Cetak / Simpan PDF</a>
                  ${mn.hasTranscript || mn.hasMinutes ? `<a href="javascript:void(0)" style="color:#ef4444;" onclick="nvHapusHasil(); nvCloseExportMenu();">🗑️ Hapus Transkrip & Notulen</a>` : ""}
                </div>
              </div>
            </div>
          </div>

          <!-- Tab Content Area -->
          <div id="nvTabContent">
            ${nv.tab === "transkrip" ? htmlTabTranskrip(mn) : htmlTabNotulen(mn)}
          </div>
        </div>
      </div>
    `;

    if (nv.rec) hubungkanUlangPerekamUI();
  }

  function htmlPrivasiPill() {
    if (rapatBiasa() && modelCloud(nv.pilih.llm)) {
      return `<div id="nvPrivasiPill" class="nv-pill-badge nv-pill-cloud">${SVGS.cloud} Notulen via Claude (cloud)</div>`;
    }
    return `<div id="nvPrivasiPill" class="nv-pill-badge nv-pill-privacy">${SVGS.shield} Server Lokal (Privasi Terjaga)</div>`;
  }

  /* Klasifikasi menentukan apakah notulen boleh disusun Claude (cloud). Bawaannya Rahasia. */
  function htmlKlasifikasi(mn, proses) {
    const biasa = mn.classification === "BIASA";
    const oleh = mn.classificationBy
      ? ` Diatur oleh ${e(mn.classificationBy)}${mn.classificationAt ? `, ${waktuLokal(mn.classificationAt)}` : ""}.` : "";
    return `
      <div class="nv-klas ${biasa ? "nv-klas-biasa" : "nv-klas-rahasia"}">
        <div class="nv-klas-row">
          <b>Klasifikasi rapat</b>
          <div class="nv-seg" role="radiogroup" aria-label="Klasifikasi rapat">
            <button type="button" role="radio" aria-checked="${!biasa}" class="${biasa ? "" : "on"}"
              onclick="nvKlasifikasi('RAHASIA')" ${proses ? "disabled" : ""}>🔒 Rahasia / Penting</button>
            <button type="button" role="radio" aria-checked="${biasa}" class="${biasa ? "on" : ""}"
              onclick="nvKlasifikasi('BIASA')" ${proses ? "disabled" : ""}>Biasa</button>
          </div>
        </div>
        <p>${biasa
          ? "Audio dan transkripsi tetap diproses di server instansi. Notulen <b>boleh</b> disusun dengan Claude (cloud): bila dipilih, teks transkrip dikirim ke server Anthropic."
          : "Audio, transkrip, dan notulen diproses sepenuhnya di server instansi dan tidak dikirim ke layanan cloud."}${oleh}</p>
      </div>`;
  }

  function htmlAksiProses(mn, adaFile) {
    if (mn.status === "PROCESSING") {
      return nv.membatalkan
        ? `<button type="button" class="nv-btn-dark-cta" disabled>Membatalkan…</button>`
        : `<button type="button" class="nv-btn-dark-cta" onclick="nvBatal()">Batalkan Proses</button>`;
    }
    return `<button type="button" class="nv-btn-dark-cta" onclick="nvProses()" ${adaFile && !nv.rec ? "" : "disabled"}>
        ${SVGS.sparkle} ${mn.hasTranscript ? "Proses Ulang Audio" : "Mulai Konversi AI"}
      </button>`;
  }

  /* Pembaruan sebagian saat proses berjalan: halaman tidak digambar ulang, sehingga
     pemutar audio, isian nama pembicara, dan posisi gulir tidak ikut hilang. */
  function perbaruiProses() {
    const mn = nv.data?.minutes;
    if (!mn) return;
    const adaFile = (nv.data.files || []).some((f) => f.sizeBytes > 0);
    const slot = document.getElementById("nvProgressSlot");
    if (slot) slot.innerHTML = mn.status === "PROCESSING" ? htmlProcessingProgress(mn) : "";
    const aksi = document.getElementById("nvAksiProses");
    if (aksi) aksi.innerHTML = htmlAksiProses(mn, adaFile);
  }

  /* Panel (i): spesifikasi minimal tiap model + apakah muat di RAM server saat ini. */
  function htmlInfoSpek(jenis) {
    const m = nv.models || {};
    const avail = nv.ai?.ram?.available_mb;
    const gb = (mb) => `${(mb / 1024).toFixed(1).replace(".", ",")} GB`;
    const muat = (butuh) => (avail == null ? "-" : avail >= butuh
      ? `<span class="nv-fit-ok">✓ muat</span>` : `<span class="nv-fit-no">✗ RAM kurang</span>`);
    let isi;
    if (jenis === "whisper") {
      isi = `<table class="nv-spec"><thead><tr><th>Model</th><th>RAM bebas min.</th><th>CPU</th><th>GPU NVIDIA</th>
        <th>Waktu proses</th><th>Rapat 6 jam</th><th>Saat ini</th><th>Catatan</th></tr></thead><tbody>${
        (m.whisper || []).map((w) => {
          const sp = SPEK_WHISPER[w.name] || {};
          return `<tr><td><b>${e(w.name)}</b></td><td>${gb(w.required_ram_mb)}</td><td>${e(sp.cpu || "-")}</td><td>${e(sp.gpu || "-")}</td>
            <td>${e(sp.cepat || "-")}</td><td>${e(sp.rapat6 || "-")}</td><td>${muat(w.required_ram_mb)}</td><td>${e(sp.catatan || "")}</td></tr>`;
        }).join("")}</tbody></table>
        <p class="nv-help-note">Waktu proses = lama transkripsi dibanding durasi audio, di CPU int8 dengan 3–4 thread.
          Dengan GPU NVIDIA semua model jauh lebih cepat (±0,05× durasi). Pemisahan pembicara menambah ±0,3× durasi
          dan ±0,5 GB RAM per jam audio. Tahap transkripsi, pemisahan pembicara, dan notulen berjalan bergantian,
          jadi kebutuhan RAM-nya tidak dijumlahkan.</p>`;
    } else {
      const daftar = (m.llm || []).length ? m.llm : Object.keys(SPEK_LLM).map((name) => ({ name }));
      isi = `<table class="nv-spec"><thead><tr><th>Model</th><th>RAM bebas min.</th><th>CPU</th><th>GPU NVIDIA</th>
        <th>Kecepatan</th><th>Catatan</th></tr></thead><tbody>${
        daftar.map((l) => {
          const sp = modelCloud(l.name) ? SPEK_CLAUDE : SPEK_LLM[l.name] || SPEK_LLM[String(l.name).replace(/:latest$/, "")] || {};
          const ram = sp.ram || (l.size_mb ? `≥ ${gb(l.size_mb + 1536)} (ukuran model + 1,5 GB)` : "-");
          return `<tr><td><b>${e(l.name)}</b>${l.size_mb ? `<br><span class="nv-help-note">file ±${gb(l.size_mb)}</span>` : ""}</td>
            <td>${e(ram)}</td><td>${e(sp.cpu || "≥ 4 core")}</td><td>${e(sp.gpu || "Opsional")}</td>
            <td>${e(sp.cepat || "-")}</td><td>${e(sp.catatan || "")}</td></tr>`;
        }).join("")}</tbody></table>
        <p class="nv-help-note">Dengan konteks 8192 token (OLLAMA_NUM_CTX). Rapat 6 jam ≈ 15–20 potongan transkrip.
          Ambang RAM yang dipakai server sebelum memanggil LLM diatur di LLM_MIN_FREE_RAM_MB.</p>`;
    }
    return `<div class="nv-info-panel" role="region" aria-label="Spesifikasi minimal model">
      <div class="nv-info-head"><b>Spesifikasi minimal — ${jenis === "whisper" ? "model transkripsi" : "model notulen"}</b>
        <button type="button" class="nv-btn-outline-download" onclick="nvInfo(null)">Tutup</button></div>
      ${avail != null ? `<p class="nv-help-note">RAM bebas server saat ini: <b>${gb(avail)}</b>.</p>` : ""}
      ${isi}
      <p class="nv-help-note">* Perkiraan, belum diukur di server instansi. Angka pasti: jalankan
        <code>ai-service/scripts/benchmark.py</code> dengan rekaman rapat asli.</p>
    </div>`;
  }

  function nvInfo(jenis) {
    nv.info = jenis && nv.info !== jenis ? jenis : null;
    const grid = document.getElementById("nvModelFormGrid");
    if (grid) grid.innerHTML = htmlModelFormCols();
    const slot = document.getElementById("nvInfoSlot");
    if (slot) slot.innerHTML = nv.info ? htmlInfoSpek(nv.info) : "";
  }

  function htmlProcessingProgress(mn) {
    const urutan = TAHAP.filter(([k]) => k !== "diarizing" || mn.diarization || mn.stage === "diarizing")
      .filter(([k]) => mn.jobType !== "summarize" || k === "summarizing");
    const idx = urutan.findIndex(([k]) => k === mn.stage);
    return `
      <div class="nv-steps">
        ${urutan.map(([k, label], i) => `
          <div class="nv-step ${i < idx ? "done" : i === idx ? "active" : ""}">
            <span>${i < idx ? "✓" : i + 1}</span>${label}
          </div>
        `).join("")}
      </div>
      <div class="nv-progress"><div style="width:${Math.round((mn.progress || 0) * 100)}%"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:12.5px;color:#64748b;margin-bottom:10px;">
        <span><b>${e(mn.stageLabel || "Menunggu antrean")}</b>
          ${mn.queuePosition ? ` &bull; Antrean ke-${mn.queuePosition}` : ""}
          ${mn.stage ? ` &bull; Tahap ini ${Math.round((mn.stageProgress || 0) * 100)}%` : ""}
        </span>
        <span>${Math.round((mn.progress || 0) * 100)}% ${mn.etaSeconds != null ? "&bull; " + sisaWaktu(mn.etaSeconds) : ""}</span>
      </div>
    `;
  }

  function htmlTabTranskrip(mn) {
    const spk = [...new Set((mn.transcript || []).map((s) => s.speaker).filter(Boolean))];
    const nama = mn.speakers || {};
    const proses = mn.status === "PROCESSING";

    // Speaker renaming section if diarization detected speakers
    const spkRenaming = spk.length ? `
      <div class="nv-speaker-rename-bar">
        <div class="nv-speaker-rename-title">Penamaan Pembicara Terdeteksi</div>
        <div class="nv-speaker-chips">
          ${spk.map((s) => `
            <label class="nv-spk-chip-label">
              <span>${e(s)}:</span>
              <input class="nv-select-field" style="padding:4px 8px;font-size:12px;" data-spk="${e(s)}" value="${e(nama[s] || "")}" placeholder="mis. Pak Budi">
            </label>
          `).join("")}
        </div>
        <button type="button" class="nv-btn-outline-download" style="padding:5px 12px;font-size:12px;" onclick="nvSimpanNama()" ${proses ? "disabled" : ""}>
          Simpan Nama Pembicara
        </button>
      </div>
    ` : "";

    let lines = mn.transcript || [];

    // Apply live search filter
    if (nv.searchQuery) {
      const q = nv.searchQuery.toLowerCase();
      lines = lines.filter((s) => {
        const spkName = (nama[s.speaker] || s.speaker || "").toLowerCase();
        const text = (s.text || "").toLowerCase();
        return text.includes(q) || spkName.includes(q);
      });
    }

    if (!lines.length) {
      if (mn.transcript && mn.transcript.length && nv.searchQuery) {
        return `${spkRenaming}<div style="padding:24px;text-align:center;color:#94a3b8;font-size:13.5px;">Tidak ditemukan ucapan dengan kata kunci "${e(nv.searchQuery)}".</div>`;
      }
      return `${spkRenaming}<div style="padding:24px;text-align:center;color:#94a3b8;font-size:13.5px;">Belum ada transkrip ucapan yang terdeteksi. Silakan proses audio rapat terlebih dahulu.</div>`;
    }

    const rows = lines.map((s) => {
      const spkLabel = s.speaker ? `<span class="nv-speaker-tag">${e(nama[s.speaker] || s.speaker)}:</span>` : "";
      return `
        <div class="nv-dialogue-row">
          <span class="nv-ts-pill">${jam(s.start)}</span>
          <p class="nv-dialogue-text">${spkLabel}${e(s.text)}</p>
        </div>
      `;
    }).join("");

    return `
      ${mn.transcriptBaru ? `<div class="nv-alert-box nv-alert-warn">Transkrip sudah jadi. Notulen sedang disusun AI.
        Nama pembicara bisa disimpan setelah proses selesai.</div>` : ""}
      ${spkRenaming}
      <div class="nv-transkrip-box">
        ${rows}
      </div>
    `;
  }

  function htmlTabNotulen(mn) {
    const proses = mn.status === "PROCESSING";
    const draf = mn.hasMinutes && !mn.minutesReviewed;
    const banner = mn.transcriptBaru
      ? `<div class="nv-alert-box nv-alert-warn">Notulen sedang disusun AI dari transkrip terbaru.
          ${mn.hasMinutes ? "Yang tampil di bawah masih notulen dari proses sebelumnya." : "Halaman ini diperbarui sendiri setelah selesai."}</div>`
      : !mn.hasMinutes
      ? `<div class="nv-alert-box nv-alert-warn">Notulen belum tersedia. Gunakan tombol "Buat Ulang Notulen" di tab Transkrip atau tunggu proses selesai.</div>`
      : draf
        ? `<div class="nv-alert-box nv-alert-draft"><b>DRAF HASIL AI &mdash; wajib ditinjau notulis.</b> Periksa nama, keputusan, PIC, dan tenggat sebelum dibagikan. AI bisa salah dengar atau salah ringkas.</div>`
        : `<div class="nv-alert-box nv-alert-ok">Sudah ditinjau${mn.minutesEditedBy ? ` oleh ${e(mn.minutesEditedBy)}` : ""}${mn.minutesEditedAt ? `, ${waktuLokal(mn.minutesEditedAt)}` : ""}.</div>`;

    if (nv.editing) {
      return `
        ${banner}
        <textarea id="nvMdEdit" class="nv-md-editor-textarea" spellcheck="true">${e(mn.minutesMarkdown || "")}</textarea>
        <div style="display:flex;align-items:center;gap:12px;margin-top:12px;flex-wrap:wrap;">
          <label style="display:inline-flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
            <input type="checkbox" id="nvReviewed" ${mn.minutesReviewed ? "checked" : ""}>
            <span>Saya sudah meninjau notulen ini</span>
          </label>
          <button type="button" class="nv-btn-blue-cta" onclick="nvSimpanNotulen()">Simpan Notulen</button>
          <button type="button" class="nv-btn-outline-download" onclick="nvBatalEdit()">Batal</button>
        </div>
      `;
    }

    return `
      ${banner}
      <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
        <button type="button" class="nv-btn-blue-cta" onclick="nvEdit()" ${proses ? "disabled" : ""}>
          ${mn.hasMinutes ? "✏️ Sunting / Tinjau" : "✏️ Tulis Notulen Manual"}
        </button>
      </div>
      ${mn.hasMinutes ? `<article class="nv-md-viewer">${markdown(mn.minutesMarkdown)}</article>` : ""}
    `;
  }

  /* ---------- Live Actions & Event Handlers ---------- */

  function nvToggleModelConfig() {
    nv.showModelConfig = !nv.showModelConfig;
    const el = document.getElementById("nvModelFormGrid");
    if (el) el.style.display = nv.showModelConfig ? "" : "none";
  }

  function nvPilihModel(jenis, nilai) {
    nv.pilih[jenis] = nilai;
    cekAI();
  }

  function nvGantiNumSpk(val) {
    nv.numSpeakers = val;
  }

  function nvGunakanModelRingan() {
    // Hanya model lokal yang benar-benar terpasang di Ollama (ukuran < ±2 GB).
    const ringan = (nv.models?.llm || []).filter((l) => !l.cloud && l.size_mb && l.size_mb < 2000)
      .sort((a, b) => a.size_mb - b.size_mb)[0];
    if (!ringan) {
      info("Belum ada model ringan di Ollama server. Pasang dulu, mis.: ollama pull qwen2.5:1.5b", "Model ringan belum tersedia");
      return;
    }
    const chosen = ringan.name;
    nv.pilih.llm = chosen;
    beritahu(`Model LLM dialihkan ke model ringan (${chosen}). Memulai pembuatan ulang notulen...`);
    render();
    nvBuatUlang();
  }

  function nvCariTranskrip(val) {
    nv.searchQuery = val.trim();
    const slot = document.getElementById("nvTabContent");
    if (slot && nv.tab === "transkrip") {
      slot.innerHTML = htmlTabTranskrip(nv.data?.minutes || {});
    }
  }

  async function nvTab(t) {
    if (nv.editing && t !== "notulen" && !(await tanyaTinggalkan())) return;
    if (t !== "notulen") nv.editing = false;
    nv.tab = t;
    render();
  }

  function nvToggleExportMenu() {
    const el = document.getElementById("nvExportMenu");
    if (el) el.classList.toggle("show");
  }

  function nvCloseExportMenu() {
    const el = document.getElementById("nvExportMenu");
    if (el) el.classList.remove("show");
  }

  document.addEventListener("click", (ev) => {
    if (!ev.target.closest(".nv-dropdown-export")) {
      nvCloseExportMenu();
    }
  });

  function nvEdit() {
    nv.editing = true;
    render();
    document.getElementById("nvMdEdit")?.focus();
  }

  function nvBatalEdit() {
    nv.editing = false;
    render();
  }

  async function nvSimpanNotulen() {
    const markdownBaru = document.getElementById("nvMdEdit")?.value ?? "";
    const reviewed = Boolean(document.getElementById("nvReviewed")?.checked);
    try {
      const r = await api(`/meetings/${encodeURIComponent(nv.meetingId)}/minutes`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markdown: markdownBaru, reviewed }),
      });
      nv.data.minutes = r.minutes;
      nv.editing = false;
      beritahu(reviewed ? "Notulen disimpan dan ditandai sudah ditinjau." : "Notulen disimpan (masih berstatus draf).");
      render();
    } catch (err) { gagal(err.message); }
  }

  function namaBerkas(ext) {
    const m = nv.data?.meeting || {};
    return `Notulen - ${m.title || "Rapat"} - ${m.date || ""}`.replace(/[\\/:*?"<>|]+/g, " ").trim() + ext;
  }

  function unduhTeks(isi, nama, tipe) {
    const url = URL.createObjectURL(new Blob([isi], { type: tipe }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nama;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function nvUnduhMd() {
    unduhTeks(nv.data?.minutes?.minutesMarkdown || "", namaBerkas(".md"), "text/markdown;charset=utf-8");
  }

  function nvUnduhTranskrip() {
    const mn = nv.data?.minutes || {};
    const nama = mn.speakers || {};
    const isi = (mn.transcript || [])
      .map((s) => `[${jam(s.start)}]${s.speaker ? ` ${nama[s.speaker] || s.speaker}:` : ""} ${s.text}`).join("\n");
    unduhTeks(isi + "\n", namaBerkas(".txt").replace(/^Notulen/, "Transkrip"), "text/plain;charset=utf-8");
  }

  function nvCetak() {
    const mn = nv.data?.minutes || {};
    const draf = !mn.minutesReviewed;
    const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${e(namaBerkas(""))}</title>
      <style>
        @page { size: A4; margin: 20mm 18mm; }
        body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.5; color: #000; }
        h1 { font-size: 16pt; text-align: center; margin: 0 0 12pt; }
        h2 { font-size: 13pt; margin: 14pt 0 6pt; border-bottom: 1px solid #000; }
        h3 { font-size: 12pt; margin: 10pt 0 4pt; }
        table { width: 100%; border-collapse: collapse; margin: 6pt 0; page-break-inside: auto; }
        th, td { border: 1px solid #000; padding: 4pt 6pt; vertical-align: top; text-align: left; }
        th { background: #eee; }
        tr { page-break-inside: avoid; }
        ul, ol { margin: 4pt 0 4pt 18pt; padding: 0; }
        .draf { border: 2px solid #000; padding: 6pt; text-align: center; font-weight: bold; margin-bottom: 10pt; }
      </style></head><body>
      ${draf ? `<div class="draf">DRAF &mdash; BELUM DITINJAU NOTULIS</div>` : ""}
      ${markdown(mn.minutesMarkdown)}
      </body></html>`;
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(frame);
    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      setTimeout(() => frame.remove(), 1000);
    }, 300);
  }

  /* ---------- Polling Status Pemrosesan ---------- */

  function mulaiPolling() {
    berhentiPolling();
    nv.pollTimer = setInterval(async () => {
      if (!nv.meetingId) return berhentiPolling();
      try {
        const { minutes } = await api(`/meetings/${encodeURIComponent(nv.meetingId)}/status`);
        if (!minutes || minutes.status !== "PROCESSING") {
          berhentiPolling();
          const dibatalkan = nv.membatalkan;
          nv.membatalkan = false;
          await muatUlang();
          cekAI();
          if (dibatalkan) {
            beritahu(/dibatalkan/i.test(minutes?.minutesError || "")
              ? "Pembuatan notulen dibatalkan. Transkrip tetap tersimpan."
              : "Proses dibatalkan. Hasil sebelumnya (jika ada) tidak berubah.");
          } else if (minutes?.status === "DONE") {
            beritahu(minutes.minutesError ? "Transkrip selesai, tetapi notulen gagal dibuat." : "Pemrosesan selesai.");
          } else if (minutes?.status === "FAILED") {
            beritahu("Pemrosesan gagal. Lihat keterangan di halaman notulen.");
          }
          return;
        }
        if (minutes.transcriptBaru && !nv.data.minutes?.transcriptBaru) {
          // Tahap transkripsi selesai: tampilkan transkrip sambil notulen disusun.
          if (!nv.editing) nv.tab = "transkrip";
          await muatUlang();
          beritahu("Transkrip selesai. Notulen sedang disusun.");
          return;
        }
        nv.data.minutes = { ...nv.data.minutes, ...minutes };
        perbaruiProses();
      } catch (err) {
        if (err.status === 401 || err.status === 403) { berhentiPolling(); beritahu(err.message); }
      }
    }, POLL_MS);
  }

  function berhentiPolling() {
    if (nv.pollTimer) clearInterval(nv.pollTimer);
    nv.pollTimer = null;
  }

  /* ---------- Aksi File: Unggah, Putar, Hapus ---------- */

  async function nvUnggah(input) {
    const files = [...(input.files || [])];
    input.value = "";
    const slot = document.getElementById("nvUpload");
    for (const file of files) {
      const id = "u" + Math.random().toString(36).slice(2);
      slot.insertAdjacentHTML("beforeend", `<div class="nv-up" id="${id}"><span>${e(file.name)} (${ukuran(file.size)})</span>
        <div class="nv-progress nv-progress-sm"><div style="width:0%"></div></div><span style="color:#64748b;font-size:12px;">0%</span></div>`);
      try {
        await unggahSatu(file, (p) => {
          const el = document.getElementById(id);
          if (!el) return;
          el.querySelector(".nv-progress div").style.width = `${Math.round(p * 100)}%`;
          el.querySelector("span:last-child").textContent = p >= 1 ? "Menyimpan…" : `${Math.round(p * 100)}%`;
        });
        document.getElementById(id)?.remove();
        beritahu(`File "${file.name}" berhasil diunggah.`);
      } catch (err) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = `<div class="nv-alert-box nv-alert-err">${e(file.name)}: ${e(err.message)}</div>`;
      }
    }
    await muatUlang();
  }

  function unggahSatu(file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API}/meetings/${encodeURIComponent(nv.meetingId)}/audio`);
      xhr.withCredentials = true;
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
      xhr.setRequestHeader("X-File-Type", file.type || "");
      xhr.upload.onprogress = (ev) => ev.lengthComputable && onProgress(ev.loaded / ev.total);
      xhr.onerror = () => reject(new Error("Unggahan terputus. Periksa koneksi lalu coba lagi."));
      xhr.ontimeout = () => reject(new Error("Unggahan terlalu lama (timeout)."));
      xhr.onload = () => {
        let data = null;
        try { data = JSON.parse(xhr.responseText); } catch { data = null; }
        if (xhr.status >= 200 && xhr.status < 300 && data?.success !== false) return resolve(data);
        reject(new Error((data && data.error) || (xhr.status === 413 ? "File terlalu besar untuk server." : `Unggahan gagal (kode ${xhr.status}).`)));
      };
      xhr.send(file);
    });
  }

  function nvPutar(fileId) {
    const slot = document.getElementById("nvPlayer");
    if (!slot) return;
    slot.innerHTML = `<audio controls autoplay preload="metadata" src="${API}/meetings/${encodeURIComponent(nv.meetingId)}/audio/${encodeURIComponent(fileId)}"></audio>`;
  }

  async function nvHapusFile(fileId) {
    const mn = nv.data?.minutes;
    const adaHasil = Boolean(mn?.hasTranscript || mn?.hasMinutes);
    const fileTerakhir = (nv.data?.files || []).length <= 1;
    // Audio terakhir dihapus: tawarkan sekalian menghapus transkrip & notulennya.
    const centang = adaHasil && fileTerakhir ? { label: "Hapus juga transkrip dan notulen rapat ini", nilai: true } : null;
    const pesan = "File audio ini akan dihapus permanen dan tidak bisa dikembalikan."
      + (adaHasil && !fileTerakhir ? " Transkrip dan notulen tidak ikut terhapus." : "");
    if (!(await tanya(pesan, { judul: "Hapus file audio?", ok: "Hapus", jenis: "bahaya", centang }))) return;
    try {
      await api(`/meetings/${encodeURIComponent(nv.meetingId)}/audio/${encodeURIComponent(fileId)}`, { method: "DELETE" });
      if (centang?.nilai) {
        await api(`/meetings/${encodeURIComponent(nv.meetingId)}/minutes`, { method: "DELETE" });
        nv.editing = false;
      }
      beritahu(centang?.nilai ? "File audio, transkrip, dan notulen dihapus." : "File audio dihapus.");
      await muatUlang();
    } catch (err) { gagal(err.message); }
  }

  /* ---------- Aksi AI: Proses, Buat Ulang, Klasifikasi, Hapus Hasil ---------- */

  async function nvProses() {
    const mn = nv.data?.minutes;
    if (mn?.hasTranscript && !(await tanya("Transkrip dan notulen yang sudah ada akan diganti dengan hasil baru. Proses ini memakan waktu lama.",
      { judul: "Proses ulang dari audio?", ok: "Proses ulang" }))) return;
    const body = {};
    if (nv.numSpeakers) body.numSpeakers = Number(nv.numSpeakers);
    if (nv.pilih.whisper) body.whisperModel = nv.pilih.whisper;
    if (nv.pilih.llm) body.llmModel = nv.pilih.llm;
    try {
      await api(`/meetings/${encodeURIComponent(nv.meetingId)}/process`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      beritahu("Audio dikirim ke antrean pemrosesan AI.");
      await muatUlang();
    } catch (err) { gagal(err.message); }
  }

  async function nvBatal() {
    if (nv.membatalkan) return;
    if (!(await tanya("Proses berhenti dalam beberapa detik. Jika transkrip sudah selesai dibuat, transkrip itu "
      + "tetap disimpan. Hasil dari proses sebelumnya tidak berubah.",
      { judul: "Batalkan proses?", ok: "Batalkan proses", batal: "Tidak", jenis: "bahaya" }))) return;
    nv.membatalkan = true;
    perbaruiProses();
    try {
      await api(`/meetings/${encodeURIComponent(nv.meetingId)}/cancel`, { method: "POST" });
      if (!nv.pollTimer) mulaiPolling();
    } catch (err) {
      nv.membatalkan = false;
      perbaruiProses();
      // Proses ternyata sudah selesai/berhenti lebih dulu: tampilkan keadaan terbaru.
      if (err.status === 409) { await muatUlang(); return; }
      gagal(err.message);
    }
  }

  async function nvSimpanNama(diam = false) {
    const speakers = {};
    document.querySelectorAll("[data-spk]").forEach((inp) => { speakers[inp.dataset.spk] = inp.value.trim(); });
    try {
      const r = await api(`/meetings/${encodeURIComponent(nv.meetingId)}/speakers`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ speakers }),
      });
      nv.data.minutes.speakers = r.speakers;
      if (!diam) { beritahu("Nama pembicara disimpan."); render(); }
      return true;
    } catch (err) { gagal(err.message); return false; }
  }

  async function nvBuatUlang() {
    const mn = nv.data?.minutes;
    if (mn?.hasMinutes && !(await tanya("Notulen yang ada, termasuk hasil suntingan, akan diganti dengan draf baru dari AI.",
      { judul: "Buat ulang notulen?", ok: "Buat ulang" }))) return;
    if (document.querySelector("[data-spk]") && !(await nvSimpanNama(true))) return;
    try {
      await api(`/meetings/${encodeURIComponent(nv.meetingId)}/regenerate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nv.pilih.llm ? { llmModel: nv.pilih.llm } : {}),
      });
      beritahu("Notulen sedang dibuat ulang oleh AI.");
      nv.tab = "notulen";
      await muatUlang();
    } catch (err) { gagal(err.message); }
  }

  async function nvKlasifikasi(nilai) {
    const mn = nv.data?.minutes;
    if ((mn?.classification || "RAHASIA") === nilai) return;
    if (nilai === "BIASA" && !(await tanya("Rapat Biasa boleh memakai Claude (layanan cloud Anthropic) untuk menyusun notulen. "
      + "Jika model Claude dipilih, teks transkrip rapat ini dikirim ke luar server instansi. "
      + "Pastikan rapat ini tidak membahas hal rahasia atau penting.",
      { judul: "Jadikan rapat Biasa?", ok: "Ya, rapat Biasa" }))) return;
    try {
      const r = await api(`/meetings/${encodeURIComponent(nv.meetingId)}/classification`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ classification: nilai }),
      });
      if (nv.data?.minutes) {
        nv.data.minutes.classification = r.minutes.classification;
        nv.data.minutes.classificationBy = r.minutes.classificationBy;
        nv.data.minutes.classificationAt = r.minutes.classificationAt;
      }
      if (nilai === "RAHASIA" && modelCloud(nv.pilih.llm)) nv.pilih.llm = "";
      beritahu(nilai === "BIASA" ? "Rapat ditandai Biasa." : "Rapat ditandai Rahasia/Penting: hanya model lokal.");
      render();
    } catch (err) { gagal(err.message); }
  }

  async function nvHapusHasil() {
    if (!(await tanya("Transkrip, nama pembicara, dan notulen rapat ini (termasuk hasil suntingan) akan dihapus "
      + "permanen. File audio tidak ikut terhapus, jadi rapat masih bisa diproses ulang.",
      { judul: "Hapus transkrip & notulen?", ok: "Hapus", jenis: "bahaya" }))) return;
    try {
      await api(`/meetings/${encodeURIComponent(nv.meetingId)}/minutes`, { method: "DELETE" });
      nv.editing = false;
      nv.tab = "transkrip";
      beritahu("Transkrip dan notulen dihapus.");
      await muatUlang();
    } catch (err) { gagal(err.message); }
  }

  /* ---------- Browser Microphone Recording ---------- */

  async function nvMuatMic(paksa = false) {
    const sel = document.getElementById("nvMic");
    if (!sel || (sel.options.length > 1 && !paksa)) return;
    try {
      let devices = await navigator.mediaDevices.enumerateDevices();
      if (paksa && devices.filter((d) => d.kind === "audioinput").every((d) => !d.label)) {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());
        devices = await navigator.mediaDevices.enumerateDevices();
      }
      const pilih = sel.value;
      sel.innerHTML = `<option value="">Mikrofon Bawaan (Default)</option>` + devices.filter((d) => d.kind === "audioinput" && d.deviceId !== "default")
        .map((d, i) => `<option value="${e(d.deviceId)}">${e(d.label || `Mikrofon ${i + 1}`)}</option>`).join("");
      sel.value = pilih;
    } catch (err) {
      gagal(pesanMic(err), "Mikrofon tidak bisa dipakai");
    }
  }

  function pesanMic(err) {
    if (err && (err.name === "NotAllowedError" || err.name === "SecurityError")) {
      return "Izin mikrofon ditolak. Izinkan akses mikrofon untuk situs ini di pengaturan browser, lalu coba lagi.";
    }
    if (err && err.name === "NotFoundError") return "Mikrofon tidak ditemukan. Pastikan mikrofon terpasang.";
    if (err && err.name === "NotReadableError") return "Mikrofon sedang dipakai aplikasi lain (mis. Zoom). Tutup aplikasi tersebut lalu coba lagi.";
    return `Gagal mengakses mikrofon: ${err?.message || err}`;
  }

  function pilihMime() {
    const kandidat = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
    return kandidat.find((m) => MediaRecorder.isTypeSupported(m)) || "";
  }

  async function nvRekamMulai() {
    if (nv.rec) return;
    const deviceId = document.getElementById("nvMic")?.value || "";
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      gagal(pesanMic(err), "Mikrofon tidak bisa dipakai");
      return;
    }
    const mimeType = pilihMime();
    let sesi;
    try {
      sesi = await api(`/meetings/${encodeURIComponent(nv.meetingId)}/recordings`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mimeType: mimeType || "audio/webm" }),
      });
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      gagal(err.message);
      return;
    }

    const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32000 });
    const r = {
      fileId: sesi.file.id,
      stream,
      recorder,
      queue: [],
      nextSeq: 0,
      sending: false,
      stopped: false,
      paused: false,
      elapsedMs: 0,
      startedAt: Date.now(),
      wakeLock: null,
      audioCtx: null,
      raf: null,
      gagalBeruntun: 0,
    };
    nv.rec = r;

    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        r.queue.push({ seq: r.nextSeq++, blob: ev.data });
        kirimAntrean();
      }
    };
    recorder.onstop = () => {
      r.stopped = true;
      kirimAntrean();
    };
    recorder.onerror = (ev) => gagal(`Perekam berhenti karena error: ${ev.error?.message || "tidak diketahui"}`, "Perekaman berhenti");
    stream.getAudioTracks()[0].onended = () => {
      if (!r.stopped) {
        nvRekamSelesai(true);
        gagal("Rekaman dihentikan. Bagian yang sudah terekam tetap disimpan.", "Mikrofon terputus");
      }
    };

    recorder.start(TIMESLICE_MS);
    pasangMeter(r);
    pasangWakeLock(r);
    window.addEventListener("beforeunload", cegahKeluar);
    try { window.parent && window.parent !== window && window.parent.addEventListener("beforeunload", cegahKeluar); } catch { /* cross-origin */ }
    render();
    r.timer = setInterval(perbaruiInfoRekam, 500);
  }

  function nvRekamJeda() {
    const r = nv.rec;
    if (!r || r.stopped) return;
    if (r.paused) {
      r.recorder.resume();
      r.paused = false;
      r.startedAt = Date.now();
    } else {
      r.recorder.pause();
      r.paused = true;
      r.elapsedMs += Date.now() - r.startedAt;
    }
    const b = document.getElementById("nvBtnPause");
    if (b) {
      b.innerHTML = r.paused ? SVGS.play : SVGS.pause;
      b.title = r.paused ? "Lanjutkan" : "Jeda";
    }
    perbaruiInfoRekam();
  }

  async function nvRekamSelesai(tanpaKonfirmasi = false) {
    const r = nv.rec;
    if (!r || r.recorder.state === "inactive") return;
    if (!tanpaKonfirmasi && !(await tanya("Bagian rekaman yang tersisa akan dikirim ke server.",
      { judul: "Selesai merekam?", ok: "Selesai", batal: "Lanjut merekam" }))) return;
    if (r.recorder.state === "inactive") return;
    if (!r.paused) r.elapsedMs += Date.now() - r.startedAt;
    r.paused = false;
    r.recorder.stop();
    r.stream.getTracks().forEach((t) => t.stop());
    ["nvBtnPause", "nvBtnStop"].forEach((id) => { const b = document.getElementById(id); if (b) b.disabled = true; });
  }

  async function kirimAntrean() {
    const r = nv.rec;
    if (!r || r.sending) return;
    r.sending = true;
    try {
      while (r.queue.length) {
        const c = r.queue[0];
        try {
          const res = await fetch(`${API}/meetings/${encodeURIComponent(nv.meetingId)}/recordings/${encodeURIComponent(r.fileId)}/chunks/${c.seq}`, {
            method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/octet-stream" }, body: c.blob,
          });
          let data = null;
          try { data = await res.json(); } catch { data = null; }
          if (res.ok || (res.status === 409 && data?.expectedSeq > c.seq)) {
            r.queue.shift();
            r.gagalBeruntun = 0;
          } else if (res.status === 401 || res.status === 403 || res.status === 404) {
            r.errorTetap = data?.error || "Sesi berakhir atau rapat tidak ditemukan. Rekaman tidak bisa dikirim.";
            break;
          } else {
            throw new Error(data?.error || `kode ${res.status}`);
          }
        } catch (err) {
          r.gagalBeruntun++;
          r.errorTerakhir = err.message;
          perbaruiInfoRekam();
          await new Promise((ok) => setTimeout(ok, Math.min(30000, 2000 * r.gagalBeruntun)));
        }
        perbaruiInfoRekam();
      }
    } finally {
      r.sending = false;
    }
    if (r.stopped && !r.queue.length && !r.errorTetap) await selesaikanRekaman(r);
    else if (r.errorTetap) { perbaruiInfoRekam(); gagal(r.errorTetap, "Rekaman tidak bisa dikirim"); }
  }

  async function selesaikanRekaman(r) {
    try {
      await api(`/meetings/${encodeURIComponent(nv.meetingId)}/recordings/${encodeURIComponent(r.fileId)}/finish`, { method: "POST" });
    } catch { /* file tetap bisa diproses */ }
    lepasPerekam(r);
    beritahu("Rekaman tersimpan di server.");
    await muatUlang();
  }

  function lepasPerekam(r) {
    clearInterval(r.timer);
    if (r.raf) cancelAnimationFrame(r.raf);
    try { r.audioCtx && r.audioCtx.close(); } catch { /* ignore */ }
    try { r.wakeLock && r.wakeLock.release(); } catch { /* ignore */ }
    document.removeEventListener("visibilitychange", r.onVisible);
    window.removeEventListener("beforeunload", cegahKeluar);
    try { window.parent && window.parent.removeEventListener("beforeunload", cegahKeluar); } catch { /* ignore */ }
    nv.rec = null;
  }

  function cegahKeluar(ev) {
    if (!nv.rec) return undefined;
    ev.preventDefault();
    ev.returnValue = "Rekaman masih berjalan atau belum selesai terkirim.";
    return ev.returnValue;
  }

  function pasangMeter(r) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      r.audioCtx = new Ctx();
      const src = r.audioCtx.createMediaStreamSource(r.stream);
      const an = r.audioCtx.createAnalyser();
      an.fftSize = 1024;
      src.connect(an);
      const buf = new Float32Array(an.fftSize);
      const loop = () => {
        an.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        const level = Math.min(1, rms * 4);
        const el = document.getElementById("nvLevel");
        if (el) {
          el.style.width = `${Math.round((r.paused ? 0 : level) * 100)}%`;
          el.style.background = level > 0.85 ? "#dc2626" : level > 0.5 ? "#f59e0b" : "#16a34a";
        }
        r.raf = requestAnimationFrame(loop);
      };
      loop();
    } catch { /* meter opsional */ }
  }

  async function pasangWakeLock(r) {
    if (!("wakeLock" in navigator)) return;
    const minta = async () => {
      try { r.wakeLock = await navigator.wakeLock.request("screen"); } catch { /* ditolak browser */ }
    };
    await minta();
    r.onVisible = () => { if (document.visibilityState === "visible" && nv.rec === r) minta(); };
    document.addEventListener("visibilitychange", r.onVisible);
  }

  function perbaruiInfoRekam() {
    const r = nv.rec;
    if (!r) return;
    const ms = r.elapsedMs + (r.paused || r.stopped ? 0 : Date.now() - r.startedAt);
    const t = document.getElementById("nvTimer");
    if (t) t.textContent = jam(ms / 1000);
    const s = document.getElementById("nvRecState");
    if (s) {
      s.innerHTML = r.stopped ? "Mengirim sisa rekaman…" : r.paused ? "Dijeda" : `<span class="nv-record-dot" style="display:inline-block;background:#ef4444;width:8px;height:8px;margin-right:4px;"></span> Merekam`;
    }
  }

  function hubungkanUlangPerekamUI() {
    const sel = document.getElementById("nvMic");
    if (sel) sel.disabled = true;
    perbaruiInfoRekam();
  }

  /* ---------- Mode Perekam Ruangan (Hardware / Mini PC Ruangan) ---------- */

  const rekamState = { data: null, error: "", timer: null, kode: null };

  async function nvBukaPerekam() {
    if (nv.editing && !(await tanyaTinggalkan())) return;
    nv.editing = false;
    nv.view = "perekam";
    rekamState.kode = null;
    renderPerekam();
    muatPerekam();
    clearInterval(rekamState.timer);
    rekamState.timer = setInterval(muatPerekam, 10000);
  }

  function nvTutupPerekam() {
    clearInterval(rekamState.timer);
    rekamState.timer = null;
    nv.view = "rapat";
    render();
  }

  async function muatPerekam() {
    if (nv.view !== "perekam") return;
    try {
      rekamState.data = await api("/perekam");
      rekamState.error = "";
    } catch (err) {
      rekamState.error = err.message;
    }
    if (nv.view !== "perekam") return;
    const sel = document.getElementById("nvRecRoom");
    if (sel && sel.options.length <= 1 && rekamState.data) {
      sel.innerHTML = `<option value="">Pilih ruangan…</option>` +
        rekamState.data.rooms.map((r) => `<option value="${e(r)}">${e(r)}</option>`).join("");
    }
    const list = document.getElementById("nvRecList");
    if (list) list.innerHTML = htmlDaftarPerekam();
  }

  function renderPerekam() {
    const alamat = `${location.origin}/perekam`;
    root().innerHTML = `
      <div class="nv-shell">
        <div class="nv-topbar">
          <div class="nv-topbar-left">
            <button type="button" class="nv-nav-back" onclick="nvTutupPerekam()">${SVGS.back} Kembali ke Notulen Rapat</button>
            <span class="nv-nav-slash">/</span>
            <span class="nv-nav-title">Perekam Ruangan</span>
          </div>
        </div>

        <div class="nv-header-card">
          <h1 class="nv-meeting-h1" style="margin-bottom:8px;">Perekam Otomatis Ruang Rapat</h1>
          <div style="font-size:13px;color:#64748b;line-height:1.6;">
            Setiap rapat yang sudah disetujui di ruangan yang memiliki perangkat perekam aktif akan direkam secara otomatis,
            lalu transkrip & notulen AI-nya diproses saat rapat selesai.
          </div>
        </div>

        <div class="nv-sec-card">
          <h2 class="nv-sec-title" style="margin-bottom:12px;">Pasang Perangkat Baru</h2>
          <ol style="margin:0 0 16px 20px;padding:0;font-size:13px;color:#475569;line-height:1.8;">
            <li>Di PC / Mini PC ruang rapat yang terhubung microphone, buka URL <code>${e(alamat)}</code> di browser Chrome atau Edge (Wajib HTTPS atau localhost).</li>
            <li>Pilih ruangan lalu klik <b>Buat Kode Pemasangan</b>, masukkan kode 8 digit ke halaman perekam (berlaku 30 menit).</li>
            <li>Izinkan mikrofon dan biarkan tab browser tetap terbuka selama operasional harian.</li>
          </ol>

          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            <select id="nvRecRoom" class="nv-select-field" style="max-width:240px;"><option value="">Memuat ruangan…</option></select>
            <input id="nvRecLabel" class="nv-select-field" style="flex:1;min-width:200px;" maxlength="150" placeholder="Nama perangkat (opsional), mis. PC Ruang Rapat Besar">
            <button type="button" class="nv-btn-blue-cta" onclick="nvBuatKode()">Buat Kode Pemasangan</button>
          </div>
          <div id="nvRecKode">${htmlKode()}</div>
        </div>

        <div class="nv-sec-card">
          <div class="nv-sec-header">
            <h2 class="nv-sec-title">Perangkat Terpasang</h2>
            <span class="nv-sec-subnote">Diperbarui tiap 10 detik</span>
          </div>
          <div id="nvRecList">${htmlDaftarPerekam()}</div>
        </div>
      </div>
    `;
  }

  function htmlKode() {
    const k = rekamState.kode;
    if (!k) return "";
    return `
      <div class="nv-alert-box nv-alert-ok" style="text-align:center;margin-top:16px;">
        <div>Kode pemasangan untuk <b>${e(k.ruang || "perangkat")}</b>:</div>
        <div style="font-family:Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:6px;color:#0f172a;margin:10px 0;">
          ${e(k.kode.slice(0, 4))}-${e(k.kode.slice(4))}
        </div>
        <div style="font-size:12px;color:#64748b;">Berlaku ${k.berlakuMenit} menit dan hanya dapat dipakai sekali.</div>
      </div>
    `;
  }

  function htmlDaftarPerekam() {
    if (rekamState.error) return `<div class="nv-alert-box nv-alert-err">${e(rekamState.error)}</div>`;
    const d = rekamState.data;
    if (!d) return `<p style="color:#64748b;font-size:13px;">Memuat data perangkat…</p>`;
    const baris = d.perangkat.map((p) => {
      const st = p.status || {};
      let badge;
      if (!p.terpasang) {
        badge = p.kodeBerlakuSampai && new Date(p.kodeBerlakuSampai) > new Date()
          ? `<span class="nv-status-tag nv-status-draft">Menunggu kode</span>`
          : `<span class="nv-status-tag nv-status-failed">Kode kedaluwarsa</span>`;
      } else if (!p.online) {
        badge = `<span class="nv-status-tag nv-status-failed">Offline</span>`;
      } else if (st.state === "merekam") {
        badge = `<span class="nv-status-tag nv-status-failed">● Merekam</span>`;
      } else if (st.state === "mengirim") {
        badge = `<span class="nv-status-tag nv-status-proc">Mengirim audio</span>`;
      } else {
        badge = `<span class="nv-status-tag nv-status-done">Siap</span>`;
      }
      return `
        <div class="nv-file-row">
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:10px;">
              <b style="font-size:14px;color:#0f172a;">${e(p.ruang)}</b>
              ${badge}
            </div>
            <div style="font-size:12px;color:#64748b;margin-top:3px;">
              ${e(p.label || "-")} &bull; Mic: ${e(st.micLabel || "-")} &bull; Terakhir terhubung: ${p.terakhirTerlihat ? waktuLokal(p.terakhirTerlihat) : "-"}
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <button type="button" class="nv-btn-outline-download" style="padding:5px 10px;font-size:11.5px;" onclick="nvKodeUlang('${e(p.id)}')">Kode Baru</button>
            <button type="button" class="nv-btn-outline-download" style="padding:5px 10px;font-size:11.5px;color:#dc2626;border-color:#fecaca;" onclick="nvCabutPerekam('${e(p.id)}')">Cabut</button>
          </div>
        </div>
      `;
    }).join("");

    return baris || `<p style="color:#64748b;font-size:13px;">Belum ada perangkat perekam yang terhubung.</p>`;
  }

  async function nvBuatKode() {
    const roomName = document.getElementById("nvRecRoom")?.value;
    if (!roomName) { info("Pilih ruangan untuk perangkat perekam ini terlebih dulu.", "Ruangan belum dipilih"); return; }
    const label = document.getElementById("nvRecLabel")?.value.trim();
    try {
      const r = await api("/perekam", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roomName, label }),
      });
      rekamState.kode = { ...r, ruang: roomName };
      document.getElementById("nvRecKode").innerHTML = htmlKode();
      muatPerekam();
    } catch (err) { gagal(err.message); }
  }

  async function nvKodeUlang(id) {
    if (!(await tanya("Perangkat yang sekarang terpasang akan terputus sampai kode baru dimasukkan di perangkat itu.",
      { judul: "Buat kode pemasangan baru?", ok: "Buat kode baru" }))) return;
    try {
      const r = await api(`/perekam/${encodeURIComponent(id)}/kode`, { method: "POST" });
      const p = rekamState.data?.perangkat.find((x) => x.id === id);
      rekamState.kode = { ...r, ruang: p?.ruang };
      document.getElementById("nvRecKode").innerHTML = htmlKode();
      muatPerekam();
    } catch (err) { gagal(err.message); }
  }

  async function nvCabutPerekam(id) {
    if (!(await tanya("Perangkat langsung berhenti bisa merekam, dan rapat di ruangan itu tidak lagi terekam otomatis.",
      { judul: "Cabut perangkat perekam?", ok: "Cabut", jenis: "bahaya" }))) return;
    try {
      await api(`/perekam/${encodeURIComponent(id)}`, { method: "DELETE" });
      beritahu("Perangkat perekam dicabut.");
      muatPerekam();
    } catch (err) { gagal(err.message); }
  }

  async function nvMasukUlang() {
    const kunci = ["isAuthenticated", "currentUser", "dashboard_isAuthenticated", "dashboard_currentUser",
      "booking_isAuthenticated", "booking_currentUser"];
    try { await fetch("/api/dashboard/logout", { method: "POST", credentials: "same-origin" }); } catch { /* ignore */ }
    [window, window.parent, window.top].forEach((w) => {
      kunci.forEach((k) => {
        try { w?.sessionStorage?.removeItem(k); } catch { /* ignore */ }
        try { w?.localStorage?.removeItem(k); } catch { /* ignore */ }
      });
    });
    const tujuan = "/login?portal=dashboard&logout=true";
    try { window.top.location.href = tujuan; } catch { window.location.href = tujuan; }
  }

  /* ---------- Global Exports ---------- */
  Object.assign(window, {
    openNotulen, closeNotulen, nvUnggah, nvPutar, nvHapusFile, nvHapusHasil, nvProses, nvBatal, nvSimpanNama, nvBuatUlang,
    nvMasukUlang, nvBukaPerekam, nvTutupPerekam, nvBuatKode, nvKodeUlang, nvCabutPerekam,
    nvTab, nvPilihModel, nvGantiNumSpk, nvGunakanModelRingan, nvToggleModelConfig, nvCariTranskrip,
    nvToggleExportMenu, nvCloseExportMenu, nvKlasifikasi, nvInfo,
    nvEdit, nvBatalEdit, nvSimpanNotulen, nvUnduhMd, nvUnduhTranskrip, nvCetak, nvMuatMic,
    nvRekamMulai, nvRekamJeda, nvRekamSelesai,
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && nv.meetingId && !document.querySelector(".nv-dlg")
      && !document.getElementById("modal")?.classList.contains("show")) {
      closeNotulen();
    }
  });
})();
