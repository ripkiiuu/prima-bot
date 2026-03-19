const axios = require('axios');

module.exports = {
  name: 'sholat',
  description: 'Menampilkan jadwal sholat hari ini berdasarkan kota. Contoh: /sholat jakarta',
  category: 'Utilitas',
  
  async execute(client, msg, args) {
    if (!args.length) {
      return msg.reply('Harap sertakan nama kota!\n\n🔹 *Contoh:* /sholat jakarta');
    }
    
    const cityQuery = args.join(' ');
    
    try {
      // Karena API butuh ID kota terlebih dahulu, kita cari kotanya:
      const searchRes = await axios.get(`https://api.myquran.com/v2/sholat/kota/cari/${encodeURIComponent(cityQuery)}`);
      
      // Validasi response kalau tidak ketemu
      if (!searchRes.data.status || !searchRes.data.data.length) {
        return msg.reply(`❌ Kota *${cityQuery}* tidak ditemukan. Coba gunakan nama kota lain yang valid.`);
      }
      
      const cityId = searchRes.data.data[0].id;
      const cityName = searchRes.data.data[0].lokasi;
      
      // Mengambil hari ini
      const now = new Date();
      // Konversi ke format tahun/bulan/tanggal
      const year = now.getFullYear();
      const month = ('0' + (now.getMonth() + 1)).slice(-2); // Pakai padding 0 jika bulan < 10
      const day = ('0' + now.getDate()).slice(-2);
      
      // Ambil jadwal sholat kota tersebut
      const scheduleRes = await axios.get(`https://api.myquran.com/v2/sholat/jadwal/${cityId}/${year}/${month}/${day}`);
      
      if (!scheduleRes.data.status) {
        return msg.reply(`❌ Gagal mengambil jadwal sholat untuk kota *${cityName}*.`);
      }
      
      const schedule = scheduleRes.data.data.jadwal;
      
      const replyText = `🕋 *JADWAL SHOLAT* 🕋\n\n` +
                        `📍 *Lokasi*: ${cityName}\n` +
                        `📅 *Tanggal*: ${schedule.tanggal}\n\n` +
                        `• 🌅 *Imsak:* ${schedule.imsak}\n` +
                        `• 🌤️ *Subuh:* ${schedule.subuh}\n` +
                        `• ☀️ *Dzuhur:* ${schedule.dzuhur}\n` +
                        `• 🐫 *Ashar:* ${schedule.ashar}\n` +
                        `• 🌇 *Maghrib:* ${schedule.maghrib}\n` +
                        `• 🌙 *Isya:* ${schedule.isya}\n\n` +
                        `_Semoga kita senantiasa dijaga waktu ibadahnya. Aamin._ 🙏`;
                        
      await msg.reply(replyText);
      
    } catch (err) {
      console.error('[Sholat Error]', err.message);
      await msg.reply('Maaf, terjadi resiko kesalahan teknis saat mengakses API jadwal sholat. Coba lagi nanti.');
    }
  }
};
