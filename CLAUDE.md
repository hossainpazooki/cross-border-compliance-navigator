# COMPASS

**C**ompliance **O**rchestration for **M**ulti-jurisdiction **P**athways **A**nd **S**treaming **S**urveillance.

Real-time cross-border digital-asset regulatory compliance. React 18 + TypeScript + Vite + Tailwind, organized as an npm-workspaces monorepo with feature-sliced design. Two capability stacks: REST multi-jurisdiction analysis, and a WebSocket "Live Trading Session" that streams threshold crossings with NLI-verified rationale.

> Brand note: earlier code/docs used "Compliance Navigator", "Digital Assets Cross-Border", and "Droit for DeFi v3" — all superseded by COMPASS. The product name now lives in one place: `src/shared/config/product.ts` (`PRODUCT`). The repo slug / Vercel alias still embed the old name.

## Commands
```bash
npm run dev            # Vite dev server (port 5173)
npm run dev:all        # web + mock-ws server concurrently
npm run mock-ws        # local WebSocket fixture server only
npm run build-fixtures # regenerate mock-ws fixtures
npm run build          # production build (tsc && vite build)
npm run preview        # preview the production build
npm run lint           # ESLint (max-warnings 0)
npm run typecheck      # typechecks the app AND both workspaces
npm test               # Vitest run
npm run test:watch     # Vitest watch
npm run test:coverage  # coverage report
```

## Monorepo
npm workspaces (`packages/*`, `tools/*`):
- **`compass`** (root) — the React SPA.
- **`@platform/contracts`** (`packages/contracts`) — shared TypeScript types + guards for the REST + WS protocol. Single source of truth for message shapes.
- **`@platform/mock-ws`** (`tools/mock-ws`) — local WebSocket fixture server for the live session.

## Structure (feature-sliced design)
```
src/
├── app/         # App shell: App.tsx, layouts/, contexts/ (CanvasContext), reducers/, stores/ (uiStore)
├── entities/    # Domain objects: instrument/, jurisdiction/, rule/  (model/)
├── features/    # Feature slices: api/ + model/ + ui/ (+ lib/ | data/)
│   ├── navigation/      # Multi-jurisdiction analysis (POST /navigate), results/conflicts/pathway
│   ├── decision-tree/   # lib/evaluator.ts, lib/conflicts.ts, lib/treeLayout.ts, data/*.json, ui/, model/
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
**Import direction:** `app → pages → features → entities → shared`; `shared` imports nothing. (Stale aliases `@api`/`@components`/`@stores`/`@utils`/`@constants` point at dirs that no longer exist — slated for removal.)

## Routes
- `/` — DecisionCanvas (default 3-panel workspace)
- `/live` — LiveIntent (intent-creation form)
- `/live/:intentId` — LiveSession (WebSocket trading session)
- `/legacy/*` — Navigator, /pathway, /conflicts, /whatif, /decoder, /logic

## Backend
Backend repo: **regulatory-rule-engine** (FastAPI). The contract source-of-truth lives in `@platform/contracts` (mirrors backend Pydantic models).

**REST** — base `VITE_API_URL` (default `http://localhost:8000`):
- `POST /navigate` — multi-jurisdiction compliance
- `POST /decoder/explain/inline` — AI explanations
- `POST /counterfactual/analyze/inline` — what-if analysis
- `POST /v2/intents`, `GET /v2/intents/{id}` — live-session intent lifecycle
- `GET /audit/{id}` — envelope replay for sequence-gap recovery

**WebSocket** — base `VITE_WS_URL` (local `mock-ws` when unset), path `/v2/ws/trade/{intent_id}`:
- Sequenced envelope `{ seq, ts, type, payload }`; 9 message types (`subscribe`, `tick`, `risk_update`, `compliance`, `threshold`, `rationale_tok`, `rationale_verified`, `rationale_retracted`, `error`).
- Application-level text `ping`/`pong` heartbeat (not the WS protocol ping — do not JSON-parse).
- See `packages/contracts/README.md` for the full protocol.

## State
- **Zustand**: UI state (`src/app/stores/uiStore.ts`), navigation (`src/features/navigation/model/`), live-session store.
- **CanvasContext** (`src/app/contexts/`) + `src/app/reducers/` (canvas/panels/tree): panel layout & tree selection.
- **React Query**: server-state caching for REST features.
- **`@platform/contracts` guards**: runtime validation of WS envelopes (`isWSEnvelope`).

## Testing
Vitest + Testing Library (unit/component) under `src/features/live-session/__tests__/`; Playwright + axe E2E at `e2e/live-session.spec.ts` (CI-triggered against Vercel previews).

## Notes
- Two decision-tree datasets: `mica-stablecoin.json` (registered in the rule registry) and `credit-decision.json`.
- Vite is the active build (`vite.config.ts` + `vercel.json`). `next.config.mjs` is checked in but **inert** until the Vite → Next 15 migration (Phase C1); there is no `next` dependency yet.

## Tool Usage (Critical)

**File operations MUST be sequential:**
```
WRONG:  Edit A + Edit B + Write C  ← Race conditions
CORRECT: Edit A → wait → Edit B → wait → Write C
```

1. One file operation at a time
2. Wait for completion before next
3. Batch edits to same file
4. Read before write

**Safe parallelism:** Grep, Glob, web fetches, read-only bash ✓

## Context Management
- Check /context before major tasks
- Compact at 60% usage
- After compacting: verify current state before continuing
