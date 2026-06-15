import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ServerEnvelope, TradeIntent } from '@platform/contracts';
import { useSessionStore } from '../store';

// Stage 3: useThresholdStream became a facade over a WS and an SSE transport.
// Pin the explicit transport override BEFORE any module reads env (vi.hoisted
// runs ahead of imports), so this suite continues to exercise the WS path with
// the react-use-websocket mock below — no transport inference, no behavior
// change to the assertions.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_STREAM_TRANSPORT = 'ws';
});

interface MockState {
  lastMessage: MessageEvent | null;
  readyState: number;
  sendJsonMessage: ReturnType<typeof vi.fn>;
  sendMessage: ReturnType<typeof vi.fn>;
  onOpenHandler: (() => void) | null;
}

const mockState: MockState = {
  lastMessage: null,
  readyState: 0,
  sendJsonMessage: vi.fn(),
  sendMessage: vi.fn(),
  onOpenHandler: null,
};

vi.mock('react-use-websocket', () => {
  const useWebSocket = vi.fn(
    (
      _url: string | null,
      options: { onOpen?: () => void; onClose?: () => void; onError?: () => void } = {}
    ) => {
      mockState.onOpenHandler = options.onOpen ?? null;
      return {
        lastMessage: mockState.lastMessage,
        readyState: mockState.readyState,
        sendJsonMessage: mockState.sendJsonMessage,
        sendMessage: mockState.sendMessage,
      };
    }
  );
  return {
    default: useWebSocket,
    ReadyState: { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 },
  };
});

import { useThresholdStream } from '../useThresholdStream';

const INTENT_ID = 'intent-test';

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

function envelopeMessage(env: ServerEnvelope): MessageEvent {
  return new MessageEvent('message', { data: JSON.stringify(env) });
}

beforeEach(() => {
  useSessionStore.setState({ sessions: {} });
  useSessionStore.getState().openSession(INTENT_ID, intent());
  mockState.lastMessage = null;
  mockState.readyState = 1;
  mockState.sendJsonMessage.mockReset();
  mockState.sendMessage.mockReset();
  mockState.onOpenHandler = null;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useThresholdStream', () => {
  it('sends subscribe envelope on open', () => {
    renderHook(() => useThresholdStream({ intentId: INTENT_ID }));
    act(() => {
      mockState.onOpenHandler?.();
    });
    expect(mockState.sendJsonMessage).toHaveBeenCalledTimes(1);
    const call = mockState.sendJsonMessage.mock.calls[0][0];
    expect(call.type).toBe('subscribe');
    expect(call.payload.intent_id).toBe(INTENT_ID);
    expect(useSessionStore.getState().sessions[INTENT_ID].connection).toBe('open');
  });

  it('routes inbound envelopes into the store via applyEnvelope', () => {
    const env: ServerEnvelope = {
      seq: 1,
      ts: '2026-05-15T10:00:00.000Z',
      type: 'tick',
      payload: snap(),
    };
    mockState.lastMessage = envelopeMessage(env);
    renderHook(() => useThresholdStream({ intentId: INTENT_ID }));
    expect(useSessionStore.getState().sessions[INTENT_ID].latestSnapshot).toEqual(snap());
    expect(useSessionStore.getState().sessions[INTENT_ID].lastSeq).toBe(1);
  });

  it('triggers an audit refetch when a seq gap is detected', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        [
          {
            seq: 1,
            ts: '2026-05-15T10:00:00.000Z',
            type: 'tick' as const,
            payload: snap(),
          },
          {
            seq: 2,
            ts: '2026-05-15T10:00:01.000Z',
            type: 'tick' as const,
            payload: snap(),
          },
        ],
    });
    vi.stubGlobal('fetch', fetchSpy);

    const env1: ServerEnvelope = {
      seq: 1,
      ts: '2026-05-15T10:00:00.000Z',
      type: 'tick',
      payload: snap(),
    };
    const env5: ServerEnvelope = {
      seq: 5,
      ts: '2026-05-15T10:00:04.000Z',
      type: 'tick',
      payload: snap(),
    };

    mockState.lastMessage = envelopeMessage(env1);
    const { rerender } = renderHook(() => useThresholdStream({ intentId: INTENT_ID }));

    mockState.lastMessage = envelopeMessage(env5);
    rerender();

    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain(`/audit/${INTENT_ID}`);
  });

  it('ignores malformed messages', () => {
    mockState.lastMessage = new MessageEvent('message', { data: '{not json' });
    renderHook(() => useThresholdStream({ intentId: INTENT_ID }));
    expect(useSessionStore.getState().sessions[INTENT_ID].lastSeq).toBe(0);
  });

  it('replies with text "pong" when the server sends text "ping"', () => {
    mockState.lastMessage = new MessageEvent('message', { data: 'ping' });
    renderHook(() => useThresholdStream({ intentId: INTENT_ID }));
    expect(mockState.sendMessage).toHaveBeenCalledWith('pong');
    // Heartbeat is NOT a JSON envelope — it must not advance lastSeq.
    expect(useSessionStore.getState().sessions[INTENT_ID].lastSeq).toBe(0);
  });

  it('captures error envelope code into lastError and blocks reconnect on intent_terminal', () => {
    const env: ServerEnvelope = {
      seq: 1,
      ts: '2026-05-15T10:00:00.000Z',
      type: 'error',
      payload: { code: 'intent_terminal', message: 'session closed' },
    };
    mockState.lastMessage = envelopeMessage(env);
    renderHook(() => useThresholdStream({ intentId: INTENT_ID }));
    const session = useSessionStore.getState().sessions[INTENT_ID];
    expect(session.lastError).toEqual({
      code: 'intent_terminal',
      message: 'session closed',
    });
    expect(session.connection).toBe('error');
  });

  it('ignores subscribe envelopes coming from the server', () => {
    const env = {
      seq: 1,
      ts: '2026-05-15T10:00:00.000Z',
      type: 'subscribe',
      payload: { intent_id: INTENT_ID },
    };
    mockState.lastMessage = new MessageEvent('message', { data: JSON.stringify(env) });
    renderHook(() => useThresholdStream({ intentId: INTENT_ID }));
    expect(useSessionStore.getState().sessions[INTENT_ID].lastSeq).toBe(0);
  });
});
