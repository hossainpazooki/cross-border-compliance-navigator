import type {
  IntentCreateRequest,
  IntentRecord,
} from '@platform/contracts';

// Reads the HTTP backend root. Defaults to the institutional-defi-platform-api
// uvicorn default (port 8000). VITE_WS_URL is treated as an override for the
// mock-ws dev tool only (see useThresholdStream.ts) and is NOT used here —
// REST routes live on a separate origin from the WS endpoint in real deployments.
function httpBase(): string {
  const fromEnv = (import.meta.env as Record<string, string | undefined>)
    .VITE_API_URL;
  return fromEnv?.replace(/\/$/, '') || 'http://localhost:8000';
}

export class IntentApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = 'IntentApiError';
  }
}

async function readJsonOrThrow(res: Response): Promise<unknown> {
  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text().catch(() => undefined);
    }
    throw new IntentApiError(
      `intents api ${res.status}: ${res.statusText}`,
      res.status,
      body
    );
  }
  return res.json();
}

export async function createIntent(
  payload: IntentCreateRequest,
  signal?: AbortSignal
): Promise<IntentRecord> {
  const res = await fetch(`${httpBase()}/v2/intents`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  return (await readJsonOrThrow(res)) as IntentRecord;
}

export async function getIntent(
  intentId: string,
  signal?: AbortSignal
): Promise<IntentRecord> {
  const res = await fetch(
    `${httpBase()}/v2/intents/${encodeURIComponent(intentId)}`,
    { signal }
  );
  return (await readJsonOrThrow(res)) as IntentRecord;
}
