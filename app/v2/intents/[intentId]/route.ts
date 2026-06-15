import { NextResponse } from 'next/server';
import { decodeIntentId } from '@platform/reference-backend/intent-codec';

// GET /v2/intents/:intentId — stateless reconstruction. The id IS the record
// (codec-encoded), so we decode it back into an IntentRecord. A garbage / legacy
// / tampered id decodes to `undefined` (fail-soft, never a throw) => 404, exactly
// as the express handler 404s on an unknown id.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ intentId: string }> }
) {
  const { intentId } = await params;
  const decoded = decodeIntentId(intentId);
  if (!decoded) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  return NextResponse.json({ ...decoded, intent_id: intentId });
}
