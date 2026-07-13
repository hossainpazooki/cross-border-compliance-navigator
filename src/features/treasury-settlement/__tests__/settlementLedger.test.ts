// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  FileSettlementLedger,
  MemorySettlementLedger,
} from '../settlementLedger';
import type { SettlementRecord } from '../types';

function settlement(overrides: Partial<SettlementRecord> = {}): SettlementRecord {
  return {
    idempotency_key: 'payer-1|ref-001',
    intent_id: '45f5b0e20b0741a6',
    seq: 9,
    intent_spec_hash: 'c7a3'.repeat(16),
    trajectory_hash: '3e80'.repeat(16),
    ...overrides,
  };
}

describe('MemorySettlementLedger (the unit double)', () => {
  it('applies a first settlement and dedupes an identical rerun', async () => {
    const ledger = new MemorySettlementLedger();
    expect(await ledger.recordSettlement(settlement())).toEqual({
      applied: true,
      conflict: false,
    });
    // Identical content, same key: a safe replay, applied exactly once.
    expect(await ledger.recordSettlement(settlement())).toEqual({
      applied: false,
      conflict: false,
    });
    expect(await ledger.settlements()).toHaveLength(1);
  });

  it('flags a same-key different-content record as a conflict and never overwrites', async () => {
    const ledger = new MemorySettlementLedger();
    await ledger.recordSettlement(settlement());
    const result = await ledger.recordSettlement(
      settlement({ intent_id: 'another-intent', seq: 99 }),
    );
    expect(result).toEqual({ applied: false, conflict: true });
    const kept = (await ledger.settlements())[0];
    expect(kept.intent_id).toBe('45f5b0e20b0741a6'); // first-wins
  });

  it('keeps the cursor monotonic', async () => {
    const ledger = new MemorySettlementLedger();
    await ledger.advanceCursor(14);
    await ledger.advanceCursor(9); // never rewinds
    expect(await ledger.getCursor()).toBe(14);
  });
});

describe('FileSettlementLedger (local-durable)', () => {
  const dirs: string[] = [];
  const tempLedger = () => {
    const dir = mkdtempSync(join(tmpdir(), 'treasury-ledger-'));
    dirs.push(dir);
    return join(dir, 'ledger.json');
  };
  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('survives a cold start: a NEW instance over the same file resumes cursor and dedup set', async () => {
    const path = tempLedger();
    const first = new FileSettlementLedger(path);
    await first.recordSettlement(settlement());
    await first.advanceCursor(14);

    // "Cold start": a fresh process would construct a fresh instance.
    const second = new FileSettlementLedger(path);
    expect(await second.getCursor()).toBe(14);
    expect(await second.recordSettlement(settlement())).toEqual({
      applied: false,
      conflict: false, // deduped across the restart — at-most-once holds
    });
    expect(await second.settlements()).toHaveLength(1);
  });

  it('starts empty when no file exists yet', async () => {
    const ledger = new FileSettlementLedger(tempLedger());
    expect(await ledger.getCursor()).toBe(0);
    expect(await ledger.settlements()).toEqual([]);
  });
});
