import type { WSEnvelope } from '@platform/contracts';
import { loadFixture, type FixtureFrame } from './replay';
import { DEFAULT_SCENARIO } from './fixtures-data';

export interface StreamOptions {
  scenario?: string;
  /** Replay-speed multiplier; <=0 falls back to a tiny epsilon (no divide-by-zero). */
  speed?: number;
  /** Resume cursor: only frames with `envelope.seq > fromSeq` are yielded. */
  fromSeq?: number;
  /** Aborts the generator between (or during) frame delays. */
  signal?: AbortSignal;
}

export interface StreamFrame {
  delay_ms: number;
  envelope: WSEnvelope;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (ms <= 0) {
      resolve();
      return;
    }
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Single source of replay timing for the reference backend. A cancellable async
 * generator that walks a fixture's frames, sleeping `delay_ms / speed` before
 * each, and yields `{ delay_ms, envelope }`. Both the WS path (`app.ts`) and the
 * SSE path consume this — there is exactly one place that decides "when".
 *
 * Cancellation: the `signal` aborts the inter-frame sleep and ends iteration on
 * the next loop check, so a closed connection stops the replay promptly.
 *
 * Resume: `fromSeq` skips every frame whose envelope seq is <= the cursor (no
 * delay is spent on skipped frames), implementing Last-Event-ID / gap recovery.
 */
export async function* streamScenario(
  options: StreamOptions = {}
): AsyncGenerator<StreamFrame, void, void> {
  const scenario = options.scenario ?? DEFAULT_SCENARIO;
  const speed = Math.max(options.speed ?? 1, 0.001);
  const fromSeq = options.fromSeq ?? 0;
  const signal = options.signal;

  const frames: FixtureFrame[] = await loadFixture(scenario);

  for (const frame of frames) {
    if (signal?.aborted) return;
    // Resume: skip already-delivered frames without spending their delay.
    if (frame.envelope.seq <= fromSeq) continue;

    await sleep(frame.delay_ms / speed, signal);
    if (signal?.aborted) return;

    yield { delay_ms: frame.delay_ms, envelope: frame.envelope };
  }
}
