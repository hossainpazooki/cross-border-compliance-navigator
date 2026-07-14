// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  GOLDEN_PAYMENT_CONFIG,
  TREASURY_PAYMENTS_REGIME,
  buildDeclaration,
  declareTreasuryPayment,
  idempotencyKeyFor,
  resolveIntentSpecHash,
} from '../decisionAgent';
import type { TreasuryGateClient } from '../gateClient';

const INPUT = { payer_id: 'payer-1', payment_reference: 'ref-001' };

describe('decision agent', () => {
  it('derives the idempotency key from the golden key_fields in declared order', () => {
    expect(idempotencyKeyFor(INPUT)).toBe('payer-1|ref-001');
  });

  it('resolves the pinned signed IntentSpec hash from the tripwired snapshot', () => {
    // The snapshot pin for intentspec_payment (regime treasury_payments_v1) —
    // the same hash snapshotContract.PINNED_ARTIFACTS enforces.
    const hash = resolveIntentSpecHash(TREASURY_PAYMENTS_REGIME);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses to declare when no pinned signed IntentSpec exists for the regime (fail-closed)', () => {
    expect(() => resolveIntentSpecHash('no_such_regime')).toThrow(/refusing to declare/);
  });

  it('builds a deterministic declaration bound to the spec hash', () => {
    const hash = 'ab'.repeat(32);
    const first = buildDeclaration(INPUT, hash);
    const second = buildDeclaration(INPUT, hash);
    expect(first).toEqual(second); // replay re-derives the identical declaration
    expect(first.episode_seed).toBe('treasury:payer-1|ref-001');
    expect(first.idempotency_key).toBe('payer-1|ref-001');
    expect(first.intent_spec_hash).toBe(hash);
    expect(first.spec.idempotency_scope).toBe('treasury.payment.outbound');
    expect(first.spec.criteria).toEqual(GOLDEN_PAYMENT_CONFIG.criteria);
  });

  it('declares through the gate client and relays the response as observation only', async () => {
    const response = { terminal: 'ACHIEVED', reason: '', trajectory_hash: 'x', achieved_seq: 9 };
    const gate: TreasuryGateClient = {
      declare: vi.fn(async () => response),
      events: vi.fn(),
    };
    const outcome = await declareTreasuryPayment(INPUT, gate);
    expect(gate.declare).toHaveBeenCalledWith(outcome.declared);
    expect(outcome.response).toBe(response);
    // The agent exposes no dispatch/settlement surface: the only gate calls it
    // can make are declare/events, and it made exactly one declare.
    expect(gate.events).not.toHaveBeenCalled();
  });
});
