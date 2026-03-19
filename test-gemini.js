require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function test() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      tools: [{ googleSearch: {} }]
    });

    const result = await model.generateContent("What is the weather in Tokyo today?");
    console.log("Success:", result.response.text());
  } catch (error) {
    if (error.message.includes('googleSearch')) {
      console.error("Fallling back without googleSearch...");
      const fallbackModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const fbResult = await fallbackModel.generateContent("Hello?");
      console.log("Fallback Success:", fbResult.response.text());
    } else {
      console.error("Failed:", error.message || error);
    }
  }
}
test();
