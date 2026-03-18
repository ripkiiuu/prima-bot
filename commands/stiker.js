// ============================================================
// commands/stiker.js — Konversi Gambar/Video ke Stiker WA
// ============================================================
// Cara pakai: Reply gambar/video pendek dengan /stiker
// Dependensi: fluent-ffmpeg, @ffmpeg-installer/ffmpeg (opsional),
//             sharp (untuk kompresi gambar sebelum jadi stiker)
// ============================================================

const { MessageMedia } = require('whatsapp-web.js');
const config = require('../config');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const sharp = require('sharp');
const os = require('os');

// Helper: hasilkan path file sementara di folder temp OS
const tmpPath = (ext) => path.join(os.tmpdir(), `stiker_${Date.now()}.${ext}`);

module.exports = {
  name: 'stiker',
  description: '(Reply gambar/video pendek) Ubah menjadi stiker WhatsApp',
  category: 'Media & Stiker',

  /**
   * Mengkonversi media yang di-reply menjadi stiker WhatsApp (.webp).
   * - Gambar  → dikonversi via sharp ke format webp
   * - Video   → dikonversi via ffmpeg ke animated webp
   */
  async execute(client, msg, args) {
    // Pastikan pesan adalah reply terhadap media
    const quotedMsg = await msg.getQuotedMessage().catch(() => null);

    if (!quotedMsg || !quotedMsg.hasMedia) {
      return msg.reply(
        '❌ *Cara pakai:*\nReply sebuah *gambar* atau *video pendek* dengan perintah */stiker*'
      );
    }

    await msg.reply('⏳ Sedang membuat stiker...');

    try {
      // Download media yang di-reply
      const media = await quotedMsg.downloadMedia();

      if (!media) {
        return msg.reply('❌ Gagal mengunduh media. Coba lagi.');
      }

      const mimeType = media.mimetype;
      const buffer   = Buffer.from(media.data, 'base64');

      let stickerMedia;

      // ─── Gambar (jpg, png, gif, webp) ───────────────────
      if (mimeType.startsWith('image/')) {
        // Konversi ke webp 512x512 (max size stiker WA) pakai sharp
        const webpBuffer = await sharp(buffer)
          .resize(512, 512, {
            fit: 'contain',         // Jaga aspek rasio, tambah transparan jika perlu
            background: { r: 0, g: 0, b: 0, alpha: 0 }, // Background transparan
          })
          .webp({ quality: 80 })
          .toBuffer();

        stickerMedia = new MessageMedia('image/webp', webpBuffer.toString('base64'));

      // ─── Video (mp4, dll.) → Animated Stiker ─────────────
      } else if (mimeType.startsWith('video/')) {
        // Simpan video sementara ke disk
        const inputFile  = tmpPath('mp4');
        const outputFile = tmpPath('webp');

        fs.writeFileSync(inputFile, buffer);

        // Konversi video ke animated webp menggunakan ffmpeg
        await new Promise((resolve, reject) => {
          ffmpeg(inputFile)
            .output(outputFile)
            .outputOptions([
              '-vcodec', 'libwebp',
              '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white@0.0',
              '-loop', '0',
              '-ss', '00:00:00.0',
              '-t', '00:00:06.0',   // Batasi 6 detik (WA max ~1-2 MB)
              '-preset', 'default',
              '-an',                  // Hapus audio
              '-vsync', '0',
            ])
            .on('end', resolve)
            .on('error', reject)
            .run();
        });

        const webpBuffer = fs.readFileSync(outputFile);
        stickerMedia = new MessageMedia('image/webp', webpBuffer.toString('base64'));

        // Bersihkan file sementara
        fs.unlinkSync(inputFile);
        fs.unlinkSync(outputFile);

      } else {
        return msg.reply('❌ Format media tidak didukung. Kirim gambar atau video pendek.');
      }

      // Kirim sebagai stiker menggunakan opsi sendImageAsSticker
      await msg.reply(stickerMedia, null, { sendMediaAsSticker: true });

    } catch (err) {
      console.error('[stiker] Error:', err.message);
      await msg.reply(`❌ Gagal membuat stiker: ${err.message}`);
    }
  },
};
