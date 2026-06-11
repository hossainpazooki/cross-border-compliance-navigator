# COMPASS

> **C**ompliance **O**rchestration for **M**ulti-jurisdiction **P**athways **A**nd **S**treaming **S**urveillance.

A real-time navigator for cross-border digital-asset compliance that streams threshold-crossing risk indicators with NLI-verified rationale — across EU (MiCA), UK, US, Switzerland, and Singapore. The live session is now coordinated by a small **org of specialist agents** (a Paperclip-style org chart) **while the deterministic engine and NLI gate remain ground truth**.

**[Live Demo](https://cross-border-compliance-navigator-sepia.vercel.app/)** · [Streaming contract](packages/contracts/README.md) · local deployment: `npm run dev:all` (self-contained — see [Quick start](#quick-start))

![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![React](https://img.shields.io/badge/React-18.2-61dafb)
![Vite](https://img.shields.io/badge/Vite-5.1-646cff)
![Tests](https://img.shields.io/badge/tests-Vitest%20%2B%20Playwright-brightgreen)

[![COMPASS](docs/screenshot.png)](https://cross-border-compliance-navigator-sepia.vercel.app/)

---

## What COMPASS is

COMPASS is the frontend for an institutional cross-border digital-asset compliance system. It combines two complementary capability stacks:

1. **Multi-jurisdiction analysis (REST).** A "Decision Canvas" workspace evaluates a trade or instrument scenario against five regulatory frameworks at once, using a client-side, Clojure-inspired rule evaluator over versioned decision trees, plus a conflict detector that reconciles divergent jurisdiction outcomes.
2. **Live streaming surveillance (WebSocket).** A "Live Trading Session" subscribes to a sequenced WebSocket feed of trade ticks, detects **threshold crossings** (the atomic unit of compliance: one citation, one snapshot, one verdict transition), and streams an LLM-generated **rationale gated by an NLI verifier** — each rationale transitions `streaming → verified | retracted` against an entailment score.

The non-deterministic judgment in stack 2 — interpreting a crossing, resolving jurisdiction conflicts, drafting rationale, assessing run-time risk — is performed by an **org of specialist agents**. The deterministic engine verifies; the human is the apex (the board). See [Agent org model](#agent-org-model--paperclip-style-orchestration).

---

## Features

- **Multi-jurisdiction analysis** — evaluate EU/UK/US/CH/SG frameworks simultaneously (`POST /navigate`).
- **Decision tree visualization** — interactive SVG (Reingold–Tilford layout) with pan/zoom and evaluation-path highlighting.
- **Client-side rule engine** — pure functional evaluator with full trace generation, fact-hash memoization, and partial (missing-fact) branch exploration.
- **Conflict detection** — finds classification / timeline / obligation conflicts across jurisdictions with resolution strategies (`satisfy_both`, `stricter`, `earliest`, `cumulative`, `home_jurisdiction`).
- **Trace Explorer** — step-by-step evaluation audit trail with per-step actual-vs-expected values and citation links.
- **Decision Decoder** — tiered AI explanations (retail / protocol / institutional / regulator) of rule outcomes.
- **What-If analysis** — counterfactual scenarios (jurisdiction / entity / threshold / temporal) with a result + risk-delta diff.
- **Live Trading Session** — `/live/:intentId` consumes a WebSocket from the backend: live ticks → threshold crossings → Claude-streamed rationale gated by an NLI verifier, with monotonic-sequence gap recovery via audit replay.
- **Agent org model** — a crossing routes to exactly one orchestrating lead, which collects specialist drafts; an independent auditor grounds them; the board view shows draft + ≤2 lead positions + N auditor findings. **Implemented and tested.**

---

## Agent org model — Paperclip-style orchestration

The live session's judgment work is organized as an **org with delegation and governance**, modeled on the Paperclip org/governance pattern. Eight agents across one management layer plus leaves do the irreducibly non-deterministic work; the deterministic primitives (`evaluateTree`, `detectConflicts`, the NLI gate, `sourceRef` citations) stay **tools, not agents**.

> **The agents do judgment. The engine verifies. The human is the apex.** There is no coordinator/CEO agent — the human holds the apex via board approval gates (Go Live, conflict sign-off).

### Org topology

```
                        [ HUMAN — board / apex ]
              approval gates: Go Live · conflict sign-off · hires
        ┌───────────────────────┼────────────────────────┐
        │                       │               ┌─────────┴─────────┐
 ┌──────┴───────┐      ┌────────┴───────┐       │   AUDITOR         │
 │ Lead          │     │ Lead Risk      │       │  (advisory,       │
 │ Compliance    │     │ Officer        │       │  independent line │
 │ Officer (LCO) │     │ (LRO)          │       │  to the board)    │
 └──────┬───────┘      └────────┬───────┘       └───────────────────┘
        └───────────┬────────────┘
            ┌────────┼────────┬────────┬────────┐
          ┌─┴─┐    ┌─┴─┐    ┌─┴─┐    ┌─┴─┐    ┌─┴─┐
          │EU │    │UK │    │US │    │CH │    │SG │   ← jurisdiction specialists
          └───┘    └───┘    └───┘    └───┘    └───┘     grounded in own rule subtrees

  Tools (NOT agents): evaluateTree / evaluatePartial · detectConflicts /
  mergeObligations · the NLI gate · sourceRef citations.
```

| Agent | Count | Role |
|---|---|---|
| **Jurisdiction specialist** | 5 | EU/MiCA, UK/FCA, US/SEC-CFTC, CH/FINMA, SG/MAS. Scoped to its own rule subtree; may only cite `sourceRef`s drawn from that subtree (the pre-grounding that gives the NLI gate concrete ground truth per agent). Produces the shared rationale draft when tasked. |
| **Lead Compliance Officer (LCO)** | 1 | Orchestrates specialists for compliance-type crossings; owns conflict resolution (`detectConflicts` / `mergeObligations`) and obligation synthesis. |
| **Lead Risk Officer (LRO)** | 1 | Orchestrates specialists for risk-type crossings; owns run-time risk judgment (VaR, slippage, escalation) over the live snapshot. |
| **Auditor** | 1 | Reports directly to the board, not to the leads (audit independence). Two-tiered: a deterministic grounding pass (free) and an advisory LLM challenge pass (judgment). |

### The orchestration invariant

**One crossing → one orchestrator → one draft → two lead positions → N auditor findings.**

The orchestrator is selected per crossing by the originating `rule_id` — a pure, total lookup in [`orchestratorRouting.ts`](src/features/live-session/orchestratorRouting.ts):

```typescript
import { orchestratorFor } from '@features/live-session/orchestratorRouting';

orchestratorFor('MICA_ART_5_1');   // 'compliance'  — obligation / whitepaper / authorization
orchestratorFor('RISK_VAR_95');    // 'risk'        — RISK_ namespace → run-time breach
orchestratorFor('UNKNOWN_RULE');   // 'compliance'  — safer default: a missed obligation
                                   //                 is worse than a missed risk flag
```

A **dual-implicated crossing** (a notional breach that trips both a MiCA obligation and a VaR limit) is resolved here, deterministically, by its originating `rule_id` — the other lead's concern surfaces as its *consuming* position, never as a competing draft, and the runtime is never asked "which lead?". The invariant is absolute: there is **never** more than one orchestrator or one draft per crossing.

### Data flow & control-flow rule

```
threshold crossing (heartbeat)
     │ route by rule_id → exactly ONE orchestrating lead
     ▼
 orchestrating lead tasks jurisdiction specialist(s)
     ▼
 specialist(s) draft → Rationale  (shared substrate: content + sourceRef,
     │                             keyed by crossing_id — existing store shape)
     ▼
 Auditor deterministic pass: is each cited sourceRef present in the evaluateTree trace?
     │
     ├─ FAIL → rationale_retracted   (existing NLI path; RetractedRationaleQueue renders it)
     │         draft dies here — NO lead position is ever spent on an ungrounded draft
     │
     └─ PASS → rationale_verified  ── wakes the leads ──┐
                                                        ▼
              orchestrating lead finalizes its position; the other lead
              consumes the verified draft and adds its consuming position
                                  ▼
              Auditor advisory pass (LLM): challenge LCO conflict strategy /
              LRO escalation → AuditorFinding (flag only, never blocks)
                                  ▼
              Board view: draft + ≤2 lead positions + N auditor findings
```

**Control-flow rule (enforced in the store reducer):** leads wake on **`rationale_verified`**, not on the raw crossing. A retracted (ungrounded) draft therefore never reaches the leads — judgment is only ever spent on grounded claims. A `lead_position` envelope arriving for a crossing whose rationale is not `verified` (still streaming, or retracted) is **dropped** by the store guard, on both the live and replay paths.

### Artifact model

| Artifact | Shape | Notes |
|---|---|---|
| **`Rationale`** | `{ crossing_id, content, sourceRef, status }` | The shared draft (existing, unchanged). Keyed by `crossing_id`. |
| **`LeadPosition`** *(new)* | `{ crossing_id, lead: 'compliance' \| 'risk', stance, basis }` | At most two per crossing. Compliance `stance` reuses the `ConflictResolution` union (`satisfy_both` / `stricter` / `earliest` / `cumulative` / `home_jurisdiction`); risk `stance` is `escalate` / `hold`. |
| **`AuditorFinding`** *(new)* | `{ crossing_id, target: 'rationale' \| 'lead_position', verdict, basis }` | `target: 'rationale'` findings **are** the NLI gate (a fail emits `rationale_retracted`). `target: 'lead_position'` findings are **advisory** — they flag in the auditor UI but never block, and render visually distinct from retractions so "ungrounded claim" is never conflated with "debatable judgment". |

Both new artifacts ride the **existing WS envelope union** as two new `type`s (`lead_position`, `auditor_finding`). Being `crossing_id`-keyed, they reconstruct from `replayAuditEnvelopes` alongside rationales — no separate channel, no out-of-band state.

### Paperclip mapping

| Paperclip concept | COMPASS realization |
|---|---|
| Heartbeat | Threshold crossing wakes the routed orchestrating lead |
| Org chart / reporting lines | Leads → specialists; Auditor → board (independent) |
| Delegation down the chart | Lead tasks specialists, collects, synthesizes |
| Governance / approval gate | Human board gates: Go Live, conflict sign-off |
| Immutable audit log | `RetractedRationaleQueue` + `AdvisoryFlagQueue` (AuditorFinding stream) |
| Ground truth / verification | `evaluateTree` trace + `sourceRef` + NLI gate (tools, not agents) |

### Cost & governance controls

- **Tiered auditor.** The deterministic grounding check ("is this cited `sourceRef` in the trace?") is a free lookup against `evaluateTree`'s output and catches most ungrounded claims before any LLM challenge is spent. LLM challenge runs only on lead judgment calls.
- **Retract-before-judge.** Because leads wake on `rationale_verified`, ungrounded drafts are killed at the gate before expensive lead-level judgment is incurred.
- **Lazy wake.** A single-jurisdiction scenario wakes only the implicated specialist and the one routed lead; the non-orchestrating lead consumes only if it has a position to add.
- **Advisory auditor.** Findings on lead judgments flag to the board but do not block — keeping the org at one management layer (a blocking auditor would become a de-facto second tier).

### Implementation status

| Capability | State |
|---|---|
| `rule_id` → orchestrating-lead routing (incl. dual-implicated → single orchestrator) | ✅ `orchestratorRouting.ts` (tested) |
| `LeadPosition` / `AuditorFinding` / `ConflictResolution` contract types | ✅ `@platform/contracts` |
| Two new WS envelope types + runtime guards (`isWSEnvelope`) | ✅ `lead_position`, `auditor_finding` (tested) |
| Store reducer: wake-on-verified guard, ≤2-positions invariant, append-only findings | ✅ `live-session/store.ts` (tested) |
| Replay reconstructs positions + findings from the envelope stream | ✅ `replayAuditEnvelopes` (tested) |
| Selectors: per-crossing positions/findings + session-wide advisory feed | ✅ `live-session/selectors.ts` |
| "Org" panel — draft + ≤2 lead positions + findings, retraction vs. flag distinct | ✅ `ui/OrgPanel.tsx` (tested), wired into `LiveSession.tsx` |
| Session-wide advisory-flag queue (sibling to the retracted-rationale queue) | ✅ `ui/AdvisoryFlagQueue.tsx` |
| Backend agent runtime (specialist/lead/auditor LLM agents) | 🔶 future backend work; frontend coordinates, runtime lives backend-side (see Roadmap) |

> **Honest status.** The frontend coordination layer — routing, contracts, envelope guards, the store invariants, replay, selectors, and the Org/advisory UI — is **implemented and covered by tests** (`OrgPanel.test.tsx`, `envelope-guards.test.ts`, and the agent-org additions to `store.test.ts`). The LLM agent *runtime* (specialists, leads, auditor) is future backend work; COMPASS consumes its `lead_position` / `auditor_finding` envelopes over the existing contract. The reference backend emits the full envelope union so the Org panel runs end-to-end locally, with citations grounded in real `evaluateTree` traces.

---

## Architecture

```
┌────────────────────────── COMPASS frontend (Vite SPA today → Next 15 next) ──────────────────────────┐
│                                                                                                       │
│   React 18 UI ──▶ React Query / Zustand ──REST──┐         ┌── @platform/contracts ──┐                │
│        │                                         │         │  shared REST + WS types │                │
│        └────────▶ react-use-websocket ──WS───┐   │         │  + runtime guards       │                │
│                                              │   │         └──────────┬──────────────┘                │
└──────────────────────────────────────────────┼───┼────────────────────┼───────────────────────────────┘
                                               │   │                    │ types
                          WebSocket            │   │ REST               │
                                               ▼   ▼                    ▼
┌──────── tools/reference-backend (the local deployment) ──────────┐   ┌── future backend ──┐
│  REST:  /v2/intents · /audit/:id · /health                        │   │  ke-workbench      │
│  WS:    /v2/ws/trade/:intentId — full envelope union, incl.       │   │  Gate-5 serve      │
│         lead_position / auditor_finding (org types)               │   │  (Rust); gated on  │
│  Fixtures derived through @platform/engine (grounding-gated)      │   │  passing the       │
│  NLI gate → rationale_verified | rationale_retracted (scripted)   │   │  conformance suite │
└───────────────────────────────────────────────────────────────────┘   └────────────────────┘
```

The shared **`@platform/contracts`** package is the single source of truth for both the REST and WebSocket message shapes, consumed by the app and by the **`@platform/reference-backend`** server so the live session — and the agent org — run as a fully local deployment. **`@platform/engine`** owns the decision-tree evaluator and rule data, shared by the app (client-side evaluation) and the backend (fixture grounding).

---

## The live threshold-rationale contract

Full detail in [`packages/contracts/README.md`](packages/contracts/README.md) and the spec [`dev/briefs/live-threshold-rationale-spec.md`](dev/briefs/live-threshold-rationale-spec.md). In brief:

**REST**
- `POST /v2/intents` — create a trade intent (server generates `intent_id`; unknown fields rejected). Returns `IntentRecord`.
- `GET /v2/intents/{id}` — fetch an intent.
- `GET /audit/{id}` — replay the full envelope history (used for sequence-gap recovery **and** to reconstruct lead positions + auditor findings).

**WebSocket** — `/v2/ws/trade/{intent_id}`
- Every frame is a sequenced envelope: `{ seq, ts, type, payload }`, where `seq` is a server-side monotonic counter for ordering and gap detection.
- **Eleven** message types: `subscribe`, `tick`, `risk_update`, `compliance`, `threshold`, `rationale_tok`, `rationale_verified`, `rationale_retracted`, **`lead_position`**, **`auditor_finding`**, `error`.
- **`ThresholdCrossing`** is the atomic unit: `{ rule_id, citation, boundary, direction, snapshot, prior_verdict → new_verdict }`.
- **Verdict** is tri-state: `compliant | conditional | blocked`.
- **Rationale** streams token-by-token (`rationale_tok`) then resolves to `verified` or `retracted` with a `final_score` (and a `reason` when retracted).
- **`lead_position`** / **`auditor_finding`** carry the agent-org artifacts; both are `crossing_id`-keyed and survive audit replay. Guards reject cross-typed stances (a compliance lead carrying a risk stance, and vice-versa).
- Heartbeat is an **application-level text `ping`/`pong`** frame (not the WS protocol ping) — clients must not JSON-parse it.
- On a `seq` gap the client refetches `GET /audit/{id}` and replays missed envelopes.

---

## Monorepo layout

npm workspaces — `packages/*` and `tools/*`:

| Package | Path | Purpose |
|---|---|---|
| `compass` | `/` | The React SPA (this app). |
| `@platform/contracts` | `packages/contracts` | Shared TypeScript types + guards for the REST + WS protocol. |
| `@platform/engine` | `packages/engine` | The decision engine (`evaluateTree`, `detectConflicts`), decision-tree types, and bundled rule data. Unit-tested. |
| `@platform/reference-backend` | `tools/reference-backend` | Reference implementation of the REST + WS contract (formerly `mock-ws`); drives the local deployment. Its conformance suite is the executable contract. |

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
│   ├── live-session/    # WebSocket streaming, threshold feed, NLI rationale,
│   │                    #   agent-org routing (orchestratorRouting.ts) + Org/advisory UI
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
| `/live/:intentId` | Live trading session (WebSocket) — includes the **Org panel** |
| `/legacy/*` | Legacy tab layout: Navigator, Pathway, Conflicts, What-If, Decoder, Logic |

---

## Quick start

```bash
git clone https://github.com/hossainpazooki/cross-border-compliance-navigator.git
cd cross-border-compliance-navigator
npm install

npm run dev        # web only, on http://localhost:5173
# — or —
npm run dev:all    # THE local deployment: web + reference backend together
```

Opens on [localhost:5173](http://localhost:5173). **The monorepo is its own deployment** — no external services: REST analysis features fall back to bundled demo responses (or run client-side via `@platform/engine`), and the live session (with the Org panel) runs against the local reference backend, which implements the full contract — intent lifecycle, audit replay, and the complete envelope union including `lead_position` and `auditor_finding`. Its fixtures are derived through the real engine, so streamed citations are grounded in actual `evaluateTree` traces. Point `VITE_API_URL` / `VITE_WS_URL` at a remote backend only when one exists — it must pass the conformance suite first.

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

The `trace`'s `sourceRef`s are exactly what the auditor's deterministic grounding pass checks each rationale's citations against — the engine is the agent org's ground truth.

**Node types:** `ConditionNode` (binary branch) · `LeafNode` (terminal outcome + obligations) · `GroupNode` (collapsible jurisdiction module) · `RouterNode` (parallel dispatch).
**Operators:** `eq`, `neq`, `gt`, `lt`, `gte`, `lte`, `in`, `contains`, `matches`, `nil?`, `some?`.
**Rule data:** `mica-stablecoin.json`, `credit-decision.json` under `src/features/decision-tree/data/`.

---

## Jurisdictions

| Code | Region | Authority | Framework | Specialist agent |
|------|--------|-----------|-----------|------------------|
| EU | European Union | ESMA | MiCA 2023 | EU/MiCA |
| UK | United Kingdom | FCA | Crypto 2024 | UK/FCA |
| US | United States | SEC/CFTC | Securities Act | US/SEC-CFTC |
| CH | Switzerland | FINMA | DLT 2021 | CH/FINMA |
| SG | Singapore | MAS | PSA 2019 | SG/MAS |

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server (port 5173) |
| `npm run dev:all` | Local deployment: web + reference backend concurrently |
| `npm run backend` | Reference backend only (REST + WS on :8787) |
| `npm run mock-ws` | Deprecated alias for `npm run backend` |
| `npm run build-fixtures` | Regenerate fixtures through `@platform/engine` (grounding-gated) |
| `npm run build` | Production build (`tsc && vite build`) |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint (zero warnings) |
| `npm run typecheck` | Typecheck the app **and** both workspaces |
| `npm test` | Run the test suite (Vitest) |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:coverage` | Coverage report |

---

## Testing

- **Engine unit tests** — `packages/engine/src/__tests__/` (`evaluator.test.ts`, `conflicts.test.ts`): operators, tracing, the fact-hash cache, partial evaluation, conflict detection.
- **Contract conformance** — `tools/reference-backend/src/__tests__/conformance.test.ts`: boots the reference backend on an ephemeral port and asserts the executable contract (intent lifecycle, audit replay validity, envelope stream guards + monotonic `seq`, text-frame heartbeat, stream ≡ replay). Any future real backend must pass it.
- **Unit / component** — Vitest + Testing Library, under `src/features/live-session/__tests__/`:
  - `store.test.ts` — reducer, sequence-gap detection, replay, and the **agent-org invariants** (routing, wake-on-verified, ≤2 lead positions, replay reconstruction).
  - `envelope-guards.test.ts` — `isWSEnvelope` / `isMessageType` coverage for `lead_position` + `auditor_finding`, including cross-typed-stance rejection.
  - `OrgPanel.test.tsx` — idle state, both lead positions under a verified crossing, advisory-vs-retraction distinction, and zero positions for a retracted crossing.
  - plus `envelope-schema`, `RationaleStream`, `ThresholdFeed`, `useThresholdStream`.
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
| `VITE_WS_URL` | `ws://localhost:8787` (local reference backend) | Live-session WebSocket base; the hook appends `/v2/ws/trade/{intent_id}`. In production, the same host as `VITE_API_URL` as `ws://`. Also honors `NEXT_PUBLIC_WS_BASE_URL` (future Next build). |
| `VITE_DEBUG` | `false` | Enable debug logging. |

---

## Roadmap

- **Backend agent runtime.** The specialist / lead / auditor LLM agents are future backend work, mirroring `orchestratorRouting.ts`'s `rule_id` table so frontend routing and backend tasking never diverge. COMPASS already consumes their `lead_position` / `auditor_finding` envelopes; the reference backend emits engine-grounded examples today. The strategic production host is ke-workbench's Gate-5 `ke-cli serve` (the `regulatory-rule-engine` repo, now a Rust workspace) — whatever serves it must pass the conformance suite in `tools/reference-backend/src/__tests__/`.
- **`rule_id` classification table.** Pin the concrete compliance-vs-risk `rule_id`s (the `RISK_` namespace is reserved; the explicit compliance ids are seeded from fixtures).
- **Next 15 migration (Phase C1).** The current build is **Vite** (`vite.config.ts` + `vercel.json`, `framework: "vite"`); a `next.config.mjs` is checked in but **inert** (no `next` dependency yet). It activates at the cutover, when Vercel edge rewrites proxy `/v2/ws`, `/v2`, `/api`, `/audit`, `/decide`, and `/credit` **same-origin** to the backend (EKS ALB), removing the CORS hop. This README is structured to absorb that migration without a rewrite. See [`docs/unified-plan.md`](docs/unified-plan.md).

---

## Naming

The product brand is **COMPASS**. Earlier surfaces used "Compliance Navigator", "Digital Assets Cross-Border", and "Droit for DeFi v3"; these are superseded. The GitHub repo slug and Vercel alias still embed the former name (`cross-border-compliance-navigator`) — renaming those is a separate infrastructure step.

## License

MIT

---

*Research / demo project. Not legal advice. Consult qualified counsel.*
