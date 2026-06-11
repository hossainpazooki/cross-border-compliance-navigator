# COMPASS

**C**ompliance **O**rchestration for **M**ulti-jurisdiction **P**athways **A**nd **S**treaming **S**urveillance.

Real-time cross-border digital-asset regulatory compliance. React 18 + TypeScript + Vite + Tailwind, organized as an npm-workspaces monorepo with feature-sliced design. Two capability stacks: REST multi-jurisdiction analysis, and a WebSocket "Live Trading Session" that streams threshold crossings with NLI-verified rationale.

> Global working rules (file-op style, git default, verification, workflows,
> shared agents) are loaded from `~/.claude/` — not repeated here. This file is
> COMPASS-specific only.

> Brand note: earlier code/docs used "Compliance Navigator", "Digital Assets Cross-Border", and "Droit for DeFi v3" — all superseded by COMPASS. The product name now lives in one place: `src/shared/config/product.ts` (`PRODUCT`). The repo slug / Vercel alias still embed the old name.

## Commands
```bash
npm run dev            # Vite dev server (port 5173)
npm run dev:all        # local deployment: web + reference backend concurrently
npm run backend        # reference backend only (REST + WS on :8787)
npm run mock-ws        # deprecated alias for npm run backend
npm run build-fixtures # regenerate fixtures through @platform/engine (grounding-gated)
npm run build          # production build (tsc && vite build)
npm run preview        # preview the production build
npm run lint           # ESLint (max-warnings 0)
npm run typecheck      # typechecks the app AND all three workspaces
npm test               # Vitest run (app + engine + backend conformance)
npm run test:watch     # Vitest watch
npm run test:coverage  # coverage report
```

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
├── pages/       # Route entry points (DecisionCanvas, LiveIntent, LiveSession, Navigator, …)
├── shared/      # ui/, api/ (axios client), lib/, config/ (PRODUCT, presets, help)  — leaf layer
├── hooks/       # Cross-cutting hooks (mostly re-exports of feature hooks)
└── types/       # Shared TypeScript definitions
```

**Path aliases** (`vite.config.ts`): `@app`, `@pages`, `@features`, `@entities`, `@shared`.
**Import direction:** `app → pages → features → entities → shared`; `shared` imports nothing.

## Routes
- `/` — DecisionCanvas (default 3-panel workspace)
- `/live` — LiveIntent (intent-creation form)
- `/live/:intentId` — LiveSession (WebSocket trading session)
- `/legacy/*` — Navigator, /pathway, /conflicts, /whatif, /decoder, /logic

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

## State
- **Zustand**: UI state (`src/app/stores/uiStore.ts`), navigation (`src/features/navigation/model/`), live-session store.
- **CanvasContext** (`src/app/contexts/`) + `src/app/reducers/` (canvas/panels/tree): panel layout & tree selection.
- **React Query**: server-state caching for REST features.
- **`@platform/contracts` guards**: runtime validation of WS envelopes (`isWSEnvelope`).

## Testing
Vitest: app unit/component tests under `src/features/live-session/__tests__/` (Testing Library), engine unit tests under `packages/engine/src/__tests__/`, and the backend conformance suite under `tools/reference-backend/src/__tests__/` (node environment). Playwright + axe E2E at `e2e/live-session.spec.ts` (CI-triggered against Vercel previews).

## Notes
- Two decision-tree datasets live in `packages/engine/data/`: `mica-stablecoin.json` (registered in the app rule registry) and `credit-decision.json`. `fixtures/` under the reference backend are generated — edit `build-fixtures.ts`/`scenario.ts` and run `npm run build-fixtures`, never the JSON.
- Vite is the active build (`vite.config.ts` + `vercel.json`). `next.config.mjs` is checked in but **inert** until the Vite → Next 15 migration (Phase C1); there is no `next` dependency yet.
