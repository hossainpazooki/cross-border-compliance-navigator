// ke serve registry client — targets the REAL `ke serve` HTTP surface
// (confirmed from crates/ke-cli/src/serve/{router,dto,handlers}.rs).
//
//   GET  /healthz                         -> { ok: boolean, surface: string }
//   GET  /resolve?hash=<64hex>            -> ResolutionRecord (opaque; not load-bearing here)
//   POST /verify  { hash, env?, policy? } -> 200 even on rejection:
//        { verdict:'verified'|'rejected'; rejection?: string; registry_state: RegistryStatus; provenance: unknown }
//
// HONESTY BOUNDARY: this client only TRANSPORTS a verdict produced by `ke serve`.
// On any transport failure (fetch rejection, non-2xx, timeout) it throws
// RegistryUnavailableError — it NEVER invents a verdict. The caller maps that to
// a fail-closed 'registry_unknown' (ADR-0019).

import type { RegistryStatus } from './verificationTypes';

export interface ServeVerifyResponse {
  verdict: 'verified' | 'rejected';
  rejection?: string;
  registry_state: RegistryStatus;
  provenance: unknown;
}

/** Thrown on network/timeout/!ok. Caller maps to a fail-closed 'Unknown' registry state. */
export class RegistryUnavailableError extends Error {
  // `cause` is captured explicitly rather than via the ES2022 Error(message, { cause })
  // overload, because the project's lib target is ES2020 (no ErrorOptions).
  readonly cause?: unknown;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'RegistryUnavailableError';
    this.cause = options?.cause;
  }
}

const DEFAULT_TIMEOUT_MS = 5000;

function joinUrl(baseUrl: string, path: string): string {
  return baseUrl.replace(/\/+$/, '') + path;
}

/**
 * GET <base>/healthz. Resolves true on `{ ok: true }`, false on any other
 * outcome (non-ok body, non-2xx, network error, timeout). Never throws.
 */
export async function serveHealth(baseUrl: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(joinUrl(baseUrl, '/healthz'), { method: 'GET', signal });
    if (!res.ok) return false;
    const body = (await res.json()) as { ok?: unknown };
    return body?.ok === true;
  } catch {
    return false;
  }
}

/**
 * POST <base>/verify with JSON `{ hash, env?, policy? }`. `ke serve` returns 200
 * even when the verdict is 'rejected', so a 2xx body is parsed through as-is
 * (rejection reason preserved). Any transport failure throws
 * RegistryUnavailableError — no verdict is fabricated.
 */
export async function serveVerify(
  baseUrl: string,
  hash: string,
  opts?: {
    env?: string;
    policy?: 'strict' | 'permissive';
    signal?: AbortSignal;
    timeoutMs?: number;
  },
): Promise<ServeVerifyResponse> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Chain a caller-supplied signal into our timeout controller.
  if (opts?.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const body: { hash: string; env?: string; policy?: 'strict' | 'permissive' } = { hash };
  if (opts?.env !== undefined) body.env = opts.env;
  if (opts?.policy !== undefined) body.policy = opts.policy;

  let res: Response;
  try {
    res = await fetch(joinUrl(baseUrl, '/verify'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (cause) {
    throw new RegistryUnavailableError(
      'ke serve /verify request failed (network error or timeout).',
      { cause },
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new RegistryUnavailableError(
      `ke serve /verify returned non-2xx status ${res.status}.`,
    );
  }

  try {
    return (await res.json()) as ServeVerifyResponse;
  } catch (cause) {
    throw new RegistryUnavailableError(
      'ke serve /verify returned an unparseable body.',
      { cause },
    );
  }
}
