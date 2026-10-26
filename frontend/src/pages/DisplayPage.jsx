import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import dayjs from 'dayjs'
import 'dayjs/locale/id'
import { QRCodeSVG } from 'qrcode.react'
import { Link } from 'react-router-dom'
import { IoLogoWhatsapp } from "react-icons/io"
import kemnakerLogo from '../assets/kemnaker-logo.png'
import '../App.css'

dayjs.locale('id')

const BOOKING_URL = 'https://s.id/RokeuBmn'
const EMPTY_DATA = { ruangRapatBesar: [], ruangKonsultasi: [] }
const EMPTY_YEAR_SUMMARY = { year: dayjs().year(), totalMeeting: 0, totalDurationMinutes: 0, utilization: 0 }
const EMPTY_PRAYER = { kota: '', sumberLabel: '', jadwal: [] }

const ROOMS = [
  { key: 'ruangRapatBesar', name: 'Ruang Rapat Besar' },
  { key: 'ruangKonsultasi', name: 'Ruang Konsultasi' },
]

/* The timeline covers the working day; anything outside it clamps to an edge. */
const DAY_START = 8
const DAY_END = 20
const DAY_HOURS = DAY_END - DAY_START
const TICKS = [8, 10, 12, 14, 16, 18, 20]
const FILL_ORDER = ['is-done', 'is-next', 'is-live']
const HOUR_CELLS = Array.from({ length: DAY_HOURS }, (unused, index) => DAY_START + index)

/* The poll runs every minute, so one missed refresh is almost always
   blip rather than a fault. Only after this many in a row is the data old
   enough to be worth raising the alarm over. */
const STALE_ALERT_AFTER = 3


function pad(value) {
  return String(value).padStart(2, '0')
}

