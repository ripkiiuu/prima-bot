// ============================================================
// commands/ai.js - Chat dengan AI (multi-provider + context memory)
// ============================================================

const axios = require('axios');
const config = require('../config');

const DEFAULT_OPENAI_MODELS = ['gpt-4.1', 'gpt-4o', 'gpt-4o-mini'];
const DEFAULT_GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile'];
const DEFAULT_GEMINI_MODELS = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-lite', 'gemini-2.5-pro-preview-03-25'];
const DEFAULT_OPENROUTER_MODELS = [
  'openai/gpt-4.1',
  'anthropic/claude-3.7-sonnet',
  'google/gemini-2.5-pro',
  'x-ai/grok-4',
];
const DEFAULT_XAI_MODELS = ['grok-2-latest', 'grok-latest'];
const DEFAULT_PROVIDER_ORDER = ['xai', 'openai', 'gemini', 'openrouter', 'groq'];
const HISTORY_LIMIT = 14; // 7 turn (user+assistant)
const MESSAGE_CHAR_LIMIT = 1200;
const chatHistories = new Map();

const SYSTEM_PROMPT = [
  'Kamu adalah asisten chat WhatsApp yang cerdas, natural, dan relevan.',
  'Prioritas utama: jawab pesan user terakhir dengan konteks percakapan sebelumnya.',
  'Aturan:',
  '- Gunakan bahasa Indonesia natural, boleh campur English seperlunya.',
  '- Selalu pakai aku-kamu, hindari gaya terlalu formal atau terlalu lebay.',
  '- Untuk chat santai: jawab singkat (1-3 kalimat) dan langsung nyambung.',
  '- Untuk pertanyaan teknis: beri langkah runtut, konkret, dan mudah dipahami.',
  '- Jika pertanyaan kurang jelas, tanya klarifikasi singkat sebelum menebak.',
  '- Jika tidak yakin, bilang jujur lalu berikan cara cek yang benar.',
  '- Jangan mengarang fakta dan jangan keluar topik.',
].join('\n');

function normalizeText(text) {
  return String(text || '').replace(/\r/g, '').trim();
}

