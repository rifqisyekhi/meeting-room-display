/* ===== NOTULEN -> PDF =====================================================

   Dipakai jalur WhatsApp: pegawai meminta notulen lewat bot-siska, bot
   mengirimkannya sebagai dokumen. Karena itu PDF-nya dibuat di sini, bukan di
   bot — datanya ada di sini, dan bot cukup mengambil berkas jadi.

   Kenapa pdfkit dan bukan render HTML lewat puppeteer: mesin ini 4 inti dan
   sudah menjalankan bot-siska, presensi, dan backend rapat. Menyalakan Chrome
   tiap kali ada permintaan notulen terlalu mahal untuk hasil yang sama.

   Markdown-nya TIDAK umum: bentuknya dikunci FINAL_FORMAT di
   ai-service/app/prompts.py — hanya "##", "###", daftar "-" dan "1.", satu
   tabel pipa, dan penebalan "**". Jadi penafsirnya sengaja sempit; menarik
   pustaka markdown penuh hanya untuk ini tidak sepadan.
*/
const PDFDocument = require("pdfkit");

const MARGIN = 50;
const WARNA_JUDUL = "#1e3a5f";
const WARNA_GARIS = "#cbd5e1";
const WARNA_REDUP = "#64748b";
const WARNA_KEPALA_TABEL = "#eef2f7";

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
  "Agustus", "September", "Oktober", "November", "Desember"];

