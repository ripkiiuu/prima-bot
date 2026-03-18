// ==========================================
// config.js — Konfigurasi Global Bot
// ==========================================
// Semua setting sensitif WAJIB dipindah ke .env
// Jangan pernah commit .env ke GitHub!

require('dotenv').config();

module.exports = {
  // ─── Identitas Bot ───────────────────────────────
  BOT_NAME: "Cell's Bot",
  PREFIX: '/',               // Prefix perintah (bisa diganti '!', '.', dll.)
  BOT_NUMBER: process.env.BOT_NUMBER || '',  // Nomor WA bot (opsional)

  // ─── Nomor Admin ─────────────────────────────────
  // Format: '628xxxxxxxxxx@c.us' (tanpa +, gunakan kode negara 62)
  ADMINS: (process.env.ADMINS || '').split(',').filter(Boolean),

  // ─── API Keys ─────────────────────────────────────
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',       // Google Gemini AI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',       // OpenAI (alternatif)
  OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY || '', // OpenWeatherMap
  OCR_API_KEY: process.env.OCR_API_KEY || '',             // ocr.space (gratis)
  
  // ─── Blast / Broadcast ───────────────────────────
  BLAST_DELAY_MIN: 15000,   // Minimal delay antar pesan (15 detik)
  BLAST_DELAY_MAX: 35000,   // Maksimal delay antar pesan (35 detik)

  // ─── Footer Pesan ─────────────────────────────────
  FOOTER: '\n\n_Powered by Cell\'s Bot 🤖_',
};
