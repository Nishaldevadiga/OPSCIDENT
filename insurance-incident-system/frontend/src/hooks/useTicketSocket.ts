import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';

export interface TicketSocketEvent {
  type: string;
  step?: string;
  message?: string;
  status?: string;
}

const TERMINAL_STEPS = new Set(['decided']);
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECTS = 5;

export function useTicketSocket(
  ticketId: number | string | undefined,
  onEvent: (event: TicketSocketEvent) => void,
  enabled = true,
) {
  const token = useAuthStore((s) => s.accessToken);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!ticketId || !token || !enabled) return;

    stoppedRef.current = false;
    reconnectCount.current = 0;

    function connect() {
      if (stoppedRef.current) return;

      const apiBase = import.meta.env.VITE_API_BASE_URL;
      let url: string;
      if (
        apiBase &&
        (apiBase.startsWith('http://') || apiBase.startsWith('https://'))
      ) {
        const u = new URL(apiBase);
        const wsProto = u.protocol === 'https:' ? 'wss:' : 'ws:';
        url = `${wsProto}//${u.host}/ws/tickets/${ticketId}/?token=${token}`;
      } else {
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const host = window.location.host;
        url = `${protocol}://${host}/ws/tickets/${ticketId}/?token=${token}`;
      }
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const data: TicketSocketEvent = JSON.parse(e.data);
          onEventRef.current(data);
          if (data.step && TERMINAL_STEPS.has(data.step)) {
            stoppedRef.current = true;
            ws.close(1000);
          }
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = (e) => {
        wsRef.current = null;
        if (stoppedRef.current || e.code === 4001 || e.code === 4003) return;
        if (reconnectCount.current >= MAX_RECONNECTS) return;
        reconnectCount.current++;
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    }

    connect();

    return () => {
      stoppedRef.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close(1000);
    };
  }, [ticketId, token, enabled]);
}
