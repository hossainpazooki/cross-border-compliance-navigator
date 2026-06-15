import { decodeIntentId } from '@platform/reference-backend/intent-codec';
import { streamScenario } from '@platform/reference-backend/stream';
import { DEFAULT_SCENARIO } from '@platform/reference-backend/fixtures';

// Long-lived SSE response: keep it on the Node runtime (the @platform stream core
// uses Buffer-decodable ids and timers), never cache, and allow up to 60s of
// streaming on Vercel.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const HEARTBEAT_MS = 20_000;
const encoder = new TextEncoder();

// GET /v2/stream/trade/:intentId (SSE) — the serverless twin of the express SSE
// handler in `app.ts`. Frame format is IDENTICAL: `id:` = envelope.seq,
// `data:` = JSON(envelope), `:` heartbeat comments, terminal `event: end`. The
// body is a ReadableStream driven by the shared `streamScenario` generator (the
// one source of replay timing the WS path also uses). Imports ONLY safe subpaths
// of @platform/reference-backend — never the express/ws root.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ intentId: string }> }
) {
  const { intentId } = await params;

  // Unknown / undecodable id => 404 (not a stream), matching the express guard.
  const intent = decodeIntentId(intentId);
  if (!intent) {
    return new Response(JSON.stringify({ error: 'not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const scenario = url.searchParams.get('scenario') ?? DEFAULT_SCENARIO;
  const speed = Number(url.searchParams.get('speed') ?? '1') || 1;

  // Resume cursor: Last-Event-ID header (EventSource auto-reconnect) takes
  // precedence over an explicit ?fromSeq=… query — same precedence as express.
  const lastEventId = request.headers.get('Last-Event-ID');
  const fromSeq =
    Number(lastEventId ?? url.searchParams.get('fromSeq') ?? '0') || 0;

  // One AbortController fed by BOTH the request signal (client disconnect) AND
  // the stream's own cancel() (consumer went away) so a dropped connection stops
  // the generator promptly instead of replaying into the void.
  const abort = new AbortController();
  const onRequestAbort = () => abort.abort();
  if (request.signal.aborted) abort.abort();
  else request.signal.addEventListener('abort', onRequestAbort, { once: true });

  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const safeEnqueue = (chunk: string): boolean => {
        try {
          controller.enqueue(encoder.encode(chunk));
          return true;
        } catch {
          // Controller already closed (consumer gone) — stop writing.
          return false;
        }
      };

      // ':' comment lines are SSE heartbeats — ignored by EventSource, they keep
      // the connection warm without being parsed as data.
      heartbeat = setInterval(() => {
        if (abort.signal.aborted) return;
        safeEnqueue(': ping\n\n');
      }, HEARTBEAT_MS);

      try {
        for await (const { envelope } of streamScenario({
          scenario,
          speed,
          fromSeq,
          signal: abort.signal,
        })) {
          if (abort.signal.aborted) break;
          if (!safeEnqueue(`id: ${envelope.seq}\n`)) break;
          if (!safeEnqueue(`data: ${JSON.stringify(envelope)}\n\n`)) break;
        }
        // Terminal frame: a named 'end' event marks a clean replay completion so
        // the client closes instead of auto-reconnecting (done vs. dropped).
        if (!abort.signal.aborted) {
          safeEnqueue('event: end\n');
          safeEnqueue('data: {}\n\n');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!abort.signal.aborted) {
          const errorEnvelope = {
            seq: 0,
            ts: new Date().toISOString(),
            type: 'error' as const,
            payload: { code: 'fixture_load_failed', message },
          };
          safeEnqueue(`data: ${JSON.stringify(errorEnvelope)}\n\n`);
        }
      } finally {
        if (heartbeat) clearInterval(heartbeat);
        request.signal.removeEventListener('abort', onRequestAbort);
        try {
          controller.close();
        } catch {
          // already closed — fine.
        }
      }
    },
    cancel() {
      // Consumer (browser) disconnected: abort the generator so replay stops.
      abort.abort();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
    },
  });
}
