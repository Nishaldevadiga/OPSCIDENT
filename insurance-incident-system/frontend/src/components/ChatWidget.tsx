import {
  useState,
  useEffect,
  useRef,
  useCallback,
  KeyboardEvent,
} from 'react';
import {
  ChatBubbleLeftRightIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { ticketsApi, aiApi } from '../services/api';
import type { Ticket } from '../types';
import { useAuthStore } from '../store/authStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/** Context-aware quick-reply chips based on what claims the customer has */
function getChips(tickets: Ticket[]): string[] {
  if (!tickets.length) {
    return [
      'How do I file a claim?',
      'What documents do I need?',
      'How does the review process work?',
    ];
  }

  const chips: string[] = ["What's my claim status?"];

  const hasRejected   = tickets.some((t) => t.status === 'rejected');
  const hasPending    = tickets.some((t) => t.status === 'pending_info');
  const hasApproved   = tickets.some((t) => t.status === 'approved');
  const hasAppealed   = tickets.some((t) => t.status === 'appealed');
  const hasProcessing = tickets.some((t) => t.status === 'processing');

  if (hasRejected)   chips.push('Why was my claim rejected?');
  if (hasPending)    chips.push('What info do I still need to provide?');
  if (hasApproved)   chips.push('When will I receive my payout?');
  if (hasAppealed)   chips.push('What happens next with my appeal?');
  if (hasProcessing) chips.push('How long does AI review take?');
  if (hasRejected)   chips.push('Can I appeal the decision?');

  // Always a useful fallback
  if (chips.length < 4) chips.push('How long does processing take?');

  return chips.slice(0, 4);
}

function buildWelcomeMessage(firstName: string, tickets: Ticket[]): string {
  if (!tickets.length) {
    return (
      `Hi ${firstName}! I'm your Opscident claims assistant. You don't have any claims on file yet. ` +
      `Click **New Claim** in the navigation to get started, or ask me anything about the process.`
    );
  }

  const latest = tickets[0];
  const statusLabel: Record<string, string> = {
    submitted:    'just submitted',
    processing:   'currently being processed by AI',
    pending_info: 'waiting for additional information',
    approved:     'approved',
    rejected:     'not approved',
    appealed:     'under appeal review',
  };
  const label = statusLabel[latest.status] ?? latest.status;
  const count = tickets.length;

  return (
    `Hi ${firstName}! I'm your Opscident claims assistant. ` +
    `You have **${count} claim${count !== 1 ? 's' : ''}** on file. ` +
    `Your most recent claim **${latest.ticket_id}** is ${label}. ` +
    `How can I help you today?`
  );
}

// ─── Markdown-lite renderer ───────────────────────────────────────────────────
// Supports **bold** and newlines only — keeps it safe with no dangerouslySetInnerHTML

function MessageText({ content }: { content: string }) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  const nodes = parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    // Replace \n with <br>
    return part.split('\n').map((line, j, arr) => (
      <span key={`${i}-${j}`}>
        {line}
        {j < arr.length - 1 && <br />}
      </span>
    ));
  });
  return <>{nodes}</>;
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-end gap-1 px-4 py-3">
      <div className="w-8 h-8 rounded-full bg-primary-500/20 border border-primary-500/30 flex items-center justify-center flex-shrink-0">
        <SparklesIcon className="h-4 w-4 text-primary-400" />
      </div>
      <div className="ml-2 flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-sm px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-slate-400"
            style={{ animation: `typingDot 1.2s ${i * 0.2}s ease-in-out infinite` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Typewriter effect ────────────────────────────────────────────────────────

function useTypewriter(
  text: string,
  active: boolean,
  onDone: () => void,
): string {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);

  useEffect(() => {
    if (!active) { setDisplayed(text); return; }

    setDisplayed('');
    indexRef.current = 0;

    const interval = setInterval(() => {
      indexRef.current += 1;
      setDisplayed(text.slice(0, indexRef.current));
      if (indexRef.current >= text.length) {
        clearInterval(interval);
        onDone();
      }
    }, 14); // ~70 chars/sec — readable and impressive

    return () => clearInterval(interval);
  }, [text, active]); // eslint-disable-line react-hooks/exhaustive-deps

  return displayed;
}

// ─── Single message bubble ─────────────────────────────────────────────────────

function AssistantBubble({
  content,
  animate,
  onAnimDone,
}: {
  content: string;
  animate: boolean;
  onAnimDone: () => void;
}) {
  const displayed = useTypewriter(content, animate, onAnimDone);

  return (
    <div className="flex items-end gap-2 px-4 py-1">
      <div className="w-8 h-8 rounded-full bg-primary-500/20 border border-primary-500/30 flex items-center justify-center flex-shrink-0 mb-1">
        <SparklesIcon className="h-4 w-4 text-primary-400" />
      </div>
      <div className="max-w-[78%] bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-slate-200 leading-relaxed">
        <MessageText content={displayed || '…'} />
      </div>
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end px-4 py-1">
      <div className="max-w-[78%] bg-primary-600 rounded-2xl rounded-br-sm px-4 py-2.5 text-sm text-white leading-relaxed">
        {content}
      </div>
    </div>
  );
}

// ─── Main widget ──────────────────────────────────────────────────────────────

export default function ChatWidget() {
  const { user } = useAuthStore();

  const [isOpen, setIsOpen]           = useState(false);
  const [messages, setMessages]       = useState<Message[]>([]);
  const [input, setInput]             = useState('');
  const [, setTickets]                = useState<Ticket[]>([]);
  const [ticketsLoaded, setTicketsLoaded] = useState(false);
  const [loadingReply, setLoadingReply]   = useState(false); // waiting for API
  const [typingMsgId, setTypingMsgId]     = useState<string | null>(null); // typewriter active
  const [initialized, setInitialized]     = useState(false);
  const [chips, setChips]                 = useState<string[]>([]);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loadingReply]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // Add a CSS keyframe for the typing dots (injected once)
  useEffect(() => {
    const id = 'chat-keyframes';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @keyframes typingDot {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
        30% { transform: translateY(-4px); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }, []);

  // On first open: load tickets + post welcome message
  const initialize = useCallback(async () => {
    if (initialized) return;
    setInitialized(true);

    let loadedTickets: Ticket[] = [];
    try {
      const data = await ticketsApi.list();
      loadedTickets = data.results;
      setTickets(loadedTickets);
    } catch (_) {
      // Non-fatal: chatbot works even without ticket data
    }
    setTicketsLoaded(true);
    setChips(getChips(loadedTickets));

    const welcome = buildWelcomeMessage(user?.first_name ?? 'there', loadedTickets);
    const welcomeId = uid();
    setMessages([{ id: welcomeId, role: 'assistant', content: welcome }]);
    setTypingMsgId(welcomeId);
  }, [initialized, user]);

  const handleOpen = () => {
    setIsOpen(true);
    initialize();
  };

  // Send a message (from input OR chip click)
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loadingReply || typingMsgId) return;

      setInput('');

      // Append user message
      const userMsg: Message = { id: uid(), role: 'user', content: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setLoadingReply(true);

      // Build history to send (exclude welcome msg to save tokens)
      const history = messages
        .filter((m) => m.id !== messages[0]?.id || m.role !== 'assistant')
        .map((m) => ({ role: m.role, content: m.content }));
      history.push({ role: 'user', content: trimmed });

      try {
        const { reply } = await aiApi.chat(trimmed, history.slice(0, -1));
        const aiId = uid();
        setMessages((prev) => [...prev, { id: aiId, role: 'assistant', content: reply }]);
        setTypingMsgId(aiId);
      } catch (_) {
        const errId = uid();
        setMessages((prev) => [
          ...prev,
          {
            id: errId,
            role: 'assistant',
            content: "I'm sorry, I couldn't reach the server right now. Please try again in a moment.",
          },
        ]);
        setTypingMsgId(errId);
      } finally {
        setLoadingReply(false);
      }
    },
    [messages, loadingReply, typingMsgId],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const isBusy = loadingReply || !!typingMsgId;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Chat panel ── */}
      <div
        className={`fixed bottom-24 right-6 z-50 flex flex-col w-[360px] max-w-[calc(100vw-3rem)] rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50 transition-all duration-300 origin-bottom-right ${
          isOpen
            ? 'opacity-100 scale-100 pointer-events-auto'
            : 'opacity-0 scale-95 pointer-events-none'
        }`}
        style={{ height: '520px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-gradient-to-r from-primary-500/10 to-sky-500/10 rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary-500/20 border border-primary-500/30 flex items-center justify-center">
              <SparklesIcon className="h-4 w-4 text-primary-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">Claims Assistant</p>
              <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                AI-powered · Knows your claims
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-slate-800"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-3 space-y-1 scrollbar-thin">
          {messages.map((msg) =>
            msg.role === 'user' ? (
              <UserBubble key={msg.id} content={msg.content} />
            ) : (
              <AssistantBubble
                key={msg.id}
                content={msg.content}
                animate={typingMsgId === msg.id}
                onAnimDone={() => setTypingMsgId(null)}
              />
            ),
          )}

          {loadingReply && <TypingDots />}
          <div ref={bottomRef} />
        </div>

        {/* Quick-reply chips */}
        {ticketsLoaded && chips.length > 0 && messages.length <= 1 && !isBusy && (
          <div className="px-4 pb-2">
            <p className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wider">Suggested questions</p>
            <div className="flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => sendMessage(chip)}
                  className="text-xs px-3 py-1.5 rounded-full border border-primary-500/30 bg-primary-500/10 text-primary-300 hover:bg-primary-500/20 transition-colors text-left"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="px-3 pb-3 pt-1 border-t border-slate-700">
          <div className="flex items-center gap-2 bg-slate-800 rounded-xl border border-slate-700 focus-within:border-primary-500/50 transition-colors pr-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isBusy}
              placeholder={isBusy ? 'Waiting for reply…' : 'Ask about your claim…'}
              className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none px-3 py-2.5"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isBusy}
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-primary-600 hover:bg-primary-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <PaperAirplaneIcon className="h-4 w-4 text-white" />
            </button>
          </div>
          <p className="text-center text-[10px] text-slate-600 mt-1.5">
            AI may make mistakes — verify important details
          </p>
        </div>
      </div>

      {/* ── Floating bubble button ── */}
      <button
        onClick={isOpen ? () => setIsOpen(false) : handleOpen}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg shadow-black/40 flex items-center justify-center transition-all duration-300 ${
          isOpen
            ? 'bg-slate-700 hover:bg-slate-600'
            : 'bg-primary-600 hover:bg-primary-500'
        }`}
        aria-label={isOpen ? 'Close chat' : 'Open claims assistant'}
      >
        <div
          className={`absolute inset-0 transition-all duration-300 flex items-center justify-center ${
            isOpen ? 'opacity-100 rotate-0' : 'opacity-0 rotate-90'
          }`}
        >
          <XMarkIcon className="h-6 w-6 text-white" />
        </div>
        <div
          className={`absolute inset-0 transition-all duration-300 flex items-center justify-center ${
            isOpen ? 'opacity-0 -rotate-90' : 'opacity-100 rotate-0'
          }`}
        >
          <ChatBubbleLeftRightIcon className="h-6 w-6 text-white" />
        </div>

        {/* Pulse ring when closed to draw attention */}
        {!isOpen && (
          <span className="absolute inset-0 rounded-full bg-primary-500 animate-ping opacity-20" />
        )}
      </button>
    </>
  );
}
