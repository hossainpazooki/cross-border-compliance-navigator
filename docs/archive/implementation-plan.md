> ⚠️ **ARCHIVED / SUPERSEDED — do not follow this plan.**
> Phases 0–1 (unify the two apps, feature-sliced restructure) are **complete**. Phases 2–7
> were **overtaken** by a different direction: the WebSocket live-session + NLI-verified
> rationale, the `@platform/contracts` + `@platform/mock-ws` monorepo, and the COMPASS rebrand —
> none of which this document anticipates. It also names the backend `regulatory-ke-workbench`
> (now **`regulatory-rule-engine`**) and assumes "no tests" / "only MiCA rule", both now false.
> Kept for historical context only. Current docs: [`README.md`](../../README.md),
> [`CLAUDE.md`](../../CLAUDE.md), [`docs/unified-plan.md`](../unified-plan.md),
> [`dev/briefs/live-threshold-rationale-spec.md`](../../dev/briefs/live-threshold-rationale-spec.md).

# Implementation Plan: digital-assets-cross-border

## Claude Code Prompt

```
You are upgrading the digital-assets-cross-border frontend repository to meet production-ready
standards defined in two reference documents:

1. "Fullstack Project Setup Guide" (Hossain) — architecture, testing, CI, observability
2. "Full-Stack Product Engineering Standards 2026" (Hossain) — FSD, composition, state, perf, type safety

The repo is a React 18 + TypeScript + Vite frontend for cross-border digital asset regulatory
compliance. It has two coexisting frontend apps in one repo:
  - src/           → "Decision Canvas" (3-panel workspace, SVG tree viewer)
  - frontend-react/ → "Compliance Navigator" (multi-page dashboard)

Both share a backend at github.com/hossainpazooki/regulatory-ke-workbench (FastAPI/Python).

Your job is to execute the phases below in order. Each phase is self-contained with acceptance
criteria. Do not skip phases. Run typecheck and lint after every structural change. When moving
files, update all import paths and verify the build passes before proceeding.

Current tech stack:
  - React 18.2, TypeScript 5.3, Vite 5.1
  - Zustand 4.5, TanStack React Query 5.20
  - Tailwind CSS 3.4, Axios 1.6, Zod 3.22
  - ESLint 8 with @typescript-eslint + react-hooks plugins

Constraints:
  - Do not change the backend. Frontend-only changes.
  - Do not remove any existing functionality.
  - Preserve the existing API contract (axios client → FastAPI endpoints).
  - Each phase must leave the app in a buildable, working state.
```

---

## Phase 0: Unify the Two Frontend Apps

**Problem:** Two separate React apps (`src/` and `frontend-react/`) with duplicated structures
(`store/` vs `stores/`, separate `hooks/index.ts`, separate `App.tsx`). This creates maintenance
drift and violates both guides' emphasis on consistency and clear boundaries.

**Decision:** Consolidate into a single app under `src/`. The `frontend-react/` pages become
additional routes in the unified app. Shared infrastructure (stores, hooks, api, types) lives once.

### Tasks

#### 0.1 — Audit duplication between the two apps

```
Files to compare:
  src/api/client.ts           vs  frontend-react/src/api/client.ts
  src/stores/                 vs  frontend-react/src/store/
  src/hooks/                  vs  frontend-react/src/hooks/
  src/types/                  vs  frontend-react/src/types/
  src/components/shared/      vs  frontend-react/src/components/common/
```

Produce a mapping document (can be a comment in a new `docs/UNIFICATION.md`) listing:
- Identical files → keep `src/` version
- Complementary files → merge
- Unique to `frontend-react/` → migrate to `src/`

#### 0.2 — Migrate unique pages from `frontend-react/` into `src/pages/`

```
frontend-react/src/pages/Home.tsx              → src/pages/Home.tsx
frontend-react/src/pages/KEWorkbench.tsx       → src/pages/KEWorkbench.tsx
frontend-react/src/pages/ProductionDemo.tsx    → src/pages/ProductionDemo.tsx
frontend-react/src/pages/CrossBorderNavigator.tsx → src/pages/CrossBorderNavigator.tsx
frontend-react/src/pages/EmbeddingExplorer.tsx → src/pages/EmbeddingExplorer.tsx
frontend-react/src/pages/SimilaritySearch.tsx  → src/pages/SimilaritySearch.tsx
frontend-react/src/pages/GraphVisualizer.tsx   → src/pages/GraphVisualizer.tsx
frontend-react/src/pages/AnalyticsDashboard.tsx → src/pages/AnalyticsDashboard.tsx
```

