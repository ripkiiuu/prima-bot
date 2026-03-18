// ============================================================
// commands/cuaca.js — Cek Cuaca Hari Ini
// ============================================================
// Cara pakai:
//   /cuaca [nama kota]          → cari berdasarkan nama
//   /cuaca [lat,lon]            → cari berdasarkan koordinat GPS
//   Contoh: /cuaca -8.65,116.32  (koordinat Mataram, NTB)
// ============================================================

const axios = require('axios');
const config = require('../config');

const CUACA_EMOJI = {
  'Clear'        : '☀️',
  'Clouds'       : '☁️',
  'Rain'         : '🌧️',
  'Drizzle'      : '🌦️',
  'Thunderstorm' : '⛈️',
  'Snow'         : '❄️',
  'Mist'         : '🌫️',
  'Fog'          : '🌫️',
  'Haze'         : '🌫️',
  'Smoke'        : '💨',
  'Dust'         : '🌪️',
  'Sand'         : '🌪️',
  'Tornado'      : '🌪️',
};

const SARAN_KOMENTAR = {
  'Clear'        : 'Cerah banget! Cocok buat aktivitas di luar. ☀️',
  'Clouds'       : 'Mendung, tapi belum hujan. Tetap siap payung ya!',
  'Rain'         : 'Hujan nih, jangan lupa bawa payung/jas hujan! 🌂',
  'Drizzle'      : 'Gerimis kecil. Hati-hati licin di jalan.',
  'Thunderstorm' : 'Ada petir! Sebaiknya tetap di dalam ruangan dulu. ⚡',
  'Mist'         : 'Kabut tipis. Hati-hati kalau berkendara, visibilitas terbatas.',
  'Fog'          : 'Berkabut tebal! Nyalakan lampu kendaraan dan jalan pelan.',
  'Haze'         : 'Ada kabut asap. Kalau punya masalah pernapasan, pakai masker.',
};

// Konversi kecepatan angin → deskripsi
function deskripsiAngin(kmh) {
  if (kmh < 5)  return 'Tenang';
  if (kmh < 20) return 'Sepoi-sepoi';
  if (kmh < 40) return 'Cukup kencang';
  if (kmh < 60) return 'Kencang';
  return 'Sangat kencang ⚠️';
}

// Konversi kelembapan → deskripsi
function deskripsiKelembapan(pct) {
  if (pct < 40) return 'Kering';
  if (pct < 60) return 'Normal';
  if (pct < 80) return 'Lembap';
  return 'Sangat lembap';
}

/**
 * Deteksi apakah input adalah koordinat "lat,lon"
 */
function parseKoordinat(input) {
  const match = input.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  return { lat: parseFloat(match[1]), lon: parseFloat(match[2]) };
}

async function getCuaca(query) {
  if (!config.OPENWEATHER_API_KEY) {
    throw new Error('OPENWEATHER_API_KEY belum diset di .env');
  }

  const BASE = 'https://api.openweathermap.org/data/2.5/weather';
  const coords = parseKoordinat(query);

  const params = coords
    ? { lat: coords.lat, lon: coords.lon, appid: config.OPENWEATHER_API_KEY, units: 'metric', lang: 'id' }
    : { q: query,        appid: config.OPENWEATHER_API_KEY, units: 'metric', lang: 'id' };

  const response = await axios.get(BASE, { params, timeout: 10000 });
  const data = response.data;

  const anginKmh   = Math.round(data.wind.speed * 3.6);
  const terbit     = new Date(data.sys.sunrise * 1000).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
  const terbenam   = new Date(data.sys.sunset  * 1000).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
  const kondisi    = data.weather[0].main;

  return {
    kota       : data.name || '(Lokasi tidak bernama)',
    negara     : data.sys.country,
    lat        : data.coord.lat.toFixed(4),
    lon        : data.coord.lon.toFixed(4),
    suhu       : Math.round(data.main.temp),
    feels_like : Math.round(data.main.feels_like),
    suhu_min   : Math.round(data.main.temp_min),
    suhu_max   : Math.round(data.main.temp_max),
    kondisi,
    deskripsi  : data.weather[0].description,
    kelembapan : data.main.humidity,
    anginKmh,
    arahAngin  : data.wind.deg ?? null,
    visibilitas: data.visibility != null ? (data.visibility / 1000).toFixed(1) : '?',
    tekanan    : data.main.pressure,
    terbit,
    terbenam,
    saran      : SARAN_KOMENTAR[kondisi] || '',
  };
}

module.exports = {
  name: 'cuaca',
  description: '[kota / lat,lon] Cek cuaca terkini',
  category: 'Utilitas',

  async execute(client, msg, args) {
    const query = args.join(' ').trim();

    if (!query) {
      return msg.reply(
        `❌ *Cara pakai:*\n` +
        `/cuaca Jakarta\n` +
        `/cuaca Praya\n` +
        `/cuaca -8.65,116.32  ← pakai koordinat GPS\n\n` +
        `💡 Tip: kalau namanya kurang dikenal, pakai nama kabupaten terdekat.`
      );
    }

    try {
      const c = await getCuaca(query);
      const emoji     = CUACA_EMOJI[c.kondisi] || '🌡️';
      const dAngin    = deskripsiAngin(c.anginKmh);
      const dLembap   = deskripsiKelembapan(c.kelembapan);

      let teks =
        `${emoji} *Cuaca di ${c.kota}, ${c.negara}*\n` +
        `📍 Koordinat: ${c.lat}, ${c.lon}\n\n` +
        `🌤  *Kondisi  :* ${c.deskripsi}\n` +
        `🌡  *Suhu     :* ${c.suhu}°C (terasa ${c.feels_like}°C)\n` +
        `🔼  *Min/Max  :* ${c.suhu_min}°C / ${c.suhu_max}°C\n` +
        `💧 *Kelembapan:* ${c.kelembapan}% — ${dLembap}\n` +
        `💨 *Angin     :* ${c.anginKmh} km/h — ${dAngin}\n` +
        `👁  *Visibil. :* ${c.visibilitas} km\n` +
        `🅿  *Tekanan  :* ${c.tekanan} hPa\n\n` +
        `🌅 Matahari terbit  : ${c.terbit} WIB\n` +
        `🌇 Matahari terbenam: ${c.terbenam} WIB`;

      if (c.saran) {
        teks += `\n\n💬 _${c.saran}_`;
      }

      teks += config.FOOTER;
      await msg.reply(teks);

    } catch (err) {
      if (err.response?.status === 404) {
        await msg.reply(
          `❌ Lokasi *"${query}"* tidak ditemukan.\n\n` +
          `💡 Coba gunakan:\n• Nama kota/kabupaten terdekat\n• Koordinat GPS: /cuaca -8.65,116.32`
        );
      } else {
        console.error('[cuaca] Error:', err.message);
        await msg.reply(`❌ Gagal mendapatkan data cuaca: ${err.message}`);
      }
    }
  },
};
