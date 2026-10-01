import React, { useState } from 'react';
import { X, Check, Bot, Volume2, Brain, Globe, Sparkles } from 'lucide-react';
import { DEFAULT_MODELS, TTS_VOICES } from '../constants';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customSystemInstruction: string;
  onSaveCustomSystemInstruction: (instruction: string) => void;
  selectedVoice: string;
  onSelectVoice: (voice: string) => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  defaultSearchGrounding: boolean;
  onToggleDefaultSearchGrounding: () => void;
  defaultThinkingLevel: 'HIGH' | 'LOW' | 'MINIMAL';
  onSelectDefaultThinkingLevel: (level: 'HIGH' | 'LOW' | 'MINIMAL') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  customSystemInstruction,
  onSaveCustomSystemInstruction,
  selectedVoice,
  onSelectVoice,
  selectedModel,
  onSelectModel,
  defaultSearchGrounding,
  onToggleDefaultSearchGrounding,
  defaultThinkingLevel,
  onSelectDefaultThinkingLevel,
}) => {
  const [instruction, setInstruction] = useState(customSystemInstruction);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveCustomSystemInstruction(instruction);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-400" />
            <h2 className="text-base font-semibold text-white">Bot Settings & Preferences</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[75vh] overflow-y-auto px-6 py-5 space-y-6 text-xs text-neutral-300">
          {/* Default Model */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-neutral-200">
              Gemini Model
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {DEFAULT_MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onSelectModel(m.id)}
                  type="button"
                  className={`flex flex-col items-start rounded-xl border p-3 text-left transition-colors ${
                    selectedModel === m.id
                      ? 'border-purple-500 bg-purple-500/10 text-white'
                      : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                  }`}
                >
                  <span className="font-semibold text-xs text-white">{m.name}</span>
                  <span className="mt-0.5 text-[10px] text-purple-400">{m.tag}</span>
                  <span className="mt-1 text-[10px] text-neutral-400 line-clamp-2">
                    {m.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Thinking / Reasoning Config */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-400" />
              <label className="text-xs font-semibold text-neutral-200">
                Reasoning / Thinking Level (Gemini 3 Series)
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'HIGH', label: 'High (Deep Reasoning)', desc: 'Maximizes step-by-step thinking' },
                { id: 'LOW', label: 'Low (Balanced)', desc: 'Low latency with reasoning' },
                { id: 'MINIMAL', label: 'Minimal / Off', desc: 'Direct fast responses' },
              ].map((lvl) => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => onSelectDefaultThinkingLevel(lvl.id as any)}
                  className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition-colors ${
                    defaultThinkingLevel === lvl.id
                      ? 'border-purple-500 bg-purple-500/10 text-white'
                      : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <span className="font-semibold text-xs text-white">{lvl.label}</span>
                  <span className="mt-0.5 text-[10px] text-neutral-400">{lvl.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Search Grounding Default */}
          <div className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950/60 p-3.5">
            <div className="flex items-center gap-2.5">
              <Globe className="h-4 w-4 text-blue-400" />
              <div>
                <p className="text-xs font-semibold text-neutral-200">Google Search Grounding</p>
                <p className="text-[11px] text-neutral-400">
                  Allow Nova to browse real-time Google Search data and cite web sources
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleDefaultSearchGrounding}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                defaultSearchGrounding ? 'bg-blue-600' : 'bg-neutral-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  defaultSearchGrounding ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Voice for Text-To-Speech */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-pink-400" />
              <label className="text-xs font-semibold text-neutral-200">
                Speech Voice (Gemini TTS)
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TTS_VOICES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onSelectVoice(v.id)}
                  className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition-colors ${
                    selectedVoice === v.id
                      ? 'border-pink-500 bg-pink-500/10 text-white'
                      : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <span className="font-semibold text-xs text-white">{v.id}</span>
                  <span className="text-[10px] text-pink-400">{v.gender} Voice</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom System Instruction */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-neutral-200">
              Custom Persona / System Instructions
            </label>
            <textarea
              rows={4}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g. You are a senior Python specialist who prefers brevity, tests, and type hints..."
              className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-xs text-neutral-100 placeholder-neutral-500 focus:border-purple-500 focus:outline-none"
            />
            <p className="text-[10px] text-neutral-500">
              Overrides default instructions. Leave empty to use persona default.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-neutral-800 bg-neutral-950/80 px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-medium text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-purple-600/30 hover:bg-purple-500 transition-colors"
          >
            {savedSuccess ? (
              <>
                <Check className="h-4 w-4" />
                <span>Saved!</span>
              </>
            ) : (
              <span>Save Preferences</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
