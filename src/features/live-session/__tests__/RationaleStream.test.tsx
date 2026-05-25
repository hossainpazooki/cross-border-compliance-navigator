import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { useSessionStore } from '../store';
import { RationaleStream } from '../ui/RationaleStream';
import type { TradeIntent, ServerEnvelope } from '@platform/contracts';

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

function emit(seq: number, env: Omit<ServerEnvelope, 'seq' | 'ts'>): void {
  useSessionStore.getState().applyEnvelope(INTENT_ID, {
    seq,
    ts: '2026-05-15T10:00:00.000Z',
    ...env,
  } as ServerEnvelope);
}

beforeEach(() => {
  useSessionStore.setState({ sessions: {} });
  useSessionStore.getState().openSession(INTENT_ID, intent());
  cleanup();
});

describe('RationaleStream', () => {
  it('shows the waiting state when no rationale exists', () => {
    render(<RationaleStream intentId={INTENT_ID} crossingId="c1" />);
    expect(screen.getByText(/waiting for rationale/i)).toBeInTheDocument();
  });

  it('renders streaming badge during token stream', () => {
    emit(1, {
      type: 'rationale_tok',
      payload: { rationale_id: 'r1', crossing_id: 'c1', token: 'Hello' },
    });
    render(<RationaleStream intentId={INTENT_ID} crossingId="c1" />);
    expect(screen.getByText(/streaming/i)).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('transitions to verified badge with score after rationale_verified', () => {
    emit(1, {
      type: 'rationale_tok',
      payload: { rationale_id: 'r1', crossing_id: 'c1', token: 'Hello' },
    });
    emit(2, {
      type: 'rationale_verified',
      payload: { rationale_id: 'r1', crossing_id: 'c1', final_score: 0.87 },
    });
    render(<RationaleStream intentId={INTENT_ID} crossingId="c1" />);
    expect(screen.getByText(/verified/i)).toBeInTheDocument();
    expect(screen.getByText('0.87')).toBeInTheDocument();
  });

  it('transitions to retracted badge with reason after rationale_retracted', () => {
    emit(1, {
      type: 'rationale_tok',
      payload: { rationale_id: 'r1', crossing_id: 'c1', token: 'bad claim' },
    });
    emit(2, {
      type: 'rationale_retracted',
      payload: {
        rationale_id: 'r1',
        crossing_id: 'c1',
        final_score: 0.42,
        reason: 'NLI failed',
      },
    });
    render(<RationaleStream intentId={INTENT_ID} crossingId="c1" />);
    expect(screen.getByText(/retracted/i)).toBeInTheDocument();
    expect(screen.getByText('0.42')).toBeInTheDocument();
    expect(screen.getByText('NLI failed')).toBeInTheDocument();
  });
});
