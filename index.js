// ============================================================
// index.js — Engine Utama Bot WhatsApp
// ============================================================
// Cara kerja:
//   1. Inisialisasi client WhatsApp & scan QR Code
//   2. Saat siap, otomatis membaca semua file dari folder commands/
//   3. Saat ada pesan masuk, periksa prefix → jalankan command yang cocok
// ============================================================

// ⚠️ PENTING: dotenv HARUS dipanggil di sini sebagai baris pertama,
// sebelum require apapun, agar process.env sudah terisi saat config.js di-load.
require('dotenv').config();

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const config = require('./config');

// ─── Warna log di terminal (pakai chalk v4 agar compatible CommonJS) ───
let chalk;
(async () => { chalk = (await import('chalk')).default; })();
const log = (msg) => console.log(`[BOT] ${msg}`);
let isShuttingDown = false;
let reconnectTimer = null;
const authDataPath = process.env.WWEBJS_DATA_PATH || path.join(__dirname, '.wwebjs_auth');
const puppeteerExecutablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
const isHeadless = process.env.PUPPETEER_HEADLESS !== 'false';

// ─── Inisialisasi Client WhatsApp ───────────────────────────────────────
const client = new Client({
  // LocalAuth menyimpan sesi di folder .wwebjs_auth/ agar tidak perlu scan QR ulang
  authStrategy: new LocalAuth({
    clientId: process.env.WWEBJS_CLIENT_ID || 'wa-bot-premium',
    dataPath: authDataPath,
  }),

  puppeteer: {
    // Wajib di VPS Linux tanpa display environment (headless)
    executablePath: puppeteerExecutablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: isHeadless,
  },
});

// ─── Load semua Command dari folder commands/ ────────────────────────────
// Map<string, { description, execute }> — key = nama command tanpa prefix
const commands = new Map();

const commandsPath = path.join(__dirname, 'commands');
if (!fs.existsSync(commandsPath)) {
  fs.mkdirSync(commandsPath, { recursive: true });
  log('Folder commands/ dibuat otomatis.');
}

const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  try {
    const cmd = require(path.join(commandsPath, file));

    // Setiap command file HARUS mengekspor: name, description, execute
    if (!cmd.name || !cmd.execute) {
      log(`⚠️  File commands/${file} melewatkan properti 'name' atau 'execute', dilewati.`);
      continue;
    }

    commands.set(cmd.name.toLowerCase(), cmd);
    log(`✅ Command dimuat: ${config.PREFIX}${cmd.name}`);
  } catch (err) {
    log(`❌ Gagal memuat commands/${file}: ${err.message}`);
  }
}

log(`Total ${commands.size} command berhasil dimuat.`);

// ─── Event: QR Code tampil di terminal ───────────────────────────────────
client.on('qr', (qr) => {
  log('Scan QR Code ini dengan WhatsApp Anda:');
  qrcode.generate(qr, { small: true });
});

// ─── Event: Autentikasi berhasil ─────────────────────────────────────────
client.on('authenticated', () => {
  log('✅ Autentikasi berhasil! Sesi tersimpan.');
});

// ─── Event: Bot siap digunakan ───────────────────────────────────────────
client.on('ready', () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  log('🚀 Bot siap digunakan! Menunggu pesan masuk...');
  log(`Prefix aktif: "${config.PREFIX}" | Admin: ${config.ADMINS.join(', ') || 'Belum diset'}`);
});

// ─── Event: Ada pesan masuk ───────────────────────────────────────────────
client.on('message', async (msg) => {
  // Abaikan pesan dari status WA
  if (msg.from === 'status@broadcast') return;

  const body = msg.body.trim();

  // Periksa apakah pesan diawali dengan prefix
  if (!body.startsWith(config.PREFIX)) {
    // ─── FITUR AUTO-REPLY AI ───
    // Jika pesan ini adalah balasan (reply) terhadap pesan langsung dari Bot
    // Maka otomatis anggap sebagai chat keberlanjutan untuk AI.
    if (msg.hasQuotedMsg) {
      const quotedMsg = await msg.getQuotedMessage();
      if (quotedMsg.fromMe) {
        const aiCmd = commands.get('ai');
        if (aiCmd) {
          // Parsing args dari pesan tanpa prefix
          const args = body.split(/\s+/);
          try {
            // Karena ini proses di background (reply), mungkin butuh notifikasi sedang mengetik
            await msg.react('💬'); 
            await aiCmd.execute(client, msg, args, commands);
          } catch (err) {
            console.error('[Auto-Reply AI] Error:', err.message);
          }
        }
      }
    }
    return;
  }

  // Pisahkan nama command dan argumennya
  // Contoh: "/ai Siapa presiden RI?" → cmd="ai", args=["Siapa","presiden","RI?"]
  const withoutPrefix = body.slice(config.PREFIX.length).trim();
  const [commandName, ...args] = withoutPrefix.split(/\s+/);
  const cmdKey = commandName.toLowerCase();

  // Cari command di Map
  const command = commands.get(cmdKey);

  if (!command) {
    // Command tidak ditemukan — beri tahu pengguna
    await msg.reply(
      `❌ Perintah *${config.PREFIX}${commandName}* tidak ditemukan.\n` +
      `Ketik *${config.PREFIX}menu* untuk melihat daftar perintah.`
    );
    return;
  }

  try {
    log(`📨 [${msg.from}] → ${config.PREFIX}${cmdKey} ${args.join(' ')}`);

    // Jalankan command, kirimkan: client, msg, args, dan commands (untuk menu)
    await command.execute(client, msg, args, commands);
  } catch (err) {
    log(`❌ Error pada command "${cmdKey}": ${err.message}`);
    await msg.reply(`⚠️ Terjadi kesalahan saat menjalankan perintah ini.\n_${err.message}_`);
  }
});

// ─── Event: Sesi terputus ─────────────────────────────────────────────────
function scheduleReconnect(reason) {
  if (isShuttingDown || reconnectTimer) return;

  const delayMs = 5000;
  log(`Bot terputus: ${reason}. Coba inisialisasi ulang dalam ${delayMs / 1000} detik...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    initializeClient({ source: 'reconnect' });
  }, delayMs);
}

client.on('disconnected', (reason) => {
  log(`⚠️  Bot terputus: ${reason}. Menginisialisasi ulang...`);
  scheduleReconnect(reason);
});

// ─── Event: Error autentikasi ─────────────────────────────────────────────
client.on('auth_failure', (msg) => {
  log(`❌ Autentikasi gagal: ${msg}. Hapus folder .wwebjs_auth/ lalu coba lagi.`);
  process.exit(1);
});

async function initializeClient({ fatal = false, source = 'startup' } = {}) {
  try {
    await client.initialize();
  } catch (err) {
    console.error(`[initialize:${source}]`, err);

    if (fatal) {
      process.exit(1);
    }

    scheduleReconnect(`init-failed:${source}`);
  }
}

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log(`Menerima ${signal}. Menutup client WhatsApp...`);
  client.removeAllListeners('disconnected');
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  try {
    await client.destroy();
  } catch (err) {
    console.error('[shutdown] Error:', err.message);
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => {
  shutdown('SIGINT').catch((err) => {
    console.error('[shutdown] Error:', err.message);
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch((err) => {
    console.error('[shutdown] Error:', err.message);
    process.exit(1);
  });
});

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

// ─── Mulai bot ────────────────────────────────────────────────────────────
log('Menginisialisasi bot... Harap tunggu.');
initializeClient({ fatal: true });
