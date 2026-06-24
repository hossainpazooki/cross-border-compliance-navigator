# ATLAS live verification — session brief (2026-06-23)

> **What this is.** A self-contained record of the session that took COMPASS's
> ATLAS rule-pack provenance from *snapshot-render* to a *live, fail-closed
> verification* path (ADR-0019). Documents what landed, the evidence it was
> verified with, the architecture decisions, and the honest follow-ons. Companion
> to the ATLAS consumer contract `../regulatory-rule-engine/docs/consumer-serve-contract.md`
> and the cross-repo handoff `../regulatory-rule-engine/dev/briefs/compass-consumer-state-and-gate5-rewire.md`.

## Status at end of session

Branch `feat/atlas-live-verify` (stacked on `feat/next15-phase-c1`). Gate green at
the tip — independently re-run, not self-reported:

- `npm run typecheck` → 0 · `npm run lint` → 0 (`--max-warnings 0`)
- `npm test` → **245 passed / 3 skipped** (the 3 skips are the live-registry
  integration specs, which run only when pointed at a live `ke serve`)
- `npx next build` → 0, full route table intact

**Live verification is dormant by default** (`NEXT_PUBLIC_USE_WASM_VERIFY` unset →
snapshot mode, unchanged behaviour). There is **no `@platform/atlas-artifact`
dependency** in `package.json`.

## Commits (each green on its own)

| Commit | Scope |
|--------|-------|
| `82bbadf` (on `feat/next15-phase-c1`) | Fail-closed verification layer (ADR-0019), dormant pending Gate-5 — types, pure `decideGate`, `ke serve` client, gateway, hook, env wiring, DeskHome status chip |
| `0c9f481` | Live `ke serve` HTTP path: `ArtifactNotFoundError`/`not_found` (404 distinct from unreachable), reason-specific chip labels, build-time env assert |
| `7e19c98` | In-browser WASM verify adapter (dependency-injected) + live-verify E2E |
| `e5c5980` | Same-origin `/atlas/verify` proxy — closes the `ke serve` CORS gap |

## The fail-closed gate (ADR-0019)

`decideGate(evidence)` (pure, in `src/shared/atlas/verificationPolicy.ts`) is the
enforcement core. A pack is trusted **only** when `verdict === "verified"` **and**
`registry_state === "Published"`. Everything else is blocked, with a specific reason:

| Outcome | Decision |
|---------|----------|
| verified + `Published` | `allowed` (carries `testKey`) |
| verified + `Revoked`/`Deprecated` | `blocked: not_published` (valid crypto, still blocked) |
| verified + `Unknown` / registry unreachable / timeout | `blocked: registry_unknown` (fail-closed) |
| rejected verdict | `blocked: crypto_rejected` (reason surfaced) |
| HTTP 404 (hash not registered) | `blocked: not_found` |
| flag off (snapshot mode) | `unverified` — distinct from blocked; nothing attempted |

The `is_test_key: true` "TEST key — not production-trusted" disclosure is preserved
(ADR-0009 production-key authority is still open).

## Verification path: HTTP (chosen) vs WASM (deferred)

**HTTP `POST /verify` (architecture B) is the active path.** Rationale: `ke serve`
exposes no raw-`.kew`-bytes endpoint (confirmed in `crates/ke-cli/src/serve/router.rs`),
and in-browser WASM `verify_artifact` needs the bytes **and** live registry evidence.
The HTTP path needs neither — `ke serve` verifies against the canonical registry
server-side (G5-1) and returns `{verdict, registry_state, provenance}`.

**In-browser WASM is built but not wired into the bundle.** `src/shared/atlas/wasmVerifier.ts`
is a **dependency-injected** adapter (`verifyWithWasm(verifyFn, inputs)` +
`parseWasmVerdict`) — it imports nothing from the unpublished package, so the bundle
stays build-safe. It is proven against the **real** verifier by a guarded node
harness (loads the ATLAS `pkg-node` build + the canonical `scripts/contract-inputs/*.json`):
`rule_reserve_assets` → verified/Published → allowed; `rule_significant_thresholds`
→ rejected → blocked. Wiring the gateway `wasm` mode to a real import is the one
gated step — see follow-ons.

## CORS proxy

`ke serve` sends no `Access-Control-*` headers, so a browser cannot call it
cross-origin. `app/atlas/verify/route.ts` (thin) + `src/shared/atlas/verifyProxy.ts`
(testable forwarder, fetch injected) expose a **same-origin** `/atlas/verify` that
forwards server-side to `NEXT_PUBLIC_ATLAS_REGISTRY_URL`. The gateway fetches the
`/atlas` base, not the registry origin directly. Proven live: `POST :5173/atlas/verify`
with a published hash → `verified/Published`; an unregistered hash → 404.

## Evidence captured this session (live, against `serve-published-registry.sh`)

- HTTP client + policy (node): Published `4fa59822…` → allowed; non-Published
  `ff6129cd…` → blocked; unknown → `ArtifactNotFoundError` (404).
- WASM adapter + real verifier: `bcebbd1f…` (rule_reserve_assets) → allowed;
  `a0a06ee4…` (rule_significant_thresholds) → blocked.
- Browser E2E (`e2e/desk-live-verify.spec.ts`): with the proxy, the DeskHome chip
  leaves snapshot mode and settles on the real verdict in a real browser —
  observed `Blocked — not registered` for the demo registry (see follow-on #1).

## How to run the live demo locally

```bash
# 1. seeded registry (ATLAS checkout)
PORT=9999 bash ../regulatory-rule-engine/scripts/serve-published-registry.sh

# 2. COMPASS with live verify on
NEXT_PUBLIC_USE_WASM_VERIFY=true \
NEXT_PUBLIC_ATLAS_REGISTRY_URL=http://127.0.0.1:9999 npm run dev

# 3. (optional) the browser E2E
ATLAS_LIVE_E2E=1 PLAYWRIGHT_BASE_URL=http://localhost:5173 \
  npx playwright test desk-live-verify
```

## Follow-ons (honest, not done)

1. **Browser green-render is blocked on a design gap — decision: leave it for now.**
   DeskHome's pinned goldens `bcebbd1f`/`a0a06ee4` are authored by the ATLAS
   `gen-fixtures` binary (not compiled from YAML), and `ke import` *"publishes
   nothing, transitions nothing, appends no events"* — so a golden **cannot** be
   made `Published` in a servable registry. The only registry-publishable
   `mica_2023` pack is the **compiled** regime artifact `4fa59822`, a different
   artifact at a different granularity. Closing the gap needs a decision, not a
   script: **(A)** re-point COMPASS's snapshot/`sync:atlas` to surface the compiled
   regime pack (deterministic; arguably more correct granularity), or **(B)** add
   ATLAS tooling to register a golden into a registry with lifecycle events. The
   green path itself is already proven by composition (proxy returns
   verified/Published + chip maps `allowed → "Verified — Published"`).
2. **Ship the in-browser WASM path.** Requires `@platform/atlas-artifact` to be a
   real (optional) dependency — publish (scope decision) or a local `file:` bridge —
   then wire gateway `wasm` mode → `verifyWithWasm`. A bytes channel is also needed
   (bundle the `.kew` per G5-4, or an ATLAS bytes endpoint).
3. **Out of scope (noted):** per-attestation role surfacing (server verdict already
   encodes attestation policy; COMPASS is consumer-only), verification-failure audit
   logging, perf caching, production-key rotation.
