import express from 'express';
import axios from 'axios';
import { GoogleGenAI } from '@google/genai';

const app = express();
app.use(express.json());

// Gemini API ulanishi
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'yuksak_secure_token_123';
const INSTAGRAM_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;

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

// Izohlarni qabul qilish va javob qaytarish (POST)
app.post('/webhook', async (req, res) => {
  // Meta'ga darhol javob berish (Kutib qolmasligi uchun)
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

            // Bo'sh yoki xato qiymatlarni o'tkazib yuborish
            if (!userText || !commentId) continue;

            console.log(`Yangi izoh keldi: "${userText}"`);

            // Eng yangi va rasmiy model: Gemini 3.7 Flash
            const response = await ai.models.generateContent({
              model: 'gemini-3.7-flash',
              contents: `Siz "Yuksak Travel" sayyohlik agentligining samimiy, do'stona va yordam beruvchi Instagram assistentisiz. Mijozning quyidagi izohiga qisqa, tushunarli, o'zbek tilida va emoji ishlatgan holda javob bering:\n\nMijoz izohi: "${userText}"`,
            });

            const replyText = response.text;
            console.log(`Gemini javobi: "${replyText}"`);

            // Instagram izohiga javob qaytarish
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
    console.error('Xatolik:', error.response?.data || error.message);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server ${PORT}-portda ishga tushdi`);
});
