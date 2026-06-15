import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { useSessionStore } from '../store';
import { OrgPanel } from '../ui/OrgPanel';
import type {
  ServerEnvelope,
  ThresholdCrossing,
  TradeIntent,
  TradeSnapshot,
} from '@platform/contracts';

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

function snap(): TradeSnapshot {
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

function crossing(id: string, citation: string): ThresholdCrossing {
  return {
    crossing_id: id,
    intent_id: INTENT_ID,
    ts: '2026-05-15T10:00:01.000Z',
    rule_id: 'MICA_ART_5_1',
    citation,
    boundary: '1000000',
    direction: 'crossed_up',
    snapshot: snap(),
    prior_verdict: 'compliant',
    new_verdict: 'conditional',
  };
}

function env<T extends ServerEnvelope['type']>(
  seq: number,
  type: T,
  payload: Extract<ServerEnvelope, { type: T }>['payload']
): ServerEnvelope {
  return { seq, ts: '2026-05-15T10:00:01.000Z', type, payload } as ServerEnvelope;
}

function apply(e: ServerEnvelope): void {
  useSessionStore.getState().applyEnvelope(INTENT_ID, e);
}

/** Drive a crossing to a verified rationale. Returns next seq. */
function verify(seq: number, id: string, citation: string): number {
  apply(env(seq++, 'threshold', crossing(id, citation)));
  apply(env(seq++, 'rationale_tok', { rationale_id: `r-${id}`, crossing_id: id, token: 'draft text' }));
  apply(env(seq++, 'rationale_verified', { rationale_id: `r-${id}`, crossing_id: id, final_score: 0.9 }));
  return seq;
}

beforeEach(() => {
  cleanup();
  useSessionStore.setState({ sessions: {} });
  useSessionStore.getState().openSession(INTENT_ID, intent());
});

describe('OrgPanel', () => {
  it('shows the idle state before any crossing', () => {
    render(<OrgPanel intentId={INTENT_ID} />);
    expect(screen.getByText(/agent org is idle/i)).toBeInTheDocument();
  });

  it('renders both lead positions under a verified crossing', () => {
    let seq = verify(1, 'c1', 'MiCA Art. 5(1)');
    apply(env(seq++, 'lead_position', { crossing_id: 'c1', lead: 'compliance', stance: 'stricter', basis: 'apply stricter EU rule' }));
    apply(env(seq++, 'lead_position', { crossing_id: 'c1', lead: 'risk', stance: 'hold', basis: 'VaR within limit' }));

    render(<OrgPanel intentId={INTENT_ID} crossingId="c1" />);

    expect(screen.getByTestId('lead-position-compliance')).toHaveTextContent('apply stricter EU rule');
    expect(screen.getByTestId('lead-position-risk')).toHaveTextContent('VaR within limit');
    expect(screen.getByText('Lead Compliance')).toBeInTheDocument();
    expect(screen.getByText('Lead Risk')).toBeInTheDocument();
  });

  it('renders advisory findings flagged, not as retractions', () => {
    let seq = verify(1, 'c1', 'MiCA Art. 5(1)');
    apply(env(seq++, 'lead_position', { crossing_id: 'c1', lead: 'compliance', stance: 'stricter', basis: 'b' }));
    apply(env(seq++, 'auditor_finding', { crossing_id: 'c1', target: 'lead_position', verdict: 'advisory', basis: 'consider satisfy_both' }));

    render(<OrgPanel intentId={INTENT_ID} crossingId="c1" />);

    const advisory = screen.getByTestId('auditor-finding-advisory');
    expect(advisory).toHaveTextContent('consider satisfy_both');
    expect(advisory).toHaveTextContent(/advisory flag/i);
    // It must NOT be styled/labeled as a retraction.
    expect(advisory).not.toHaveTextContent(/retraction/i);
  });

  it('shows the routing line and an EU wake dot before any position arrives', () => {
    let seq = 1;
    apply(env(seq++, 'threshold', crossing('c1', 'MiCA Art. 5(1)')));

    render(<OrgPanel intentId={INTENT_ID} crossingId="c1" />);

    // One crossing → one orchestrator, visible from the start.
    expect(screen.getByTestId('org-orchestrator')).toHaveTextContent(
      /routed to Lead Compliance Officer \(LCO\)/
    );
    // Lazy wake: MICA_ implicates exactly the EU specialist.
    expect(screen.getByTestId('specialist-seat-EU')).toHaveAccessibleName(/woken/);
    expect(screen.getByTestId('specialist-seat-UK')).toHaveAccessibleName(/idle/);
  });

  it('renders the NLI gate as an explicit stage across its three states', () => {
    let seq = 1;
    apply(env(seq++, 'threshold', crossing('c1', 'MiCA Art. 5(1)')));
    apply(env(seq++, 'rationale_tok', { rationale_id: 'r1', crossing_id: 'c1', token: 'draft' }));

    const { unmount } = render(<OrgPanel intentId={INTENT_ID} crossingId="c1" />);
    expect(screen.getByTestId('org-gate')).toHaveTextContent(/awaiting grounding/i);
    unmount();

    apply(env(seq++, 'rationale_retracted', { rationale_id: 'r1', crossing_id: 'c1', final_score: 0.3, reason: 'NLI failed' }));
    render(<OrgPanel intentId={INTENT_ID} crossingId="c1" />);
    const gate = screen.getByTestId('org-gate');
    expect(gate).toHaveTextContent(/draft died at the gate/i);
    expect(gate).toHaveTextContent('NLI failed');
  });

  it('renders nothing for a retracted crossing’s positions (wake-on-verified)', () => {
    let seq = 1;
    apply(env(seq++, 'threshold', crossing('c1', 'MiCA Art. 5(1)')));
    apply(env(seq++, 'rationale_tok', { rationale_id: 'r1', crossing_id: 'c1', token: 'x' }));
    apply(env(seq++, 'rationale_retracted', { rationale_id: 'r1', crossing_id: 'c1', final_score: 0.3, reason: 'NLI failed' }));
    // A lead position for the retracted crossing is dropped by the store guard.
    apply(env(seq++, 'lead_position', { crossing_id: 'c1', lead: 'compliance', stance: 'stricter', basis: 'should not appear' }));

    render(<OrgPanel intentId={INTENT_ID} crossingId="c1" />);

    expect(screen.queryByTestId('lead-position-compliance')).not.toBeInTheDocument();
    expect(screen.getByText(/leads wake only on a verified rationale/i)).toBeInTheDocument();
    expect(screen.queryByText('should not appear')).not.toBeInTheDocument();
  });
});
