// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { serveVerify, ArtifactNotFoundError } from '../registryClient';
import { decideGate } from '../verificationPolicy';

// LIVE integration proof against a running `ke serve` (ATLAS
// scripts/serve-published-registry.sh). UNLIKE the unit tests, nothing here is
// mocked — the real client hits the real server, and decideGate runs over the
// real verdict. Skipped unless the env points at a live registry, so it never
// runs (or flakes) in normal CI:
//
//   ATLAS_LIVE_REGISTRY_URL=http://127.0.0.1:9999 \
//   ATLAS_LIVE_PUB_HASH=<published hash printed by the script> \
//   ATLAS_LIVE_UNPUB_HASH=<the seeded non-published hash> \
//   npx vitest run src/shared/atlas/__tests__/liveVerify.integration.test.ts
const URL = process.env.ATLAS_LIVE_REGISTRY_URL;
const PUB = process.env.ATLAS_LIVE_PUB_HASH;
const UNPUB = process.env.ATLAS_LIVE_UNPUB_HASH;

describe.skipIf(!URL || !PUB || !UNPUB)('live ke serve verification (ADR-0019)', () => {
  it('a Published artifact verifies and the gate ALLOWS it', async () => {
    const res = await serveVerify(URL as string, PUB as string);
    expect(res.verdict).toBe('verified');
    expect(res.registry_state).toBe('Published');
    expect(decideGate({ cryptoVerdict: { kind: 'verified' }, registryState: res.registry_state, isTestKey: true })).toEqual({
      status: 'allowed',
      testKey: true,
    });
  });

  it('a non-Published artifact is BLOCKED even though it exists (fail-closed)', async () => {
    const res = await serveVerify(URL as string, UNPUB as string);
    // The server returns a rejected verdict and a non-Published state; either way
    // the gate must block. Build evidence from the real response and assert blocked.
    const verdict =
      res.verdict === 'verified'
        ? ({ kind: 'verified' } as const)
        : ({ kind: 'rejected', reason: res.rejection ?? 'rejected' } as const);
    const decision = decideGate({ cryptoVerdict: verdict, registryState: res.registry_state, isTestKey: true });
    expect(decision.status).toBe('blocked');
    expect(res.registry_state).not.toBe('Published');
  });

  it('an unknown hash throws ArtifactNotFoundError (404)', async () => {
    await expect(serveVerify(URL as string, '0'.repeat(64))).rejects.toBeInstanceOf(
      ArtifactNotFoundError,
    );
  });
});