function toMinutes(time) {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

function durationInMinutes(event) {
  return Math.max(0, toMinutes(event.selesai) - toMinutes(event.mulai))
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest} mnt`
  return rest ? `${hours} j ${rest} m` : `${hours} jam`
}

/* --- icons: one stroke set, so they read as a family ------------------- */

const strokeIcon = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

function ClockIcon(props) {
  return <svg {...strokeIcon} {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7.2V12l3 1.8" /></svg>
}

function CalendarIcon(props) {
  return <svg {...strokeIcon} {...props}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 9.8h17M8 3.5v3M16 3.5v3" /></svg>
}

function CheckIcon(props) {
  return <svg {...strokeIcon} strokeWidth={2.7} {...props}><path d="M4.8 12.6 9.6 17.4 19.4 6.9" /></svg>
}

function MosqueIcon(props) {
  return <svg {...strokeIcon} {...props}><path d="M12 2.8c1.9 1.7 2.9 3 2.9 4.2 0 1.3-1.3 2-2.9 2s-2.9-.7-2.9-2c0-1.2 1-2.5 2.9-4.2" /><path d="M4.5 20.6v-6.2a7.5 7.5 0 0 1 15 0v6.2M3 20.6h18M9.4 20.6v-3.1a2.6 2.6 0 0 1 5.2 0v3.1" /></svg>
}

function RefreshIcon(props) {
  return <svg {...strokeIcon} {...props}><path d="M20 12a8 8 0 1 1-2.35-5.65" /><path d="M20.5 4v4.5H16" /></svg>
}

function ScanIcon(props) {
  return <svg {...strokeIcon} {...props}><path d="M4 8.5V6a2 2 0 0 1 2-2h2.5M15.5 4H18a2 2 0 0 1 2 2v2.5M20 15.5V18a2 2 0 0 1-2 2h-2.5M8.5 20H6a2 2 0 0 1-2-2v-2.5M4 12h16" /></svg>
}

/* --- pieces ------------------------------------------------------------ */

/* Boxes each digit so ticking numbers keep a constant width in Poppins. */
function Digits({ value }) {
  return value.split('').map((char, index) => (
    <span key={index} className={char >= '0' && char <= '9' ? 'tnum' : undefined}>{char}</span>
  ))
}

function Countdown({ end, now }) {
  const [hours, minutes] = end.split(':').map(Number)
  const finish = now.hour(hours).minute(minutes).second(0)
  const seconds = Math.max(0, finish.diff(now, 'second'))

  /* Under an hour the leading "00:" is noise, so it is dropped. The meter is
     left-aligned, so the width change at the hour mark shifts nothing else. */
  const left = Math.floor(seconds / 3600)
  const mid = Math.floor((seconds % 3600) / 60)
  const value = left
    ? `${pad(left)}:${pad(mid)}:${pad(seconds % 60)}`
    : `${pad(mid)}:${pad(seconds % 60)}`

  return (
    <strong className="countdown">
      <Digits value={value} />
    </strong>
  )
}

/* One box per working hour, but each box is filled only for the minutes it
   actually holds: a meeting ending 16.03 tints roughly a twentieth of the
   16-17 box, not the whole thing. Boxes keep the hour grid readable from a
   distance; the partial fill keeps it honest. */
function hourFills(events, hour) {
  const from = hour * 60
  const to = from + 60

  return events
    .map((event) => {
      const start = Math.max(toMinutes(event.mulai), from)
      const end = Math.min(toMinutes(event.selesai), to)
      if (end <= start) return null

      return {
        left: ((start - from) / 60) * 100,
        width: ((end - start) / 60) * 100,
        state:
          event.status === 'IN_PROGRESS' ? 'is-live'
            : event.status === 'UPCOMING' ? 'is-next'
              : 'is-done',
      }
    })
    .filter(Boolean)
    /* Kalau dua rapat tumpang tindih (double booking), yang sedang berjalan
       digambar paling akhir supaya ia yang terlihat di atas. */
    .sort((a, b) => FILL_ORDER.indexOf(a.state) - FILL_ORDER.indexOf(b.state))
}

function Timeline({ events, now }) {
  const currentHour = now.hour() + now.minute() / 60
  const marker = (currentHour - DAY_START) / DAY_HOURS

  return (
    <div className="timeline">
      <p className="eyebrow">Timeline hari ini</p>
      <div className="timeline__strip">
        {HOUR_CELLS.map((hour) => (
          <i key={hour} className="timeline__cell">
            {hourFills(events, hour).map((fill, index) => (
              <b
                key={index}
                className={`timeline__fill ${fill.state}`}
                style={{ left: `${fill.left}%`, width: `${fill.width}%` }}
              />
            ))}
          </i>
        ))}
        {marker >= 0 && marker <= 1 && (
          <b className="timeline__now" style={{ left: `${marker * 100}%` }}>
            <span>{now.format('HH.mm')}</span>
          </b>
        )}
      </div>
      <div className="timeline__ticks">
        {TICKS.map((hour) => <span key={hour}>{pad(hour)}.00</span>)}
      </div>
      <div className="timeline__legend">
        <span className="is-live">Sedang Digunakan</span>
        <span className="is-next">Terjadwal</span>
        <span className="is-done">Selesai</span>
      </div>
    </div>
  )
}

function isEventFinished(event, nowMoment) {
  if (!event) return true
  const s = String(event.status || '').toLowerCase().trim()
  if (s === 'selesai' || s === 'available' || s === 'completed' || s === 'done' || s.includes('batal') || s === 'dibatalkan') {
    return true
  }
  if (event.selesai) {
    const dateStr = event.tanggalIso || nowMoment.format('YYYY-MM-DD')
    const endMoment = dayjs(`${dateStr}T${event.selesai}:00`)
    if (nowMoment.isAfter(endMoment)) {
      return true
    }
  }
  return false
}

function RoomPanel({ room, todayEvents, upcomingEvents, now, merekam }) {
  // 1. Rapat yang SEDANG BERJALAN saat ini (belum selesai & waktu belum lewat & SUDAH DISETUJUI)
  const current = (todayEvents || []).find((event) => {
    if (isEventFinished(event, now)) return false
    const s = String(event.status || '').toLowerCase().trim()
    if (s.includes('menunggu') || s === 'pending') return false
    if (s === 'selesai' || s === 'available') return false

    /* Jam rapat yang menentukan, bukan status. Dulu status IN_PROGRESS
       langsung dianggap sedang berjalan tanpa melihat jam, sehingga papan
       menulis "Ruangan sedang digunakan" dengan meter "Sisa waktu" padahal
       rapatnya belum dimulai — cukup satu check-in lebih awal, atau backend
       menandainya "Berjalan", untuk memicunya. */
    if (!event.mulai || !event.selesai) return false
    const dateStr = event.tanggalIso || now.format('YYYY-MM-DD')
    const startMoment = dayjs(`${dateStr}T${event.mulai}:00`)
    const endMoment = dayjs(`${dateStr}T${event.selesai}:00`)
    return !now.isBefore(startMoment) && now.isBefore(endMoment)
  })

  // 2. Rapat berikutnya: HANYA yang masih akan datang dan BELUM selesai dan SUDAH DISETUJUI
  const isUpcomingValid = (event) => {
    if (!event) return false
    if (isEventFinished(event, now)) return false
    if (current && String(event.id) === String(current.id)) return false

    const s = String(event.status || '').toLowerCase().trim()
    if (s.includes('menunggu') || s === 'pending') return false
    const isStatusUpcoming = s === 'upcoming' || s === 'akan datang' || s === 'disetujui' || s === 'segera'
    if (!isStatusUpcoming) return false

    const dateStr = event.tanggalIso || now.format('YYYY-MM-DD')
    if (event.selesai) {
      const endMoment = dayjs(`${dateStr}T${event.selesai}:00`)
      if (now.isAfter(endMoment)) return false
    }
    return true
  }

  const todayUpcoming = (todayEvents || []).filter(isUpcomingValid)
  const otherUpcoming = (upcomingEvents || []).filter(
    (event) => isUpcomingValid(event) && !todayUpcoming.some((t) => String(t.id) === String(event.id))
  )
  const queue = [...todayUpcoming, ...otherUpcoming].sort((a, b) => {
    const dateA = a.tanggalIso || now.format('YYYY-MM-DD')
    const dateB = b.tanggalIso || now.format('YYYY-MM-DD')
    if (dateA !== dateB) return dateA.localeCompare(dateB)
    return (a.mulai || '').localeCompare(b.mulai || '')
  })
  const next = queue[0]

  return (
    <article className={`room ${current ? 'is-busy' : 'is-free'}`}>
      <div className="room__head">
        <div className="room__title">
          <h2>{room.name}</h2>
        </div>
        <span className="status"><i />{current ? 'Sedang Digunakan' : 'Tersedia'}</span>
      </div>

      <div className="room__body">
        <div className="slot">
          <div className="slot__lead">
            <span className="slot__badge">{current ? <ClockIcon strokeWidth={2.2} /> : <CheckIcon />}</span>
            <div className="slot__headline">
              <p className={`slot__state ${!current ? 'is-empty' : ''}`}>
                {current ? 'Ruangan sedang digunakan' : 'Ruangan tersedia'}
              </p>
              {current && (
                <>
                  <h3>{current.agenda}</h3>
                  <p className="slot__pic">Dipimpin oleh: {current.bagian}</p>
                  <p className="slot__time"><ClockIcon className="icon" />{current.mulai} – {current.selesai} WIB</p>
                  {/* Perekam otomatis notulen sedang aktif di ruangan ini (lihat /perekam). */}
                  {merekam && <p className="slot__rec"><span className="slot__rec-dot" />Sedang direkam untuk notulen</p>}
                </>
              )}
            </div>
          </div>

          {/* Divider, not a nested card: a running meter while the room is in
              use, the next booking while it is free. */}
          {current ? (
            <div className="slot__foot slot__foot--with-qr">
              <div className="slot__countdown-wrap">
                <span className="eyebrow">Sisa waktu</span>
                <Countdown end={current.selesai} now={now} />
              </div>
              {current.id && (
                <div className="slot__qr-pass">
                  <div className="slot__qr-pass-code">
                    <QRCodeSVG
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/meeting/${current.id}`}
                      size={58}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#0f244f"
                      marginSize={1}
                    />
                  </div>
                  <div className="slot__qr-pass-label">
                    <span>Presensi Mandiri</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Tanpa QR presensi di sini: cabang ini berarti tidak ada rapat
               yang sedang berlangsung, dan QR check-in hanya boleh muncul
               selama jam yang diajukan. Sebelumnya QR rapat berikutnya sudah
               terpampang sejak pagi, sehingga peserta bisa presensi berjam-jam
               sebelum rapatnya dimulai. */
            <div className="slot__foot">
              <div className="slot__next-wrap">
                <span className="eyebrow">Booking berikutnya</span>
                {next ? (
                  <>
                    <strong>{next.mulai} – {next.selesai} WIB</strong>
                    <span className="slot__next">{next.tanggal} · {next.agenda}</span>
                  </>
                ) : (
                  <strong className="is-empty">Belum ada booking</strong>
                )}
              </div>
            </div>
          )}
        </div>

        <aside className="queue">
          <p className="eyebrow">Jadwal berikutnya</p>
          {queue.length ? (
            <ul>
              {queue.slice(0, 3).map((event, index) => (
                <li key={`${event.tanggal}-${event.mulai}-${index}`}>
                  <span className="queue__time">{event.mulai}</span>
                  <span className="queue__body">
                    <strong>{event.agenda}</strong>
                    <small>{event.tanggal} · {event.bagian}</small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="queue__empty">Tidak ada jadwal mendatang.</p>
          )}
        </aside>
      </div>

      <Timeline events={todayEvents} now={now} />
    </article>
  )
}

/* Laid out in columns rather than rows: the footer is wide and shallow, and
   five stacked lines would not fit beside the QR block. */
function PrayerTimes({ prayer, now }) {
  if (!prayer.jadwal.length) return <div className="prayer" />

  const minutesNow = now.hour() * 60 + now.minute()
  const nextIndex = prayer.jadwal.findIndex((item) => toMinutes(item.waktu) > minutesNow)

  return (
    <div className="prayer">
      <p className="eyebrow">
        <MosqueIcon className="icon" />
        Jadwal sholat{prayer.kota ? ` · ${prayer.kota}` : ''}
      </p>
      <ul>
        {prayer.jadwal.map((item, index) => (
          <li key={item.nama} className={index === nextIndex ? 'is-next' : undefined}>
            <span>{item.nama}</span>
            <strong>{item.waktu}</strong>
          </li>
        ))}
      </ul>
      {prayer.sumberLabel && <p className="prayer__source">Sumber: {prayer.sumberLabel}</p>}
    </div>
  )
}

/* --- board ------------------------------------------------------------- */

function DisplayPage() {
  const [today, setToday] = useState(EMPTY_DATA)
  const [upcoming, setUpcoming] = useState(EMPTY_DATA)
  const [yearSummary, setYearSummary] = useState(EMPTY_YEAR_SUMMARY)
  const [now, setNow] = useState(dayjs())
  const [prayer, setPrayer] = useState(EMPTY_PRAYER)
  const [lastSync, setLastSync] = useState(null)
  const [failures, setFailures] = useState(0)
  const [rekamRuang, setRekamRuang] = useState({})

  /* Ruangan yang sedang direkam perekam otomatis. Gagal = anggap tidak ada,
     papan tetap berjalan seperti biasa. */
  useEffect(() => {
    let batal = false
    const load = async () => {
      try {
        const res = await fetch('/api/perekam/status-ruang')
        const data = await res.json()
        if (!batal && data?.success) setRekamRuang(data.ruang || {})
      } catch {
        if (!batal) setRekamRuang({})
      }
    }
    load()
    const id = window.setInterval(load, 15_000)
    return () => { batal = true; window.clearInterval(id) }
  }, [])

  useEffect(() => {
    const load = async () => {
      let tData = { ...EMPTY_DATA }
      let uData = { ...EMPTY_DATA }
      let fetchedDashboardMeetings = []

      // 1. Fetch jadwal hari ini & mendatang dari backend
      try {
        const res = await axios.get('/api/events/today')
        if (res?.data) tData = { ...EMPTY_DATA, ...res.data }
      } catch (e) {}

      try {
        const res = await axios.get('/api/events/upcoming')
        if (res?.data) uData = { ...EMPTY_DATA, ...res.data }
      } catch (e) {}

      try {
        const res = await axios.get('/api/events/summary/year')
        if (res?.data) setYearSummary(res.data)
      } catch (e) {}

      // 2. Fetch rapat dari endpoint dashboard untuk sinkronisasi menyeluruh
      try {
        const res = await axios.get('/api/dashboard/meetings')
        if (Array.isArray(res?.data)) {
          fetchedDashboardMeetings = res.data
        }
      } catch (e) {
        try {
          const res = await axios.get('/api/dashboard/data')
          if (Array.isArray(res?.data?.meetings)) {
            fetchedDashboardMeetings = res.data.meetings
          }
        } catch (e2) {}
      }

      // 3. Gabungkan rapat lokal dari localStorage dan dashboard database
      try {
        /* Papan TV hanya boleh menampilkan data server. Dulu
           localStorage.app_meetings ikut digabung di sini, dan karena isi
           localStorage berbeda di tiap perangkat, URL yang sama menampilkan
           jadwal yang berbeda-beda: perangkat admin membawa seluruh daftar
           rapat yang ditulis dashboard ke localStorage, sedangkan perangkat
           user dan approval hanya membawa miliknya sendiri. */
        const combinedList = fetchedDashboardMeetings
        const todayIso = dayjs().format('YYYY-MM-DD')

        combinedList.forEach((m) => {
          if (!m || !m.date || !m.start || !m.end) return
          const sLower = String(m.status || '').toLowerCase().trim()
          const isPending = sLower.includes('menunggu') || sLower === 'pending'
          const isCancelled = sLower === 'dibatalkan' || sLower === 'ditolak' || sLower === 'rejected' || sLower.includes('batal')
          
          // Abaikan rapat yang belum disetujui (Menunggu Approval) atau dibatalkan dari Display TV
          if (isPending || isCancelled) {
            return
          }

          const rNorm = String(m.room || '').toLowerCase()
          const rKey = rNorm.includes('konsultasi') || rNorm === '2' ? 'ruangKonsultasi' : 'ruangRapatBesar'

          const mStart = dayjs(`${m.date}T${m.start}:00`)
          const mEnd = dayjs(`${m.date}T${m.end}:00`)
          const isNow = !dayjs().isBefore(mStart) && dayjs().isBefore(mEnd)
          const isDone = sLower === 'selesai' || sLower === 'available' || sLower === 'completed' || dayjs().isAfter(mEnd) || !!m.checkOutAt

          let evStatus = 'UPCOMING'
          if (isDone) {
            evStatus = 'AVAILABLE' // Selesai / Ruangan kembali tersedia
          } else if (isNow) {
            /* Hanya jam yang boleh menjadikannya IN_PROGRESS. Dulu status
               "Berjalan" dari database ikut dipakai, sehingga rapat yang belum
               dimulai ditandai sedang berlangsung — dan setelah papan berhenti
               mempercayai penanda itu, rapatnya malah hilang sama sekali:
               bukan "sedang digunakan", tapi juga tidak masuk daftar
               "Booking berikutnya" karena statusnya bukan UPCOMING. */
            evStatus = 'IN_PROGRESS'
          }

          const displayAgenda = m.title || m.agenda || 'Rapat'

          const ev = {
            id: m.googleId || String(m.id),
            originalMeetingId: String(m.id),
            agenda: displayAgenda,
            bagian: m.requester || m.bookedBy || '-',
            tanggal: m.date,
            tanggalIso: m.date,
            mulai: m.start,
            selesai: m.end,
            status: evStatus,
          }

          if (m.date === todayIso && tData[rKey]) {
            const list = tData[rKey]
            const idx = list.findIndex(
              (x) => String(x.id) === String(ev.id) || (x.tanggalIso === ev.tanggalIso && x.mulai === ev.mulai)
            )
            if (idx !== -1) list[idx] = { ...list[idx], ...ev }
            else list.push(ev)
          }

          // HANYA masukkan ke upcoming jika rapat belum selesai dan belum lewat
          if (m.date >= todayIso && uData[rKey] && !isDone && (evStatus === 'UPCOMING' || evStatus === 'IN_PROGRESS')) {
            const list = uData[rKey]
            const idx = list.findIndex(
              (x) => String(x.id) === String(ev.id) || (x.tanggalIso === ev.tanggalIso && x.mulai === ev.mulai)
            )
            if (idx !== -1) list[idx] = { ...list[idx], ...ev }
            else list.push(ev)
          }
        })

        ROOMS.forEach((r) => {
          if (tData[r.key]) {
            tData[r.key].sort((a, b) => (a.mulai || '').localeCompare(b.mulai || ''))
          }
          if (uData[r.key]) {
            // Bersihkan setiap rapat selesai dari uData agar tidak muncul di booking berikutnya
            uData[r.key] = uData[r.key].filter((ev) => {
              const s = String(ev.status || '').toLowerCase()
              if (s === 'available' || s === 'selesai' || s === 'completed') return false
              if (ev.tanggalIso && ev.selesai) {
                const endM = dayjs(`${ev.tanggalIso}T${ev.selesai}:00`)
                if (dayjs().isAfter(endM)) return false
              }
              return true
            })
            uData[r.key].sort((a, b) => {
              if (a.tanggalIso !== b.tanggalIso) return (a.tanggalIso || '').localeCompare(b.tanggalIso || '')
              return (a.mulai || '').localeCompare(b.mulai || '')
            })
          }
        })
      } catch (syncErr) {
        console.warn('Sync error:', syncErr)
      }

      setToday(tData)
      setUpcoming(uData)
      setLastSync(dayjs())
      setFailures(0)
    }

    load()
    // Polling setiap 4 detik agar jadwal rapat yang baru dipesan/disetujui/selesai langsung sinkron di display TV
    const id = window.setInterval(load, 4_000)

    const handleSync = () => load()
    const syncEvents = ['storage', 'meeting_approved', 'meeting_checkout', 'meeting_checkin', 'meeting_status_changed', 'app_meetings_updated', 'focus']
    syncEvents.forEach((ev) => window.addEventListener(ev, handleSync))

    return () => {
      window.clearInterval(id)
      syncEvents.forEach((ev) => window.removeEventListener(ev, handleSync))
    }
  }, [])

  /* Deliberately separate from the schedule poll: a prayer-times outage must
     not make the board report the meeting schedule as stale, and the times
     only change once a day so an hourly refresh is plenty. */
  useEffect(() => {
    const load = async () => {
      try {
        const response = await axios.get('/api/prayer/today')
        setPrayer({ ...EMPTY_PRAYER, ...response.data })
      } catch (loadError) {
        console.error(loadError)
      }
    }

    load()
    const id = window.setInterval(load, 3_600_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setNow(dayjs()), 1_000)
    return () => window.clearInterval(id)
  }, [])

  const allToday = useMemo(() => [...today.ruangRapatBesar, ...today.ruangKonsultasi], [today])
  const duration = allToday.reduce((total, event) => total + durationInMinutes(event), 0)
  const activeRooms = ROOMS.filter((room) => today[room.key].some((event) => event.status === 'IN_PROGRESS')).length
  const utilization = allToday.length ? Math.round((duration / (DAY_HOURS * 60 * ROOMS.length)) * 100) : 0

  return (
    <main className="display">
      <header className="topbar">
        <div className="brand">
          {/* Masked rather than <img>: this keeps the mark on --text, so it
              follows the palette instead of being baked to one colour. */}
          <span
            className="brand__mark"
            role="img"
            aria-label="Logo Kementerian Ketenagakerjaan"
            style={{ WebkitMaskImage: `url(${kemnakerLogo})`, maskImage: `url(${kemnakerLogo})` }}
          />
          <div>
            <strong>Kementerian Ketenagakerjaan</strong>
            <span>Biro Keuangan dan BMN · Kalender Ruang Rapat</span>
          </div>
        </div>
        <div className="clock">
          <span className="clock__date"><CalendarIcon className="icon" />{now.format('dddd, D MMMM YYYY')}</span>
          <strong className="clock__time">
            <Digits value={now.format('HH:mm')} />
            <small><Digits value={`:${now.format('ss')}`} /> WIB</small>
          </strong>
        </div>
      </header>

      {/* Only reported once a schedule has actually loaded: before that there
          is no "last known good" state worth talking about. */}
      {lastSync && failures > 0 && (failures < STALE_ALERT_AFTER ? (
        <p className="sync-note">
          <RefreshIcon className="icon" />
          Pembaruan jadwal tertunda · Data terakhir pukul {lastSync.format('HH:mm')}
        </p>
      ) : (
        <p className="notice">
          Jadwal tidak dapat diperbarui sejak pukul {lastSync.format('HH:mm')} — jadwal yang tampil mungkin sudah berubah.
        </p>
      ))}

      <section className="panels">
        {ROOMS.map((room) => (
          <RoomPanel
            key={room.key}
            room={room}
            todayEvents={today[room.key]}
            upcomingEvents={upcoming[room.key]}
            now={now}
            merekam={Object.entries(rekamRuang).some(([nama, aktif]) => aktif && nama.toLowerCase().replace(/\s+/g, '') === room.name.toLowerCase().replace(/\s+/g, ''))}
          />
        ))}
      </section>

      <footer className="footer">
        <PrayerTimes prayer={prayer} now={now} />

        <div className="booking">
          <div className="booking__qr">
            <QRCodeSVG value={BOOKING_URL} size={256} level="M" marginSize={2} bgColor="#f0eaee" fgColor="#0f244f" />
          </div>
          <div>
            <p className="eyebrow"><ScanIcon className="icon" />Pindai untuk booking</p>
            <a href={BOOKING_URL} target="_blank" rel="noreferrer">s.id/RokeuBmn</a>
          </div>
        </div>

        <div className="contact">
          <p className="eyebrow">Kontak dan Bantuan Booking</p>
          <ul>
            <li>
              <span className="contact__icon" style={{ color: '#90caf9' }}>A</span>
              <div className="contact__info contact__info--reversed">
                <span>Admin</span>
                <strong>SisKA</strong>
              </div>
            </li>
            <li>
              <span className="contact__icon"><IoLogoWhatsapp style={{ fontSize: '1.2em' }} /></span>
              <div className="contact__info">
                <strong>WhatsApp bantuan</strong>
                <span>+6285122777026</span>
              </div>
            </li>
          </ul>
        </div>
      </footer>

      <p className="notes">
        <span>BerAKHLAK · Bangga Melayani Bangsa</span>
        <span>Mohon menjaga kebersihan ruang rapat</span>
        <span>Matikan AC dan peralatan elektronik setelah digunakan</span>
        <Link to="/dashboard" style={{ color: 'inherit', textDecoration: 'none', opacity: 0.8 }}>
          ⚙️ Dashboard Admin
        </Link>
      </p>
    </main>
  )
}

export default DisplayPage
