import { afterEach, describe, expect, it, vi } from 'vitest';
import { proxyVerify } from '../verifyProxy';

// proxyVerify is the SERVER-side forwarder behind the same-origin /atlas/verify
// route handler: the browser POSTs same-origin (no CORS), the server forwards to
// the real `ke serve` origin and relays the response verbatim. These tests pin the
// forwarding + the two fail modes (no origin configured, registry unreachable)
// against an injected fetch.

afterEach(() => vi.restoreAllMocks());

const HASH = 'a'.repeat(64);

describe('proxyVerify — same-origin forwarder to ke serve /verify', () => {
  it('forwards POST to <origin>/verify and relays the upstream status + body', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ verdict: 'verified', registry_state: 'Published' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const out = await proxyVerify('http://127.0.0.1:9999', { hash: HASH }, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:9999/verify');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ hash: HASH });
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ verdict: 'verified', registry_state: 'Published' });
  });

  it('relays an upstream 404 (artifact not registered) verbatim', async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ error: 'not_found' }), { status: 404 }),
    );
    const out = await proxyVerify('http://r', { hash: HASH }, { fetchImpl });
    expect(out.status).toBe(404);
  });

  it('returns 500 registry_not_configured when no origin is set, without fetching', async () => {
    const fetchImpl = vi.fn();
    const out = await proxyVerify(undefined, { hash: HASH }, { fetchImpl });
    expect(out.status).toBe(500);
    expect((out.body as { error: string }).error).toBe('registry_not_configured');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns 502 registry_unreachable when the upstream fetch throws', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('connection refused');
    });
    const out = await proxyVerify('http://r', { hash: HASH }, { fetchImpl });
    expect(out.status).toBe(502);
    expect((out.body as { error: string }).error).toBe('registry_unreachable');
  });
});
