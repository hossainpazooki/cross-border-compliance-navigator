import type {
  IntentCreateRequest,
  IntentRecord,
  TradeIntent,
} from '@platform/contracts';
import crypto from 'node:crypto';

const store = new Map<string, IntentRecord>();

// Mirror backend id shape: `int_` + url-safe base64 of 16 random bytes.
function generateIntentId(): string {
  const buf = crypto.randomBytes(16).toString('base64url');
  return `int_${buf}`;
}

export function createRecord(req: IntentCreateRequest): IntentRecord {
  const record: IntentRecord = {
    ...req,
    intent_id: generateIntentId(),
    status: 'created',
    created_at: new Date().toISOString(),
    activated_at: null,
    closed_at: null,
    last_error: null,
  };
  store.set(record.intent_id, record);
  return record;
}

// Legacy compat: when callers send a client-supplied intent_id (older
// GoLiveButton path), accept it as-is.
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
  return store.get(intentId);
}
