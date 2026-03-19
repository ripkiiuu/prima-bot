require('dotenv').config();
const axios = require('axios');
async function run() {
  try {
    const res = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const json = res.data;
    if(json.models) {
        console.log("AVAILABLE FLASH/PRO MODELS:");
        console.log(json.models.map(m => m.name).filter(n => n.includes('flash') || n.includes('pro')));
    } else {
        console.log(json);
    }
  } catch(e) { console.error(e.response ? e.response.data : e.message) }
}
run();
