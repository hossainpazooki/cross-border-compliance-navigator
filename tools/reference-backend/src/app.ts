import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { WebSocketServer, type WebSocket } from 'ws';
import type { TradeIntent, WSEnvelope } from '@platform/contracts';
import { isWSEnvelope } from '@platform/contracts';
import { createRecord, getIntent, putIntent } from './intents';
import { loadFixture } from './replay';
import { streamScenario } from './stream';
import { validateIntentCreate } from './validate';

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
  // Validation is delegated to validateIntentCreate() so express and the future
  // Next route handler return IDENTICAL 400/422 responses.
  app.post('/v2/intents', (req, res) => {
    const result = validateIntentCreate(req.body);
    if (!result.ok) {
      res.status(result.error.status).json(result.error.body);
      return;
    }
    const record = createRecord(result.value);
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

  // SSE transport beside the WS path. This is a COMPASS + Vercel DEPLOYMENT
  // ADAPTER, not a new cross-backend contract obligation (the canonical contract
  // a real backend must implement stays WS-only). It exists so a Next route
  // handler can stream the SAME `streamScenario` frames over a plain HTTP
  // response, where long-lived WS upgrades are awkward on serverless.
  app.get('/v2/stream/trade/:intentId', async (req, res) => {
    const intentId = req.params.intentId;
    const intent = getIntent(intentId);
    if (!intent) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    const scenarioOverride = (req.query.scenario as string | undefined) ?? null;
    const scenario = pickScenario(intent, scenarioOverride);
    const speed = Number(req.query.speed ?? '1') || 1;
    // Resume cursor: Last-Event-ID header (EventSource auto-reconnect) takes
    // precedence over an explicit ?fromSeq=… query.
    const lastEventId = req.header('Last-Event-ID');
    const fromSeq =
      Number(lastEventId ?? (req.query.fromSeq as string | undefined) ?? '0') || 0;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const abort = new AbortController();
    req.on('close', () => abort.abort());

    // ':' comment lines are SSE heartbeats — ignored by EventSource, they keep
    // the connection warm without being parsed as data.
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(': ping\n\n');
    }, pingIntervalMs);

    try {
      for await (const { envelope } of streamScenario({
        scenario,
        speed,
        fromSeq,
        signal: abort.signal,
      })) {
        if (res.writableEnded || abort.signal.aborted) break;
        res.write(`id: ${envelope.seq}\n`);
        res.write(`data: ${JSON.stringify(envelope)}\n\n`);
      }
      // Terminal frame: a named 'end' event marks a clean replay completion so
      // the client can stop reconnecting (distinguishes "done" from "dropped").
      if (!res.writableEnded && !abort.signal.aborted) {
        res.write('event: end\n');
        res.write('data: {}\n\n');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!res.writableEnded) {
        const errorEnvelope: WSEnvelope = {
          seq: 0,
          ts: new Date().toISOString(),
          type: 'error',
          payload: { code: 'fixture_load_failed', message },
        };
        res.write(`data: ${JSON.stringify(errorEnvelope)}\n\n`);
      }
    } finally {
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
    }
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  interface ClientContext {
    intentId: string;
    abort: AbortController | null;
    heartbeat: ReturnType<typeof setInterval> | null;
  }

  function pickScenario(intent: TradeIntent | undefined, override?: string | null): string {
    if (override) return override;
    if (!intent) return 'mica-threshold-crossing';
    // `target_jurisdictions` is optional on records minted via the new
    // `/v2/intents` shape (IntentCreateRequest carries only asset / notional_usd /
    // venue_jurisdiction), so guard the access — dereferencing it raw crashed the
    // WS handler's startReplay for every codec-minted intent.
    if (intent.target_jurisdictions?.includes('EU')) return 'mica-threshold-crossing';
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

    const ctx: ClientContext = { intentId, abort: null, heartbeat: null };
    // A client both connects with ?intent_id=… AND sends a `subscribe` frame, so
    // startReplay can fire twice per connection. This synchronous latch ensures
    // exactly one replay — a second pass would re-deliver every envelope,
    // duplicating append-only artifacts (e.g. auditor findings) downstream. It is
    // set before the first `await` so the two calls cannot race past it.
    let replayStarted = false;

    // Both the WS and SSE paths drive the SAME `streamScenario` generator — it is
    // the single source of replay timing.
    const startReplay = async (id: string) => {
      if (replayStarted) return;
      replayStarted = true;
      const intent = getIntent(id);
      const scenario = pickScenario(intent, scenarioOverride);
      const abort = new AbortController();
      ctx.abort = abort;
      try {
        for await (const { envelope } of streamScenario({ scenario, speed, signal: abort.signal })) {
          if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(envelope));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (ws.readyState === ws.OPEN) {
          ws.send(
            JSON.stringify({
              seq: 0,
              ts: new Date().toISOString(),
              type: 'error',
              payload: { code: 'fixture_load_failed', message },
            })
          );
        }
      }
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
      if (ctx.abort) ctx.abort.abort();
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
