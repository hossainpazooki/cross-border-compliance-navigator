import { useCallback, useEffect, useRef } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { isWSEnvelope, type ServerEnvelope, type WSEnvelope } from '@platform/contracts';
import { useSessionStore } from './store';

const HEARTBEAT_TIMEOUT_MS = 30_000;
const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000];

// Error codes that mean "do not reconnect"; the WS endpoint will reject any
// fresh attempt with the same intent_id. See institutional-defi-platform-api
// `ws_handler.py` + `session_registry.IntentTerminalError`.
const TERMINAL_ERROR_CODES = new Set(['intent_terminal']);

interface UseThresholdStreamOptions {
  intentId: string | undefined;
  enabled?: boolean;
}

// Reads the live-session WS endpoint base from env. Under Vite this resolves to
// `import.meta.env.VITE_WS_URL`; once migrated to Next 15 (Phase C1) this also
// honors `NEXT_PUBLIC_WS_BASE_URL` injected at build time. Default falls back
// to the local mock-ws server.
function wsBaseUrl(): string {
  const fromVite = (import.meta.env as Record<string, string | undefined>).VITE_WS_URL;
  // process.env reference survives Vite tree-shaking; guarded so unset stays unset.
  const fromNext =
    typeof process !== 'undefined' && process.env
      ? (process.env as Record<string, string | undefined>).NEXT_PUBLIC_WS_BASE_URL
      : undefined;
  return fromVite || fromNext || 'ws://localhost:8787';
}

function buildWsUrl(intentId: string): string {
  const base = wsBaseUrl();
  // Backend route is path-based: /v2/ws/trade/{intent_id} (see ws_handler.py).
  // Legacy mock-ws used a query string; treat that as a special case so older
  // local dev tooling keeps working without rebuilding.
  if (base.includes('localhost:8787') && !base.includes('/v2/')) {
    return `${base}?intent_id=${intentId}`;
  }
  return `${base}/v2/ws/trade/${intentId}`;
}

function httpBaseUrl(): string {
  const ws = wsBaseUrl();
  return ws.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
}

// WebSocket frame data can arrive as string, Blob, or ArrayBuffer depending on
// `binaryType`. We need a synchronous read of small text frames ("ping") AND a
// path for JSON envelopes which the backend currently sends as text JSON. Blobs
// are read async — return null and the caller falls back to a slow path.
function readFrameSync(data: unknown): string | null {
  if (typeof data === 'string') return data;
  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(new Uint8Array(data));
  }
  return null;
}

export function useThresholdStream({ intentId, enabled = true }: UseThresholdStreamOptions) {
  const url = intentId && enabled ? buildWsUrl(intentId) : null;
  const applyEnvelope = useSessionStore((s) => s.applyEnvelope);
  const replayAuditEnvelopes = useSessionStore((s) => s.replayAuditEnvelopes);
  const setConnection = useSessionStore((s) => s.setConnection);
  const setLastError = useSessionStore((s) => s.setLastError);
  const lastMessageAtRef = useRef<number>(Date.now());
  // Tracks whether the server told us the intent is terminal — once true we
  // stop reconnect attempts because the backend will refuse them.
  const terminalRef = useRef<boolean>(false);

  const handleAuditRefetch = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`${httpBaseUrl()}/audit/${id}`);
        if (!res.ok) throw new Error(`audit fetch ${res.status}`);
        const body: unknown = await res.json();
        if (!Array.isArray(body)) throw new Error('audit body is not an array');
        const envelopes: ServerEnvelope[] = [];
        for (const item of body) {
          if (isWSEnvelope(item) && item.type !== 'subscribe') {
            envelopes.push(item as ServerEnvelope);
          }
        }
        replayAuditEnvelopes(id, envelopes);
      } catch {
        setConnection(id, 'error');
      }
    },
    [replayAuditEnvelopes, setConnection]
  );

  const { lastMessage, readyState, sendMessage, sendJsonMessage } = useWebSocket(url, {
    shouldReconnect: () => !terminalRef.current,
    reconnectAttempts: RECONNECT_DELAYS_MS.length,
    reconnectInterval: (attempt) =>
      RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)],
    heartbeat: false,
    onOpen: () => {
      if (!intentId) return;
      // Backend emits its own `subscribe` envelope as the first frame after
      // accept (see ws_handler.py). Sending a client subscribe is harmless on
      // the real server (it's ignored) but keeps the legacy mock-ws working,
      // which routes replay off the subscribe payload.
      const subscribe: WSEnvelope = {
        seq: 0,
        ts: new Date().toISOString(),
        type: 'subscribe',
        payload: { intent_id: intentId },
      };
      sendJsonMessage(subscribe);
      setConnection(intentId, 'open');
      lastMessageAtRef.current = Date.now();
    },
    onClose: () => {
      if (intentId) setConnection(intentId, 'closed');
    },
    onError: () => {
      if (intentId) setConnection(intentId, 'error');
    },
  });

  useEffect(() => {
    if (!intentId || !lastMessage) return;
    lastMessageAtRef.current = Date.now();

    const text = readFrameSync(lastMessage.data);
    if (text === null) {
      // Binary blob: skip rather than block on async read. Real backend
      // currently sends text frames for both ping and JSON envelopes.
      return;
    }

    // Server-driven heartbeat: a bare "ping" text frame demands a "pong" reply
    // within WS_PONG_TIMEOUT_SECONDS or the server closes with ws_idle_timeout.
    // Critically, this is NOT a JSON envelope — don't parse it.
    if (text === 'ping') {
      sendMessage('pong');
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return;
    }
    if (!isWSEnvelope(parsed) || parsed.type === 'subscribe') return;

    const envelope = parsed as ServerEnvelope;

    if (envelope.type === 'error') {
      const { code, message } = envelope.payload;
      setLastError(intentId, { code, message });
      if (TERMINAL_ERROR_CODES.has(code)) {
        terminalRef.current = true;
      }
    }

    const { gap } = applyEnvelope(intentId, envelope);
    if (gap) {
      void handleAuditRefetch(intentId);
    }
  }, [lastMessage, intentId, applyEnvelope, handleAuditRefetch, sendMessage, setLastError]);

  useEffect(() => {
    if (!intentId || readyState !== ReadyState.OPEN) return;
    const interval = setInterval(() => {
      if (Date.now() - lastMessageAtRef.current > HEARTBEAT_TIMEOUT_MS) {
        setConnection(intentId, 'error');
      }
    }, 5_000);
    return () => clearInterval(interval);
  }, [intentId, readyState, setConnection]);

  return { readyState };
}
