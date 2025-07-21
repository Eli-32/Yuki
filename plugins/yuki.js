import axios from 'axios';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), 'api.env') });

// === CONFIGURE YOUR KEYS HERE ===
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error('Missing required API keys in environment variables. Please check api.env for GEMINI_API_KEY.');
}

const activeUsers = new Map();

// Gemini API chat call
async function askGemini(prompt) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }]
  };
  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
    body,
    { headers: { 'Content-Type': 'application/json' } }
  );
  return res?.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'ما فهمت عليك، فسّرلي أكتر!';
}

// Build prompt for Gemini with personality
function buildPrompt(message) {
  return `
انت بوت اسمه يوكي، بتتكلم باللهجة اللبنانية.
ردودك قصيرة، بسيطة، وودية. اذا حد شتمك بترد بعصبية.
هيدا النص يلي بدك تجاوب عليه: "${message}"
جاوب وكأنك انسان لبناني حقيقي.
`;
}

// --- Python TTS integration ---
function pythonTTS(text, userId) {
  return new Promise((resolve, reject) => {
    const tempDir = './tmp';
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    const fileName = `${userId.replace(/[@:]/g, '_')}_yuki_${Date.now()}.wav`;
    const outputPath = path.join(tempDir, fileName);
    // Use python or python3 depending on your system
    execFile('python', ['yuki_tts.py', text, outputPath], (error) => {
      if (error) return reject(error);
      fs.readFile(outputPath, (err, data) => {
        if (err) return reject(err);
        fs.unlink(outputPath, () => {}); // optional cleanup
        resolve(data);
      });
    });
  });
}

// --- Functionalized helpers ---
function activateYukiForUser(userId) {
  activeUsers.set(userId, true);
}

function isYukiActiveForUser(userId) {
  return !!activeUsers.get(userId);
}

async function sendTextReply(conn, m, reply) {
  await conn.sendMessage(m.chat, {
    text: reply,
    quoted: m
  });
}

async function sendVoiceReply(conn, m, reply, userId) {
  try {
    const audioBuffer = await pythonTTS(reply, userId);
    await conn.sendMessage(m.chat, {
      audio: audioBuffer,
      mimetype: 'audio/wav',
      ptt: true
    }, { quoted: m });
  } catch (err) {
    console.error('Yuki TTS error:', err);
    await sendTextReply(conn, m, reply);
  }
}

async function handleYukiMessage(m, conn) {
  const text = (m.text || '').trim();
  const userId = m.sender;

  // Activate Yuki with .يوكي
  if (text.startsWith('.يوكي')) {
    activateYukiForUser(userId);
    return sendTextReply(conn, m, 'أهلا فيك! صار فيك تحكي معي بلا ما تكتب .يوكي 😊');
  }

  if (!isYukiActiveForUser(userId)) return;

  // Generate Gemini chat response
  const prompt = buildPrompt(text);
  const reply = await askGemini(prompt);

  // Random chance 30% to reply with voice
  if (Math.random() < 0.3) {
    await sendVoiceReply(conn, m, reply, userId);
  } else {
    await sendTextReply(conn, m, reply);
  }
}

export default {
  name: 'yuki',
  description: 'Yuki bot: Gemini chat + local Python TTS voice replies',
  command: false,
  async handler(m, { conn }) {
    try {
      await handleYukiMessage(m, conn);
    } catch (err) {
      console.error('Yuki error:', err);
      await sendTextReply(conn, m, 'صار في مشكلة بالرد، جرب بعدين 🙏');
    }
  }
};
