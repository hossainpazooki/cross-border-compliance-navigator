import type { IntentCreateRequest } from '@platform/contracts';

export interface ValidationError {
  status: 400 | 422;
  body: { error: string };
}

export type ValidationResult =
  | { ok: true; value: IntentCreateRequest }
  | { ok: false; error: ValidationError };

/**
 * The single create-intent validator. Express AND the future Next route handler
 * call this so they return IDENTICAL status codes and bodies — the validation
 * contract lives in one place, not duplicated per transport.
 *
 * Rules (mirrors the production Pydantic model):
 *  - body must be an object                                  -> 400
 *  - `intent_id` is server-generated; rejecting it           -> 422
 *  - `asset`, `notional_usd`, `venue_jurisdiction` required
 *    and must be strings                                     -> 422
 */
export function validateIntentCreate(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: { status: 400, body: { error: 'body required' } } };
  }
  const b = body as Record<string, unknown>;

  if ('intent_id' in b) {
    return {
      ok: false,
      error: { status: 422, body: { error: 'intent_id is server-generated; do not send' } },
    };
  }

  if (
    typeof b.asset !== 'string' ||
    typeof b.notional_usd !== 'string' ||
    typeof b.venue_jurisdiction !== 'string'
  ) {
    return {
      ok: false,
      error: { status: 422, body: { error: 'missing required fields' } },
    };
  }

  return { ok: true, value: b as unknown as IntentCreateRequest };
}
