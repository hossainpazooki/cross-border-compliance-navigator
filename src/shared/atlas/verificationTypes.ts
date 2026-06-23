// Typed contract for ATLAS artifact verification (ADR-0019 fail-closed gate).
// Pure type module — no runtime code.

// Mirrors ke_artifact::RegistryStatus (serde PascalCase) exactly.
export type RegistryStatus = 'Published' | 'Deprecated' | 'Revoked' | 'Unknown';

// Raw crypto verdict from the verifier (ke-wasm verify_artifact / ke serve /verify).
export type CryptoVerdict =
  | { kind: 'verified' }
  | { kind: 'rejected'; reason: string };

// What the fail-closed policy decides over. Assembled from a verifier result.
export interface VerificationEvidence {
  cryptoVerdict: CryptoVerdict;
  registryState: RegistryStatus;
  isTestKey: boolean;
}

export type GateBlockReason =
  | 'crypto_rejected' // signature/hash verify failed
  | 'not_published' // registry state is Deprecated/Revoked (crypto may be valid) -> still blocked
  | 'registry_unknown'; // registry unavailable / Unknown -> blocked (fail-closed)

// The COMPASS-side decision. 'unverified' is DISTINCT from 'blocked':
//   unverified = flag off, snapshot mode, no verification ATTEMPTED (today's honest stopgap)
//   blocked    = verification attempted under ADR-0019 and refused
//   allowed    = crypto verified AND registry state === 'Published'
export type GateDecision =
  | { status: 'allowed'; testKey: boolean }
  | { status: 'blocked'; reason: GateBlockReason; detail: string }
  | { status: 'unverified'; detail: string }
  | { status: 'verifying' };
