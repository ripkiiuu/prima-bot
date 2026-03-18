// ============================================================
// commands/kbbi.js — Cari Arti Kata di KBBI
// ============================================================
// KBBI via kbbi.web.id (mirror populer, DNS lebih reliable)
// + fallback scrape kbbi.id
// Domain kbbi.kemdikbud.go.id sering tidak bisa diakses (ENOTFOUND)
// ============================================================

const axios  = require('axios');
const config = require('../config');

/**
 * Scrape definisi dari kbbi.web.id — mirror KBBI paling populer & stabil
 * @param {string} kata
 * @returns {Promise<{makna: string, kelas?: string, contoh?: string}[]>}
 */
async function scrapeKBBIWeb(kata) {
  const url = `https://kbbi.web.id/${encodeURIComponent(kata)}`;

  const res = await axios.get(url, {
    timeout: 12000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html',
    },
  });

  const html = res.data;

  // Cek apakah kata ada
  if (html.includes('Entri tidak ditemukan') || html.includes('tidak ditemukan')) {
    throw new Error(`not_found`);
  }

  // Ambil semua <li> di dalam <ol> — ini adalah daftar definisi
  const olMatch = html.match(/<ol[^>]*>([\s\S]*?)<\/ol>/i);
  if (!olMatch) throw new Error('Format halaman berubah');

  const liItems = [...olMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
  if (!liItems.length) throw new Error('Tidak ada definisi ditemukan');

  return liItems.map((m, i) => {
    const raw = m[1];

    // Ambil kelas kata dari dalam <span class="kelas"><abbr title="...">...</abbr></span>
    const kelasMatch = raw.match(/<abbr[^>]*title="([^"]+)"[^>]*>/i);
    const kelas = kelasMatch ? kelasMatch[1] : '';

    // Bersihkan HTML tag dari definisi
    const makna = raw
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"')
      .replace(/\s{2,}/g, ' ').trim();

    return { index: i + 1, kelas, makna };
  });
}

/**
 * Fallback: Scrape dari kbbi.id
 * @param {string} kata
 */
async function scrapeKBBIId(kata) {
  const url = `https://kbbi.id/arti-kata/${encodeURIComponent(kata)}`;

  const res = await axios.get(url, {
    timeout: 12000,
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' },
  });

  const html = res.data;
  if (html.includes('tidak ditemukan') || html.includes('404')) throw new Error('not_found');

  // Ambil konten dari <div class="arti">
  const matches = [...html.matchAll(/<li[^>]*>\s*<b>([^<]*)<\/b>\s*([\s\S]*?)<\/li>/gi)];
  if (!matches.length) throw new Error('Format kbbi.id berubah');

  return matches.map((m, i) => ({
    index: i + 1,
    kelas: m[1].trim(),
    makna: m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  }));
}

module.exports = {
  name: 'kbbi',
  description: '[kata] Cari arti kata di Kamus Besar Bahasa Indonesia',
  category: 'AI & Edukasi',

  async execute(client, msg, args) {
    const kata = args.join(' ').trim().toLowerCase();

    if (!kata) {
      return msg.reply(`❌ *Cara pakai:* /kbbi [kata]\nContoh: /kbbi rekursif`);
    }

    await msg.reply(`📖 Mencari *"${kata}"* di KBBI...`);

    let hasil;
    let sumber;

    // 1. Coba kbbi.web.id
    try {
      hasil  = await scrapeKBBIWeb(kata);
      sumber = 'kbbi.web.id';
    } catch (e1) {
      if (e1.message === 'not_found') {
        return msg.reply(`❌ Kata *"${kata}"* tidak ditemukan di KBBI.\nPeriksa ejaan lalu coba lagi.`);
      }
      console.log(`[kbbi] kbbi.web.id gagal: ${e1.message}, mencoba kbbi.id...`);

      // 2. Fallback kbbi.id
      try {
        hasil  = await scrapeKBBIId(kata);
        sumber = 'kbbi.id';
      } catch (e2) {
        if (e2.message === 'not_found') {
          return msg.reply(`❌ Kata *"${kata}"* tidak ditemukan di KBBI.`);
        }
        console.error('[kbbi] Semua sumber gagal:', e1.message, e2.message);
        return msg.reply(
          `❌ *Gagal mengakses KBBI.*\n\n` +
          `Kemungkinan koneksi internet bermasalah atau server KBBI down.\n` +
          `Coba lagi dalam beberapa menit.`
        );
      }
    }

    // Format output
    let teks = `📖 *KBBI — "${kata.toUpperCase()}"*\n${'─'.repeat(28)}\n\n`;

    hasil.slice(0, 8).forEach(e => {
      teks += `*${e.index}.* `;
      if (e.kelas) teks += `_[${e.kelas}]_ `;
      teks += `${e.makna}\n\n`;
    });

    teks += `_Sumber: ${sumber}_` + config.FOOTER;
    await msg.reply(teks);
  },
};
