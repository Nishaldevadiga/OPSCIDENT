import { useState } from 'react';
import { CheckCircleIcon, CpuChipIcon } from '@heroicons/react/24/outline';
import { useTicketSocket, type TicketSocketEvent } from '../hooks/useTicketSocket';

interface Step {
  id: string;
  label: string;
  detail?: string;
}

const STEPS: Step[] = [
  { id: 'processing_start', label: 'Claim Received' },
  { id: 'reading_document', label: 'Reading Documents' },
  { id: 'analyzing_image', label: 'Analyzing Images' },
  { id: 'fraud_checking', label: 'Fraud Detection' },
  { id: 'making_decision', label: 'AI Decision' },
  { id: 'decided', label: 'Decision Complete' },
];

// Steps that mark themselves done when the *next* step becomes active.
const STEP_IDS = STEPS.map((s) => s.id);

type StepState = 'pending' | 'active' | 'done';

interface LiveStatusTrackerProps {
  ticketId: number | string;
  onStatusChange?: (status: string) => void;
}

export default function LiveStatusTracker({ ticketId, onStatusChange }: LiveStatusTrackerProps) {
  const [stepStates, setStepStates] = useState<Record<string, StepState>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [finalStatus, setFinalStatus] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  const handleEvent = (event: TicketSocketEvent) => {
    const step = event.step;
    if (!step) return;

    // Normalise _done suffix: mark the base step as done without activating a new one.
    if (step.endsWith('_done')) {
      const base = step.replace('_done', '');
      setStepStates((prev) => ({ ...prev, [base]: 'done' }));
      return;
    }

    const idx = STEP_IDS.indexOf(step);
    if (idx === -1) return;

    setStepStates((prev) => {
      const next = { ...prev };
      // Mark all previous steps done.
      for (let i = 0; i < idx; i++) next[STEP_IDS[i]] = 'done';
      next[step] = 'active';
      return next;
    });

    if (event.message) setMessages((prev) => ({ ...prev, [step]: event.message! }));

    if (step === 'decided') {
      setStepStates((prev) => {
        const next = { ...prev };
        STEP_IDS.forEach((id) => { next[id] = 'done'; });
        return next;
      });
      setIsDone(true);
      if (event.status) {
        setFinalStatus(event.status);
        onStatusChange?.(event.status);
      }
    }
  };

  useTicketSocket(ticketId, handleEvent, !isDone);

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    approved:     { label: 'Approved!',           color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/30' },
    rejected:     { label: 'Not Approved',        color: 'text-rose-300',    bg: 'bg-rose-500/10 border-rose-500/30' },
    pending_info: { label: 'More Info Needed',     color: 'text-orange-300',  bg: 'bg-orange-500/10 border-orange-500/30' },
    appealed:     { label: 'Under Appeal Review',  color: 'text-violet-300',  bg: 'bg-violet-500/10 border-violet-500/30' },
  };

  const hasAnyActivity = Object.keys(stepStates).length > 0;
  if (!hasAnyActivity) return null;

  return (
    <div className="px-6 py-5 border-t border-slate-700">
      <div className="flex items-center gap-2 mb-4">
        <CpuChipIcon className="h-5 w-5 text-sky-400" />
        <h3 className="text-sm font-medium text-slate-200">Live AI Processing</h3>
      </div>

      <ol className="space-y-3">
        {STEPS.map((step) => {
          const state: StepState = stepStates[step.id] ?? 'pending';
          const msg = messages[step.id];

          return (
            <li key={step.id} className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {state === 'done' && (
                  <CheckCircleIcon className="h-5 w-5 text-emerald-400" />
                )}
                {state === 'active' && (
                  <span className="relative flex h-5 w-5 items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-50" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-400" />
                  </span>
                )}
                {state === 'pending' && (
                  <span className="inline-flex h-5 w-5 items-center justify-center">
                    <span className="h-2 w-2 rounded-full bg-slate-600" />
                  </span>
                )}
              </div>
              <div>
                <p className={`text-sm font-medium ${
                  state === 'done'   ? 'text-emerald-300' :
                  state === 'active' ? 'text-sky-300' :
                  'text-slate-500'
                }`}>
                  {step.label}
                </p>
                {msg && state !== 'pending' && (
                  <p className="text-xs text-slate-400 mt-0.5">{msg}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {isDone && finalStatus && statusConfig[finalStatus] && (
        <div className={`mt-5 rounded-xl border px-4 py-3 ${statusConfig[finalStatus].bg}`}>
          <p className={`text-sm font-semibold ${statusConfig[finalStatus].color}`}>
            {statusConfig[finalStatus].label}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Reload the page to see the full decision details.</p>
        </div>
      )}
    </div>
  );
}
