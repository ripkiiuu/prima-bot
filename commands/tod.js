// ============================================================
// commands/tod.js — Game Truth or Dare (Tantangan)
// ============================================================
// Cara pakai: /tod, /truth, /dare
// ============================================================

const config = require('../config');

// Kumpulan pertanyaan Truth kocak dan mendalam
const listTruth = [
  "Apa rahasia terbesar yang belum pernah kamu ceritakan ke siapapun?",
  "Siapa orang yang terakhir kali kamu kepoin media sosialnya diam-diam?",
  "Pernah gak sih nangis gara-gara hal sepele pas lagi galau? Ceritain!",
  "Kalau kamu bisa bertukar tubuh dengan satu orang di grup ini selama sehari, kamu milih siapa dan kenapa?",
  "Berapa banyak mantan yang masih sering ngechat kamu diem-diem?",
  "Apa hal paling memalukan yang pernah kamu lakuin di depan gebetan/pacar?",
  "Siapa orang yang paling sering bikin kamu badmood akhir-akhir ini?",
  "Sebutkan satu kebohongan terbesar yang pernah kamu ucapkan ke orang tuamu!",
  "Pernah nggak kamu naksir pacar temen sendiri? Jujur!",
  "Apa hal paling konyol yang pernah kamu lakuin buat narik perhatian crush?"
];

// Kumpulan tantangan Dare seru dan usil
const listDare = [
  "Chat mantan atau crush kamu sekarang, bilang 'Aku kangen' lalu SS kirim ke grup/sini!",
  "Buat VN (Voice Note) nyanyi lagu balonku ada lima tapi liriknya diganti huruf 'O' semua selama 15 detik!",
  "Pakai foto aib temanmu sebagai foto profil WA selama 1 jam!",
  "Japri sembarang kontak ke-5 di WA kamu, bilang 'Pinjam duit dong 100 ribu, besok sore ganti' 🤣",
  "Tulis status WA 'Aku lagi galau berat rasanya pengen loncat' biarkan 10 menit tanpa dihapus!",
  "Kirim emotikon cium (😘) ke orang terakhir yang kamu chat!",
  "Komentarin foto profil pacar/gebetan pake kalimat gombal yang alay banget!",
  "Buat VN bilang 'Aing Maung!!' dengan suara keras lalu kirim ke sini!",
  "Chat ibumu atau bapakmu bilang 'Ma/Pak, aku mau nikah bulan depan'. Tunggu balasannya!",
  "Balas pesan dari orang pertama di daftar chat kamu dengan bahasa Alien (asal ngetik)!"
];

module.exports = {
  name: 'tod',
  description: 'Main Truth or Dare seru-seruan bareng teman',
  category: 'Game',

  async execute(client, msg, args, commands) {
    const pilihan = args.length > 0 ? args[0].toLowerCase() : '';

    const isTruth = (pilihan === 'truth');
    const isDare = (pilihan === 'dare');
    
    // Jika hanya memanggil /tod tanpa argumen
    if (!isTruth && !isDare) {
      return msg.reply(
        `🎭 *Game Truth or Dare (Jujur atau Tantangan)*\n\n` +
        `Berani terima tantangan Bot? 😎 Pilih salah satu:\n\n` +
        `🟢 Ketik: \`/tod truth\` (Jawab Jujur!)\n` +
        `🔴 Ketik: \`/tod dare\` (Lakukan Tantangannya!)\n\n` +
        `_Cocok dimainkan saat kumpul bareng teman di grup!_`
      );
    }

    // Jika memanggil /truth
    if (isTruth) {
      const gachaTruth = listTruth[Math.floor(Math.random() * listTruth.length)];
      return msg.reply(
        `🗣️ *TRUTH (Jujur)*\n\n` +
        `"${gachaTruth}"\n\n` +
        `⏳ *Ayo jawab dengan jujur! Tidak boleh bohong!* 😆` + config.FOOTER
      );
    }

    // Jika memanggil /dare
    if (isDare) {
      const gachaDare = listDare[Math.floor(Math.random() * listDare.length)];
      return msg.reply(
        `🔥 *DARE (Tantangan)*\n\n` +
        `"${gachaDare}"\n\n` +
        `📷 *Buktikan kalau kamu berani! Kirim buktinya ke sini!* 😈` + config.FOOTER
      );
    }
  },
};
