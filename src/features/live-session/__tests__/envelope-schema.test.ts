import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { isWSEnvelope } from '@platform/contracts';

const FIXTURES = ['mica-threshold-crossing', 'retraction', 'multi-crossing'] as const;

async function loadFixture(name: string) {
  const file = path.resolve(__dirname, '..', '..', '..', '..', 'tools', 'mock-ws', 'fixtures', `${name}.json`);
  return JSON.parse(await readFile(file, 'utf-8')) as Array<{ delay_ms: number; envelope: unknown }>;
}

describe('fixture envelopes validate against @platform/contracts', () => {
  for (const name of FIXTURES) {
    it(`${name}.json — every envelope passes isWSEnvelope`, async () => {
      const frames = await loadFixture(name);
      expect(frames.length).toBeGreaterThan(0);
      for (const [i, frame] of frames.entries()) {
        expect(typeof frame.delay_ms, `frame ${i} delay_ms`).toBe('number');
        expect(isWSEnvelope(frame.envelope), `frame ${i} envelope`).toBe(true);
      }
    });

    it(`${name}.json — envelope seq is strictly monotonic`, async () => {
      const frames = await loadFixture(name);
      let lastSeq = 0;
      for (const [i, frame] of frames.entries()) {
        const env = frame.envelope as { seq: number };
        expect(env.seq, `frame ${i}`).toBe(lastSeq + 1);
        lastSeq = env.seq;
      }
    });
  }
});
