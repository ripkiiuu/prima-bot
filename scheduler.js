const schedule = require('node-schedule');
const fs = require('fs');
const path = require('path');

const remindersPath = path.join(__dirname, 'data', 'reminders.json');

// Initialize store if not exists
if (!fs.existsSync(path.dirname(remindersPath))) {
  fs.mkdirSync(path.dirname(remindersPath), { recursive: true });
}
if (!fs.existsSync(remindersPath)) {
  fs.writeFileSync(remindersPath, JSON.stringify([]));
}

let reminders = [];
try {
  const data = fs.readFileSync(remindersPath, 'utf8');
  reminders = JSON.parse(data);
} catch (e) {
  reminders = [];
}

let whatsappClient = null;

function saveReminders() {
  fs.writeFileSync(remindersPath, JSON.stringify(reminders, null, 2));
}

function init(client) {
  whatsappClient = client;
  console.log(`[Scheduler] Memuat ${reminders.length} pengingat dari file...`);
  
  const now = Date.now();
  let loadedCount = 0;
  
  const validReminders = [];
  
  for (const r of reminders) {
    if (r.time <= now) {
      // Waktunya sudah lewat, mungkin bot mati saat deadline
      // Kirim sekarang sebagai notifikasi susulan
      sendReminder(r);
    } else {
      // Jadwalkan ulang
      schedule.scheduleJob(new Date(r.time), () => {
         sendReminder(r);
         removeReminder(r.id);
      });
      validReminders.push(r);
      loadedCount++;
    }
  }
  
  // Perbarui daftar hanya dengan yang belum dikirim
  reminders = validReminders;
  saveReminders();
  console.log(`[Scheduler] Berhasil menjadwalkan ulang ${loadedCount} pengingat.`);
}

function sendReminder(r) {
  if (!whatsappClient) return;
  const senderIdClean = r.sender.replace('@c.us', '').replace('@lid', '');
  const message = `⏰ *PENGINGAT (REMINDER)* ⏰\n\nDari: @${senderIdClean}\nPesan:\n_${r.message}_`;
  
  // Kirim tanpa opsi mentions untuk menghindari error "Detached Frame" jika ID tidak valid
  whatsappClient.sendMessage(r.chatId, message).catch(err => {
    console.error('[Scheduler] Gagal mengirim pengingat:', err.message);
  });
}

function removeReminder(id) {
  reminders = reminders.filter(rem => rem.id !== id);
  saveReminders();
}

function addReminder(chatId, sender, timeStr, message) {
  let targetTime;
  const now = Date.now();
  
  // Parsing simple: Xm, Xh, Xd
  const minMatch = timeStr.match(/^(\d+)m$/i);
  const hourMatch = timeStr.match(/^(\d+)h$/i);
  const dayMatch = timeStr.match(/^(\d+)d$/i);
  
  if (minMatch) {
    targetTime = now + parseInt(minMatch[1]) * 60 * 1000;
  } else if (hourMatch) {
    targetTime = now + parseInt(hourMatch[1]) * 60 * 60 * 1000;
  } else if (dayMatch) {
    targetTime = now + parseInt(dayMatch[1]) * 24 * 60 * 60 * 1000;
  } else {
    // Coba Date.parse untuk format YYYY-MM-DD HH:mm
    targetTime = Date.parse(timeStr);
    if (isNaN(targetTime)) {
      return { success: false, error: 'Format waktu tidak dikenali. Gunakan Xm (menit), Xh (jam), Xd (hari), atau format tanggal YYYY-MM-DD HH:mm' };
    }
  }

  if (targetTime <= now) {
    return { success: false, error: 'Waktu pengingat harus di masa depan.' };
  }

  const id = Date.now().toString();
  const newReminder = {
    id,
    chatId,
    sender,
    time: targetTime,
    message
  };

  reminders.push(newReminder);
  saveReminders();

  // Jadwalkan job
  schedule.scheduleJob(new Date(targetTime), () => {
     sendReminder(newReminder);
     removeReminder(id);
  });

  return { success: true, targetTime };
}

module.exports = { init, addReminder };
