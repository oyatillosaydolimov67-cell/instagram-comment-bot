import express from 'express';
import axios from 'axios';
import { GoogleGenAI } from '@google/genai';

const app = express();
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'yuksak_secure_token_123';
const INSTAGRAM_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Meta Webhook tekshiruvi (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook muvaffaqiyatli tekshirildi!');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Matn generatsiya qilish (Google -> Groq zaxira)
async function generateAIReply(userText) {
  const prompt = `Siz "Yuksak Travel" sayyohlik agentligining samimiy, do'stona va yordam beruvchi Instagram assistentisiz. Mijozning quyidagi izohiga qisqa, tushunarli, o'zbek tilida va emoji ishlatgan holda javob bering:\n\nMijoz izohi: "${userText}"`;

  // 1. Google Gemini orqali urinish
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
    });
    if (response.text) return response.text;
  } catch (err) {
    console.log('Gemini 503 yuklama berdi, zaxira Groq tizimiga o‘tildi...');
  }

  // 2. Agar Gemini band bo'lsa, Groq (GPT-OSS-20B) orqali generatsiya qilish
  if (GROQ_API_KEY) {
    const groqRes = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'openai/gpt-oss-20b',
        messages: [
          { role: 'system', content: 'Siz "Yuksak Travel" sayyohlik agentligining samimiy assistentisiz. Qisqa, o\'zbekcha va emoji bilan javob yozing.' },
          { role: 'user', content: userText }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return groqRes.data.choices[0].message.content;
  }

  throw new Error('Hech qaysi AI xizmatidan javob olinmadi.');
}

// Izohlarni qabul qilish va javob qaytarish (POST)
app.post('/webhook', async (req, res) => {
  res.status(200).send('EVENT_RECEIVED');

  try {
    const body = req.body;

    if (body.object === 'instagram') {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.field === 'comments') {
            const comment = change.value;
            const commentId = comment.id;
            const userText = comment.text;

            if (!userText || !commentId) continue;

            console.log(`Yangi izoh keldi: "${userText}"`);

            const replyText = await generateAIReply(userText);
            console.log(`AI javobi: "${replyText}"`);

            // Instagram izohiga javob yuborish
            await axios.post(
              `https://graph.facebook.com/v26.0/${commentId}/replies`,
              { message: replyText },
              { params: { access_token: INSTAGRAM_TOKEN } }
            );

            console.log(`Javob muvaffaqiyatli yuborildi! 🎉`);
          }
        }
      }
    }
  } catch (error) {
    console.error('Xatolik tafsiloti:', error.response?.data || error.message);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server ${PORT}-portda ishga tushdi`);
});
