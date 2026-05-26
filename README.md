# Digital Assets Cross-Border

> Cross-border digital assets regulatory compliance analysis across EU (MiCA), UK, US, Switzerland, and Singapore.

**[Live Demo](https://digital-assets-cross-border.vercel.app)** | [Backend Repo](https://github.com/hossainpazooki/regulatory-ke-workbench)

![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![React](https://img.shields.io/badge/React-18.2-61dafb)
![Vite](https://img.shields.io/badge/Vite-5.1-646cff)

## Overview

[![Decision Canvas](docs/screenshot.png)](https://digital-assets-cross-border.vercel.app)

## Features

- **Multi-Jurisdiction Analysis** — Evaluate 5 regulatory frameworks simultaneously
- **Decision Tree Visualization** — Interactive SVG with pan/zoom, path highlighting
- **Trace Explorer** — Step-by-step evaluation audit trail with citations
- **Decision Decoder** — AI explanations anchored to canonical rule outcomes
- **What-If Analysis** — Counterfactual scenarios with diff overlay
- **Live Trading Session** — `/live/:intentId` route consumes a WebSocket from the platform-api backend; live Binance ticks → threshold crossings → Claude-streamed rationale gated by an NLI verifier
- **Retracted Rationale Queue** — Auditor surface listing rationales the NLI gate rolled back (`RetractedRationaleQueue` component, fed from the live-session store)
- **Playwright + axe E2E** — `/live/:intentId` covered by `e2e/live-session.spec.ts`, CI-triggered against Vercel previews

## Architecture

```mermaid
graph LR
    subgraph Frontend
        React[React 18] --> Zustand[Zustand State]
        React --> RQ[React Query]
        RQ --> API[API Client]
    end

    subgraph Backend
        FastAPI --> RuleEngine[Rule Engine]
        FastAPI --> Decoder[Decoder Service]
        RuleEngine --> DB[(PostgreSQL)]
    end

    API -->|REST| FastAPI
```

## Data Flow

```mermaid
sequenceDiagram
    User->>Frontend: Configure scenario
    Frontend->>Backend: POST /navigate
    Backend->>Backend: Evaluate rules per jurisdiction
    Backend-->>Frontend: Results + conflicts
    Frontend->>User: Display tree + trace

    User->>Frontend: Request explanation
    Frontend->>Backend: POST /decoder/explain
    Backend-->>Frontend: Tiered explanation + citations
```

## Quick Start

```bash
git clone https://github.com/hossainpazooki/digital-assets-cross-border.git
cd digital-assets-cross-border
npm install
npm run dev
```

Open [localhost:5173](http://localhost:5173). Works in demo mode without backend.

## Tech Stack

| Layer | Tech |
|-------|------|
| UI | React 18 + TypeScript |
| State | Zustand + React Query |
| Styling | Tailwind CSS |
| Visualization | Custom SVG (Reingold-Tilford) |
| Build | Vite 5 |

## Project Structure

```
src/
├── components/
│   ├── canvas/          # 3-panel workspace (Left/Center/Right Rail)
│   ├── decision-tree/   # SVG tree viewer + nodes + edges
│   └── trace-explorer/  # Evaluation trace display
├── lib/
│   ├── decisionTree/    # Pure functional rule evaluator
│   └── svg/             # Tree layout algorithm
├── rules/               # JSON rule definitions
├── hooks/               # Canvas state, tree highlighting
├── stores/              # Zustand stores
└── types/               # TypeScript definitions
```

## Decision Engine

Client-side Clojure-inspired rule evaluation:

```typescript
import { evaluateTree } from '@/lib/decisionTree';
import { MICA_STABLECOIN_RULE } from '@/rules';

const facts = {
  instrument: { type: 'stablecoin', reserve_value_eur: 1000000 },
  issuer: { type: 'credit_institution' }
};

const { leaf, trace } = evaluateTree(MICA_STABLECOIN_RULE.tree, facts);
// leaf.decision: "EMT by authorized institution: Notification required"
// trace: [{nodeId, condition, result, sourceRef}, ...]
```

**Node Types:**
- `ConditionNode` — Binary decision (true/false branches)
- `LeafNode` — Terminal outcome with obligations
- `GroupNode` — Collapsible jurisdiction module
- `RouterNode` — Parallel dispatch to subtrees

## Jurisdictions

| Code | Region | Authority | Framework |
|------|--------|-----------|-----------|
| EU | European Union | ESMA | MiCA 2023 |
| UK | United Kingdom | FCA | Crypto 2024 |
| US | United States | SEC/CFTC | Securities Act |
| CH | Switzerland | FINMA | DLT 2021 |
| SG | Singapore | MAS | PSA 2019 |

## Scripts

```bash
npm run dev        # Development server
npm run build      # Production build
npm run typecheck  # TypeScript check
npm run lint       # ESLint
```

## Environment

| Variable | Default |
|----------|---------|
| `VITE_API_URL` | `http://localhost:8000` |

## License

MIT

---

*Research project. Not legal advice.*
