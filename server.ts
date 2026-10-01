import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '35mb' }));

// Initialize Google GenAI client
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    hasKey: Boolean(process.env.GEMINI_API_KEY),
    time: new Date().toISOString(),
  });
});

// Models list endpoint
app.get('/api/models', (_req, res) => {
  res.json([
    {
      id: 'gemini-3.8-flash',
      name: 'Gemini 3.8 Flash',
      tag: 'Fast & Versatile',
      description: 'Default flagship model for high-speed, high-intelligence dialogue, reasoning, and multimodal understanding.',
      supportsThinking: true,
      supportsSearch: true,
      default: true,
    },
    {
      id: 'gemini-3.1-pro-preview',
      name: 'Gemini 3.1 Pro Preview',
      tag: 'Deep Reasoning',
      description: 'Advanced reasoning, deep technical analysis, complex coding, and multi-step logic.',
      supportsThinking: true,
      supportsSearch: true,
      default: false,
    },
    {
      id: 'gemini-3.1-flash-lite',
      name: 'Gemini 3.1 Flash Lite',
      tag: 'Ultra Fast',
      description: 'Lightweight and ultra-low latency for instant casual conversations and simple tasks.',
      supportsThinking: false,
      supportsSearch: true,
      default: false,
    },
  ]);
});

// Conversation Title Generator
app.post('/api/generate-title', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.json({ title: 'New Conversation' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Create a brief, punchy title (maximum 4-5 words, no quotation marks, no emojis) that describes this user conversation prompt:\n\n"${prompt.slice(0, 300)}"`,
      config: {
        systemInstruction: 'Respond only with the title text. Do not add punctuation or quotes.',
        temperature: 0.3,
      },
    });

    const title = response.text?.trim() || 'New Conversation';
    res.json({ title });
  } catch (error: any) {
    console.error('Title generation error:', error?.message || error);
    res.json({ title: 'New Conversation' });
  }
});

// SSE Streaming Chat Endpoint
app.post('/api/chat/stream', async (req, res) => {
  const {
    messages,
    systemInstruction,
    model = 'gemini-3.8-flash',
    thinkingLevel = 'HIGH',
    searchGrounding = false,
    temperature = 0.7,
  } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY is not configured in the environment. Please check the Secrets panel.',
    });
  }

  // Format messages into Gemini format
  const formattedContents = messages.map((m: any) => {
    const parts: any[] = [];

    // Add attachments (images, PDFs, text files)
    if (Array.isArray(m.attachments)) {
      for (const att of m.attachments) {
        if (att.data && att.mimeType) {
          parts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: att.data,
            },
          });
        }
      }
    }

    // Add text content
    if (m.text && typeof m.text === 'string') {
      parts.push({ text: m.text });
    }

    return {
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts,
    };
  });

  // Prepare configuration
  const config: any = {
    temperature: typeof temperature === 'number' ? temperature : 0.7,
  };

  if (systemInstruction && typeof systemInstruction === 'string' && systemInstruction.trim()) {
    config.systemInstruction = systemInstruction.trim();
  }

  // Thinking level configuration (Gemini 3 series)
  if (model.startsWith('gemini-3')) {
    if (thinkingLevel === 'LOW') {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
    } else if (thinkingLevel === 'MINIMAL' && model !== 'gemini-3.1-pro-preview') {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
    } else if (thinkingLevel === 'HIGH') {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
    }
  }

  // Grounding with Google Search
  if (searchGrounding) {
    config.tools = [{ googleSearch: {} }];
  }

  // Set SSE response headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let clientDisconnected = false;
  req.on('close', () => {
    clientDisconnected = true;
  });

  try {
    const stream = await ai.models.generateContentStream({
      model,
      contents: formattedContents,
      config,
    });

    let accumulatedGroundingChunks: any[] = [];
    let accumulatedSearchQueries: string[] = [];

    for await (const chunk of stream) {
      if (clientDisconnected) break;

      const chunkText = chunk.text || '';
      const grounding = chunk.candidates?.[0]?.groundingMetadata;

      if (grounding?.groundingChunks) {
        accumulatedGroundingChunks = grounding.groundingChunks;
      }
      if (grounding?.webSearchQueries) {
        accumulatedSearchQueries = grounding.webSearchQueries;
      }

      const payload = {
        text: chunkText,
        groundingChunks: accumulatedGroundingChunks.length > 0 ? accumulatedGroundingChunks : undefined,
        webSearchQueries: accumulatedSearchQueries.length > 0 ? accumulatedSearchQueries : undefined,
      };

      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }

    if (!clientDisconnected) {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    }
  } catch (error: any) {
    console.error('Gemini chat streaming error:', error);
    if (!clientDisconnected) {
      const errorMessage = error?.message || 'An error occurred while generating response';
      res.write(`data: ${JSON.stringify({ error: errorMessage, done: true })}\n\n`);
      res.end();
    }
  }
});

// Text-to-Speech endpoint using gemini-3.8-flash-lite-tts
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voiceName = 'Kore' } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    // Limit text length to prevent excessively long audio generation
    const cleanText = text.slice(0, 1000).replace(/[*#`_\[\]()]/g, '');

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [{ text: cleanText }],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.status(500).json({ error: 'No audio returned by speech model' });
    }

    res.json({
      audio: base64Audio,
      mimeType: 'audio/wav',
    });
  } catch (error: any) {
    console.error('TTS error:', error?.message || error);
    res.status(500).json({ error: error?.message || 'Failed to generate speech' });
  }
});

