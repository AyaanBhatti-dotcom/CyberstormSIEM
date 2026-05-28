import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiveState, TeamActivity } from '../types';

const WS_URL =
  import.meta.env.DEV
    ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/live`
    : 'ws://localhost:8000/ws/live';

export function useLiveFeed() {
  const [state, setState] = useState<LiveState | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastActivity, setLastActivity] = useState<TeamActivity | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      retryRef.current = setTimeout(connect, 2500);
    };
    ws.onerror = () => ws.close();

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'state') {
          setState(msg.data as LiveState);
        } else if (msg.type === 'activity') {
          const activity = msg.data as TeamActivity;
          setLastActivity(activity);
          setHighlightId(activity.id);
          setTimeout(() => setHighlightId((id) => (id === activity.id ? null : id)), 2000);
        }
      } catch {
        /* ignore malformed */
      }
    };
  }, []);

  useEffect(() => {
    fetch('/api/state')
      .then((r) => r.json())
      .then((data) => setState(data))
      .catch(() => {});

    connect();
    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { state, connected, lastActivity, highlightId };
}

export function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
