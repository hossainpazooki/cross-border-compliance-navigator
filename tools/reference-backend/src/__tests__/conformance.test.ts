// @vitest-environment node
/**
 * Contract-conformance suite for the COMPASS streaming backend.
 *
 * This is the executable definition of the @platform/contracts REST + WS
 * protocol. It runs against the reference backend here; any future real
 * backend (e.g. ke-workbench's Gate-5 serve) must pass the same assertions
 * before it earns traffic.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { isWSEnvelope, type IntentRecord, type WSEnvelope } from '@platform/contracts';
import { createBackend, type Backend } from '../app.js';

let backend: Backend;
let base: string;
let wsBase: string;

beforeAll(async () => {
  backend = createBackend({ pingIntervalMs: 150 });
  const port = await backend.listen(0);
  base = `http://localhost:${port}`;
  wsBase = `ws://localhost:${port}`;
});

afterAll(async () => {
  await backend.close();
});

const VALID_INTENT = {
  direction: 'buy',
  asset: 'EURS-EUR',
  notional_usd: '1050000',
  venue_jurisdiction: 'EU',
  investor_type: 'institutional',
  target_jurisdictions: ['EU', 'UK'],
  holding_period_days: 30,
};

async function createIntent(): Promise<IntentRecord> {
  const res = await fetch(`${base}/v2/intents`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(VALID_INTENT),
  });
  expect(res.status).toBe(201);
  return (await res.json()) as IntentRecord;
}

interface StreamResult {
  envelopes: WSEnvelope[];
  pings: number;
  rawFrames: string[];
}

/** Collect the full replayed stream (speed=50) until the socket goes idle. */
function collectStream(path: string, opts?: { subscribe?: string }): Promise<StreamResult> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${wsBase}${path}`);
    const result: StreamResult = { envelopes: [], pings: 0, rawFrames: [] };
    let idle: ReturnType<typeof setTimeout> | null = null;

    const finish = () => {
      ws.close();
      resolve(result);
    };
    const armIdle = () => {
      if (idle) clearTimeout(idle);
      idle = setTimeout(finish, 1_000);
    };

    ws.on('open', () => {
      if (opts?.subscribe) {
        ws.send(
          JSON.stringify({
            seq: 0,
            ts: new Date().toISOString(),
            type: 'subscribe',
            payload: { intent_id: opts.subscribe },
          })
        );
      }
      armIdle();
    });
    ws.on('message', (data) => {
      const text = data.toString();
      result.rawFrames.push(text);
      if (text === 'ping') {
        result.pings += 1;
        ws.send('pong');
        // heartbeats do NOT reset idleness — the replay is over when
        // envelopes stop, regardless of the ping loop
        return;
      }
      result.envelopes.push(JSON.parse(text) as WSEnvelope);
      armIdle();
    });
    ws.on('error', reject);
    setTimeout(() => {
      ws.close();
      reject(new Error('stream did not go idle within 15s'));
    }, 15_000).unref();
  });
}

describe('REST: intent lifecycle', () => {
  it('POST /v2/intents creates a record with a server-generated id', async () => {
    const record = await createIntent();
    expect(record.intent_id).toMatch(/^int_/);
    expect(record.status).toBe('created');
    expect(record.asset).toBe(VALID_INTENT.asset);
    expect(record.created_at).toBeTruthy();
  });

  it('rejects a client-supplied intent_id with 422', async () => {
    const res = await fetch(`${base}/v2/intents`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...VALID_INTENT, intent_id: 'int_client' }),
    });
    expect(res.status).toBe(422);
  });

  it('rejects missing required fields with 422', async () => {
    const res = await fetch(`${base}/v2/intents`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ direction: 'buy' }),
    });
    expect(res.status).toBe(422);
  });

  it('GET /v2/intents/:id returns the created record; unknown id is 404', async () => {
    const record = await createIntent();
    const found = await fetch(`${base}/v2/intents/${record.intent_id}`);
    expect(found.status).toBe(200);
    expect(((await found.json()) as IntentRecord).intent_id).toBe(record.intent_id);

    const missing = await fetch(`${base}/v2/intents/int_does-not-exist`);
    expect(missing.status).toBe(404);
  });

  it('GET /health responds ok', async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});

describe('REST: audit replay', () => {
  it('returns a sequenced envelope array that fully validates against the contract', async () => {
    const res = await fetch(`${base}/audit/any-intent`);
    expect(res.status).toBe(200);
    const envelopes = (await res.json()) as unknown[];
    expect(envelopes.length).toBeGreaterThan(0);
    for (const [i, envelope] of envelopes.entries()) {
      expect(isWSEnvelope(envelope), `audit envelope ${i}`).toBe(true);
    }
    const seqs = (envelopes as WSEnvelope[]).map((e) => e.seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    expect(new Set(seqs).size).toBe(seqs.length);
  });
});

describe('WS: live stream', () => {
  it('streams the full scenario over /v2/ws/trade/:intentId with valid, monotonic envelopes', { timeout: 20_000 }, async () => {
    const record = await createIntent();
    const { envelopes } = await collectStream(`/v2/ws/trade/${record.intent_id}?speed=50`);

    expect(envelopes.length).toBeGreaterThan(0);
    for (const [i, envelope] of envelopes.entries()) {
      expect(isWSEnvelope(envelope), `frame ${i}`).toBe(true);
    }
    // server seq is a strictly monotonic +1 counter
    envelopes.forEach((e, i) => expect(e.seq).toBe(i + 1));

    // the scenario exercises the full live-session envelope surface,
    // including both agent-org types
    const types = new Set(envelopes.map((e) => e.type));
    for (const required of [
      'tick',
      'compliance',
      'threshold',
      'rationale_tok',
      'rationale_verified',
      'lead_position',
      'auditor_finding',
    ]) {
      expect(types.has(required as WSEnvelope['type']), `missing type ${required}`).toBe(true);
    }
  });

  it('starts the replay from a subscribe frame when no intent is in the URL query/path', { timeout: 20_000 }, async () => {
    const record = await createIntent();
    const { envelopes } = await collectStream('/v2/ws/trade/?speed=50', {
      subscribe: record.intent_id,
    });
    // path regex does not match an empty id, so only the subscribe frame starts it
    expect(envelopes.length).toBeGreaterThan(0);
  });

  it('heartbeat is an application-level text "ping" frame, never JSON', { timeout: 20_000 }, async () => {
    const record = await createIntent();
    const { pings, rawFrames } = await collectStream(`/v2/ws/trade/${record.intent_id}?speed=5`);
    expect(pings).toBeGreaterThan(0);
    for (const frame of rawFrames) {
      if (frame === 'ping') continue;
      expect(() => JSON.parse(frame)).not.toThrow();
    }
  });

  it('audit replay reconstructs exactly the streamed envelope sequence (gap-recovery contract)', { timeout: 20_000 }, async () => {
    const record = await createIntent();
    const [{ envelopes: streamed }, auditRes] = await Promise.all([
      collectStream(`/v2/ws/trade/${record.intent_id}?speed=50`),
      fetch(`${base}/audit/${record.intent_id}`),
    ]);
    const audited = (await auditRes.json()) as WSEnvelope[];
    expect(audited.map((e) => [e.seq, e.type])).toEqual(streamed.map((e) => [e.seq, e.type]));
  });
});
