// Utilitas manajemen daur hidup sesi "One Flow Run" untuk dev environment.
// Data hanya eksis selama proses 'npm run dev' berjalan.
// Begitu 'npm run dev' di-close/restart, seluruh data pemesanan kembali ke data dummy default (hanya 1 data).

export const DEFAULT_INITIAL_MEETINGS = [
  {
    id: 1,
    title: "Rapat Koordinasi Biro Keuangan",
    requester: "Andi Pratama",
    room: "Ruang Rapat Besar",
    date: "2026-09-22",
    start: "08:00",
    end: "10:00",
    status: "Berjalan",
    participants: 12,
    desc: "Pembahasan laporan keuangan dan evaluasi program.",
  },
];

export function ensureDevSessionSync() {
  try {
    const currentRunId = typeof __DEV_RUN_ID__ !== 'undefined' ? __DEV_RUN_ID__ : null;
    const storedRunId = localStorage.getItem('app_dev_run_id');

    if (currentRunId && storedRunId !== currentRunId) {
      // Terdeteksi proses npm run dev baru (atau baru pertama kali dijalankan)!
      console.info(`[DevSession] Sesi baru npm run dev dimulai (${currentRunId}). Resetting data ke 1 dummy item.`);
      localStorage.removeItem('app_meetings');
      localStorage.removeItem('app_notifications');
      localStorage.removeItem('app_rooms');
      localStorage.removeItem('app_users');
      localStorage.removeItem('app_login_users');
      sessionStorage.clear();

      localStorage.setItem('app_dev_run_id', currentRunId);
      localStorage.setItem('app_meetings', JSON.stringify(DEFAULT_INITIAL_MEETINGS));
      localStorage.setItem('app_notifications', JSON.stringify([]));
    } else if (!localStorage.getItem('app_meetings')) {
      // Inisialisasi awal jika belum ada data sama sekali
      localStorage.setItem('app_meetings', JSON.stringify(DEFAULT_INITIAL_MEETINGS));
      localStorage.setItem('app_notifications', JSON.stringify([]));
    }
  } catch (err) {
    console.warn('[DevSession] Gagal sinkronisasi sesi dev:', err);
  }
}
