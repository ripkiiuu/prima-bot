const fs = require('fs');
const path = require('path');
const config = require('../config');

const tasksPath = path.join(__dirname, '..', 'data', 'tasks.json');

// Initialize store if not exists
if (!fs.existsSync(path.dirname(tasksPath))) {
  fs.mkdirSync(path.dirname(tasksPath), { recursive: true });
}
if (!fs.existsSync(tasksPath)) {
  fs.writeFileSync(tasksPath, JSON.stringify({}));
}

function loadTasks() {
  try {
    const data = fs.readFileSync(tasksPath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return {};
  }
}

function saveTasks(tasksObj) {
  fs.writeFileSync(tasksPath, JSON.stringify(tasksObj, null, 2));
}

module.exports = {
  name: 'task',
  description: 'Manajemen tugas/kerjaan grup (!task add/list/done/delete)',
  execute: async (client, msg, args) => {
    const chatId = msg.from;
    const action = args[0] ? args[0].toLowerCase() : 'list';
    
    const tasks = loadTasks();
    if (!tasks[chatId]) tasks[chatId] = [];

    if (action === 'add') {
      const taskDesc = args.slice(1).join(' ');
      if (!taskDesc) return msg.reply(`❌ Masukkan deskripsi tugas!\nFormat: *${config.PREFIX}task add [deskripsi]*`);
      
      const newId = tasks[chatId].length > 0 ? Math.max(...tasks[chatId].map(t => t.id)) + 1 : 1;
      tasks[chatId].push({ id: newId, desc: taskDesc, done: false });
      saveTasks(tasks);
      
      return msg.reply(`✅ Tugas ditambahkan! (ID: ${newId})\nKetik *${config.PREFIX}task list* untuk melihat detailnya.`);
    } 
    
    else if (action === 'list') {
      const groupTasks = tasks[chatId];
      if (!groupTasks || groupTasks.length === 0) {
        return msg.reply(`📜 Tidak ada tugas yang tercatat untuk obrolan ini.`);
      }

      let response = `📋 *DAFTAR TUGAS* 📋\n\n`;
      let pendingCount = 0;

      groupTasks.forEach(t => {
        const icon = t.done ? '✅' : '⏳';
        const strikeTarget = t.done ? `~${t.desc}~` : t.desc;
        response += `${icon} *#${t.id}* - ${strikeTarget}\n`;
        if (!t.done) pendingCount++;
      });
      
      response += `\n*Tersisa ${pendingCount} tugas yang belum selesai.*\nUntuk menandai selesai: *${config.PREFIX}task done [id]*`;
      return msg.reply(response);
    }
    
    else if (action === 'done' || action === 'delete') {
      const taskId = parseInt(args[1]);
      if (isNaN(taskId)) return msg.reply(`❌ Masukkan ID tugas yang valid!\nFormat: *${config.PREFIX}task ${action} [id]*`);
      
      const taskIndex = tasks[chatId].findIndex(t => t.id === taskId);
      if (taskIndex === -1) return msg.reply(`❌ Tugas dengan ID ${taskId} tidak ditemukan.`);
      
      if (action === 'done') {
        tasks[chatId][taskIndex].done = true;
        saveTasks(tasks);
        return msg.reply(`✅ Mengubah status tugas #${taskId} menjadi SELESAI.`);
      } else {
        tasks[chatId].splice(taskIndex, 1);
        saveTasks(tasks);
        return msg.reply(`🗑️ Tugas #${taskId} berhasil dihapus.`);
      }
    }
    
    else {
      return msg.reply(
        `❌ *Perintah Tidak Dikenali!*\n\nGunakan:\n` +
        `- *${config.PREFIX}task add [tugas]*\n` +
        `- *${config.PREFIX}task list*\n` +
        `- *${config.PREFIX}task done [id]*\n` +
        `- *${config.PREFIX}task delete [id]*`
      );
    }
  }
};
