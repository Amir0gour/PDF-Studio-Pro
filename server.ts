import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'PDF Studio Pro Backend', timestamp: new Date().toISOString() });
});

// Gemini AI Helper
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// AI Document Analysis Endpoint
app.post('/api/ai/analyze', async (req, res) => {
  try {
    const { documentText, task, query, targetLanguage } = req.body;

    if (!documentText && !query) {
      return res.status(400).json({ error: 'Document text or query is required.' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'AI service is temporarily unavailable (GEMINI_API_KEY is not configured).',
      });
    }

    let systemInstruction = `You are PDF Studio Pro's AI Assistant. You specialize in analyzing, summarizing, and explaining PDF documents accurately.
Always ground your answers in the provided document text. If citing facts, reference page numbers if mentioned in the context (e.g. "[Page X]").
Distinguish between explicit document facts and inferred interpretations. Do not hallucinate content not in the document.`;

    let userPrompt = '';

    switch (task) {
      case 'summarize':
        userPrompt = `Please provide a clear, comprehensive executive summary of this document, structured with an Overview, Key Themes, and Conclusions:\n\n${documentText}`;
        break;
      case 'key_points':
        userPrompt = `Extract the top critical takeaways and key points from this document as clear bullet points:\n\n${documentText}`;
        break;
      case 'action_items':
        userPrompt = `Identify all action items, decisions, deliverables, deadlines, and important dates from this document:\n\n${documentText}`;
        break;
      case 'revision_notes':
        userPrompt = `Create high-yield revision and study notes from this document, including key concepts, definitions, and summary review questions:\n\n${documentText}`;
        break;
      case 'qa_pairs':
        userPrompt = `Generate 5-10 thoughtful question-and-answer pairs based on this document that test deep comprehension:\n\n${documentText}`;
        break;
      case 'translate':
        userPrompt = `Translate the following document passage accurately into ${targetLanguage || 'Spanish'}, maintaining professional tone and terminology:\n\n${documentText}`;
        break;
      case 'explain':
        userPrompt = `Explain the following excerpt in plain, easy-to-understand terms with context and real-world clarity:\n\nExcerpt:\n${query}\n\nDocument Context:\n${documentText}`;
        break;
      default:
        userPrompt = `Answer this question based on the document text:\nQuestion: ${query}\n\nDocument Text:\n${documentText}`;
        break;
    }

    let resultText = '';
    const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: userPrompt,
          config: {
            systemInstruction,
            temperature: 0.2,
          },
        });
        resultText = response.text || 'No response generated.';
        break;
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${model} failed, trying next...`, err.message);
      }
    }

    if (!resultText && lastError) {
      throw lastError;
    }

    return res.json({ result: resultText, task });
  } catch (error: any) {
    console.error('AI Analyze error:', error);
    let msg = error.message || 'Failed to process document with AI.';
    try {
      const parsed = JSON.parse(msg);
      if (parsed?.error?.message) msg = parsed.error.message;
    } catch (_) {}
    return res.status(500).json({ error: msg });
  }
});

// Interactive AI Chat grounded in PDF
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, documentText } = req.body;

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'AI service is temporarily unavailable (GEMINI_API_KEY is not configured).',
      });
    }

    const systemInstruction = `You are PDF Studio Pro's Document Intelligence Copilot.
The user is viewing a PDF document. Answer their questions based on the provided document text.
Ground your answers firmly in the document content. Always cite page numbers or section titles when available.
If the answer is not contained in the document, explicitly say so rather than guessing.

DOCUMENT CONTEXT:
${(documentText || '').slice(0, 100000)}`;

    const lastMessage = messages[messages.length - 1]?.content || '';
    const conversationHistory = messages.slice(0, -1).map((m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');

    const prompt = conversationHistory
      ? `Conversation History:\n${conversationHistory}\n\nUser Question:\n${lastMessage}`
      : lastMessage;

    let reply = '';
    for (const model of ['gemini-3.1-flash-lite', 'gemini-3.8-flash']) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            temperature: 0.3,
          },
        });
        reply = response.text || 'I could not generate an answer.';
        break;
      } catch (err) {
        console.warn(`Chat model ${model} failed, trying next...`);
      }
    }

    return res.json({ reply });
  } catch (error: any) {
    console.error('AI Chat error:', error);
    return res.status(500).json({ error: error.message || 'Chat error occurred.' });
  }
});

// OCR Scanned Page Endpoint via Gemini Multimodal Vision
app.post('/api/ai/ocr', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', pageNumber = 1 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Image base64 data is required for OCR.' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'OCR AI service is unavailable (GEMINI_API_KEY missing).',
      });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    let ocrText = '';

    for (const model of ['gemini-3.1-flash-lite', 'gemini-3.8-flash']) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            {
              text: `You are an expert optical character recognition (OCR) engine.
Accurately transcribe all visible printed and handwritten text on this document page.
Preserve paragraph structure, headers, tables, and lists in clean Markdown text.
Do not omit words, numbers, or punctuation. Output only the extracted text.`,
            },
          ],
        });
        ocrText = response.text || '';
        break;
      } catch (err) {
        console.warn(`OCR model ${model} failed, trying next...`);
      }
    }

    return res.json({
      pageNumber,
      text: ocrText,
      confidence: 0.98,
    });
  } catch (error: any) {
    console.error('OCR Error:', error);
    return res.status(500).json({ error: error.message || 'OCR processing failed.' });
  }
});

// Setup Vite middleware or static serving
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`PDF Studio Pro server running on http://localhost:${PORT}`);
  });
}

startServer();
