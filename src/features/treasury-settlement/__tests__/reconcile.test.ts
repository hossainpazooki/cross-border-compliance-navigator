// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { GateUnavailableError, type TreasuryGateClient } from '../gateClient';
import { reconcileOnce } from '../reconcile';
import { MemorySettlementLedger } from '../settlementLedger';
import type { GateEventRecord, GateEventsPage } from '../types';

const ACHIEVED: GateEventRecord = {
  seq: 9,
  intent_seq: 8,
  intent_id: '45f5b0e20b0741a6',
  type: 'ACHIEVED',
  detail: '45f5b0e20b0741a6',
  idempotency_key: 'payer-1|ref-001',
  intent_spec_hash: 'c7a3'.repeat(16),
  trajectory_hash: '3e80'.repeat(16),
};

const FAILED: GateEventRecord = {
  seq: 7,
  intent_seq: 6,
  intent_id: 'other-intent',
  type: 'FAILED',
  detail: 'unevaluable:amount_under_ceiling',
};

function fakeGate(page: GateEventsPage): TreasuryGateClient {
  return {
    declare: vi.fn(async () => {
      throw new Error('the consumer never declares');
    }),
    events: vi.fn(async () => page),
  };
}

describe('reconcileOnce', () => {
  it('settles ONLY observed ACHIEVED records and advances the cursor after', async () => {
    const ledger = new MemorySettlementLedger();
    const summary = await reconcileOnce(
      fakeGate({ events: [FAILED, ACHIEVED], next_since: 14 }),
      ledger,
    );
    expect(summary).toEqual({
      scanned: 2,
      achieved: 1,
      applied: 1,
      duplicates: 0,
      conflicts: 0,
      cursor: 14,
    });
    expect(await ledger.settlements()).toHaveLength(1);
    expect(await ledger.getCursor()).toBe(14);
  });

  it('is an idempotent restatement: running twice leaves the ledger identical', async () => {
    const ledger = new MemorySettlementLedger();
    const gate = fakeGate({ events: [ACHIEVED], next_since: 14 });
    await reconcileOnce(gate, ledger);
    const before = JSON.stringify(await ledger.settlements());

    // Second pass over the SAME feed window (e.g. crash before cursor write,
    // or an overlapping poll): nothing may double-settle.
    const second = await reconcileOnce(
      fakeGate({ events: [ACHIEVED], next_since: 14 }),
      ledger,
    );
    expect(second.applied).toBe(0);
    expect(second.duplicates).toBe(1);
    expect(JSON.stringify(await ledger.settlements())).toBe(before);
  });

  it('a gate outage settles nothing and leaves the cursor untouched (fail-closed)', async () => {
    const ledger = new MemorySettlementLedger();
    await ledger.advanceCursor(5);
    const gate: TreasuryGateClient = {
      declare: vi.fn(),
      events: vi.fn(async () => {
        throw new GateUnavailableError('down');
      }),
    };
    await expect(reconcileOnce(gate, ledger)).rejects.toThrow(GateUnavailableError);
    expect(await ledger.getCursor()).toBe(5);
    expect(await ledger.settlements()).toEqual([]);
  });

  it('an ACHIEVED record without an idempotency key is refused and surfaced, never applied', async () => {
    const ledger = new MemorySettlementLedger();
    const malformed = { ...ACHIEVED, idempotency_key: undefined };
    const summary = await reconcileOnce(
      fakeGate({ events: [malformed], next_since: 9 }),
      ledger,
    );
    expect(summary.conflicts).toBe(1);
    expect(summary.applied).toBe(0);
    expect(await ledger.settlements()).toEqual([]);
  });

  it('polls from the stored cursor', async () => {
    const ledger = new MemorySettlementLedger();
    await ledger.advanceCursor(14);
    const gate = fakeGate({ events: [], next_since: 14 });
    await reconcileOnce(gate, ledger);
    expect(gate.events).toHaveBeenCalledWith(14);
  });
});
