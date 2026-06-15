import { NextResponse } from 'next/server';

// Liveness probe. Mirrors the express `GET /health` body so the same client
// health check passes against either backend.
export function GET() {
  return NextResponse.json({ status: 'ok' });
}
