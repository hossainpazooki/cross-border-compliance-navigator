# Unified Plan — build & deployment decisions

A running record of cross-cutting build/deploy decisions for COMPASS. This captures what is **actually decided and visible in-repo**; open items are marked TBD rather than invented.

> Scope note: the Vite → Next 15 migration has **landed in-tree** (see [Phase C1 — migration plan](#phase-c1--vite--next-15-migration-plan) below). The app now builds on Next 15 (App Router); `next.config.mjs` is active. What remains is outward-facing / deploy-time wiring (point `BACKEND_ORIGIN` at the `regulatory-rule-engine` ALB and verify the same-origin WS upgrade through the edge).

---

## Decision 5 — Option A: same-origin WS + REST proxy (Phase C1)

**Status:** Next 15 cutover landed in-tree; `next.config.mjs` is active. Remaining work is deploy-time only (point `BACKEND_ORIGIN` at the ALB; verify edge WS upgrade).

**Decision.** The browser talks to a single origin (`dev.hossainpazooki.com`) for REST/audit/health, and Vercel edge rewrites proxy those backend paths to the EKS ALB. This removes the CORS hop on production paths. The WebSocket endpoint is **not** proxied — it is reached directly via `NEXT_PUBLIC_WS_BASE_URL`.

**Proxied paths** (`next.config.mjs` `rewrites().beforeFiles` → `BACKEND_ORIGIN`, env-gated; the rewrite set is empty when `BACKEND_ORIGIN` is unset):

| Source | Destination |
|---|---|
| `/v2/:path*` | `${BACKEND_ORIGIN}/v2/:path*` |
| `/audit/:path*` | `${BACKEND_ORIGIN}/audit/:path*` |
| `/health` | `${BACKEND_ORIGIN}/health` |

There is intentionally **no** WebSocket rewrite; WS is reached directly via `NEXT_PUBLIC_WS_BASE_URL`.

**Backend.** `BACKEND_ORIGIN` should point at the **`regulatory-rule-engine`** ALB. There is no hardcoded ALB-host default in `next.config.mjs` — when `BACKEND_ORIGIN` is unset the proxy rewrites are simply omitted. Wiring the host is outward-facing / deploy-time work (blocked locally).

### Active configuration (today)

The build is now governed by Next 15 (App Router):
- `next.config.mjs` — active: `reactStrictMode`, `transpilePackages` for the three `@platform/*` workspaces, env-gated `rewrites().beforeFiles` (REST/audit/health → `BACKEND_ORIGIN`), and security `headers()`. `next dev` runs on port 5173.
- `vercel.json` — `framework: "nextjs"`.

The live-session hook reads `NEXT_PUBLIC_WS_BASE_URL` (`useThresholdStream.ts`) so the WS base resolves directly without going through the Next rewrite layer.

### Migration acceptance (TBD)

- [x] Add `next` + framework deps; port `index.html` → Next App Router entry. _(done in-tree — `next ^15.5.19`; App-Router entry under `app/`.)_
- [x] Switch `vercel.json`/`vercel.ts` `framework` to `nextjs`; activate `next.config.mjs` rewrites. _(done in-tree — `vercel.json` is `framework: "nextjs"`; `next.config.mjs` active with env-gated `BACKEND_ORIGIN` rewrites.)_
- [ ] Verify same-origin WS upgrade works through the edge to the ALB. _(outward-facing / deploy-time — blocked locally.)_
- [ ] Point `BACKEND_ORIGIN` at the `regulatory-rule-engine` ALB. _(outward-facing / deploy-time — blocked locally.)_
- [x] ~~Remove the dev-only CORS proxy from `vite.config.ts`.~~ Done — the orphaned `/api`→`:8000` proxy was removed when the local default moved to the reference backend on `:8787`.

---

## Related

- Streaming contract: [`packages/contracts/README.md`](../packages/contracts/README.md) · spec: [`dev/briefs/live-threshold-rationale-spec.md`](../dev/briefs/live-threshold-rationale-spec.md)
- Historical FSD/testing roadmap (Phases 0–7, superseded): [`docs/archive/implementation-plan.md`](archive/implementation-plan.md)
