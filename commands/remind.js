const config = require('../config');
const scheduler = require('../scheduler');

module.exports = {
  name: 'remind',
  description: 'Membuat pengingat/alarm (Contoh: !remind 10m Rapat Tim)',
  execute: async (client, msg, args) => {
    if (args.length < 2) {
      return msg.reply(
        `❌ *Format Salah!*\n\nCoba format berikut:\n` +
        `- *${config.PREFIX}remind 10m Pemanasan*\n` +
        `- *${config.PREFIX}remind 2h Bikin tugas*\n` +
        `- *${config.PREFIX}remind 2026-03-24 10:00 Meeting*`
      );
    }

    const timeStr = args[0];
    const message = args.slice(1).join(' ');
    
    // Support if user uses format date "YYYY-MM-DD HH:mm" (2 args for time)
    let actualTimeStr = timeStr;
    let actualMessage = message;
    
    if (args.length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test(args[0]) && /^\d{2}:\d{2}$/.test(args[1])) {
       actualTimeStr = `${args[0]} ${args[1]}`;
       actualMessage = args.slice(2).join(' ');
    }

    const sender = msg.author || msg.from; // group uses author, private use from
    const chatId = msg.from;

    const result = scheduler.addReminder(chatId, sender, actualTimeStr, actualMessage);

    if (!result.success) {
      return msg.reply(`❌ Gagal menyetel pengingat:\n_${result.error}_`);
    }

    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    const dateStr = new Date(result.targetTime).toLocaleDateString('id-ID', dateOptions);

    await msg.reply(`✅ *Pengingat Berhasil Disetel!*\n\nBot akan mengingatkan Anda pada:\n🗓️ *${dateStr}*\n📝 *Pesan:* ${actualMessage}`);
  }
};
