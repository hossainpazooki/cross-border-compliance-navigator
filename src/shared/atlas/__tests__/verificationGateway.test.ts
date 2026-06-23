import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServeVerifyResponse } from '../registryClient';
import type { RegistryStatus } from '../verificationTypes';

// These tests exercise OUR routing + mapping code (verifyArtifactGate) over MOCKED
// verifier inputs. No artifact is cryptographically verified here: the env module
// and the registry client are both mocked, so the ServeVerifyResponse values are
// fabricated fixtures whose only job is to drive the gateway's branches. The test
// names describe the MAPPING under test, never a real cryptographic verification.

// --- Mocks --------------------------------------------------------------------
// vi.mock factories are hoisted above all imports, so any value they close over
// must come through vi.hoisted (which is also hoisted). We keep mutable mode/url
// state and the serveVerify spy here, plus a REAL RegistryUnavailableError class
// so the gateway's `instanceof` check is exercised faithfully.
const h = vi.hoisted(() => {
  class RegistryUnavailableErrorMock extends Error {}
  return {
    state: { mode: 'off' as 'off' | 'serve' | 'wasm', url: 'https://registry.example' as string | undefined },
    serveVerifyMock: vi.fn<(...args: unknown[]) => Promise<ServeVerifyResponse>>(),
    RegistryUnavailableErrorMock,
  };
});

// env.ts is the single env read site; we stub verifyMode()/ATLAS_REGISTRY_URL so
// the gateway sees each mode.
vi.mock('@shared/config/env', () => ({
  verifyMode: () => h.state.mode,
  get ATLAS_REGISTRY_URL() {
    return h.state.url;
  },
  USE_WASM_VERIFY: false,
}));

// registryClient.ts: stub serveVerify and re-use the hoisted error class.
vi.mock('../registryClient', () => ({
  serveVerify: (...args: unknown[]) => h.serveVerifyMock(...args),
  RegistryUnavailableError: h.RegistryUnavailableErrorMock,
}));

const serveVerifyMock = h.serveVerifyMock;
const RegistryUnavailableErrorMock = h.RegistryUnavailableErrorMock;

// Import AFTER mocks are registered.
import { verifyArtifactGate } from '../verificationGateway';
import { SNAPSHOT_DECISION } from '../verificationPolicy';

function serveResponse(
  verdict: 'verified' | 'rejected',
  registry_state: RegistryStatus,
  rejection?: string,
): ServeVerifyResponse {
  return { verdict, registry_state, rejection, provenance: {} };
}

