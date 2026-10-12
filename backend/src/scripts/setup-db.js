require("dotenv").config();
const { Client } = require("pg");
const { initDatabase, query } = require("../db");

async function setup() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ Error: Variabel DATABASE_URL belum disetel di backend/.env");
    console.log("Contoh format di backend/.env:");
    console.log('DATABASE_URL="postgresql://postgres:password_kamu@localhost:5432/meeting_room_display?schema=public"');
    process.exit(1);
  }

  console.log("==================================================");
  console.log("🔧 SETUP BASIS DATA POSTGRESQL - RUANG RAPAT");
  console.log("==================================================");

  // Parse connection URL
  let parsedUrl;
  try {
    parsedUrl = new URL(dbUrl);
  } catch (e) {
    console.error("❌ Format DATABASE_URL tidak valid:", e.message);
    process.exit(1);
  }

  const targetDbName = parsedUrl.pathname.replace(/^\//, "").split("?")[0] || "meeting_room_display";
  const user = parsedUrl.username || "postgres";
  const password = decodeURIComponent(parsedUrl.password || "");
  const host = parsedUrl.hostname || "localhost";
  const port = parseInt(parsedUrl.port || "5432", 10);

  // Step 1: Connect to default postgres DB to create database if not exists
  console.log(`\n1. Memeriksa keberadaan database '${targetDbName}' di ${host}:${port}...`);
  const adminClient = new Client({
    user,
    password,
    host,
    port,
    database: "postgres",
  });

  try {
    await adminClient.connect();
    const checkDbRes = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [targetDbName]
    );

    if (checkDbRes.rows.length === 0) {
      console.log(`   Database '${targetDbName}' belum ada. Membuat database baru...`);
      await adminClient.query(`CREATE DATABASE "${targetDbName}"`);
      console.log(`   ✓ Berhasil membuat database '${targetDbName}'.`);
    } else {
      console.log(`   ✓ Database '${targetDbName}' sudah ada.`);
    }
  } catch (err) {
    console.error(`\n❌ Gagal terhubung ke PostgreSQL:`);
    console.error(`   Pesan error: ${err.message}`);
    console.error(`\n💡 Tips:`);
    console.error(`   - Pastikan password user '${user}' di backend/.env sudah sesuai.`);
    console.error(`   - Pastikan service PostgreSQL aktif (default port 5432).`);
    process.exit(1);
  } finally {
    await adminClient.end();
  }

  // Step 2: Initialize tables and seed
  console.log(`\n2. Menyiapkan skema tabel dan data awal di '${targetDbName}'...`);
  const success = await initDatabase();
  if (success) {
    try {
      const roomRes = await query("SELECT COUNT(*) FROM rooms");
      const userRes = await query("SELECT COUNT(*) FROM users");
      const meetingRes = await query("SELECT COUNT(*) FROM meetings");

      console.log("\n==================================================");
      console.log("✅ SETUP POSTGRESQL BERHASIL!");
      console.log("==================================================");
      console.log(`📊 Ringkasan Data:`);
      console.log(`   • Ruangan Terdaftar : ${roomRes.rows[0].count}`);
      console.log(`   • Pengguna & Akun   : ${userRes.rows[0].count}`);
      console.log(`   • Jadwal Pertemuan  : ${meetingRes.rows[0].count}`);
      console.log("\nAplikasi Anda sekarang sudah siap berjalan menggunakan PostgreSQL!");
    } catch (e) {
      console.log("✓ Tabel berhasil dibuat.");
    }
  } else {
    console.error("❌ Gagal membuat tabel.");
  }
}

setup();

