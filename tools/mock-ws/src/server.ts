import http from 'node:http';
import express from 'express';
import { WebSocketServer, type WebSocket } from 'ws';
import type { TradeIntent, WSEnvelope } from '@platform/contracts';
import { isWSEnvelope } from '@platform/contracts';
import { getIntent, putIntent } from './intents.js';
import { loadFixture, replay, type FixtureFrame } from './replay.js';

const PORT = Number(process.env.PORT ?? 8787);

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

app.post('/intent', (req, res) => {
  const body = req.body as Partial<TradeIntent>;
  if (!body || typeof body.intent_id !== 'string') {
    res.status(400).json({ error: 'missing intent_id' });
    return;
  }
  putIntent(body as TradeIntent);
  res.json({ intent_id: body.intent_id });
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

wss.on('connection', (ws: WebSocket, req) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const intentId = url.searchParams.get('intent_id') ?? '';
  const scenarioOverride = url.searchParams.get('scenario');
  const speed = Number(url.searchParams.get('speed') ?? '1') || 1;

  const ctx: ClientContext = { intentId, controller: null, heartbeat: null };

  const startReplay = async (id: string) => {
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

  ws.on('message', (data) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(typeof data === 'string' ? data : data.toString());
    } catch {
      return;
    }
    if (!isWSEnvelope(parsed) || parsed.type !== 'subscribe') return;
    ctx.intentId = parsed.payload.intent_id;
    void startReplay(ctx.intentId);
  });

  ctx.heartbeat = setInterval(() => {
    if (ws.readyState === ws.OPEN) ws.ping();
  }, 20_000);

  ws.on('close', () => {
    if (ctx.controller) ctx.controller.cancel();
    if (ctx.heartbeat) clearInterval(ctx.heartbeat);
  });

  if (intentId) {
    void startReplay(intentId);
  }
});

server.listen(PORT, () => {
  console.log(`[mock-ws] listening on http://localhost:${PORT} and ws://localhost:${PORT}`);
});
