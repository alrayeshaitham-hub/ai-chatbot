import React, { useState } from 'react';
import {
  Plus,
  MessageSquare,
  Search,
  Trash2,
  Settings,
  X,
  Check,
  Edit3,
  Bot,
} from 'lucide-react';
import { ChatSession } from '../types';

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onClearAllSessions: () => void;
  onOpenSettings: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onRenameSession,
  onClearAllSessions,
  onOpenSettings,
  isOpen,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const startRename = (s: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(s.id);
    setEditTitle(s.title);
  };

  const saveRename = (id: string, e: React.FormEvent) => {
    e.preventDefault();
    if (editTitle.trim()) {
      onRenameSession(id, editTitle.trim());
    }
    setEditingSessionId(null);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Minimalist Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-68 flex-col border-r border-neutral-900 bg-neutral-950 transition-transform duration-200 md:static md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-neutral-950 font-bold text-xs">
              N
            </div>
            <span className="text-sm font-semibold tracking-tight text-white">
              Nova
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:text-white md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="px-3 py-2">
          <button
            onClick={() => {
              onNewSession();
              if (window.innerWidth < 768) onClose();
            }}
            className="flex w-full items-center gap-2 rounded-xl bg-neutral-900 hover:bg-neutral-800/80 px-3 py-2 text-xs font-medium text-neutral-200 transition-colors"
          >
            <Plus className="h-4 w-4 text-neutral-400" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Search */}
        {sessions.length > 3 && (
          <div className="px-3 pb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-neutral-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-lg bg-neutral-900/60 py-1.5 pr-2.5 pl-8 text-xs text-neutral-300 placeholder-neutral-500 focus:outline-none focus:bg-neutral-900"
              />
            </div>
          </div>
        )}

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          {filteredSessions.map((s) => {
            const isActive = s.id === activeSessionId;
            const isEditing = editingSessionId === s.id;

            return (
              <div
                key={s.id}
                onClick={() => {
                  onSelectSession(s.id);
                  if (window.innerWidth < 768) onClose();
                }}
                className={`group relative flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors ${
                  isActive
                    ? 'bg-neutral-900 text-white font-medium'
                    : 'text-neutral-400 hover:bg-neutral-900/50 hover:text-neutral-200'
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-40" />
                  {isEditing ? (
                    <form
                      onSubmit={(e) => saveRename(s.id, e)}
                      className="flex flex-1 items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        autoFocus
                        className="w-full rounded bg-neutral-950 px-1 py-0.5 text-xs text-white border border-neutral-700 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="rounded p-0.5 text-emerald-400"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    </form>
                  ) : (
                    <span className="truncate">{s.title || 'New Chat'}</span>
                  )}
                </div>

                {!isEditing && (
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => startRename(s, e)}
                      className="p-1 text-neutral-500 hover:text-neutral-300"
                    >
                      <Edit3 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(s.id);
                      }}
                      className="p-1 text-neutral-500 hover:text-red-400"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Minimal Footer */}
        <div className="p-3 border-t border-neutral-900 flex items-center justify-between text-xs text-neutral-500">
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 hover:text-neutral-300 transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Settings</span>
          </button>

          {sessions.length > 1 && (
            <button
              onClick={onClearAllSessions}
              className="hover:text-red-400 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
