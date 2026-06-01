# Live Threshold-Rationale Spec

**Status:** reconstructed from the implemented `@platform/contracts` package — the canonical runtime contract the frontend ships against. This documents what the code actually implements and validates (`isWSEnvelope`, the type guards, the live-session hook). The upstream source of truth is the Pydantic model set in the **`regulatory-rule-engine`** backend (migration in progress; in-code `// SOURCE:` comments still reference the former `institutional-defi-platform-api/src/market_risk/...` module paths and will be swept separately).

Section numbers (§2–§9) are stable anchors referenced from the `// SOURCE:` comments in `packages/contracts/src/*`.

---

## §1 Overview

The live threshold-rationale feature streams a single trade intent's lifecycle from the backend to the browser and renders compliance verdicts with AI rationale in real time. The flow:

```
client creates intent (REST) → opens WS for intent → server streams ticks
  → detects threshold crossings → emits verdict transition
  → streams LLM rationale token-by-token → NLI gate verifies or retracts it
```

Two backend surfaces, **separate origins** in production:
- **REST** (`VITE_API_URL`, default `http://localhost:8000`) — intent lifecycle + audit replay.
- **WebSocket** (`VITE_WS_URL` / `NEXT_PUBLIC_WS_BASE_URL`, default local mock-ws `ws://localhost:8787`) — the streaming protocol.

Implemented in `packages/contracts/src/*` (types + guards) and `src/features/live-session/*` (hook, store, UI).

---

## §2 Data model

| Entity | Identity | Lifecycle |
|---|---|---|
| **IntentRecord** | `intent_id` (server-generated) | `created → active → closed \| failed` |
| **TradeSnapshot** | `intent_id` + `ts` | emitted per `tick` |
| **ThresholdCrossing** | `crossing_id` | one per boundary crossing; carries a verdict transition |
| **Rationale** | `rationale_id`, keyed in the store by `crossing_id` | `streaming → verified \| retracted` |
| **Verdict** | — | `compliant \| conditional \| blocked` |

The frontend session store (`src/features/live-session/store.ts`) holds one `SessionState` per intent: `{ intent, currentVerdict, latestSnapshot, crossings[], rationales (by crossing_id), connection, lastSeq, lastError }`.

---

## §3 Data shapes — TradeSnapshot

`packages/contracts/src/snapshot.ts`. Decimal fields are serialized as **JSON strings** to preserve precision; `ts` is ISO-8601; `funding_rate` is nullable.

```ts
interface TradeSnapshot {
  intent_id: string;
  ts: string;            // ISO-8601
  mark_price: string;    // decimal-as-string
  bid: string;           // decimal-as-string
  ask: string;           // decimal-as-string
  size: string;          // decimal-as-string
  spread_bps: number;
  slippage_bps: number;
  vol_30d: number;
  var_95_usd: number;
  funding_rate: number | null;
}
```

`isTradeSnapshot` enforces exactly these types (decimals must be strings; `funding_rate` is `null` or a finite number).

---

## §4 Detection — ThresholdCrossing

`packages/contracts/src/crossing.ts`. **The atomic unit of compliance: exactly one citation, one snapshot, one verdict transition.**

```ts
interface ThresholdCrossing {
  crossing_id: string;
  intent_id: string;
  ts: string;
  rule_id: string;
  citation: string;
  boundary: string;
  direction: 'crossed_up' | 'crossed_down';
  snapshot: TradeSnapshot;
  prior_verdict: Verdict;
  new_verdict: Verdict;
}
```

The backend detects when a snapshot crosses a rule `boundary` and emits a crossing pinned to the `snapshot` that triggered it, with the resulting `prior_verdict → new_verdict` transition.

---

## §5 Verdict integration

`packages/contracts/src/verdict.ts`. Tri-state:

```ts
type Verdict = 'compliant' | 'conditional' | 'blocked';
```

The closest existing backend enum is `JurisdictionStatus` (`compliance / blocked / requires_action`); the live-session surface uses the `Verdict` tri-state directly. A crossing's `new_verdict` becomes the session's `currentVerdict`.

---

## §6 Rationale streaming (NLI gate)

`packages/contracts/src/rationale.ts`. A three-state lifecycle:

```ts
type NLIStatus = 'streaming' | 'verified' | 'retracted';

interface Rationale {
  rationale_id: string;
  crossing_id: string;
  content: string;            // accumulated from rationale_tok tokens
  status: NLIStatus;
  final_score?: number;       // set only on verified | retracted
  retraction_reason?: string; // set only on retracted
  completed_at?: string;
}
```

The LLM rationale for a crossing streams token-by-token (`rationale_tok`). An **NLI (natural-language-inference) gate** scores the completed rationale's entailment against the crossing's evidence:
- entailment passes → `rationale_verified` with `final_score`;
- entailment fails (score below threshold) → `rationale_retracted` with `final_score` + `reason`.

The store assembles `content` by appending tokens keyed on `crossing_id`, so a verdict and its rationale stay co-located.

---

