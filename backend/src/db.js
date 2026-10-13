const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

let pool = null;
let isConnected = false;

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on("error", (err) => {
      console.warn("[PostgreSQL] Pool error:", err.message);
      isConnected = false;
    });
  }
  return pool;
}

async function query(text, params) {
  const p = getPool();
  if (!p) throw new Error("Database pool belum terinisialisasi.");
  return p.query(text, params);
}

async function initDatabase() {
  const p = getPool();
  if (!p) {
    console.warn("[PostgreSQL] DATABASE_URL belum diatur di .env. Menggunakan file JSON.");
    return false;
  }

  try {
    const client = await p.connect();
    try {
      console.log("[PostgreSQL] Terhubung ke database server. Menyiapkan tabel...");

      // 1. Tabel Ruangan
      await client.query(`
        CREATE TABLE IF NOT EXISTS rooms (
          id SERIAL PRIMARY KEY,
          name VARCHAR(150) UNIQUE NOT NULL,
          location VARCHAR(200) NOT NULL,
          capacity INT NOT NULL DEFAULT 10,
          status VARCHAR(50) NOT NULL DEFAULT 'Tersedia',
          category VARCHAR(100),
          description TEXT,
          img TEXT,
          images JSONB DEFAULT '[]'::jsonb,
          facilities JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // 2. Tabel Users
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(100) PRIMARY KEY,
          name VARCHAR(150) NOT NULL,
          username VARCHAR(100) UNIQUE NOT NULL,
          email VARCHAR(150),
          dept VARCHAR(150) NOT NULL,
          role VARCHAR(50) NOT NULL DEFAULT 'User',
          status VARCHAR(50) NOT NULL DEFAULT 'Aktif',
          password_hash TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // 3. Tabel Meetings
      await client.query(`
        CREATE TABLE IF NOT EXISTS meetings (
          id VARCHAR(100) PRIMARY KEY,
          google_id VARCHAR(150),
          title VARCHAR(255) NOT NULL,
          agenda TEXT,
          description TEXT,
          requester VARCHAR(150) NOT NULL,
          booked_by_id VARCHAR(100),
          booked_by_name VARCHAR(150),
          booked_by_username VARCHAR(100),
          room_id INT,
          room_name VARCHAR(150),
          date VARCHAR(20) NOT NULL,
          start_time VARCHAR(10) NOT NULL,
          end_time VARCHAR(10) NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'Menunggu Approval',
          participants INT NOT NULL DEFAULT 0,
          approved_by VARCHAR(150),
          rejection_reason TEXT,
          checked_in_at TIMESTAMPTZ,
          checked_in_by VARCHAR(150),
          check_in_method VARCHAR(50),
          check_in_method_label VARCHAR(100),
          checked_out_at TIMESTAMPTZ,
          checked_out_by VARCHAR(150),
          check_out_method VARCHAR(50),
          check_out_method_label VARCHAR(100),
          attendees JSONB DEFAULT '[]'::jsonb,
          materials JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Migrasi kolom tambahan otomatis jika tabel meetings sudah ada sebelumnya
        ALTER TABLE meetings ADD COLUMN IF NOT EXISTS checked_in_by VARCHAR(150);
        ALTER TABLE meetings ADD COLUMN IF NOT EXISTS check_in_method VARCHAR(50);
        ALTER TABLE meetings ADD COLUMN IF NOT EXISTS check_in_method_label VARCHAR(100);
        ALTER TABLE meetings ADD COLUMN IF NOT EXISTS checked_out_by VARCHAR(150);
        ALTER TABLE meetings ADD COLUMN IF NOT EXISTS check_out_method VARCHAR(50);
        ALTER TABLE meetings ADD COLUMN IF NOT EXISTS check_out_method_label VARCHAR(100);
      `);

      // Index untuk optimasi pencarian jadwal dan bentrok
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_meetings_room_date ON meetings (room_name, date);
        CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings (status);
      `);

      // 4. Tabel Reviews
      await client.query(`
        CREATE TABLE IF NOT EXISTS reviews (
          id VARCHAR(100) PRIMARY KEY,
          meeting_id VARCHAR(100),
          room_name VARCHAR(150),
          user_name VARCHAR(150),
          rating INT NOT NULL DEFAULT 5,
          comment TEXT,
          admin_reply TEXT,
          reply_date TIMESTAMPTZ,
          reply_by VARCHAR(150),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // 5. Tabel Notifications
      await client.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id VARCHAR(100) PRIMARY KEY,
          meeting_id VARCHAR(100),
          type VARCHAR(50),
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          status VARCHAR(50) DEFAULT 'UNREAD',
          read_by JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // Cek apakah data awal perlu disinkronkan (Auto-seed)
      const roomCountRes = await client.query(`SELECT COUNT(*) FROM rooms`);
      const roomCount = parseInt(roomCountRes.rows[0].count, 10);

      if (roomCount === 0) {
        console.log("[PostgreSQL] Tabel rooms kosong. Melakukan auto-seeding dari file data...");
        const storePath = path.join(__dirname, "../data/dashboard-store.json");
        const examplePath = path.join(__dirname, "../data/dashboard-store.example.json");
        let seedData = null;
        if (fs.existsSync(storePath)) {
          try { seedData = JSON.parse(fs.readFileSync(storePath, "utf8")); } catch (e) {}
        }
        if (!seedData && fs.existsSync(examplePath)) {
          try { seedData = JSON.parse(fs.readFileSync(examplePath, "utf8")); } catch (e) {}
        }

        if (seedData) {
          // Seed Rooms
          if (Array.isArray(seedData.rooms)) {
            for (const r of seedData.rooms) {
              await client.query(`
                INSERT INTO rooms (name, location, capacity, status, category, description, facilities, images)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (name) DO NOTHING;
              `, [
                r.name,
                r.location || "-",
                r.capacity || 10,
                r.status || "Tersedia",
                r.category || null,
                r.desc || null,
                JSON.stringify(r.facilities || []),
                JSON.stringify(r.images || (r.img ? [r.img] : []))
              ]);
            }
          }

          // Seed Users
          if (Array.isArray(seedData.users)) {
            for (const u of seedData.users) {
              await client.query(`
                INSERT INTO users (id, name, username, email, dept, role, status, password_hash)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (username) DO NOTHING;
              `, [
                String(u.id || u.username),
                u.name,
                u.username,
                u.email || null,
                u.dept || "Biro Keuangan dan BMN",
                u.role || "User",
                u.status || "Aktif",
                u.passwordHash || null
              ]);
            }
          }

          // Seed Meetings jika ada
          if (Array.isArray(seedData.meetings) && seedData.meetings.length > 0) {
            for (const m of seedData.meetings) {
              await client.query(`
                INSERT INTO meetings (
                  id, google_id, title, agenda, requester, booked_by_name, booked_by_username,
                  room_name, date, start_time, end_time, status, participants, approved_by,
                  attendees, materials, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                ON CONFLICT (id) DO NOTHING;
              `, [
                String(m.id),
                m.googleId || null,
                m.title || m.agenda || "Rapat",
                m.agenda || m.desc || "",
                m.requester || "Umum",
                m.bookedBy || m.bookedByName || "",
                m.bookedByUsername || "",
                m.room || m.roomName || "",
                m.date,
                m.start,
                m.end,
                m.status || "Akan Datang",
                m.participants || 0,
                m.approvedBy || null,
                JSON.stringify(m.attendees || []),
                JSON.stringify(m.materials || []),
                m.createdAt ? new Date(m.createdAt) : new Date()
              ]);
            }
          }
        }
      }

      // Pastikan akun-akun default selalu terdaftar di database
      const defaultAppUsers = [
        { id: "admin", name: "Admin Utama", username: process.env.ADMIN_USERNAME || "admin", email: "admin@kemnaker.go.id", dept: "Biro Keuangan dan BMN", role: "Admin", status: "Aktif" },
        { id: "approval1", name: "Pimpinan", username: process.env.APPROVAL1_USERNAME || "approval1", email: "pimpinan@kemnaker.go.id", dept: "Biro Keuangan dan BMN", role: "Pimpinan", status: "Aktif" },
        { id: "approval2", name: "Wakil Pimpinan", username: process.env.APPROVAL2_USERNAME || "approval2", email: "wakil.pimpinan@kemnaker.go.id", dept: "Biro Keuangan dan BMN", role: "Pimpinan", status: "Aktif" },
        { id: "andipratama", name: "Andi Pratama", username: process.env.USER_USERNAME || "andipratama", email: "andi@kemnaker.go.id", dept: "Biro Keuangan dan BMN", role: "User", status: "Aktif" },
      ];
      for (const u of defaultAppUsers) {
        await client.query(`
          INSERT INTO users (id, name, username, email, dept, role, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (username) DO NOTHING;
        `, [
          u.id, u.name, u.username, u.email, u.dept, u.role, u.status
        ]);
      }

      console.log("[PostgreSQL] Skema tabel siap dan sinkron.");
      isConnected = true;
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn(`[PostgreSQL] Tidak dapat menghubungkan database: ${err.message}`);
    console.warn("[PostgreSQL] Berjalan dalam mode fallback (File JSON).");
    isConnected = false;
    return false;
  }
}

module.exports = {
  getPool,
  query,
  initDatabase,
  getIsConnected: () => isConnected,
};

