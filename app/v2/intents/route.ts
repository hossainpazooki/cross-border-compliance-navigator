import { NextResponse } from 'next/server';
import { makeIntentRecord } from '@platform/reference-backend/intent-codec';
import { validateIntentCreate } from '@platform/reference-backend/validate';

// POST /v2/intents — self-hosted twin of the express handler in `app.ts`. It
// runs the SHARED `validateIntentCreate` so the 400/422 responses are byte-for-
// byte identical, then mints the record via the SHARED codec (`makeIntentRecord`
// encodes the id from the payload, so a later stateless `GET /v2/stream/...`
// lambda can reconstruct the intent from the id alone). Imports ONLY the safe
// subpaths of @platform/reference-backend — never its root (express/ws).
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    // A non-JSON / empty body is the same as "no body" to the validator (400).
    body = undefined;
  }

  const result = validateIntentCreate(body);
  if (!result.ok) {
    return NextResponse.json(result.error.body, { status: result.error.status });
  }

  const record = makeIntentRecord(result.value);
  return NextResponse.json(record, { status: 201 });
}
