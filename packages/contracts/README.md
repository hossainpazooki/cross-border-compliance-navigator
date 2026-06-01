# @platform/contracts

Shared TypeScript types and runtime guards for the live threshold-rationale REST + WebSocket protocol. Type-only package (no runtime deps); the only runtime code is the envelope guards.

## Source of truth

These types are **spec-derived and hand-written ahead of the backend** — most shapes are marked *pending backend implementation*. They mirror the Pydantic models in the **`regulatory-rule-engine`** backend (rename/migration in progress; in-code `// SOURCE:` comments still cite the former `institutional-defi-platform-api/src/market_risk/...` module paths and will be swept when the backend rename lands). Each interface carries a `// SOURCE:` comment naming the canonical Pydantic class.

Spec (in-repo): [`dev/briefs/live-threshold-rationale-spec.md`](../../dev/briefs/live-threshold-rationale-spec.md) — §2 data model, §3 data shapes, §4 detection, §5 verdict, §6 rationale streaming, §7 WebSocket protocol, §8 REST surface, §9 frontend store.

## What's here

| File | Exports |
|---|---|
| `intent.ts` | `IntentCreateRequest`, `IntentRecord`, `IntentStatus`, `IntentDirection`, `InvestorType`, `TradeIntent` |
| `snapshot.ts` | `TradeSnapshot` (decimals are JSON strings) |
| `crossing.ts` | `ThresholdCrossing` (the atomic unit of compliance) |
| `verdict.ts` | `Verdict` = `compliant \| conditional \| blocked` |
| `rationale.ts` | `Rationale`, `NLIStatus` = `streaming \| verified \| retracted` |
| `envelope.ts` | `WSEnvelope`, `ServerEnvelope`, `WSMessage`, `MessageType`, the per-type payloads, and the guards `isWSEnvelope` / `isMessageType` / `assertNever` |

**Not here:** the WS **error-code enum** lives in the consumer at `src/features/live-session/types.ts` (`WSErrorCode` = `ws_idle_timeout | intent_terminal | session_provider_failed | ws_task_error | (string & {})`), sourced from the backend `ws_handler.py`. Promoting a shared `WSErrorCode` into this package is a tracked follow-up.

## Regenerating from Pydantic (planned)

When the backend Pydantic models land, regenerate instead of hand-maintaining:

```bash
# from regulatory-rule-engine
python scripts/export-openapi.py > /tmp/openapi.json

# from this package
npx openapi-typescript /tmp/openapi.json -o src/generated.ts
```

Then reconcile the hand-written interfaces against `generated.ts`, update the `// SOURCE:` comments to the new repo/module paths, and remove this note.

## Consumers

- **The root app** (`cross-border-compliance-navigator`) — the live-session UI under `src/features/live-session/*` imports these types and guards.
- **`tools/mock-ws`** (`@platform/mock-ws`) — the fixture server emits envelopes typed against these contracts.
- **Tests** — `src/features/live-session/__tests__/envelope-schema.test.ts` validates every fixture envelope against `isWSEnvelope`.
