# @platform/contracts

Shared TypeScript types for the live threshold-rationale WebSocket protocol.

## Source of truth

All types mirror Pydantic models in `institutional-defi-platform-api`. Each interface
carries a `// SOURCE:` comment pointing to the file (or planned file) that defines the
canonical Pydantic model.

Spec: `dev/briefs/live-threshold-rationale-spec.md` (§3 data shapes, §4 detection,
§7 WebSocket protocol).

## Regenerating from Pydantic (planned)

Until the backend ships, these types are hand-written from the spec. When the
backend Pydantic models land, regenerate as follows:

```bash
# from institutional-defi-platform-api
python scripts/export-openapi.py > /tmp/openapi.json

# from this package
npx openapi-typescript /tmp/openapi.json -o src/generated.ts
```

Then reconcile hand-written interfaces against `generated.ts` and remove this
note. The `// SOURCE:` comments name the Pydantic class for each TS interface.

## Consumers

- `apps/cross-border` (the root workspace) — UI uses these types
- `tools/mock-ws` — server emits envelopes typed against these contracts
- Tests in `src/features/live-session/__tests__/envelope-schema.test.ts` validate
  every fixture envelope against `isWSEnvelope`.
