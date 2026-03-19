require('dotenv').config();
const fs = require('fs');
async function run() {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const json = await res.json();
    if(json.models) {
        fs.writeFileSync('available-models.txt', json.models.map(m => m.name).join('\n'));
    }
  } catch(e) {}
}
run();
