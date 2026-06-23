import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  RegistryUnavailableError,
  serveHealth,
  serveVerify,
  type ServeVerifyResponse,
} from '../registryClient';

// These tests exercise OUR transport/parsing glue against a MOCKED fetch. No
// artifact is cryptographically verified here: the `verdict` / `registry_state`
// fields in the mocked bodies are SYNTHETIC fixtures whose only job is to prove
// our client transports a `ke serve` response faithfully and fails closed on
// transport errors.

const BASE = 'http://localhost:9999';

function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }): Response {
  const ok = init?.ok ?? true;
  return {
    ok,
    status: init?.status ?? (ok ? 200 : 500),
    json: async () => body,
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('serveVerify — transports a ke serve /verify response (no real verification)', () => {
  it('maps a verify response: POSTs JSON { hash } to <base>/verify and parses verified+Published', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        verdict: 'verified',
        registry_state: 'Published',
        provenance: { foo: 'bar' },
      } satisfies ServeVerifyResponse),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await serveVerify(BASE, 'a'.repeat(64));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost:9999/verify');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body as string)).toEqual({ hash: 'a'.repeat(64) });

    expect(result.verdict).toBe('verified');
    expect(result.registry_state).toBe('Published');
    expect(result.provenance).toEqual({ foo: 'bar' });
  });

  it('parses a rejected verdict through, preserving the rejection reason and registry state', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        verdict: 'rejected',
        rejection: 'signature mismatch',
        registry_state: 'Revoked',
        provenance: null,
      } satisfies ServeVerifyResponse),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await serveVerify(BASE, 'b'.repeat(64));

    expect(result.verdict).toBe('rejected');
    expect(result.rejection).toBe('signature mismatch');
    expect(result.registry_state).toBe('Revoked');
  });

  it('includes env and policy in the POST body when provided', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ verdict: 'verified', registry_state: 'Published', provenance: null }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await serveVerify(BASE, 'c'.repeat(64), { env: 'prod', policy: 'strict' });

    const [, opts] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(opts.body as string)).toEqual({
      hash: 'c'.repeat(64),
      env: 'prod',
      policy: 'strict',
    });
  });

  it('throws RegistryUnavailableError on a non-2xx response (never invents a verdict)', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, { ok: false, status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(serveVerify(BASE, 'd'.repeat(64))).rejects.toBeInstanceOf(
      RegistryUnavailableError,
    );
  });

  it('throws RegistryUnavailableError when the fetch rejects (network error)', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('network down');
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(serveVerify(BASE, 'e'.repeat(64))).rejects.toBeInstanceOf(
      RegistryUnavailableError,
    );
  });

  it('throws RegistryUnavailableError when the request times out', async () => {
    // fetch never resolves on its own; it only settles when the abort signal fires.
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (signal) {
            signal.addEventListener('abort', () => {
              reject(new DOMException('aborted', 'AbortError'));
            });
          }
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(serveVerify(BASE, 'f'.repeat(64), { timeoutMs: 10 })).rejects.toBeInstanceOf(
      RegistryUnavailableError,
    );
  });
});

describe('serveHealth — best-effort liveness probe', () => {
  it('returns true on { ok: true }', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true, surface: 'ke-serve' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(serveHealth(BASE)).resolves.toBe(true);
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe('http://localhost:9999/healthz');
  });

  it('returns false on { ok: false }', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: false, surface: 'ke-serve' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(serveHealth(BASE)).resolves.toBe(false);
  });

  it('returns false when the fetch throws (no throw escapes)', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('connection refused');
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(serveHealth(BASE)).resolves.toBe(false);
  });

  it('returns false on a non-2xx response', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }, { ok: false, status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(serveHealth(BASE)).resolves.toBe(false);
  });
});
