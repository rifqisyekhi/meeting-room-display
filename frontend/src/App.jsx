import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import dayjs from 'dayjs'
import 'dayjs/locale/id'
import { QRCodeSVG } from 'qrcode.react'
import kemnakerLogo from './assets/kemnaker-logo.png'
import './App.css'

dayjs.locale('id')

const BOOKING_URL = 'https://s.id/RokeuBmn'
const EMPTY_DATA = { ruangRapatBesar: [], ruangKonsultasi: [] }
const EMPTY_YEAR_SUMMARY = { year: 2026, totalMeeting: 0, totalDurationMinutes: 0, utilization: 0 }
const ROOMS = [
  { key: 'ruangRapatBesar', name: 'RUANG RAPAT BESAR', icon: '♟', tone: 'red' },
  { key: 'ruangKonsultasi', name: 'RUANG KONSULTASI', icon: '♣', tone: 'green' },
]

function durationInMinutes(event) {
  const [sh, sm] = event.mulai.split(':').map(Number)
  const [eh, em] = event.selesai.split(':').map(Number)
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm))
}

function Countdown({ end, now }) {
  const [hours, minutes] = end.split(':').map(Number)
  const finish = now.hour(hours).minute(minutes).second(0)
  const seconds = Math.max(0, finish.diff(now, 'second'))
  return <strong className="countdown">{String(Math.floor(seconds / 3600)).padStart(2, '0')}:{String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</strong>
}

function Timeline({ events, now, tone }) {
  const currentHour = now.hour() + now.minute() / 60
  return <section className="timeline"><h3>TIMELINE HARI INI</h3><div className="timeline-hours"><span>08.00</span><span>10.00</span><span>12.00</span><span>14.00</span><span>16.00</span><span>18.00</span><span>20.00</span></div><div className="timeline-track">
    {events.map((event, index) => {
      const [hour, minute] = event.mulai.split(':').map(Number)
      const left = Math.max(0, ((hour + minute / 60 - 8) / 12) * 100)
      const width = Math.min(100 - left, (durationInMinutes(event) / 720) * 100)
      return <i key={`${event.mulai}-${index}`} className={`block ${event.status === 'IN_PROGRESS' ? 'active' : tone}`} style={{ left: `${left}%`, width: `${width}%` }} />
    })}
    {currentHour >= 8 && currentHour <= 20 && <b style={{ left: `${((currentHour - 8) / 12) * 100}%` }} />}
  </div><div className="legend"><span className="active">Sedang Digunakan</span><span className={tone}>Terjadwal</span><span className="done">Selesai</span></div></section>
}

function Upcoming({ events, tone }) {
  const upcoming = events.filter((event) => event.status === 'UPCOMING').slice(0, 3)
  return <aside className="upcoming"><h3>SELANJUTNYA</h3>{upcoming.length ? upcoming.map((event, index) => <div className="upcoming-item" key={`${event.tanggal}-${event.mulai}-${index}`}><span className={`calendar-icon ${tone}`}>▣</span><div><small>{event.tanggal} · {event.mulai} - {event.selesai}</small><strong>{event.agenda}</strong><p>PIC: {event.bagian}</p></div></div>) : <p className="no-schedule">Tidak ada jadwal dalam 7 hari ke depan.</p>}</aside>
}

function RoomPanel({ room, todayEvents, upcomingEvents, now }) {
  const current = todayEvents.find((event) => event.status === 'IN_PROGRESS')
  const next = upcomingEvents.find((event) => event.status === 'UPCOMING')
  const available = !current
  return <section className={`room-panel ${room.tone}`}><div className="panel-title"><span className="room-icon">{room.icon}</span><div><h2>{room.name}</h2><b>{available ? 'TERSEDIA' : 'SEDANG DIGUNAKAN'}</b></div></div><div className="panel-content"><div className="current-card">
    {current ? <><p className="section-label">RAPAT SAAT INI</p><h3>{current.agenda}</h3><p className="time">◷ {current.mulai} - {current.selesai} WIB</p><div className="meeting-detail"><span>PIC / Penyelenggara<strong>{current.bagian}</strong></span><span>STATUS<strong>Sedang berlangsung</strong></span></div><div className="remaining"><p>SISA WAKTU</p><Countdown end={current.selesai} now={now} /></div></> : <><div className="available-symbol">▣</div><p className="available-title">RUANGAN TERSEDIA</p><p className="empty-copy">Tidak ada jadwal saat ini</p><div className="booking-next"><p>BOOKING BERIKUTNYA</p>{next ? <><strong>{next.tanggal} · {next.mulai} - {next.selesai} WIB</strong><span>{next.agenda}</span><small>PIC: {next.bagian}</small></> : <span>Belum ada booking berikutnya</span>}</div></>}
  </div><Upcoming events={upcomingEvents} tone={room.tone} /></div><Timeline events={todayEvents} now={now} tone={room.tone} /></section>
}

function App() {
  const [today, setToday] = useState(EMPTY_DATA)
  const [upcoming, setUpcoming] = useState(EMPTY_DATA)
  const [yearSummary, setYearSummary] = useState(EMPTY_YEAR_SUMMARY)
  const [now, setNow] = useState(dayjs())
  const [error, setError] = useState(false)

  useEffect(() => {
    const load = async () => { try { const [todayResponse, upcomingResponse, yearResponse] = await Promise.all([axios.get('/api/events/today'), axios.get('/api/events/upcoming'), axios.get('/api/events/summary/year')]); setToday({ ...EMPTY_DATA, ...todayResponse.data }); setUpcoming({ ...EMPTY_DATA, ...upcomingResponse.data }); setYearSummary(yearResponse.data); setError(false) } catch (loadError) { console.error(loadError); setError(true) } }
    load(); const id = window.setInterval(load, 60_000); return () => window.clearInterval(id)
  }, [])
  useEffect(() => { const id = window.setInterval(() => setNow(dayjs()), 1_000); return () => window.clearInterval(id) }, [])

  const allToday = useMemo(() => [...today.ruangRapatBesar, ...today.ruangKonsultasi], [today])
  const duration = allToday.reduce((total, event) => total + durationInMinutes(event), 0)
  const activeRooms = ROOMS.filter((room) => today[room.key].some((event) => event.status === 'IN_PROGRESS')).length

  return <main className="calendar-display"><header><div className="brand"><img className="brand-mark" src={kemnakerLogo} alt="Logo Kementerian Ketenagakerjaan" /><div><strong>KEMNAKER</strong><span>Biro Keuangan dan BMN</span></div></div><div className="heading"><h1>KALENDER RUANG RAPAT</h1><p>▣ {now.format('dddd, D MMMM YYYY')} <i /> ◷ {now.format('HH:mm:ss')} WIB</p></div><div className="values"><strong>BerAKHLAK</strong><span>#bangga<br />melayani<br />bangsa</span></div></header>
    {error && <p className="api-error">Jadwal tidak dapat diperbarui. Data terakhir tetap ditampilkan.</p>}
    <div className="panels">{ROOMS.map((room) => <RoomPanel key={room.key} room={room} todayEvents={today[room.key]} upcomingEvents={upcoming[room.key]} now={now} />)}</div>
    <footer><section className="information"><h3>INFORMASI</h3><p>◖ Mohon menjaga kebersihan ruang rapat</p><p>▤ Matikan AC dan peralatan elektronik setelah digunakan</p></section><section className="booking"><div><h3>SCAN UNTUK BOOKING</h3><QRCodeSVG value={BOOKING_URL} size={124} level="M" includeMargin /><a href={BOOKING_URL} target="_blank" rel="noreferrer">s.id/RokeuBmn</a></div></section><section className="summary"><div className="summary-today"><h3>RINGKASAN HARI INI</h3><div><article><b>{allToday.length}</b><span>Total Meeting</span></article><article><b>{Math.floor(duration / 60)} jam {duration % 60} mnt</b><span>Total Durasi</span></article><article><b>{activeRooms}/2</b><span>Ruang Dipakai</span></article><article><b>{allToday.length ? Math.round((duration / (12 * 60 * 2)) * 100) : 0}%</b><span>Utilisasi</span></article></div></div><div className="summary-year"><div><h3>RINGKASAN TAHUN {yearSummary.year}</h3><p>1 Januari s.d. {now.format('D MMMM YYYY')}</p></div><div><article><b>{yearSummary.totalMeeting}</b><span>Total Meeting</span></article><article><b>{Math.floor(yearSummary.totalDurationMinutes / 60)} jam {yearSummary.totalDurationMinutes % 60} mnt</b><span>Total Durasi</span></article><article><b>{yearSummary.utilization}%</b><span>Utilisasi</span></article></div></div></section></footer>
  </main>
}

export default App
