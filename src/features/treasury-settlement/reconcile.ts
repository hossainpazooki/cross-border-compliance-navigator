/**
 * The settlement consumer's one reconcile pass (Stage C(b)): PULL the gate's
 * durable feed by cursor and recompute settlements from OBSERVED ACHIEVED
 * records — the locked transport decision (pull/reconcile, never push).
 *
 * Invariants (violating these makes the loop wrong):
 * - Settle ONLY on an observed `ACHIEVED` record; its absence — for any
 *   reason — is denial. A declare response is never a settlement input.
 * - At-most-once: the ledger dedupes by `idempotency_key`; reruns and
 *   crash-replays apply nothing twice (idempotent restatement — running
 *   reconcile twice must leave the ledger byte-identical).
 * - Crash ordering: settlements are durably recorded BEFORE the cursor
 *   advances, so a crash between the two re-scans (and dedupes) rather than
 *   losing records.
 * - A gate outage throws before anything is written: cursor unchanged,
 *   nothing settled, the cron retries — delay, never loss or invention.
 */

import type { TreasuryGateClient } from './gateClient';
import type { SettlementLedger } from './settlementLedger';
import type { GateEventRecord, SettlementRecord } from './types';

export interface ReconcileSummary {
  scanned: number;
  achieved: number;
  applied: number;
  duplicates: number;
  /** Same-key-different-content records + malformed ACHIEVED records: never
   * applied, always surfaced. A non-zero count is an operator alarm. */
  conflicts: number;
  cursor: number;
}

function settlementFrom(event: GateEventRecord): SettlementRecord | undefined {
  if (!event.idempotency_key) {
    return undefined; // Malformed ACHIEVED: refuse it, surface as a conflict.
  }
  return {
    idempotency_key: event.idempotency_key,
    intent_id: event.intent_id,
    seq: event.seq,
    intent_spec_hash: event.intent_spec_hash,
    rule_artifact_hash: event.rule_artifact_hash,
    trajectory_hash: event.trajectory_hash,
  };
}

export async function reconcileOnce(
  gate: TreasuryGateClient,
  ledger: SettlementLedger,
): Promise<ReconcileSummary> {
  const since = await ledger.getCursor();
  const page = await gate.events(since); // Throws on outage: nothing written.

  const summary: ReconcileSummary = {
    scanned: page.events.length,
    achieved: 0,
    applied: 0,
    duplicates: 0,
    conflicts: 0,
    cursor: since,
  };

  for (const event of page.events) {
    if (event.type !== 'ACHIEVED') {
      continue;
    }
    summary.achieved += 1;
    const settlement = settlementFrom(event);
    if (settlement === undefined) {
      summary.conflicts += 1;
      continue;
    }
    const result = await ledger.recordSettlement(settlement);
    if (result.conflict) {
      summary.conflicts += 1;
    } else if (result.applied) {
      summary.applied += 1;
    } else {
      summary.duplicates += 1;
    }
  }

  await ledger.advanceCursor(page.next_since);
  summary.cursor = Math.max(since, page.next_since);
  return summary;
}
