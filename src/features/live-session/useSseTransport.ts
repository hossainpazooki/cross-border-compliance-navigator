import { useEffect, useRef } from 'react';
import { useSessionStore } from './store';
import { processFrame, type PipelineContext } from './streamPipeline';

interface UseSseTransportOptions {
  intentId: string | undefined;
  /** Same-origin SSE URL ('/v2/stream/trade/{id}'), or null to skip. */
  url: string | null;
}

/**
 * The SSE transport. An EventSource consumes the same-origin
 * `/v2/stream/trade/{id}` route and feeds each `message` frame into the SAME
 * streamPipeline the WS path uses (identical parse/guard/gap/terminal-error
 * logic). Audit refetch is RELATIVE ('/audit/{id}') because SSE is same-origin.
 *
 * Replay-restart latch: EventSource auto-reconnects when the connection drops,
 * and a reconnect would restart the fixture replay from the top — re-delivering
 * every envelope (duplicating append-only artifacts like auditor findings). The
 * server marks a CLEAN completion with a named `end` event; on it we call
 * `close()` so the browser does NOT reconnect, and we latch so a late effect
 * re-run cannot reopen. This mirrors the single-replay latch the reference
 * backend enforces server-side (see app.ts `replayStarted`).
 *
 * Pass `url: null` to make this a no-op (the facade calls both transports with
 * exactly one non-null URL).
 */
export function useSseTransport({ intentId, url }: UseSseTransportOptions) {
  const applyEnvelope = useSessionStore((s) => s.applyEnvelope);
  const replayAuditEnvelopes = useSessionStore((s) => s.replayAuditEnvelopes);
  const setConnection = useSessionStore((s) => s.setConnection);
  const setLastError = useSessionStore((s) => s.setLastError);
  // Latched once the stream signals a clean `end`. Survives effect re-runs so a
  // completed replay is never restarted by a reopened EventSource.
  const endedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!intentId || !url) return;
    if (endedRef.current) return;

    const ctx: PipelineContext = {
      intentId,
      auditBaseUrl: '', // same-origin => relative '/audit/{id}'
      applyEnvelope,
      replayAuditEnvelopes,
      setConnection,
      setLastError,
    };

    const es = new EventSource(url);

    es.onopen = () => {
      setConnection(intentId, 'open');
    };

    es.onmessage = (event: MessageEvent) => {
      // EventSource never surfaces ':' heartbeat comments as messages, and the
      // SSE route never sends 'ping'/'pong' text — every data frame here is a
      // JSON envelope, so it goes straight into the shared pipeline.
      processFrame(event.data, ctx);
    };

    // Named terminal event: clean completion. Latch + close so the browser does
    // NOT auto-reconnect and restart the replay.
    es.addEventListener('end', () => {
      endedRef.current = true;
      es.close();
      setConnection(intentId, 'closed');
    });

    es.onerror = () => {
      // A genuine drop (not the clean `end`, which already closed). The browser
      // would auto-reconnect; surface the error state like the WS path does.
      if (!endedRef.current) setConnection(intentId, 'error');
    };

    return () => {
      es.close();
    };
  }, [intentId, url, applyEnvelope, replayAuditEnvelopes, setConnection, setLastError]);

  return {};
}