function tanggalPanjang(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return String(iso || "-");
  const hari = HARI[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${hari}, ${d} ${BULAN[m - 1]} ${y}`;
}

/* Notulen dari ai-service menyertakan kepala sendiri ("# Notulen Rapat: ..."),
   sedangkan yang dikirim lewat rute bot dimulai langsung dari "## Ringkasan".
   Kepala di PDF selalu dibangun dari basis data, jadi kepala bawaan markdown
   dibuang supaya tidak tampil dua kali. */
function buangKepalaMarkdown(md) {
  const baris = String(md || "").split(/\r?\n/);
  const mulai = baris.findIndex((b) => /^##\s/.test(b));
  return mulai > 0 ? baris.slice(mulai).join("\n") : baris.join("\n");
}

/* Teks dengan penebalan "**...**". pdfkit tidak punya rich text, jadi
   potongannya digambar berurutan dengan `continued`. */
function tulisInline(doc, teks, opsi = {}) {
  const potongan = String(teks).split(/(\*\*[^*]+\*\*)/g).filter((p) => p !== "");
  if (!potongan.length) {
    doc.text("", opsi);
    return;
  }
  potongan.forEach((p, i) => {
    const tebal = p.startsWith("**") && p.endsWith("**");
    doc.font(tebal ? "Helvetica-Bold" : "Helvetica")
      .text(tebal ? p.slice(2, -2) : p, { ...opsi, continued: i < potongan.length - 1 });
  });
  doc.font("Helvetica");
}

function ruangTersisa(doc) {
  return doc.page.height - doc.page.margins.bottom - doc.y;
}

function pastikanMuat(doc, butuh) {
  if (ruangTersisa(doc) < butuh) doc.addPage();
}

function garis(doc) {
  doc.moveTo(MARGIN, doc.y).lineTo(doc.page.width - MARGIN, doc.y)
    .lineWidth(0.5).strokeColor(WARNA_GARIS).stroke();
  doc.moveDown(0.6);
}

function kepala(doc, meeting, baris) {
  doc.font("Helvetica-Bold").fontSize(17).fillColor(WARNA_JUDUL)
    .text(`Notulen Rapat: ${meeting.title || "Rapat"}`, { align: "left" });
  doc.moveDown(0.4);
  doc.font("Helvetica").fontSize(9.5).fillColor(WARNA_REDUP);

  const peserta = (Array.isArray(meeting.attendees) ? meeting.attendees : [])
    .map((a) => (typeof a === "string" ? a : a && a.name)).filter(Boolean);

  const isi = [
    ["Tanggal", `${tanggalPanjang(meeting.date)}${meeting.start ? `, ${meeting.start}–${meeting.end || ""} WIB` : ""}`],
    ["Tempat", [meeting.room || meeting.roomName, meeting.location].filter(Boolean).join(", ") || "-"],
    ["Peserta", peserta.length ? peserta.join(", ") : "-"],
    ["Klasifikasi", baris?.classification || "BIASA"],
    ["Disusun oleh", baris?.llmModel || "-"],
  ];
  isi.forEach(([k, v]) => {
    doc.font("Helvetica-Bold").text(`${k}: `, { continued: true })
      .font("Helvetica").text(String(v));
  });

  doc.moveDown(0.5);
  doc.fillColor("black");
  garis(doc);
}

function judulBagian(doc, teks) {
  pastikanMuat(doc, 60);
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").fontSize(12.5).fillColor(WARNA_JUDUL).text(teks);
  doc.fillColor("black").fontSize(10);
  doc.moveDown(0.25);
}

function subJudul(doc, teks) {
  pastikanMuat(doc, 46);
  doc.moveDown(0.3);
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor("#334155").text(teks);
  doc.fillColor("black").fontSize(10);
  doc.moveDown(0.15);
}

function butir(doc, teks, penanda) {
  /* pdfkit tidak menerima `x` sebagai opsi text(): posisi horizontal diambil
     dari doc.x. Karena itu penandanya digambar di margin, lalu doc.x digeser
     sebelum isinya ditulis — kalau tidak, baris sambungan kembali ke margin
     dan menumpuk penanda butir berikutnya. */
  const kiri = MARGIN + 16;
  const lebar = doc.page.width - MARGIN - kiri;
  pastikanMuat(doc, 24);
  const atas = doc.y;

  doc.font("Helvetica").fontSize(10).fillColor("black")
    .text(penanda, MARGIN + 2, atas, { width: 13, align: "left" });

  doc.y = atas;
  doc.x = kiri;
  tulisInline(doc, teks, { width: lebar, align: "left" });

  doc.x = MARGIN;
  doc.moveDown(0.15);
}

/* Tabel pipa. Lebar kolom dibagi menurut panjang isi terpanjang tiap kolom,
   dengan batas bawah supaya kolom "No" tidak ikut melebar. */
function tabel(doc, barisTabel) {
  const pisah = (b) => b.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((s) => s.trim());
  const isi = barisTabel.filter((b) => !/^\s*\|[\s:|-]+\|?\s*$/.test(b)).map(pisah);
  if (!isi.length) return;

  const jumlahKolom = Math.max(...isi.map((r) => r.length));
  const lebarTotal = doc.page.width - MARGIN * 2;
  const bobot = Array.from({ length: jumlahKolom }, (_, i) =>
    Math.max(4, ...isi.map((r) => (r[i] || "").length)));
  const jumlahBobot = bobot.reduce((a, b) => a + b, 0);
  const lebar = bobot.map((b) => Math.max(34, (b / jumlahBobot) * lebarTotal));
  const skala = lebarTotal / lebar.reduce((a, b) => a + b, 0);
  const lebarKolom = lebar.map((w) => w * skala);

  const tinggiBaris = (sel, tebal) => {
    doc.font(tebal ? "Helvetica-Bold" : "Helvetica").fontSize(9);
    return Math.max(...sel.map((t, i) =>
      doc.heightOfString(String(t || ""), { width: lebarKolom[i] - 10 }))) + 8;
  };

  isi.forEach((sel, idx) => {
    const tebal = idx === 0;
    const tinggi = tinggiBaris(sel, tebal);
    pastikanMuat(doc, tinggi + 4);
    const atas = doc.y;
    let x = MARGIN;

    if (tebal) {
      doc.rect(MARGIN, atas, lebarTotal, tinggi).fillColor(WARNA_KEPALA_TABEL).fill();
    }
    doc.fillColor("black").font(tebal ? "Helvetica-Bold" : "Helvetica").fontSize(9);
    sel.forEach((t, i) => {
      doc.text(String(t || ""), x + 5, atas + 4, { width: lebarKolom[i] - 10 });
      x += lebarKolom[i];
    });

    doc.rect(MARGIN, atas, lebarTotal, tinggi).lineWidth(0.5).strokeColor(WARNA_GARIS).stroke();
    doc.y = atas + tinggi;
    doc.x = MARGIN;
  });
  doc.fontSize(10).moveDown(0.4);
}

function isiMarkdown(doc, md) {
  const baris = buangKepalaMarkdown(md).split(/\r?\n/);
  let i = 0;
  while (i < baris.length) {
    const b = baris[i];

    if (/^#\s/.test(b)) { i += 1; continue; }
    if (/^###\s/.test(b)) { subJudul(doc, b.replace(/^###\s*/, "")); i += 1; continue; }
    if (/^##\s/.test(b)) { judulBagian(doc, b.replace(/^##\s*/, "")); i += 1; continue; }

    if (/^\s*\|/.test(b)) {
      const mulai = i;
      while (i < baris.length && /^\s*\|/.test(baris[i])) i += 1;
      tabel(doc, baris.slice(mulai, i));
      continue;
    }

    if (/^\s*[-*]\s+/.test(b)) { butir(doc, b.replace(/^\s*[-*]\s+/, ""), "•"); i += 1; continue; }

    const bernomor = b.match(/^\s*(\d+)\.\s+(.*)$/);
    if (bernomor) { butir(doc, bernomor[2], `${bernomor[1]}.`); i += 1; continue; }

    if (!b.trim()) { doc.moveDown(0.3); i += 1; continue; }

    pastikanMuat(doc, 26);
    tulisInline(doc, b, { width: doc.page.width - MARGIN * 2, align: "justify" });
    doc.moveDown(0.2);
    i += 1;
  }
}

/* Kembalikan PDF sebagai Buffer. Notulen paling panjang yang pernah dibuat
   sekitar 10 KB teks, jadi menahannya di memori jauh lebih sederhana daripada
   mengalirkannya, dan pemanggilnya bebas mengirimkannya ke mana pun. */
function buatPdfNotulen(meeting, baris) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      info: {
        Title: `Notulen Rapat - ${meeting.title || "Rapat"}`,
        Author: "Biro Keuangan dan BMN",
      },
    });

    const potongan = [];
    doc.on("data", (c) => potongan.push(c));
    doc.on("end", () => resolve(Buffer.concat(potongan)));
    doc.on("error", reject);

    try {
      kepala(doc, meeting, baris);
      doc.fontSize(10);
      isiMarkdown(doc, baris?.minutesMarkdown || "");

      // Catatan kaki: notulen ini hasil transkripsi otomatis, bukan risalah
      // resmi. Tanpa keterangan ini orang mudah memperlakukannya sebagai
      // dokumen final.
      doc.moveDown(0.8);
      garis(doc);
      doc.font("Helvetica-Oblique").fontSize(8).fillColor(WARNA_REDUP)
        .text("Notulen ini disusun otomatis dari rekaman rapat dan belum diperiksa manusia. "
          + "Periksa bagian Catatan dan Tindak Lanjut untuk hal yang perlu dikonfirmasi.",
        { width: doc.page.width - MARGIN * 2 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function namaBerkasPdf(meeting) {
  const bersih = String(meeting.title || "Rapat").replace(/[^\w\s-]/g, "").trim().slice(0, 60);
  return `Notulen - ${bersih || "Rapat"} - ${meeting.date || ""}.pdf`.replace(/\s+/g, " ");
}

module.exports = { buatPdfNotulen, namaBerkasPdf };
