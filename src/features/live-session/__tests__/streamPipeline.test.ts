import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ServerEnvelope } from '@platform/contracts';
import {
  fetchAuditAndReplay,
  processFrame,
  TERMINAL_ERROR_CODES,
  type PipelineContext,
} from '../streamPipeline';

const INTENT_ID = 'intent-pipeline';

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

interface Mocks {
  applyEnvelope: ReturnType<typeof vi.fn>;
  replayAuditEnvelopes: ReturnType<typeof vi.fn>;
  setConnection: ReturnType<typeof vi.fn>;
  setLastError: ReturnType<typeof vi.fn>;
  onTerminal: ReturnType<typeof vi.fn>;
}

function makeCtx(
  overrides: Partial<{ gap: boolean; auditBaseUrl: string }> = {}
): { ctx: PipelineContext; mocks: Mocks } {
  const mocks: Mocks = {
    applyEnvelope: vi.fn().mockReturnValue({ gap: overrides.gap ?? false }),
    replayAuditEnvelopes: vi.fn(),
    setConnection: vi.fn(),
    setLastError: vi.fn(),
    onTerminal: vi.fn(() => undefined),
  };
  const ctx: PipelineContext = {
    intentId: INTENT_ID,
    auditBaseUrl: overrides.auditBaseUrl ?? '',
    applyEnvelope: mocks.applyEnvelope as unknown as PipelineContext['applyEnvelope'],
    replayAuditEnvelopes:
      mocks.replayAuditEnvelopes as unknown as PipelineContext['replayAuditEnvelopes'],
    setConnection: mocks.setConnection as unknown as PipelineContext['setConnection'],
    setLastError: mocks.setLastError as unknown as PipelineContext['setLastError'],
    onTerminal: mocks.onTerminal as unknown as PipelineContext['onTerminal'],
  };
  return { ctx, mocks };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('streamPipeline.processFrame', () => {
  it('parses a valid envelope and applies it to the store', () => {
    const { ctx, mocks } = makeCtx();
    processFrame(JSON.stringify(tick(1)), ctx);
    expect(mocks.applyEnvelope).toHaveBeenCalledTimes(1);
    expect(mocks.applyEnvelope.mock.calls[0][1]).toMatchObject({ seq: 1, type: 'tick' });
  });

  it('ignores non-JSON frames without touching the store', () => {
    const { ctx, mocks } = makeCtx();
    processFrame('{not json', ctx);
    expect(mocks.applyEnvelope).not.toHaveBeenCalled();
  });

  it('drops frames that fail the isWSEnvelope guard', () => {
    const { ctx, mocks } = makeCtx();
    processFrame(JSON.stringify({ hello: 'world' }), ctx);
    expect(mocks.applyEnvelope).not.toHaveBeenCalled();
  });

  it('drops server `subscribe` envelopes', () => {
    const { ctx, mocks } = makeCtx();
    processFrame(
      JSON.stringify({
        seq: 1,
        ts: '2026-05-15T10:00:00.000Z',
        type: 'subscribe',
        payload: { intent_id: INTENT_ID },
      }),
      ctx
    );
    expect(mocks.applyEnvelope).not.toHaveBeenCalled();
  });

  it('captures an error envelope into lastError and latches terminal on intent_terminal', () => {
    const { ctx, mocks } = makeCtx();
    const err: ServerEnvelope = {
      seq: 1,
      ts: '2026-05-15T10:00:00.000Z',
      type: 'error',
      payload: { code: 'intent_terminal', message: 'session closed' },
    };
    processFrame(JSON.stringify(err), ctx);
    expect(mocks.setLastError).toHaveBeenCalledWith(INTENT_ID, {
      code: 'intent_terminal',
      message: 'session closed',
    });
    expect(mocks.onTerminal).toHaveBeenCalledTimes(1);
    expect(TERMINAL_ERROR_CODES.has('intent_terminal')).toBe(true);
  });

  it('captures a non-terminal error envelope WITHOUT latching terminal', () => {
    const { ctx, mocks } = makeCtx();
    const err: ServerEnvelope = {
      seq: 1,
      ts: '2026-05-15T10:00:00.000Z',
      type: 'error',
      payload: { code: 'transient', message: 'blip' },
    };
    processFrame(JSON.stringify(err), ctx);
    expect(mocks.setLastError).toHaveBeenCalledWith(INTENT_ID, {
      code: 'transient',
      message: 'blip',
    });
    expect(mocks.onTerminal).not.toHaveBeenCalled();
  });

  it('triggers an audit refetch when applyEnvelope reports a sequence gap', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [tick(1), tick(2)],
    });
    vi.stubGlobal('fetch', fetchSpy);

    const { ctx, mocks } = makeCtx({ gap: true });
    processFrame(JSON.stringify(tick(5)), ctx);

    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(fetchSpy.mock.calls[0][0]).toBe(`/audit/${INTENT_ID}`);
    await vi.waitFor(() => expect(mocks.replayAuditEnvelopes).toHaveBeenCalled());
  });

  it('does NOT refetch audit when there is no gap', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { ctx } = makeCtx({ gap: false });
    processFrame(JSON.stringify(tick(2)), ctx);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('streamPipeline.fetchAuditAndReplay', () => {
  it('uses a RELATIVE /audit URL when auditBaseUrl is empty (SSE same-origin)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => [tick(1)] });
    vi.stubGlobal('fetch', fetchSpy);
    const { ctx } = makeCtx({ auditBaseUrl: '' });
    await fetchAuditAndReplay(ctx);
    expect(fetchSpy.mock.calls[0][0]).toBe(`/audit/${INTENT_ID}`);
  });

  it('uses an ABSOLUTE /audit URL when auditBaseUrl is set (WS cross-origin)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => [tick(1)] });
    vi.stubGlobal('fetch', fetchSpy);
    const { ctx } = makeCtx({ auditBaseUrl: 'http://localhost:8787' });
    await fetchAuditAndReplay(ctx);
    expect(fetchSpy.mock.calls[0][0]).toBe(`http://localhost:8787/audit/${INTENT_ID}`);
  });

  it('filters subscribe frames out of the audit body before replay', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { seq: 0, ts: 't', type: 'subscribe', payload: { intent_id: INTENT_ID } },
        tick(1),
        tick(2),
      ],
    });
    vi.stubGlobal('fetch', fetchSpy);
    const { ctx, mocks } = makeCtx();
    await fetchAuditAndReplay(ctx);
    const replayed = mocks.replayAuditEnvelopes.mock.calls[0][1] as ServerEnvelope[];
    expect(replayed.map((e) => e.type)).toEqual(['tick', 'tick']);
  });

  it('flips the session to error when the audit fetch is not ok', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchSpy);
    const { ctx, mocks } = makeCtx();
    await fetchAuditAndReplay(ctx);
    expect(mocks.setConnection).toHaveBeenCalledWith(INTENT_ID, 'error');
    expect(mocks.replayAuditEnvelopes).not.toHaveBeenCalled();
  });

  it('flips the session to error when the audit body is not an array', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ nope: true }) });
    vi.stubGlobal('fetch', fetchSpy);
    const { ctx, mocks } = makeCtx();
    await fetchAuditAndReplay(ctx);
    expect(mocks.setConnection).toHaveBeenCalledWith(INTENT_ID, 'error');
  });
});
