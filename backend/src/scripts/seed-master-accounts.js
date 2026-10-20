#!/usr/bin/env node
/* Menanam akun master ke PostgreSQL.

   Tujuannya mengeluarkan kredensial dari kode. Sebelum ini password akun
   master punya nilai cadangan yang ditulis langsung di dashboard.service.js
   ("admin123" dan seterusnya), sehingga siapa pun yang bisa membaca repo
   tahu cara masuk — bahkan ketika akunnya tidak ada di database mana pun.

   Setelah akun tertanam di sini, database menjadi satu-satunya sumber
   kebenaran dan nilai cadangan di kode bisa dicabut.

   Pemakaian:
     node src/scripts/seed-master-accounts.js              # buat yang belum ada
     node src/scripts/seed-master-accounts.js --reset      # sekalian setel ulang password

   Tanpa --reset, akun yang sudah punya password TIDAK disentuh. Itu disengaja:
   menjalankan skrip ini dua kali tidak boleh diam-diam mengembalikan password
   seseorang ke nilai di .env setelah dia menggantinya sendiri.
*/

require("dotenv").config();

const { Pool } = require("pg");
const { hashPassword } = require("../services/dashboard.service");

const RESET = process.argv.includes("--reset");

/* Definisi dibaca dari .env, bukan ditulis di sini — supaya berkas ini pun
   tidak pernah memuat kredensial. Akun yang passwordnya kosong di .env
   sengaja dilewati, bukan diberi nilai bawaan. */
const MASTER = [
  {
    env: "ADMIN",
    id: "admin",
    role: "Admin",
    namaBawaan: "Admin Utama",
    emailBawaan: "admin@kemnaker.go.id",
  },
  {
    env: "APPROVAL1",
    id: "approval1",
    role: "Pimpinan",
    namaBawaan: "Pimpinan",
    emailBawaan: "pimpinan@kemnaker.go.id",
  },
  {
    env: "USER",
    id: "user",
    role: "User",
    namaBawaan: "User Pegawai",
    emailBawaan: "user@kemnaker.go.id",
  },
];

function bacaDefinisi(m) {
  const username = (process.env[`${m.env}_USERNAME`] || "").trim();
  const password = process.env[`${m.env}_PASSWORD`] || "";
  return {
    ...m,
    username,
    password,
    nama: process.env[`${m.env}_NAME`] || m.namaBawaan,
    email: process.env[`${m.env}_EMAIL`] || m.emailBawaan,
  };
}

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

  for (const m of MASTER.map(bacaDefinisi)) {
    if (!m.username || !m.password) {
      ringkasan.push([m.env, m.username || "(kosong)", "DILEWATI — username/password belum diisi di .env"]);
      continue;
    }

    const ada = await pool.query(
      "SELECT id, username, password_hash FROM users WHERE LOWER(username) = LOWER($1)",
      [m.username]
    );

    if (ada.rows.length === 0) {
      await pool.query(
        `INSERT INTO users (id, name, username, email, dept, role, status, password_hash, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'Biro Keuangan dan BMN', $5, 'Aktif', $6, NOW(), NOW())
         ON CONFLICT (username) DO NOTHING`,
        [m.id, m.nama, m.username, m.email, m.role, hashPassword(m.password)]
      );
      ringkasan.push([m.env, m.username, `DIBUAT sebagai ${m.role}`]);
      continue;
    }

    const baris = ada.rows[0];

    if (!baris.password_hash || RESET) {
      await pool.query("UPDATE users SET password_hash = $1, role = $2, status = 'Aktif', updated_at = NOW() WHERE id = $3", [
        hashPassword(m.password),
        m.role,
        baris.id,
      ]);
      ringkasan.push([m.env, m.username, baris.password_hash ? "PASSWORD DISETEL ULANG (--reset)" : "password diisi (sebelumnya kosong)"]);
    } else {
      ringkasan.push([m.env, m.username, "sudah ada — tidak disentuh (pakai --reset untuk menimpa)"]);
    }
  }

  console.log("\nHasil penanaman akun master:\n");
  ringkasan.forEach(([env, user, status]) => {
    console.log(`  ${env.padEnd(10)} ${String(user).padEnd(16)} ${status}`);
  });

  const semua = await pool.query(
    "SELECT username, role, status, (password_hash IS NOT NULL) AS ada_password FROM users ORDER BY role, username"
  );
  console.log("\nIsi tabel users sekarang:");
  console.table(semua.rows);

  await pool.end();
}

main().catch((err) => {
  console.error("Gagal menanam akun master:", err.message);
  process.exit(1);
});
