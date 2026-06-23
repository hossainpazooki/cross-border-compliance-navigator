// In-browser WASM verification adapter (@platform/atlas-artifact `verify_artifact`).
//
// DEPENDENCY-INJECTED on purpose: this module NEVER imports the wasm package. The
// `verify_artifact` function is passed IN. That keeps the bundle build-safe while
// the package is unpublished (a static/dynamic import of an absent specifier breaks
// `next build`), and it makes the marshalling unit-testable with a fake verifier.
// The real wiring (gateway 'wasm' mode -> import the package -> pass its
// verify_artifact here) is the one gated step, pending the package becoming a real
// dependency (publish or file: bridge).
//
// Authority boundary: WASM output is non-authoritative (verify/preview only). This
// adapter only TRANSLATES a verdict into the ADR-0019 gate decision; it computes no
// crypto/policy of its own (decideGate is the pure gate).
import { decideGate } from './verificationPolicy';
import type { GateDecision, RegistryStatus, VerificationEvidence } from './verificationTypes';

/** The exact signature of `@platform/atlas-artifact`'s `verify_artifact` export. */
export type ArtifactVerifyFn = (
  kew: Uint8Array,
  keydir_json: string,
  context_json: string,
  policy_json: string,
  registry_json: string,
  exported_at_unix: bigint,
) => string;

export interface WasmVerifyInputs {
  kew: Uint8Array;
  keydirJson: string;
  contextJson: string;
  policyJson: string;
  /** Live registry evidence (lifecycle state + event head) — obtained from `ke serve`. */
  registryJson: string;
  exportedAtUnix: bigint;
}

interface WasmVerifyResult {
  verdict: string; // "verified" | "rejected:<reason>"
  registry_state: RegistryStatus;
  provenance?: { is_test_key?: boolean };
}

/**
 * Parse the wasm `verify_artifact` JSON string into the evidence decideGate
 * consumes. The wasm verdict carries its rejection reason INLINE after a colon
 * ("rejected:<reason>") — unlike ke serve's separate {verdict, rejection}.
 */
export function parseWasmVerdict(json: string): VerificationEvidence {
  const result = JSON.parse(json) as WasmVerifyResult;
  const verdict = result.verdict ?? '';
  const cryptoVerdict =
    verdict === 'verified'
      ? ({ kind: 'verified' } as const)
      : ({ kind: 'rejected', reason: verdict.startsWith('rejected:') ? verdict.slice('rejected:'.length) : verdict } as const);
  return {
    cryptoVerdict,
    registryState: result.registry_state,
    isTestKey: result.provenance?.is_test_key === true,
  };
}

/**
 * Run the injected in-browser verifier over the supplied inputs and map the result
 * through the pure ADR-0019 gate. Returns a fail-closed blocked decision for any
 * non-verified / non-Published outcome.
 */
export function verifyWithWasm(verify: ArtifactVerifyFn, inputs: WasmVerifyInputs): GateDecision {
  const json = verify(
    inputs.kew,
    inputs.keydirJson,
    inputs.contextJson,
    inputs.policyJson,
    inputs.registryJson,
    inputs.exportedAtUnix,
  );
  return decideGate(parseWasmVerdict(json));
}
