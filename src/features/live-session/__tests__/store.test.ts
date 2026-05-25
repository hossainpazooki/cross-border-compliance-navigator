import { beforeEach, describe, expect, it } from 'vitest';
import type { ServerEnvelope, ThresholdCrossing, TradeIntent, TradeSnapshot } from '@platform/contracts';
import { useSessionStore } from '../store';

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

function snapshot(overrides: Partial<TradeSnapshot> = {}): TradeSnapshot {
  return {
    intent_id: INTENT_ID,
    ts: '2026-05-15T10:00:00.000Z',
    mark_price: '3500.00',
    bid: '3499.50',
    ask: '3500.50',
    size: '285.714286',
    spread_bps: 2.85,
    slippage_bps: 5,
    vol_30d: 0.65,
    var_95_usd: 28500,
    funding_rate: 0.0001,
    ...overrides,
  };
}

function crossing(id: string, snap: TradeSnapshot): ThresholdCrossing {
  return {
    crossing_id: id,
    intent_id: INTENT_ID,
    ts: '2026-05-15T10:00:01.000Z',
    rule_id: 'MICA_ART_5_1',
    citation: 'MiCA Art. 5(1)',
    boundary: '1000000',
    direction: 'crossed_up',
    snapshot: snap,
    prior_verdict: 'compliant',
    new_verdict: 'conditional',
  };
}

function envelope<T extends ServerEnvelope['type']>(
  seq: number,
  type: T,
  payload: Extract<ServerEnvelope, { type: T }>['payload']
): ServerEnvelope {
  return { seq, ts: '2026-05-15T10:00:00.000Z', type, payload } as ServerEnvelope;
}

beforeEach(() => {
  useSessionStore.setState({ sessions: {} });
});

describe('sessionStore.openSession / closeSession', () => {
  it('opens a session with initial state', () => {
    const s = useSessionStore.getState();
    s.openSession(INTENT_ID, intent());
    const session = useSessionStore.getState().sessions[INTENT_ID];
    expect(session.currentVerdict).toBe('compliant');
    expect(session.latestSnapshot).toBeNull();
    expect(session.crossings).toEqual([]);
    expect(session.rationales).toEqual({});
    expect(session.connection).toBe('connecting');
    expect(session.lastSeq).toBe(0);
  });

  it('closes a session', () => {
    const s = useSessionStore.getState();
    s.openSession(INTENT_ID, intent());
    s.closeSession(INTENT_ID);
    expect(useSessionStore.getState().sessions[INTENT_ID]).toBeUndefined();
  });
});

