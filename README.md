# COMPASS

> **C**ompliance **O**rchestration for **M**ulti-jurisdiction **P**athways **A**nd **S**treaming **S**urveillance.

A real-time navigator for cross-border digital-asset compliance that streams threshold-crossing risk indicators with NLI-verified rationale — across EU (MiCA), UK, US, Switzerland, and Singapore.

**[Live Demo](https://cross-border-compliance-navigator-sepia.vercel.app/)** · [Backend: regulatory-rule-engine](https://github.com/hossainpazooki/regulatory-rule-engine) · [Streaming contract](packages/contracts/README.md)

![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![React](https://img.shields.io/badge/React-18.2-61dafb)
![Vite](https://img.shields.io/badge/Vite-5.1-646cff)
![Tests](https://img.shields.io/badge/tests-Vitest%20%2B%20Playwright-brightgreen)

[![COMPASS](docs/screenshot.png)](https://cross-border-compliance-navigator-sepia.vercel.app/)

---

## What COMPASS is

COMPASS is the frontend for an institutional cross-border digital-asset compliance system. It combines two complementary capability stacks:

1. **Multi-jurisdiction analysis (REST).** A "Decision Canvas" workspace evaluates a trade or instrument scenario against five regulatory frameworks at once, using a client-side, Clojure-inspired rule evaluator over versioned decision trees, plus a conflict detector that reconciles divergent jurisdiction outcomes.
2. **Live streaming surveillance (WebSocket).** A "Live Trading Session" subscribes to a sequenced WebSocket feed of trade ticks, detects **threshold crossings** (the atomic unit of compliance: one citation, one snapshot, one verdict transition), and streams an LLM-generated **rationale that is gated by an NLI verifier** — each rationale transitions `streaming → verified | retracted` against an entailment score.

> The two stacks are currently independent surfaces bridged at the intent level; a unifying orchestration layer is on the roadmap.

---

## Features

- **Multi-jurisdiction analysis** — evaluate EU/UK/US/CH/SG frameworks simultaneously (`POST /navigate`).
- **Decision tree visualization** — interactive SVG (Reingold–Tilford layout) with pan/zoom and evaluation-path highlighting.
- **Client-side rule engine** — pure functional evaluator with full trace generation, fact-hash memoization, and partial (missing-fact) branch exploration.
- **Conflict detection** — finds classification / timeline / obligation conflicts across jurisdictions with resolution strategies (`satisfy_both`, `stricter`, `earliest`, `cumulative`).
- **Trace Explorer** — step-by-step evaluation audit trail with per-step actual-vs-expected values and citation links.
- **Decision Decoder** — tiered AI explanations (retail / protocol / institutional / regulator) of rule outcomes.
- **What-If analysis** — counterfactual scenarios (jurisdiction / entity / threshold / temporal) with a result + risk-delta diff.
- **Live Trading Session** — `/live/:intentId` consumes a WebSocket from the backend: live ticks → threshold crossings → Claude-streamed rationale gated by an NLI verifier, with monotonic-sequence gap recovery via audit replay.

---

## Architecture

```mermaid
graph LR
    subgraph Client["COMPASS frontend (Vite SPA today → Next 15 next)"]
        UI[React 18 UI] --> RQ[React Query / Zustand]
        UI --> WS[react-use-websocket]
        Contracts[["@platform/contracts<br/>(shared REST + WS types)"]]
    end

    subgraph Backend["regulatory-rule-engine (FastAPI)"]
        REST[REST: /navigate, /decoder,<br/>/counterfactual, /v2/intents, /audit]
        Stream[WS: /v2/ws/trade/:intentId]
        NLI[NLI gate → verified | retracted]
        Stream --> NLI
    end

    RQ -->|REST| REST
    WS -->|WebSocket| Stream
    Contracts -. types .- REST
    Contracts -. types .- Stream
    Contracts -. types .- MockWS[["tools/mock-ws<br/>(local fixture server)"]]
```

The shared **`@platform/contracts`** package is the single source of truth for both the REST and WebSocket message shapes, consumed by the app and by a local `mock-ws` fixture server so the live session runs without a real backend.

---

## The live threshold-rationale contract

Full detail in [`packages/contracts/README.md`](packages/contracts/README.md) and the spec [`dev/briefs/live-threshold-rationale-spec.md`](dev/briefs/live-threshold-rationale-spec.md). In brief:

**REST**
- `POST /v2/intents` — create a trade intent (server generates `intent_id`; unknown fields rejected). Returns `IntentRecord`.
- `GET /v2/intents/{id}` — fetch an intent.
- `GET /audit/{id}` — replay the full envelope history (used for sequence-gap recovery).

**WebSocket** — `/v2/ws/trade/{intent_id}`
- Every frame is a sequenced envelope: `{ seq, ts, type, payload }`, where `seq` is a server-side monotonic counter for ordering and gap detection.
- Nine message types: `subscribe`, `tick`, `risk_update`, `compliance`, `threshold`, `rationale_tok`, `rationale_verified`, `rationale_retracted`, `error`.
- **`ThresholdCrossing`** is the atomic unit: `{ rule_id, citation, boundary, direction, snapshot, prior_verdict → new_verdict }`.
- **Verdict** is tri-state: `compliant | conditional | blocked`.
- **Rationale** streams token-by-token (`rationale_tok`) then resolves to `verified` or `retracted` with a `final_score` (and a `retraction_reason` when retracted).
- Heartbeat is an **application-level text `ping`/`pong`** frame (not the WS protocol ping) — clients must not JSON-parse it.
- On a `seq` gap the client refetches `GET /audit/{id}` and replays missed envelopes.

---

## Monorepo layout

npm workspaces — `packages/*` and `tools/*`:

| Package | Path | Purpose |
|---|---|---|
| `compass` | `/` | The React SPA (this app). |
| `@platform/contracts` | `packages/contracts` | Shared TypeScript types + guards for the REST + WS protocol. |
| `@platform/mock-ws` | `tools/mock-ws` | Local WebSocket fixture server for the live session. |

### Project structure (feature-sliced design)

```
src/
├── app/             # App shell: App.tsx, layouts/, contexts/, reducers/, stores/
├── entities/        # Domain objects: instrument/, jurisdiction/, rule/  (model/)
├── features/        # Feature slices, each with api/ + model/ + ui/ (+ lib/ | data/)
│   ├── navigation/      # Multi-jurisdiction analysis (POST /navigate)
│   ├── decision-tree/   # Rule evaluator (lib/), conflict detector, SVG viewer, rule data/
│   ├── decoder/         # Tiered AI explanations
│   ├── counterfactual/  # What-If analysis
│   ├── trace-explorer/  # Evaluation trace stepper
│   ├── live-session/    # WebSocket streaming, threshold feed, NLI rationale
│   └── hitl-review/     # Human-in-the-loop review queue
├── pages/           # Route entry points (thin composition)
├── shared/          # ui/, api/, lib/, config/  (leaf layer)
├── hooks/           # Cross-cutting hooks (mostly re-exports of feature hooks)
└── types/           # Shared TypeScript definitions
```

Path aliases (from `vite.config.ts`): `@app`, `@pages`, `@features`, `@entities`, `@shared`.
Import direction: `app → pages → features → entities → shared`; `shared` imports nothing.

---

## Routes

| Route | Surface |
|---|---|
| `/` | Decision Canvas — default 3-panel workspace |
| `/live` | Live trading: intent-creation form |
| `/live/:intentId` | Live trading session (WebSocket) |
| `/legacy/*` | Legacy tab layout: Navigator, Pathway, Conflicts, What-If, Decoder, Logic |

---

## Quick start

```bash
git clone https://github.com/hossainpazooki/cross-border-compliance-navigator.git
cd cross-border-compliance-navigator
npm install

npm run dev        # web only, on http://localhost:5173
# — or —
npm run dev:all    # web + local mock-ws server together
```

Opens on [localhost:5173](http://localhost:5173). **Works in demo mode without a backend** — REST features fall back to bundled demo responses, and the live session can run against the local `mock-ws` server. Point `VITE_API_URL` / `VITE_WS_URL` at a real backend when available.

---

## Decision engine

Client-side, Clojure-inspired rule evaluation with full trace output:

```typescript
import { evaluateTree } from '@features/decision-tree';
import { MICA_STABLECOIN_RULE } from '@features/decision-tree/data';

const facts = {
  instrument: { type: 'stablecoin', reserve_value_eur: 1_000_000 },
  issuer: { type: 'credit_institution' },
};

const { leaf, trace } = evaluateTree(MICA_STABLECOIN_RULE.tree, facts);
// leaf.decision: "EMT by authorized institution: Notification required"
// trace: [{ nodeId, condition, result, sourceRef }, ...]
```

**Node types:** `ConditionNode` (binary branch) · `LeafNode` (terminal outcome + obligations) · `GroupNode` (collapsible jurisdiction module) · `RouterNode` (parallel dispatch).
**Operators:** `eq`, `neq`, `gt`, `lt`, `gte`, `lte`, `in`, `contains`, `matches`, `nil?`, `some?`.
**Rule data:** `mica-stablecoin.json`, `credit-decision.json` under `src/features/decision-tree/data/`.

---

## Jurisdictions

| Code | Region | Authority | Framework |
|------|--------|-----------|-----------|
| EU | European Union | ESMA | MiCA 2023 |
| UK | United Kingdom | FCA | Crypto 2024 |
| US | United States | SEC/CFTC | Securities Act |
| CH | Switzerland | FINMA | DLT 2021 |
| SG | Singapore | MAS | PSA 2019 |

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server (port 5173) |
| `npm run dev:all` | Web + `mock-ws` concurrently |
| `npm run mock-ws` | Local WebSocket fixture server only |
| `npm run build-fixtures` | Regenerate mock-ws fixtures |
| `npm run build` | Production build (`tsc && vite build`) |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint (zero warnings) |
| `npm run typecheck` | Typecheck the app **and** both workspaces |
| `npm test` | Run the test suite (Vitest) |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:coverage` | Coverage report |

---

## Testing

- **Unit / component** — Vitest + Testing Library, under `src/features/live-session/__tests__/` (`envelope-schema`, `store`, `RationaleStream`, `ThresholdFeed`, `useThresholdStream`).
- **End-to-end** — Playwright + axe at `e2e/live-session.spec.ts`, run against Vercel previews in CI.

```bash
npm test            # unit + component
npm run test:coverage
```

---

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_API_URL` | `http://localhost:8000` | REST base for `regulatory-rule-engine` (navigate, decoder, counterfactual, `/v2/intents`, `/audit`). |
| `VITE_WS_URL` | `ws://localhost:8787` (local `mock-ws`) | Live-session WebSocket base; the hook appends `/v2/ws/trade/{intent_id}`. In production, the same host as `VITE_API_URL` as `ws://`. Also honors `NEXT_PUBLIC_WS_BASE_URL` (future Next build). |
| `VITE_DEBUG` | `false` | Enable debug logging. |

---

## Roadmap — Next 15 migration (Phase C1)

The current build is **Vite** (`vite.config.ts` + `vercel.json`, `framework: "vite"`). A `next.config.mjs` is checked in but **inert** — there is no `next` dependency yet. It activates once the **Vite → Next 15 migration (Phase C1)** lands, at which point Vercel edge rewrites proxy `/v2/ws`, `/v2`, `/api`, `/audit`, `/decide`, and `/credit` **same-origin** to the backend (EKS ALB), removing the CORS hop on production paths. This README is structured to absorb that migration without a rewrite — the architecture, contract, and route docs above stay valid across the cutover. See [`docs/unified-plan.md`](docs/unified-plan.md) for the migration record and proxied-path table.

---

## Naming

The product brand is **COMPASS**. Earlier surfaces used "Compliance Navigator", "Digital Assets Cross-Border", and "Droit for DeFi v3"; these are superseded. The GitHub repo slug and Vercel alias still embed the former name (`cross-border-compliance-navigator`) — renaming those is a separate infrastructure step.

## License

MIT

---

*Research / demo project. Not legal advice. Consult qualified counsel.*
