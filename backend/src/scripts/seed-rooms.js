#!/usr/bin/env node
/* Menanam data ruangan rapat ke PostgreSQL.

   Tabel `rooms` dibuat kosong oleh db.js dan satu-satunya yang pernah
   mengisinya adalah saveRoom() — yaitu ketika admin menambah ruangan lewat
   dashboard. Di server yang databasenya masih baru, tabel itu tetap kosong,
   sehingga GET /api/dashboard/data mengembalikan rooms: [] dan halaman
   "Manajemen Ruangan" di dashboard admin tampak tidak punya ruangan sama
   sekali — padahal halaman booking pengguna tetap menampilkan dua ruangan
   karena di sana daftarnya masih ditulis langsung di dalam kode.

   Skrip ini menjadikan database sebagai sumber kebenaran untuk kedua sisi.

   Pemakaian:
     node src/scripts/seed-rooms.js            # tambah ruangan yang belum ada
     node src/scripts/seed-rooms.js --reset    # timpa juga ruangan yang sudah ada

   Tanpa --reset, ruangan yang namanya sudah terdaftar TIDAK disentuh, supaya
   menjalankan skrip ini dua kali tidak membatalkan penyuntingan admin
   (kapasitas, fasilitas, status perbaikan) yang sudah dilakukan via dashboard.
*/

require("dotenv").config();

const { Pool } = require("pg");

const RESET = process.argv.includes("--reset");

const GAMBAR = (nama) => `/dashboard-app/assets/${nama}`;

/* Nilainya disamakan dengan daftar bawaan di frontend (BookingPage.jsx dan
   dashboard-app/js/app.js) supaya tampilan tidak berubah saat sumber datanya
   berpindah dari kode ke database. */
const RUANGAN = [
  {
    name: "Ruang Rapat Besar",
    location: "Gedung A - Lantai 3",
    capacity: 20,
    status: "Tersedia",
    category: "Ruang Besar",
    description:
      "Ruang rapat representatif berkapasitas besar yang dilengkapi sistem multimedia modern, Smart TV 85 inch, proyektor, serta sound system berkualitas. Cocok untuk rapat koordinasi skala besar, pemaparan program, dan evaluasi lintas bagian.",
    facilities: [
      { label: "Kapasitas", value: "46", status: "Tersedia" },
      { label: "TV", value: "Smart TV 85 inch", status: "Tersedia" },
      { label: "AC", value: "Tersedia", status: "Tersedia" },
      { label: "Microphone", value: "Tersedia 6 mic", status: "Tersedia" },
      { label: "Speaker", value: "Tersedia", status: "Tersedia" },
      { label: "Dispenser", value: "Tersedia", status: "Tersedia" },
      { label: "Stopkontak", value: "Tersedia", status: "Tersedia" },
      { label: "Kabel", value: "HDMI", status: "Tersedia" },
    ],
    images: [GAMBAR("Ruang Rapat Besar.jpeg")],
  },
  {
    name: "Ruang Konsultasi",
    location: "Gedung A - Lantai 3",
    capacity: 20,
    status: "Tersedia",
    category: "Ruang Konsultasi",
    description:
      "Ruang pertemuan privat dan kondusif untuk diskusi terfokus, konsultasi perbendaharaan, layanan BMN, serta koordinasi tim kerja dengan fasilitas Smart TV 60 inch dan whiteboard.",
    facilities: [
      { label: "Kapasitas", value: "7", status: "Tersedia" },
      { label: "TV", value: "Smart TV 60 inch", status: "Tersedia" },
      { label: "AC", value: "Tersedia", status: "Tersedia" },
      { label: "Microphone", value: "Tidak Tersedia", status: "Tidak Tersedia" },
      { label: "Speaker", value: "Tidak Tersedia", status: "Tidak Tersedia" },
      { label: "Dispenser", value: "Tidak Tersedia", status: "Tidak Tersedia" },
      { label: "Stopkontak", value: "Tersedia", status: "Tersedia" },
      { label: "Kabel", value: "HDMI", status: "Tersedia" },
    ],
    images: [GAMBAR("Ruang Konsultasi.jpeg")],
  },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL belum diisi di backend/.env. Tidak ada yang bisa ditanam.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 8000 });

  try {
    await pool.query("SELECT 1");
  } catch (err) {
    console.error("Tidak bisa terhubung ke PostgreSQL:", err.message);
    process.exit(1);
  }

  const ringkasan = [];

  for (const r of RUANGAN) {
    const ada = await pool.query("SELECT id FROM rooms WHERE LOWER(name) = LOWER($1)", [r.name]);

    if (ada.rows.length > 0 && !RESET) {
      ringkasan.push([r.name, "sudah ada — tidak disentuh (pakai --reset untuk menimpa)"]);
      continue;
    }

    await pool.query(
      `INSERT INTO rooms (name, location, capacity, status, category, description, facilities, images, img, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (name) DO UPDATE SET
         location    = EXCLUDED.location,
         capacity    = EXCLUDED.capacity,
         status      = EXCLUDED.status,
         category    = EXCLUDED.category,
         description = EXCLUDED.description,
         facilities  = EXCLUDED.facilities,
         images      = EXCLUDED.images,
         img         = EXCLUDED.img,
         updated_at  = NOW()`,
      [
        r.name,
        r.location,
        r.capacity,
        r.status,
        r.category,
        r.description,
        JSON.stringify(r.facilities),
        JSON.stringify(r.images),
        r.images[0],
      ]
    );

    ringkasan.push([r.name, ada.rows.length > 0 ? "DITIMPA (--reset)" : "DIBUAT"]);
  }

  console.log("\nHasil penanaman ruangan:\n");
  ringkasan.forEach(([nama, status]) => {
    console.log(`  ${String(nama).padEnd(22)} ${status}`);
  });

  const semua = await pool.query(
    "SELECT id, name, location, capacity, status, category FROM rooms ORDER BY id ASC"
  );
  console.log("\nIsi tabel rooms sekarang:");
  console.table(semua.rows);

  if (semua.rows.length === 0) {
    console.warn("\nTabel rooms masih kosong. Dashboard admin akan tetap tampak tanpa ruangan.");
  }

  await pool.end();
}

main().catch((err) => {
  console.error("Gagal menanam ruangan:", err.message);
  process.exit(1);
});
