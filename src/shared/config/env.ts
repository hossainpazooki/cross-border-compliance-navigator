/**
 * Runtime environment configuration — single, framework-agnostic read site.
 *
 * Under Next (webpack/turbopack) `import.meta.env` is a runtime TypeError, not
 * `undefined`. Next inlines env vars by EXACT static-text match of
 * `process.env.NEXT_PUBLIC_*` — so this file must contain ZERO `import.meta`
 * text and only full static member expressions (no dynamic indexing, no
 * destructuring of `process.env`). An eslint `no-restricted-syntax` rule bans
 * `import.meta` repo-wide so this cannot regress.
 *
 * All five former `import.meta.env.VITE_*` read sites now import from here.
 */

/** REST origin for /v2/intents, /audit/{id}, /health, etc. */
export const API_BASE_URL: string =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8787';

/**
 * Live-session WebSocket base. Unset => the stream falls back to SSE/HTTP
 * transport (no WS). When set, the hook appends `/v2/ws/trade/{intent_id}`.
 */
export const WS_BASE_URL: string | undefined =
  process.env.NEXT_PUBLIC_WS_BASE_URL || undefined;

/**
 * Explicit transport override ('ws' | 'sse'). When unset the transport is
 * inferred: WS_BASE_URL present => WebSocket, otherwise SSE.
 */
export const STREAM_TRANSPORT: string | undefined =
  process.env.NEXT_PUBLIC_STREAM_TRANSPORT || undefined;
