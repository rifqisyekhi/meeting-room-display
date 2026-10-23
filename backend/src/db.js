const { Pool } = require("pg");
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

      // 2b. Definisi role sistem dan role kustom
      await client.query(`
        CREATE TABLE IF NOT EXISTS roles (
          name VARCHAR(80) PRIMARY KEY,
          description TEXT NOT NULL DEFAULT '',
          permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
          is_system BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // Pastikan role bawaan sistem terdaftar di database
      const defaultRoles = [
        ["Admin", "Akses penuh ke seluruh modul sistem", JSON.stringify(["approve", "manageMeeting", "checkInOut", "emergencyCancel", "manageRoom", "manageUsers", "manageSettings", "viewReports"])],
        ["Pimpinan", "Persetujuan permohonan rapat dan monitoring jadwal", JSON.stringify(["approve", "manageMeeting", "viewReports"])],
        ["User", "Pengguna standar peminjaman ruangan", JSON.stringify(["checkInOut"])],
      ];
      for (const [rName, rDesc, rPerm] of defaultRoles) {
        await client.query(`
          INSERT INTO roles (name, description, permissions, is_system)
          VALUES ($1, $2, $3::jsonb, TRUE)
          ON CONFLICT (name) DO UPDATE SET is_system = TRUE;
        `, [rName, rDesc, rPerm]);
      }
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

      // 6. Notulen otomatis: file audio per rapat (rekaman browser / unggahan)
      await client.query(`
        CREATE TABLE IF NOT EXISTS meeting_audio_files (
          id VARCHAR(100) PRIMARY KEY,
          meeting_id VARCHAR(100) NOT NULL,
          kind VARCHAR(20) NOT NULL DEFAULT 'unggahan',
          original_name VARCHAR(255),
          file_name VARCHAR(255) NOT NULL,
          mime_type VARCHAR(100),
          size_bytes BIGINT NOT NULL DEFAULT 0,
          chunk_count INT NOT NULL DEFAULT 0,
          status VARCHAR(20) NOT NULL DEFAULT 'siap',
          created_by VARCHAR(150),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_meeting_audio_meeting ON meeting_audio_files (meeting_id, created_at);
      `);

      // 7. Notulen otomatis: status pemrosesan, transkrip, dan notulen per rapat
      await client.query(`
        CREATE TABLE IF NOT EXISTS meeting_minutes (
          meeting_id VARCHAR(100) PRIMARY KEY,
          status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
          job_id VARCHAR(64),
          job_type VARCHAR(20),
          stage VARCHAR(40),
          stage_label VARCHAR(80),
          progress REAL NOT NULL DEFAULT 0,
          stage_progress REAL NOT NULL DEFAULT 0,
          eta_seconds REAL,
          queue_position INT,
          error TEXT,
          minutes_error TEXT,
          warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
          transcript JSONB,
          speakers JSONB NOT NULL DEFAULT '{}'::jsonb,
          duration_seconds REAL,
          minutes_md TEXT,
          minutes_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
          minutes_edited_by VARCHAR(150),
          minutes_edited_at TIMESTAMPTZ,
          whisper_model VARCHAR(100),
          llm_model VARCHAR(100),
          diarization BOOLEAN NOT NULL DEFAULT FALSE,
          started_by VARCHAR(150),
          started_at TIMESTAMPTZ,
          finished_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // 8. Perekam otomatis per ruangan (PC/mini PC dengan mic yang membuka halaman /perekam)
      await client.query(`
        CREATE TABLE IF NOT EXISTS room_recorders (
          id VARCHAR(100) PRIMARY KEY,
          room_name VARCHAR(150) NOT NULL,
          label VARCHAR(150),
          token_hash VARCHAR(128),
          pair_code_hash VARCHAR(128),
          pair_expires_at TIMESTAMPTZ,
          paired_at TIMESTAMPTZ,
          revoked_at TIMESTAMPTZ,
          last_seen_at TIMESTAMPTZ,
          last_status JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_by VARCHAR(150),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        ALTER TABLE meeting_audio_files ADD COLUMN IF NOT EXISTS recorder_id VARCHAR(100);
        ALTER TABLE meeting_minutes ADD COLUMN IF NOT EXISTS auto_processed_at TIMESTAMPTZ;
        ALTER TABLE meeting_minutes ADD COLUMN IF NOT EXISTS transcript_job_id VARCHAR(64);
      `);

      // Pastikan akun master awal tersedia jika tabel pengguna kosong
      const userCountRes = await client.query("SELECT COUNT(*)::int AS count FROM users");
      if (userCountRes.rows[0]?.count === 0) {
        const adminUser = process.env.ADMIN_USERNAME || "admin";
        const adminName = process.env.ADMIN_NAME || "Admin Utama";
        const approvalUser = process.env.APPROVAL_USERNAME || "approval";
        const approvalName = process.env.APPROVAL_NAME || "Pimpinan Approval";
        const normalUser = process.env.USER_USERNAME || "user";
        const normalName = process.env.USER_NAME || "User Pegawai";

        await client.query(`
          INSERT INTO users (id, name, username, email, dept, role, status) VALUES
            ('admin', $1, $2, 'admin@kemnaker.go.id', 'Biro Keuangan dan BMN', 'Admin', 'Aktif'),
            ('approval', $3, $4, 'approval@kemnaker.go.id', 'Biro Keuangan dan BMN', 'Pimpinan', 'Aktif'),
            ('user', $5, $6, 'user@kemnaker.go.id', 'Biro Keuangan dan BMN', 'User', 'Aktif')
          ON CONFLICT (username) DO NOTHING
        `, [adminName, adminUser, approvalName, approvalUser, normalName, normalUser]);
      } else {
        // Pastikan akun Admin Utama selalu ada
        const adminUser = process.env.ADMIN_USERNAME || "admin";
        const adminName = process.env.ADMIN_NAME || "Admin Utama";
        await client.query(`
          INSERT INTO users (id, name, username, email, dept, role, status)
          VALUES ('admin', $1, $2, 'admin@kemnaker.go.id', 'Biro Keuangan dan BMN', 'Admin', 'Aktif')
          ON CONFLICT (username) DO NOTHING
        `, [adminName, adminUser]);
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

