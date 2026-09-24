import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import dayjs from 'dayjs'
import 'dayjs/locale/id'
import { QRCodeSVG } from 'qrcode.react'
import { Link } from 'react-router-dom'
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

/* Testing aid. Forces one room to render the "in use + next booking" state
   from invented data, so that layout can be reviewed without waiting for a
   real meeting to start. A card fed by this always carries a DEMO badge.

   The demo does not merge with the calendar, it REPLACES that room's entire
   day: real bookings would go unseen and the footer totals would count
   invented meetings. So it must never reach the board in the hallway.

   Guarding it with import.meta.env.DEV makes that structural rather than a
   thing to remember. Vite substitutes the flag literally at build time, so
   in a production bundle this whole expression folds to null and demoEvents
   is dropped as dead code — 'npm run build' cannot emit the demo even if
   VITE_DEMO_ROOM is set in the environment.

   To switch it on locally, put this in frontend/.env.local (git-ignored):
     VITE_DEMO_ROOM=ruangKonsultasi        (or ruangRapatBesar) */
const DEMO_ROOM = import.meta.env.DEV ? import.meta.env.VITE_DEMO_ROOM || null : null

/* Times are fixed once at mount, not recomputed per render — otherwise they
   would slide forward every second and the countdown would never move. */
function demoEvents(mountedAt) {
  const at = (offsetMinutes) => mountedAt.add(offsetMinutes, 'minute').format('HH:mm')

  return {
    /* One event per timeline state, so all three cell colours are on screen
       at once. The finished and scheduled slots use fixed morning/evening
       hours (rather than offsets from now) so they stay inside the 08-20
       strip whatever time the board is opened. */
    today: [
      {
        agenda: 'Rapat Pembukaan Pelatihan Vokasi',
        bagian: 'Bagian Umum',
        tanggal: mountedAt.format('ddd, DD MMM'),
        mulai: '08:00',
        selesai: '09:30',
        status: 'AVAILABLE',   // selesai  -> abu
      },
      {
        agenda: 'Asesmen Calon Instruktur Pelatihan Nasional',
        bagian: 'Bagian Sumber Daya Manusia',
        tanggal: mountedAt.format('ddd, DD MMM'),
        mulai: at(-47),
        selesai: at(28),
        status: 'IN_PROGRESS', // berlangsung -> emas
      },
      {
        agenda: 'Koordinasi Teknis Balai Latihan Kerja (BBPVP)',
        bagian: 'Bagian Perencanaan dan Kerja Sama',
        tanggal: mountedAt.format('ddd, DD MMM'),
        mulai: '17:00',
        selesai: '19:00',
        status: 'UPCOMING',    // terjadwal -> biru
      },
    ],
    upcoming: [
      {
        agenda: 'Koordinasi Teknis Balai Latihan Kerja (BBPVP)',
        bagian: 'Bagian Perencanaan dan Kerja Sama',
        tanggal: mountedAt.format('ddd, DD MMM'),
        mulai: '17:00',
        selesai: '19:00',
        status: 'UPCOMING',
      },
      {
        agenda: 'Konsultasi Penyusunan RKA-KL Tahun Anggaran 2027',
        bagian: 'Bagian Akuntansi',
        tanggal: mountedAt.add(1, 'day').format('ddd, DD MMM'),
        mulai: '09:00',
        selesai: '11:00',
        status: 'UPCOMING',
      },
    ],
  }
}

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

function RoomPanel({ room, todayEvents, upcomingEvents, now, demo }) {
  const current = todayEvents.find((event) => event.status === 'IN_PROGRESS')
  const queue = upcomingEvents.filter((event) => event.status === 'UPCOMING')
  const next = queue[0]

  return (
    <article className={`room ${current ? 'is-busy' : 'is-free'}`}>
      <div className="room__head">
        <div className="room__title">
          <h2>{room.name}</h2>
          {demo && <span className="demo-badge">Data demo</span>}
        </div>
        <span className="status"><i />{current ? 'Sedang Digunakan' : 'Tersedia'}</span>
      </div>

      <div className="room__body">
        <div className="slot">
          <div className="slot__lead">
            <span className="slot__badge">{current ? <ClockIcon strokeWidth={2.2} /> : <CheckIcon />}</span>
            <div className="slot__headline">
              <p className="slot__state">{current ? 'Ruangan sedang digunakan' : 'Ruangan tersedia'}</p>
              <h3>{current ? current.agenda : 'Tidak ada jadwal rapat saat ini'}</h3>
              {current ? (
                <>
                  <p className="slot__pic">Dipimpin oleh: {current.bagian}</p>
                  <p className="slot__time"><ClockIcon className="icon" />{current.mulai} – {current.selesai} WIB</p>
                </>
              ) : null}
            </div>
          </div>

          {/* Divider, not a nested card: a running meter while the room is in
              use, the next booking while it is free. */}
          {current ? (
            <div className="slot__foot">
              <span className="eyebrow">Sisa waktu</span>
              <Countdown end={current.selesai} now={now} />
            </div>
          ) : (
            <div className="slot__foot">
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

  useEffect(() => {
    const load = async () => {
      try {
        const [todayResponse, upcomingResponse, yearResponse] = await Promise.all([
          axios.get('/api/events/today'),
          axios.get('/api/events/upcoming'),
          axios.get('/api/events/summary/year'),
        ])
        setToday({ ...EMPTY_DATA, ...todayResponse.data })
        setUpcoming({ ...EMPTY_DATA, ...upcomingResponse.data })
        setYearSummary(yearResponse.data)
        setLastSync(dayjs())
        setFailures(0)
      } catch (loadError) {
        console.error(loadError)
        setFailures((count) => count + 1)
      }
    }

    load()
    const id = window.setInterval(load, 60_000)
    return () => window.clearInterval(id)
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

  const [demo] = useState(() => (DEMO_ROOM ? demoEvents(dayjs()) : null))

  const shownToday = useMemo(
    () => (demo ? { ...today, [DEMO_ROOM]: demo.today } : today),
    [today, demo],
  )
  const shownUpcoming = useMemo(
    () => (demo ? { ...upcoming, [DEMO_ROOM]: demo.upcoming } : upcoming),
    [upcoming, demo],
  )

  const allToday = useMemo(() => [...shownToday.ruangRapatBesar, ...shownToday.ruangKonsultasi], [shownToday])
  const duration = allToday.reduce((total, event) => total + durationInMinutes(event), 0)
  const activeRooms = ROOMS.filter((room) => shownToday[room.key].some((event) => event.status === 'IN_PROGRESS')).length
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
            todayEvents={shownToday[room.key]}
            upcomingEvents={shownUpcoming[room.key]}
            now={now}
            demo={DEMO_ROOM === room.key}
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

        {/* Tallies — read deliberately, not at a glance, so one line each.
            "Ruang dipakai" is a live figure and belongs to today only; over a
            whole year it would be meaningless. */}
        <div className="recap">
          <div>
            <span className="eyebrow">Ringkasan hari ini</span>
            <p>
              <b>{allToday.length}</b> rapat · <b>{formatDuration(duration)}</b> durasi · <b>{activeRooms}/{ROOMS.length}</b> ruang · <b>{utilization}%</b> utilisasi
            </p>
          </div>
          <div>
            <span className="eyebrow">Ringkasan tahun {yearSummary.year} · s.d. {now.format('D MMM')}</span>
            <p>
              <b>{yearSummary.totalMeeting}</b> rapat · <b>{formatDuration(yearSummary.totalDurationMinutes)}</b> durasi · <b>{yearSummary.utilization}%</b> utilisasi
            </p>
          </div>
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
