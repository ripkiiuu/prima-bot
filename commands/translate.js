const translate = require('@iamtraction/google-translate');

module.exports = {
  name: 'translate',
  description: 'Menerjemahkan teks dari/ke bahasa Indonesia. Cara pakai: /translate [teks] atau reply pesan dengan caption /translate',
  category: 'Utilitas',
  
  async execute(client, msg, args) {
    let textToTranslate = '';
    
    // Mengecek apakah kita membalas (reply) pesan seseorang
    if (msg.hasQuotedMsg) {
      const quotedMsg = await msg.getQuotedMessage();
      textToTranslate = quotedMsg.body;
    } else if (args.length > 0) {
      // Jika tidak reply pesan, ambil teks dari argumen
      textToTranslate = args.join(' ');
    }
    
    // Validasi apakah ada teks yang akan diterjemahkan
    if (!textToTranslate || textToTranslate.trim() === '') {
      return msg.reply('Harap sertakan teks yang ingin diterjemahkan!\n\n🔹 *Contoh 1:* /translate I love you\n🔹 *Contoh 2:* (Reply sebuah pesan dengan teks) /translate');
    }

    try {
      // Karena deskripsi fitur minta untuk bahasa Indonesia, kita targetkan ke "id" (Indonesian)
      // Modul ini otomatis mendeteksi sumber bahasa teks (auto)
      const result = await translate(textToTranslate, { to: 'id' });
      
      const replyText = `🌐 *GOOGLE TRANSLATE* 🌐\n\n` +
                        `*Bahasa Asal (${result.from.language.iso}):*\n${textToTranslate}\n\n` +
                        `*Terjemahan (id):*\n${result.text}`;
                        
      await msg.reply(replyText);

    } catch (err) {
      console.error('[Translate Error]', err.message);
      await msg.reply('❌ Terjadi kesalahan saat mencoba menerjemahkan. API Google Translate mungkin sedang dibatasi, coba lagi sebentar lagi.');
    }
  }
};
