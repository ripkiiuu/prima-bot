const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const DB_PATH = path.join(__dirname, "..", "database_memori.json");
const DEFAULT_PROVIDER_ORDER = ["openrouter", "gemini", "groq", "openai", "xai"];
const VALID_PROVIDERS = new Set([...DEFAULT_PROVIDER_ORDER]);
const PROVIDER_LABELS = {
  openrouter: "OpenRouter",
  gemini: "Gemini",
  groq: "Groq",
  openai: "OpenAI",
  xai: "xAI",
};

if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify({}, null, 2));
}

function getMemory() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function saveMemory(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch {}
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getProviderOrder() {
  const configured = parseCsv(process.env.AI_PROVIDER_ORDER).map((item) => item.toLowerCase());
  const filtered = configured.filter((provider) => VALID_PROVIDERS.has(provider));
  return filtered.length ? filtered : DEFAULT_PROVIDER_ORDER;
}

function getProviderKeys() {
  const rawGroqKey = String(process.env.GROQ_API_KEY || "").trim();
  const rawXaiKey = String(process.env.XAI_API_KEY || "").trim();

  return {
    openrouter: String(process.env.OPENROUTER_API_KEY || "").trim(),
    gemini: String(process.env.GEMINI_API_KEY || "").trim(),
    openai: String(process.env.OPENAI_API_KEY || "").trim(),
    groq: rawGroqKey && !rawGroqKey.startsWith("xai-") ? rawGroqKey : "",
    xai: rawXaiKey || (rawGroqKey.startsWith("xai-") ? rawGroqKey : ""),
  };
}

function getModels(provider) {
  const configured = {
    openrouter: parseCsv(process.env.OPENROUTER_MODELS),
    gemini: parseCsv(process.env.GEMINI_MODELS),
    groq: parseCsv(process.env.GROQ_MODELS),
    openai: parseCsv(process.env.OPENAI_MODELS),
    xai: parseCsv(process.env.XAI_MODELS),
  }[provider];

  if (configured && configured.length) {
    return configured;
  }

  const legacy = {
    openrouter: String(process.env.OPENROUTER_MODEL || "").trim(),
    gemini: String(process.env.GEMINI_MODEL || "").trim(),
    groq: String(process.env.GROQ_MODEL || "").trim(),
    openai: String(process.env.OPENAI_MODEL || "").trim(),
    xai: String(process.env.XAI_MODEL || "").trim(),
  }[provider];

  if (legacy) {
    return [legacy];
  }

  const defaults = {
    openrouter: ["openai/gpt-4.1"],
    gemini: ["gemini-2.5-flash"],
    groq: ["llama-3.3-70b-versatile"],
    openai: ["gpt-4.1"],
    xai: ["grok-beta"],
  };

  return defaults[provider] || [];
}

function buildChatMessages(systemPrompt, history, rawPrompt) {
  return [
    { role: "system", content: systemPrompt },
    ...history.map((item) => ({ role: item.role, content: item.content })),
    { role: "user", content: rawPrompt },
  ];
}

function buildGeminiHistory(history) {
  return history
    .filter((item) => item.role === "user" || item.role === "assistant")
    .map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content }],
    }));
}

function normalizeContent(content) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item?.text === "string") return item.text;
        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
}

function shortText(value, max = 110) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "tanpa detail";
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function classifyError(error) {
  const status = error.response?.status;
  const data = error.response?.data;
  const detail = typeof data === "string"
    ? data
    : data?.error?.message || data?.error || data?.message || error.message;

  if (status === 401 || status === 403) {
    return { kind: "auth", summary: "API key tidak valid / tidak diizinkan", detail: shortText(detail) };
  }

  if (status === 429) {
    return { kind: "rate_limit", summary: "limit request/token habis", detail: shortText(detail) };
  }

  if (status === 404) {
    return { kind: "not_found", summary: "model/endpoint tidak ditemukan", detail: shortText(detail) };
  }

  if (status >= 400 && status < 500) {
    return { kind: "bad_request", summary: `request ditolak (${status})`, detail: shortText(detail) };
  }

  if (error.code === "ECONNABORTED") {
    return { kind: "timeout", summary: "request timeout", detail: "provider tidak merespons tepat waktu" };
  }

  return { kind: "error", summary: shortText(detail), detail: shortText(detail) };
}

async function callChatCompletions({ axiosInstance, endpoint, apiKey, model, messages, extraHeaders = {} }) {
  const response = await axiosInstance.post(
    endpoint,
    {
      model,
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...extraHeaders,
      },
    },
  );

  const text = normalizeContent(response.data?.choices?.[0]?.message?.content);
  if (!text) {
    throw new Error("Respons AI kosong.");
  }

  return text;
}

async function callGemini({ apiKey, model, systemPrompt, history, rawPrompt }) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const generativeModel = genAI.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
  });

  const chat = generativeModel.startChat({
    history: buildGeminiHistory(history),
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1000,
    },
  });

  const result = await chat.sendMessage(rawPrompt);
  const text = normalizeContent(result.response?.text?.() || "");
  if (!text) {
    throw new Error("Respons AI kosong.");
  }

  return text;
}

