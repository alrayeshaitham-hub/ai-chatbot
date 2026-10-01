export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  data: string; // Base64 encoded string
  size?: number;
  previewUrl?: string;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  attachments?: Attachment[];
  groundingChunks?: GroundingChunk[];
  webSearchQueries?: string[];
  isStreaming?: boolean;
  error?: string;
}

export interface PersonaPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  systemInstruction: string;
  badge?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  personaId: string;
  customSystemInstruction?: string;
  model: string;
  searchGrounding: boolean;
  thinkingLevel: 'HIGH' | 'LOW' | 'MINIMAL';
}

export interface ModelOption {
  id: string;
  name: string;
  tag: string;
  description: string;
  supportsThinking: boolean;
  supportsSearch: boolean;
  default?: boolean;
}