Update imports in each file to use `src/` equivalents (e.g., `@/stores` not `@/store`).

#### 0.3 — Merge unique stores

```
frontend-react/src/store/workbenchStore.ts  → src/stores/workbenchStore.ts
frontend-react/src/store/analyticsStore.ts  → src/stores/analyticsStore.ts
```

Update `src/stores/index.ts` barrel export to include new stores.

#### 0.4 — Merge unique hooks

```
frontend-react/src/hooks/useRules.ts      → src/hooks/useRules.ts
frontend-react/src/hooks/useAnalytics.ts  → src/hooks/useAnalytics.ts
```

If `useJurisdiction` exists in both, compare and keep the more complete version.
Update `src/hooks/index.ts` barrel export.

#### 0.5 — Merge common components

```
frontend-react/src/components/common/MetricCard.tsx   → src/components/shared/MetricCard.tsx
frontend-react/src/components/common/StatusBadge.tsx   → src/components/shared/StatusBadge.tsx
frontend-react/src/components/common/Sidebar.tsx       → src/components/shared/Sidebar.tsx
frontend-react/src/components/common/Layout.tsx        → src/components/shared/Layout.tsx (rename or merge)
frontend-react/src/components/common/ErrorBoundary.tsx → src/components/shared/ErrorBoundary.tsx
```

Resolve naming conflicts. Update barrel export in `src/components/shared/index.ts`.

#### 0.6 — Merge API layer

If `frontend-react/src/api/` has additional API modules (rules.api.ts, analytics.api.ts,
jurisdiction.api.ts), migrate them to `src/api/`. Keep the single axios client instance.

#### 0.7 — Unify routing

Update `src/App.tsx` to include all routes from both apps. Use a single `Layout` wrapper.

```tsx
// src/App.tsx — unified routes
import { Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';

// Canvas (original src/ app)
const DecisionCanvas = lazy(() => import('@/pages/DecisionCanvas'));

// Navigator pages (from frontend-react/)
const Home = lazy(() => import('@/pages/Home'));
const KEWorkbench = lazy(() => import('@/pages/KEWorkbench'));
const CrossBorderNavigator = lazy(() => import('@/pages/CrossBorderNavigator'));
// ... etc
```

Note: This introduces `lazy()` which is also a Phase 3 requirement — do it now to avoid
re-touching routing later.

#### 0.8 — Remove `frontend-react/` directory

After verifying the unified app builds and all routes work:
```bash
rm -rf frontend-react/
```

Update the root `package.json` if there are any references. Update README.

### Acceptance Criteria
- [ ] Single `src/` directory, no `frontend-react/`
- [ ] `npm run build` passes
- [ ] `npm run typecheck` passes
- [ ] All routes accessible: `/`, `/canvas`, `/workbench`, `/production`, `/navigate`,
      `/embeddings`, `/similarity`, `/graph`, `/analytics`
- [ ] No duplicate store/hook/type definitions

---

## Phase 1: Restructure to Feature-Sliced Design

**Problem:** Current structure is organized by technical role (`components/`, `hooks/`, `stores/`)
not by product feature. Both guides prescribe feature-first organization where you navigate by
intent ("cross-border navigation") not by layer ("components").

### Target Structure

