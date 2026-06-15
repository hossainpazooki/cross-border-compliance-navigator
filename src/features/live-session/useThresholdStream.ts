import { STREAM_TRANSPORT, WS_BASE_URL } from '@shared/config/env';
import { useWsTransport } from './useWsTransport';
import { useSseTransport } from './useSseTransport';

interface UseThresholdStreamOptions {
  intentId: string | undefined;
  enabled?: boolean;
}

type Transport = 'ws' | 'sse';

// Transport selection (wires the formerly-dead STREAM_TRANSPORT constant):
//   1. NEXT_PUBLIC_STREAM_TRANSPORT explicit ('ws'|'sse')  => obey it.
//   2. else WS iff NEXT_PUBLIC_WS_BASE_URL is set.
//   3. else SSE same-origin.
// So `next dev` alone (no WS env) is self-sufficient via the SSE route handler,
// and `npm run dev:all` (which sets NEXT_PUBLIC_WS_BASE_URL) keeps the WS path.
function selectTransport(): Transport {
  if (STREAM_TRANSPORT === 'ws' || STREAM_TRANSPORT === 'sse') return STREAM_TRANSPORT;
  return WS_BASE_URL ? 'ws' : 'sse';
}

// Reads the live-session WS endpoint base from env (NEXT_PUBLIC_WS_BASE_URL,
// centralized in src/shared/config/env.ts). Default falls back to the local
// reference-backend WS when unset so `npm run dev:all` works with zero env.
function wsBaseUrl(): string {
  return WS_BASE_URL || 'ws://localhost:8787';
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

// Absolute http origin for the WS-mode audit refetch (REST may live on a
// different origin than the WS endpoint in real deployments).
function wsHttpBaseUrl(): string {
  return wsBaseUrl().replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
}

// Same-origin SSE route served by the Next route handler.
function buildSseUrl(intentId: string): string {
  return `/v2/stream/trade/${intentId}`;
}

/**
 * Facade over the two transports. Both hooks are ALWAYS called (Rules of Hooks),
 * but exactly ONE receives a non-null URL — the other is a skip/no-op. The
 * public API/return shape (`{ readyState }`) is preserved so existing call sites
 * and tests are unaffected; in SSE mode `readyState` reflects the (idle) WS hook,
 * which is never connected.
 */
export function useThresholdStream({ intentId, enabled = true }: UseThresholdStreamOptions) {
  const active = Boolean(intentId) && enabled;
  const transport = selectTransport();

  const wsUrl = active && transport === 'ws' ? buildWsUrl(intentId as string) : null;
  const sseUrl = active && transport === 'sse' ? buildSseUrl(intentId as string) : null;

  const { readyState } = useWsTransport({
    intentId,
    url: wsUrl,
    auditBaseUrl: wsHttpBaseUrl(),
  });

  useSseTransport({ intentId, url: sseUrl });

  return { readyState };
}