function parseCSV(value) {
  return String(value || '')
    .split(',')
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function getModelChain(modelsVar, modelVar, fallback) {
  const fromModels = parseCSV(process.env[modelsVar]);
  if (fromModels.length) return fromModels;

  const fromSingle = parseCSV(process.env[modelVar]);
  if (fromSingle.length) return fromSingle;

  return [...fallback];
}

function getProviderOrder() {
  const requested = parseCSV(process.env.AI_PROVIDER_ORDER).map((p) => p.toLowerCase());
  const result = [];

  for (const name of [...requested, ...DEFAULT_PROVIDER_ORDER]) {
    if (!result.includes(name)) result.push(name);
  }

  return result;
}

const OPENAI_MODELS = getModelChain('OPENAI_MODELS', 'OPENAI_MODEL', DEFAULT_OPENAI_MODELS);
const GROQ_MODELS = getModelChain('GROQ_MODELS', 'GROQ_MODEL', DEFAULT_GROQ_MODELS);
const GEMINI_MODELS = getModelChain('GEMINI_MODELS', 'GEMINI_MODEL', DEFAULT_GEMINI_MODELS);
const OPENROUTER_MODELS = getModelChain('OPENROUTER_MODELS', 'OPENROUTER_MODEL', DEFAULT_OPENROUTER_MODELS);
const XAI_MODELS = getModelChain('XAI_MODELS', 'XAI_MODEL', DEFAULT_XAI_MODELS);
const PROVIDER_ORDER = getProviderOrder();

function clampText(text, max = MESSAGE_CHAR_LIMIT) {
  const clean = normalizeText(text);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max)}...`;
}

function getChatHistory(chatId) {
  if (!chatHistories.has(chatId)) {
    chatHistories.set(chatId, []);
  }
  return chatHistories.get(chatId);
}

function trimHistory(history) {
  while (history.length > HISTORY_LIMIT) {
    history.shift();
  }
}

function addHistory(chatId, role, content) {
  const safeText = clampText(content);
  if (!safeText) return;

  const history = getChatHistory(chatId);
  history.push({ role, content: safeText });
  trimHistory(history);
}

function clearHistory(chatId) {
  chatHistories.delete(chatId);
}

async function buildUserMessage(msg, rawPrompt) {
  const prompt = clampText(rawPrompt);
  if (!msg.hasQuotedMsg) return prompt;

  try {
    const quotedMsg = await msg.getQuotedMessage();
    const quotedText = clampText(quotedMsg?.body, 600);
    if (!quotedText) return prompt;

    return `Konteks yang sedang aku balas:\n"${quotedText}"\n\nPesan user terbaru:\n${prompt}`;
  } catch {
    return prompt;
  }
}

function buildMessages(chatId, userMessage) {
  const history = getChatHistory(chatId);
  const normalizedHistory = history
    .filter((item) => item.role === 'user' || item.role === 'assistant')
    .map((item) => ({ role: item.role, content: clampText(item.content) }));

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    ...normalizedHistory,
    { role: 'user', content: clampText(userMessage) },
  ];
}

function extractOpenAIText(data) {
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content === 'string') return normalizeText(content);
  if (Array.isArray(content)) {
    return normalizeText(
      content
        .map((part) => (typeof part?.text === 'string' ? part.text : ''))
        .join('\n')
    );
  }

  return '';
}

function classifyError(err) {
  const status = err.response?.status;
  if (status === 429) return 'QUOTA';
  if (status === 401 || status === 403) return 'BAD_KEY';
  return '';
}

function isModelUnavailable(err) {
  const status = err.response?.status;
  const apiMessage = normalizeText(err.response?.data?.error?.message || '').toLowerCase();
  const msg = normalizeText(err.message || '').toLowerCase();
  const haystack = `${apiMessage} ${msg}`;

  if (status === 404) return true;
  if (status !== 400) return false;

  return (
    haystack.includes('model') &&
    (haystack.includes('not found') ||
      haystack.includes('does not exist') ||
      haystack.includes('invalid') ||
      haystack.includes('unknown') ||
      haystack.includes('unsupported'))
  );
}

function errorMessage(err) {
  return normalizeText(err.response?.data?.error?.message || err.message || 'UNKNOWN_ERROR');
}

async function callOpenAICompatible({ key, baseUrl, models, messages, extraHeaders = {} }) {
  if (!key) throw new Error('SKIP');

  const modelErrors = [];

  for (const model of models) {
    try {
      const res = await axios.post(
        `${baseUrl}/chat/completions`,
        {
          model,
          messages,
          max_tokens: 900,
          temperature: 0.35,
        },
        {
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            ...extraHeaders,
          },
          timeout: 30000,
        }
      );

      const text = extractOpenAIText(res.data);
      if (!text) {
        modelErrors.push(`${model}: jawaban kosong`);
        continue;
      }

      return { answer: text, model };
    } catch (err) {
      if (isModelUnavailable(err)) {
        modelErrors.push(`${model}: model tidak tersedia`);
        continue;
      }

      const kind = classifyError(err);
      if (kind) throw new Error(kind);

      modelErrors.push(`${model}: ${errorMessage(err)}`);
    }
  }

  throw new Error(`MODEL_NA ${modelErrors.join(' | ')}`);
}

async function callGroq(messages) {
  return callOpenAICompatible({
    key: process.env.GROQ_API_KEY,
    baseUrl: 'https://api.groq.com/openai/v1',
    models: GROQ_MODELS,
    messages,
  });
}

async function callXAI(messages) {
  return callOpenAICompatible({
    key: process.env.XAI_API_KEY,
    baseUrl: 'https://api.x.ai/v1',
    models: XAI_MODELS,
    messages,
  });
}

async function callOpenAI(messages) {
  return callOpenAICompatible({
    key: process.env.OPENAI_API_KEY,
    baseUrl: 'https://api.openai.com/v1',
    models: OPENAI_MODELS,
    messages,
  });
}

async function callOpenRouter(messages) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('SKIP');

  return callOpenAICompatible({
    key,
    baseUrl: 'https://openrouter.ai/api/v1',
    models: OPENROUTER_MODELS,
    messages,
    extraHeaders: {
      'HTTP-Referer': 'https://localhost',
      'X-Title': "Cell's Bot WA",
    },
  });
}

function buildGeminiPayload(messages) {
  const system = messages.find((m) => m.role === 'system')?.content || SYSTEM_PROMPT;
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: clampText(m.content) }],
    }));

  return {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 900,
    },
  };
}

async function callGemini(messages) {
  const key = config.GEMINI_API_KEY;
  if (!key) throw new Error('SKIP');

  const payload = buildGeminiPayload(messages);
  const modelErrors = [];

  for (const model of GEMINI_MODELS) {
    try {
      const res = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        payload,
        { timeout: 30000 }
      );
      const text = normalizeText(res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '');
      if (text) return { answer: text, model };
      modelErrors.push(`${model}: jawaban kosong`);
    } catch (err) {
      const status = err.response?.status;
      if (status === 404) {
        modelErrors.push(`${model}: model tidak tersedia`);
        continue;
      }
      if (status === 429) throw new Error('QUOTA');
      if (status === 401 || status === 403) throw new Error('BAD_KEY');
      modelErrors.push(`${model}: ${errorMessage(err)}`);
    }
  }

  throw new Error(`MODEL_NA ${modelErrors.join(' | ')}`);
}

async function getAIResponse(messages) {
  const providerMap = {
    xai: { label: 'xAI (Grok)', fn: callXAI },
    openai: { label: 'OpenAI', fn: callOpenAI },
    gemini: { label: 'Gemini', fn: callGemini },
    openrouter: { label: 'OpenRouter', fn: callOpenRouter },
    groq: { label: 'Groq', fn: callGroq },
  };

  const errors = [];

  for (const providerName of PROVIDER_ORDER) {
    const provider = providerMap[providerName];
    if (!provider) continue;

    try {
      const { answer, model } = await provider.fn(messages);
      const providerLabel = model ? `${provider.label} (${model})` : provider.label;
      console.log(`[ai] success via ${providerLabel}`);
      return { answer, provider: providerLabel };
    } catch (err) {
      if (err.message === 'SKIP') continue;
      console.log(`[ai] ${provider.label} failed: ${err.message}`);

      if (err.message === 'QUOTA') {
        errors.push(`${provider.label}: quota habis`);
      } else if (err.message === 'BAD_KEY') {
        errors.push(`${provider.label}: API key invalid atau tidak punya akses`);
      } else if (err.message === 'EMPTY_RESPONSE') {
        errors.push(`${provider.label}: jawaban kosong`);
      } else {
        errors.push(`${provider.label}: ${err.message}`);
      }
    }
  }

  throw new Error(
    `Semua AI provider gagal:\n- ${errors.join('\n- ')}\n\nPastikan minimal satu API key aktif di file .env`
  );
}

module.exports = {
  name: 'ai',
  description: '[teks] Chat AI. Gunakan "/ai reset" untuk reset konteks chat.',
  category: 'AI & Edukasi',

  async execute(client, msg, args) {
    const chatId = msg.from;
    const rawPrompt = normalizeText(args.join(' '));

    if (!rawPrompt) {
      return msg.reply(
        'Cara pakai: /ai [pertanyaan]\nContoh: /ai Jelasin rekursif simpel dong\n\nReset konteks: /ai reset'
      );
    }

    if (['reset', 'clear', 'hapus', 'new', 'baru'].includes(rawPrompt.toLowerCase())) {
      clearHistory(chatId);
      return msg.reply('Konteks AI untuk chat ini sudah direset.');
    }

    const promptForModel = await buildUserMessage(msg, rawPrompt);
    const messages = buildMessages(chatId, promptForModel);

    try {
      const { answer } = await getAIResponse(messages);
      const finalAnswer = clampText(answer, 3500);
      if (!finalAnswer) throw new Error('AI mengembalikan jawaban kosong.');

      addHistory(chatId, 'user', rawPrompt);
      addHistory(chatId, 'assistant', finalAnswer);

      await msg.reply(finalAnswer);
    } catch (err) {
      console.error('[ai] final error:', err.message);
      await msg.reply(`Gagal mendapatkan respons AI.\n\n${err.message}`);
    }
  },
};
