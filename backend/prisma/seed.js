const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

async function main() {
  console.log("Memulai seeding database PostgreSQL...");

  // Cek apakah ada file data store lokal untuk diimpor
  const storePath = path.join(__dirname, "../data/dashboard-store.json");
  const examplePath = path.join(__dirname, "../data/dashboard-store.example.json");
  let data = null;

  if (fs.existsSync(storePath)) {
    try {
      data = JSON.parse(fs.readFileSync(storePath, "utf8"));
      console.log("Menggunakan data dari dashboard-store.json");
    } catch (e) {}
  }

  if (!data && fs.existsSync(examplePath)) {
    try {
      data = JSON.parse(fs.readFileSync(examplePath, "utf8"));
      console.log("Menggunakan data dari dashboard-store.example.json");
    } catch (e) {}
  }

  // 1. Seed Rooms
  const roomsToSeed = (data && data.rooms && data.rooms.length > 0) ? data.rooms : [
    {
      id: 1,
      name: "Ruang Rapat Besar",
      location: "Gedung Pusat Kemnaker, Lt. 3",
      capacity: 30,
      status: "Tersedia",
      category: "Ruang Besar",
      desc: "Ruang rapat representatif berkapasitas besar yang dilengkapi sistem multimedia modern, Smart TV 85 inch, proyektor, serta sound system berkualitas.",
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
    },
    {
      id: 2,
      name: "Ruang Konsultasi",
      location: "Gedung Pusat Kemnaker, Lt. 3",
      capacity: 12,
      status: "Tersedia",
      category: "Ruang Konsultasi",
      desc: "Ruang pertemuan privat dan kondusif untuk diskusi terfokus, konsultasi perbendaharaan, layanan BMN, serta koordinasi tim kerja.",
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
    },
  ];

  for (const r of roomsToSeed) {
    const roomId = typeof r.id === "number" ? r.id : parseInt(String(r.id).replace(/\D/g, "")) || 1;
    await prisma.room.upsert({
      where: { id: roomId },
      update: {
        name: r.name,
        location: r.location || "-",
        capacity: r.capacity || 10,
        status: r.status === "Tidak Tersedia" ? "Tidak_Tersedia" : "Tersedia",
        category: r.category || null,
        desc: r.desc || null,
        facilities: r.facilities || [],
        images: r.images || (r.img ? [r.img] : []),
      },
      create: {
        id: roomId,
        name: r.name,
        location: r.location || "-",
        capacity: r.capacity || 10,
        status: r.status === "Tidak Tersedia" ? "Tidak_Tersedia" : "Tersedia",
        category: r.category || null,
        desc: r.desc || null,
        facilities: r.facilities || [],
        images: r.images || (r.img ? [r.img] : []),
      },
    });
    console.log(`✓ Ruangan disinkronkan: ${r.name}`);
  }

  // 2. Seed Users
  const usersToSeed = (data && data.users && data.users.length > 0) ? data.users : [
    {
      id: "admin",
      name: "Admin Utama",
      username: "admin",
      email: "admin@kemnaker.go.id",
      dept: "Biro Keuangan dan BMN",
      role: "Admin",
      status: "Aktif",
    },
    {
      id: "approval1",
      name: "Pimpinan",
      username: "approval1",
      email: "pimpinan@kemnaker.go.id",
      dept: "Biro Keuangan dan BMN",
      role: "Pimpinan",
      status: "Aktif",
    },
    {
      id: "approval2",
      name: "Wakil Pimpinan",
      username: "approval2",
      email: "wakil.pimpinan@kemnaker.go.id",
      dept: "Biro Keuangan dan BMN",
      role: "Pimpinan",
      status: "Aktif",
    },
  ];

  for (const u of usersToSeed) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: {
        name: u.name,
        email: u.email || null,
        dept: u.dept || "Biro Keuangan dan BMN",
        role: u.role || "User",
        status: u.status === "Nonaktif" ? "Nonaktif" : "Aktif",
        passwordHash: u.passwordHash || null,
      },
      create: {
        id: String(u.id || u.username),
        name: u.name,
        username: u.username,
        email: u.email || null,
        dept: u.dept || "Biro Keuangan dan BMN",
        role: u.role || "User",
        status: u.status === "Nonaktif" ? "Nonaktif" : "Aktif",
        passwordHash: u.passwordHash || null,
      },
    });
    console.log(`✓ User disinkronkan: ${u.username} (${u.role})`);
  }

  console.log("Seeding database PostgreSQL selesai!");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

