import { NextResponse } from 'next/server';
import { proxyVerify } from '@shared/atlas/verifyProxy';

// Same-origin verify proxy. The browser POSTs here (no CORS); the server forwards
// to the real `ke serve` origin and relays the response. The registry origin is a
// server-read of NEXT_PUBLIC_ATLAS_REGISTRY_URL (also available server-side). When
// BACKEND_ORIGIN-style proxying is preferred, a next.config rewrite can override
// this handler (beforeFiles), exactly as the /v2 surfaces do.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'bad_request', detail: 'invalid JSON body' }, { status: 400 });
  }

  const { status, body: payload } = await proxyVerify(
    process.env.NEXT_PUBLIC_ATLAS_REGISTRY_URL,
    body,
  );
  return NextResponse.json(payload, { status });
}
