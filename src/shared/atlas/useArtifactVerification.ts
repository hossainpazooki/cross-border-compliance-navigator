// React Query hook wrapping the ADR-0019 verification gateway.
//
// Honesty contract: when verification is OFF (the default), this hook returns
// SNAPSHOT_DECISION synchronously and fires NO query — nothing is attempted, so
// there is nothing to await. The 'unverified' status is the honest stopgap, not
// a pending or a failure. Only when a live verifier is configured (mode 'serve'
// or the as-yet-unwired 'wasm' seam) does a query run; while it is in flight the
// decision is { status: 'verifying' }.
import { useQuery } from '@tanstack/react-query';
import { verifyMode } from '@shared/config/env';
import { verifyArtifactGate } from './verificationGateway';
import { SNAPSHOT_DECISION } from './verificationPolicy';
import type { GateDecision } from './verificationTypes';

export interface UseArtifactVerificationArgs {
  /** Artifact content hash to verify (null/empty for an unsigned artifact). */
  hash: string | null;
  /** Whether the signing key is a fixed-seed TEST key. */
  isTestKey: boolean;
}

export interface UseArtifactVerificationResult {
  decision: GateDecision;
}

export function useArtifactVerification(
  args: UseArtifactVerificationArgs,
): UseArtifactVerificationResult {
  const { hash, isTestKey } = args;
  const mode = verifyMode();
  const enabled = mode !== 'off';

  const query = useQuery({
    queryKey: ['atlas-verify', hash, mode],
    queryFn: () => verifyArtifactGate({ hash, isTestKey }),
    enabled,
    // A gate decision is a stable verdict for a given (hash, mode); no refetch churn.
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Flag off: snapshot mode, no verification attempted. Synchronous, query disabled.
  if (!enabled) {
    return { decision: SNAPSHOT_DECISION };
  }

  // Live mode: surface the in-flight state until the gateway settles.
  const decision: GateDecision = query.data ?? { status: 'verifying' };
  return { decision };
}
