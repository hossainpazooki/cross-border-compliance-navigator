# Contributing to COMPASS

Thanks for working on COMPASS. This guide captures the conventions that keep the codebase coherent. For the product overview see [`README.md`](README.md); for agent/automation guidance see [`CLAUDE.md`](CLAUDE.md).

## Prerequisites

- Node.js 20+ and npm 10+ (workspaces).
- `npm install` at the repo root installs the app **and** both workspaces (`packages/contracts`, `tools/mock-ws`).

## Local development

```bash
npm run dev        # app only (http://localhost:5173)
npm run dev:all    # app + local mock-ws server (for the live session)
```

The app runs in **demo mode without a backend** — REST features fall back to bundled demo data and the live session reads from the local `mock-ws` fixtures. Point `VITE_API_URL` / `VITE_WS_URL` at a real backend when you have one (see [`.env.example`](.env.example)).

## Before you push

All three must pass — CI enforces them and `lint` is zero-warnings:

```bash
npm run typecheck   # app + @platform/contracts + @platform/mock-ws
npm run lint
npm test            # Vitest; add npm run test:coverage for coverage
```

## Architecture: feature-sliced design

Source is organized by **feature**, not by technical role. Layers and their allowed import direction:

```
app → pages → features → entities → shared
```

- **`app/`** — shell: providers, layouts, contexts, reducers, app-level stores. May import from any layer below.
- **`pages/`** — thin route compositions. Import from features/entities/shared.
- **`features/`** — business capabilities. **A feature must not import another feature** — compose them in a page instead.
- **`entities/`** — domain objects (`instrument`, `jurisdiction`, `rule`). Import only from `shared`.
- **`shared/`** — UI kit, api client, lib, config. The **leaf** layer: imports nothing from above.

Path aliases (`vite.config.ts`): `@app`, `@pages`, `@features`, `@entities`, `@shared`. Use them instead of long relative paths. (The legacy `@api`/`@components`/`@stores`/`@utils`/`@constants` aliases are dead — don't add imports through them.)

### Feature slice layout

Each feature follows the same internal shape; add only the folders it needs:

```
features/<name>/
├── api/     # network calls (fetch/axios) for this feature
├── model/   # hooks, Zustand stores, derived state
├── ui/      # React components
├── lib/     # pure logic (no React, no I/O) — unit-test these
├── data/    # static JSON (e.g. rule trees)
└── index.ts # public barrel — import the feature via this
```

Keep pure logic in `lib/` so it's trivially unit-testable (see `features/decision-tree/lib/evaluator.ts`).

## The live-session contract workflow

The REST + WebSocket protocol types are **shared** and centralized — never redeclare them in the app.

1. Types + runtime guards live in **`@platform/contracts`** (`packages/contracts/src/*`). The full protocol is documented in [`packages/contracts/README.md`](packages/contracts/README.md) and the spec [`dev/briefs/live-threshold-rationale-spec.md`](dev/briefs/live-threshold-rationale-spec.md).
2. Changing a message shape? Update the contract type **and** its guard in `envelope.ts`, then update `tools/mock-ws` fixtures and the consumer in `src/features/live-session/*` together.
3. Validate every inbound WS frame with `isWSEnvelope` before use — never trust raw payloads.
4. Add/adjust fixtures in `tools/mock-ws`; `npm run build-fixtures` regenerates them. The `envelope-schema` test asserts every fixture is a valid envelope.

## Testing

- **Unit / component** — Vitest + Testing Library. Co-locate under `__tests__/` (e.g. `src/features/live-session/__tests__/`). Prioritize pure `lib/` logic and store reducers.
- **E2E** — Playwright + axe at `e2e/live-session.spec.ts`, run against Vercel previews in CI.

## Documentation map

| Doc | Purpose |
|---|---|
| [`README.md`](README.md) | Product overview, architecture, quick start |
| [`CLAUDE.md`](CLAUDE.md) | Structure/commands/backend for agents |
| [`packages/contracts/README.md`](packages/contracts/README.md) | The REST + WS contract |
| [`dev/briefs/live-threshold-rationale-spec.md`](dev/briefs/live-threshold-rationale-spec.md) | Streaming spec (§2–§9) |
| [`docs/unified-plan.md`](docs/unified-plan.md) | Build/deploy decisions (incl. the deferred Next 15 migration) |
| [`docs/archive/`](docs/archive/) | Superseded plans — historical only |

## Naming / branding

The product brand is **COMPASS**. It is read from one source of truth — `src/shared/config/product.ts` (`PRODUCT`). When touching headers, the document title, or the footer, read from `PRODUCT`; don't hardcode the name. Former names ("Compliance Navigator", "Digital Assets Cross-Border", "Droit for DeFi v3") are superseded. The GitHub repo slug and Vercel alias still embed the old name — renaming those is a separate infrastructure task.

## Commits & PRs

- Keep changes within a feature slice where possible; respect the import boundaries above.
- Run typecheck + lint + tests before pushing.
- Don't commit secrets; use `.env` (gitignored) — `.env.example` documents the variables.
