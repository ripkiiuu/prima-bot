// ============================================================
// commands/blast.js — Broadcast Pesan (Admin Only, Anti-Banned)
// ============================================================
// Cara pakai (hanya admin):
//   /blast [pesan]                  → Mulai blast ke semua kontak
//   /blast delay [detik]            → Set jeda antar pesan (default: 45)
//   /blast today                    → Laporan progres batch hari ini
//   /blast resume                   → Lanjutkan batch hari ini dari yang belum terkirim
//   /blast reset                    → Reset progres batch (mulai dari awal)
//
// Variabel dinamis dalam pesan:
//   {nama}  → diganti nama kontak
//   {nomor} → diganti nomor kontak
//
// SISTEM BATCH HARIAN:
//   - Progress disimpan di data/blast_progress.json
//   - Kalau bot mati di tengah jalan → /blast resume untuk lanjutkan
//   - Otomatis skip kontak yang sudah terkirim hari ini
// ============================================================

const fs   = require('fs');
const path = require('path');
const config = require('../config');

// ─── Path file progres ──────────────────────────────────────────
const PROGRESS_FILE = path.join(__dirname, '../data/blast_progress.json');
const CONTACTS_FILE = path.join(__dirname, '../data/contacts.json');

// ─── State global ───────────────────────────────────────────────
let blastRunning = false;
let blastDelay   = 45; // detik default antar pesan

// ─── Helper: Baca / Tulis file JSON ─────────────────────────────
function readJSON(filePath, defaultVal) {
  if (!fs.existsSync(filePath)) return defaultVal;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch { return defaultVal; }
}

