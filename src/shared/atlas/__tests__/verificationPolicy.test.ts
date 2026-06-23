import { describe, expect, it } from 'vitest';
import { decideGate, SNAPSHOT_DECISION } from '../verificationPolicy';
import type { VerificationEvidence } from '../verificationTypes';

// These tests exercise OUR ADR-0019 mapping/policy code (decideGate) over SYNTHETIC
// verifier inputs. No artifact is cryptographically verified here — the CryptoVerdict
// values are fabricated fixtures whose only job is to drive the policy branches.

const verified = { kind: 'verified' } as const;

function evidence(over: Partial<VerificationEvidence>): VerificationEvidence {
  return {
    cryptoVerdict: verified,
    registryState: 'Published',
    isTestKey: false,
    ...over,
  };
}

describe('decideGate — ADR-0019 fail-closed policy mapping', () => {
  it('maps verified + Published to allowed (testKey=false passes through)', () => {
    const decision = decideGate(evidence({ registryState: 'Published', isTestKey: false }));
    expect(decision).toEqual({ status: 'allowed', testKey: false });
  });

  it('maps verified + Published to allowed (testKey=true passes through)', () => {
    const decision = decideGate(evidence({ registryState: 'Published', isTestKey: true }));
    expect(decision).toEqual({ status: 'allowed', testKey: true });
  });

  it('maps verified + Revoked to blocked with reason not_published', () => {
    const decision = decideGate(evidence({ registryState: 'Revoked' }));
    expect(decision.status).toBe('blocked');
    if (decision.status === 'blocked') {
      expect(decision.reason).toBe('not_published');
      expect(decision.detail).toContain('Revoked');
    }
  });

  it('maps verified + Deprecated to blocked with reason not_published', () => {
    const decision = decideGate(evidence({ registryState: 'Deprecated' }));
    expect(decision.status).toBe('blocked');
    if (decision.status === 'blocked') {
      expect(decision.reason).toBe('not_published');
      expect(decision.detail).toContain('Deprecated');
    }
  });

  it('maps verified + Unknown to blocked with reason registry_unknown (fail-closed)', () => {
    const decision = decideGate(evidence({ registryState: 'Unknown' }));
    expect(decision.status).toBe('blocked');
    if (decision.status === 'blocked') {
      expect(decision.reason).toBe('registry_unknown');
      expect(decision.detail).toContain('ADR-0019');
    }
  });

  it('maps a rejected crypto verdict to blocked crypto_rejected, carrying the reason through', () => {
    const decision = decideGate(
      evidence({ cryptoVerdict: { kind: 'rejected', reason: 'signature mismatch' } }),
    );
    expect(decision.status).toBe('blocked');
    if (decision.status === 'blocked') {
      expect(decision.reason).toBe('crypto_rejected');
      expect(decision.detail).toBe('signature mismatch');
    }
  });

  it('treats crypto_rejected as terminal even when registry state would otherwise be Published', () => {
    const decision = decideGate(
      evidence({
        cryptoVerdict: { kind: 'rejected', reason: 'hash mismatch' },
        registryState: 'Published',
      }),
    );
    expect(decision.status).toBe('blocked');
    if (decision.status === 'blocked') {
      expect(decision.reason).toBe('crypto_rejected');
      expect(decision.detail).toBe('hash mismatch');
    }
  });
});

describe('SNAPSHOT_DECISION — snapshot mode (no verification attempted)', () => {
  it('is unverified, distinct from blocked', () => {
    expect(SNAPSHOT_DECISION.status).toBe('unverified');
  });

  it('names the disabled flag in its detail', () => {
    if (SNAPSHOT_DECISION.status === 'unverified') {
      expect(SNAPSHOT_DECISION.detail).toContain('NEXT_PUBLIC_USE_WASM_VERIFY');
    }
  });
});