// Real-time Voice Conversation Turn: handles audio input or text, returns transcript, reply, and TTS audio
app.post('/api/voice-turn', async (req, res) => {
  try {
    const { messages = [], audio, mimeType = 'audio/webm', text, voiceName = 'Kore' } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    if (!audio && !text) {
      return res.status(400).json({ error: 'Audio or text input is required' });
    }

    // Format previous messages for conversation context
    const previousContents = (messages || []).slice(-8).map((m: any) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.text }],
    }));

    let userTranscript = text || '';
    let replyText = '';

    if (audio) {
      // Direct multimodal audio comprehension with Gemini 3.8 Flash
      const cleanMime = mimeType.split(';')[0] || 'audio/webm';
      const userParts: any[] = [
        {
          inlineData: {
            mimeType: cleanMime,
            data: audio,
          },
        },
        {
          text: `You are in a live spoken voice conversation.
1. Transcribe what the user said in the audio verbatim into "userTranscript".
2. Provide your concise, natural, warm spoken reply (1 to 2 spoken sentences, no markdown, no asterisks, no lists) in "replyText".
Return JSON format:
{"userTranscript": "words spoken by user", "replyText": "your spoken answer"}`,
        },
      ];

      const textResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          ...previousContents,
          {
            role: 'user',
            parts: userParts,
          },
        ],
        config: {
          systemInstruction:
            'You are Nova, an intelligent voice companion in a spoken dialogue. Understand spoken audio directly, transcribe it, and provide warm, concise, conversational replies.',
          responseMimeType: 'application/json',
          temperature: 0.7,
        },
      });

      try {
        const parsed = JSON.parse(textResponse.text || '{}');
        userTranscript = parsed.userTranscript || 'Voice message';
        replyText = parsed.replyText || "I'm listening.";
      } catch (parseErr) {
        replyText = textResponse.text?.trim() || "I'm here.";
        userTranscript = 'Voice message';
      }
    } else {
      // Text fallback
      const textResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          ...previousContents,
          {
            role: 'user',
            parts: [{ text }],
          },
        ],
        config: {
          systemInstruction:
            'You are Nova, in a spoken voice conversation. Respond warmly, naturally, and concisely (1 to 2 spoken sentences, no markdown).',
          temperature: 0.7,
        },
      });

      replyText = textResponse.text?.trim() || "I'm here.";
    }

    // Generate speech audio with Gemini TTS
    let base64Audio: string | null = null;
    try {
      const cleanSpeech = replyText.replace(/[*#`_\[\]()]/g, '').slice(0, 600);
      const audioResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [{ text: cleanSpeech }],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' },
            },
          },
        },
      });

      base64Audio =
        audioResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    } catch (ttsErr) {
      console.error('TTS generation failed in voice turn:', ttsErr);
    }

    res.json({
      userTranscript: userTranscript || 'Voice message',
      text: replyText,
      audio: base64Audio,
      mimeType: 'audio/wav',
    });
  } catch (error: any) {
    console.error('Voice turn error:', error);
    res.status(500).json({ error: error?.message || 'Voice turn generation failed' });
  }
});

// Vite Middleware for development vs Static files for production
const startServer = async () => {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
};

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
