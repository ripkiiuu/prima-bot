// ============================================================
// commands/ig.js — Download Video/Foto Instagram
// ============================================================
// Menggunakan SaveIG API (gratis, tanpa API key)
// Fallback: SnapInsta-style API gratis
// ============================================================

const axios        = require('axios');
const { MessageMedia } = require('whatsapp-web.js');
const config       = require('../config');

/**
 * Ambil URL media dari Instagram menggunakan API SaveIG (gratis)
 * @param {string} url - URL postingan Instagram
 * @returns {Promise<{type: string, url: string}[]>}
 */
async function getIGMedia(url) {
  // Bersihkan URL dari tracking parameter
  const cleanUrl = url.split('?')[0].replace(/\/$/, '') + '/';

  // Coba beberapa endpoint gratis (fallback satu ke satu)
  const apis = [
    // API 1: SaveIG melalui form POST
    async () => {
      const res = await axios.post(
        'https://v3.saveig.app/api/ajaxSearch',
        new URLSearchParams({ q: cleanUrl, t: 'media', lang: 'en' }),
        {
          headers: {
            'Content-Type' : 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest',
            'Origin'  : 'https://saveig.app',
            'Referer' : 'https://saveig.app/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          timeout: 15000,
        }
      );

      // Parse HTML response untuk ambil link
      const html   = res.data?.data || '';
      const links  = [];
      const regex  = /href="(https:\/\/[^"]+\.(mp4|jpg|jpeg|png|webp)[^"]*)"/gi;
      let match;
      while ((match = regex.exec(html)) !== null) {
        const mediaUrl = match[1];
        const ext = match[2].toLowerCase();
        links.push({ type: ext === 'mp4' ? 'video' : 'image', url: mediaUrl });
      }
      if (!links.length) throw new Error('Tidak ada media ditemukan di respons SaveIG');
      return links;
    },

    // API 2: SnapInsta gratis
    async () => {
      const res = await axios.post(
        'https://snapinsta.app/action.php',
        new URLSearchParams({ url: cleanUrl }),
        {
          headers: {
            'Content-Type'   : 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest',
            'Origin'  : 'https://snapinsta.app',
            'Referer' : 'https://snapinsta.app/',
            'User-Agent': 'Mozilla/5.0',
          },
          timeout: 15000,
        }
      );

      const html  = res.data || '';
      const links = [];
      const re    = /href="(https:\/\/[^"]+\.(mp4|jpg|jpeg|png)[^"]*)"/gi;
      let m;
      while ((m = re.exec(html)) !== null) {
        links.push({ type: m[2] === 'mp4' ? 'video' : 'image', url: m[1] });
      }
      if (!links.length) throw new Error('Tidak ada media ditemukan di SnapInsta');
      return links;
    },
  ];

  let lastErr;
  for (const api of apis) {
    try {
      return await api();
    } catch (e) {
      lastErr = e;
      console.log(`[ig] API gagal: ${e.message}, mencoba berikutnya...`);
    }
  }

  throw new Error(
    `Semua downloader IG gagal: ${lastErr?.message}\n` +
    `Kemungkinan: akun privat, link salah, atau server sedang down.`
  );
}

module.exports = {
  name: 'ig',
  description: '[link] Download video/foto dari Instagram (gratis)',
  category: 'Media & Stiker',

  async execute(client, msg, args) {
    const url = args[0]?.trim();

    if (!url || !url.includes('instagram.com')) {
      return msg.reply(
        `❌ *Cara pakai:* /ig [link Instagram]\n\n` +
        `Contoh: /ig https://www.instagram.com/p/xxxxx/`
      );
    }

    await msg.reply('📸 *Mengunduh dari Instagram...*\n⏳ Mohon tunggu...');

    try {
      const medias = await getIGMedia(url);
      const limit  = Math.min(medias.length, 5); // Maks 5 file

      for (let i = 0; i < limit; i++) {
        const item = medias[i];

        const imgRes = await axios.get(item.url, {
          responseType: 'arraybuffer',
          timeout: 30000,
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Referer'   : 'https://www.instagram.com/',
          },
        });

        const mime = item.type === 'video' ? 'video/mp4' : 'image/jpeg';
        const ext  = item.type === 'video' ? 'mp4' : 'jpg';

        const media = new MessageMedia(
          mime,
          Buffer.from(imgRes.data).toString('base64'),
          `ig-${Date.now()}-${i}.${ext}`
        );

        const isLast = i === limit - 1;
        await client.sendMessage(msg.from, media, {
          caption: isLast
            ? `✅ *Download selesai!* (${limit} file)` + config.FOOTER
            : `📁 File ${i + 1}/${limit}`,
        });

        if (!isLast) await new Promise(r => setTimeout(r, 1500));
      }

    } catch (err) {
      console.error('[ig] Error:', err.message);
      await msg.reply(
        `❌ Gagal mengunduh dari Instagram.\n\n` +
        `_${err.message}_`
      );
    }
  },
};
