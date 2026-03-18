// ============================================================
// commands/suit.js — Game Batu Gunting Kertas
// ============================================================
// Cara pakai: /suit [batu/gunting/kertas]
// ============================================================

const config = require('../config');

// Kamus pilihan untuk mempermudah perbandingan
const choices = {
  'batu': { emoji: '✊', beats: 'gunting' },
  'gunting': { emoji: '✌️', beats: 'kertas' },
  'kertas': { emoji: '✋', beats: 'batu' }
};

module.exports = {
  name: 'suit',
  description: '[batu/gunting/kertas] Main suit melawan bot',
  category: 'Game',

  async execute(client, msg, args) {
    if (args.length === 0) {
      return msg.reply(
        `🎮 *Game Suit (Batu Gunting Kertas)*\n\n` +
        `❌ *Cara Main:* Kamu harus memilih salah satu!\n` +
        `Ketik: \`/suit batu\`, \`/suit gunting\`, atau \`/suit kertas\`\n\n` +
        `Ayo buktikan kalau kamu bisa mengalahkan Bot! 😎`
      );
    }

    const playerChoice = args[0].toLowerCase();

    // Validasi input
    if (!choices[playerChoice]) {
      return msg.reply(
        `🤷 Pilihlah dengan benar!\n` +
        `Hanya bisa: *batu*, *gunting*, atau *kertas*.\n\n` +
        `Contoh: /suit batu`
      );
    }

    // Bot memilih secara acak
    const botOptions = Object.keys(choices);
    const botChoice = botOptions[Math.floor(Math.random() * botOptions.length)];

    let result = '';
    let emojiResult = '';

    // Logika penentuan pemenang
    if (playerChoice === botChoice) {
      result = 'SERI! 🤝';
      emojiResult = 'Sama-sama kuat... Ayo tanding ulang!';
    } else if (choices[playerChoice].beats === botChoice) {
      result = 'KAMU MENANG! 🎉';
      emojiResult = 'Hebat banget, bot mengaku kalah 🙇‍♂️';
    } else {
      result = 'BOT MENANG! 🤖';
      emojiResult = 'Hahaha, bot tidak terkalahkan! Coba lagi kalau berani 😈';
    }

    // Susun pesan balasan stat
    const balasan = 
      `🎮 *HASIL PERTANDINGAN SUIT*\n\n` +
      `👤 Kamu: ${playerChoice.toUpperCase()} ${choices[playerChoice].emoji}\n` +
      `🤖 Bot : ${botChoice.toUpperCase()} ${choices[botChoice].emoji}\n\n` +
      `⚖️ *Hasil:* ${result}\n` +
      `_${emojiResult}_` + config.FOOTER;

    await msg.reply(balasan);
  },
};
