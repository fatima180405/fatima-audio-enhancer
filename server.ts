import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  const getAi = () => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    return new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  };

  // API endpoint for transcribing audio chunk via Gemini
  app.post('/api/transcribe', async (req, res) => {
    try {
      const ai = getAi();
      if (!ai) {
        return res.status(400).json({
          error: 'Chưa cấu hình GEMINI_API_KEY trong hệ thống.',
        });
      }

      const { audioBase64, mimeType } = req.body;
      if (!audioBase64) {
        return res.status(400).json({ error: 'Thiếu dữ liệu audioBase64.' });
      }

      const audioPart = {
        inlineData: {
          mimeType: mimeType || 'audio/mp3',
          data: audioBase64,
        },
      };

      const promptPart = {
        text: 'Lắng nghe đoạn âm thanh này và gõ lại CHÍNH XÁC nội dung câu nói (transcript). Chỉ trả về văn bản đã chuyển thành chữ (bằng tiếng Việt hoặc ngôn ngữ trong audio), KHÔNG thêm bất kỳ lời chào, giải thích, hay ký tự ngoặc kép thừa nào.',
      };

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: { parts: [audioPart, promptPart] },
      });

      const text = response.text ? response.text.trim() : '';
      return res.json({ text });
    } catch (err: any) {
      console.error('Transcription error:', err);
      return res.status(500).json({ error: err.message || 'Lỗi khi gọi Gemini API để transcribe.' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
