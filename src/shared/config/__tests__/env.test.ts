import { afterEach, describe, expect, it, vi } from 'vitest';

// env.ts reads process.env at module load, so each case sets the vars, resets the
// module registry, and re-imports to observe a fresh evaluation. Locks the
// verifyMode() resolution + the assertVerifyConfig() invariant the gateway relies on.

const KEY_FLAG = 'NEXT_PUBLIC_USE_WASM_VERIFY';
const KEY_URL = 'NEXT_PUBLIC_ATLAS_REGISTRY_URL';

async function loadEnv(flag: string | undefined, url: string | undefined) {
  if (flag === undefined) delete process.env[KEY_FLAG];
  else process.env[KEY_FLAG] = flag;
  if (url === undefined) delete process.env[KEY_URL];
  else process.env[KEY_URL] = url;
  vi.resetModules();
  return import('../env');
}

afterEach(() => {
  delete process.env[KEY_FLAG];
  delete process.env[KEY_URL];
  vi.resetModules();
});

describe('verifyMode resolution', () => {
  it("flag off -> 'off' (default; snapshot mode)", async () => {
    const env = await loadEnv(undefined, undefined);
    expect(env.verifyMode()).toBe('off');
    expect(() => env.assertVerifyConfig()).not.toThrow();
  });

  it("flag on + registry URL set -> 'serve'", async () => {
    const env = await loadEnv('true', 'http://127.0.0.1:9999');
    expect(env.verifyMode()).toBe('serve');
    expect(() => env.assertVerifyConfig()).not.toThrow();
  });

  it("flag on + no registry URL -> 'wasm' (blocked seam) and assertVerifyConfig THROWS", async () => {
    const env = await loadEnv('true', undefined);
    expect(env.verifyMode()).toBe('wasm');
    expect(() => env.assertVerifyConfig()).toThrow(/NEXT_PUBLIC_ATLAS_REGISTRY_URL/);
  });
});
