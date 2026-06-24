// Server-side forwarder behind the same-origin `/atlas/verify` route handler.
//
// WHY: `ke serve` sends no CORS headers, so a browser cannot call it cross-origin.
// COMPASS therefore exposes a same-origin proxy: the browser POSTs `/atlas/verify`
// (no CORS), and this forwarder relays the request to the real `ke serve` origin
// server-side and returns the response verbatim. It adds NO verification logic —
// the verdict still comes from `ke serve` (canonical registry, G5-1); this only
// moves the network hop to the server. Mirrors the BACKEND_ORIGIN proxy pattern.
//
// fetch is injected so the forwarding + fail modes are unit-testable.

export interface ProxyResult {
  status: number;
  body: unknown;
}

type FetchImpl = typeof fetch;

const FORWARD_TIMEOUT_MS = 5000;

/**
 * Forward a `/verify` request body to `<registryOrigin>/verify` and relay the
 * upstream status + JSON. Fails closed with a typed body the client maps to a
 * blocked decision:
 *   - no origin configured -> 500 registry_not_configured (no fetch)
 *   - upstream unreachable / timeout -> 502 registry_unreachable
 * Any upstream status (200 incl. rejected verdicts, 404, …) is relayed verbatim.
 */
export async function proxyVerify(
  registryOrigin: string | undefined,
  requestBody: unknown,
  deps?: { fetchImpl?: FetchImpl },
): Promise<ProxyResult> {
  if (!registryOrigin) {
    return {
      status: 500,
      body: {
        error: 'registry_not_configured',
        detail: 'ATLAS registry origin is not set (NEXT_PUBLIC_ATLAS_REGISTRY_URL).',
      },
    };
  }

  const fetchImpl = deps?.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FORWARD_TIMEOUT_MS);

  try {
    const res = await fetchImpl(`${registryOrigin.replace(/\/+$/, '')}/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = { error: 'bad_upstream_body' };
    }
    return { status: res.status, body };
  } catch (cause) {
    return {
      status: 502,
      body: {
        error: 'registry_unreachable',
        detail: `Could not reach the ATLAS registry: ${(cause as Error)?.message ?? 'unknown'}`,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}
