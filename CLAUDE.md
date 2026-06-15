# COMPASS

**C**ompliance **O**rchestration for **M**ulti-jurisdiction **P**athways **A**nd **S**treaming **S**urveillance.

Real-time cross-border digital-asset regulatory compliance. React 19 + TypeScript + Next 15 (App Router) + Tailwind, organized as an npm-workspaces monorepo with feature-sliced design. Next is the active build (`next.config.mjs`); the SPA mounts client-side under an optional catch-all (`app/[[...slug]]`) while App-Router route handlers under `app/` serve the REST/SSE/audit surfaces. Two capability stacks: REST multi-jurisdiction analysis, and a WebSocket "Live Trading Session" that streams threshold crossings with NLI-verified rationale.

> Global working rules (file-op style, git default, verification, workflows,
> shared agents) are loaded from `~/.claude/` — not repeated here. This file is
> COMPASS-specific only.

> Brand note: earlier code/docs used "Compliance Navigator", "Digital Assets Cross-Border", and "Droit for DeFi v3" — all superseded by COMPASS. The product name now lives in one place: `src/shared/config/product.ts` (`PRODUCT`). The repo slug / Vercel alias still embed the old name.

## Commands
```bash
npm run dev            # next dev (port 5173)
npm run dev:web        # next dev with NEXT_PUBLIC_{WS,API}_BASE_URL pointed at local backend
npm run dev:all        # local deployment: web + reference backend concurrently
npm run backend        # reference backend only (REST + WS on :8787)
npm run mock-ws        # deprecated alias for npm run backend
npm run build-fixtures # regenerate fixtures through @platform/engine (grounding-gated)
npm run sync:atlas     # refresh the committed ATLAS provenance snapshot (consumer-only)
npm run build          # production build (next build)
npm run preview        # next start -p 5173 (serve the production build)
npm run lint           # ESLint (eslint . --max-warnings 0)
npm run typecheck      # typechecks the app AND all three workspaces
npm test               # Vitest run (app + engine + backend conformance)
npm run test:watch     # Vitest watch
npm run test:coverage  # coverage report
```
> `next build` emits one warning ("the Next.js plugin was not detected in the ESLint configuration"): COMPASS lints via `.eslintrc.cjs` and does not install `eslint-config-next` / `@next/eslint-plugin-next`. Lint/typecheck/test/build are all green regardless.

## Monorepo
npm workspaces (`packages/*`, `tools/*`):
- **`compass`** (root) — the React SPA.
- **`@platform/contracts`** (`packages/contracts`) — shared TypeScript types + guards for the REST + WS protocol. Single source of truth for message shapes.
- **`@platform/engine`** (`packages/engine`) — the decision engine (evaluateTree, detectConflicts) + decision-tree types + bundled rule data. Owner of the `@/types/{decisionTree,common,navigate}` domain types (those modules re-export from here). Unit-tested.
- **`@platform/reference-backend`** (`tools/reference-backend`) — reference implementation of the REST + WS contract (formerly `mock-ws`). Drives the local deployment; fixtures are derived through `@platform/engine` with a build-time citation-grounding gate. The conformance suite (`tools/reference-backend/src/__tests__/conformance.test.ts`) is the executable contract any real backend must pass.

