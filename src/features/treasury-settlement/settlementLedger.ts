/**
 * The durable keyed settlement ledger (Stage C(b)).
 *
 * At-most-once by construction: settlements are keyed by the intent's declared
 * `idempotency_key`, first-wins. A same-key record with identical content is a
 * duplicate (safe rerun/replay — `applied: false, conflict: false`); a
 * same-key record with DIFFERENT content is a conflict — it is never
 * overwritten and is surfaced to the operator (`conflict: true`).
 *
 * Implementations:
 * - `MemorySettlementLedger` — the unit-test double; loses everything on cold
 *   start BY DEFINITION (the exact failure mode the durable ledger exists to
 *   prevent — never deploy it).
 * - `FileSettlementLedger` — local-durable JSON file (atomic tmp+rename
 *   writes; reloads on construct, so a process restart resumes from disk).
 *   This is the reference/loop-probe ledger.
 * - A Vercel KV / Postgres adapter is PLANNED, not built — on Vercel the file
 *   ledger lands on ephemeral instance storage and does NOT satisfy the
 *   durability invariant across cold starts. Do not present it as production.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import type { SettlementRecord } from './types';

/** Where the file ledger lives (route handlers and the probe share this).
 * Next.js route files may only export handlers/config, so it lives here. */
export function ledgerPath(): string {
  return process.env.TREASURY_LEDGER_FILE ?? '.treasury/ledger.json';
}

export interface AppliedResult {
  applied: boolean;
  conflict: boolean;
}

export interface SettlementLedger {
  recordSettlement(record: SettlementRecord): Promise<AppliedResult>;
  settlements(): Promise<SettlementRecord[]>;
  getCursor(): Promise<number>;
  /** Monotonic: a lower seq than the stored cursor is ignored, never a rewind. */
  advanceCursor(seq: number): Promise<void>;
}

function sameSettlement(a: SettlementRecord, b: SettlementRecord): boolean {
  return (
    a.intent_id === b.intent_id &&
    a.seq === b.seq &&
    a.trajectory_hash === b.trajectory_hash &&
    a.intent_spec_hash === b.intent_spec_hash &&
    a.rule_artifact_hash === b.rule_artifact_hash
  );
}

export class MemorySettlementLedger implements SettlementLedger {
  protected byKey = new Map<string, SettlementRecord>();
  protected cursor = 0;

  async recordSettlement(record: SettlementRecord): Promise<AppliedResult> {
    const existing = this.byKey.get(record.idempotency_key);
    if (existing !== undefined) {
      return { applied: false, conflict: !sameSettlement(existing, record) };
    }
    this.byKey.set(record.idempotency_key, record);
    await this.persist();
    return { applied: true, conflict: false };
  }

  async settlements(): Promise<SettlementRecord[]> {
    return [...this.byKey.values()];
  }

  async getCursor(): Promise<number> {
    return this.cursor;
  }

  async advanceCursor(seq: number): Promise<void> {
    if (seq <= this.cursor) {
      return;
    }
    this.cursor = seq;
    await this.persist();
  }

  protected async persist(): Promise<void> {
    // Memory ledger: nothing to persist.
  }
}

interface LedgerFileShape {
  cursor: number;
  settlements: SettlementRecord[];
}

export class FileSettlementLedger extends MemorySettlementLedger {
  private readonly path: string;

  constructor(path: string) {
    super();
    this.path = path;
    this.load();
  }

  private load(): void {
    let raw: string;
    try {
      raw = readFileSync(this.path, 'utf-8');
    } catch {
      return; // No file yet: an empty ledger at cursor 0.
    }
    // A present-but-unreadable ledger must fail loud, not silently restart at
    // zero (which would re-apply history against an empty dedup set).
    const parsed = JSON.parse(raw) as LedgerFileShape;
    if (typeof parsed.cursor !== 'number' || !Array.isArray(parsed.settlements)) {
      throw new Error(`settlement ledger at ${this.path} is malformed`);
    }
    this.cursor = parsed.cursor;
    this.byKey = new Map(parsed.settlements.map((s) => [s.idempotency_key, s]));
  }

  protected override async persist(): Promise<void> {
    const shape: LedgerFileShape = {
      cursor: this.cursor,
      settlements: [...this.byKey.values()],
    };
    mkdirSync(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, JSON.stringify(shape, null, 1), 'utf-8');
    renameSync(tmp, this.path);
  }
}
