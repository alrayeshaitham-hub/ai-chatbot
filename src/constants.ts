import { PersonaPreset, ModelOption } from './types';

export const DEFAULT_MODELS: ModelOption[] = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    tag: 'Flagship & Fast',
    description: 'Ultra-fast, highly intelligent Gemini model with deep multimodal and thinking support.',
    supportsThinking: true,
    supportsSearch: true,
    default: true,
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    tag: 'Deep Reasoning',
    description: 'Advanced reasoning, complex logic puzzles, and high-precision STEM architecture.',
    supportsThinking: true,
    supportsSearch: true,
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    tag: 'Ultra Low Latency',
    description: 'Lightweight and instant response speed for quick queries and edits.',
    supportsThinking: false,
    supportsSearch: true,
  },
];

export const PERSONA_PRESETS: PersonaPreset[] = [
  {
    id: 'general',
    name: 'Nova Assistant',
    description: 'Versatile, intelligent, warm, and highly capable companion for any topic.',
    icon: 'Sparkles',
    badge: 'Default',
    systemInstruction:
      'You are Nova, an exceptionally capable, thoughtful, and friendly AI chatbot. You provide accurate, clear, and engaging explanations. Format your output with clean Markdown, structured headings, code blocks with syntax tags, and bullet points where helpful. Be empathetic and proactive.',
  },
  {
    id: 'coder',
    name: 'Staff Software Architect',
    description: 'Expert in modern algorithms, system design, debugging, and clean code.',
    icon: 'Code2',
    badge: 'Technical',
    systemInstruction:
      'You are a Staff Software Engineer and Architecture Lead. Write production-grade, modular, self-documenting code with comprehensive TypeScript/language types, error handling, and performance considerations. Explain tradeoffs clearly and suggest idiomatic best practices.',
  },
  {
    id: 'writer',
    name: 'Creative Wordsmith',
    description: 'Storyteller, copywriter, poet, and creative brainstorming partner.',
    icon: 'PenTool',
    badge: 'Creative',
    systemInstruction:
      'You are an award-winning author and creative copywriter. You craft vivid prose, captivating hooks, punchy headlines, and evocative metaphors. Avoid clichés and provide imaginative, tailored output.',
  },
  {
    id: 'analyst',
    name: 'Academic & Research Analyst',
    description: 'Deep analytical synthesis, rigorous logic, and structured breakdowns.',
    icon: 'GraduationCap',
    badge: 'Analytical',
    systemInstruction:
      'You are a rigorous senior research analyst and professor. Break down intricate topics with first-principles reasoning, empirical nuance, balanced perspectives, and logical clarity. Cite caveats and counter-arguments when relevant.',
  },
  {
    id: 'executive',
    name: 'Executive Briefing',
    description: 'Zero fluff, high-impact bullet points, actionable summaries.',
    icon: 'Briefcase',
    badge: 'Concise',
    systemInstruction:
      'You are an executive chief of staff. Deliver rapid, ultra-concise, high-impact briefings. Structure responses with: 1. Core Takeaway (1-2 sentences), 2. Key Insights (3-5 bullets), 3. Recommended Actions.',
  },
];

export const STARTER_SUGGESTIONS = [
  {
    title: 'Explain Quantum Computing',
    desc: 'Break down qubits and superposition in simple terms',
    category: 'Science',
    prompt: 'Explain quantum computing and quantum superposition like I am an intelligent 12-year-old, using a relatable coin flip analogy.',
  },
  {
    title: 'Debug & Refactor Code',
    desc: 'Analyze a tricky async race condition',
    category: 'Coding',
    prompt: 'Can you show me how to handle race conditions in React useEffect data fetching with AbortController, with clean TypeScript examples?',
  },
  {
    title: 'Startup Growth Strategy',
    desc: 'Draft a 30-day go-to-market launch plan',
    category: 'Business',
    prompt: 'Draft an actionable, week-by-week 30-day go-to-market plan for a B2B developer tool SaaS with zero initial marketing budget.',
  },
  {
    title: 'Creative Worldbuilding',
    desc: 'Invent an original sci-fi planetary civilization',
    category: 'Writing',
    prompt: 'Describe a fictional underwater civilization on Jupiter\'s moon Europa that communicates entirely through bioluminescent light pulses and thermal vibrations.',
  },
];

export const TTS_VOICES = [
  { id: 'Kore', name: 'Kore (Calm & Clear)', gender: 'Female' },
  { id: 'Puck', name: 'Puck (Upbeat & Warm)', gender: 'Male' },
  { id: 'Fenrir', name: 'Fenrir (Deep & Resonant)', gender: 'Male' },
  { id: 'Zephyr', name: 'Zephyr (Bright & Friendly)', gender: 'Female' },
  { id: 'Charon', name: 'Charon (Thoughtful & Measured)', gender: 'Male' },
];
