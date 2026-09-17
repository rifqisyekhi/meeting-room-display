const DEFAULT_TIME_ZONE = "Asia/Jakarta";

/* Sumber: equran.id. Satu permintaan mengembalikan jadwal SEBULAN, jadi papan
   yang menyala 24/7 hanya perlu memanggil API sekali per bulan alih-alih
   sekali per hari. Parameternya berupa nama wilayah yang stabil dan deskriptif
   ("DKI Jakarta" / "Kota Jakarta"), bukan token terenkripsi yang kedaluwarsa
   seperti pada scraper situs Kemenag.

   Angkanya mengikuti jadwal resmi Kemenag, termasuk ihtiyat (waktu pengaman) —
   terbukti identik dengan sumber Kemenag lain yang sempat dipakai. Tersedia
   untuk 517 kabupaten/kota, dan tahun berikutnya sudah terisi. */
const ENDPOINT = "https://equran.id/api/v2/shalat";
const DEFAULT_PROVINCE = "DKI Jakarta";
const DEFAULT_CITY = "Kota Jakarta";

const PRAYERS = [
  { id: "subuh", nama: "Subuh" },
  { id: "dzuhur", nama: "Zuhur" },
  { id: "ashar", nama: "Asar" },
  { id: "maghrib", nama: "Magrib" },
  { id: "isya", nama: "Isya" },
];

/* monthly menyimpan hasil satu bulan; daily menyimpan hasil olahan untuk
   tanggal yang sedang tampil. Karena hanya ada satu sumber, daily sekaligus
   menjadi jaring pengaman: bila API tak bisa dihubungi, papan menampilkan
   jadwal terakhir yang diketahui — bergeser hanya satu dua menit per hari,
   jadi jauh lebih berguna daripada panel kosong. */
let monthly = null;
let daily = null;

function localDate(timeZone, date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function cleanTime(value = "") {
  return (String(value).match(/^(\d{1,2}:\d{2})/) || [])[1] || "";
}

async function fetchMonth({ province, city, date }) {
  const [year, month] = date.split("-").map(Number);

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provinsi: province, kabkota: city, bulan: month, tahun: year }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`equran.id responded ${response.status}`);

  const body = await response.json();
  if (body.code !== 200 || !Array.isArray(body.data?.jadwal)) {
    throw new Error("equran.id returned an unexpected payload");
  }
  return body.data;
}

function pickDay(month, date) {
  const day = month.jadwal.find((item) => item.tanggal_lengkap === date);
  if (!day) throw new Error(`equran.id has no entry for ${date}`);

  return {
    sumberLabel: "Jadwal resmi Kemenag RI · equran.id",
    kota: month.kabkota || "",
    daerah: month.provinsi || "",
    tanggal: `${day.hari}, ${day.tanggal_lengkap}`,
    jadwal: PRAYERS.map(({ id, nama }) => ({ nama, waktu: cleanTime(day[id]) }))
      .filter((item) => item.waktu),
  };
}

async function getPrayerTimes(options = {}) {
  const timeZone = options.timeZone || process.env.CALENDAR_TIME_ZONE || DEFAULT_TIME_ZONE;
  const province = options.province || process.env.PRAYER_PROVINCE || DEFAULT_PROVINCE;
  const city = options.city || process.env.PRAYER_CITY || DEFAULT_CITY;

  const date = localDate(timeZone, options.now);
  const dayKey = `${date}|${province}|${city}`;
  const monthKey = `${date.slice(0, 7)}|${province}|${city}`;

  if (daily && daily.key === dayKey) return daily.payload;

  /* Bulan yang sama sudah diunduh: cukup ambil tanggalnya, tanpa jaringan. */
  if (monthly && monthly.key === monthKey) {
    try {
      const payload = pickDay(monthly.data, date);
      daily = { key: dayKey, payload };
      return payload;
    } catch (error) {
      console.warn("Cached month has no entry for today:", error.message);
    }
  }

  try {
    const data = await fetchMonth({ province, city, date });
    monthly = { key: monthKey, data };
    const payload = pickDay(data, date);
    daily = { key: dayKey, payload };
    return payload;
  } catch (error) {
    if (daily) {
      console.warn("Prayer schedule refresh failed, serving cached schedule:", error.message);
      return daily.payload;
    }
    throw error;
  }
}

module.exports = { PRAYERS, cleanTime, getPrayerTimes };
