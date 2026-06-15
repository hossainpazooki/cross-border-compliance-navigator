import { isWSEnvelope, type ServerEnvelope } from '@platform/contracts';
import type { useSessionStore } from './store';

// Error codes that mean "do not reconnect"; the WS endpoint will reject any
// fresh attempt with the same intent_id. See institutional-defi-platform-api
// `ws_handler.py` + `session_registry.IntentTerminalError`.
export const TERMINAL_ERROR_CODES = new Set(['intent_terminal']);

// The slice of the session store the pipeline needs. Keeping this narrow means a
// transport hook can pass plain store actions (already bound to selectors) and
// the pipeline stays framework-agnostic / directly unit-testable.
export interface PipelineStoreActions {
  applyEnvelope: ReturnType<typeof useSessionStore.getState>['applyEnvelope'];
  replayAuditEnvelopes: ReturnType<typeof useSessionStore.getState>['replayAuditEnvelopes'];
  setConnection: ReturnType<typeof useSessionStore.getState>['setConnection'];
  setLastError: ReturnType<typeof useSessionStore.getState>['setLastError'];
}

export interface PipelineContext extends PipelineStoreActions {
  intentId: string;
  /**
   * Base for the audit refetch. WS mode passes the absolute http origin derived
   * from the WS base (REST may live on a different origin); SSE/same-origin mode
   * passes '' so the refetch hits the RELATIVE '/audit/{id}' on the page origin.
   */
  auditBaseUrl: string;
  /** Set true (latched) when a terminal error envelope arrives. */
  onTerminal?: () => void;
}

/**
 * Fetch the full audit replay and feed it to the store. Shared by both
 * transports. On any failure the session is flipped to 'error' (same as the
 * original useThresholdStream behavior).
 */
export async function fetchAuditAndReplay(ctx: PipelineContext): Promise<void> {
  const { intentId, auditBaseUrl, replayAuditEnvelopes, setConnection } = ctx;
  try {
    const res = await fetch(`${auditBaseUrl}/audit/${intentId}`);
    if (!res.ok) throw new Error(`audit fetch ${res.status}`);
    const body: unknown = await res.json();
    if (!Array.isArray(body)) throw new Error('audit body is not an array');
    const envelopes: ServerEnvelope[] = [];
    for (const item of body) {
      if (isWSEnvelope(item) && item.type !== 'subscribe') {
        envelopes.push(item as ServerEnvelope);
      }
    }
    replayAuditEnvelopes(intentId, envelopes);
  } catch {
    setConnection(intentId, 'error');
  }
}

/**
 * PURE shared frame processing lifted out of useThresholdStream so the WS and
 * SSE transports run identical envelope logic: JSON.parse -> isWSEnvelope guard
 * (drop non-envelopes and server `subscribe` frames) -> terminal-error capture
 * -> applyEnvelope (store update) -> sequence-gap detection -> audit refetch.
 *
 * `text` is one already-decoded text frame. Heartbeat 'ping'/'pong' frames are
 * the transport's concern and must be filtered BEFORE calling this (an SSE
 * EventSource never delivers them as data; the WS hook handles 'ping' itself).
 *
 * No behavior change for the WS path — this is the same sequence the original
 * effect ran inline.
 */
export function processFrame(text: string, ctx: PipelineContext): void {
  const { intentId, applyEnvelope, setLastError, onTerminal } = ctx;

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
      onTerminal?.();
    }
  }

  const { gap } = applyEnvelope(intentId, envelope);
  if (gap) {
    void fetchAuditAndReplay(ctx);
  }
}
