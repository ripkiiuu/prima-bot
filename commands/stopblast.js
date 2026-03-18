// ============================================================
// commands/stopblast.js — Hentikan Broadcast yang Sedang Berjalan
// ============================================================

const config = require('../config');
const blastModule = require('./blast');

module.exports = {
  name: 'stopblast',
  description: 'Hentikan proses broadcast yang sedang berjalan (admin)',
  category: 'Admin',

  async execute(client, msg, args) {
    if (!config.ADMINS.includes(msg.from)) {
      return msg.reply('🔐 Hanya admin yang bisa menghentikan blast.');
    }

    // Panggil fungsi stop dari blast.js
    blastModule.stopBlast();

    await msg.reply('🛑 *Perintah stop dikirim!*\nBlast akan berhenti setelah pesan saat ini selesai terkirim.');
  },
};
