#!/usr/bin/env node
/* Memasang batasan anti-bentrok di tingkat PostgreSQL.

   Pemeriksaan di saveMeeting sudah menutup hampir semua kasus: panggilan
   API langsung, persetujuan yang bentrok, pemesanan susulan. Yang tersisa
   adalah celah sempit di antara "baca jadwal" dan "tulis" — dua permintaan
   yang tiba benar-benar bersamaan bisa sama-sama lolos pembacaan sebelum
   salah satunya sempat menyimpan.

   Celah seperti itu tidak bisa ditutup di kode aplikasi; yang bisa
   menjamin hanyalah database, karena hanya dia yang tahu urutan sebenarnya.

   EXCLUDE ... USING gist dipakai, bukan UNIQUE, karena yang dilarang adalah
   IRISAN jam — bukan jam mulai yang sama persis. UNIQUE (ruang, tanggal,
   jam_mulai) akan meloloskan 09:00-11:00 bertabrakan dengan 10:00-12:00.

   Predikat WHERE membuat batasan ini hanya berlaku bagi rapat AKTIF, jadi
   dua permohonan yang sama-sama menunggu approval tetap boleh mengantre —
   sama dengan kebijakan yang berlaku di aplikasi.

   Aman dijalankan berulang kali.
*/

require("dotenv").config();
const { Pool } = require("pg");

const NAMA = "meetings_tanpa_bentrok";

/* Jam disimpan sebagai teks "HH:MM", jadi diubah ke menit lalu dibandingkan
   sebagai rentang bilangan. Semua fungsi yang dipakai bersifat IMMUTABLE —
   syarat wajib agar bisa dipakai di dalam indeks. */
const MENIT = (kolom) =>
  `(split_part(${kolom}, ':', 1)::int * 60 + split_part(${kolom}, ':', 2)::int)`;

const SQL_TAMBAH = `
ALTER TABLE meetings ADD CONSTRAINT ${NAMA}
EXCLUDE USING gist (
  lower(regexp_replace(room_name, '\s+', '', 'g')) WITH =,
  date WITH =,
  int4range(${MENIT("start_time")}, ${MENIT("end_time")}) WITH &&
)
WHERE (
  lower(btrim(status)) NOT IN
    ('menunggu approval', 'pending', 'dibatalkan', 'ditolak', 'cancelled')
)`;

const SQL_BENTROK_LAMA = `
SELECT a.id AS id_a, b.id AS id_b, a.room_name, a.date,
       a.start_time AS mulai_a, a.end_time AS selesai_a,
       b.start_time AS mulai_b, b.end_time AS selesai_b
  FROM meetings a
  JOIN meetings b
    ON a.id < b.id
   AND lower(regexp_replace(a.room_name, '\s+', '', 'g'))
     = lower(regexp_replace(b.room_name, '\s+', '', 'g'))
   AND a.date = b.date
 WHERE lower(btrim(a.status)) NOT IN ('menunggu approval','pending','dibatalkan','ditolak','cancelled')
   AND lower(btrim(b.status)) NOT IN ('menunggu approval','pending','dibatalkan','ditolak','cancelled')
   AND ${MENIT("a.start_time")} < ${MENIT("b.end_time")}
   AND ${MENIT("a.end_time")}   > ${MENIT("b.start_time")}`;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL belum diisi di backend/.env.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 8000 });

  try {
    const sudah = await pool.query(
      "SELECT 1 FROM pg_constraint WHERE conname = $1 AND conrelid = 'meetings'::regclass",
      [NAMA]
    );
    if (sudah.rows.length) {
      console.log(`Batasan "${NAMA}" sudah terpasang. Tidak ada yang diubah.`);
      return;
    }

    /* Data yang sudah terlanjur bentrok akan membuat pemasangan gagal dengan
       pesan Postgres yang sulit dibaca. Lebih baik diperiksa lebih dulu dan
       ditunjukkan barisnya, supaya bisa dibereskan manual. */
    const bentrok = await pool.query(SQL_BENTROK_LAMA);
    if (bentrok.rows.length) {
      console.error(`\nAda ${bentrok.rows.length} pasang rapat aktif yang jamnya sudah bertabrakan.`);
      console.error("Batasan tidak dipasang. Bereskan dulu baris berikut:\n");
      bentrok.rows.forEach((r) => {
        console.error(`  ${r.room_name} ${r.date}`);
        console.error(`    ${r.id_a}  ${r.mulai_a}-${r.selesai_a}`);
        console.error(`    ${r.id_b}  ${r.mulai_b}-${r.selesai_b}\n`);
      });
      process.exit(1);
    }

    await pool.query("CREATE EXTENSION IF NOT EXISTS btree_gist");
    await pool.query(SQL_TAMBAH);
    console.log(`Batasan "${NAMA}" berhasil dipasang.`);
    console.log("Dua rapat aktif tidak lagi bisa menempati ruangan dan jam yang beririsan,");
    console.log("bahkan bila permintaannya tiba pada saat yang sama persis.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Gagal memasang batasan:", err.message);
  process.exit(1);
});
