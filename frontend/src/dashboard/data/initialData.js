export const initialMeetings = [
  { id: 1, title: 'Rapat Biro Keuangan', requester: 'Andi Pratama', room: 'Ruang Nusantara', date: '2026-09-22', start: '08:00', end: '10:00', status: 'Berjalan', participants: 12, desc: 'Pembahasan laporan keuangan dan evaluasi program.' },
  { id: 2, title: 'Koordinasi Tim IT', requester: 'Siti Rahma', room: 'Ruang Garuda', date: '2026-09-22', start: '10:00', end: '12:00', status: 'Menunggu Approval', participants: 8, desc: 'Koordinasi pengembangan sistem.' },
  { id: 3, title: 'Evaluasi Program 2026', requester: 'Budi Santoso', room: 'Ruang Merdeka', date: '2026-09-22', start: '13:00', end: '15:00', status: 'Akan Datang', participants: 15, desc: 'Evaluasi capaian program.' },
  { id: 901, title: 'Sosialisasi SOP Baru', requester: 'Biro SDM', room: 'Ruang Nusantara', date: '2026-09-23', start: '09:00', end: '11:00', status: 'Menunggu Approval', participants: 25, desc: 'Pemahaman terkait standar operasional prosedur yang baru dirilis.' },
  { id: 902, title: 'Rapat Perencanaan Anggaran', requester: 'Kepala Bagian Anggaran', room: 'Ruang Rapat Utama', date: '2026-09-24', start: '13:00', end: '16:00', status: 'Menunggu Approval', participants: 20, desc: 'Draft awal perencanaan anggaran 2027.' },
  { id: 4, title: 'Rapat Internal', requester: 'Dewi Lestari', room: 'Ruang Indonesia', date: '2026-09-22', start: '15:00', end: '17:00', status: 'Akan Datang', participants: 10, desc: 'Rapat internal biro.' },
  { id: 5, title: 'Diskusi Anggaran', requester: 'Rizky Handoko', room: 'Ruang Kemnaker', date: '2026-09-22', start: '19:00', end: '21:00', status: 'Selesai', participants: 7, desc: 'Diskusi anggaran.' },
  { id: 6, title: 'Rapat Pengembangan SDM', requester: 'Maya Sari', room: 'Ruang Pancasila', date: '2026-09-23', start: '09:00', end: '11:00', status: 'Akan Datang', participants: 14, desc: 'Pengembangan SDM.' },
  { id: 7, title: 'Review Kinerja Triwulan', requester: 'Agus Widodo', room: 'Ruang Kolaborasi', date: '2026-09-23', start: '13:00', end: '15:00', status: 'Akan Datang', participants: 9, desc: 'Review kinerja.' },
  { id: 8, title: 'Presentasi Program', requester: 'Nina Kartika', room: 'Ruang Bhinneka', date: '2026-09-23', start: '16:00', end: '17:30', status: 'Akan Datang', participants: 18, desc: 'Presentasi program.' },
];

export const initialRooms = [
  { id: 1, name: 'Ruang Nusantara', location: 'Gedung Pusat, Lt. 3', capacity: 20, status: 'Tersedia', facilities: 'Proyektor, TV, WiFi, Sound System' },
  { id: 2, name: 'Ruang Garuda', location: 'Gedung Pusat, Lt. 3', capacity: 15, status: 'Tersedia', facilities: 'TV, WiFi, AC' },
  { id: 3, name: 'Ruang Merdeka', location: 'Gedung Pusat, Lt. 4', capacity: 30, status: 'Terpakai', facilities: 'Proyektor, TV, WiFi, Whiteboard' },
  { id: 4, name: 'Ruang Indonesia', location: 'Gedung Utama, Lt. 2', capacity: 50, status: 'Tersedia', facilities: 'Proyektor, Sound System, WiFi' },
  { id: 5, name: 'Ruang Kemnaker', location: 'Gedung Utama, Lt. 1', capacity: 10, status: 'Tersedia', facilities: 'TV, WiFi' },
  { id: 6, name: 'Ruang Pancasila', location: 'Gedung B, Lt. 2', capacity: 25, status: 'Perbaikan', facilities: 'Proyektor, TV, WiFi' },
  { id: 7, name: 'Ruang Kolaborasi', location: 'Gedung B, Lt. 1', capacity: 12, status: 'Tersedia', facilities: 'TV, Whiteboard, WiFi' },
  { id: 8, name: 'Ruang Bhinneka', location: 'Gedung C, Lt. 3', capacity: 20, status: 'Tersedia', facilities: 'Proyektor, TV, WiFi, AC' },
  { id: 9, name: 'Ruang Rapat Utama', location: 'Gedung Pusat, Lt. 1', capacity: 40, status: 'Terpakai', facilities: 'Proyektor, Sound System, TV, WiFi' },
];

export const initialUsers = [
  { id: 1, name: 'Windy Nuraini Putri', email: 'windy@kemnaker.go.id', dept: 'Biro Keuangan', role: 'Administrator', status: 'Aktif' },
  { id: 2, name: 'Andi Pratama', email: 'andi@kemnaker.go.id', dept: 'Biro Keuangan', role: 'User', status: 'Aktif' },
  { id: 3, name: 'Siti Rahma', email: 'siti@kemnaker.go.id', dept: 'Biro Keuangan', role: 'User', status: 'Aktif' },
  { id: 4, name: 'Budi Santoso', email: 'budi@kemnaker.go.id', dept: 'Biro Umum', role: 'Admin Ruangan', status: 'Aktif' },
  { id: 5, name: 'Dewi Lestari', email: 'dewi@kemnaker.go.id', dept: 'Biro Keuangan', role: 'User', status: 'Aktif' },
  { id: 6, name: 'Rizky Handoko', email: 'rizky@kemnaker.go.id', dept: 'IT Support', role: 'Admin Sistem', status: 'Aktif' },
  { id: 7, name: 'Maya Sari', email: 'maya@kemnaker.go.id', dept: 'Biro SDM', role: 'User', status: 'Nonaktif' },
  { id: 8, name: 'Agus Widodo', email: 'agus@kemnaker.go.id', dept: 'Biro Umum', role: 'User', status: 'Aktif' },
  { id: 9, name: 'Nina Kartika', email: 'nina@kemnaker.go.id', dept: 'Biro Umum', role: 'Admin Ruangan', status: 'Aktif' },
  { id: 10, name: 'Fajar Maulana', email: 'fajar@kemnaker.go.id', dept: 'Biro SDM', role: 'User', status: 'Nonaktif' },
];
