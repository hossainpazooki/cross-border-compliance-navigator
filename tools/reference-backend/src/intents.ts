import type {
  IntentCreateRequest,
  IntentRecord,
  TradeIntent,
} from '@platform/contracts';
import { decodeIntentId, makeIntentRecord } from './intent-codec';

// In-memory write-through cache. In the express dev server this preserves the
// exact records we minted within one process. The CODEC is the source of truth
// for identity, so a record can also be reconstructed from its id alone when the
// cache is cold (the serverless case) — see `getIntent`.
const store = new Map<string, IntentRecord>();

export function createRecord(req: IntentCreateRequest): IntentRecord {
  const record = makeIntentRecord(req);
  store.set(record.intent_id, record);
  return record;
}

// Legacy compat: when callers send a client-supplied intent_id (older
// GoLiveButton path, POST /intent), accept it as-is. This path is CACHE-ONLY and
// dev-only: a client-minted id is not codec-encoded, so it cannot be
// reconstructed from the id in a stateless invocation — it lives solely in this
// process's `store`.
export function putIntent(intent: TradeIntent): IntentRecord {
  const record: IntentRecord = {
    ...intent,
    status: 'created',
    created_at: new Date().toISOString(),
    activated_at: null,
    closed_at: null,
    last_error: null,
  };
  store.set(intent.intent_id, record);
  return record;
}

export function getIntent(intentId: string): IntentRecord | undefined {
  // Cache hit: return the exact record minted this process.
  const cached = store.get(intentId);
  if (cached) return cached;
  // Cache miss: reconstruct from a codec-encoded id (stateless path). Fail-soft —
  // an unknown/garbage/legacy-client id decodes to undefined => caller 404s.
  const decoded = decodeIntentId(intentId);
  if (!decoded) return undefined;
  return { ...decoded, intent_id: intentId };
}
