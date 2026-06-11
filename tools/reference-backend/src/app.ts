import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { WebSocketServer, type WebSocket } from 'ws';
import type {
  IntentCreateRequest,
  TradeIntent,
  WSEnvelope,
} from '@platform/contracts';
import { isWSEnvelope } from '@platform/contracts';
import { createRecord, getIntent, putIntent } from './intents.js';
import { loadFixture, replay, type FixtureFrame } from './replay.js';

export interface BackendOptions {
  /** Text-frame heartbeat interval; tests shrink this. */
  pingIntervalMs?: number;
}

export interface Backend {
  server: http.Server;
  /** Bind to a port (0 = ephemeral); resolves with the bound port. */
  listen(port: number): Promise<number>;
  close(): Promise<void>;
}

/**
 * Reference implementation of the COMPASS REST + WS contract
 * (@platform/contracts). Factory shape so the conformance suite can boot it
 * on an ephemeral port; `server.ts` is the CLI entry.
 */
export function createBackend(options: BackendOptions = {}): Backend {
  const pingIntervalMs = options.pingIntervalMs ?? 20_000;

  const app = express();
  app.use(express.json());

  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    if (_req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // New shape (matches the production contract): server generates the id.
  app.post('/v2/intents', (req, res) => {
    const body = req.body as Partial<IntentCreateRequest> & { intent_id?: string };
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'body required' });
      return;
    }
    if ('intent_id' in body) {
      res.status(422).json({ error: 'intent_id is server-generated; do not send' });
      return;
    }
    if (
      typeof body.asset !== 'string' ||
      typeof body.notional_usd !== 'string' ||
      typeof body.venue_jurisdiction !== 'string'
    ) {
      res.status(422).json({ error: 'missing required fields' });
      return;
    }
    const record = createRecord(body as IntentCreateRequest);
    res.status(201).json(record);
  });

  app.get('/v2/intents/:intentId', (req, res) => {
    const record = getIntent(req.params.intentId);
    if (!record) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(record);
  });

  // Legacy: older GoLiveButton path supplies its own intent_id.
  app.post('/intent', (req, res) => {
    const body = req.body as Partial<TradeIntent>;
    if (!body || typeof body.intent_id !== 'string') {
      res.status(400).json({ error: 'missing intent_id' });
      return;
    }
    const record = putIntent(body as TradeIntent);
    res.json({ intent_id: record.intent_id });
  });

  app.get('/audit/:intentId', async (req, res) => {
    const scenario = (req.query.scenario as string | undefined) ?? 'mica-threshold-crossing';
    try {
      const frames = await loadFixture(scenario);
      const envelopes = frames.map((f) => f.envelope);
      res.json(envelopes);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  interface ClientContext {
    intentId: string;
    controller: ReturnType<typeof replay> | null;
    heartbeat: ReturnType<typeof setInterval> | null;
  }

  function pickScenario(intent: TradeIntent | undefined, override?: string | null): string {
    if (override) return override;
    if (!intent) return 'mica-threshold-crossing';
    if (intent.target_jurisdictions.includes('EU')) return 'mica-threshold-crossing';
    return 'mica-threshold-crossing';
  }

  // Extract intent_id from either the new path-based route /v2/ws/trade/:intent_id
  // (what the real backend uses) or the legacy ?intent_id=... query param.
  function extractIntentIdFromPath(pathname: string): string | undefined {
    const match = pathname.match(/^\/v2\/ws\/trade\/([^/]+)$/);
    return match?.[1];
  }

  wss.on('connection', (ws: WebSocket, req) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const intentId =
      extractIntentIdFromPath(url.pathname) ?? url.searchParams.get('intent_id') ?? '';
    const scenarioOverride = url.searchParams.get('scenario');
    const speed = Number(url.searchParams.get('speed') ?? '1') || 1;

    const ctx: ClientContext = { intentId, controller: null, heartbeat: null };
    // A client both connects with ?intent_id=… AND sends a `subscribe` frame, so
    // startReplay can fire twice per connection. This synchronous latch ensures
    // exactly one replay — a second pass would re-deliver every envelope,
    // duplicating append-only artifacts (e.g. auditor findings) downstream. It is
    // set before the first `await` so the two calls cannot race past it.
    let replayStarted = false;

    const startReplay = async (id: string) => {
      if (replayStarted) return;
      replayStarted = true;
      const intent = getIntent(id);
      const scenario = pickScenario(intent, scenarioOverride);
      let frames: FixtureFrame[];
      try {
        frames = await loadFixture(scenario);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        ws.send(
          JSON.stringify({
            seq: 0,
            ts: new Date().toISOString(),
            type: 'error',
            payload: { code: 'fixture_load_failed', message },
          })
        );
        return;
      }
      ctx.controller = replay(
        frames,
        (envelope: WSEnvelope) => {
          if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(envelope));
        },
        speed
      );
    };

    ws.on('message', (data, isBinary) => {
      const text = typeof data === 'string' ? data : data.toString();
      // Mirror real backend: client replies "pong" as a text frame to our "ping".
      if (!isBinary && text === 'pong') return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return;
      }
      if (!isWSEnvelope(parsed) || parsed.type !== 'subscribe') return;
      ctx.intentId = parsed.payload.intent_id;
      void startReplay(ctx.intentId);
    });

    // Real backend sends a TEXT frame "ping" every WS_PING_INTERVAL_SECONDS — NOT
    // the WebSocket-protocol ping. Mirror that so clients exercise the same path.
    ctx.heartbeat = setInterval(() => {
      if (ws.readyState === ws.OPEN) ws.send('ping');
    }, pingIntervalMs);

    ws.on('close', () => {
      if (ctx.controller) ctx.controller.cancel();
      if (ctx.heartbeat) clearInterval(ctx.heartbeat);
    });

    if (intentId) {
      void startReplay(intentId);
    }
  });

  return {
    server,
    listen(port: number): Promise<number> {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, () => {
          resolve((server.address() as AddressInfo).port);
        });
      });
    },
    close(): Promise<void> {
      return new Promise((resolve, reject) => {
        for (const client of wss.clients) client.terminate();
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}
