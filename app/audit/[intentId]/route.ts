import { NextResponse } from 'next/server';
import { streamScenario } from '@platform/reference-backend/stream';
import { DEFAULT_SCENARIO, listScenarios } from '@platform/reference-backend/fixtures';

// GET /audit/:intentId — envelope replay for sequence-gap recovery. Returns the
// SAME envelope array the express `/audit` returns and the SAME sequence the SSE
// route streams: both walk `streamScenario`, the single source of replay order.
// We drain the generator at max speed (no inter-frame waits matter for a JSON
// collect) so the body equals the streamed sequence frame-for-frame. The
// `intentId` is informational here (the express handler ignores it too — the
// scenario, not the id, selects the fixture).
export async function GET(
  request: Request,
  _ctx: { params: Promise<{ intentId: string }> }
) {
  const url = new URL(request.url);
  const scenario = url.searchParams.get('scenario') ?? DEFAULT_SCENARIO;

  if (!listScenarios().includes(scenario)) {
    return NextResponse.json(
      { error: `fixture ${scenario}: unknown scenario` },
      { status: 500 }
    );
  }

  try {
    const envelopes = [];
    // speed is large so the collect does not spend real time on frame delays;
    // fromSeq=0 yields the full sequence. The generator is finite, so it ends.
    for await (const { envelope } of streamScenario({ scenario, speed: 1e6 })) {
      envelopes.push(envelope);
    }
    return NextResponse.json(envelopes);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