```
src/
├── app/                          # App shell (providers, global layout, routing)
│   ├── App.tsx
│   ├── providers.tsx             # QueryClientProvider, RouterProvider
│   ├── routes.tsx                # Lazy route definitions
│   └── styles/                   # Global CSS, Tailwind config entry
│
├── pages/                        # Route entry points (thin composition)
│   ├── DecisionCanvas.tsx
│   ├── Navigator.tsx
│   ├── KEWorkbench.tsx
│   ├── CrossBorderNavigator.tsx
│   ├── EmbeddingExplorer.tsx
│   ├── SimilaritySearch.tsx
│   ├── GraphVisualizer.tsx
│   ├── AnalyticsDashboard.tsx
│   ├── ProductionDemo.tsx
│   └── Home.tsx
│
├── features/                     # Business actions (feature modules)
│   ├── navigation/               # Cross-border navigation flow
│   │   ├── ui/                   # ScenarioBuilder, ScenarioSummary
│   │   ├── model/                # navigationStore.ts, useNavigate.ts
│   │   └── api/                  # navigate API calls
│   │
│   ├── decision-tree/            # Tree evaluation and visualization
│   │   ├── ui/                   # DecisionTreeViewer, TreeToolbar, NodeInspector
│   │   ├── model/                # useTreeHighlight, useTreeNavigation, tree stores
│   │   └── lib/                  # evaluator.ts, conflicts.ts (pure logic)
│   │
│   ├── decoder/                  # AI explanation layer
│   │   ├── ui/                   # DecoderPanel, CitationsList, AnchoredText
│   │   ├── model/                # useDecoder, decoder stores
│   │   └── api/                  # decoder API calls
│   │
│   ├── counterfactual/           # What-If analysis
│   │   ├── ui/                   # WhatIfPanel, DeltaAnalysis
│   │   ├── model/                # useCounterfactual
│   │   └── api/                  # counterfactual API calls
│   │
│   ├── trace-explorer/           # Evaluation trace display
│   │   └── ui/                   # TraceExplorer, TraceStep
│   │
│   ├── analytics/                # Embeddings, similarity, clustering
│   │   ├── ui/                   # UMAPScatter, ForceGraph, charts
│   │   ├── model/                # analyticsStore, useAnalytics
│   │   └── api/                  # analytics API calls
│   │
│   └── workbench/                # KE workbench (rule review)
│       ├── ui/
│       ├── model/                # workbenchStore
│       └── api/                  # rules API calls
│
├── entities/                     # Business domain objects
│   ├── jurisdiction/
│   │   ├── model/                # types, constants (JURISDICTIONS map)
│   │   └── ui/                   # JurisdictionBadge, JurisdictionFlag
│   │
│   ├── rule/
│   │   ├── model/                # RuleDefinition, RuleMetadata types
│   │   └── ui/                   # RuleCard, RuleTag
│   │
│   └── instrument/
│       └── model/                # InstrumentType, instrument constants
│
├── shared/                       # UI kit and cross-cutting utilities
│   ├── ui/                       # Button, Badge, Card, LoadingSpinner, Tooltip, ErrorBoundary
│   ├── api/                      # axios client, error handling, types
│   ├── lib/                      # cn() utility, formatters, validators
│   └── config/                   # env vars, constants, feature flags
│
└── main.tsx                      # Entry point
```

### Import Rules (enforce in Phase 4)

```
app/       → can import from: pages, features, entities, shared
pages/     → can import from: features, entities, shared
features/  → can import from: entities, shared
             features CANNOT import from other features (use pages to compose)
entities/  → can import from: shared only
shared/    → can import from: nothing (leaf layer)
```

### Tasks

#### 1.1 — Create the directory scaffold

```bash
mkdir -p src/{app,pages,features/{navigation,decision-tree,decoder,counterfactual,trace-explorer,analytics,workbench}/{ui,model,api},entities/{jurisdiction,rule,instrument}/{model,ui},shared/{ui,api,lib,config}}
```

#### 1.2 — Move shared UI components

```
src/components/shared/Button.tsx      → src/shared/ui/Button.tsx
src/components/shared/Badge.tsx       → src/shared/ui/Badge.tsx
src/components/shared/Card.tsx        → src/shared/ui/Card.tsx
src/components/shared/LoadingSpinner.tsx → src/shared/ui/LoadingSpinner.tsx
src/components/shared/Tooltip.tsx     → src/shared/ui/Tooltip.tsx
src/components/shared/HelpIcon.tsx    → src/shared/ui/HelpIcon.tsx
src/components/shared/ErrorBoundary.tsx → src/shared/ui/ErrorBoundary.tsx
+ MetricCard, StatusBadge, Sidebar (from Phase 0 merge)
```

Create `src/shared/ui/index.ts` barrel export.

#### 1.3 — Move shared utilities

```
src/utils/index.ts (cn function)     → src/shared/lib/cn.ts
src/api/client.ts                    → src/shared/api/client.ts
src/constants/                       → src/shared/config/
```

#### 1.4 — Extract entities

```
src/types/common.ts (JurisdictionCode, JURISDICTIONS map)
  → src/entities/jurisdiction/model/types.ts
  → src/entities/jurisdiction/model/constants.ts

src/types/decisionTree.ts (RuleDefinition, RuleMetadata)
  → src/entities/rule/model/types.ts

src/types/common.ts (InstrumentType, ActivityType)
  → src/entities/instrument/model/types.ts
```

