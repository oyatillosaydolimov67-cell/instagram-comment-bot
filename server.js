import express from 'express';
import axios from 'axios';
import { GoogleGenAI } from '@google/genai';

const app = express();
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'yuksak_secure_token_123';
const INSTAGRAM_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;

// Meta Webhook tekshiruvi
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Yangi izoh kelganda ishlovchi qism
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (change?.field === 'comments' && value && value.from?.id !== entry?.id) {
      const commentId = value.id;
      const userText = value.text;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userText,
        config: {
          systemInstruction: "Siz 'Yuksak Travel' sayohat agentligining xushmuomala yordamchisisiz. Kommentlarga o'zbek tilida samimiy, qisqa (1 ta gap), duo va iliq so'zlar bilan javob yozing (masalan: 'Ilohim amin! 🤲', 'Alloh rozi boʻlsin! Ziyoratlar nasib qilsin ✨'). Agar narx yoki ma'lumot so'ralsa, 'Batafsil ma'lumot Direct orqali yuborildi 📩' deb qisqa javob qaytaring."
        }
      });

      const replyText = response.text?.trim() || "Rahmat! Ziyoratlar nasib qilsin 🤲";

      await axios.post(
        `https://graph.facebook.com/v21.0/${commentId}/replies`,
        { message: replyText },
        { headers: { Authorization: `Bearer ${INSTAGRAM_TOKEN}` } }
      );
    }
  } catch (error) {
    console.error('Xatolik:', error?.response?.data || error.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server ${PORT}-portda ishga tushdi`));
