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

/**
 * REST origin for /v2/intents, /audit/{id}, /health, etc. Defaults to SAME-ORIGIN
 * ('') so a deployed app (Vercel preview/prod) calls its own in-tree route handlers
 * with NO per-deploy config — and when BACKEND_ORIGIN is set, next.config rewrites
 * forward /v2 server-side, so the client still calls same-origin. `dev:web` and
 * `.env.local` set `http://localhost:8787` explicitly to hit the standalone
 * @platform/reference-backend; `dev:all` relies on that, not on this default.
 */
export const API_BASE_URL: string =
  process.env.NEXT_PUBLIC_API_BASE_URL || '';

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

/**
 * ATLAS live-verification rewire seam (post-Gate-5; dormant by default).
 *
 * When 'true', COMPASS attempts to verify ATLAS rule-artifact provenance under
 * ADR-0019 (fail-closed) instead of rendering the static snapshot as-is. The
 * feature is dormant until `@platform/atlas-artifact` ships — see
 * src/shared/atlas/verificationGateway.ts for the honest seam.
 */
export const USE_WASM_VERIFY: boolean =
  process.env.NEXT_PUBLIC_USE_WASM_VERIFY === 'true';

/**
 * Base URL of a reachable `ke-cli serve` registry surface. When set (with
 * USE_WASM_VERIFY=true) selects the 'serve' HTTP-verify path; unset selects the
 * (still-blocked) in-browser 'wasm' path.
 */
export const ATLAS_REGISTRY_URL: string | undefined =
  process.env.NEXT_PUBLIC_ATLAS_REGISTRY_URL || undefined;

/**
 * Resolves the verification mode (pure):
 *   - 'off'   — flag off; snapshot mode, no verification attempted (default).
 *   - 'serve' — flag on + registry URL set; verify via `ke serve /verify`.
 *   - 'wasm'  — flag on, no registry URL; in-browser path (currently blocked).
 */
export function verifyMode(): 'off' | 'serve' | 'wasm' {
  if (!USE_WASM_VERIFY) return 'off';
  if (ATLAS_REGISTRY_URL) return 'serve';
  return 'wasm';
}

/**
 * Guards verification configuration. The 'serve' path requires a registry URL
 * by construction (verifyMode resolves to 'serve' only when one is set), so the
 * only genuine misconfiguration to surface is the flag being on while the lone
 * available path is the still-blocked in-browser 'wasm' seam — callers may use
 * this to fail loud rather than silently land in the dormant branch.
 */
export function assertVerifyConfig(): void {
  if (USE_WASM_VERIFY && !ATLAS_REGISTRY_URL && verifyMode() === 'wasm') {
    throw new Error(
      'NEXT_PUBLIC_USE_WASM_VERIFY is "true" but NEXT_PUBLIC_ATLAS_REGISTRY_URL is unset — only the in-browser WASM path remains, which is blocked until @platform/atlas-artifact ships. Set NEXT_PUBLIC_ATLAS_REGISTRY_URL to use ke-cli serve.'
    );
  }
}
