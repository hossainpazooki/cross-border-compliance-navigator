import { NextResponse } from 'next/server';
import { FileSettlementLedger, ledgerPath } from '@features/treasury-settlement/settlementLedger';

// GET /treasury/settlements — read-only view of the settlement ledger (the
// verification surface for the loop probe and the desk). Reads the same file
// the reconcile cron writes; no gate access, so it works even mid-outage.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const ledger = new FileSettlementLedger(ledgerPath());
  return NextResponse.json({
    cursor: await ledger.getCursor(),
    settlements: await ledger.settlements(),
  });
}
