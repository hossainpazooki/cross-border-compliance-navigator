import type { IntentCreateRequest, IntentRecord } from '@platform/contracts';

/**
 * Stateless intent identity codec.
 *
 * The id IS the record: `encodeIntentId` serializes the intent payload into the
 * id itself (base64url of its JSON), and `decodeIntentId` reverses it. This lets
 * a stateless serverless invocation reconstruct the full intent from the id in
 * the WS/SSE URL — there is no shared store between a `POST /v2/intents` lambda
 * and a later `GET /v2/stream/...` lambda.
 *
 * CAVEATS (reference implementation only):
 *  - NO integrity protection. The id is not signed or encrypted; anyone can mint
 *    or tamper with one. A real backend MUST use an opaque, server-side id keyed
 *    to authenticated, persisted state — never trust a client-decodable id.
 *  - Status transitions cannot persist. Because the id encodes only the creation
 *    payload, a decoded record is always `status: 'created'`; a stateless
 *    invocation has nowhere to record a transition to active/closed/failed. The
 *    express dev server keeps an in-memory cache (see `intents.ts`) that can hold
 *    a richer record within one process, but that state is per-process and lost
 *    across stateless invocations.
 */

/** The portion of an IntentRecord that is encoded into the id (no `intent_id`). */
export type IntentRecordWithoutId = Omit<IntentRecord, 'intent_id'>;

const PREFIX = 'int_';

/**
 * Encode an id-free intent record into a self-describing `int_…` id.
 * The record round-trips through `decodeIntentId`.
 */
export function encodeIntentId(record: IntentRecordWithoutId): string {
  const json = JSON.stringify(record);
  const b64url = Buffer.from(json, 'utf-8').toString('base64url');
  return `${PREFIX}${b64url}`;
}

/**
 * Decode an `int_…` id back into the record it encodes.
 *
 * FAIL-SOFT: any unrecognized, truncated, or non-JSON id yields `undefined`
 * (so callers map it to a 404), never a throw. A client-minted legacy id that
 * was never encoded by us simply does not decode — that is expected.
 */
export function decodeIntentId(id: string): IntentRecordWithoutId | undefined {
  if (typeof id !== 'string' || !id.startsWith(PREFIX)) return undefined;
  const b64url = id.slice(PREFIX.length);
  if (b64url.length === 0) return undefined;
  try {
    const json = Buffer.from(b64url, 'base64url').toString('utf-8');
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    return parsed as IntentRecordWithoutId;
  } catch {
    return undefined;
  }
}

/**
 * Build a full, freshly-created IntentRecord from a validated create request
 * by encoding its id. Stateless: the returned record is always `status:
 * 'created'` (see caveats above).
 */
export function makeIntentRecord(req: IntentCreateRequest): IntentRecord {
  const withoutId: IntentRecordWithoutId = {
    ...req,
    status: 'created',
    created_at: new Date().toISOString(),
    activated_at: null,
    closed_at: null,
    last_error: null,
  };
  return { ...withoutId, intent_id: encodeIntentId(withoutId) };
}
