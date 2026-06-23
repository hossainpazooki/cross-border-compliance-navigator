// PURE. No I/O, no clock, no verifier, no env. This is the ADR-0019 enforcement core.
import type { VerificationEvidence, GateDecision } from './verificationTypes';

export function decideGate(evidence: VerificationEvidence): GateDecision {
  if (evidence.cryptoVerdict.kind === 'rejected')
    return { status: 'blocked', reason: 'crypto_rejected', detail: evidence.cryptoVerdict.reason };
  // crypto verified beyond this point:
  if (evidence.registryState === 'Unknown')
    return {
      status: 'blocked',
      reason: 'registry_unknown',
      detail: 'Registry unavailable or state unknown — fail-closed (ADR-0019).',
    };
  if (evidence.registryState !== 'Published')
    return {
      status: 'blocked',
      reason: 'not_published',
      detail: 'Registry state is ' + evidence.registryState + ', not Published — fail-closed (ADR-0019).',
    };
  return { status: 'allowed', testKey: evidence.isTestKey };
}

// Snapshot-mode (flag off): no verification attempted. Honest stopgap state.
export const SNAPSHOT_DECISION: GateDecision = {
  status: 'unverified',
  detail:
    'Provenance surfaced from a static ATLAS snapshot — not verified. Live verification is disabled (NEXT_PUBLIC_USE_WASM_VERIFY is not "true").',
};
