import type { WSEnvelope } from '@platform/contracts';
import { isWSEnvelope } from '@platform/contracts';
import { FIXTURES, DEFAULT_SCENARIO, listScenarios } from './fixtures-data';

export interface FixtureFrame {
  delay_ms: number;
  envelope: WSEnvelope;
}

/**
 * Validate the static fixture data (from `fixtures-data.ts`) for one scenario
 * into typed frames. The `fs` read path was removed so the core is
 * serverless-safe; the `isWSEnvelope` validation loop stays — the JSON import
 * only guarantees JSON shape, not contract conformance. Kept async so existing
 * call sites (`app.ts`, the `/audit` route) are unchanged.
 */
export async function loadFixture(scenario: string = DEFAULT_SCENARIO): Promise<FixtureFrame[]> {
  const parsed: unknown = FIXTURES[scenario];
  if (parsed === undefined) {
    throw new Error(`fixture ${scenario}: unknown scenario`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`fixture ${scenario}: top level must be an array`);
  }
  const frames: FixtureFrame[] = [];
  for (const [i, item] of parsed.entries()) {
    if (
      !item ||
      typeof item !== 'object' ||
      typeof (item as { delay_ms?: unknown }).delay_ms !== 'number' ||
      !isWSEnvelope((item as { envelope?: unknown }).envelope)
    ) {
      throw new Error(`fixture ${scenario} entry ${i} invalid`);
    }
    frames.push(item as FixtureFrame);
  }
  return frames;
}

export interface ReplayController {
  cancel: () => void;
  done: Promise<void>;
}

export function replay(
  frames: FixtureFrame[],
  onEnvelope: (envelope: WSEnvelope) => void,
  speed: number = 1
): ReplayController {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const done = new Promise<void>((resolve) => {
    let i = 0;
    const tick = () => {
      if (cancelled || i >= frames.length) {
        resolve();
        return;
      }
      const frame = frames[i++];
      timer = setTimeout(() => {
        if (cancelled) {
          resolve();
          return;
        }
        try {
          onEnvelope(frame.envelope);
        } catch {
          // swallow — the connection may have closed mid-replay
        }
        tick();
      }, Math.max(0, frame.delay_ms / Math.max(speed, 0.001)));
    };
    tick();
  });

  return {
    cancel: () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    },
    done,
  };
}

export function listFixtures(): string[] {
  return listScenarios();
}