async function tryProvider({ provider, apiKey, models, axiosInstance, systemPrompt, history, rawPrompt }) {
  if (!apiKey) {
    return { ok: false, reason: "API key belum diatur" };
  }

  let lastFailure = "semua model gagal";

  for (const model of models) {
    try {
      let text = "";

      if (provider === "gemini") {
        text = await callGemini({ apiKey, model, systemPrompt, history, rawPrompt });
      } else if (provider === "openai") {
        text = await callChatCompletions({
          axiosInstance,
          endpoint: "https://api.openai.com/v1/chat/completions",
          apiKey,
          model,
          messages: buildChatMessages(systemPrompt, history, rawPrompt),
        });
      } else if (provider === "groq") {
        text = await callChatCompletions({
          axiosInstance,
          endpoint: "https://api.groq.com/openai/v1/chat/completions",
          apiKey,
          model,
          messages: buildChatMessages(systemPrompt, history, rawPrompt),
        });
      } else if (provider === "openrouter") {
        text = await callChatCompletions({
          axiosInstance,
          endpoint: "https://openrouter.ai/api/v1/chat/completions",
          apiKey,
          model,
          messages: buildChatMessages(systemPrompt, history, rawPrompt),
          extraHeaders: {
            "HTTP-Referer": "https://localhost",
            "X-Title": "Cell's Bot",
          },
        });
      } else if (provider === "xai") {
        text = await callChatCompletions({
          axiosInstance,
          endpoint: "https://api.x.ai/v1/chat/completions",
          apiKey,
          model,
          messages: buildChatMessages(systemPrompt, history, rawPrompt),
        });
      }

      return { ok: true, text, model };
    } catch (error) {
      const failure = classifyError(error);
      lastFailure = `${failure.summary}${failure.detail ? ` (${failure.detail})` : ""}`;
      console.error(`[AI:${provider}:${model}]`, failure.detail);

      if (!["not_found", "bad_request"].includes(failure.kind)) {
        break;
      }
    }
  }

  return { ok: false, reason: lastFailure };
}

const KALENDER_ABSOLUT = `
[PANDUAN MUTLAK TANGGAL INDONESIA]:
- Hari/Tanggal Masehi Hari ini: TERLAMPIR DI BAWAH.
`;

module.exports = {
  name: "ai",
  description: "AI Super Canggih dengan Multi-Model Fallback Anti-Error",
  category: "AI & Edukasi",

  async execute(client, msg, args) {
    const rawPrompt = args.join(" ").trim();
    if (!rawPrompt) {
      return msg.reply(
        "Silakan berikan pesan untuk AI.\nContoh: /ai siapa presiden indonesia sekarang?",
      );
    }

    const userId = msg.author || msg.from;

    try {
      const chatState = await msg.getChat();
      chatState.sendStateTyping();

      const userContact = await msg.getContact();
      const userName = userContact.pushname || userContact.name || "User";

      const now = new Date();
      const optionsDt = {
        timeZone: "Asia/Jakarta",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      };
      const currentTimeStr = now.toLocaleString("id-ID", optionsDt);

      let systemPrompt = `Identitas Mutlak: Namamu adalah "Cell". Kamu asisten setia Sastra Coding. Fakta Waktu Dunia Saat Ini: ${currentTimeStr} WIB.
${KALENDER_ABSOLUT}
ATURAN SIFAT & FORMATTING:
1. Penuh Empati, tiru gaya bahasa user (lo-gue/aku-kamu).
2. MULTI-BAHASA SEMPURNA layaknya native speaker.
3. FORMATTING WAJIB: DILARANG KERAS menggunakan karakter asterisk/bintang (*) untuk bold maupun list!
4. Gunakan angka (1, 2, 3) atau strip (-) untuk membuat daftar/list agar terlihat rapi dan terstruktur.
5. Paragraf pendek natural untuk WhatsApp.`;

      const adminIds = parseCsv(process.env.ADMINS);
      if (adminIds.includes(userId)) {
        systemPrompt += `\n[ATURAN PENCIPTA]: Ini adalah BOS BESAR dan PENCIPTAMU. Panggil dia "Tuan" atau "Bos". Tunduk seratus persen!`;
      }

      const db = getMemory();
      if (!db[userId]) {
        db[userId] = { profil: { nama: userName }, riwayat: [] };
      }
      db[userId].profil.nama = userName;

      let history = db[userId].riwayat
        .filter((item) => item?.role && item?.content)
        .map((item) => ({ role: item.role, content: item.content }));

      if (history.length > 4) {
        history = history.slice(-4);
      }

      const providerOrder = getProviderOrder();
      const providerKeys = getProviderKeys();
      const axiosInstance = axios.create({ timeout: 60000 });
      const failures = [];

      let aiReply = "";
      let usedProvider = "";
      let usedModel = "";

      for (const provider of providerOrder) {
        const result = await tryProvider({
          provider,
          apiKey: providerKeys[provider],
          models: getModels(provider),
          axiosInstance,
          systemPrompt,
          history,
          rawPrompt,
        });

        if (result.ok) {
          aiReply = result.text;
          usedProvider = provider;
          usedModel = result.model;
          break;
        }

        failures.push(`${PROVIDER_LABELS[provider]}: ${result.reason}`);
      }

      if (!aiReply) {
        throw new Error(failures.join(" | "));
      }

      db[userId].riwayat.push({ role: "user", content: rawPrompt });
      db[userId].riwayat.push({ role: "assistant", content: aiReply });

      if (db[userId].riwayat.length > 8) {
        db[userId].riwayat = db[userId].riwayat.slice(-8);
      }

      saveMemory(db);
      console.log(`[AI] Provider aktif: ${PROVIDER_LABELS[usedProvider]} (${usedModel})`);
      
      // Hapus paksa semua karakter asterisk dari output akhir untuk memastikan kerapian
      aiReply = aiReply.replace(/\*/g, '');
      
      await msg.reply(aiReply.trim());
    } catch (err) {
      const detail = shortText(err.message, 220);
      console.error("[Ultimate AI Error]", err.message || err);
      await msg.reply(
        `Maaf, semua provider AI lagi gagal dipakai sekarang. Detail singkat: ${detail}. Cek API key, urutan provider, atau tunggu limit reset lalu coba lagi.`,
      );
    }
  },
};
