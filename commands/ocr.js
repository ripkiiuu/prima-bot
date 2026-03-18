// ============================================================
// commands/ocr.js — Ambil Teks dari Gambar (OCR)
// ============================================================
// Cara pakai: Reply sebuah gambar dengan perintah /ocr
// API: OCR.space — https://ocr.space/ocrapi
//   → Gratis: 25.000 request/bulan
//   → API Key default 'helloworld' untuk testing
// ============================================================

const axios = require('axios');
const FormData = require('form-data');
const config = require('../config');

/**
 * Mengirim gambar ke OCR.space API dan mengembalikan teks hasil ekstraksi.
 * @param {string} base64Image - Data gambar dalam format base64
 * @param {string} mimeType - Tipe MIME gambar (image/jpeg, image/png, dll.)
 * @returns {Promise<string>} - Teks hasil OCR
 */
async function ekstrakTeks(base64Image, mimeType) {
  const form = new FormData();

  // Kirim gambar sebagai base64 (tanpa harus menyimpan ke disk)
  form.append('base64Image', `data:${mimeType};base64,${base64Image}`);
  form.append('language',    'ind');    // 'ind' = Bahasa Indonesia, 'eng' = Inggris
  form.append('isOverlayRequired', 'false');
  form.append('OCREngine',   '2');      // Engine 2 lebih akurat untuk teks modern
  form.append('apikey', config.OCR_API_KEY || 'helloworld');

  const response = await axios.post(
    'https://api.ocr.space/parse/image',
    form,
    {
      headers: form.getHeaders(),
      timeout: 20000,
    }
  );

  const data = response.data;

  // Periksa error dari API
  if (data.IsErroredOnProcessing) {
    throw new Error(data.ErrorMessage?.[0] || 'OCR gagal memproses gambar.');
  }

  // Gabungkan semua teks dari semua halaman
  const teks = data.ParsedResults
    ?.map(r => r.ParsedText)
    .join('\n')
    .trim();

  if (!teks) throw new Error('Tidak ada teks yang berhasil dideteksi pada gambar.');

  return teks;
}

module.exports = {
  name: 'ocr',
  description: '(Reply gambar) Ekstrak teks dari gambar (OCR)',
  category: 'AI & Edukasi',

  async execute(client, msg, args) {
    // Ambil pesan yang di-reply
    const quotedMsg = await msg.getQuotedMessage().catch(() => null);

    if (!quotedMsg || !quotedMsg.hasMedia) {
      return msg.reply(
        '❌ *Cara pakai:*\nReply sebuah *gambar* yang mengandung teks dengan perintah */ocr*'
      );
    }

    // Periksa apakah media adalah gambar
    const media = await quotedMsg.downloadMedia();
    if (!media || !media.mimetype.startsWith('image/')) {
      return msg.reply('❌ Hanya gambar yang dapat diproses. Pastikan Anda me-reply gambar.');
    }

    await msg.reply('🔍 *Sedang mengekstrak teks dari gambar...*');

    try {
      const teks = await ekstrakTeks(media.data, media.mimetype);

      // Batasi output agar tidak terlalu panjang (WA max ~65535 karakter)
      const output = teks.length > 3000
        ? teks.substring(0, 3000) + '\n\n_[...teks terpotong, terlalu panjang]_'
        : teks;

      await msg.reply(
        `📄 *Hasil OCR:*\n\n${output}` + config.FOOTER
      );
    } catch (err) {
      console.error('[ocr] Error:', err.message);
      await msg.reply(`❌ Gagal mengekstrak teks: ${err.message}`);
    }
  },
};