beforeEach(() => {
  h.state.mode = 'off';
  h.state.url = 'https://registry.example';
  serveVerifyMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('verifyArtifactGate — mode routing (mocked verifier)', () => {
  it("mode 'off' returns SNAPSHOT_DECISION and never calls the registry client", async () => {
    h.state.mode = 'off';
    const decision = await verifyArtifactGate({ hash: 'abc', isTestKey: false });
    expect(decision).toEqual(SNAPSHOT_DECISION);
    expect(serveVerifyMock).not.toHaveBeenCalled();
  });

  it("maps a mocked Published verify response to allowed (mode 'serve')", async () => {
    h.state.mode = 'serve';
    serveVerifyMock.mockResolvedValue(serveResponse('verified', 'Published'));
    const decision = await verifyArtifactGate({ hash: 'deadbeef', isTestKey: false });
    expect(decision).toEqual({ status: 'allowed', testKey: false });
    expect(serveVerifyMock).toHaveBeenCalledWith('https://registry.example', 'deadbeef');
  });

  it("carries isTestKey through into an allowed decision (mode 'serve')", async () => {
    h.state.mode = 'serve';
    serveVerifyMock.mockResolvedValue(serveResponse('verified', 'Published'));
    const decision = await verifyArtifactGate({ hash: 'deadbeef', isTestKey: true });
    expect(decision).toEqual({ status: 'allowed', testKey: true });
  });

  it("maps a mocked verified+Revoked response to blocked 'not_published' (mode 'serve')", async () => {
    h.state.mode = 'serve';
    serveVerifyMock.mockResolvedValue(serveResponse('verified', 'Revoked'));
    const decision = await verifyArtifactGate({ hash: 'deadbeef', isTestKey: false });
    expect(decision.status).toBe('blocked');
    if (decision.status === 'blocked') {
      expect(decision.reason).toBe('not_published');
      expect(decision.detail).toContain('Revoked');
    }
  });

  it("maps a mocked verified+Unknown response to blocked 'registry_unknown' (mode 'serve')", async () => {
    h.state.mode = 'serve';
    serveVerifyMock.mockResolvedValue(serveResponse('verified', 'Unknown'));
    const decision = await verifyArtifactGate({ hash: 'deadbeef', isTestKey: false });
    expect(decision.status).toBe('blocked');
    if (decision.status === 'blocked') {
      expect(decision.reason).toBe('registry_unknown');
    }
  });

  it("maps a mocked rejected response to blocked 'crypto_rejected', carrying the rejection reason (mode 'serve')", async () => {
    h.state.mode = 'serve';
    serveVerifyMock.mockResolvedValue(serveResponse('rejected', 'Published', 'signature mismatch'));
    const decision = await verifyArtifactGate({ hash: 'deadbeef', isTestKey: false });
    expect(decision.status).toBe('blocked');
    if (decision.status === 'blocked') {
      expect(decision.reason).toBe('crypto_rejected');
      expect(decision.detail).toBe('signature mismatch');
    }
  });

  it("defaults the crypto_rejected detail to 'rejected' when the response omits a rejection (mode 'serve')", async () => {
    h.state.mode = 'serve';
    serveVerifyMock.mockResolvedValue(serveResponse('rejected', 'Published'));
    const decision = await verifyArtifactGate({ hash: 'deadbeef', isTestKey: false });
    expect(decision.status).toBe('blocked');
    if (decision.status === 'blocked') {
      expect(decision.reason).toBe('crypto_rejected');
      expect(decision.detail).toBe('rejected');
    }
  });

  it("maps RegistryUnavailableError to blocked 'registry_unknown' (mode 'serve', fail-closed)", async () => {
    h.state.mode = 'serve';
    serveVerifyMock.mockRejectedValue(new RegistryUnavailableErrorMock('boom'));
    const decision = await verifyArtifactGate({ hash: 'deadbeef', isTestKey: false });
    expect(decision.status).toBe('blocked');
    if (decision.status === 'blocked') {
      expect(decision.reason).toBe('registry_unknown');
      expect(decision.detail).toContain('ADR-0019');
    }
  });

  it("blocks a null hash as crypto_rejected without calling the registry (mode 'serve')", async () => {
    h.state.mode = 'serve';
    const decision = await verifyArtifactGate({ hash: null, isTestKey: false });
    expect(decision.status).toBe('blocked');
    if (decision.status === 'blocked') {
      expect(decision.reason).toBe('crypto_rejected');
      expect(decision.detail).toBe('No artifact hash to verify.');
    }
    expect(serveVerifyMock).not.toHaveBeenCalled();
  });

  it("blocks an empty/whitespace hash as crypto_rejected (mode 'serve')", async () => {
    h.state.mode = 'serve';
    const decision = await verifyArtifactGate({ hash: '   ', isTestKey: false });
    expect(decision.status).toBe('blocked');
    if (decision.status === 'blocked') {
      expect(decision.reason).toBe('crypto_rejected');
    }
    expect(serveVerifyMock).not.toHaveBeenCalled();
  });

  it("mode 'wasm' returns the blocked 'registry_unknown' seam and never calls the registry", async () => {
    h.state.mode = 'wasm';
    const decision = await verifyArtifactGate({ hash: 'deadbeef', isTestKey: false });
    expect(decision.status).toBe('blocked');
    if (decision.status === 'blocked') {
      expect(decision.reason).toBe('registry_unknown');
      expect(decision.detail).toContain('@platform/atlas-artifact');
    }
    expect(serveVerifyMock).not.toHaveBeenCalled();
  });
});
