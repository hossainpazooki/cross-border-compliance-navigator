import { beforeEach, describe, expect, it } from 'vitest';
import type { ServerEnvelope, ThresholdCrossing, TradeIntent, TradeSnapshot } from '@platform/contracts';
import { useSessionStore } from '../store';
import { orchestratorFor } from '../orchestratorRouting';

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

function crossingWithRule(id: string, ruleId: string): ThresholdCrossing {
  return { ...crossing(id, snapshot()), rule_id: ruleId };
}

// Drives a crossing to a verified rationale so lead positions can be appended.
function verifyCrossing(seq: { n: number }, id: string, ruleId = 'MICA_ART_5_1'): void {
  const s = useSessionStore.getState();
  s.applyEnvelope(INTENT_ID, envelope(seq.n++, 'threshold', crossingWithRule(id, ruleId)));
  s.applyEnvelope(INTENT_ID, envelope(seq.n++, 'rationale_tok', { rationale_id: `r-${id}`, crossing_id: id, token: 'x' }));
  s.applyEnvelope(INTENT_ID, envelope(seq.n++, 'rationale_verified', { rationale_id: `r-${id}`, crossing_id: id, final_score: 0.9 }));
}

describe('orchestratorFor routing', () => {
  it('routes seeded compliance rule_ids to the compliance lead', () => {
    for (const rule of ['MICA_ART_5_1', 'MICA_ART_5_2', 'FCA_RP_3_2', 'SEC_REG_D']) {
      expect(orchestratorFor(rule)).toBe('compliance');
    }
  });

  it('routes RISK_-prefixed rule_ids to the risk lead', () => {
    expect(orchestratorFor('RISK_VAR_95')).toBe('risk');
    expect(orchestratorFor('RISK_SLIPPAGE')).toBe('risk');
  });

  it('defaults unknown rule_ids to compliance (missed obligation is worse)', () => {
    expect(orchestratorFor('UNKNOWN_RULE')).toBe('compliance');
    expect(orchestratorFor('')).toBe('compliance');
  });

  it('resolves a dual-implicated crossing to a SINGLE orchestrator by rule_id', () => {
    // A notional breach that trips both a MiCA obligation and a VaR limit:
    // the originating rule_id decides the one orchestrator — never two.
    const micaOriginated = orchestratorFor('MICA_ART_5_1');
    const riskOriginated = orchestratorFor('RISK_VAR_95');
    expect(micaOriginated).toBe('compliance');
    expect(riskOriginated).toBe('risk');
    // Each is a single deterministic value, not an array / ambiguous result.
    expect(typeof micaOriginated).toBe('string');
  });
});

