import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WSEnvelope } from '@platform/contracts';
import { isWSEnvelope } from '@platform/contracts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures');
const DEFAULT_SCENARIO = 'mica-threshold-crossing';

export interface FixtureFrame {
  delay_ms: number;
  envelope: WSEnvelope;
}

export async function loadFixture(scenario: string = DEFAULT_SCENARIO): Promise<FixtureFrame[]> {
  const file = path.join(FIXTURES_DIR, `${scenario}.json`);
  const raw = await readFile(file, 'utf-8');
  const parsed: unknown = JSON.parse(raw);
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
  return ['mica-threshold-crossing', 'retraction', 'multi-crossing'];
}

export { FIXTURES_DIR };
