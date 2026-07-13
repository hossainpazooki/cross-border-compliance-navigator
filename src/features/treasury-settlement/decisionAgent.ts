/**
 * The treasury decision agent (Stage C(b)).
 *
 * It resolves the governing IntentSpec artifact hash from the pinned,
 * tripwire-guarded ATLAS snapshot, assembles the declaration evidence, and
 * declares the intent to the Go gate. THAT IS ALL IT CAN DO — the agent holds
 * no adapter and no dispatch handle, and the gate's synchronous answer is
 * returned as an observation only: settlement authority belongs to the
 * settlement consumer observing an ACHIEVED record in the durable feed
 * (`reconcile.ts`).
 *
 * The criteria/threshold set is app-level configuration bound to the pinned
 * spec hash — recorded parity debt: extracting them from the IntentSpec
 * payload itself is the ATLAS resolver-extraction slice (the artifact payload
 * is deliberately unreadable from COMPASS, which is verify-only).
 */

import { provenanceForRegime } from '@shared/atlas/provenance';

import type { TreasuryGateClient } from './gateClient';
import type { GateCriterion, GateDeclareRequest, GateDeclareResponse } from './types';

export const TREASURY_PAYMENTS_REGIME = 'treasury_payments_v1';

export interface TreasuryPaymentInput {
  payer_id: string;
  payment_reference: string;
}

export interface TreasuryCriteriaConfig {
  action_class: string;
  idempotency_scope: string;
  criteria: GateCriterion[];
}

/** App configuration mirroring the golden `intentspec_payment` IntentSpec
 * (regime `treasury_payments_v1`): amount ceiling stable, FX band volatile,
 * idempotency scope + key fields `payer_id|payment_reference` per its
 * `IdempotencyDef`. Parity with the artifact payload is asserted upstream
 * (ATLAS), not here. */
export const GOLDEN_PAYMENT_CONFIG: TreasuryCriteriaConfig = {
  action_class: 'payment',
  idempotency_scope: 'treasury.payment.outbound',
  criteria: [
    { name: 'amount_under_ceiling', threshold: 1_000_000, volatility: 'stable' },
    { name: 'fx_rate_within_band', threshold: 1.05, volatility: 'volatile' },
  ],
};

/** The declared idempotency key: the golden spec's `key_fields`
 * (`payer_id`, `payment_reference`) joined in declared order. */
export function idempotencyKeyFor(input: TreasuryPaymentInput): string {
  return `${input.payer_id}|${input.payment_reference}`;
}

/** Resolve the signed IntentSpec hash from the pinned snapshot — fail closed:
 * no pinned signed IntentSpec for the regime means NO declaration, never an
 * unpinned one. */
export function resolveIntentSpecHash(regimeId: string = TREASURY_PAYMENTS_REGIME): string {
  const spec = provenanceForRegime(regimeId).find(
    (artifact) => artifact.artifact_kind === 'IntentSpec' && artifact.signed,
  );
  if (!spec || !spec.artifact_hash_hex) {
    throw new Error(
      `no pinned signed IntentSpec artifact for regime "${regimeId}" — refusing to declare`,
    );
  }
  return spec.artifact_hash_hex;
}

/** Pure declaration assembly — deterministic for a given input, so a replayed
 * declaration re-derives the identical episode seed and idempotency key. */
export function buildDeclaration(
  input: TreasuryPaymentInput,
  intentSpecHash: string,
  config: TreasuryCriteriaConfig = GOLDEN_PAYMENT_CONFIG,
): GateDeclareRequest {
  const key = idempotencyKeyFor(input);
  return {
    episode_seed: `treasury:${key}`,
    idempotency_key: key,
    intent_spec_hash: intentSpecHash,
    spec: {
      action_class: config.action_class,
      idempotency_scope: config.idempotency_scope,
      criteria: config.criteria,
    },
  };
}

export interface DeclareOutcome {
  declared: GateDeclareRequest;
  /** Observation only — never a settlement input. */
  response: GateDeclareResponse;
}

export async function declareTreasuryPayment(
  input: TreasuryPaymentInput,
  gate: TreasuryGateClient,
  config: TreasuryCriteriaConfig = GOLDEN_PAYMENT_CONFIG,
): Promise<DeclareOutcome> {
  const declared = buildDeclaration(input, resolveIntentSpecHash(), config);
  const response = await gate.declare(declared);
  return { declared, response };
}