## Structure (feature-sliced design)
```
src/
├── app/         # App shell: App.tsx, layouts/, contexts/ (CanvasContext), reducers/, stores/ (uiStore)
├── entities/    # Domain objects: instrument/, jurisdiction/, rule/  (model/)
├── features/    # Feature slices: api/ + model/ + ui/ (+ lib/ | data/)
│   ├── navigation/      # Multi-jurisdiction analysis (POST /navigate), results/conflicts/pathway
│   ├── decision-tree/   # lib/treeLayout.ts + re-exports of @platform/engine; data/ registry; ui/, model/
│   ├── decoder/         # Tiered AI explanations (/decoder/explain/inline)
│   ├── counterfactual/  # What-If analysis (/counterfactual/analyze/inline)
│   ├── trace-explorer/  # Evaluation trace stepper
│   ├── live-session/    # WebSocket streaming, threshold feed, NLI rationale, intents API
│   └── hitl-review/     # Human-in-the-loop review queue
├── views/       # SPA route entry points (DecisionCanvas, LiveIntent, LiveSession, Navigator, …) — renamed from pages/ so Next does not treat it as a Pages-Router dir
├── shared/      # ui/, api/ (axios client), lib/, config/ (PRODUCT, presets, help)  — leaf layer
├── hooks/       # Cross-cutting hooks (mostly re-exports of feature hooks)
└── types/       # Shared TypeScript definitions
```

**Path aliases** (`tsconfig.json`): `@app`, `@views`, `@features`, `@entities`, `@shared` (`@views` replaced `@pages` in the Next cutover; route components import via `@/views`).
**Import direction:** `app → views → features → entities → shared`; `shared` imports nothing.

## Routes
**Client SPA** (react-router under `app/[[...slug]]`, the optional catch-all):
- `/` — DecisionCanvas (default 3-panel workspace)
- `/desk` — DeskHome (org-first landing; Desk MVP, see Notes)
- `/live` — LiveIntent (intent-creation form)
- `/live/:intentId` — LiveSession (WebSocket trading session)
- `/legacy/*` — Navigator, /pathway, /conflicts, /whatif, /decoder, /logic

**App-Router route handlers** (`app/`, static segments that take precedence over the catch-all):
- `app/health/route.ts` — `GET /health`
- `app/v2/intents/route.ts` — `POST/GET /v2/intents`; `app/v2/intents/[intentId]/route.ts` — `GET /v2/intents/{id}`
- `app/v2/stream/trade/[intentId]/route.ts` — `GET /v2/stream/trade/{id}` (SSE, see Backend)
- `app/audit/[intentId]/route.ts` — `GET /audit/{id}`

When `BACKEND_ORIGIN` is set, `next.config.mjs` `rewrites()` proxies `/v2/*`, `/audit/*`, `/health` to that origin via `beforeFiles` (overriding the handlers); unset, the in-tree handlers serve. There is intentionally no WS rewrite — the WebSocket is reached directly via `NEXT_PUBLIC_WS_BASE_URL`.

