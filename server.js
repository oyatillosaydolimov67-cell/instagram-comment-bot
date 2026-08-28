import express from 'express';
import axios from 'axios';

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'yuksak_secure_token_123';
const INSTAGRAM_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Webhook tekshiruvi (GET)
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

            // 1. AI orqali javob generatsiya qilish (Groq GPT-OSS-20B)
            const groqRes = await axios.post(
              'https://api.groq.com/openai/v1/chat/completions',
              {
                model: 'openai/gpt-oss-20b',
                messages: [
                  {
                    role: 'system',
                    content: 'Siz "Yuksak Travel" sayyohlik agentligining samimiy, do\'stona va yordam beruvchi Instagram assistentisiz. Mijozning izohiga qisqa, tushunarli, o\'zbek tilida va emoji ishlatgan holda javob bering.'
                  },
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

            const replyText = groqRes.data.choices[0].message.content;
            console.log(`AI javobi: "${replyText}"`);

            // 2. Instagram izohiga javob yuborish
            await axios.post(
              `https://graph.facebook.com/v26.0/${commentId}/replies`,
              { message: replyText },
              { params: { access_token: INSTAGRAM_TOKEN } }
            );

            console.log('Javob muvaffaqiyatli yuborildi! 🎉');
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
