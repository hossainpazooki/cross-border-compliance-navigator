import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import { useSessionStore } from '../store';
import { BoardBar } from '../ui/BoardBar';
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

/**
 * A codec-minted /v2/intents record: the server validates only
 * asset / notional_usd / venue_jurisdiction, so at runtime every legacy field
 * can be absent even though the TradeIntent type claims otherwise.
 */
function codecIntent(): TradeIntent {
  return {
    intent_id: INTENT_ID,
    asset: 'USDC',
    notional_usd: '5000000',
    venue_jurisdiction: 'EU',
  } as TradeIntent;
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
});

describe('BoardBar', () => {
  it('renders vitals, Go Live gate, and the auditor channel sections', () => {
    useSessionStore.getState().openSession(INTENT_ID, intent());
    render(<BoardBar intentId={INTENT_ID} />);

    expect(screen.getByText('ETHUSDT')).toBeInTheDocument();
    expect(screen.getByText(/CH → EU/)).toBeInTheDocument();
    expect(screen.getByTestId('gate-go-live')).toHaveTextContent('Go Live');
    expect(screen.getByText('Advisory flags')).toBeInTheDocument();
    expect(screen.getByText('Retraction log')).toBeInTheDocument();
  });

  it('does NOT crash on a codec-minted intent missing legacy fields (regression)', () => {
    useSessionStore.getState().openSession(INTENT_ID, codecIntent());
    render(<BoardBar intentId={INTENT_ID} />);

    expect(screen.getByText('USDC')).toBeInTheDocument();
    // No target_jurisdictions → em-dash fallback, no .join crash.
    expect(screen.getByText(/EU → —/)).toBeInTheDocument();
  });

  it('enables conflict sign-off only after a compliance lead position exists', () => {
    useSessionStore.getState().openSession(INTENT_ID, intent());
    render(<BoardBar intentId={INTENT_ID} />);
    expect(screen.getByTestId('gate-conflict-signoff')).toBeDisabled();
    cleanup();

    let seq = verify(1, 'c1', 'MiCA Art. 5(1)');
    apply(env(seq++, 'lead_position', { crossing_id: 'c1', lead: 'compliance', stance: 'stricter', basis: 'apply stricter EU rule' }));

    render(<BoardBar intentId={INTENT_ID} />);
    const gate = screen.getByTestId('gate-conflict-signoff');
    expect(gate).toBeEnabled();
    expect(gate).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(gate);
    expect(gate).toHaveAttribute('aria-pressed', 'true');
  });

  it('badges the auditor channel with advisory-flag and retraction counts', () => {
    useSessionStore.getState().openSession(INTENT_ID, intent());
    let seq = verify(1, 'c1', 'MiCA Art. 5(1)');
    apply(env(seq++, 'lead_position', { crossing_id: 'c1', lead: 'compliance', stance: 'stricter', basis: 'b' }));
    apply(env(seq++, 'auditor_finding', { crossing_id: 'c1', target: 'lead_position', verdict: 'advisory', basis: 'consider satisfy_both' }));
    // A second crossing whose draft dies at the gate → retraction log.
    apply(env(seq++, 'threshold', crossing('c2', 'FCA RP §3.2')));
    apply(env(seq++, 'rationale_tok', { rationale_id: 'r-c2', crossing_id: 'c2', token: 'x' }));
    apply(env(seq++, 'rationale_retracted', { rationale_id: 'r-c2', crossing_id: 'c2', final_score: 0.3, reason: 'NLI failed' }));

    render(<BoardBar intentId={INTENT_ID} />);

    const flags = screen.getByText('Advisory flags').closest('button');
    const retractions = screen.getByText('Retraction log').closest('button');
    expect(flags).toHaveTextContent('1');
    expect(retractions).toHaveTextContent('1');
  });
});
