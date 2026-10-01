import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Copy,
  Check,
  RotateCcw,
  Volume2,
  VolumeX,
  FileText,
  AlertCircle,
  Loader2,
  Edit2,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { Message } from '../types';
import { CodeBlock } from './CodeBlock';

interface ChatMessageProps {
  message: Message;
  isLatest: boolean;
  onRegenerate?: () => void;
  onEdit?: (text: string) => void;
  voiceName?: string;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isLatest,
  onRegenerate,
  onEdit,
  voiceName = 'Kore',
}) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleAudio = async () => {
    if (isPlayingAudio && audioElement) {
      audioElement.pause();
      setIsPlayingAudio(false);
      return;
    }

    if (audioElement && audioElement.currentTime > 0) {
      audioElement.play();
      setIsPlayingAudio(true);
      return;
    }

    setIsLoadingAudio(true);
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: message.text,
          voiceName,
        }),
      });

      if (!res.ok) throw new Error('TTS failed');

      const data = await res.json();
      if (!data.audio) throw new Error('No audio');

      const audioBlob = new Audio(`data:audio/wav;base64,${data.audio}`);
      audioBlob.onended = () => setIsPlayingAudio(false);
      audioBlob.onerror = () => {
        setIsPlayingAudio(false);
        setIsLoadingAudio(false);
      };

      setAudioElement(audioBlob);
      await audioBlob.play();
      setIsPlayingAudio(true);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  return (
    <div className={`group w-full py-4 px-4 sm:px-6 transition-colors ${isUser ? '' : 'bg-neutral-900/20'}`}>
      <div className="mx-auto max-w-3xl flex gap-4">
        {/* Minimal Avatar */}
        <div className="shrink-0 mt-0.5">
          {isUser ? (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-800 text-[11px] font-medium text-neutral-300">
              Y
            </div>
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 text-[11px] font-bold text-white shadow-xs">
              N
            </div>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-300">
              {isUser ? 'You' : 'Nova'}
            </span>

            {/* Hover Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleCopy}
                title="Copy"
                className="p-1 text-neutral-500 hover:text-neutral-200"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>

              {!isUser && !message.isStreaming && message.text && (
                <button
                  onClick={handleToggleAudio}
                  disabled={isLoadingAudio}
                  title="Read aloud"
                  className="p-1 text-neutral-500 hover:text-neutral-200 disabled:opacity-50"
                >
                  {isLoadingAudio ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" />
                  ) : isPlayingAudio ? (
                    <VolumeX className="h-3.5 w-3.5 text-purple-400" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                </button>
              )}

              {isUser && onEdit && (
                <button
                  onClick={() => onEdit(message.text)}
                  title="Edit"
                  className="p-1 text-neutral-500 hover:text-neutral-200"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
              )}

              {!isUser && isLatest && onRegenerate && !message.isStreaming && (
                <button
                  onClick={onRegenerate}
                  title="Regenerate"
                  className="p-1 text-neutral-500 hover:text-neutral-200"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 py-1">
              {message.attachments.map((att) => {
                const isImg = att.mimeType.startsWith('image/');
                return (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 rounded-xl bg-neutral-900 border border-neutral-800 p-1.5 pr-2.5 text-xs text-neutral-300"
                  >
                    {isImg ? (
                      <img
                        src={`data:${att.mimeType};base64,${att.data}`}
                        alt={att.name}
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      <FileText className="h-4 w-4 text-neutral-400" />
                    )}
                    <span className="max-w-[120px] truncate text-[11px]">
                      {att.name}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Error */}
          {message.error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-950/20 border border-red-900/40 p-3 text-xs text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{message.error}</span>
            </div>
          )}

          {/* Markdown Content */}
          <div className="prose prose-invert max-w-none text-[15px] leading-relaxed text-neutral-200">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '');
                  const content = String(children).replace(/\n$/, '');

                  if (!inline && (match || content.includes('\n'))) {
                    return (
                      <CodeBlock
                        language={match ? match[1] : undefined}
                        value={content}
                      />
                    );
                  }

                  return (
                    <code
                      className="rounded bg-neutral-800 px-1 py-0.5 font-mono text-[13px] text-neutral-300"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.text}
            </ReactMarkdown>

            {message.isStreaming && (
              <span className="inline-block h-3.5 w-1.5 animate-pulse bg-white ml-0.5" />
            )}
          </div>

          {/* Grounding web sources */}
          {message.groundingChunks && message.groundingChunks.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {message.groundingChunks.map((chunk, idx) => {
                if (!chunk.web?.uri) return null;
                return (
                  <a
                    key={idx}
                    href={chunk.web.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-neutral-800 bg-neutral-900/60 px-2 py-0.5 text-[11px] text-neutral-400 hover:text-white transition-colors"
                  >
                    <Globe className="h-2.5 w-2.5" />
                    <span className="max-w-[150px] truncate">{chunk.web.title || chunk.web.uri}</span>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
