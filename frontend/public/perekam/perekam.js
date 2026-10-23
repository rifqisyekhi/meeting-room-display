/* ===== PEREKAM OTOMATIS RUANG RAPAT =====================================

   Dibuka terus-menerus di PC/mini PC ruang rapat yang tersambung mic
   (mis. Logitech). Setiap 15 detik melapor ke server; server menjawab apakah
   ada rapat yang sedang berjalan di ruangan ini. Jika ada → rekam, potongan
   ±30 detik dikirim berurutan (idempoten, dicoba ulang bila gagal). Saat rapat
   selesai → sisa potongan dikirim, file ditutup, lalu server memproses
   notulennya otomatis.

   Mic dibuka sekali dan dibiarkan terbuka (supaya tidak perlu izin berulang
   dan level suara bisa dipantau); satu file rekaman per rapat.
   ====================================================================== */

(function () {
  "use strict";

  const API = "/api/perekam";
  const KUNCI = "perekam_ruang_v1";
  const JEDA_DETAK_MS = 15000;
  const TIMESLICE_MS = 30000;
  const SUNYI_MS = 120000;

  const $ = (id) => document.getElementById(id);
  const s = {
    token: null, ruang: "", label: "",
    stream: null, micLabel: "", micError: "",
    audioCtx: null, analyser: null, lastLoudAt: Date.now(),
    rec: null, rapat: null, detakOk: null, detakError: "",
    wakeLock: null,
  };

  /* ---------- penyimpanan lokal ---------- */
  function muatSimpanan() {
    try { return JSON.parse(localStorage.getItem(KUNCI) || "{}"); } catch { return {}; }
  }
  function simpan(data) {
    try { localStorage.setItem(KUNCI, JSON.stringify({ ...muatSimpanan(), ...data })); } catch { /* abaikan */ }
  }

  async function api(path, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    if (s.token) headers["X-Perangkat-Token"] = s.token;
    const res = await fetch(API + path, { ...opts, headers });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok || data?.success === false) {
      const err = new Error(data?.error || `Permintaan gagal (kode ${res.status}).`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  /* ---------- pemasangan ---------- */
  function tampil(bagian) {
    $("pasang").classList.toggle("hidden", bagian !== "pasang");
    $("utama").classList.toggle("hidden", bagian !== "utama");
  }

  async function pasangPerangkat() {
    const kode = $("kode").value.trim();
    $("pasangErr").textContent = "";
    $("btnPasang").disabled = true;
    try {
      const r = await api("/pasang", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kode }) });
      s.token = r.token; s.ruang = r.ruang; s.label = r.label;
      simpan({ token: r.token, ruang: r.ruang, label: r.label });
      mulaiUtama();
    } catch (err) {
      $("pasangErr").textContent = err.message;
    } finally {
      $("btnPasang").disabled = false;
    }
  }

  function lepasPemasangan() {
    if (s.rec && !confirm("Rekaman sedang berjalan. Tetap lepas pemasangan? Rekaman berhenti.")) return;
    if (!s.rec && !confirm("Lepas pemasangan perangkat ini? Perlu kode baru dari Admin untuk memasang lagi.")) return;
    try { localStorage.removeItem(KUNCI); } catch { /* abaikan */ }
    location.reload();
  }

  /* ---------- mikrofon ---------- */
  async function bukaMic() {
    const simpanan = muatSimpanan();
    const deviceId = $("mic").value || simpanan.micId || "";
    const opsi = (id) => ({
      audio: {
        ...(id ? { deviceId: { exact: id } } : {}),
        channelCount: 1,
        // Mic konferensi (Logitech) sudah memproses suaranya sendiri.
        echoCancellation: false,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(opsi(deviceId));
    } catch (err) {
      if (deviceId && (err.name === "OverconstrainedError" || err.name === "NotFoundError")) {
        stream = await navigator.mediaDevices.getUserMedia(opsi("")); // mic tersimpan dicabut: pakai bawaan
      } else {
        throw err;
      }
    }
    tutupMic();
    s.stream = stream;
    const track = stream.getAudioTracks()[0];
    s.micLabel = track?.label || "Mikrofon";
    s.micError = "";
    track.onended = () => {
      s.micError = "Mikrofon terputus. Periksa kabel USB mic.";
      s.stream = null;
      if (s.rec && !s.rec.stopped) hentikanRekam();
      perbaruiUI();
    };
    simpan({ micId: track?.getSettings?.().deviceId || deviceId || "" });
    await isiDaftarMic();
    pasangMeter();
    perbaruiUI();
  }

  function tutupMic() {
    if (s.stream) s.stream.getTracks().forEach((t) => { t.onended = null; t.stop(); });
    s.stream = null;
  }

  async function isiDaftarMic() {
    const sel = $("mic");
    try {
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput" && d.deviceId !== "default");
      const aktif = s.stream?.getAudioTracks()[0]?.getSettings?.().deviceId || muatSimpanan().micId || "";
      sel.innerHTML = `<option value="">Mikrofon bawaan</option>` +
        devices.map((d, i) => `<option value="${d.deviceId}">${(d.label || `Mikrofon ${i + 1}`).replace(/</g, "&lt;")}</option>`).join("");
      sel.value = devices.some((d) => d.deviceId === aktif) ? aktif : "";
    } catch { /* abaikan */ }
  }

  function pesanMic(err) {
    if (!window.isSecureContext) return "Halaman harus dibuka lewat HTTPS agar mikrofon bisa dipakai.";
    if (err?.name === "NotAllowedError") return "Izin mikrofon ditolak. Izinkan mikrofon untuk situs ini di pengaturan browser.";
    if (err?.name === "NotFoundError") return "Mikrofon tidak ditemukan. Pastikan mic Logitech tersambung.";
    if (err?.name === "NotReadableError") return "Mikrofon sedang dikunci aplikasi lain atau bermasalah.";
    return `Gagal membuka mikrofon: ${err?.message || err}`;
  }

  async function cobaBukaMic() {
    if (s.stream) return true;
    try {
      await bukaMic();
      return true;
    } catch (err) {
      s.micError = pesanMic(err);
      perbaruiUI();
      return false;
    }
  }

  function pasangMeter() {
    try {
      if (!s.audioCtx) s.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (s.audioCtx.state === "suspended") s.audioCtx.resume().catch(() => {});
      const src = s.audioCtx.createMediaStreamSource(s.stream);
      s.analyser = s.audioCtx.createAnalyser();
      s.analyser.fftSize = 1024;
      src.connect(s.analyser);
    } catch { s.analyser = null; }
  }

  function loopMeter() {
    const buf = new Float32Array(1024);
    const tick = () => {
      if (s.analyser) {
        s.analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const level = Math.min(1, Math.sqrt(sum / buf.length) * 4);
        if (level > 0.03) s.lastLoudAt = Date.now();
        const el = $("level");
        el.style.width = `${Math.round(level * 100)}%`;
        el.style.background = level > 0.85 ? "#dc2626" : level > 0.5 ? "#f59e0b" : "#16a34a";
      }
      requestAnimationFrame(tick);
    };
    tick();
  }

  /* ---------- perekaman ---------- */
  function pilihMime() {
    return ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"]
      .find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || "";
  }

  async function mulaiRekam(rapat) {
    if (!(await cobaBukaMic())) return;
    const mimeType = pilihMime();
    let file;
    try {
      file = (await api("/rekaman", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: rapat.id, mimeType: mimeType || "audio/webm" }),
      })).file;
    } catch (err) {
      s.detakError = err.message;
      return;
    }
    const recorder = new MediaRecorder(s.stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32000 });
    const rec = { meetingId: rapat.id, judul: rapat.title, fileId: file.id, recorder, queue: [], nextSeq: 0, sending: false, stopped: false, gagal: 0 };
    s.rec = rec;
    s.lastLoudAt = Date.now();
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) { rec.queue.push({ seq: rec.nextSeq++, blob: ev.data }); kirim(rec); }
    };
    recorder.onstop = () => { rec.stopped = true; kirim(rec); };
    recorder.onerror = () => { if (!rec.stopped) hentikanRekam(); };
    recorder.start(TIMESLICE_MS);
    perbaruiUI();
  }

  function hentikanRekam() {
    const rec = s.rec;
    if (!rec || rec.recorder.state === "inactive") return;
    try { rec.recorder.stop(); } catch { rec.stopped = true; kirim(rec); }
  }

  async function kirim(rec) {
    if (rec.sending) return;
    rec.sending = true;
    try {
      while (rec.queue.length) {
        const c = rec.queue[0];
        try {
          const res = await fetch(`${API}/rekaman/${encodeURIComponent(rec.fileId)}/potongan/${c.seq}`, {
            method: "PUT", headers: { "Content-Type": "application/octet-stream", "X-Perangkat-Token": s.token }, body: c.blob,
          });
          let data = null;
          try { data = await res.json(); } catch { data = null; }
          if (res.ok || (res.status === 409 && data?.expectedSeq > c.seq)) {
            rec.queue.shift();
            rec.gagal = 0;
          } else if (res.status === 401 || res.status === 403 || res.status === 404) {
            s.detakError = data?.error || "Rekaman ditolak server.";
            rec.queue.length = 0; // tidak bisa dikirim lagi
            break;
          } else {
            throw new Error(data?.error || `kode ${res.status}`);
          }
        } catch (err) {
          rec.gagal++;
          s.detakError = `Gagal mengirim rekaman, mencoba lagi: ${err.message}`;
          perbaruiUI();
          await new Promise((ok) => setTimeout(ok, Math.min(30000, 2000 * rec.gagal)));
        }
        perbaruiUI();
      }
    } finally {
      rec.sending = false;
    }
    if (rec.stopped && !rec.queue.length) {
      try {
        await api(`/rekaman/${encodeURIComponent(rec.fileId)}/selesai`, { method: "POST" });
      } catch { /* file tetap diproses walau belum ditutup */ }
      if (s.rec === rec) s.rec = null;
      s.detakError = "";
      perbaruiUI();
      detak(); // langsung cek apakah ada rapat berikutnya
    }
  }

  /* ---------- detak ke server ---------- */
  let sedangDetak = false;
  async function detak() {
    if (sedangDetak || !s.token) return;
    sedangDetak = true;
    try {
      const sunyi = s.rec && Date.now() - s.lastLoudAt > SUNYI_MS;
      const state = s.micError ? "mic-error" : s.rec ? (s.rec.stopped ? "mengirim" : "merekam") : "menunggu";
      const r = await api("/detak", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state,
          micLabel: s.micLabel,
          error: s.micError || (sunyi ? "Tidak ada suara terdeteksi lebih dari 2 menit. Periksa mic." : s.detakError),
          meetingId: s.rec?.meetingId || null,
          fileId: s.rec?.fileId || null,
          pending: s.rec?.queue.length || 0,
          userAgent: navigator.userAgent,
        }),
      });
      s.detakOk = new Date();
      s.ruang = r.ruang; s.label = r.label;
      s.rapat = r.rapat;
      if (!s.rec?.stopped) s.detakError = "";
      if (r.rekam && r.rapat) {
        if (!s.rec) await mulaiRekam(r.rapat);
        else if (s.rec.meetingId !== r.rapat.id && !s.rec.stopped) hentikanRekam(); // pindah ke rapat berikutnya
      } else if (s.rec && !s.rec.stopped) {
        hentikanRekam();
      }
      if (!s.stream) cobaBukaMic();
    } catch (err) {
      if (err.status === 401 && err.data?.perluPasang) {
        s.token = null;
        try { localStorage.removeItem(KUNCI); } catch { /* abaikan */ }
        if (s.rec && !s.rec.stopped) hentikanRekam();
        tampil("pasang");
        $("pasangErr").textContent = err.message;
      } else {
        s.detakError = "Tidak dapat menghubungi server. Rekaman tetap berjalan dan dikirim setelah koneksi pulih.";
      }
    } finally {
      sedangDetak = false;
      perbaruiUI();
    }
  }

  /* ---------- tampilan ---------- */
  const jam = (iso) => (iso ? new Date(iso).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }) : "-");

  function perbaruiUI() {
    const st = $("state");
    let kelas = "state", judul, ket = "";
    if (s.micError) {
      kelas += " err"; judul = "Mikrofon bermasalah"; ket = s.micError;
    } else if (s.rec && !s.rec.stopped) {
      kelas += " rec"; judul = `<span class="dot"></span>SEDANG MEREKAM`;
      ket = `${s.rec.judul || "Rapat"}${s.rapat?.sampai ? ` · berhenti otomatis pukul ${jam(s.rapat.sampai)}` : ""}`;
      if (Date.now() - s.lastLoudAt > SUNYI_MS) ket += " · ⚠ tidak ada suara terdeteksi, periksa mic";
    } else if (s.rec) {
      kelas += " ok"; judul = "Mengirim sisa rekaman…"; ket = "Jangan tutup halaman ini.";
    } else {
      kelas += " ok"; judul = "Siap — menunggu rapat";
      ket = s.rapat ? "" : "Perekaman dimulai otomatis saat rapat di ruangan ini berjalan.";
    }
    if (s.detakError && !s.micError) ket += `${ket ? " · " : ""}${s.detakError}`;
    st.className = kelas;
    st.innerHTML = `<b>${judul}</b><span></span>`;
    st.querySelector("span").textContent = ket;
    $("iRuang").textContent = s.ruang || "-";
    $("iLabel").textContent = `${s.label || "-"}${s.micLabel ? ` · mic: ${s.micLabel}` : ""}`;
    $("iRapat").textContent = s.rapat ? `${s.rapat.title} (${s.rapat.start}–${s.rapat.end} WIB)` : "Tidak ada rapat berjalan";
    $("iPending").textContent = String(s.rec?.queue.length || 0);
    $("iDetak").textContent = s.detakOk ? `terakhir ${s.detakOk.toLocaleTimeString("id-ID")}` : "belum";
    $("sub").textContent = s.ruang ? `${s.ruang} · notulen otomatis, diproses di server instansi` : $("sub").textContent;
  }

  async function pasangWakeLock() {
    if (!("wakeLock" in navigator)) return;
    try { s.wakeLock = await navigator.wakeLock.request("screen"); } catch { /* ditolak browser */ }
  }

  function mulaiUtama() {
    tampil("utama");
    perbaruiUI();
    cobaBukaMic();
    pasangWakeLock();
    detak();
  }

  /* ---------- awal ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      tampil("utama");
      $("state").className = "state err";
      $("state").innerHTML = "<b>Browser tidak mendukung perekaman</b><span>Buka halaman ini lewat HTTPS di Chrome/Edge terbaru.</span>";
      return;
    }
    $("btnPasang").onclick = pasangPerangkat;
    $("kode").addEventListener("keydown", (e) => { if (e.key === "Enter") pasangPerangkat(); });
    $("btnLepas").onclick = lepasPemasangan;
    $("btnMic").onclick = async () => {
      if (s.audioCtx?.state === "suspended") s.audioCtx.resume().catch(() => {});
      if (s.rec && !s.rec.stopped) { alert("Ganti mic setelah rapat selesai direkam."); return; }
      tutupMic();
      await cobaBukaMic();
    };
    $("mic").onchange = async () => {
      if (s.rec && !s.rec.stopped) { alert("Ganti mic setelah rapat selesai direkam."); await isiDaftarMic(); return; }
      simpan({ micId: $("mic").value });
      tutupMic();
      await cobaBukaMic();
    };
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") pasangWakeLock(); });
    // Browser kadang menahan AudioContext sampai ada interaksi; klik di mana pun menghidupkannya.
    document.addEventListener("click", () => s.audioCtx?.state === "suspended" && s.audioCtx.resume().catch(() => {}));
    window.addEventListener("beforeunload", (ev) => {
      if (s.rec) { ev.preventDefault(); ev.returnValue = "Rekaman rapat sedang berjalan."; }
    });

    loopMeter();
    const simpanan = muatSimpanan();
    if (simpanan.token) {
      s.token = simpanan.token; s.ruang = simpanan.ruang || ""; s.label = simpanan.label || "";
      mulaiUtama();
    } else {
      tampil("pasang");
    }
    setInterval(detak, JEDA_DETAK_MS);
    setInterval(perbaruiUI, 5000);
  });
})();