describe('sessionStore agent-org artifacts', () => {
  beforeEach(() => {
    useSessionStore.getState().openSession(INTENT_ID, intent());
  });

  it('appends a lead position only after the rationale is verified', () => {
    const seq = { n: 1 };
    verifyCrossing(seq, 'c1');
    useSessionStore.getState().applyEnvelope(
      INTENT_ID,
      envelope(seq.n++, 'lead_position', { crossing_id: 'c1', lead: 'compliance', stance: 'satisfy_both', basis: 'b' })
    );
    expect(useSessionStore.getState().sessions[INTENT_ID].leadPositions['c1']).toHaveLength(1);
  });

  it('holds at most two positions per crossing (one compliance, one risk)', () => {
    const seq = { n: 1 };
    verifyCrossing(seq, 'c1');
    const s = useSessionStore.getState();
    s.applyEnvelope(INTENT_ID, envelope(seq.n++, 'lead_position', { crossing_id: 'c1', lead: 'compliance', stance: 'stricter', basis: 'b' }));
    s.applyEnvelope(INTENT_ID, envelope(seq.n++, 'lead_position', { crossing_id: 'c1', lead: 'risk', stance: 'escalate', basis: 'b' }));
    // A duplicate compliance lead is ignored — never a third position.
    s.applyEnvelope(INTENT_ID, envelope(seq.n++, 'lead_position', { crossing_id: 'c1', lead: 'compliance', stance: 'earliest', basis: 'b2' }));
    const positions = useSessionStore.getState().sessions[INTENT_ID].leadPositions['c1'];
    expect(positions).toHaveLength(2);
    expect(positions.filter((p) => p.lead === 'compliance')).toHaveLength(1);
  });

  it('appends auditor findings keyed by crossing_id', () => {
    const seq = { n: 1 };
    verifyCrossing(seq, 'c1');
    const s = useSessionStore.getState();
    s.applyEnvelope(INTENT_ID, envelope(seq.n++, 'auditor_finding', { crossing_id: 'c1', target: 'rationale', verdict: 'pass', basis: 'grounded' }));
    s.applyEnvelope(INTENT_ID, envelope(seq.n++, 'auditor_finding', { crossing_id: 'c1', target: 'lead_position', verdict: 'advisory', basis: 'consider stricter' }));
    expect(useSessionStore.getState().sessions[INTENT_ID].auditorFindings['c1']).toHaveLength(2);
  });

  it('invariant: every crossing holds ≤1 draft and ≤2 lead positions, never 2 drafts', () => {
    const s = useSessionStore.getState();
    let seq = 1;
    // Build a handful of crossings through assorted lifecycles.
    const ids = ['p1', 'p2', 'p3', 'p4'];
    for (const id of ids) {
      s.applyEnvelope(INTENT_ID, envelope(seq++, 'threshold', crossingWithRule(id, 'MICA_ART_5_1')));
      s.applyEnvelope(INTENT_ID, envelope(seq++, 'rationale_tok', { rationale_id: `r-${id}`, crossing_id: id, token: 'x' }));
      s.applyEnvelope(INTENT_ID, envelope(seq++, 'rationale_verified', { rationale_id: `r-${id}`, crossing_id: id, final_score: 0.9 }));
      // Bombard with redundant lead positions — store must cap at two.
      for (const lead of ['compliance', 'risk', 'compliance', 'risk'] as const) {
        const stance = lead === 'compliance' ? 'stricter' : 'escalate';
        s.applyEnvelope(INTENT_ID, envelope(seq++, 'lead_position', { crossing_id: id, lead, stance, basis: 'b' }));
      }
    }
    const session = useSessionStore.getState().sessions[INTENT_ID];
    for (const id of ids) {
      // exactly one rationale draft entry per crossing
      expect(session.rationales[id]).toBeDefined();
      expect(Array.isArray(session.rationales[id])).toBe(false);
      // at most two lead positions, at most one per lead
      const positions = session.leadPositions[id] ?? [];
      expect(positions.length).toBeLessThanOrEqual(2);
      expect(positions.filter((p) => p.lead === 'compliance').length).toBeLessThanOrEqual(1);
      expect(positions.filter((p) => p.lead === 'risk').length).toBeLessThanOrEqual(1);
    }
  });

  it('NEVER surfaces a lead position for a retracted crossing (wake-on-verified)', () => {
    const s = useSessionStore.getState();
    let seq = 1;
    s.applyEnvelope(INTENT_ID, envelope(seq++, 'threshold', crossingWithRule('c1', 'MICA_ART_5_1')));
    s.applyEnvelope(INTENT_ID, envelope(seq++, 'rationale_tok', { rationale_id: 'r1', crossing_id: 'c1', token: 'x' }));
    s.applyEnvelope(INTENT_ID, envelope(seq++, 'rationale_retracted', { rationale_id: 'r1', crossing_id: 'c1', final_score: 0.3, reason: 'NLI failed' }));
    // A lead position arriving for a retracted crossing must be dropped.
    s.applyEnvelope(INTENT_ID, envelope(seq++, 'lead_position', { crossing_id: 'c1', lead: 'compliance', stance: 'stricter', basis: 'b' }));
    const session = useSessionStore.getState().sessions[INTENT_ID];
    expect(session.rationales['c1'].status).toBe('retracted');
    expect(session.leadPositions['c1']).toBeUndefined();
  });

  it('drops a lead position that arrives before the rationale is verified (streaming)', () => {
    const s = useSessionStore.getState();
    let seq = 1;
    s.applyEnvelope(INTENT_ID, envelope(seq++, 'threshold', crossingWithRule('c1', 'MICA_ART_5_1')));
    s.applyEnvelope(INTENT_ID, envelope(seq++, 'rationale_tok', { rationale_id: 'r1', crossing_id: 'c1', token: 'x' }));
    // still 'streaming' — not yet verified
    s.applyEnvelope(INTENT_ID, envelope(seq++, 'lead_position', { crossing_id: 'c1', lead: 'risk', stance: 'escalate', basis: 'b' }));
    expect(useSessionStore.getState().sessions[INTENT_ID].leadPositions['c1']).toBeUndefined();
  });

  it('reconstructs positions and findings from a full replay', () => {
    const s = useSessionStore.getState();
    const replay: ServerEnvelope[] = [
      envelope(1, 'threshold', crossingWithRule('c1', 'MICA_ART_5_1')),
      envelope(2, 'rationale_tok', { rationale_id: 'r1', crossing_id: 'c1', token: 'hi' }),
      envelope(3, 'rationale_verified', { rationale_id: 'r1', crossing_id: 'c1', final_score: 0.9 }),
      envelope(4, 'lead_position', { crossing_id: 'c1', lead: 'compliance', stance: 'satisfy_both', basis: 'b' }),
      envelope(5, 'lead_position', { crossing_id: 'c1', lead: 'risk', stance: 'hold', basis: 'b' }),
      envelope(6, 'auditor_finding', { crossing_id: 'c1', target: 'lead_position', verdict: 'advisory', basis: 'flag' }),
    ];
    s.replayAuditEnvelopes(INTENT_ID, replay);
    const session = useSessionStore.getState().sessions[INTENT_ID];
    expect(session.leadPositions['c1']).toHaveLength(2);
    expect(session.auditorFindings['c1']).toHaveLength(1);
    expect(session.lastSeq).toBe(6);
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