Keep a thin `src/types/index.ts` that re-exports from entities for backward compat during migration.

#### 1.5 — Move features

Decision tree feature:
```
src/components/decision-tree/   → src/features/decision-tree/ui/
src/components/trace-explorer/  → src/features/trace-explorer/ui/
src/lib/decisionTree/           → src/features/decision-tree/lib/
src/lib/svg/                    → src/features/decision-tree/lib/svg/
src/hooks/useTreeHighlight.ts   → src/features/decision-tree/model/useTreeHighlight.ts
src/hooks/useTreeNavigation.ts  → src/features/decision-tree/model/useTreeNavigation.ts
src/rules/                      → src/features/decision-tree/data/  (or src/shared/config/rules/)
```

Navigation feature:
```
src/components/canvas/ScenarioBuilder.tsx → src/features/navigation/ui/ScenarioBuilder.tsx
src/components/canvas/ScenarioSummary.tsx → src/features/navigation/ui/ScenarioSummary.tsx
src/stores/navigationStore.ts            → src/features/navigation/model/store.ts
src/hooks/useJurisdiction.ts (navigate)  → src/features/navigation/api/useNavigate.ts
```

Decoder feature:
```
src/components/canvas/DecoderPanel.tsx    → src/features/decoder/ui/DecoderPanel.tsx
src/components/canvas/CitationsList.tsx   → src/features/decoder/ui/CitationsList.tsx
src/components/canvas/AnchoredText.tsx    → src/features/decoder/ui/AnchoredText.tsx
src/hooks/useDecoder.ts (if exists)       → src/features/decoder/model/useDecoder.ts
```

Canvas layout (stays as app-level composition):
```
src/components/canvas/CanvasLayout.tsx   → src/app/layouts/CanvasLayout.tsx
src/components/canvas/CanvasHeader.tsx   → src/app/layouts/CanvasHeader.tsx
src/components/canvas/PanelHeader.tsx    → src/shared/ui/PanelHeader.tsx
src/components/canvas/LeftRail.tsx       → src/app/layouts/LeftRail.tsx
src/components/canvas/CenterPane.tsx     → src/app/layouts/CenterPane.tsx
src/components/canvas/RightRail.tsx      → src/app/layouts/RightRail.tsx
src/components/canvas/BottomWorkbench.tsx → src/app/layouts/BottomWorkbench.tsx
```

#### 1.6 — Move remaining stores

```
src/stores/resultsStore.ts  → src/features/navigation/model/resultsStore.ts
src/stores/uiStore.ts       → src/app/stores/uiStore.ts  (cross-feature, so app-level)
```

#### 1.7 — Update all import paths

Use your IDE's find-and-replace across the entire `src/` tree. Update `tsconfig.json` path aliases:

```json
{
  "paths": {
    "@/*": ["src/*"],
    "@shared/*": ["src/shared/*"],
    "@features/*": ["src/features/*"],
    "@entities/*": ["src/entities/*"],
    "@app/*": ["src/app/*"],
    "@pages/*": ["src/pages/*"]
  }
}
```

Update `vite.config.ts` resolve aliases to match.

#### 1.8 — Verify build

```bash
npm run typecheck
npm run lint
npm run build
```

### Acceptance Criteria
- [ ] No files remain in old `src/components/canvas/`, `src/components/shared/`,
      `src/components/decision-tree/`, `src/components/trace-explorer/`
- [ ] Feature folders each contain `ui/`, `model/`, and optionally `api/` or `lib/`
- [ ] `shared/` contains no imports from `features/` or `pages/`
- [ ] Build passes, all routes work

---

## Phase 2: Testing Foundation

**Problem:** Zero frontend tests despite perfectly testable pure domain logic. Both guides
consider this the highest-priority gap.

### Tasks