function writeJSON(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Helper: Tanggal hari ini (YYYY-MM-DD) ──────────────────────
function hariIni() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Baca daftar kontak ─────────────────────────────────────────
function bacaKontak() {
  if (!fs.existsSync(CONTACTS_FILE)) throw new Error('File data/contacts.json tidak ditemukan!');
  const kontak = JSON.parse(fs.readFileSync(CONTACTS_FILE, 'utf-8'));
  const seen   = new Set();
  return kontak.filter(k => {
    const nomor = (k.nomor || '').toString().replace(/\D/g, '');
    if (!nomor || seen.has(nomor)) return false;
    seen.add(nomor);
    k.nomor = nomor;
    return true;
  });
}

// ─── Format pesan dengan variabel dinamis ───────────────────────
function formatPesan(template, kontak) {
  return template
    .replace(/{nama}/gi, kontak.nama || 'Kak')
    .replace(/{nomor}/gi, kontak.nomor || '');
}

// ─── Delay acak di sekitar target detik (±20%) ─────────────────
function jeda(targetDetik) {
  const min = targetDetik * 0.8 * 1000;
  const max = targetDetik * 1.2 * 1000;
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  const d = (delay / 1000).toFixed(1);
  console.log(`[blast] ⏳ Jeda ${d}s sebelum pesan berikutnya...`);
  return new Promise(r => setTimeout(r, delay));
}

// ─── Baca dan perbarui progres batch ───────────────────────────
function bacaProgres() {
  const data = readJSON(PROGRESS_FILE, {});
  const tanggal = hariIni();
  if (!data.tanggal || data.tanggal !== tanggal) {
    // Hari baru → reset hitungan terkirim hari ini, tapi simpan template
    return { tanggal, terkirim: [], template: data.template || '', delayDetik: data.delayDetik || 45 };
  }
  return data;
}

function simpanProgres(data) {
  writeJSON(PROGRESS_FILE, { ...data, tanggal: hariIni() });
}

// ─── Estimasi waktu ─────────────────────────────────────────────
function estimasiWaktu(jumlah, delayDetik) {
  const totalDetik = jumlah * delayDetik;
  if (totalDetik < 60)  return `${totalDetik} detik`;
  if (totalDetik < 3600) return `${Math.ceil(totalDetik / 60)} menit`;
  const jam  = Math.floor(totalDetik / 3600);
  const mnt  = Math.ceil((totalDetik % 3600) / 60);
  return `${jam} jam ${mnt} menit`;
}

// ===================================================================
// MAIN COMMAND
// ===================================================================
module.exports = {
  name: 'blast',
  description: '[pesan] Broadcast ke semua kontak (admin)',
  category: 'Admin',

  async execute(client, msg, args) {
    const senderId = msg.author || msg.from;

    // ─── Auth admin ─────────────────────────────────────────────
    if (!config.ADMINS.includes(senderId)) {
      return msg.reply(
        `🔐 Perintah ini hanya untuk *admin bot*.\n\nID kamu: *${senderId}*`
      );
    }

    if (blastRunning) {
      return msg.reply('⚠️ *Blast sedang berjalan!*\nKetik */stopblast* untuk menghentikan, atau */blast today* untuk lihat progres.');
    }

    const sub = (args[0] || '').toLowerCase();

    // ────────────────────────────────────────────────────────────
    // SUB-COMMAND: /blast today → laporan hari ini
    // ────────────────────────────────────────────────────────────
    if (sub === 'today' || sub === 'progres' || sub === 'status') {
      const prog    = bacaProgres();
      const kontak  = bacaKontak();
      const sudah   = prog.terkirim.length;
      const total   = kontak.length;
      const sisa    = total - sudah;
      return msg.reply(
        `📊 *Progres Blast Hari Ini (${prog.tanggal})*\n\n` +
        `✅ Terkirim : ${sudah}\n` +
        `⏳ Sisa     : ${sisa}\n` +
        `📋 Total    : ${total}\n` +
        `⏱ Jeda     : ${prog.delayDetik || blastDelay}s\n\n` +
        (sisa > 0 ? `Ketik */blast resume* untuk melanjutkan.` : `🎉 Semua kontak sudah terkirim hari ini!`)
      );
    }

    // ────────────────────────────────────────────────────────────
    // SUB-COMMAND: /blast delay [detik] → ubah jeda
    // ────────────────────────────────────────────────────────────
    if (sub === 'delay' || sub === 'jeda') {
      const val = parseInt(args[1]);
      if (!val || val < 10 || val > 600) {
        return msg.reply('❌ Isi delay antara 10–600 detik.\nContoh: */blast delay 60*');
      }
      blastDelay = val;
      const prog = bacaProgres();
      prog.delayDetik = val;
      simpanProgres(prog);
      return msg.reply(`✅ Jeda blast diubah ke *${val} detik* per pesan.`);
    }

    // ────────────────────────────────────────────────────────────
    // SUB-COMMAND: /blast reset → hapus progres, mulai dari awal
    // ────────────────────────────────────────────────────────────
    if (sub === 'reset') {
      simpanProgres({ tanggal: hariIni(), terkirim: [], template: '', delayDetik: blastDelay });
      return msg.reply('♻️ Progres blast sudah di-reset. Blast berikutnya akan mulai dari kontak pertama.');
    }

    // ────────────────────────────────────────────────────────────
    // SUB-COMMAND: /blast resume → lanjutkan dari yang belum terkirim
    // ────────────────────────────────────────────────────────────
    if (sub === 'resume') {
      const prog = bacaProgres();
      if (!prog.template) {
        return msg.reply('❌ Tidak ada blast yang bisa dilanjutkan. Mulai dengan */blast [pesan]* terlebih dahulu.');
      }
      return this._jalankanBlast(client, msg, prog.template, prog);
    }

    // ────────────────────────────────────────────────────────────
    // DEFAULT: /blast [pesan] → mulai blast baru
    // ────────────────────────────────────────────────────────────
    const template = args.join(' ').trim();
    if (!template) {
      return msg.reply(
        `📢 *Cara pakai /blast:*\n\n` +
        `*/blast [pesan]*       → mulai blast\n` +
        `*/blast resume*        → lanjutkan batch hari ini\n` +
        `*/blast today*         → lihat progres hari ini\n` +
        `*/blast delay [detik]* → ubah jeda (min 10, maks 600)\n` +
        `*/blast reset*         → reset progres\n\n` +
        `*Variabel pesan:*\n` +
        `{nama}  → nama kontak\n` +
        `{nomor} → nomor kontak\n\n` +
        `Contoh:\n` +
        `/blast Halo {nama}! Kamu diundang ke OPREC UKM PRIMA 🎉`
      );
    }

    const prog = bacaProgres();
    prog.template   = template;
    prog.delayDetik = prog.delayDetik || blastDelay;
    simpanProgres(prog);

    return this._jalankanBlast(client, msg, template, prog);
  },

  // ──────────────────────────────────────────────────────────────
  // Internal: Jalankan loop blast
  // ──────────────────────────────────────────────────────────────
  async _jalankanBlast(client, msg, template, prog) {
    let kontak;
    try { kontak = bacaKontak(); }
    catch (err) { return msg.reply(`❌ ${err.message}`); }

    if (!kontak.length) return msg.reply('❌ Daftar kontak kosong! Edit *data/contacts.json*');

    const sudahTerkirim = new Set(prog.terkirim || []);
    const sisaKontak    = kontak.filter(k => !sudahTerkirim.has(k.nomor));
    const delayDetik    = prog.delayDetik || blastDelay;

    if (!sisaKontak.length) {
      return msg.reply('🎉 Semua kontak sudah terkirim hari ini!\nKetik */blast reset* kalau mau kirim ulang dari awal.');
    }

    await msg.reply(
      `📢 *Blast ${prog.terkirim.length > 0 ? 'Dilanjutkan' : 'Dimulai'}!*\n\n` +
      `📋 Sisa kontak  : *${sisaKontak.length}*\n` +
      `✅ Sudah terkirim: *${prog.terkirim.length}*\n` +
      `⏱ Jeda per pesan: *${delayDetik}s*\n` +
      `⌛ Estimasi sisa : *~${estimasiWaktu(sisaKontak.length, delayDetik)}*\n\n` +
      `🔴 Ketik */stopblast* untuk menghentikan sementara.\n` +
      `▶️ Lanjutkan kapanpun dengan */blast resume*`
    );

    blastRunning = true;
    let berhasil = 0, gagal = 0;
    const LAPORAN_SETIAP = 25; // kirim update ke admin setiap X pesan

    for (const k of sisaKontak) {
      if (!blastRunning) {
        await msg.reply(
          `🛑 *Blast dihentikan sementara.*\n\n` +
          `✅ Terkirim sesi ini : ${berhasil}\n` +
          `📋 Total terkirim    : ${prog.terkirim.length + berhasil}\n\n` +
          `Ketik */blast resume* untuk melanjutkan kapanpun.`
        );
        return;
      }

      const waId = k.nomor.startsWith('0')
        ? `62${k.nomor.slice(1)}@c.us`
        : `${k.nomor}@c.us`;

      try {
        const isOnWA = await client.isRegisteredUser(waId).catch(() => false);

        if (!isOnWA) {
          console.log(`[blast] ⚠️  ${k.nama} (${k.nomor}) — Tidak terdaftar WA, dilewati.`);
          gagal++;
        } else {
          const pesanFmt = formatPesan(template, k);
          await client.sendMessage(waId, pesanFmt);
          berhasil++;

          // Tandai sebagai terkirim & simpan progres
          prog.terkirim.push(k.nomor);
          simpanProgres(prog);

          console.log(`[blast] ✅ [${prog.terkirim.length}] Terkirim → ${k.nama} (${k.nomor})`);
        }
      } catch (err) {
        console.error(`[blast] ❌ ${k.nama}: ${err.message}`);
        gagal++;
      }

      // ─── Laporan berkala ke admin ────────────────────────────
      if (berhasil > 0 && berhasil % LAPORAN_SETIAP === 0) {
        await msg.reply(`📊 *Update Blast*\n✅ Terkirim sesi ini: ${berhasil}\n📋 Total: ${prog.terkirim.length}/${kontak.length}`);
      }

      // ─── Jeda acak ───────────────────────────────────────────
      const isLast = sisaKontak.indexOf(k) === sisaKontak.length - 1;
      if (!isLast) await jeda(delayDetik);
    }

    blastRunning = false;
    await msg.reply(
      `✅ *Blast Selesai!*\n\n` +
      `📊 *Laporan Sesi Ini:*\n` +
      `• Terkirim  : ${berhasil} ✅\n` +
      `• Dilewati  : ${gagal} ⚠️\n\n` +
      `📋 *Total terkirim hari ini: ${prog.terkirim.length}/${kontak.length}*\n\n` +
      (prog.terkirim.length < kontak.length
        ? `Sisa ${kontak.length - prog.terkirim.length} kontak. Ketik */blast resume* untuk lanjutkan.`
        : `🎉 Semua kontak sudah terkirim!`) +
      config.FOOTER
    );
  },
};

// ─── Export controller untuk stopblast ────────────────────────
module.exports.stopBlast = () => { blastRunning = false; };
