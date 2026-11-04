/* Satu sumber kebenaran untuk mengakhiri sesi.

   Sebelumnya ada tiga logout dengan daftar kunci berbeda — BookingAccountBar
   dan UserDashboardPage masing-masing 9 kunci, dashboard-app 13 — sehingga
   selalu ada salinan identitas yang lolos. Itu berbahaya karena identitas
   disebar ke enam slot di dua penyimpanan, dan beberapa halaman menyalinnya
   kembali antar slot. Satu sisa saja cukup untuk menghidupkan lagi sesi lama.

   Identitas juga dipegang server lewat cookie bertanda tangan (lihat
   backend/src/middleware/auth.js). Membersihkan penyimpanan peramban tidak
   menyentuh cookie itu, jadi server harus diberi tahu terpisah. */

export const KUNCI_SESI = [
  "isAuthenticated",
  "currentUser",
  "savedAccounts",
  "isAddingAccount",
  "dashboard_isAuthenticated",
  "dashboard_currentUser",
  "dashboard_savedAccounts",
  "dashboard_isAddingAccount",
  "booking_isAuthenticated",
  "booking_currentUser",
  "booking_savedAccounts",
  "booking_isAddingAccount",
];

/* Hapus seluruh jejak sesi di peramban. Dipakai juga oleh alur ganti akun,
   yang perlu membersihkan tanpa memanggil logout server. */
export function bersihkanPenyimpananSesi() {
  [sessionStorage, localStorage].forEach((penyimpanan) => {
    KUNCI_SESI.forEach((kunci) => {
      try {
        penyimpanan.removeItem(kunci);
      } catch {
        // Penyimpanan bisa tidak tersedia di mode privat atau peramban terkunci.
      }
    });
  });
}

/* Akhiri sesi sepenuhnya: cookie server dulu, baru penyimpanan peramban.

   Server didahulukan dan ditunggu, supaya saat halaman berikutnya memanggil
   API, cookienya sudah tidak berlaku. Kalau permintaannya gagal — server mati,
   jaringan putus — pembersihan peramban tetap jalan: lebih baik sesi lokal
   hilang daripada pengguna mengira dirinya sudah keluar padahal belum. */
export async function logoutPenuh() {
  try {
    await fetch("/api/dashboard/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Diabaikan dengan sengaja; lihat alasannya di atas.
  }
  bersihkanPenyimpananSesi();
}
