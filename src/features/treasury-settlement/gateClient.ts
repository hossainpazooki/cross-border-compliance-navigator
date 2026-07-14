/**
 * HTTP client for the Go authorization gate (treasury-intent-controller).
 *
 * Fail-loud by design: any transport failure or non-2xx throws
 * `GateUnavailableError`. The settlement consumer treats a throw as "nothing
 * observed" — no settlement, cursor unchanged — so an outage can only ever
 * delay settlement, never invent or lose one (fail-closed).
 */

import type { GateDeclareRequest, GateDeclareResponse, GateEventsPage } from './types';

export class GateUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GateUnavailableError';
  }
}

export interface TreasuryGateClient {
  declare(request: GateDeclareRequest): Promise<GateDeclareResponse>;
  events(since: number): Promise<GateEventsPage>;
}

type FetchLike = typeof fetch;

export class HttpTreasuryGateClient implements TreasuryGateClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;

  constructor(baseUrl: string, fetchImpl: FetchLike = fetch) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.fetchImpl = fetchImpl;
  }

  private async request(path: string, init?: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, init);
    } catch (cause) {
      throw new GateUnavailableError(`gate unreachable: ${String(cause)}`);
    }
    if (!response.ok) {
      throw new GateUnavailableError(`gate answered ${response.status} for ${path}`);
    }
    try {
      return await response.json();
    } catch {
      throw new GateUnavailableError(`gate answered non-JSON for ${path}`);
    }
  }

  async declare(request: GateDeclareRequest): Promise<GateDeclareResponse> {
    const body = await this.request('/v2/intents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    return body as GateDeclareResponse;
  }

  async events(since: number): Promise<GateEventsPage> {
    const body = await this.request(`/v2/events?since=${since}`);
    const page = body as GateEventsPage;
    if (!Array.isArray(page.events) || typeof page.next_since !== 'number') {
      throw new GateUnavailableError('gate events page malformed');
    }
    return page;
  }
}
