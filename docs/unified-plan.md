# Unified Plan — build & deployment decisions

A running record of cross-cutting build/deploy decisions for COMPASS. This captures what is **actually decided and visible in-repo**; open items are marked TBD rather than invented.

> Scope note: the Vite → Next 15 migration below is a **deferred roadmap item**, not the next upgrade in flight. It is documented here because `next.config.mjs` references it ("Phase C1", "decision 5 — Option A") and that file would otherwise be an unexplained, inert config.

---

## Decision 5 — Option A: same-origin WS + REST proxy (Phase C1)

**Status:** planned / not started. Vite is the active build; there is no `next` dependency.

**Decision.** Once the app migrates to Next 15, the browser talks to a single origin (`dev.hossainpazooki.com`) for everything, and Vercel edge rewrites proxy the backend paths to the EKS ALB. This removes the CORS hop on production paths.

**Proxied paths** (`next.config.mjs` rewrites → `EKS_ALB_HOST`):

| Source | Destination |
|---|---|
| `/v2/ws/:path*` | `https://{EKS_ALB_HOST}/v2/ws/:path*` (WebSocket upgrade) |
| `/v2/:path*` | `https://{EKS_ALB_HOST}/v2/:path*` |
| `/api/:path*` | `https://{EKS_ALB_HOST}/api/:path*` |
| `/audit/:path*` | `https://{EKS_ALB_HOST}/audit/:path*` |
| `/decide/:path*` | `https://{EKS_ALB_HOST}/decide/:path*` |
| `/credit/:path*` | `https://{EKS_ALB_HOST}/credit/:path*` |

**Backend.** `EKS_ALB_HOST` points at the **`regulatory-rule-engine`** ALB (currently the placeholder `k8s-institut-...elb.amazonaws.com` host hardcoded as a default in `next.config.mjs`; update when the rename lands).

### Active configuration (today)

Until Phase C1 lands, the build is governed by:
- `vite.config.ts` — dev server (port 5173), `@`-aliases, `/api` proxy to `http://localhost:8000`.
- `vercel.json` — `framework: "vite"`, `buildCommand`, SPA rewrite, security headers.

The live-session hook already reads `NEXT_PUBLIC_WS_BASE_URL` as a fallback (`useThresholdStream.ts`) so the WS base resolves under both Vite and a future Next build without code changes.

### Migration acceptance (TBD)

- [ ] Add `next` + framework deps; port `index.html` → Next App Router entry.
- [ ] Switch `vercel.json`/`vercel.ts` `framework` to `nextjs`; activate `next.config.mjs` rewrites.
- [ ] Verify same-origin WS upgrade works through the edge to the ALB.
- [ ] Point `EKS_ALB_HOST` at the `regulatory-rule-engine` ALB.
- [ ] Remove the dev-only CORS proxy from `vite.config.ts`.

---

## Related

- Streaming contract: [`packages/contracts/README.md`](../packages/contracts/README.md) · spec: [`dev/briefs/live-threshold-rationale-spec.md`](../dev/briefs/live-threshold-rationale-spec.md)
- Historical FSD/testing roadmap (Phases 0–7, superseded): [`docs/archive/implementation-plan.md`](archive/implementation-plan.md)
