// ATLAS verification gateway (ADR-0019).
//
// Maps a verifier RESULT into a VerificationEvidence and routes it through the
// PURE policy (decideGate). The gateway is the only place that decides WHICH
// verifier to consult — driven entirely by env.ts `verifyMode()`:
//
//   'off'   -> SNAPSHOT_DECISION. No I/O. The honest stopgap (flag off): today's
//              snapshot-render, routed through the typed status as 'unverified'.
//   'serve' -> ke serve /verify over HTTP (architecture B). Maps verdict +
//              registry_state into VerificationEvidence, then decideGate.
//              RegistryUnavailableError (network/timeout/!ok) -> fail-closed
//              'registry_unknown' (we never invent a verdict).
//   'wasm'  -> the honest blocked seam. @platform/atlas-artifact is NOT published
//              and has no browser build, so in-browser verification is not wired.
//              This branch imports NOTHING and returns a fail-closed block. Do not
//              fake a verified result here.
//
// This module performs no cryptographic verification itself; it only translates a
// verifier's verdict into our ADR-0019 gate decision.
import { verifyMode, ATLAS_REGISTRY_URL } from '@shared/config/env';
import { decideGate, SNAPSHOT_DECISION } from './verificationPolicy';
import { serveVerify, RegistryUnavailableError, ArtifactNotFoundError } from './registryClient';
import type { GateDecision, VerificationEvidence } from './verificationTypes';

export interface VerifyArtifactGateInput {
  /** Artifact content hash to verify (null/empty for an unsigned artifact). */
  hash: string | null;
  /** Whether the signing key is a fixed-seed TEST key (flows into an allowed decision). */
  isTestKey: boolean;
}

/**
 * Route an artifact through the ADR-0019 verification gate.
 *
 * The returned decision is the COMPASS-side verdict; see GateDecision for the
 * distinction between 'unverified' (snapshot mode, nothing attempted) and
 * 'blocked' (attempted under ADR-0019 and refused).
 */
export async function verifyArtifactGate(
  input: VerifyArtifactGateInput,
): Promise<GateDecision> {
  const mode = verifyMode();

  // Snapshot mode: no verification attempted. No I/O, no registry client call.
  if (mode === 'off') {
    return SNAPSHOT_DECISION;
  }

  // In-browser WASM seam — intentionally unwired. Import nothing; fail closed.
  if (mode === 'wasm') {
    return {
      status: 'blocked',
      reason: 'registry_unknown',
      detail:
        'In-browser WASM verification pending @platform/atlas-artifact publish (Gate-5 rewire).',
    };
  }

  // mode === 'serve' — consult ke serve /verify.
  const hash = input.hash?.trim();
  if (!hash) {
    return {
      status: 'blocked',
      reason: 'crypto_rejected',
      detail: 'No artifact hash to verify.',
    };
  }

  // ATLAS_REGISTRY_URL is present whenever verifyMode() resolved to 'serve' (a
  // missing URL resolves to 'wasm' instead, handled above). The build-time assert
  // in next.config.mjs fails the build on the misconfig; this is the runtime
  // fail-closed backstop if that is ever bypassed.
  if (!ATLAS_REGISTRY_URL) {
    return {
      status: 'blocked',
      reason: 'registry_unknown',
      detail: 'Registry URL is not configured — fail-closed (ADR-0019).',
    };
  }

  try {
    const res = await serveVerify(ATLAS_REGISTRY_URL, hash);
    const evidence: VerificationEvidence = {
      cryptoVerdict:
        res.verdict === 'verified'
          ? { kind: 'verified' }
          : { kind: 'rejected', reason: res.rejection ?? 'rejected' },
      registryState: res.registry_state,
      isTestKey: input.isTestKey,
    };
    return decideGate(evidence);
  } catch (err) {
    // 404 first: the registry answered, the hash just is not registered. Surface
    // the specific reason rather than collapsing it into 'registry unavailable'.
    if (err instanceof ArtifactNotFoundError) {
      return {
        status: 'blocked',
        reason: 'not_found',
        detail: 'Artifact hash is not registered in the registry — blocked (ADR-0019).',
      };
    }
    if (err instanceof RegistryUnavailableError) {
      return {
        status: 'blocked',
        reason: 'registry_unknown',
        detail: 'Registry unavailable — fail-closed (ADR-0019).',
      };
    }
    throw err;
  }
}
