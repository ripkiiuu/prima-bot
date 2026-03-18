// ============================================================
// commands/ping.js — Cek Response Time Bot
// ============================================================

const config = require('../config');

module.exports = {
  name: 'ping',
  description: 'Cek kecepatan respon bot',
  category: 'Utilitas',

  /**
   * Menghitung waktu antara pesan dikirim dan bot membalas.
   */
  async execute(client, msg, args) {
    // Catat waktu sebelum kirim balas
    const start = Date.now();

    // Kirim pesan sementara
    const reply = await msg.reply('🏓 Mengukur...');

    // Hitung selisih waktu
    const latency = Date.now() - start;

    // Edit pesan untuk menampilkan latency
    // (edit tidak tersedia di whatsapp-web.js, jadi hapus & kirim ulang)
    await reply.delete(true);
    await msg.reply(
      `🏓 *Pong!*\n\n` +
      `⚡ Latency  : *${latency} ms*\n` +
      `📡 Status   : *Online*\n` +
      `🕐 Waktu    : *${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB*` +
      config.FOOTER
    );
  },
};
