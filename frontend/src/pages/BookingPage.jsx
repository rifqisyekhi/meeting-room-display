import React, { useState } from 'react';
import { FaUserFriends, FaMapMarkerAlt, FaRegCalendarAlt, FaRegClock, FaRegListAlt, FaRegBuilding, FaUsers, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import './BookingPage.css';
import logo from '../assets/Logo Kemenaker White.png';

const initialMeetings = [
  { id: 1, title: "Rapat Biro Keuangan", requester: "Andi Pratama", room: "Ruang Nusantara", date: "2026-09-22", start: "08:00", end: "10:00", status: "Berjalan", participants: 12, desc: "Pembahasan laporan keuangan dan evaluasi program." },
  { id: 2, title: "Koordinasi Tim IT", requester: "Siti Rahma", room: "Ruang Garuda", date: "2026-09-22", start: "10:00", end: "12:00", status: "Menunggu Approval", participants: 8, desc: "Koordinasi pengembangan sistem." },
  { id: 3, title: "Evaluasi Program 2026", requester: "Budi Santoso", room: "Ruang Merdeka", date: "2026-09-22", start: "13:00", end: "15:00", status: "Akan Datang", participants: 15, desc: "Evaluasi capaian program." },
  { id: 901, title: "Sosialisasi SOP Baru", requester: "Biro SDM", room: "Ruang Nusantara", date: "2026-09-23", start: "09:00", end: "11:00", status: "Menunggu Approval", participants: 25, desc: "Pemahaman terkait standar operasional prosedur." },
  { id: 902, title: "Rapat Perencanaan Anggaran", requester: "Bagian Anggaran", room: "Ruang Rapat Utama", date: "2026-09-24", start: "13:00", end: "16:00", status: "Menunggu Approval", participants: 20, desc: "Draft awal perencanaan anggaran 2027." },
  { id: 4, title: "Rapat Internal", requester: "Dewi Lestari", room: "Ruang Indonesia", date: "2026-09-22", start: "15:00", end: "17:00", status: "Akan Datang", participants: 10, desc: "Rapat internal biro." },
  { id: 5, title: "Diskusi Anggaran", requester: "Rizky Handoko", room: "Ruang Kemnaker", date: "2026-09-22", start: "19:00", end: "21:00", status: "Selesai", participants: 7, desc: "Diskusi anggaran." },
  { id: 6, title: "Rapat Pengembangan SDM", requester: "Maya Sari", room: "Ruang Pancasila", date: "2026-09-23", start: "09:00", end: "11:00", status: "Akan Datang", participants: 14, desc: "Pengembangan SDM." },
  { id: 7, title: "Review Kinerja Triwulan", requester: "Agus Widodo", room: "Ruang Kolaborasi", date: "2026-09-23", start: "13:00", end: "15:00", status: "Akan Datang", participants: 9, desc: "Review kinerja." },
  { id: 8, title: "Rapat Koordinasi", requester: "Nina Kartika", room: "Ruang Bhinneka", date: "2026-09-23", start: "16:00", end: "17:30", status: "Akan Datang", participants: 11, desc: "Rapat koordinasi mingguan." }
];

const rooms = [
  { id: 'R1', name: 'Ruang Rapat Besar', capacity: 20, location: 'Gedung A - Lantai 3', category: 'Ruang Besar', img: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=300&h=200' },
  { id: 'R2', name: 'Ruang Konsultasi', capacity: 10, location: 'Gedung A - Lantai 3', category: 'Ruang Konsultasi', img: 'https://images.unsplash.com/photo-1577412647305-991150c7d163?auto=format&fit=crop&q=80&w=300&h=200' }
];

export default function BookingPage() {
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [agenda, setAgenda] = useState('');
  const [bagian, setBagian] = useState('');
  const [peserta, setPeserta] = useState('');

  // Desktop: derived step for blur; Mobile: explicit step navigation
  const currentStep = selectedRoom ? (selectedDate && selectedTime ? 3 : 2) : 1;
  const [mobileStep, setMobileStep] = useState(1); // 1, 2, 3

  const days = [
    { day: 'Senin', date: '21', full: '2026-09-21' },
    { day: 'Selasa', date: '22', full: '2026-09-22' },
    { day: 'Rabu', date: '23', full: '2026-09-23' },
    { day: 'Kamis', date: '24', full: '2026-09-24' },
    { day: 'Jumat', date: '25', full: '2026-09-25' }
  ];

  const timeSlots = [
    { time: '08:00 - 10:00', status: 'available' },
    { time: '10:00 - 12:00', status: 'available' },
    { time: '13:00 - 15:00', status: 'available' },
    { time: '15:00 - 17:00', status: 'unavailable' }
  ];

  const handleBooking = () => {
    if (!agenda || !bagian || !peserta || !selectedRoom || !selectedDate || !selectedTime) {
      alert("Mohon lengkapi semua data!");
      return;
    }
    const [start, end] = selectedTime.split(' - ');
    const newMeeting = {
      id: Date.now(),
      title: agenda,
      requester: bagian,
      room: selectedRoom?.name,
      date: selectedDate,
      start,
      end,
      status: "Menunggu Approval",
      participants: parseInt(peserta) || 0,
      desc: agenda
    };
    let currentMeetings = [];
    try {
      const stored = localStorage.getItem('app_meetings');
      currentMeetings = stored ? JSON.parse(stored) : initialMeetings;
    } catch (e) {
      currentMeetings = initialMeetings;
    }
    currentMeetings.push(newMeeting);
    localStorage.setItem('app_meetings', JSON.stringify(currentMeetings));
    alert("Pemesanan berhasil! Menunggu Approval dari Administrator.");
    setAgenda('');
    setBagian('');
    setPeserta('');
  };

  const filteredRooms = selectedCategory === 'Semua'
    ? rooms
    : rooms.filter(r => r.category === selectedCategory);

  const selectedDayObj = days.find(d => d.full === selectedDate);
  const formattedDateString = selectedDayObj ? `${selectedDayObj.day}, ${selectedDayObj.date} September 2026` : '';

  // Mobile: handle room selection + auto advance
  const handleSelectRoom = (room) => {
    setSelectedRoom(room);
    setMobileStep(2);
  };

  // Mobile: handle time selection + auto advance
  const handleSelectTime = (ts) => {
    if (ts.status === 'unavailable') return;
    setSelectedTime(ts.time);
    setMobileStep(3);
  };

  // ---- Shared column content (rendered both desktop & mobile) ----
  const colRoom = (
    <>
      <h2 className="bk-col-title">PILIH RUANG RAPAT</h2>
      <div className="bk-tags">
        {['Semua', 'Ruang Besar', 'Ruang Konsultasi'].map(cat => (
          <button
            key={cat}
            className={`bk-tag ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="bk-room-list">
        {filteredRooms.map(room => (
          <div
            key={room.id}
            className={`bk-room-card ${selectedRoom?.id === room.id ? 'active' : ''}`}
            onClick={() => handleSelectRoom(room)}
          >
            <img src={room.img} alt={room.name} className="bk-room-img" />
            <div className="bk-room-info">
              <h3>{room.name}</h3>
              <div className="bk-room-meta"><FaUserFriends className="bk-icon" /> Kapasitas : {room.capacity} Orang</div>
              <div className="bk-room-meta"><FaMapMarkerAlt className="bk-icon" /> {room.location}</div>
            </div>
            <div className="bk-room-arrow"><FaChevronRight /></div>
          </div>
        ))}
      </div>
    </>
  );

  const colDateTime = (
    <>
      <h2 className="bk-col-title">PILIH TANGGAL &amp; WAKTU</h2>
      <div className="bk-month-selector">
        <h4>September 2026</h4>
        <div className="bk-days-row">
          <FaChevronLeft className="bk-nav-icon" />
          {days.map(d => (
            <div
              key={d.full}
              className={`bk-day-box ${selectedDate === d.full ? 'active' : ''}`}
              onClick={() => setSelectedDate(d.full)}
            >
              <span className="bk-day-name">{d.day}</span>
              <span className="bk-day-num">{d.date}</span>
            </div>
          ))}
          <FaChevronRight className="bk-nav-icon" />
        </div>
      </div>
      <div className="bk-time-selector">
        <div className="bk-time-header">
          <span className="bk-selected-date-text">{formattedDateString}</span>
          <div className="bk-legend">
            <span className="bk-leg-item"><span className="bk-dot green"></span>Tersedia</span>
            <span className="bk-leg-item"><span className="bk-dot gray"></span>Tidak Tersedia</span>
            <span className="bk-leg-item"><span className="bk-dot blue"></span>Dipilih</span>
          </div>
        </div>
        <div className="bk-time-grid">
          {timeSlots.map(ts => {
            let statusClass = ts.status;
            if (selectedTime === ts.time && ts.status === 'available') statusClass = 'selected';
            return (
              <button
                key={ts.time}
                className={`bk-time-btn ${statusClass}`}
                disabled={ts.status === 'unavailable'}
                onClick={() => handleSelectTime(ts)}
              >
                {ts.time}
              </button>
            );
          })}
          <button className="bk-time-btn extra">Penambahan Waktu +</button>
        </div>
      </div>
    </>
  );

  const colDetail = (
    <>
      <h2 className="bk-col-title">DETAIL PEMESANAN</h2>
      <div className="bk-detail-card">
        <div className="bk-detail-room">
          <img src={selectedRoom?.img} alt={selectedRoom?.name} />
          <div>
            <h3>{selectedRoom?.name}</h3>
            <div className="bk-room-meta"><FaUserFriends className="bk-icon" /> Kapasitas : {selectedRoom?.capacity} Orang</div>
            <div className="bk-room-meta"><FaMapMarkerAlt className="bk-icon" /> {selectedRoom?.location}</div>
          </div>
        </div>
        <div className="bk-detail-datetime">
          <div><FaRegCalendarAlt className="bk-icon-dark" /> <span>Tanggal</span></div>
          <div className="bk-val">{formattedDateString}</div>
          <div><FaRegClock className="bk-icon-dark" /> <span>Waktu</span></div>
          <div className="bk-val">{selectedTime ? selectedTime : '-'}</div>
        </div>
        <div className="bk-form">
          <div className="bk-form-group">
            <label><FaRegListAlt className="bk-icon-dark" /> Agenda Rapat</label>
            <textarea placeholder="Masukkan agenda rapat..." value={agenda} onChange={e => setAgenda(e.target.value)}></textarea>
          </div>
          <div className="bk-form-group">
            <label><FaRegBuilding className="bk-icon-dark" /> Bagian</label>
            <select value={bagian} onChange={e => setBagian(e.target.value)}>
              <option value="" disabled>Pilih bagian</option>
              <option value="Biro Keuangan">Biro Keuangan</option>
              <option value="Biro SDM">Biro SDM</option>
              <option value="Biro Perencanaan">Biro Perencanaan</option>
              <option value="Biro Umum">Biro Umum</option>
            </select>
          </div>
          <div className="bk-form-group inline">
            <label><FaUsers className="bk-icon-dark" /> Jumlah Peserta</label>
            <div className="bk-input-row">
              <input type="number" placeholder="Masukkan jumlah peserta" value={peserta} onChange={e => setPeserta(e.target.value)} />
              <span>Orang</span>
            </div>
          </div>
          <button className="bk-submit-btn" onClick={handleBooking}>Booking Sekarang</button>
        </div>
      </div>
    </>
  );

  return (
    <div className="bk-container">
      {/* Header */}
      <header className="bk-header">
        <div className="bk-logo-area">
          <img src={logo} alt="Logo" className="bk-logo" />
          <span className="bk-logo-text">BIRO KEUANGAN DAN BMN</span>
        </div>
        <div className="bk-header-content">
          <h1>BOOKING RUANG RAPAT</h1>
          <p>Pesan Ruang Rapat sesuai kebutuhan Anda<br />dengan mudah dan cepat.</p>
        </div>
      </header>

      {/* Stepper */}
      <div className="bk-stepper">
        <div className={`bk-step ${currentStep >= 1 ? 'active' : ''}`}><span className="step-num">1</span> <span className="step-label">Pilih Ruangan</span></div>
        <div className="bk-line"></div>
        <div className={`bk-step ${currentStep >= 2 ? 'active' : ''}`}><span className="step-num">2</span> <span className="step-label">Pilih Tanggal &amp; Waktu</span></div>
        <div className="bk-line"></div>
        <div className={`bk-step ${currentStep >= 3 ? 'active' : ''}`}><span className="step-num">3</span> <span className="step-label">Isi Detail Rapat</span></div>
        <div className="bk-line"></div>
        <div className="bk-step"><span className="step-num">4</span> <span className="step-label">Konfirmasi</span></div>
      </div>

      {/* ── DESKTOP LAYOUT (3 columns, blur effect) ── */}
      <div className="bk-main bk-desktop">
        <div className="bk-col">{colRoom}</div>
        <div className={`bk-col ${!selectedRoom ? 'disabled-blur' : ''}`}>{colDateTime}</div>
        <div className={`bk-col ${(!selectedDate || !selectedTime) ? 'disabled-blur' : ''}`}>{colDetail}</div>
      </div>

      {/* ── MOBILE LAYOUT (slide one step at a time) ── */}
      <div className="bk-mobile">
        {/* Mobile bottom nav dots */}
        <div className="bk-mobile-dots">
          {[1, 2, 3].map(s => (
            <span key={s} className={`bk-mdot ${mobileStep === s ? 'active' : ''}`}></span>
          ))}
        </div>

        {/* Sliding track */}
        <div className="bk-mobile-track" style={{ transform: `translateX(${-(mobileStep - 1) * 100}%)` }}>
          {/* Slide 1: Pilih Ruangan */}
          <div className="bk-mobile-slide">
            <div className="bk-col">{colRoom}</div>
          </div>

          {/* Slide 2: Pilih Tanggal & Waktu */}
          <div className="bk-mobile-slide">
            <div className="bk-col">
              {colDateTime}
              <div className="bk-mobile-nav">
                <button className="bk-mnav-btn outline" onClick={() => setMobileStep(1)}>
                  <FaChevronLeft /> Kembali
                </button>
                <button
                  className="bk-mnav-btn primary"
                  disabled={!selectedDate || !selectedTime}
                  onClick={() => setMobileStep(3)}
                >
                  Selanjutnya <FaChevronRight />
                </button>
              </div>
            </div>
          </div>

          {/* Slide 3: Detail Pemesanan */}
          <div className="bk-mobile-slide">
            <div className="bk-col">
              {colDetail}
              <div className="bk-mobile-nav" style={{ padding: '0 24px 24px' }}>
                <button className="bk-mnav-btn outline" onClick={() => setMobileStep(2)}>
                  <FaChevronLeft /> Kembali
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
