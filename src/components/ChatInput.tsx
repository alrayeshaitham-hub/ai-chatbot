import React, { useRef, useState, useEffect } from 'react';
import {
  ArrowUp,
  Paperclip,
  X,
  Square,
  Headphones,
  FileCode,
} from 'lucide-react';
import { Attachment } from '../types';

interface ChatInputProps {
  onSend: (text: string, attachments: Attachment[]) => void;
  onStop: () => void;
  isStreaming: boolean;
  onOpenVoiceModal: () => void;
  initialText?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  onStop,
  isStreaming,
  onOpenVoiceModal,
  initialText = '',
}) => {
  const [text, setText] = useState(initialText);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialText) {
      setText(initialText);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [initialText]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [text]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: Attachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 15 * 1024 * 1024) continue;

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1] || '');
        };
        reader.onerror = reject;
      });

      reader.readAsDataURL(file);
      const data = await base64Promise;

      newAttachments.push({
        id: `${Date.now()}-${i}-${Math.random()}`,
        name: file.name,
        mimeType: file.type || 'text/plain',
        data,
        size: file.size,
      });
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSend = () => {
    if ((!text.trim() && attachments.length === 0) || isStreaming) return;
    onSend(text.trim(), attachments);
    setText('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  return (
    <div className="relative mx-auto w-full max-w-3xl px-4 pb-5 pt-2">
      {/* Minimalist Floating Pill Card */}
      <div className="relative rounded-3xl border border-neutral-800 bg-neutral-900/90 shadow-xl backdrop-blur-xl transition-all focus-within:border-neutral-700 focus-within:bg-neutral-900">
        {/* Attached files preview */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-neutral-800/80 px-4 py-2.5">
            {attachments.map((att) => {
              const isImg = att.mimeType.startsWith('image/');
              return (
                <div
                  key={att.id}
                  className="flex items-center gap-2 rounded-xl bg-neutral-800 px-2.5 py-1.5 text-xs text-neutral-200"
                >
                  {isImg ? (
                    <img
                      src={`data:${att.mimeType};base64,${att.data}`}
                      alt={att.name}
                      className="h-7 w-7 rounded-md object-cover"
                    />
                  ) : (
                    <FileCode className="h-4 w-4 text-neutral-400" />
                  )}
                  <span className="max-w-[130px] truncate text-[11px] font-medium">
                    {att.name}
                  </span>
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="ml-1 text-neutral-400 hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Clean Input row */}
        <div className="flex items-end gap-2 px-3 py-2">
          {/* Attachment button */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.txt,.md,.json,.js,.ts,.tsx,.py,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach image or file"
            className="mb-1 flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Nova..."
            rows={1}
            className="flex-1 resize-none bg-transparent py-2 px-1 text-[15px] leading-relaxed text-neutral-100 placeholder-neutral-500 focus:outline-none"
          />

          {/* Right actions: Voice mode trigger & Send/Stop */}
          <div className="flex items-center gap-1.5 mb-1">
            {/* Dedicated Voice Conversation Mode trigger */}
            <button
              type="button"
              onClick={onOpenVoiceModal}
              title="Voice conversation (Speech-to-Speech)"
              className="group flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800/80 text-neutral-300 hover:bg-purple-600 hover:text-white transition-all shadow-xs"
            >
              <Headphones className="h-4 w-4 group-hover:scale-105 transition-transform" />
            </button>

            {/* Send or Stop */}
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200 text-neutral-900 hover:bg-white transition-colors"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!text.trim() && attachments.length === 0}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-neutral-950 transition-all hover:opacity-90 disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <ArrowUp className="h-4 w-4 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