describe('sessionStore.applyEnvelope dispatch', () => {
  beforeEach(() => {
    useSessionStore.getState().openSession(INTENT_ID, intent());
  });

  it('updates latestSnapshot on tick', () => {
    const snap = snapshot({ mark_price: '3600.00' });
    useSessionStore.getState().applyEnvelope(INTENT_ID, envelope(1, 'tick', snap));
    expect(useSessionStore.getState().sessions[INTENT_ID].latestSnapshot).toEqual(snap);
  });

  it('ignores risk_update payload but advances seq', () => {
    useSessionStore.getState().applyEnvelope(INTENT_ID, envelope(1, 'risk_update', {}));
    expect(useSessionStore.getState().sessions[INTENT_ID].lastSeq).toBe(1);
  });

  it('updates currentVerdict on compliance', () => {
    useSessionStore.getState().applyEnvelope(
      INTENT_ID,
      envelope(1, 'compliance', {
        crossing_id: 'c1',
        prior_verdict: 'compliant',
        new_verdict: 'blocked',
        citation: 'MiCA Art. 5(1)',
      })
    );
    expect(useSessionStore.getState().sessions[INTENT_ID].currentVerdict).toBe('blocked');
  });

  it('prepends crossing and seeds rationale on threshold', () => {
    const crs = crossing('c1', snapshot());
    useSessionStore.getState().applyEnvelope(INTENT_ID, envelope(1, 'threshold', crs));
    const session = useSessionStore.getState().sessions[INTENT_ID];
    expect(session.crossings[0]).toEqual(crs);
    expect(session.rationales['c1']).toMatchObject({
      crossing_id: 'c1',
      content: '',
      status: 'streaming',
    });
  });

  it('accumulates content on rationale_tok', () => {
    useSessionStore.getState().applyEnvelope(
      INTENT_ID,
      envelope(1, 'threshold', crossing('c1', snapshot()))
    );
    useSessionStore.getState().applyEnvelope(
      INTENT_ID,
      envelope(2, 'rationale_tok', { rationale_id: 'r1', crossing_id: 'c1', token: 'Hello ' })
    );
    useSessionStore.getState().applyEnvelope(
      INTENT_ID,
      envelope(3, 'rationale_tok', { rationale_id: 'r1', crossing_id: 'c1', token: 'world' })
    );
    expect(useSessionStore.getState().sessions[INTENT_ID].rationales['c1'].content).toBe('Hello world');
  });

  it('marks rationale verified with final_score', () => {
    useSessionStore.getState().applyEnvelope(
      INTENT_ID,
      envelope(1, 'threshold', crossing('c1', snapshot()))
    );
    useSessionStore.getState().applyEnvelope(
      INTENT_ID,
      envelope(2, 'rationale_verified', {
        rationale_id: 'r1',
        crossing_id: 'c1',
        final_score: 0.85,
      })
    );
    const r = useSessionStore.getState().sessions[INTENT_ID].rationales['c1'];
    expect(r.status).toBe('verified');
    expect(r.final_score).toBe(0.85);
  });

  it('marks rationale retracted with reason and final_score', () => {
    useSessionStore.getState().applyEnvelope(
      INTENT_ID,
      envelope(1, 'threshold', crossing('c1', snapshot()))
    );
    useSessionStore.getState().applyEnvelope(
      INTENT_ID,
      envelope(2, 'rationale_retracted', {
        rationale_id: 'r1',
        crossing_id: 'c1',
        final_score: 0.42,
        reason: 'NLI failed',
      })
    );
    const r = useSessionStore.getState().sessions[INTENT_ID].rationales['c1'];
    expect(r.status).toBe('retracted');
    expect(r.final_score).toBe(0.42);
    expect(r.retraction_reason).toBe('NLI failed');
  });

  it('sets connection to error on error envelope', () => {
    useSessionStore.getState().applyEnvelope(
      INTENT_ID,
      envelope(1, 'error', { code: 'oops', message: 'something failed' })
    );
    expect(useSessionStore.getState().sessions[INTENT_ID].connection).toBe('error');
  });

  it('returns gap=false when seq is monotonic', () => {
    useSessionStore.getState().applyEnvelope(INTENT_ID, envelope(1, 'tick', snapshot()));
    const { gap } = useSessionStore
      .getState()
      .applyEnvelope(INTENT_ID, envelope(2, 'tick', snapshot()));
    expect(gap).toBe(false);
  });

  it('detects gap when seq skips and flips connection to error', () => {
    useSessionStore.getState().applyEnvelope(INTENT_ID, envelope(1, 'tick', snapshot()));
    const { gap } = useSessionStore
      .getState()
      .applyEnvelope(INTENT_ID, envelope(5, 'tick', snapshot()));
    expect(gap).toBe(true);
    expect(useSessionStore.getState().sessions[INTENT_ID].connection).toBe('error');
  });

  it('returns gap=false when no session exists', () => {
    const { gap } = useSessionStore
      .getState()
      .applyEnvelope('unknown-intent', envelope(1, 'tick', snapshot()));
    expect(gap).toBe(false);
  });

  it('flips connection from connecting to open on first non-gap envelope', () => {
    useSessionStore.getState().applyEnvelope(INTENT_ID, envelope(1, 'tick', snapshot()));
    expect(useSessionStore.getState().sessions[INTENT_ID].connection).toBe('open');
  });
});

describe('sessionStore.replayAuditEnvelopes', () => {
  it('rebuilds session state from envelopes', () => {
    const s = useSessionStore.getState();
    s.openSession(INTENT_ID, intent());
    // Corrupt the state to ensure replay resets it
    s.applyEnvelope(INTENT_ID, envelope(99, 'tick', snapshot({ mark_price: '9999' })));

    const replay: ServerEnvelope[] = [
      envelope(1, 'tick', snapshot({ mark_price: '3500.00' })),
      envelope(2, 'threshold', crossing('c1', snapshot())),
      envelope(3, 'rationale_tok', { rationale_id: 'r1', crossing_id: 'c1', token: 'hi' }),
      envelope(4, 'rationale_verified', { rationale_id: 'r1', crossing_id: 'c1', final_score: 0.9 }),
    ];
    s.replayAuditEnvelopes(INTENT_ID, replay);

    const session = useSessionStore.getState().sessions[INTENT_ID];
    expect(session.connection).toBe('open');
    expect(session.lastSeq).toBe(4);
    expect(session.crossings).toHaveLength(1);
    expect(session.rationales['c1'].status).toBe('verified');
  });

  it('is a no-op when the session is missing', () => {
    expect(() =>
      useSessionStore.getState().replayAuditEnvelopes('missing', [])
    ).not.toThrow();
  });
});

describe('sessionStore.setConnection', () => {
  it('updates the connection state for an open session', () => {
    useSessionStore.getState().openSession(INTENT_ID, intent());
    useSessionStore.getState().setConnection(INTENT_ID, 'error');
    expect(useSessionStore.getState().sessions[INTENT_ID].connection).toBe('error');
  });

  it('is a no-op for an unknown session', () => {
    expect(() =>
      useSessionStore.getState().setConnection('missing', 'error')
    ).not.toThrow();
  });
});
