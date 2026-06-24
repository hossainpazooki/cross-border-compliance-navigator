// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { verifyWithWasm, type ArtifactVerifyFn } from '../wasmVerifier';

// LIVE integration proof for the in-browser WASM path. Loads the REAL
// `@platform/atlas-artifact` verifier (the ATLAS pkg-node build) and the REAL
// golden `.kew` bytes + canonical contract-inputs, injects the real
// verify_artifact into our adapter, and asserts the gate decision. Nothing is
// mocked — this is the COMPASS-side WASM leg of the cross-language contract test
// (ke serve / Rust / Python / WASM all agree on the same .kew).
//
// Skipped unless the sibling ATLAS checkout is present (override with ATLAS_REPO).
// Mirrors scripts/contract-test.sh exactly: EXPORTED_AT=1750000000, the four
// scripts/contract-inputs/*.json, the nodejs-target pkg-node build.
const ATLAS = process.env.ATLAS_REPO || resolve(process.cwd(), '../regulatory-rule-engine');
const PKG_NODE = resolve(ATLAS, 'crates/ke-wasm/pkg-node/ke_wasm.js');
const INPUTS = resolve(ATLAS, 'scripts/contract-inputs');
const EXPORTED_AT = 1750000000n;

const present =
  existsSync(PKG_NODE) &&
  ['keydir', 'context', 'policy', 'registry'].every((n) => existsSync(resolve(INPUTS, `${n}.json`)));

function inputsFor(kewPath: string) {
  return {
    kew: new Uint8Array(readFileSync(kewPath)),
    keydirJson: readFileSync(resolve(INPUTS, 'keydir.json'), 'utf8'),
    contextJson: readFileSync(resolve(INPUTS, 'context.json'), 'utf8'),
    policyJson: readFileSync(resolve(INPUTS, 'policy.json'), 'utf8'),
    registryJson: readFileSync(resolve(INPUTS, 'registry.json'), 'utf8'),
    exportedAtUnix: EXPORTED_AT,
  };
}

describe.skipIf(!present)('in-browser WASM verifier (real @platform/atlas-artifact)', () => {
  // The nodejs-target build is CommonJS; load it via createRequire anchored on the
  // package path itself (the repo bans `import.meta` under Next — no-restricted-syntax).
  const realVerify = createRequire(PKG_NODE)(PKG_NODE).verify_artifact as ArtifactVerifyFn;

  it('a Published golden (rule_reserve_assets) verifies -> the gate ALLOWS it', () => {
    const decision = verifyWithWasm(
      realVerify,
      inputsFor(resolve(ATLAS, 'fixtures/artifacts/rule_reserve_assets/artifact.kew')),
    );
    expect(decision.status).toBe('allowed');
  });

  it('a golden the canonical inputs reject (rule_significant_thresholds) -> BLOCKED (fail-closed)', () => {
    const decision = verifyWithWasm(
      realVerify,
      inputsFor(resolve(ATLAS, 'fixtures/artifacts/rule_significant_thresholds/artifact.kew')),
    );
    expect(decision.status).toBe('blocked');
    if (decision.status === 'blocked') expect(decision.reason).toBe('crypto_rejected');
  });
});
