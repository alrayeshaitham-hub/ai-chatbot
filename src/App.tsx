/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  Plus,
  Headphones,
  Settings as SettingsIcon,
  Download,
  ArrowDown,
} from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { SettingsModal } from './components/SettingsModal';
import { VoiceConversationModal } from './components/VoiceConversationModal';
import { ChatSession, Message, Attachment, GroundingChunk } from './types';

const STORAGE_KEY = 'nova_ai_sessions_v1';
const PREFS_KEY = 'nova_ai_prefs_v1';

const createInitialSession = (): ChatSession => ({
  id: `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  title: 'New Chat',
  messages: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  personaId: 'general',
  model: 'gemini-3.8-flash',
  searchGrounding: false,
  thinkingLevel: 'HIGH',
});

const MINIMAL_SUGGESTIONS = [
  'Explain quantum computing simply',
  'Brainstorm ideas for an indie project',
  'Help debug a tricky React bug',
  'Draft a polite follow-up email',
];

export default function App() {
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [customSystemInstruction, setCustomSystemInstruction] = useState('');
  const [defaultModel, setDefaultModel] = useState('gemini-3.8-flash');
  const [defaultThinkingLevel, setDefaultThinkingLevel] = useState<'HIGH' | 'LOW' | 'MINIMAL'>('HIGH');
  const [defaultSearchGrounding, setDefaultSearchGrounding] = useState(false);

  // Chat sessions state
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return [createInitialSession()];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    return sessions[0]?.id || '';
  });

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [editingInputText, setEditingInputText] = useState<string>('');
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load preferences
  useEffect(() => {
    try {
      const storedPrefs = localStorage.getItem(PREFS_KEY);
      if (storedPrefs) {
        const parsed = JSON.parse(storedPrefs);
        if (parsed.voice) setSelectedVoice(parsed.voice);
        if (parsed.instruction) setCustomSystemInstruction(parsed.instruction);
        if (parsed.model) setDefaultModel(parsed.model);
        if (parsed.thinking) setDefaultThinkingLevel(parsed.thinking);
        if (parsed.search !== undefined) setDefaultSearchGrounding(parsed.search);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Save sessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.error(e);
    }
  }, [sessions]);

  const currentSession =
    sessions.find((s) => s.id === activeSessionId) || sessions[0] || createInitialSession();

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom('smooth');
  }, [currentSession?.messages?.length, isStreaming]);

  const handleScroll = () => {
    if (!chatScrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatScrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
    setShowScrollBottom(!isNearBottom);
  };

  const handleNewSession = () => {
    const newSession = createInitialSession();
    newSession.model = defaultModel;
    newSession.thinkingLevel = defaultThinkingLevel;
    newSession.searchGrounding = defaultSearchGrounding;
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const handleDeleteSession = (id: string) => {
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== id);
      if (filtered.length === 0) {
        const fresh = createInitialSession();
        setActiveSessionId(fresh.id);
        return [fresh];
      }
      if (activeSessionId === id) {
        setActiveSessionId(filtered[0].id);
      }
      return filtered;
    });
  };

  const handleRenameSession = (id: string, newTitle: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: newTitle, updatedAt: Date.now() } : s))
    );
  };

  const handleClearAllSessions = () => {
    if (confirm('Clear all conversation history?')) {
      const fresh = createInitialSession();
      setSessions([fresh]);
      setActiveSessionId(fresh.id);
    }
  };

  const handleSaveSettings = (instruction: string) => {
    setCustomSystemInstruction(instruction);
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({
          voice: selectedVoice,
          instruction,
          model: defaultModel,
          thinking: defaultThinkingLevel,
          search: defaultSearchGrounding,
        })
      );
    } catch (e) {
      console.error(e);
    }
  };

  // Add voice convo message turn to chat session
  const handleVoiceMessageTurn = (userSpeech: string, assistantReply: string) => {
    const userMsg: Message = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      text: userSpeech,
      timestamp: Date.now(),
    };
    const botMsg: Message = {
      id: `msg_bot_${Date.now()}`,
      role: 'assistant',
      text: assistantReply,
      timestamp: Date.now(),
    };

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSessionId) {
          const isFirst = s.messages.length === 0;
          return {
            ...s,
            messages: [...s.messages, userMsg, botMsg],
            title: isFirst ? userSpeech.slice(0, 28) : s.title,
            updatedAt: Date.now(),
          };
        }
        return s;
      })
    );
  };

  // Send message and stream response from Gemini API
  const handleSendMessage = async (text: string, attachments: Attachment[] = []) => {
    if ((!text.trim() && attachments.length === 0) || isStreaming) return;

    const userMessageId = `msg_user_${Date.now()}`;
    const assistantMessageId = `msg_assistant_${Date.now()}`;

    const userMessage: Message = {
      id: userMessageId,
      role: 'user',
      text,
      attachments,
      timestamp: Date.now(),
    };

    const initialAssistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      text: '',
      timestamp: Date.now(),
      isStreaming: true,
    };

    const updatedMessages = [...currentSession.messages, userMessage, initialAssistantMessage];
    const isFirstMessage = currentSession.messages.length === 0;

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages: updatedMessages,
            title: isFirstMessage
              ? text.slice(0, 30) + (text.length > 30 ? '...' : '')
              : s.title,
            updatedAt: Date.now(),
          };
        }
        return s;
      })
    );

    if (isFirstMessage && text.trim()) {
      fetch('/api/generate-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.title) {
            handleRenameSession(activeSessionId, data.title);
          }
        })
        .catch(console.error);
    }

    setIsStreaming(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const historyToSend = [...currentSession.messages, userMessage].map((m) => ({
        role: m.role,
        text: m.text,
        attachments: m.attachments,
      }));

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyToSend,
          systemInstruction:
            customSystemInstruction.trim() ||
            'You are Nova, an intelligent, helpful, and concise assistant.',
          model: currentSession.model,
          thinkingLevel: currentSession.thinkingLevel,
          searchGrounding: currentSession.searchGrounding,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Error ${response.status}`);
      }

      if (!response.body) throw new Error('No stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';
      let groundingChunks: GroundingChunk[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            if (!jsonStr) continue;

            try {
              const data = JSON.parse(jsonStr);

              if (data.error) {
                setSessions((prev) =>
                  prev.map((s) => {
                    if (s.id === activeSessionId) {
                      const msgs = s.messages.map((m) =>
                        m.id === assistantMessageId
                          ? { ...m, isStreaming: false, error: data.error }
                          : m
                      );
                      return { ...s, messages: msgs };
                    }
                    return s;
                  })
                );
                break;
              }

              if (data.text) accumulatedText += data.text;
              if (data.groundingChunks) groundingChunks = data.groundingChunks;

              setSessions((prev) =>
                prev.map((s) => {
                  if (s.id === activeSessionId) {
                    const msgs = s.messages.map((m) =>
                      m.id === assistantMessageId
                        ? {
                            ...m,
                            text: accumulatedText,
                            groundingChunks:
                              groundingChunks.length > 0 ? groundingChunks : undefined,
                            isStreaming: !data.done,
                          }
                        : m
                    );
                    return { ...s, messages: msgs };
                  }
                  return s;
                })
              );

              if (data.done) break;
            } catch (err) {
              console.error(err);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === activeSessionId) {
              const msgs = s.messages.map((m) =>
                m.id === assistantMessageId
                  ? {
                      ...m,
                      isStreaming: false,
                      error: error.message || 'Generation failed',
                    }
                  : m
              );
              return { ...s, messages: msgs };
            }
            return s;
          })
        );
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === activeSessionId) {
            const msgs = s.messages.map((m) =>
              m.id === assistantMessageId ? { ...m, isStreaming: false } : m
            );
            return { ...s, messages: msgs, updatedAt: Date.now() };
          }
          return s;
        })
      );
    }
  };

  const handleStopStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  };

  const handleRegenerate = () => {
    if (currentSession.messages.length === 0 || isStreaming) return;
    const msgs = [...currentSession.messages];
    const lastMsg = msgs[msgs.length - 1];

    if (lastMsg.role === 'assistant') {
      msgs.pop();
      const lastUserMsg = msgs[msgs.length - 1];
      if (lastUserMsg && lastUserMsg.role === 'user') {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId ? { ...s, messages: msgs.slice(0, -1) } : s
          )
        );
        handleSendMessage(lastUserMsg.text, lastUserMsg.attachments || []);
      }
    }
  };

  const handleExportMarkdown = () => {
    if (currentSession.messages.length === 0) return;
    let md = `# ${currentSession.title}\n\n`;
    currentSession.messages.forEach((m) => {
      const speaker = m.role === 'user' ? '### User' : '### Nova';
      md += `${speaker}\n\n${m.text}\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentSession.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-neutral-950 font-sans text-neutral-100 antialiased">
      {/* Minimal Sidebar */}
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        onClearAllSessions={handleClearAllSessions}
        onOpenSettings={() => setSettingsOpen(true)}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Canvas */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Minimal Header */}
        <header className="flex h-13 shrink-0 items-center justify-between border-b border-neutral-900 bg-neutral-950/70 px-4 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-1.5 text-neutral-400 hover:text-white md:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <span className="text-xs font-medium text-neutral-300 truncate max-w-[180px] sm:max-w-xs">
              {currentSession.title}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Prominent Voice Mode Button */}
            <button
              onClick={() => setVoiceModalOpen(true)}
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/30 px-3 py-1 text-xs font-medium text-purple-300 hover:bg-purple-600/30 hover:text-white transition-all shadow-xs"
            >
              <Headphones className="h-3.5 w-3.5" />
              <span>Voice Mode</span>
            </button>

            <button
              onClick={handleNewSession}
              title="New chat"
              className="rounded-lg p-1.5 text-neutral-400 hover:text-white transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>

            {currentSession.messages.length > 0 && (
              <button
                onClick={handleExportMarkdown}
                title="Export"
                className="rounded-lg p-1.5 text-neutral-400 hover:text-white transition-colors"
              >
                <Download className="h-4 w-4" />
              </button>
            )}

            <button
              onClick={() => setSettingsOpen(true)}
              title="Settings"
              className="rounded-lg p-1.5 text-neutral-400 hover:text-white transition-colors"
            >
              <SettingsIcon className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Messages Container */}
        <div
          ref={chatScrollContainerRef}
          onScroll={handleScroll}
          className="relative flex-1 overflow-y-auto"
        >
          {currentSession.messages.length === 0 ? (
            /* Minimalist Empty State */
            <div className="mx-auto flex min-h-full max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-neutral-950 font-bold text-lg shadow-lg">
                N
              </div>

              <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                What can I help with?
              </h2>

              <p className="mt-1.5 text-xs text-neutral-400 max-w-xs">
                Nova is powered by Gemini with text and real-time speech-to-speech voice.
              </p>

              {/* Minimalist prompt suggestions */}
              <div className="mt-8 flex flex-wrap justify-center gap-2">
                {MINIMAL_SUGGESTIONS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(prompt)}
                    className="rounded-full border border-neutral-800 bg-neutral-900/60 px-3.5 py-1.5 text-xs text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800 hover:text-white transition-all"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="pb-8 pt-2">
              {currentSession.messages.map((message, idx) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isLatest={idx === currentSession.messages.length - 1}
                  onRegenerate={handleRegenerate}
                  onEdit={(text) => setEditingInputText(text)}
                  voiceName={selectedVoice}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          {showScrollBottom && (
            <button
              onClick={() => scrollToBottom('smooth')}
              className="fixed bottom-24 right-6 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900 text-neutral-300 shadow-lg hover:text-white"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Minimal Chat Input */}
        <ChatInput
          onSend={handleSendMessage}
          onStop={handleStopStream}
          isStreaming={isStreaming}
          onOpenVoiceModal={() => setVoiceModalOpen(true)}
          initialText={editingInputText}
        />
      </div>

      {/* Voice Mode Overlay (Speech-to-Speech) */}
      <VoiceConversationModal
        isOpen={voiceModalOpen}
        onClose={() => setVoiceModalOpen(false)}
        messages={currentSession.messages}
        onAddMessage={handleVoiceMessageTurn}
        selectedVoice={selectedVoice}
        onSelectVoice={(v) => {
          setSelectedVoice(v);
          handleSaveSettings(customSystemInstruction);
        }}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        customSystemInstruction={customSystemInstruction}
        onSaveCustomSystemInstruction={handleSaveSettings}
        selectedVoice={selectedVoice}
        onSelectVoice={(v) => {
          setSelectedVoice(v);
          handleSaveSettings(customSystemInstruction);
        }}
        selectedModel={defaultModel}
        onSelectModel={(m) => {
          setDefaultModel(m);
          setSessions((prev) =>
            prev.map((s) => (s.id === activeSessionId ? { ...s, model: m } : s))
          );
        }}
        defaultSearchGrounding={defaultSearchGrounding}
        onToggleDefaultSearchGrounding={() =>
          setDefaultSearchGrounding((prev) => !prev)
        }
        defaultThinkingLevel={defaultThinkingLevel}
        onSelectDefaultThinkingLevel={(lvl) => {
          setDefaultThinkingLevel(lvl);
          setSessions((prev) =>
            prev.map((s) =>
              s.id === activeSessionId ? { ...s, thinkingLevel: lvl } : s
            )
          );
        }}
      />
    </div>
  );
}
