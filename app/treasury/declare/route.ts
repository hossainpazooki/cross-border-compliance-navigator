import { NextResponse } from 'next/server';
import { declareTreasuryPayment } from '@features/treasury-settlement/decisionAgent';
import { GateUnavailableError, HttpTreasuryGateClient } from '@features/treasury-settlement/gateClient';

// POST /treasury/declare — the decision agent's HTTP face (Stage C(b)). It
// declares an intent to the Go authorization gate and relays the gate's
// synchronous answer AS AN OBSERVATION: settlement authority is the durable
// feed via /treasury/reconcile, never this response. The agent holds no
// dispatch handle. Unconfigured (no TREASURY_GATE_URL) => 503, fail-closed and
// visible — never a silent demo success.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const gateUrl = process.env.TREASURY_GATE_URL;
  if (!gateUrl) {
    return NextResponse.json(
      { error: 'TREASURY_GATE_URL is not configured; the decision agent is disabled' },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = undefined;
  }
  const input = body as { payer_id?: unknown; payment_reference?: unknown } | undefined;
  if (
    input === undefined ||
    typeof input.payer_id !== 'string' ||
    input.payer_id.length === 0 ||
    typeof input.payment_reference !== 'string' ||
    input.payment_reference.length === 0
  ) {
    return NextResponse.json(
      { error: 'payer_id and payment_reference are required non-empty strings' },
      { status: 422 },
    );
  }

  try {
    const outcome = await declareTreasuryPayment(
      { payer_id: input.payer_id, payment_reference: input.payment_reference },
      new HttpTreasuryGateClient(gateUrl),
    );
    return NextResponse.json(outcome, { status: 201 });
  } catch (error) {
    if (error instanceof GateUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    // e.g. no pinned signed IntentSpec: refusing to declare is the contract.
    return NextResponse.json({ error: String(error) }, { status: 409 });
  }
}
