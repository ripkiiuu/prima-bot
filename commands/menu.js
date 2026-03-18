// ============================================================
// commands/menu.js — Tampilkan Semua Perintah
// ============================================================

const config = require('../config');
const { MessageMedia } = require('whatsapp-web.js');

module.exports = {
  name: 'menu',
  description: 'Tampilkan daftar semua perintah bot',
  category: 'Utilitas',

  /**
   * Mengirim daftar menu yang estetik ke pengguna.
   * @param {import('whatsapp-web.js').Client} client
   * @param {import('whatsapp-web.js').Message} msg
   * @param {string[]} args - Tidak digunakan
   * @param {Map} commands - Map seluruh command yang dimuat
   */
  async execute(client, msg, args, commands) {
    // Ambil info pengirim (nama kontak jika tersedia)
    const contact = await msg.getContact();
    const senderName = contact.pushname || contact.name || 'Pengguna';

    // Kelompokkan command berdasarkan category
    const categories = {};
    for (const [, cmd] of commands) {
      const cat = cmd.category || 'Lainnya';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(cmd);
    }

    // ─── Ikon per kategori ───────────────────────────────
    const categoryIcons = {
      'AI & Edukasi'  : '🤖',
      'Media & Stiker': '🎨',
      'Utilitas'      : '⚙️',
      'Admin'         : '🔐',
      'Lainnya'       : '📦',
    };

    // ─── Bangun teks menu ────────────────────────────────
    let menuText = `= ${config.BOT_NAME} =\n\n`;
    menuText    += `Daftar Menu :\n\n`;

    for (const [category, cmds] of Object.entries(categories)) {
      menuText += `*${category.toUpperCase()}*\n`;
      for (const cmd of cmds) {
        // Membersihkan kurung siku [args] dari deskripsi agar tampilan persis seperti contoh
        // Contoh: "[teks] Ubah teks jadi suara" -> "Ubah teks jadi suara"
        const cleanDesc = cmd.description.replace(/^\[.*?\]\s*/, '');
        menuText += `${config.PREFIX}${cmd.name} untuk ${cleanDesc.toLowerCase()}\n`;
      }
      menuText += '\n'; // 1 spasi pemisah antar kategori
    }

    menuText += config.FOOTER;

    await msg.reply(menuText);
  },
};
