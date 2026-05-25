import { useCallback, useEffect, useRef } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { isWSEnvelope, type ServerEnvelope, type WSEnvelope } from '@platform/contracts';
import { useSessionStore } from './store';

const HEARTBEAT_TIMEOUT_MS = 30_000;
const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000];

interface UseThresholdStreamOptions {
  intentId: string | undefined;
  enabled?: boolean;
}

function wsBaseUrl(): string {
  return import.meta.env.VITE_WS_URL || 'ws://localhost:8787';
}

function httpBaseUrl(): string {
  const ws = wsBaseUrl();
  return ws.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
}

export function useThresholdStream({ intentId, enabled = true }: UseThresholdStreamOptions) {
  const url = intentId && enabled ? `${wsBaseUrl()}?intent_id=${intentId}` : null;
  const applyEnvelope = useSessionStore((s) => s.applyEnvelope);
  const replayAuditEnvelopes = useSessionStore((s) => s.replayAuditEnvelopes);
  const setConnection = useSessionStore((s) => s.setConnection);
  const lastMessageAtRef = useRef<number>(Date.now());

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

  const { lastMessage, readyState, sendJsonMessage } = useWebSocket(url, {
    shouldReconnect: () => true,
    reconnectAttempts: RECONNECT_DELAYS_MS.length,
    reconnectInterval: (attempt) =>
      RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)],
    heartbeat: false,
    onOpen: () => {
      if (!intentId) return;
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

    let parsed: unknown;
    try {
      parsed = JSON.parse(lastMessage.data as string);
    } catch {
      return;
    }
    if (!isWSEnvelope(parsed) || parsed.type === 'subscribe') return;

    const { gap } = applyEnvelope(intentId, parsed as ServerEnvelope);
    if (gap) {
      void handleAuditRefetch(intentId);
    }
  }, [lastMessage, intentId, applyEnvelope, handleAuditRefetch]);

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
