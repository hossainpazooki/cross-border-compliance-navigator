// @vitest-environment node
/**
 * Unit tests for the stateless intent identity codec. The id IS the record:
 * these prove the round-trip and the FAIL-SOFT decode (garbage => undefined,
 * never a throw), which is what lets a serverless invocation reconstruct an
 * intent from the id with no shared store.
 */
import { describe, it, expect } from 'vitest';
import type { IntentCreateRequest } from '@platform/contracts';
import {
  encodeIntentId,
  decodeIntentId,
  makeIntentRecord,
  type IntentRecordWithoutId,
} from '../intent-codec';

const REQUEST: IntentCreateRequest = {
  direction: 'buy',
  asset: 'EURS-EUR',
  notional_usd: '1050000',
  venue_jurisdiction: 'EU',
  investor_type: 'professional',
  target_jurisdictions: ['EU', 'UK'],
  holding_period_days: 30,
};

function sampleRecord(): IntentRecordWithoutId {
  return {
    ...REQUEST,
    status: 'created',
    created_at: '2026-05-15T10:00:00.000Z',
    activated_at: null,
    closed_at: null,
    last_error: null,
  };
}

describe('intent-codec', () => {
  it('round-trips an id-free record through encode/decode', () => {
    const record = sampleRecord();
    const id = encodeIntentId(record);
    const decoded = decodeIntentId(id);
    expect(decoded).toEqual(record);
  });

  it('produces ids matching /^int_/', () => {
    const id = encodeIntentId(sampleRecord());
    expect(id).toMatch(/^int_/);
  });

  it('makeIntentRecord builds a created record whose id self-describes it', () => {
    const record = makeIntentRecord(REQUEST);
    expect(record.intent_id).toMatch(/^int_/);
    expect(record.status).toBe('created');
    expect(record.asset).toBe(REQUEST.asset);

    const { intent_id, ...withoutId } = record;
    expect(decodeIntentId(intent_id)).toEqual(withoutId);
  });

  it('FAIL-SOFT: unknown/garbage/legacy ids decode to undefined, never throw', () => {
    expect(decodeIntentId('int_not-base64-$$$')).toBeUndefined();
    expect(decodeIntentId('int_')).toBeUndefined();
    expect(decodeIntentId('legacy-client-id')).toBeUndefined();
    expect(decodeIntentId('')).toBeUndefined();
    // base64url of a non-object JSON value is rejected (not a record)
    const numberPayload = Buffer.from('42', 'utf-8').toString('base64url');
    expect(decodeIntentId(`int_${numberPayload}`)).toBeUndefined();
    // base64url of a JSON array is rejected (must be an object)
    const arrayPayload = Buffer.from('[1,2,3]', 'utf-8').toString('base64url');
    expect(decodeIntentId(`int_${arrayPayload}`)).toBeUndefined();
    // base64url of non-JSON bytes is rejected
    const garbage = Buffer.from('not json at all', 'utf-8').toString('base64url');
    expect(decodeIntentId(`int_${garbage}`)).toBeUndefined();
  });
});
