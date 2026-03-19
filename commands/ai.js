const axios = require('axios');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database_memori.json');

if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({}, null, 2));
function getMemory() { try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')); } catch (e) { return {}; } }
function saveMemory(data) { try { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); } catch (e) {} }

const KALENDER_ABSOLUT = `
[PANDUAN MUTLAK TANGGAL INDONESIA]:
- Hari/Tanggal Masehi Hari ini: TERLAMPIR DI BAWAH.
`;

const delay = ms => new Promise(res => setTimeout(res, ms));

module.exports = {
  name: 'ai',
  description: 'AI Super Canggih dengan Multi-Model Fallback Anti-Error',
  category: 'AI & Edukasi',

  async execute(client, msg, args) {
    const rawPrompt = args.join(' ').trim();
    if (!rawPrompt) return msg.reply('Silakan berikan pesan untuk AI.\nContoh: /ai siapa presiden indonesia sekarang?');

    const userId = msg.author || msg.from;
    
    try {
      const chatState = await msg.getChat();
      chatState.sendStateTyping();

      const userContact = await msg.getContact();
      const userName = userContact.pushname || userContact.name || 'User';

      const now = new Date();
      const optionsDt = { timeZone: 'Asia/Jakarta', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
      const currentTimeStr = now.toLocaleString('id-ID', optionsDt);

      let systemPrompt = `Identitas Mutlak: Namamu adalah "Cell". Kamu asisten setia Sastra Coding. Fakta Waktu Dunia Saat Ini: ${currentTimeStr} WIB.
${KALENDER_ABSOLUT}
ATURAN SIFAT (EMPATHY & TONE):
1. Penuh Empati, tiru gaya bahasa user (lo-gue/aku-kamu).
2. MULTI-BAHASA SEMPURNA (Inggris, Korea, Spanyol, Arab, Jepang, dsb) layaknya native speaker.
3. Paragraf pendek natural untuk WhatsApp. Dilarang pakai karakter asterisk bold (*)`;

      const isCreator = (process.env.ADMINS || '').includes(userId);
      if (isCreator) {
        systemPrompt += `\n[ATURAN PENCIPTA]: Ini adalah BOS BESAR dan PENCIPTAMU. Panggil dia "Tuan" atau "Bos". Tunduk seratus persen!`;
      }

      const db = getMemory();
      if (!db[userId]) db[userId] = { profil: { nama: userName }, riwayat: [] };
      db[userId].profil.nama = userName;

      let groqHistory = db[userId].riwayat.map(h => ({ role: h.role, content: h.content }));
      
      // KUNCI ANTI-ERROR GROQ:
      // Hanya kirim 4 pesan history terakhir agar tidak menyentuh limit Token-Per-Minute (6,000 TPM) di Groq Free Tier!
      if (groqHistory.length > 4) groqHistory = groqHistory.slice(-4);

      const messages = [{ role: 'system', content: systemPrompt }, ...groqHistory, { role: 'user', content: rawPrompt }];
      const apiKey = process.env.GROQ_API_KEY;

      const axiosInstance = axios.create({ timeout: 60000 });

      let aiReply = "Maaf, sistem sedang memproses...";
      let success = false;
      let usedModel = "unknown";

      // Array Model Fallback (Kalo 70B limit rate TPM, otomatis lari ke 8B yang limitnya 30,000 TPM)
      const modelFallbacks = [
         'llama-3.3-70b-versatile', 
         'llama-3.1-8b-instant',
         'mixtral-8x7b-32768'
      ];

      for (let i = 0; i < modelFallbacks.length; i++) {
        const targetModel = modelFallbacks[i];
        try {
          const response = await axiosInstance.post('https://api.groq.com/openai/v1/chat/completions', {
            model: targetModel,
            messages: messages,
            temperature: 0.7,
            max_tokens: 1000,
          }, { 
            headers: { 'Authorization': `Bearer ${apiKey}` }
          });
          
          aiReply = response.data.choices[0].message.content;
          usedModel = targetModel;
          success = true;
          break; // Berhasil, langsung keluar dari loop!
        } catch (error) {
          const status = error.response ? error.response.status : null;
          console.error(`[Ultimate AI Error Groq - ${targetModel}] Gagal:`, error.response ? error.response.data : error.message);
          
          if (status === 429) {
             console.log(`[Groq] Terkena Rate limit TPM dari ${targetModel}. Pindah ke model selanjutnya...`);
             // Teruskan loop ke model yang lebih ringan!
          } else {
             // Kalau error selain 429 atau 500, tunggu detik lalu coba model selanjutnya aja
             await delay(1000);
          }
        }
      }

      if (!success) {
         throw new Error("Semua model Groq mengalami Limit/Time Out.");
      }

      // Update Database
      db[userId].riwayat.push({ role: 'user', content: rawPrompt });
      db[userId].riwayat.push({ role: 'assistant', content: aiReply });
      
      if (db[userId].riwayat.length > 8) db[userId].riwayat = db[userId].riwayat.slice(-8);
      
      saveMemory(db);
      await msg.reply(aiReply.trim());

    } catch (err) {
      console.error('[Ultimate AI Kiamat Error]', err.message || err);
      // Fallback pesan jika semua tewas
      await msg.reply('Aduh Bos Pencipta, batas permintaan harian/menitan Groq API gratis saat ini sudah habis total (Limit 429/TPM) di semua model. Bos harus tunggu beberapa menit (reset token per menit), lalu ketik ulang ya!');
    }
  }
};