## §7 WebSocket protocol

`packages/contracts/src/envelope.ts`. Route: **`/v2/ws/trade/{intent_id}`**.

Every frame is a **sequenced envelope**:

```ts
type WSEnvelope<M> = M & { seq: number; ts: string };  // ts ISO-8601
```

`seq` is a server-side **monotonic counter per session**; clients use it for ordering and gap detection.

**Message types** (`MessageType`, 9 total):

| `type` | Direction | Payload |
|---|---|---|
| `subscribe` | client → server | `{ intent_id }` |
| `tick` | server → client | `TradeSnapshot` |
| `risk_update` | server → client | open `Record<string, unknown>` |
| `compliance` | server → client | `{ crossing_id, prior_verdict, new_verdict, citation }` |
| `threshold` | server → client | `ThresholdCrossing` |
| `rationale_tok` | server → client | `{ rationale_id, crossing_id, token }` |
| `rationale_verified` | server → client | `{ rationale_id, crossing_id, final_score }` |
| `rationale_retracted` | server → client | `{ rationale_id, crossing_id, final_score, reason }` |
| `error` | server → client | `{ code, message }` |

> **Divergence note:** rationale payloads carry **both** `rationale_id` and `crossing_id` so the client can route tokens to a crossing in O(1). The original §7 table listed only `rationale_id`; the §9 store keys rationales by `crossing_id`, so the implemented contract adds it.

**Validation:** `isWSEnvelope(v)` checks `seq`/`ts`/`type`/`payload`, then deep-validates the payload per `type`. `ServerEnvelope` excludes the client→server `subscribe` type.

**Heartbeat (application-level, NOT the WS protocol ping):** the server sends a bare text frame `"ping"`; the client must reply with a text `"pong"` within `WS_PONG_TIMEOUT_SECONDS` or the server closes with `ws_idle_timeout`. The `"ping"` frame is **not** JSON — clients must not parse it as an envelope (`useThresholdStream.ts:137`).

**Sequence-gap recovery:** when `applyEnvelope` reports a `seq` gap, the client refetches **`GET /audit/{intent_id}`** (REST) and replays the full envelope history through `replayAuditEnvelopes` (`useThresholdStream.ts:72`).

**Reconnect:** backoff `[1, 2, 4, 8, 16]` seconds. Error codes that stop reconnect (the backend will refuse a fresh attempt with the same `intent_id`): `intent_terminal`. A client-side 30s idle watchdog flags the connection `error` if no frame arrives.

**WS error codes** (`src/features/live-session/types.ts`, emitted by the backend `ws_handler.py`):
`ws_idle_timeout` · `intent_terminal` (terminal — no reconnect) · `session_provider_failed` · `ws_task_error`. The mock-ws server also emits an ad-hoc `fixture_load_failed`. (These live in the consumer, not `@platform/contracts`; promoting a shared `WSErrorCode` into the package is a tracked follow-up.)

---

## §8 REST surface (intents + audit)

`src/features/live-session/api/intentsApi.ts`. Base = `VITE_API_URL` (default `http://localhost:8000`).

| Method + path | Body | Returns | Notes |
|---|---|---|---|
| `POST /v2/intents` | `IntentCreateRequest` | `IntentRecord` | Server generates `intent_id`; rejects a client-supplied one. Pydantic `extra="forbid"` → `422` on unknown fields. |
| `GET /v2/intents/{id}` | — | `IntentRecord` | — |
| `GET /audit/{id}` | — | `ServerEnvelope[]` | Envelope replay for sequence-gap recovery (§7). |

`IntentCreateRequest`: `{ direction: 'buy'|'sell', asset, notional_usd (string), venue_jurisdiction, investor_type: 'retail'|'professional'|'eligible_counterparty', target_jurisdictions: string[], holding_period_days: number }`.

> A legacy `POST /intent` (client-supplied id, used by `GoLiveButton`) and a legacy mock-ws `?intent_id=` query WS form also exist; `/v2/*` is canonical, the legacy forms are dev/back-compat only.

---

## §9 Frontend store

`src/features/live-session/store.ts` + `selectors.ts`. A Zustand store keyed by `intent_id`:
- `applyEnvelope(intentId, envelope)` — reduces each envelope into `SessionState`, returns `{ gap }` when `envelope.seq` skips ahead of `lastSeq`.
- `replayAuditEnvelopes(intentId, envelopes)` — rehydrates from an audit fetch (§7 gap recovery).
- Rationales are stored as `Record<crossing_id, Rationale>`; `rationale_tok` appends to `content`, `rationale_verified`/`rationale_retracted` finalize `status` + `final_score`.
- Selectors derive the threshold feed and the retracted-rationale list (`status === 'retracted'`, newest first).

---

## Provenance

This file documents the **implemented** contract. When the `regulatory-rule-engine` backend Pydantic models land, regenerate types via `openapi-typescript` (see `packages/contracts/README.md`) and reconcile this spec against them, then update the `// SOURCE:` comments to the new repo/module paths.
