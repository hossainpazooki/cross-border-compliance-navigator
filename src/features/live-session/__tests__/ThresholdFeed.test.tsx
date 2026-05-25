import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 220,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: index,
        start: index * 220,
        size: 220,
      })),
    measureElement: () => undefined,
  }),
}));

import { useSessionStore } from '../store';
import { ThresholdFeed } from '../ui/ThresholdFeed';
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

function emitThreshold(seq: number, id: string, citation: string): void {
  const env: ServerEnvelope = {
    seq,
    ts: '2026-05-15T10:00:01.000Z',
    type: 'threshold',
    payload: crossing(id, citation),
  };
  useSessionStore.getState().applyEnvelope(INTENT_ID, env);
}

beforeEach(() => {
  useSessionStore.setState({ sessions: {} });
  useSessionStore.getState().openSession(INTENT_ID, intent());
  cleanup();
});

describe('ThresholdFeed', () => {
  it('shows empty state and connection indicator before first crossing', () => {
    render(<ThresholdFeed intentId={INTENT_ID} />);
    expect(screen.getByText(/waiting for first crossing/i)).toBeInTheDocument();
    expect(screen.getByText(/connection:/i)).toBeInTheDocument();
  });

  it('renders a card for each crossing with its citation', () => {
    emitThreshold(1, 'c1', 'MiCA Art. 5(1)');
    emitThreshold(2, 'c2', 'FCA RP §3.2');
    render(<ThresholdFeed intentId={INTENT_ID} />);
    expect(screen.getByText('MiCA Art. 5(1)')).toBeInTheDocument();
    expect(screen.getByText('FCA RP §3.2')).toBeInTheDocument();
  });

  it('renders newest crossing first (prepend order)', () => {
    emitThreshold(1, 'c1', 'MiCA Art. 5(1)');
    emitThreshold(2, 'c2', 'FCA RP §3.2');
    render(<ThresholdFeed intentId={INTENT_ID} />);
    const articles = screen.getAllByRole('article');
    expect(articles[0]).toHaveTextContent('FCA RP §3.2');
    expect(articles[1]).toHaveTextContent('MiCA Art. 5(1)');
  });
});
