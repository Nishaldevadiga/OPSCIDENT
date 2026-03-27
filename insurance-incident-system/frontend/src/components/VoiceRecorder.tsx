import { useState, useRef, useEffect, useCallback } from 'react';
import {
  MicrophoneIcon,
  StopIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import LoadingSpinner from './LoadingSpinner';

type RecorderState = 'idle' | 'recording' | 'processing' | 'done' | 'error';

export interface VoiceExtractedFields {
  transcript?: string;
  incident_type?: string;
  title?: string;
  description?: string;
  incident_date?: string;
  incident_location?: string;
  claim_amount?: number | null;
  confidence?: number;
}

interface Props {
  onFieldsExtracted: (fields: VoiceExtractedFields) => void;
  disabled?: boolean;
}

const MAX_DURATION = 60; // seconds

function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Staggered animation delays for each waveform bar (cycles through a pattern)
const BAR_COUNT = 24;
const BAR_DELAYS = Array.from({ length: BAR_COUNT }, (_, i) => {
  // Create a natural wave pattern: peak in middle, low at edges
  const phase = (i / (BAR_COUNT - 1)) * Math.PI * 2;
  return `${(Math.sin(phase) * 0.25 + 0.3).toFixed(2)}s`;
});

export default function VoiceRecorder({ onFieldsExtracted, disabled }: Props) {
  const [state, setState] = useState<RecorderState>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [duration, setDuration] = useState(0);
  const [filledCount, setFilledCount] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => () => cleanup(), [cleanup]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    cleanup();
  }, [cleanup]);

  // Auto-stop at max duration
  useEffect(() => {
    if (duration >= MAX_DURATION && state === 'recording') {
      stopRecording();
    }
  }, [duration, state, stopRecording]);

  const startRecording = async () => {
    setError('');
    setTranscript('');
    setFilledCount(0);
    chunksRef.current = [];
    setDuration(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      // Pick best supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        setState('processing');
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';

        try {
          const formData = new FormData();
          formData.append('audio', blob, `voice-claim.${ext}`);

          const token = localStorage.getItem('access_token');
          const response = await fetch('/api/ai/transcribe/', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token ?? ''}` },
            body: formData,
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error((errData as { error?: string }).error ?? `Server error ${response.status}`);
          }

          const data: VoiceExtractedFields = await response.json();
          setTranscript(data.transcript ?? '');

          // Count how many claim fields were filled
          const fields: (keyof VoiceExtractedFields)[] = [
            'incident_type', 'title', 'description',
            'incident_date', 'incident_location', 'claim_amount',
          ];
          const filled = fields.filter((f) => {
            const v = data[f];
            return v != null && v !== '';
          }).length;
          setFilledCount(filled);

          setState('done');
          onFieldsExtracted(data);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          setError(`Processing failed: ${msg}`);
          setState('error');
        }
      };

      recorder.start(250); // collect chunks every 250 ms
      setState('recording');

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('NotAllowed') || msg.includes('denied') || msg.includes('Permission')) {
        setError('Microphone access denied. Please allow microphone access in your browser settings and try again.');
      } else if (msg.includes('NotFound') || msg.includes('Requested device not found')) {
        setError('No microphone found. Please connect a microphone and try again.');
      } else {
        setError('Could not start recording. Please check your microphone and try again.');
      }
      setState('error');
    }
  };

  const reset = () => {
    setState('idle');
    setTranscript('');
    setError('');
    setDuration(0);
    setFilledCount(0);
  };

  // ── IDLE / ERROR state ──────────────────────────────────────────────────────
  if (state === 'idle' || state === 'error') {
    return (
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
            <MicrophoneIcon className="h-5 w-5 text-violet-400" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200">Describe your incident by voice</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Speak naturally — AI transcribes and fills the form for you
            </p>
          </div>

          <button
            type="button"
            onClick={startRecording}
            disabled={disabled}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            <MicrophoneIcon className="h-4 w-4" />
            Record
          </button>
        </div>

        {state === 'error' && error && (
          <div className="mt-3 flex items-start gap-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
            <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <p className="mt-3 text-xs text-slate-500 italic">
          Example: "My car was rear-ended on March 20th at Oak Street — damage to rear bumper, estimated $2,000 in repairs"
        </p>
      </div>
    );
  }

  // ── RECORDING state ─────────────────────────────────────────────────────────
  if (state === 'recording') {
    const progress = (duration / MAX_DURATION) * 100;

    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
        <div className="flex items-center gap-3">
          {/* Pulsing record dot */}
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
              <div className="w-3 h-3 rounded-sm bg-rose-500 animate-pulse" />
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-rose-300">Recording…</span>
              <span className="text-xs text-slate-400 tabular-nums">
                {formatTime(duration)} / {formatTime(MAX_DURATION)}
              </span>
            </div>

            {/* Animated waveform bars */}
            <div className="flex items-end gap-px h-6 overflow-hidden">
              {BAR_DELAYS.map((delay, i) => (
                <div
                  key={i}
                  className="voice-bar flex-1 rounded-full bg-violet-400"
                  style={{ animationDelay: delay, height: '100%' }}
                />
              ))}
            </div>

            {/* Progress bar */}
            <div className="mt-2 h-0.5 w-full rounded-full bg-slate-700">
              <div
                className="h-full rounded-full bg-rose-500 transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={stopRecording}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors"
          >
            <StopIcon className="h-4 w-4" />
            Stop
          </button>
        </div>

        <p className="mt-3 text-xs text-slate-500 italic">
          Tip: mention the incident type, date, location, and estimated damage amount
        </p>
      </div>
    );
  }

  // ── PROCESSING state ────────────────────────────────────────────────────────
  if (state === 'processing') {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <LoadingSpinner size="sm" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-200">Transcribing & extracting fields…</p>
            <p className="text-xs text-slate-400 mt-0.5">AI is analysing your voice recording</p>
          </div>
        </div>

        {/* Animated step indicators */}
        <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5 text-violet-400 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
            Whisper transcribing
          </span>
          <span className="text-slate-700">→</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
            Extracting claim fields
          </span>
        </div>
      </div>
    );
  }

  // ── DONE state ──────────────────────────────────────────────────────────────
  if (state === 'done') {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <CheckCircleIcon className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-medium text-emerald-300">
                Voice processed —{' '}
                <span className="text-emerald-200">
                  {filledCount} field{filledCount !== 1 ? 's' : ''} auto-filled
                </span>
              </p>
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                <ArrowPathIcon className="h-3 w-3" />
                Re-record
              </button>
            </div>
            {transcript && (
              <p className="mt-2 text-xs text-slate-400 italic line-clamp-3 border-l-2 border-slate-600 pl-2">
                "{transcript}"
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
