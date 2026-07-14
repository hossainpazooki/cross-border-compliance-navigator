import { NextResponse } from 'next/server';
import { GateUnavailableError, HttpTreasuryGateClient } from '@features/treasury-settlement/gateClient';
import { reconcileOnce } from '@features/treasury-settlement/reconcile';
import { FileSettlementLedger, ledgerPath } from '@features/treasury-settlement/settlementLedger';

// GET /treasury/reconcile — the settlement consumer's poll (Stage C(b)),
// intended as the Vercel Cron target (vercel.json `crons`). Pulls the gate's
// durable /v2/events feed by the ledger's cursor and recomputes settlements
// from OBSERVED ACHIEVED records; at-most-once via the keyed ledger. A gate
// outage returns 503 with the cursor untouched — delay, never loss/invention.
//
// Ledger durability honesty: FileSettlementLedger is local-durable (survives a
// process restart on a persistent disk). On Vercel, instance storage is
// ephemeral — the KV/Postgres adapter is PLANNED and required before this
// cron can claim the durability invariant in production.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const gateUrl = process.env.TREASURY_GATE_URL;
  if (!gateUrl) {
    return NextResponse.json(
      { error: 'TREASURY_GATE_URL is not configured; the settlement consumer is disabled' },
      { status: 503 },
    );
  }

  const ledger = new FileSettlementLedger(ledgerPath());
  try {
    const summary = await reconcileOnce(new HttpTreasuryGateClient(gateUrl), ledger);
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof GateUnavailableError) {
      return NextResponse.json(
        { error: error.message, cursorUnchanged: true },
        { status: 503 },
      );
    }
    throw error;
  }
}
