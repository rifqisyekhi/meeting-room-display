const crypto = require("crypto");

/* ===== SESI BERBASIS COOKIE BERTANDA TANGAN =============================

   Kenapa cookie, bukan header Authorization: frontend memanggil API dari 23
   tempat yang tersebar (campuran axios dan fetch). Menyisipkan header di
   semua titik itu berarti satu saja yang terlewat akan gagal diam-diam.
   Cookie dikirim browser secara otomatis pada permintaan same-origin —
   dan di produksi nginx menyatukan frontend dan /api di satu origin — jadi
   tidak ada satu pun pemanggilan yang perlu diubah.

   Kenapa ditulis tangan, bukan express-session atau jsonwebtoken: deploy
   ini sudah membawa PostgreSQL dan beberapa dependensi baru sekaligus.
   Token bertanda tangan HMAC cukup untuk kebutuhan di sini dan tidak
   menambah apa pun ke npm install di VPS.

   Yang DIJAMIN mekanisme ini: isi token tidak bisa diubah tanpa diketahui,
   dan masa berlakunya tidak bisa diperpanjang oleh klien. Yang TIDAK
   dijamin: pencabutan sesi sebelum kedaluwarsa — token yang sudah terbit
   tetap sah sampai 12 jam, termasuk setelah akun dinonaktifkan. Untuk itu
   perlu daftar sesi di database, dan itu pekerjaan terpisah.
   ====================================================================== */

const COOKIE_NAME = "mrd_session";
const MASA_BERLAKU_MS = 12 * 60 * 60 * 1000; // 12 jam

/* Tanpa SESSION_SECRET, kunci diacak saat proses menyala. Akibatnya semua
   sesi gugur setiap kali backend di-restart — merepotkan, tapi jauh lebih
   aman daripada menyimpan kunci cadangan di dalam kode yang bisa dibaca
   siapa pun yang punya akses ke repo. Peringatannya sengaja berisik. */
const SECRET =
  process.env.SESSION_SECRET ||
  (() => {
    console.warn(
      "[auth] SESSION_SECRET belum diisi di .env — memakai kunci acak sementara.\n" +
        "       Semua sesi login akan gugur setiap backend di-restart.\n" +
        "       Isi SESSION_SECRET dengan string acak panjang untuk produksi."
    );
    return crypto.randomBytes(48).toString("hex");
  })();

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

function tandaTangan(data) {
  return crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
}

function buatToken(user) {
  const payload = {
    u: user.username,
    r: user.role,
    n: user.name || "",
    exp: Date.now() + MASA_BERLAKU_MS,
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${tandaTangan(body)}`;
}

function bacaToken(token) {
  if (typeof token !== "string" || !token.includes(".")) return null;

  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const harapan = tandaTangan(body);

  /* Perbandingan waktu-tetap: perbandingan string biasa berhenti di karakter
     pertama yang berbeda, dan selisih waktunya bisa dipakai menebak tanda
     tangan satu karakter demi satu karakter. */
  const a = Buffer.from(sig);
  const b = Buffer.from(harapan);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/* Express menyediakan res.cookie untuk menulis, tapi tidak mem-parse header
   Cookie tanpa cookie-parser. Lima baris ini menggantikannya. */
function ambilCookie(req, nama) {
  const mentah = req.headers.cookie;
  if (!mentah) return null;
  for (const bagian of mentah.split(";")) {
    const idx = bagian.indexOf("=");
    if (idx < 0) continue;
    if (bagian.slice(0, idx).trim() === nama) {
      return decodeURIComponent(bagian.slice(idx + 1).trim());
    }
  }
  return null;
}

function pasangSesi(res, user) {
  res.cookie(COOKIE_NAME, buatToken(user), {
    httpOnly: true, // tidak terbaca JavaScript, jadi XSS tidak bisa mencurinya
    sameSite: "lax", // menahan pengiriman dari situs lain (CSRF dasar)
    path: "/",
    maxAge: MASA_BERLAKU_MS,
    // secure: true menunggu HTTPS. Papan ini berjalan di HTTP via IP lokal,
    // dan memasangnya sekarang justru membuat cookie tidak pernah terkirim.
  });
}

function hapusSesi(res) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

/* Dipasang pada seluruh /api/dashboard. Tidak menolak siapa pun — hanya
   mengisi req.user bila ada sesi sah, supaya rute publik tetap jalan. */
function bacaSesi(req, _res, next) {
  req.user = bacaToken(ambilCookie(req, COOKIE_NAME));
  next();
}

function wajibLogin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Sesi tidak ditemukan atau sudah berakhir. Silakan masuk kembali.",
    });
  }
  next();
}

/* Peran diambil dari token yang ditandatangani server, BUKAN dari req.body.
   Sebelum ini beberapa rute membaca `role` kiriman klien, sehingga siapa pun
   bisa mengaku admin hanya dengan menambah satu field di permintaan. */
function wajibPeran(...peran) {
  const diizinkan = peran.map((p) => p.toLowerCase());
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Sesi tidak ditemukan atau sudah berakhir. Silakan masuk kembali.",
      });
    }
    if (!diizinkan.includes(String(req.user.r || "").toLowerCase())) {
      return res.status(403).json({
        success: false,
        error: "Akun Anda tidak memiliki wewenang untuk tindakan ini.",
      });
    }
    next();
  };
}

module.exports = {
  COOKIE_NAME,
  pasangSesi,
  hapusSesi,
  bacaSesi,
  wajibLogin,
  wajibPeran,
};
