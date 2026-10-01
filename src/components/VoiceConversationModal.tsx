import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  ChevronDown,
  Sparkles,
  RotateCcw,
  Send,
} from 'lucide-react';
import { Message } from '../types';
import { TTS_VOICES } from '../constants';

interface VoiceConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  onAddMessage: (userText: string, assistantText: string) => void;
  selectedVoice: string;
  onSelectVoice: (voice: string) => void;
}

type VoiceState = 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING';

export const VoiceConversationModal: React.FC<VoiceConversationModalProps> = ({
  isOpen,
  onClose,
  messages,
  onAddMessage,
  selectedVoice,
  onSelectVoice,
}) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE');
  const [userSubtitle, setUserSubtitle] = useState('');
  const [novaSubtitle, setNovaSubtitle] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 1 for visualizer
  const [manualText, setManualText] = useState('');
  const [hasMicPermission, setHasMicPermission] = useState(true);

  // Audio and Recording References
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<any>(null);
  const hasSpokenRef = useRef(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const isClosingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      cleanup();
      return;
    }

    isClosingRef.current = false;
    setErrorMsg(null);
    setUserSubtitle('');
    setNovaSubtitle(
      messages.length > 0 && messages[messages.length - 1].role === 'assistant'
        ? messages[messages.length - 1].text
        : "Hi, I'm listening. Ask me anything."
    );

    initAudioAndStartListening();

    return () => {
      cleanup();
    };
  }, [isOpen]);

  const cleanup = () => {
    isClosingRef.current = true;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }
    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause();
      } catch (e) {}
      audioPlayerRef.current = null;
    }
    setVoiceState('IDLE');
    setAudioLevel(0);
  };

  // Initialize Microphone & Web Audio Analyzer
  const initAudioAndStartListening = async () => {
    if (isClosingRef.current) return;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone access not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;
      setHasMicPermission(true);

      // Create AudioContext for live volume analysis
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start recording loop
      startRecording();
      startVisualizer();
    } catch (err: any) {
      console.warn('Microphone error:', err);
      setHasMicPermission(false);
      setErrorMsg(
        err.name === 'NotAllowedError'
          ? 'Microphone permission denied. You can still type below to chat.'
          : err.message || 'Could not access microphone.'
      );
      setVoiceState('IDLE');
    }
  };

  // Audio Level Visualizer & VAD (Voice Activity Detection)
  const startVisualizer = () => {
    const dataArray = new Uint8Array(128);

    const checkVolume = () => {
      if (!analyserRef.current || isClosingRef.current) return;

      analyserRef.current.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      const normalized = Math.min(avg / 70, 1);
      setAudioLevel(normalized);

      // VAD logic: if user is speaking
      if (normalized > 0.18) {
        hasSpokenRef.current = true;
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      } else if (hasSpokenRef.current && !silenceTimerRef.current) {
        // User spoke and is now silent for 1.3s -> auto submit
        silenceTimerRef.current = setTimeout(() => {
          if (hasSpokenRef.current && voiceState === 'LISTENING') {
            stopRecordingAndSend();
          }
        }, 1300);
      }

      animFrameRef.current = requestAnimationFrame(checkVolume);
    };

    animFrameRef.current = requestAnimationFrame(checkVolume);
  };

  const startRecording = () => {
    if (!mediaStreamRef.current || isClosingRef.current) return;

    try {
      hasSpokenRef.current = false;
      audioChunksRef.current = [];

      // Determine supported mime type
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ];
      let selectedMime = 'audio/webm';
      for (const m of mimeTypes) {
        if (MediaRecorder.isTypeSupported(m)) {
          selectedMime = m;
          break;
        }
      }

      const recorder = new MediaRecorder(mediaStreamRef.current, {
        mimeType: selectedMime,
      });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstart = () => {
        setVoiceState('LISTENING');
        setErrorMsg(null);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100);
    } catch (e: any) {
      console.error('Failed to start MediaRecorder:', e);
      setErrorMsg('Recording failed to start.');
      setVoiceState('IDLE');
    }
  };

  const stopRecordingAndSend = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      return;
    }

    setVoiceState('THINKING');
    const mimeType = mediaRecorderRef.current.mimeType || 'audio/webm';

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
      audioChunksRef.current = [];

      if (audioBlob.size < 1000 && !hasSpokenRef.current) {
        // Too short, resume listening
        setTimeout(() => {
          if (!isClosingRef.current) startRecording();
        }, 300);
        return;
      }

      try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1] || '');
          };
        });
        reader.readAsDataURL(audioBlob);
        const base64Audio = await base64Promise;

        await processTurn({ audio: base64Audio, mimeType });
      } catch (err: any) {
        console.error('Audio processing error:', err);
        setErrorMsg('Error processing speech.');
        resumeListening();
      }
    };

    try {
      mediaRecorderRef.current.stop();
    } catch (e) {}
  };

  const processTurn = async (payload: { audio?: string; mimeType?: string; text?: string }) => {
    setVoiceState('THINKING');

    try {
      const historyToSend = messages.slice(-6).map((m) => ({ role: m.role, text: m.text }));

      const res = await fetch('/api/voice-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyToSend,
          ...payload,
          voiceName: selectedVoice,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Server error in voice turn');
      }

      const data = await res.json();
      const userText = data.userTranscript || payload.text || 'Voice input';
      const botText = data.text || "I'm listening.";

      setUserSubtitle(userText);
      setNovaSubtitle(botText);
      onAddMessage(userText, botText);

      // Play audio response if available and not muted
      if (data.audio && !isMuted) {
        setVoiceState('SPEAKING');

        const audio = new Audio(`data:audio/wav;base64,${data.audio}`);
        audioPlayerRef.current = audio;

        audio.onended = () => {
          resumeListening();
        };

        audio.onerror = () => {
          resumeListening();
        };

        await audio.play();
      } else {
        setTimeout(() => {
          resumeListening();
        }, 1000);
      }
    } catch (err: any) {
      console.error('Turn failed:', err);
      setErrorMsg(err.message || 'Failed to generate voice response.');
      setTimeout(() => {
        resumeListening();
      }, 1500);
    }
  };

  const resumeListening = () => {
    if (isClosingRef.current) return;
    setVoiceState('LISTENING');
    startRecording();
  };

  const handleInterrupt = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    resumeListening();
  };

  const handleManualTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim()) return;
    const textToSend = manualText.trim();
    setManualText('');
    processTurn({ text: textToSend });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-neutral-950 p-6 sm:p-10 select-none backdrop-blur-2xl">
      {/* Top Header */}
      <div className="flex w-full max-w-2xl items-center justify-between">
        {/* Status pill */}
        <div className="flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/90 px-3.5 py-1.5 text-xs text-neutral-300">
          <Radio
            className={`h-3 w-3 ${
              voiceState === 'LISTENING'
                ? 'animate-pulse text-emerald-400'
                : voiceState === 'SPEAKING'
                ? 'animate-ping text-purple-400'
                : voiceState === 'THINKING'
                ? 'animate-spin text-amber-400'
                : 'text-neutral-500'
            }`}
          />
          <span className="font-medium tracking-wide">
            {voiceState === 'LISTENING' && 'Listening...'}
            {voiceState === 'THINKING' && 'Thinking...'}
            {voiceState === 'SPEAKING' && 'Nova is speaking'}
            {voiceState === 'IDLE' && 'Ready'}
          </span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2.5">
          {/* Voice selector */}
          <div className="relative">
            <select
              value={selectedVoice}
              onChange={(e) => onSelectVoice(e.target.value)}
              className="appearance-none rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1.5 pr-7 text-xs font-medium text-neutral-300 focus:outline-none cursor-pointer"
            >
              {TTS_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name.split(' ')[0]} ({v.gender})
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-3 w-3 text-neutral-500" />
          </div>

          {/* Mute */}
          <button
            onClick={() => setIsMuted((m) => !m)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white"
            title="Close voice mode"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Center: Interactive Glowing Audio Orb */}
      <div className="relative my-auto flex flex-col items-center justify-center">
        {/* Ambient background glow */}
        <div
          style={{
            transform: `scale(${1 + audioLevel * 0.4})`,
          }}
          className={`absolute h-72 w-72 rounded-full blur-3xl transition-all duration-300 pointer-events-none ${
            voiceState === 'SPEAKING'
              ? 'bg-purple-600/30'
              : voiceState === 'THINKING'
              ? 'bg-indigo-600/25'
              : voiceState === 'LISTENING'
              ? 'bg-emerald-500/25'
              : 'bg-neutral-800/10'
          }`}
        />

        {/* Dynamic audio ripple waves */}
        {voiceState === 'LISTENING' && (
          <div
            style={{
              transform: `scale(${1 + audioLevel * 0.5})`,
              opacity: 0.3 + audioLevel * 0.7,
            }}
            className="absolute h-48 w-48 rounded-full border border-emerald-400/40 transition-transform duration-100"
          />
        )}
        {voiceState === 'SPEAKING' && (
          <div className="absolute h-52 w-52 animate-ping rounded-full border border-purple-500/20 duration-1000" />
        )}

        {/* Central Orb Button */}
        <button
          onClick={() => {
            if (voiceState === 'SPEAKING') {
              handleInterrupt();
            } else if (voiceState === 'LISTENING') {
              stopRecordingAndSend();
            } else if (voiceState === 'IDLE') {
              initAudioAndStartListening();
            }
          }}
          style={{
            transform: `scale(${1 + (voiceState === 'LISTENING' ? audioLevel * 0.15 : 0)})`,
          }}
          className={`relative z-10 flex h-32 w-32 items-center justify-center rounded-full shadow-2xl transition-all duration-200 active:scale-95 cursor-pointer ${
            voiceState === 'SPEAKING'
              ? 'bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 shadow-purple-500/30'
              : voiceState === 'THINKING'
              ? 'bg-gradient-to-tr from-indigo-700 to-purple-800 animate-spin duration-3000'
              : voiceState === 'LISTENING'
              ? 'bg-gradient-to-tr from-emerald-500 via-teal-600 to-cyan-500 shadow-emerald-500/30'
              : 'bg-neutral-800 border border-neutral-700 text-neutral-400'
          }`}
        >
          {voiceState === 'LISTENING' && <Mic className="h-9 w-9 text-white animate-pulse" />}
          {voiceState === 'THINKING' && <Sparkles className="h-9 w-9 text-white animate-spin" />}
          {voiceState === 'SPEAKING' && <Volume2 className="h-9 w-9 text-white" />}
          {voiceState === 'IDLE' && <MicOff className="h-8 w-8 text-neutral-400" />}
        </button>

        {/* Subtitle / Action prompt */}
        <p className="mt-7 text-xs font-medium tracking-wide text-neutral-400 text-center">
          {voiceState === 'SPEAKING' && 'Tap orb to interrupt'}
          {voiceState === 'LISTENING' &&
            (hasSpokenRef.current ? 'Listening... (tap when done)' : 'Speak naturally...')}
          {voiceState === 'THINKING' && 'Thinking...'}
          {voiceState === 'IDLE' && (hasMicPermission ? 'Tap orb to start voice' : 'Microphone access required')}
        </p>

        {/* Permission Denied / Error guidance */}
        {!hasMicPermission && (
          <div className="mt-4 flex flex-col items-center max-w-sm text-center bg-red-950/30 border border-red-500/20 rounded-2xl p-4">
            <p className="text-xs text-red-200 font-medium">Microphone permission needed</p>
            <p className="text-[11px] text-neutral-400 mt-1">
              Please click the lock or settings icon (🔒) in your browser address bar, set <strong>Microphone</strong> to <strong>Allow</strong>, and retry.
            </p>
            <button
              onClick={() => initAudioAndStartListening()}
              className="mt-3 flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 transition-colors shadow-md"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Allow & Retry</span>
            </button>
          </div>
        )}

        {hasMicPermission && errorMsg && (
          <p className="mt-2 text-xs text-red-400 max-w-xs text-center">{errorMsg}</p>
        )}
      </div>

      {/* Bottom: Subtitle & Quick Fallback Input */}
      <div className="w-full max-w-xl space-y-3">
        {/* Live Subtitle Card */}
        {(userSubtitle || novaSubtitle) && (
          <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/60 p-4 backdrop-blur-md text-xs leading-relaxed space-y-2">
            {userSubtitle && (
              <div>
                <span className="font-semibold text-emerald-400 uppercase tracking-wider text-[10px]">
                  You:
                </span>
                <p className="text-white mt-0.5 font-medium">{userSubtitle}</p>
              </div>
            )}
            {novaSubtitle && (
              <div>
                <span className="font-semibold text-purple-400 uppercase tracking-wider text-[10px]">
                  Nova:
                </span>
                <p className="text-neutral-300 mt-0.5">{novaSubtitle}</p>
              </div>
            )}
          </div>
        )}

        {/* Text fallback input in voice mode */}
        <form
          onSubmit={handleManualTextSubmit}
          className="flex items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/80 px-3 py-1.5 focus-within:border-neutral-700"
        >
          <input
            type="text"
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="Type a message or speak..."
            className="flex-1 bg-transparent text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!manualText.trim()}
            className="flex h-7 w-7 items-center justify-center rounded-xl bg-purple-600 text-white disabled:opacity-20 hover:bg-purple-500 transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
