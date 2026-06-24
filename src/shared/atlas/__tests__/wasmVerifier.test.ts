import { describe, expect, it, vi } from 'vitest';
import { parseWasmVerdict, verifyWithWasm, type ArtifactVerifyFn } from '../wasmVerifier';

// The in-browser verifier (@platform/atlas-artifact `verify_artifact`) returns a
// JSON string whose `verdict` is "verified" or "rejected:<reason>" (the reason is
// INLINE after a colon — unlike ke serve's separate {verdict, rejection}). These
// tests pin OUR parsing of that shape and the decideGate mapping. The verify fn is
// INJECTED, so nothing here imports the (unpublished) wasm package.

describe('parseWasmVerdict — maps the wasm verify_artifact JSON to evidence', () => {
  it('verified + Published + test key -> evidence the gate allows', () => {
    const ev = parseWasmVerdict(
      JSON.stringify({
        verdict: 'verified',
        registry_state: 'Published',
        content_hash: 'ab'.repeat(32),
        provenance: { is_test_key: true },
      }),
    );
    expect(ev).toEqual({
      cryptoVerdict: { kind: 'verified' },
      registryState: 'Published',
      isTestKey: true,
    });
  });

  it('"rejected:<reason>" splits the inline reason off the verdict', () => {
    const ev = parseWasmVerdict(
      JSON.stringify({
        verdict: 'rejected:registry state not Published: Unknown',
        registry_state: 'Unknown',
        provenance: { is_test_key: true },
      }),
    );
    expect(ev.cryptoVerdict).toEqual({
      kind: 'rejected',
      reason: 'registry state not Published: Unknown',
    });
    expect(ev.registryState).toBe('Unknown');
  });

  it('a bare "rejected" (no reason) still parses to a rejected verdict', () => {
    const ev = parseWasmVerdict(
      JSON.stringify({ verdict: 'rejected', registry_state: 'Unknown', provenance: {} }),
    );
    expect(ev.cryptoVerdict.kind).toBe('rejected');
  });
});

describe('verifyWithWasm — injected verifier -> gate decision (no package import)', () => {
  it('a verified+Published result yields allowed', () => {
    const verify: ArtifactVerifyFn = vi.fn(() =>
      JSON.stringify({
        verdict: 'verified',
        registry_state: 'Published',
        provenance: { is_test_key: false },
      }),
    );
    const decision = verifyWithWasm(verify, {
      kew: new Uint8Array([1, 2, 3]),
      keydirJson: '{}',
      contextJson: '{}',
      policyJson: '{}',
      registryJson: '{}',
      exportedAtUnix: 1750000000n,
    });
    expect(decision).toEqual({ status: 'allowed', testKey: false });
    expect(verify).toHaveBeenCalledOnce();
  });

  it('a rejected result is blocked (fail-closed), carrying the inline reason', () => {
    const verify: ArtifactVerifyFn = () =>
      JSON.stringify({
        verdict: 'rejected:signature invalid',
        registry_state: 'Published',
        provenance: {},
      });
    const decision = verifyWithWasm(verify, {
      kew: new Uint8Array(),
      keydirJson: '{}',
      contextJson: '{}',
      policyJson: '{}',
      registryJson: '{}',
      exportedAtUnix: 0n,
    });
    expect(decision.status).toBe('blocked');
    if (decision.status === 'blocked') {
      expect(decision.reason).toBe('crypto_rejected');
      expect(decision.detail).toBe('signature invalid');
    }
  });
});