#### 2.1 — Install test tooling

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install -D jsdom @vitest/coverage-v8
```

Add to `package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/features/**/lib/**', 'src/entities/**/model/**', 'src/shared/lib/**'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

Create `src/test/setup.ts`:
```ts
import '@testing-library/jest-dom';
```

#### 2.2 — Unit tests for decision tree evaluator (highest value)

Create `src/features/decision-tree/lib/__tests__/evaluator.test.ts`:

```ts
// Test cases to cover:
// 1. getIn — nested access, array access, missing paths, null handling
// 2. evaluateCondition — every operator (eq, neq, gt, lt, gte, lte, in, contains, matches, nil?, some?)
// 3. evaluateTree — happy path through condition chain, trace generation
// 4. evaluateTree — cache hit/miss with treeId
// 5. evaluatePartial — missing facts branch exploration
// 6. collectFactPaths — extracts all referenced facts
// 7. countNodes — correct count of conditions and leaves
```

Target: 30+ test cases. These are pure functions, no mocking needed.

#### 2.3 — Unit tests for conflict detection

Create `src/features/decision-tree/lib/__tests__/conflicts.test.ts`:

```ts
// Test cases:
// 1. detectConflicts — finds conflicts between jurisdiction evaluations
// 2. mergeObligations — correctly merges obligations with resolution strategies
```

#### 2.4 — Unit tests for tree layout

Create `src/features/decision-tree/lib/__tests__/treeLayout.test.ts`:

```ts
// Test cases:
// 1. calculateLayout — produces valid positions for simple trees
// 2. calculateLayout — handles deep trees, single-node trees
// 3. Evaluation path highlighting
```

#### 2.5 — Entity type tests

Create `src/entities/jurisdiction/model/__tests__/types.test.ts`:

```ts
// Test JURISDICTIONS constant completeness
// Test type guard functions
// Test JurisdictionCode exhaustiveness
```

#### 2.6 — Store tests

Create `src/features/navigation/model/__tests__/store.test.ts`:

```ts
// Test navigationStore actions:
// 1. toggleTargetJurisdiction — adds and removes
// 2. toggleInvestorType — adds and removes
// 3. reset — returns to initial state
// 4. Initial state is correct
```

#### 2.7 — Integration test for a feature flow

Create `src/features/navigation/ui/__tests__/ScenarioBuilder.test.tsx`:

```tsx
// Render ScenarioBuilder with mocked stores
// Verify form inputs update store
// Verify submit calls API
// Verify loading/error states render
```

#### 2.8 — Update CI to run tests

In `.github/workflows/ci.yml`, update the test job:

```yaml
test:
  runs-on: ubuntu-latest
  needs: lint-and-typecheck
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: '20', cache: 'npm' }
    - run: npm ci
    - run: npm test
    - run: npm run test:coverage
    - uses: actions/upload-artifact@v4
      with:
        name: coverage
        path: coverage/
```

### Acceptance Criteria
- [ ] `npm test` runs and passes
- [ ] ≥30 unit tests for `lib/decisionTree/evaluator.ts`
- [ ] ≥10 unit tests for conflict detection
- [ ] ≥5 store tests
- [ ] ≥1 integration test with React Testing Library
- [ ] CI runs tests on every PR
- [ ] Coverage report generated

---

## Phase 3: Performance — Lazy Loading & Skeletons

**Problem:** All 8+ page components imported eagerly. No skeleton loading. Both guides
specifically prescribe `React.lazy()` + `Suspense` with skeleton fallbacks.

### Tasks

#### 3.1 — Create skeleton components

Create `src/shared/ui/Skeleton.tsx`:
```tsx
// Configurable skeleton with variants:
// - SkeletonText (lines of varying width)
// - SkeletonCard (card-shaped placeholder)
// - SkeletonChart (chart-shaped placeholder)
// - SkeletonTree (tree-shaped placeholder for decision tree)
// Use Tailwind animate-pulse on bg-slate-700/50 rectangles
```

#### 3.2 — Create page-level skeleton layouts

```
src/pages/skeletons/
├── NavigatorSkeleton.tsx     # Metric cards + form skeleton
├── CanvasSkeleton.tsx        # 3-panel layout with skeleton tree
├── WorkbenchSkeleton.tsx     # Table skeleton
├── ChartSkeleton.tsx         # Used for embeddings, analytics, graph pages
└── index.ts
```

#### 3.3 — Implement lazy routes (if not done in Phase 0.7)

```tsx
// src/app/routes.tsx
import { Suspense, lazy } from 'react';
import { CanvasSkeleton, NavigatorSkeleton, ChartSkeleton, WorkbenchSkeleton } from '@/pages/skeletons';

const DecisionCanvas = lazy(() => import('@/pages/DecisionCanvas'));
const Navigator = lazy(() => import('@/pages/Navigator'));
const KEWorkbench = lazy(() => import('@/pages/KEWorkbench'));
const CrossBorderNavigator = lazy(() => import('@/pages/CrossBorderNavigator'));
const EmbeddingExplorer = lazy(() => import('@/pages/EmbeddingExplorer'));
const SimilaritySearch = lazy(() => import('@/pages/SimilaritySearch'));
const GraphVisualizer = lazy(() => import('@/pages/GraphVisualizer'));
const AnalyticsDashboard = lazy(() => import('@/pages/AnalyticsDashboard'));
const ProductionDemo = lazy(() => import('@/pages/ProductionDemo'));

export const routes = [
  { path: '/', element: <Home /> },  // Home is small, keep eager
  {
    path: '/canvas',
    element: (
      <Suspense fallback={<CanvasSkeleton />}>
        <DecisionCanvas />
      </Suspense>
    ),
  },
  {
    path: '/navigate',
    element: (
      <Suspense fallback={<NavigatorSkeleton />}>
        <CrossBorderNavigator />
      </Suspense>
    ),
  },
  // ... etc for all routes
];
```

#### 3.4 — Replace spinner-only loading states with skeletons

In components that show `<LoadingSpinner />` for data fetching, replace with contextual skeletons:

```
Navigator.tsx:    spinner → NavigatorSkeleton
CenterPane.tsx:   spinner → SkeletonTree
RightRail.tsx:    spinner → SkeletonText
BottomWorkbench:  spinner → SkeletonCard
```

### Acceptance Criteria
- [ ] All route-level page components use `React.lazy()` + `Suspense`
- [ ] Each lazy route has a skeleton fallback (not a spinner)
- [ ] Data loading states use contextual skeletons
- [ ] `npm run build` produces multiple chunks (verify in build output)
- [ ] No visual regression — app looks the same once loaded

---

## Phase 4: Linting, Formatting & Boundary Enforcement

**Problem:** No architectural lint rules, no formatter, no pre-commit hooks.
Both guides list these as non-negotiable.

### Tasks

#### 4.1 — Add Prettier

```bash
npm install -D prettier eslint-config-prettier
```

Create `.prettierrc`:
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

Add to `.eslintrc.cjs` extends: `'prettier'` (last position).

#### 4.2 — Add import boundary enforcement

```bash
npm install -D eslint-plugin-import eslint-plugin-boundaries
```

Add to `.eslintrc.cjs`:
```js
module.exports = {
  // ... existing config
  plugins: ['react-refresh', 'boundaries'],
  settings: {
    'boundaries/elements': [
      { type: 'app', pattern: 'src/app/*' },
      { type: 'pages', pattern: 'src/pages/*' },
      { type: 'features', pattern: 'src/features/*' },
      { type: 'entities', pattern: 'src/entities/*' },
      { type: 'shared', pattern: 'src/shared/*' },
    ],
  },
  rules: {
    'boundaries/element-types': [
      'error',
      {
        default: 'disallow',
        rules: [
          { from: 'app', allow: ['pages', 'features', 'entities', 'shared'] },
          { from: 'pages', allow: ['features', 'entities', 'shared'] },
          { from: 'features', allow: ['entities', 'shared'] },
          { from: 'entities', allow: ['shared'] },
          { from: 'shared', allow: [] },
        ],
      },
    ],
    // Prevent features from importing other features
    'boundaries/entry-point': ['error', { default: 'disallow',
      rules: [{ target: 'features', allow: '**' }] }],
  },
};
```

#### 4.3 — Add pre-commit hooks

```bash
npm install -D husky lint-staged
npx husky init
```

Create `.husky/pre-commit`:
```bash
npx lint-staged
```

Add to `package.json`:
```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,css}": ["prettier --write"]
  }
}
```

#### 4.4 — Fix all boundary violations

Run `npm run lint` and fix every `boundaries/element-types` error. This is the enforcement
step — move any cross-boundary imports to proper layers.

#### 4.5 — Add import ordering

In `.eslintrc.cjs`:
```js
'import/order': ['warn', {
  groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
  pathGroups: [
    { pattern: '@shared/**', group: 'internal', position: 'before' },
    { pattern: '@entities/**', group: 'internal', position: 'before' },
    { pattern: '@features/**', group: 'internal', position: 'before' },
  ],
  'newlines-between': 'always',
  alphabetize: { order: 'asc' },
}],
```

### Acceptance Criteria
- [ ] `npm run lint` passes with boundary rules enforced
- [ ] `npx prettier --check .` passes
- [ ] Pre-commit hook runs lint-staged on every commit
- [ ] No `shared/` file imports from `features/`
- [ ] No `features/X` file imports from `features/Y`
- [ ] No `entities/` file imports from `features/` or `pages/`

---

## Phase 5: Design System Hardening

**Problem:** Reusable shared components exist but form inputs are inline-styled,
no accessibility, no explicit token layer.

### Tasks

#### 5.1 — Create form input components

Create in `src/shared/ui/`:

```
Input.tsx     — text/number input with label, error state, aria-describedby
Select.tsx    — select with label, error, option groups
Checkbox.tsx  — checkbox with label
FormField.tsx — wrapper with label, error message, description
```

Each must include:
- `id` and `htmlFor` connection
- `aria-invalid` when error present
- `aria-describedby` pointing to error/description element
- Focus ring styles consistent with Button

#### 5.2 — Replace inline form elements across features

Find all `<input className="w-full rounded-lg border border-slate-700..."` and
`<select className="input w-full"` patterns. Replace with shared components.

Priority files:
```
features/navigation/ui/ScenarioBuilder.tsx
pages/CrossBorderNavigator.tsx
features/counterfactual/ui/ (BottomWorkbench what-if section)
```

#### 5.3 — Add keyboard navigation to decision tree

In `src/features/decision-tree/ui/DecisionTreeViewer.tsx`:
- Add `role="tree"` to container
- Add `role="treeitem"` to nodes
- Add `aria-expanded` to condition nodes
- Add keyboard handlers (Arrow keys to navigate, Enter to select)
- Add `aria-label` describing each node's condition/decision

#### 5.4 — Create a design token reference

Create `src/shared/config/tokens.ts`:
```ts
// Centralize the values that Tailwind classes reference
export const tokens = {
  colors: {
    surface: { primary: 'slate-900', secondary: 'slate-800', tertiary: 'slate-700' },
    text: { primary: 'white', secondary: 'slate-300', muted: 'slate-400', disabled: 'slate-500' },
    border: { default: 'slate-700', focus: 'blue-500' },
    status: {
      success: { bg: 'green-500/20', text: 'green-400' },
      warning: { bg: 'amber-500/20', text: 'amber-400' },
      error: { bg: 'red-500/20', text: 'red-400' },
      info: { bg: 'blue-500/20', text: 'blue-400' },
    },
    jurisdiction: { eu: 'blue', uk: 'purple', us: 'red', ch: 'orange', sg: 'green' },
  },
  spacing: { panel: 4, section: 6, page: 8 },
} as const;
```

This is documentation + a single source of truth, even if Tailwind classes remain in components.

### Acceptance Criteria
- [ ] All form inputs use shared `Input`, `Select`, `Checkbox` components
- [ ] Every form component has proper `aria-*` attributes
- [ ] Decision tree has basic keyboard navigation
- [ ] Design tokens file exists and is referenced from at least Button, Badge, Card
- [ ] No raw `<input>` or `<select>` elements with inline Tailwind in feature code

---

## Phase 6: API Client Improvements & Type Safety

**Problem:** Manual type maintenance between frontend and backend. No retries.
No request correlation.

### Tasks

#### 6.1 — Add retry logic to API client

Update `src/shared/api/client.ts`:
```ts
import axios from 'axios';
import type { AxiosError } from 'axios';

// Retry config for idempotent requests
const RETRY_COUNT = 2;
const RETRY_DELAY_MS = 1000;

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config;
    if (!config || !isRetryable(error) || (config as any).__retryCount >= RETRY_COUNT) {
      return Promise.reject(error);
    }
    (config as any).__retryCount = ((config as any).__retryCount || 0) + 1;
    await delay(RETRY_DELAY_MS * (config as any).__retryCount);
    return apiClient(config);
  }
);

function isRetryable(error: AxiosError): boolean {
  return !error.response || error.response.status >= 500 || error.response.status === 429;
}
```

#### 6.2 — Add request ID correlation

```ts
import { v4 as uuid } from 'uuid'; // or use crypto.randomUUID()

apiClient.interceptors.request.use((config) => {
  config.headers['X-Request-ID'] = crypto.randomUUID();
  return config;
});
```

#### 6.3 — Add Zod runtime validation at API boundaries

Create `src/shared/api/schemas.ts` with Zod schemas for critical API responses:

```ts
import { z } from 'zod';

export const NavigateResponseSchema = z.object({
  status: z.enum(['actionable', 'blocked', 'requires_review']),
  applicable_jurisdictions: z.array(z.object({
    jurisdiction: z.string(),
    role: z.string(),
    // ...
  })),
  conflicts: z.array(z.object({
    severity: z.enum(['blocking', 'warning', 'info']),
    // ...
  })),
  // ...
});
```

Validate responses in API hooks:
```ts
const response = await apiClient.post('/navigate', request);
return NavigateResponseSchema.parse(response.data);
```

#### 6.4 — Generate types from backend OpenAPI spec (stretch goal)

```bash
npm install -D openapi-typescript
```

Add script:
```json
{
  "scripts": {
    "generate:types": "npx openapi-typescript http://localhost:8000/openapi.json -o src/shared/api/generated.ts"
  }
}
```

### Acceptance Criteria
- [ ] API client retries on 5xx errors (up to 2 times with backoff)
- [ ] Every request includes `X-Request-ID` header
- [ ] Critical API responses validated with Zod at runtime
- [ ] Build still passes

---

## Phase 7: Observability

**Problem:** Errors go to `console.error` only. No error reporting, no performance tracing.

### Tasks

#### 7.1 — Add structured error boundary with reporting hook

Update `src/shared/ui/ErrorBoundary.tsx`:
```tsx
// Add onError callback prop that components can use to report
// In production, this would call Sentry/Datadog/etc.
// For now, create a pluggable reporter interface:

// src/shared/lib/errorReporter.ts
export interface ErrorReport {
  error: Error;
  componentStack?: string;
  context?: Record<string, unknown>;
  requestId?: string;
  timestamp: string;
}

type Reporter = (report: ErrorReport) => void;

let reporter: Reporter = (report) => {
  console.error('[ErrorReporter]', report);
};

export function setErrorReporter(fn: Reporter) { reporter = fn; }
export function reportError(report: ErrorReport) { reporter(report); }
```

Wire ErrorBoundary to call `reportError`.

#### 7.2 — Add API error reporting

In `src/shared/api/client.ts` response interceptor, call `reportError` with request ID context.

#### 7.3 — Add performance marks

```ts
// src/shared/lib/perf.ts
export function markNavigation(route: string) {
  performance.mark(`nav-start-${route}`);
  return () => {
    performance.mark(`nav-end-${route}`);
    performance.measure(`navigation-${route}`, `nav-start-${route}`, `nav-end-${route}`);
  };
}
```

Wire into route transitions.

#### 7.4 — Add feature flag skeleton

```ts
// src/shared/config/featureFlags.ts
const FLAGS = {
  enableWhatIf: true,
  enableDecoder: true,
  enableEmbeddings: true,
} as const;

export type FeatureFlag = keyof typeof FLAGS;
export function isEnabled(flag: FeatureFlag): boolean {
  return FLAGS[flag] ?? false;
}
```

Wrap optional features in flag checks so they can be disabled without deployment.

### Acceptance Criteria
- [ ] ErrorBoundary calls `reportError` with structured data
- [ ] API errors logged with request ID
- [ ] Feature flags exist for at least 3 features
- [ ] Performance marks fire on route transitions
- [ ] All error paths (API failure, component crash, missing data) are captured

---

## Phase Summary

| Phase | Effort | Impact | Dependency |
|-------|--------|--------|------------|
| 0: Unify apps | ~4h | High — eliminates maintenance drift | None |
| 1: FSD restructure | ~6h | High — enables all other phases | Phase 0 |
| 2: Testing | ~4h | Critical — highest gap vs. guides | Phase 1 |
| 3: Performance | ~2h | Medium — user-facing improvement | Phase 1 |
| 4: Lint & boundaries | ~3h | High — prevents regression | Phase 1 |
| 5: Design system | ~4h | Medium — accessibility + consistency | Phase 1 |
| 6: API hardening | ~3h | Medium — reliability + type safety | Phase 1 |
| 7: Observability | ~2h | Medium — production readiness | Phase 6 |

**Total estimated effort: ~28 hours**

**Critical path: Phase 0 → Phase 1 → (Phase 2 + Phase 3 + Phase 4 in parallel)**

Phases 5, 6, 7 can be done in any order after Phase 1.
