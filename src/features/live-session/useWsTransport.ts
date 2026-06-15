import { useCallback, useEffect, useRef } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { type WSEnvelope } from '@platform/contracts';
import { useSessionStore } from './store';
import { processFrame, type PipelineContext } from './streamPipeline';

const HEARTBEAT_TIMEOUT_MS = 30_000;
const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000];

interface UseWsTransportOptions {
  intentId: string | undefined;
  /** Fully-built ws:// URL, or null to skip this transport. */
  url: string | null;
  /** Absolute http origin for the audit refetch (REST may differ from WS). */
  auditBaseUrl: string;
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

/**
 * The WebSocket transport, lifted verbatim out of useThresholdStream: the
 * react-use-websocket connection, the subscribe-on-open frame, the text
 * ping/pong heartbeat, the idle-timeout watcher, and feeding each text frame
 * into the shared streamPipeline. Behavior is unchanged from the original hook.
 *
 * Pass `url: null` to make this a no-op (the facade calls both transports with
 * exactly one non-null URL).
 */
export function useWsTransport({ intentId, url, auditBaseUrl }: UseWsTransportOptions) {
  const applyEnvelope = useSessionStore((s) => s.applyEnvelope);
  const replayAuditEnvelopes = useSessionStore((s) => s.replayAuditEnvelopes);
  const setConnection = useSessionStore((s) => s.setConnection);
  const setLastError = useSessionStore((s) => s.setLastError);
  const lastMessageAtRef = useRef<number>(Date.now());
  // Tracks whether the server told us the intent is terminal — once true we
  // stop reconnect attempts because the backend will refuse them.
  const terminalRef = useRef<boolean>(false);

  const ctx = useCallback(
    (id: string): PipelineContext => ({
      intentId: id,
      auditBaseUrl,
      applyEnvelope,
      replayAuditEnvelopes,
      setConnection,
      setLastError,
      onTerminal: () => {
        terminalRef.current = true;
      },
    }),
    [auditBaseUrl, applyEnvelope, replayAuditEnvelopes, setConnection, setLastError]
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

    processFrame(text, ctx(intentId));
  }, [lastMessage, intentId, sendMessage, ctx]);

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
