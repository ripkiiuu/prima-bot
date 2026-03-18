// ============================================================
// commands/tiktok.js — Download TikTok Tanpa Watermark
// ============================================================
// Cara pakai: /tiktok [link video TikTok]
//
// API yang digunakan: TikWM (gratis, tanpa API key)
//   → https://www.tikwm.com/api/ — stabil dan populer
//   → Mendukung video tanpa watermark & slide/foto
// ============================================================

const axios = require('axios');
const { MessageMedia } = require('whatsapp-web.js');
const config = require('../config');

/**
 * Mengambil data video TikTok via TikWM API (gratis, tanpa API key)
 * @param {string} url - URL video TikTok
 * @returns {Promise<Object>} - Data video termasuk URL tanpa watermark
 */
async function getTikTokData(url) {
  const response = await axios.post(
    'https://www.tikwm.com/api/',
    new URLSearchParams({ url, hd: 1 }),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 20000,
    }
  );

  const data = response.data;

  if (!data || data.code !== 0) {
    throw new Error(data?.msg || 'Gagal mengambil data dari TikWM API');
  }

  return data.data;
}

module.exports = {
  name: 'tiktok',
  description: '[link] Download video TikTok tanpa watermark',
  category: 'Media & Stiker',

  async execute(client, msg, args) {
    const url = args[0]?.trim();

    if (!url || !url.includes('tiktok.com')) {
      return msg.reply(
        `❌ *Cara pakai:* /tiktok [link TikTok]\n\n` +
        `Contoh: /tiktok https://www.tiktok.com/@user/video/xxxxxx`
      );
    }

    await msg.reply('⏬ *Mengunduh video TikTok...*\n_Harap tunggu sebentar..._');

    try {
      const data = await getTikTokData(url);

      // Info video
      const judul    = data.title   || 'TikTok Video';
      const durasi   = data.duration ? `${data.duration}s` : '-';
      const author   = data.author?.nickname || 'Unknown';

      // URL video tanpa watermark (preview = no watermark, play = dengan watermark)
      const videoUrl = data.play;           // Tanpa watermark
      // const videoHD  = data.hdplay;      // HD version (lebih lambat)

      // Download video langsung dari URL
      const videoRes = await axios.get(videoUrl, {
        responseType: 'arraybuffer',
        timeout: 60000,  // Video bisa ukuran besar
        headers: {
          // Beberapa server butuh referer agar tidak 403
          'Referer': 'https://www.tiktok.com/',
        },
      });

      const media = new MessageMedia(
        'video/mp4',
        Buffer.from(videoRes.data).toString('base64'),
        `tiktok-${Date.now()}.mp4`
      );

      await client.sendMessage(msg.from, media, {
        caption:
          `✅ *TikTok Downloaded!*\n\n` +
          `👤 Creator : @${author}\n` +
          `🎬 Durasi  : ${durasi}\n` +
          `📝 Judul   : ${judul.substring(0, 100)}` +
          config.FOOTER,
      });

    } catch (err) {
      console.error('[tiktok] Error:', err.message);
      await msg.reply(
        `❌ Gagal mengunduh video TikTok.\n\n` +
        `Kemungkinan penyebab:\n` +
        `• Link salah atau video dihapus\n` +
        `• Video dari akun privat\n\n` +
        `_${err.message}_`
      );
    }
  },
};