## Backend
The canonical local backend is **`@platform/reference-backend`** (this repo, `tools/reference-backend`) — it implements the full live-session contract and is what `npm run dev:all` boots. The contract source-of-truth lives in `@platform/contracts`; the conformance suite is its executable definition. A production backend is future work (direction: ke-workbench's Gate-5 `ke-cli serve` in the `regulatory-rule-engine` repo, which must pass the same conformance suite). The legacy "FastAPI backend" pointer to `institutional-defi-platform-api` is historical — that repo never implemented `/v2/intents` and is out of the COMPASS dependency graph.

**REST** — base `VITE_API_URL` (default `http://localhost:8787`, the local reference backend; navigate/decoder/counterfactual fall back to in-app demo responses):
- `POST /navigate` — multi-jurisdiction compliance (demo fallback in-app)
- `POST /decoder/explain/inline` — AI explanations (demo fallback in-app)
- `POST /counterfactual/analyze/inline` — what-if analysis (demo fallback in-app)
- `POST /v2/intents`, `GET /v2/intents/{id}` — live-session intent lifecycle
- `GET /audit/{id}` — envelope replay for sequence-gap recovery

**WebSocket** — base `VITE_WS_URL` (local reference backend when unset), path `/v2/ws/trade/{intent_id}`:
- Sequenced envelope `{ seq, ts, type, payload }`; **11** message types (`subscribe`, `tick`, `risk_update`, `compliance`, `threshold`, `rationale_tok`, `rationale_verified`, `rationale_retracted`, `lead_position`, `auditor_finding`, `error`).
- Application-level text `ping`/`pong` heartbeat (not the WS protocol ping — do not JSON-parse).
- See `packages/contracts/README.md` for the full protocol.

**SSE (deployment adapter, not a cross-backend obligation)** — `GET /v2/stream/trade/{intent_id}` streams the *same* sequenced envelopes as `text/event-stream` (`id:` = `envelope.seq`, `data:` = JSON, `:` heartbeat comments, terminal `event: end`). Resume via `Last-Event-ID` header or `?fromSeq`. Surfaced in-tree by the App-Router handler `app/v2/stream/trade/[intentId]/route.ts` so COMPASS can stream on Vercel without a long-lived WS upgrade. The canonical cross-backend contract a real backend must implement stays **WS-only**; the SSE conformance assertions are adapter-level (they prove COMPASS's SSE path equals the WS/audit truth). The serverless-safe core lives in `@platform/reference-backend` **subpath exports** (`./stream`, `./intent-codec`, `./intents`, `./validate`, `./fixtures`) — the root export drags in express/ws and must not be imported by a lambda.

## State
- **Zustand**: UI state (`src/app/stores/uiStore.ts`), navigation (`src/features/navigation/model/`), live-session store.
- **CanvasContext** (`src/app/contexts/`) + `src/app/reducers/` (canvas/panels/tree): panel layout & tree selection.
- **React Query**: server-state caching for REST features.
- **`@platform/contracts` guards**: runtime validation of WS envelopes (`isWSEnvelope`).

## Testing
Vitest: app unit/component tests under `src/features/live-session/__tests__/` (Testing Library), engine unit tests under `packages/engine/src/__tests__/`, and the backend conformance suite under `tools/reference-backend/src/__tests__/` (node environment). Playwright + axe E2E at `e2e/live-session.spec.ts` (CI-triggered against Vercel previews).

## Notes
- Two decision-tree datasets live in `packages/engine/data/`: `mica-stablecoin.json` (registered in the app rule registry) and `credit-decision.json`. `fixtures/` under the reference backend are generated — edit `build-fixtures.ts`/`scenario.ts` and run `npm run build-fixtures`, never the JSON.
- **Next 15 is the active build.** `next ^15.5.19` is a dependency, `vercel.json` is `{ framework: nextjs }`, and `next.config.mjs` is active (reactStrictMode, `transpilePackages` for the three `@platform/*` workspaces, env-gated `rewrites()` on `BACKEND_ORIGIN`, security `headers()`). The Vite → Next migration (Phase C1) has landed in-tree.
- **Desk MVP.** `/desk` (`src/views/DeskHome.tsx`) is the org-first landing, backed by `src/app/stores/deskStore.ts` (Zustand). Demo-grade only: desk/member identity is seeded from `@shared/config/desks` and held in memory — no auth, no persistence, no access control claimed. The desk↔session association map lives in the app/desk layer on purpose so `@features/live-session` stays desk-agnostic.
- **ATLAS provenance (consumer-only).** `src/shared/atlas/provenance.ts` is a typed loader over the committed snapshot `src/shared/config/atlas-provenance.json` (refreshed by `npm run sync:atlas`). DeskHome's rule-pack provenance card joins regime → artifacts via `provenanceForRegime(regimeId)` and renders real signed-artifact metadata. Honesty boundaries are load-bearing and enforced in the UI copy: provenance is **surfaced, not re-verified**; signatures use fixed-seed TEST keys (`test-fixed-seed-1`), not production keys; `registry_state` is always `'unknown'` (live Published/Revoked lifecycle lives only in the ATLAS registry, `ke-cli serve`, Gate 5). COMPASS does not compile/sign/attest/publish. The snapshot pins `atlas_commit` and `platform_corpus_commit`; canonical consumption (the `@platform/atlas-artifact` WASM verifier reading the live registry) is gated behind `NEXT_PUBLIC_USE_WASM_VERIFY` and is post-Gate-5 / out of scope here.
