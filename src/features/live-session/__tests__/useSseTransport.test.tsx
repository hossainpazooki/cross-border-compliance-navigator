import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import type { ServerEnvelope, TradeIntent } from '@platform/contracts';
import { useSessionStore } from '../store';
import { useSseTransport } from '../useSseTransport';

const INTENT_ID = 'intent-sse';

// --- Minimal EventSource mock -------------------------------------------------
// Tracks every constructed instance so a test can assert how many times the
// browser would have (re)opened the stream — the load-bearing assertion is that
// a clean `end` closes the source and does NOT cause a reconnect/replay restart.
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  readyState = 0;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  closed = false;
  private listeners: Record<string, Array<(ev: MessageEvent) => void>> = {};

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, cb: (ev: MessageEvent) => void) {
    (this.listeners[type] ??= []).push(cb);
  }

  close() {
    this.closed = true;
    this.readyState = 2;
  }

  // test helpers
  emitMessage(data: string) {
    this.onmessage?.(new MessageEvent('message', { data }));
  }

  emitNamed(type: string, data = '{}') {
    for (const cb of this.listeners[type] ?? []) {
      cb(new MessageEvent(type, { data }));
    }
  }

  emitOpen() {
    this.onopen?.(new Event('open'));
  }

  emitError() {
    this.onerror?.(new Event('error'));
  }
}

function intent(): TradeIntent {
  return {
    intent_id: INTENT_ID,
    direction: 'buy',
    asset: 'ETHUSDT',
    notional_usd: '1000000',
    venue_jurisdiction: 'CH',
    investor_type: 'professional',
    target_jurisdictions: ['EU'],
    holding_period_days: 1,
  };
}

function snap() {
  return {
    intent_id: INTENT_ID,
    ts: '2026-05-15T10:00:00.000Z',
    mark_price: '3500.00',
    bid: '3499.50',
    ask: '3500.50',
    size: '285.71',
    spread_bps: 2.85,
    slippage_bps: 5,
    vol_30d: 0.65,
    var_95_usd: 28500,
    funding_rate: 0.0001,
  };
}

function tick(seq: number): ServerEnvelope {
  return { seq, ts: '2026-05-15T10:00:00.000Z', type: 'tick', payload: snap() };
}

const URL = `/v2/stream/trade/${INTENT_ID}`;

beforeEach(() => {
  MockEventSource.instances = [];
  vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);
  useSessionStore.setState({ sessions: {} });
  useSessionStore.getState().openSession(INTENT_ID, intent());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useSseTransport', () => {
  it('opens exactly one EventSource at the same-origin SSE URL', () => {
    renderHook(() => useSseTransport({ intentId: INTENT_ID, url: URL }));
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe(URL);
  });

  it('does NOT open an EventSource when url is null (skip)', () => {
    renderHook(() => useSseTransport({ intentId: INTENT_ID, url: null }));
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('feeds message frames into the store via the shared pipeline', () => {
    renderHook(() => useSseTransport({ intentId: INTENT_ID, url: URL }));
    MockEventSource.instances[0].emitMessage(JSON.stringify(tick(1)));
    const session = useSessionStore.getState().sessions[INTENT_ID];
    expect(session.lastSeq).toBe(1);
    expect(session.latestSnapshot).toEqual(snap());
  });

  it('closes the EventSource on the terminal `end` event (no auto-reconnect)', () => {
    renderHook(() => useSseTransport({ intentId: INTENT_ID, url: URL }));
    const es = MockEventSource.instances[0];
    es.emitNamed('end');
    expect(es.closed).toBe(true);
    expect(useSessionStore.getState().sessions[INTENT_ID].connection).toBe('closed');
  });

  it('does NOT re-open / restart replay after a clean `end` even if the effect re-runs', () => {
    const { rerender } = renderHook(
      ({ id }: { id: string }) => useSseTransport({ intentId: id, url: URL }),
      { initialProps: { id: INTENT_ID } }
    );
    MockEventSource.instances[0].emitNamed('end');
    expect(MockEventSource.instances).toHaveLength(1);

    // Force the effect to re-run; the latch must prevent a second EventSource
    // (which would replay the whole fixture again, duplicating artifacts).
    rerender({ id: INTENT_ID });
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].closed).toBe(true);
  });

  it('flips the session to error on a genuine drop (onerror before end)', () => {
    renderHook(() => useSseTransport({ intentId: INTENT_ID, url: URL }));
    MockEventSource.instances[0].emitError();
    expect(useSessionStore.getState().sessions[INTENT_ID].connection).toBe('error');
  });

  it('does NOT flip to error when onerror fires after a clean end', () => {
    renderHook(() => useSseTransport({ intentId: INTENT_ID, url: URL }));
    const es = MockEventSource.instances[0];
    es.emitNamed('end');
    es.emitError();
    // end already set 'closed'; the post-end error must not overwrite to 'error'
    expect(useSessionStore.getState().sessions[INTENT_ID].connection).toBe('closed');
  });
});
