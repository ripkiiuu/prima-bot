// ============================================================
// commands/toqr.js — Teks ke QR Code
// ============================================================
// Cara pakai: /toqr [teks/link]
// Mengubah teks atau link apa saja menjadi gambar QR Code
// ============================================================

const axios = require('axios');
const { MessageMedia } = require('whatsapp-web.js');
const config = require('../config');

module.exports = {
  name: 'toqr',
  description: '[teks/link] Mengubah teks menjadi QR Code',
  category: 'Utilitas',

  async execute(client, msg, args) {
    const teks = args.join(' ').trim();

    if (!teks) {
      return msg.reply(
        `❌ *Format Salah!*\n\n` +
        `Cara pakai: /toqr [teks atau link]\n\n` +
        `Contoh:\n` +
        `/toqr https://google.com\n` +
        `/toqr Halo, namaku Budi`
      );
    }
    
    // Batasan aman panjang teks untuk QR code (bisa ribuan, tapi 500 sudah sangat cukup)
    if (teks.length > 500) {
      return msg.reply('❌ Teks terlalu panjang! Maksimal 500 karakter untuk QR Code.');
    }

    try {
      // Menggunakan free API QR Server yang stabil
      const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&margin=10&data=${encodeURIComponent(teks)}`;
      
      const res = await axios.get(apiUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(res.data);

      const media = new MessageMedia(
        'image/png',
        imageBuffer.toString('base64'),
        `qrcode-${Date.now()}.png`
      );

      await client.sendMessage(msg.from, media, {
        caption: `✅ **QR Code Berhasil Dibuat!**\n\nIsi: _${teks}_` + config.FOOTER,
      });

    } catch (err) {
      console.error('[toqr] Error:', err.message);
      await msg.reply(`❌ Gagal membuat QR Code.\n_${err.message}_`);
    }
  },
};
