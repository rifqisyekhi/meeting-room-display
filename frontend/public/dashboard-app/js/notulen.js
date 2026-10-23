/* ===== NOTULEN OTOMATIS (khusus Admin) ===================================

   Dibuka dari tombol "Notulen" di tabel Manajemen Rapat. Tampil sebagai
   layar penuh di luar #app, supaya tidak ikut tertimpa saat render() dashboard
   berjalan ulang karena sinkronisasi latar belakang.

   Isi: perekam browser (upload bertahap tiap ±30 detik, idempoten), unggah
   file audio, daftar file, proses (progress per tahap + perkiraan sisa
   waktu), tab Transkrip (ganti nama pembicara) dan tab Notulen (pratinjau,
   sunting, tandai sudah ditinjau, unduh .md, cetak/PDF).

   Semua permintaan ke /api/notulen/* memakai cookie sesi (same-origin).
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
    info: null, // panel (i) yang terbuka: "whisper" | "llm" | null
    membatalkan: false, // permintaan batal sudah dikirim, menunggu worker berhenti
  };

  /* Spesifikasi minimal per model untuk panel (i). Hanya "small" yang sudah
     diukur (laptop Core Ultra 5, 3 thread, RTF ±0,34); sisanya perkiraan.
     Angka pasti di server: jalankan ai-service/scripts/benchmark.py. */
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

  const KETERANGAN_WHISPER = {
    tiny: "sangat cepat, akurasi rendah",
    base: "cepat, akurasi rendah",
    small: "cepat, akurasi cukup",
    medium: "lebih akurat, lebih lambat",
    turbo: "akurat, cukup cepat",
    "large-v3-turbo": "akurat, cukup cepat",
    "large-v3": "paling akurat, sangat lambat tanpa GPU",
  };

  /* ---------- utilitas ---------- */

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
     true bila tombol utama ditekan, false bila ditutup (Batal, ✕, Esc, klik di luar). */
  const DLG_IKON = { info: "i", peringatan: "!", bahaya: "!", error: "✕" };

  function dialog({ judul = "Informasi", pesan = "", jenis = "info", ok = "Mengerti", batal = "" } = {}) {
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
          <div class="nv-dlg-aksi">
            ${batal ? `<button type="button" class="nv-btn nv-btn-light" data-v="0">${e(batal)}</button>` : ""}
            <button type="button" class="nv-btn ${jenis === "bahaya" ? "nv-btn-red" : "nv-btn-primary"}" data-v="1">${e(ok)}</button>
          </div>
        </div>`;
      const tutup = (v) => {
        document.removeEventListener("keydown", onKey, true);
        el.remove();
        if (fokusLama instanceof HTMLElement && fokusLama.isConnected) fokusLama.focus();
        selesai(v);
      };
      const onKey = (ev) => {
        if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); tutup(false); return; }
        if (ev.key !== "Tab") return;
        const tombol = [...el.querySelectorAll("button")];
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

  /* Markdown sederhana → HTML (judul, daftar, tabel, tebal/miring, kutipan).
     Teks di-escape dulu, jadi isi notulen tidak bisa menyisipkan HTML. */
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

  /* ---------- buka / tutup ---------- */

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
    nv.membatalkan = false;
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
      root().innerHTML = `<div class="nv-shell"><div class="nv-top"><button class="nv-back" onclick="closeNotulen()">← Kembali</button></div>
        <div class="nv-alert nv-alert-err">${e(err.message)}
          ${err.status === 401 ? `<div class="nv-row"><button class="nv-btn nv-btn-primary" onclick="nvMasukUlang()">Masuk kembali</button>
            <span class="nv-small">Dashboard masih menampilkan Anda sebagai login, tetapi sesi di server sudah berakhir
            (mis. backend di-restart atau sudah lebih dari 12 jam).</span></div>` : ""}</div></div>`;
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
    const sel = document.getElementById("nvModelSel");
    if (sel) sel.innerHTML = htmlPilihModel();
    const slot = document.getElementById("nvAiStatus");
    if (slot) slot.innerHTML = htmlStatusAI();
    const diar = document.getElementById("nvDiarWrap");
    if (diar) diar.style.display = nv.ai?.diarization?.enabled ? "" : "none";
  }

  /* ---------- render ---------- */

  function htmlStatusAI() {
    const a = nv.ai;
    if (!a) return `<span class="nv-chip">Memeriksa service AI...</span>`;
    if (!a.reachable) return `<span class="nv-chip nv-chip-err" title="${e(a.error)}">Service AI tidak aktif</span>`;
    const ram = a.ram || {};
    const cukup = ram.enough_for_whisper !== false;
    return `<span class="nv-chip ${cukup ? "nv-chip-ok" : "nv-chip-warn"}" title="RAM tersedia ${ram.available_mb} MB">
      Service AI aktif · ${e(a.whisper?.model || "")} · RAM ${ram.available_mb ?? "?"} MB${cukup ? "" : " (kurang)"}</span>
      ${a.ollama && !a.ollama.reachable ? `<span class="nv-chip nv-chip-warn">Ollama tidak aktif: notulen tidak bisa dibuat</span>` : ""}
      ${(a.queue?.queued || 0) + (a.queue?.running || 0) > 0 ? `<span class="nv-chip">Antrean: ${(a.queue.running || 0) + (a.queue.queued || 0)} job</span>` : ""}`;
  }

  function htmlPilihModel() {
    const m = nv.models;
    if (!m) return `<p class="nv-muted nv-small">Pilihan model dimuat saat service AI aktif; tanpa itu dipakai model default server.</p>`;
    const gb = (mb) => `${(mb / 1024).toFixed(1).replace(".", ",")} GB`;
    const opsiW = (m.whisper || []).map((w) => `<option value="${e(w.default ? "" : w.name)}" ${(nv.pilih.whisper || "") === (w.default ? "" : w.name) ? "selected" : ""}>
      ${e(w.name)}${w.default ? " (default)" : ""} — ${e(KETERANGAN_WHISPER[w.name] || "model kustom")} · RAM ±${gb(w.required_ram_mb)}${w.downloaded ? "" : " · belum diunduh"}</option>`).join("");
    const opsiL = (m.llm || []).map((l) => `<option value="${e(l.default ? "" : l.name)}" ${(nv.pilih.llm || "") === (l.default ? "" : l.name) ? "selected" : ""}>
      ${e(l.name)}${l.default ? " (default)" : ""}${l.size_mb ? ` · ±${gb(l.size_mb)}` : ""}</option>`).join("");
    const belumUnduh = (m.whisper || []).find((w) => (nv.pilih.whisper ? w.name === nv.pilih.whisper : w.default) && !w.downloaded);
    const tombolInfo = (jenis) => `<button type="button" class="nv-info ${nv.info === jenis ? "open" : ""}"
      onclick="nvInfo('${jenis}')" aria-expanded="${nv.info === jenis}" title="Spesifikasi minimal tiap model">i</button>`;
    return `
      <div class="nv-models">
        <div class="nv-model-field">
          <div class="nv-model-head"><span>Model transkripsi (Whisper)</span>${tombolInfo("whisper")}</div>
          <select class="nv-input" aria-label="Model transkripsi" onchange="nvPilihModel('whisper', this.value)">${opsiW}</select>
        </div>
        <div class="nv-model-field">
          <div class="nv-model-head"><span>Model notulen (Ollama) <span class="nv-muted nv-small">— juga dipakai "Buat ulang notulen"</span></span>${tombolInfo("llm")}</div>
          ${m.ollama_reachable
            ? (opsiL ? `<select class="nv-input" aria-label="Model notulen" onchange="nvPilihModel('llm', this.value)">${opsiL}</select>`
              : `<div class="nv-alert nv-alert-warn">Belum ada model di Ollama. Jalankan: <code>ollama pull ${e(m.default_llm)}</code></div>`)
            : `<div class="nv-alert nv-alert-warn">Ollama tidak aktif: transkrip tetap dibuat, notulen bisa dibuat ulang nanti.</div>`}
        </div>
      </div>
      ${nv.info ? htmlInfoSpek(nv.info) : ""}
      ${belumUnduh ? `<p class="nv-muted nv-small">Model ${e(belumUnduh.name)} belum ada di server; diunduh otomatis saat dipakai pertama kali
        (butuh internet, bisa beberapa menit). Di server offline, unduh dulu dengan scripts/download_models.py.</p>` : ""}`;
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
        <p class="nv-muted nv-small">Waktu proses = lama transkripsi dibanding durasi audio, di CPU int8 dengan 3–4 thread.
          Dengan GPU NVIDIA semua model jauh lebih cepat (±0,05× durasi). Pemisahan pembicara menambah ±0,3× durasi
          dan ±0,5 GB RAM per jam audio. Tahap transkripsi, pemisahan pembicara, dan notulen berjalan bergantian,
          jadi kebutuhan RAM-nya tidak dijumlahkan.</p>`;
    } else {
      const daftar = (m.llm || []).length ? m.llm : Object.keys(SPEK_LLM).map((name) => ({ name }));
      isi = `<table class="nv-spec"><thead><tr><th>Model</th><th>RAM bebas min.</th><th>CPU</th><th>GPU NVIDIA</th>
        <th>Kecepatan</th><th>Catatan</th></tr></thead><tbody>${
        daftar.map((l) => {
          const sp = SPEK_LLM[l.name] || SPEK_LLM[String(l.name).replace(/:latest$/, "")] || {};
          const ram = sp.ram || (l.size_mb ? `≥ ${gb(l.size_mb + 1536)} (ukuran model + 1,5 GB)` : "-");
          return `<tr><td><b>${e(l.name)}</b>${l.size_mb ? `<br><span class="nv-muted nv-small">file ±${gb(l.size_mb)}</span>` : ""}</td>
            <td>${e(ram)}</td><td>${e(sp.cpu || "≥ 4 core")}</td><td>${e(sp.gpu || "Opsional")}</td>
            <td>${e(sp.cepat || "-")}</td><td>${e(sp.catatan || "")}</td></tr>`;
        }).join("")}</tbody></table>
        <p class="nv-muted nv-small">Dengan konteks 8192 token (OLLAMA_NUM_CTX). Rapat 6 jam ≈ 15–20 potongan transkrip.
          Ambang RAM yang dipakai server sebelum memanggil LLM diatur di LLM_MIN_FREE_RAM_MB.</p>`;
    }
    return `<div class="nv-info-panel" role="region" aria-label="Spesifikasi minimal model">
      <div class="nv-row nv-between"><b>Spesifikasi minimal — ${jenis === "whisper" ? "model transkripsi" : "model notulen"}</b>
        <button type="button" class="nv-btn nv-btn-light nv-btn-sm" onclick="nvInfo(null)">Tutup</button></div>
      ${avail != null ? `<p class="nv-small">RAM bebas server saat ini: <b>${gb(avail)}</b>.</p>` : ""}
      ${isi}
      <p class="nv-muted nv-small">* Perkiraan, belum diukur di server instansi. Angka pasti: jalankan
        <code>ai-service/scripts/benchmark.py</code> dengan rekaman rapat asli.</p>
    </div>`;
  }

  function nvInfo(jenis) {
    nv.info = nv.info === jenis ? null : jenis;
    const sel = document.getElementById("nvModelSel");
    if (sel) sel.innerHTML = htmlPilihModel();
  }

  function nvPilihModel(jenis, nilai) {
    nv.pilih[jenis] = nilai;
    const sel = document.getElementById("nvModelSel");
    if (sel) sel.innerHTML = htmlPilihModel();
  }

  function badgeStatus(s) {
    const peta = {
      DRAFT: ["Belum diproses", "nv-b-grey"],
      PROCESSING: ["Sedang diproses", "nv-b-blue"],
      DONE: ["Selesai", "nv-b-green"],
      FAILED: ["Gagal", "nv-b-red"],
    };
    const [t, c] = peta[s] || peta.DRAFT;
    return `<span class="nv-badge ${c}">${t}</span>`;
  }

  function render() {
    if (nv.view === "perekam") return renderPerekam();
    const d = nv.data;
    if (!d) return;
    const m = d.meeting;
    const mn = d.minutes || { status: "DRAFT", transcript: [], speakers: {} };
    const proses = mn.status === "PROCESSING";
    root().innerHTML = `
      <div class="nv-shell">
        <div class="nv-top">
          <div class="nv-row">
            <button class="nv-back" onclick="closeNotulen()">← Kembali ke Manajemen Rapat</button>
            <button class="nv-btn nv-btn-light" onclick="nvBukaPerekam()" title="Pasang & pantau perekam otomatis di ruang rapat">📡 Perekam ruangan</button>
          </div>
          <div id="nvAiStatus" class="nv-ai">${htmlStatusAI()}</div>
        </div>
        <div class="nv-head">
          <div>
            <div class="nv-crumb">Manajemen Rapat › Notulen Otomatis</div>
            <h1>${e(m.title)}</h1>
            <div class="nv-meta">${e(m.date)} · ${e(m.start)}–${e(m.end)} WIB · ${e(m.room)}${m.location ? ", " + e(m.location) : ""} · ${e(m.requester || "")}</div>
          </div>
          <div>${badgeStatus(mn.status)}</div>
        </div>
        <div class="nv-note">Audio rapat diproses sepenuhnya di server instansi (lokal) dan tidak dikirim ke layanan cloud.</div>

        <div class="nv-grid">
          <section class="nv-card">
            <h2>1. Rekam rapat</h2>
            ${htmlPerekam(proses)}
          </section>
          <section class="nv-card">
            <h2>2. Atau unggah file audio</h2>
            <p class="nv-muted">mp3, m4a, wav, webm, ogg, dsb. File besar (ratusan MB) didukung.</p>
            <label class="nv-btn nv-btn-light ${proses ? "nv-disabled" : ""}">
              <input type="file" accept="audio/*,video/mp4,.m4a,.mp3,.wav,.webm,.ogg,.opus,.flac,.aac" multiple
                onchange="nvUnggah(this)" ${proses ? "disabled" : ""} hidden> Pilih file audio…
            </label>
            <div id="nvUpload"></div>
          </section>
        </div>

        <section class="nv-card">
          <h2>File audio rapat <span class="nv-muted">(diproses berurutan dari atas ke bawah)</span></h2>
          ${htmlDaftarFile(d.files, proses)}
        </section>

        <section class="nv-card">
          <h2>3. Proses menjadi transkrip & notulen</h2>
          ${htmlProses(mn, d.files)}
        </section>

        ${mn.hasTranscript || mn.hasMinutes ? htmlHasil(mn) : ""}
      </div>`;
    if (nv.rec) hubungkanUlangPerekamUI();
  }

  function htmlPerekam(proses) {
    const r = nv.rec;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      return `<div class="nv-alert nv-alert-warn">Perekaman di browser memerlukan koneksi <b>HTTPS</b> (atau localhost) dan browser modern
        (Chrome/Edge/Firefox terbaru). Halaman ini dibuka lewat <code>${e(location.protocol)}//${e(location.host)}</code>.
        Gunakan opsi unggah file di samping, atau minta admin server mengaktifkan HTTPS.</div>`;
    }
    return `
      <div class="nv-rec">
        <div class="nv-row">
          <select id="nvMic" class="nv-input" ${r ? "disabled" : ""} onfocus="nvMuatMic()"><option value="">Mikrofon bawaan</option></select>
          <button class="nv-btn nv-btn-light" onclick="nvMuatMic(true)" ${r ? "disabled" : ""} title="Muat ulang daftar mikrofon">↻</button>
        </div>
        <div class="nv-meter"><div id="nvLevel" class="nv-level"></div></div>
        <div class="nv-row nv-rec-info">
          <span id="nvTimer" class="nv-timer">00:00:00</span>
          <span id="nvRecState" class="nv-muted">${r ? "" : "Siap merekam"}</span>
          <span id="nvPending" class="nv-muted"></span>
        </div>
        <div class="nv-row">
          <button id="nvBtnStart" class="nv-btn nv-btn-red" onclick="nvRekamMulai()" ${proses || r ? "disabled" : ""}>● Mulai</button>
          <button id="nvBtnPause" class="nv-btn nv-btn-light" onclick="nvRekamJeda()" ${r ? "" : "disabled"}>${r?.paused ? "▶ Lanjut" : "❚❚ Jeda"}</button>
          <button id="nvBtnStop" class="nv-btn nv-btn-dark" onclick="nvRekamSelesai()" ${r ? "" : "disabled"}>■ Selesai</button>
        </div>
        <p class="nv-muted nv-small">Rekaman dikirim ke server setiap ±30 detik. Jangan tutup atau muat ulang halaman selama
          merekam. Bila halaman sempat dimuat ulang, rekaman berikutnya disimpan sebagai file baru dan tetap ikut diproses.</p>
      </div>`;
  }

  function htmlDaftarFile(files, proses) {
    if (!files || !files.length) return `<p class="nv-muted">Belum ada file audio.</p>`;
    return `<table class="nv-table"><thead><tr><th>No</th><th>Nama</th><th>Jenis</th><th>Ukuran</th><th>Waktu</th><th>Oleh</th><th></th></tr></thead><tbody>${
      files.map((f, i) => `<tr>
        <td>${i + 1}</td>
        <td>${e(f.originalName || f.id)}${f.status === "merekam" ? ` <span class="nv-badge nv-b-blue">belum ditutup</span>` : ""}</td>
        <td>${f.kind === "rekaman" ? "Rekaman" : "Unggahan"}</td>
        <td>${ukuran(f.sizeBytes)}</td>
        <td>${waktuLokal(f.createdAt)}</td>
        <td>${e(f.createdBy || "-")}</td>
        <td class="nv-nowrap">
          <button class="nv-btn nv-btn-light nv-btn-sm" onclick="nvPutar('${e(f.id)}')">▶ Putar</button>
          <button class="nv-btn nv-btn-ghost-red nv-btn-sm" onclick="nvHapusFile('${e(f.id)}')" ${proses || (nv.rec && nv.rec.fileId === f.id) ? "disabled" : ""}>Hapus</button>
        </td></tr>`).join("")}</tbody></table>
      <div id="nvPlayer"></div>`;
  }

  function htmlProses(mn, files) {
    const proses = mn.status === "PROCESSING";
    const adaFile = (files || []).some((f) => f.sizeBytes > 0);
    let isi = "";
    if (proses) {
      const urutan = TAHAP.filter(([k]) => k !== "diarizing" || mn.diarization || mn.stage === "diarizing")
        .filter(([k]) => mn.jobType !== "summarize" || k === "summarizing");
      const idx = urutan.findIndex(([k]) => k === mn.stage);
      isi = `
        <div class="nv-steps">${urutan.map(([k, label], i) => `
          <div class="nv-step ${i < idx ? "done" : i === idx ? "active" : ""}"><span>${i < idx ? "✓" : i + 1}</span>${label}</div>`).join("")}
        </div>
        <div class="nv-progress"><div style="width:${Math.round((mn.progress || 0) * 100)}%"></div></div>
        <div class="nv-row nv-between">
          <span><b>${e(mn.stageLabel || "Menunggu antrean")}</b>
            ${mn.queuePosition ? ` · antrean ke-${mn.queuePosition}` : ""}
            ${mn.stage ? ` · tahap ini ${Math.round((mn.stageProgress || 0) * 100)}%` : ""}</span>
          <span class="nv-muted">${Math.round((mn.progress || 0) * 100)}% ${mn.etaSeconds != null ? "· " + sisaWaktu(mn.etaSeconds) : ""}</span>
        </div>
        <p class="nv-muted nv-small">Proses berjalan di server; halaman ini boleh ditutup dan dibuka lagi nanti.
          Rapat panjang bisa memakan waktu beberapa jam di server tanpa GPU.</p>
        ${nv.membatalkan
          ? `<button class="nv-btn nv-btn-ghost-red" disabled>Membatalkan…</button>
             <span class="nv-muted nv-small">Menunggu proses berhenti (beberapa detik).</span>`
          : `<button class="nv-btn nv-btn-ghost-red" onclick="nvBatal()">Batalkan proses</button>`}`;
    } else {
      isi = `
        <div id="nvModelSel">${htmlPilihModel()}</div>
        <div class="nv-row nv-wrap">
          <label id="nvDiarWrap" class="nv-check" style="${nv.ai?.diarization?.enabled ? "" : "display:none"}">
            <input type="checkbox" id="nvDiar" checked> Pisahkan pembicara
          </label>
          <label class="nv-check">Jumlah pembicara
            <input type="number" id="nvNumSpk" class="nv-input nv-input-sm" min="1" max="50" placeholder="otomatis">
          </label>
          <button class="nv-btn nv-btn-primary" onclick="nvProses()" ${adaFile && !nv.rec ? "" : "disabled"}>
            ${mn.hasTranscript ? "Proses ulang dari audio" : "Proses sekarang"}</button>
        </div>
        ${!adaFile ? `<p class="nv-muted">Rekam atau unggah audio terlebih dulu.</p>` : ""}
        ${mn.hasTranscript ? `<p class="nv-muted nv-small">Proses ulang akan mengganti transkrip dan notulen yang ada.</p>` : ""}`;
    }
    const pesan = [];
    if (mn.status === "FAILED" && mn.error) pesan.push(`<div class="nv-alert nv-alert-err"><b>Proses gagal:</b> ${e(mn.error)}</div>`);
    if (mn.minutesError) pesan.push(`<div class="nv-alert nv-alert-warn"><b>Transkrip tersimpan, tetapi notulen gagal dibuat:</b> ${e(mn.minutesError)}
      <br>Setelah masalahnya teratasi, gunakan tombol "Buat ulang notulen" di tab Transkrip.</div>`);
    (mn.warnings || []).filter((w) => !mn.minutesError || !w.includes(mn.minutesError))
      .forEach((w) => pesan.push(`<div class="nv-alert nv-alert-warn">${e(w)}</div>`));
    return isi + pesan.join("");
  }

  function htmlHasil(mn) {
    const tab = nv.tab;
    return `
      <section class="nv-card">
        <div class="nv-tabs">
          <button class="${tab === "transkrip" ? "active" : ""}" onclick="nvTab('transkrip')">Transkrip</button>
          <button class="${tab === "notulen" ? "active" : ""}" onclick="nvTab('notulen')">Notulen</button>
          <span class="nv-muted nv-small nv-push">${mn.durationSeconds ? `Durasi audio ${jam(mn.durationSeconds)}` : ""}
            ${mn.whisperModel ? ` · Whisper ${e(mn.whisperModel)}` : ""}${mn.llmModel ? ` · ${e(mn.llmModel)}` : ""}
            ${mn.finishedAt ? ` · diproses ${waktuLokal(mn.finishedAt)}` : ""}</span>
        </div>
        ${tab === "transkrip" ? htmlTranskrip(mn) : htmlNotulen(mn)}
      </section>`;
  }

  function daftarPembicara(mn) {
    return [...new Set((mn.transcript || []).map((s) => s.speaker).filter(Boolean))];
  }

  function htmlTranskrip(mn) {
    const spk = daftarPembicara(mn);
    const nama = mn.speakers || {};
    const proses = mn.status === "PROCESSING";
    const ganti = spk.length ? `
      <div class="nv-speakers">
        <b>Nama pembicara</b>
        <p class="nv-muted nv-small">Isi nama sesuai suara (putar audio untuk mencocokkan), lalu simpan dan buat ulang notulen agar nama dipakai.</p>
        <div class="nv-spk-grid">${spk.map((s) => `
          <label><span>${e(s)}</span><input class="nv-input" data-spk="${e(s)}" value="${e(nama[s] || "")}" placeholder="mis. Pak Budi"></label>`).join("")}
        </div>
      </div>` : "";
    const baris = (mn.transcript || []).map((s) => `
      <div class="nv-line"><span class="nv-ts">[${jam(s.start)}]</span>${s.speaker ? `<span class="nv-spk">${e(nama[s.speaker] || s.speaker)}:</span>` : ""} ${e(s.text)}</div>`).join("");
    return `
      ${ganti}
      <div class="nv-row nv-wrap">
        ${spk.length ? `<button class="nv-btn nv-btn-light" onclick="nvSimpanNama()" ${proses ? "disabled" : ""}>Simpan nama pembicara</button>` : ""}
        <button class="nv-btn nv-btn-primary" onclick="nvBuatUlang()" ${proses ? "disabled" : ""}>Buat ulang notulen</button>
        <button class="nv-btn nv-btn-light" onclick="nvUnduhTranskrip()">Unduh transkrip (.txt)</button>
      </div>
      <div class="nv-transcript">${baris || `<p class="nv-muted">Tidak ada ucapan yang terdeteksi.</p>`}</div>`;
  }

  function htmlNotulen(mn) {
    const proses = mn.status === "PROCESSING";
    const draf = mn.hasMinutes && !mn.minutesReviewed;
    const banner = !mn.hasMinutes
      ? `<div class="nv-alert nv-alert-warn">Notulen belum tersedia.${mn.hasTranscript ? ' Gunakan "Buat ulang notulen" di tab Transkrip.' : ""}</div>`
      : draf
        ? `<div class="nv-alert nv-alert-draft"><b>DRAF HASIL AI — wajib ditinjau notulis.</b> Periksa nama, angka, keputusan, PIC, dan tenggat
            sebelum dibagikan. AI bisa salah dengar atau salah ringkas.</div>`
        : `<div class="nv-alert nv-alert-ok">Sudah ditinjau${mn.minutesEditedBy ? ` oleh ${e(mn.minutesEditedBy)}` : ""}${mn.minutesEditedAt ? `, ${waktuLokal(mn.minutesEditedAt)}` : ""}.</div>`;
    if (nv.editing) {
      return `${banner}
        <textarea id="nvMdEdit" class="nv-editor" spellcheck="true">${e(mn.minutesMarkdown || "")}</textarea>
        <div class="nv-row nv-wrap">
          <label class="nv-check"><input type="checkbox" id="nvReviewed" ${mn.minutesReviewed ? "checked" : ""}> Saya sudah meninjau notulen ini</label>
          <button class="nv-btn nv-btn-primary" onclick="nvSimpanNotulen()">Simpan</button>
          <button class="nv-btn nv-btn-light" onclick="nvBatalEdit()">Batal</button>
        </div>`;
    }
    return `${banner}
      <div class="nv-row nv-wrap">
        <button class="nv-btn nv-btn-primary" onclick="nvEdit()" ${proses ? "disabled" : ""}>${mn.hasMinutes ? "Sunting / tinjau" : "Tulis manual"}</button>
        ${mn.hasMinutes ? `
          <button class="nv-btn nv-btn-light" onclick="nvUnduhMd()">Unduh .md</button>
          <button class="nv-btn nv-btn-light" onclick="nvCetak()">Cetak / simpan PDF</button>` : ""}
      </div>
      ${mn.hasMinutes ? `<article class="nv-md">${markdown(mn.minutesMarkdown)}</article>` : ""}`;
  }

  /* ---------- polling status ---------- */

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
        nv.data.minutes = { ...nv.data.minutes, ...minutes };
        perbaruiKartuProses();
      } catch (err) {
        if (err.status === 401 || err.status === 403) { berhentiPolling(); beritahu(err.message); }
      }
    }, POLL_MS);
  }

  function perbaruiKartuProses() {
    if (!nv.data?.minutes) return;
    const target = [...document.querySelectorAll(".nv-card h2")].find((h) => h.textContent.startsWith("3."));
    if (target) target.parentElement.innerHTML = `<h2>3. Proses menjadi transkrip & notulen</h2>${htmlProses(nv.data.minutes, nv.data.files)}`;
  }

  function berhentiPolling() {
    if (nv.pollTimer) clearInterval(nv.pollTimer);
    nv.pollTimer = null;
  }

  /* ---------- aksi: file ---------- */

  async function nvUnggah(input) {
    const files = [...(input.files || [])];
    input.value = "";
    const slot = document.getElementById("nvUpload");
    for (const file of files) {
      const id = "u" + Math.random().toString(36).slice(2);
      slot.insertAdjacentHTML("beforeend", `<div class="nv-up" id="${id}"><span>${e(file.name)} (${ukuran(file.size)})</span>
        <div class="nv-progress nv-progress-sm"><div style="width:0%"></div></div><span class="nv-muted">0%</span></div>`);
      try {
        await unggahSatu(file, (p) => {
          const el = document.getElementById(id);
          if (!el) return;
          el.querySelector(".nv-progress div").style.width = `${Math.round(p * 100)}%`;
          el.querySelector(".nv-muted").textContent = p >= 1 ? "Menyimpan…" : `${Math.round(p * 100)}%`;
        });
        document.getElementById(id)?.remove();
        beritahu(`File "${file.name}" berhasil diunggah.`);
      } catch (err) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = `<div class="nv-alert nv-alert-err">${e(file.name)}: ${e(err.message)}</div>`;
      }
    }
    await muatUlang();
  }

  /* XHR dipakai (bukan fetch) agar progress unggahan bisa ditampilkan. Body
     berupa File langsung, jadi browser mengalirkannya dari disk. */
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
    if (!(await tanya("File audio ini akan dihapus permanen dan tidak bisa dikembalikan.",
      { judul: "Hapus file audio?", ok: "Hapus", jenis: "bahaya" }))) return;
    try {
      await api(`/meetings/${encodeURIComponent(nv.meetingId)}/audio/${encodeURIComponent(fileId)}`, { method: "DELETE" });
      beritahu("File audio dihapus.");
      await muatUlang();
    } catch (err) { gagal(err.message); }
  }

  /* ---------- aksi: proses ---------- */

  async function nvProses() {
    const mn = nv.data?.minutes;
    if (mn?.hasTranscript && !(await tanya("Transkrip dan notulen yang sudah ada akan diganti dengan hasil baru. Proses ini memakan waktu lama.",
      { judul: "Proses ulang dari audio?", ok: "Proses ulang" }))) return;
    const body = {};
    const diar = document.getElementById("nvDiar");
    if (diar && document.getElementById("nvDiarWrap")?.style.display !== "none") body.diarization = diar.checked;
    const n = Number(document.getElementById("nvNumSpk")?.value);
    if (n > 0) body.numSpeakers = n;
    if (nv.pilih.whisper) body.whisperModel = nv.pilih.whisper;
    if (nv.pilih.llm) body.llmModel = nv.pilih.llm;
    try {
      await api(`/meetings/${encodeURIComponent(nv.meetingId)}/process`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      beritahu("Audio dikirim ke antrean pemrosesan.");
      await muatUlang();
    } catch (err) { gagal(err.message); }
  }

  async function nvBatal() {
    if (nv.membatalkan) return;
    if (!(await tanya("Proses berhenti dalam beberapa detik. Jika transkrip sudah selesai dibuat, transkrip itu "
      + "tetap disimpan. Hasil dari proses sebelumnya tidak berubah.",
      { judul: "Batalkan proses?", ok: "Batalkan proses", batal: "Tidak", jenis: "bahaya" }))) return;
    nv.membatalkan = true;
    perbaruiKartuProses();
    try {
      await api(`/meetings/${encodeURIComponent(nv.meetingId)}/cancel`, { method: "POST" });
      if (!nv.pollTimer) mulaiPolling();
    } catch (err) {
      nv.membatalkan = false;
      perbaruiKartuProses();
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
      beritahu("Notulen sedang dibuat ulang.");
      nv.tab = "notulen";
      await muatUlang();
    } catch (err) { gagal(err.message); }
  }

  /* ---------- aksi: hasil ---------- */

  async function nvTab(t) {
    if (nv.editing && t !== "notulen" && !(await tanyaTinggalkan())) return;
    if (t !== "notulen") nv.editing = false;
    nv.tab = t;
    render();
  }

  function tanyaTinggalkan() {
    return tanya("Perubahan notulen belum disimpan dan akan hilang.",
      { judul: "Tinggalkan tanpa menyimpan?", ok: "Tinggalkan", batal: "Tetap di sini", jenis: "bahaya" });
  }

  function nvEdit() { nv.editing = true; render(); document.getElementById("nvMdEdit")?.focus(); }
  function nvBatalEdit() { nv.editing = false; render(); }

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
    const m = nv.data.meeting;
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
    unduhTeks(nv.data.minutes.minutesMarkdown || "", namaBerkas(".md"), "text/markdown;charset=utf-8");
  }

  function nvUnduhTranskrip() {
    const mn = nv.data.minutes;
    const nama = mn.speakers || {};
    const isi = (mn.transcript || [])
      .map((s) => `[${jam(s.start)}]${s.speaker ? ` ${nama[s.speaker] || s.speaker}:` : ""} ${s.text}`).join("\n");
    unduhTeks(isi + "\n", namaBerkas(".txt").replace(/^Notulen/, "Transkrip"), "text/plain;charset=utf-8");
  }

  /* Cetak lewat iframe tersembunyi dengan CSS khusus print; dari dialog
     cetak browser pengguna bisa memilih "Simpan sebagai PDF". */
  function nvCetak() {
    const mn = nv.data.minutes;
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
      ${draf ? `<div class="draf">DRAF — BELUM DITINJAU NOTULIS</div>` : ""}
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

  /* ---------- perekam ---------- */

  async function nvMuatMic(paksa = false) {
    const sel = document.getElementById("nvMic");
    if (!sel || (sel.options.length > 1 && !paksa)) return;
    try {
      let devices = await navigator.mediaDevices.enumerateDevices();
      // Label perangkat baru muncul setelah izin mikrofon diberikan.
      if (paksa && devices.filter((d) => d.kind === "audioinput").every((d) => !d.label)) {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());
        devices = await navigator.mediaDevices.enumerateDevices();
      }
      const pilih = sel.value;
      sel.innerHTML = `<option value="">Mikrofon bawaan</option>` + devices.filter((d) => d.kind === "audioinput" && d.deviceId !== "default")
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
    try { window.parent && window.parent !== window && window.parent.addEventListener("beforeunload", cegahKeluar); } catch { /* beda origin */ }
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
    if (b) b.textContent = r.paused ? "▶ Lanjut" : "❚❚ Jeda";
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

  /* Potongan dikirim satu per satu sesuai nomor urut. Gagal → dicoba lagi
     dengan jeda yang makin panjang; server mengabaikan potongan ganda. */
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
    } catch { /* file tetap bisa diproses walau belum ditutup */ }
    lepasPerekam(r);
    beritahu("Rekaman tersimpan di server.");
    await muatUlang();
  }

  function lepasPerekam(r) {
    clearInterval(r.timer);
    if (r.raf) cancelAnimationFrame(r.raf);
    try { r.audioCtx && r.audioCtx.close(); } catch { /* abaikan */ }
    try { r.wakeLock && r.wakeLock.release(); } catch { /* abaikan */ }
    document.removeEventListener("visibilitychange", r.onVisible);
    window.removeEventListener("beforeunload", cegahKeluar);
    try { window.parent && window.parent.removeEventListener("beforeunload", cegahKeluar); } catch { /* beda origin */ }
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
      s.innerHTML = r.stopped ? "Mengirim sisa rekaman…" : r.paused ? "Dijeda" : `<span class="nv-dot"></span> Merekam`;
    }
    const p = document.getElementById("nvPending");
    if (p) {
      const n = r.queue.length;
      p.innerHTML = r.errorTetap ? `<span class="nv-err-text">${e(r.errorTetap)}</span>`
        : n === 0 ? "Semua potongan terkirim"
          : `${n} potongan belum terkirim${r.gagalBeruntun ? ` (mencoba ulang: ${e(r.errorTerakhir || "")})` : ""}`;
    }
  }

  function hubungkanUlangPerekamUI() {
    const sel = document.getElementById("nvMic");
    if (sel) sel.disabled = true;
    perbaruiInfoRekam();
  }

  /* ---------- perekam otomatis ruang rapat (kelola perangkat) ---------- */

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
        <div class="nv-top"><button class="nv-back" onclick="nvTutupPerekam()">← Kembali ke notulen rapat</button></div>
        <div class="nv-head"><div>
          <div class="nv-crumb">Manajemen Rapat › Notulen Otomatis › Perekam ruangan</div>
          <h1>Perekam otomatis ruang rapat</h1>
          <div class="nv-meta">Setiap rapat yang sudah disetujui di ruangan yang punya perekam aktif akan direkam otomatis,
            lalu transkrip & notulennya diproses setelah rapat selesai (bergantian sesuai antrean).</div>
        </div></div>

        <section class="nv-card">
          <h2>Pasang perangkat baru</h2>
          <ol class="nv-list">
            <li>Di PC / mini PC ruang rapat yang tersambung mic (mis. Logitech), buka
              <code>${e(alamat)}</code> di Chrome atau Edge. Wajib <b>HTTPS</b> (atau localhost saat uji coba).</li>
            <li>Pilih ruangan lalu klik <b>Buat kode pemasangan</b>, kemudian ketik kodenya di halaman perekam
              (berlaku 30 menit, sekali pakai).</li>
            <li>Izinkan mikrofon, pilih mic Logitech, dan biarkan halaman perekam tetap terbuka.</li>
          </ol>
          <div class="nv-row nv-wrap">
            <select id="nvRecRoom" class="nv-input"><option value="">Memuat ruangan…</option></select>
            <input id="nvRecLabel" class="nv-input nv-grow" maxlength="150" placeholder="Nama perangkat (opsional), mis. PC Ruang Rapat Besar">
            <button class="nv-btn nv-btn-primary" onclick="nvBuatKode()">Buat kode pemasangan</button>
          </div>
          <div id="nvRecKode">${htmlKode()}</div>
        </section>

        <section class="nv-card">
          <h2>Perangkat terpasang <span class="nv-muted nv-small">(diperbarui tiap 10 detik)</span></h2>
          <div id="nvRecList">${htmlDaftarPerekam()}</div>
        </section>
      </div>`;
  }

  function htmlKode() {
    const k = rekamState.kode;
    if (!k) return "";
    return `<div class="nv-alert nv-alert-ok nv-kode-box">
      Kode pemasangan untuk <b>${e(k.ruang || "perangkat")}</b>:
      <div class="nv-kode">${e(k.kode.slice(0, 4))}-${e(k.kode.slice(4))}</div>
      Berlaku ${k.berlakuMenit} menit dan hanya bisa dipakai sekali. Kode tidak ditampilkan lagi setelah halaman ini ditutup.
    </div>`;
  }

  function htmlDaftarPerekam() {
    if (rekamState.error) return `<div class="nv-alert nv-alert-err">${e(rekamState.error)}</div>`;
    const d = rekamState.data;
    if (!d) return `<p class="nv-muted">Memuat…</p>`;
    const tanpa = d.rooms.filter((r) => !d.perangkat.some((p) => p.ruang === r && p.terpasang && p.online));
    const baris = d.perangkat.map((p) => {
      const st = p.status || {};
      let badge;
      if (!p.terpasang) {
        badge = p.kodeBerlakuSampai && new Date(p.kodeBerlakuSampai) > new Date()
          ? `<span class="nv-badge nv-b-grey">Menunggu kode dimasukkan (s/d ${waktuLokal(p.kodeBerlakuSampai).split(" ").pop()})</span>`
          : `<span class="nv-badge nv-b-red">Kode kedaluwarsa — buat kode baru</span>`;
      } else if (!p.online) {
        badge = `<span class="nv-badge nv-b-red">Offline</span>`;
      } else if (st.state === "merekam") {
        badge = `<span class="nv-badge nv-b-red">● Merekam</span>`;
      } else if (st.state === "mengirim") {
        badge = `<span class="nv-badge nv-b-blue">Mengirim rekaman${st.pending ? ` (${st.pending})` : ""}</span>`;
      } else if (st.state === "mic-error") {
        badge = `<span class="nv-badge nv-b-red">Mic bermasalah</span>`;
      } else {
        badge = `<span class="nv-badge nv-b-green">Siap</span>`;
      }
      return `<tr>
        <td><b>${e(p.ruang)}</b></td>
        <td>${e(p.label || "-")}<br><span class="nv-muted nv-small">dibuat ${e(p.dibuatOleh || "-")}</span></td>
        <td>${badge}${st.error ? `<div class="nv-small nv-err-text">${e(st.error)}</div>` : ""}</td>
        <td>${e(st.micLabel || "-")}</td>
        <td>${p.terakhirTerlihat ? waktuLokal(p.terakhirTerlihat) : "-"}</td>
        <td class="nv-nowrap">
          <button class="nv-btn nv-btn-light nv-btn-sm" onclick="nvKodeUlang('${e(p.id)}')">Kode baru</button>
          <button class="nv-btn nv-btn-ghost-red nv-btn-sm" onclick="nvCabutPerekam('${e(p.id)}')">Cabut</button>
        </td></tr>`;
    }).join("");
    return `
      ${d.perangkat.length ? `<table class="nv-table"><thead><tr><th>Ruangan</th><th>Perangkat</th><th>Status</th><th>Mic</th><th>Terakhir terhubung</th><th></th></tr></thead>
        <tbody>${baris}</tbody></table>` : `<p class="nv-muted">Belum ada perangkat perekam.</p>`}
      ${tanpa.length ? `<div class="nv-alert nv-alert-warn">Tidak ada perekam aktif di: <b>${tanpa.map(e).join(", ")}</b>.
        Rapat di ruangan tersebut tidak terekam otomatis; gunakan rekam/unggah manual di halaman notulen rapat.</div>` : ""}
      <p class="nv-muted nv-small">Rekaman diteruskan hingga ${d.menitTambahan} menit setelah jam selesai (rapat molor), kecuali
        sudah check-out atau rapat berikutnya di ruangan yang sama dimulai. Rapat yang belum disetujui, ditolak, atau dibatalkan tidak direkam.</p>`;
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

  /* Sesi server (cookie) berakhir sementara dashboard masih menyimpan profil di
     storage browser: bersihkan profil itu (kunci sama dengan logout() di app.js)
     lalu buka halaman login. */
  async function nvMasukUlang() {
    const kunci = ["isAuthenticated", "currentUser", "dashboard_isAuthenticated", "dashboard_currentUser",
      "booking_isAuthenticated", "booking_currentUser"];
    try { await fetch("/api/dashboard/logout", { method: "POST", credentials: "same-origin" }); } catch { /* abaikan */ }
    [window, window.parent, window.top].forEach((w) => {
      kunci.forEach((k) => {
        try { w?.sessionStorage?.removeItem(k); } catch { /* abaikan */ }
        try { w?.localStorage?.removeItem(k); } catch { /* abaikan */ }
      });
    });
    const tujuan = "/login?portal=dashboard&logout=true";
    try { window.top.location.href = tujuan; } catch { window.location.href = tujuan; }
  }

  /* ---------- ekspos global (dipanggil dari atribut onclick) ---------- */
  Object.assign(window, {
    openNotulen, closeNotulen, nvUnggah, nvPutar, nvHapusFile, nvProses, nvBatal, nvSimpanNama, nvBuatUlang,
    nvMasukUlang, nvBukaPerekam, nvTutupPerekam, nvBuatKode, nvKodeUlang, nvCabutPerekam,
    nvTab, nvPilihModel, nvInfo, nvEdit, nvBatalEdit, nvSimpanNotulen, nvUnduhMd, nvUnduhTranskrip, nvCetak, nvMuatMic,
    nvRekamMulai, nvRekamJeda, nvRekamSelesai,
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && nv.meetingId && !document.querySelector(".nv-dlg")
      && !document.getElementById("modal")?.classList.contains("show")) closeNotulen();
  });
})();
