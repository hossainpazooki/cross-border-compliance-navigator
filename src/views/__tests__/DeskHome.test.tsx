import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { DeskHome } from '../DeskHome';
import { useDeskStore } from '@app/stores';
import { useSessionStore } from '@features/live-session';
import { DESKS } from '@shared/config/desks';
import type { TradeIntent } from '@platform/contracts';

function renderHome() {
  // Mirror app/providers.tsx options. The verification hook is a React Query
  // hook (it fires no query in snapshot mode, but the component still calls
  // useQuery, which requires a provider in scope).
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DeskHome />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function intent(intentId: string): TradeIntent {
  return {
    intent_id: intentId,
    direction: 'buy',
    asset: 'ETHUSDT',
    notional_usd: '100000',
    venue_jurisdiction: 'EU',
    investor_type: 'professional',
    target_jurisdictions: ['EU'],
    holding_period_days: 1,
  };
}

beforeEach(() => {
  cleanup();
  useSessionStore.setState({ sessions: {} });
  useDeskStore.setState({
    activeDeskId: DESKS[0].id,
    activeMemberId: DESKS[0].members[0].id,
    sessionDeskMap: {},
  });
});

describe('DeskHome', () => {
  it('renders the desk identity', () => {
    renderHome();
    expect(screen.getByRole('heading', { name: 'EU Issuance Desk' })).toBeInTheDocument();
    expect(screen.getByText('Meridian Capital')).toBeInTheDocument();
  });

  it('renders the ATLAS provenance card with the real artifact hash and test-key badge', () => {
    renderHome();
    expect(screen.getByTestId('provenance-mica_2023')).toBeInTheDocument();
    // Short form of the GOLDEN hash for rule_reserve_assets (shown in the
    // provenance card and echoed in the teaching line).
    expect(screen.getAllByText('13a414cf7f6b…').length).toBeGreaterThan(0);
    // Honestly labeled as a test key (appears per signed artifact).
    expect(screen.getAllByText(/test-key: test-fixed-seed-1/).length).toBeGreaterThan(0);
    // The surfaced-not-verified disclosure.
    expect(screen.getByText(/not re-verified/i)).toBeInTheDocument();
    // Lifecycle is honestly NOT established by the static snapshot (brief §3 #11).
    expect(screen.getByText(/Lifecycle state .* is NOT established/i)).toBeInTheDocument();
    expect(screen.getAllByText(/lifecycle unknown/i).length).toBeGreaterThan(0);
  });

  it('shows the "Not verified (snapshot)" chip for every signed artifact in default (flag off) mode', () => {
    renderHome();
    // Flag off -> verifyMode() is 'off' -> the hook returns SNAPSHOT_DECISION
    // synchronously and fires no query. Each signed artifact gets the amber chip.
    const chips = screen.getAllByText(/Not verified \(snapshot\)/i);
    expect(chips.length).toBeGreaterThan(0);
    // One chip per signed artifact (the same artifacts that carry a test-key badge).
    const testKeyBadges = screen.getAllByText(/test-key: test-fixed-seed-1/);
    expect(chips.length).toBe(testKeyBadges.length);
  });

  it('renders the member roster with the active member highlighted', () => {
    renderHome();
    expect(screen.getByText('Aria Lindqvist')).toBeInTheDocument();
    expect(screen.getByText('Tomas Berg')).toBeInTheDocument();
    expect(screen.getByText('you')).toBeInTheDocument();
  });

  it('teaches the model with the empty-session activity state', () => {
    renderHome();
    expect(screen.getByText(/No live sessions yet/i)).toBeInTheDocument();
  });

  describe('Activity — desk-scoped live sessions', () => {
    it('lists a live session associated with the active desk, linking to /live/{id}', () => {
      useSessionStore.getState().openSession('intent-eu-1', intent('intent-eu-1'));
      useDeskStore.getState().associateSession('intent-eu-1', DESKS[0].id);

      renderHome();

      const link = screen.getByRole('link', { name: /intent-eu-1/ });
      expect(link).toHaveAttribute('href', '/live/intent-eu-1');
      expect(screen.queryByText(/No live sessions yet/i)).not.toBeInTheDocument();
    });

    it('does NOT list a session associated with a different desk', () => {
      useSessionStore.getState().openSession('intent-other', intent('intent-other'));
      useDeskStore.getState().associateSession('intent-other', DESKS[1].id);

      renderHome();

      expect(screen.queryByText(/intent-other/)).not.toBeInTheDocument();
      // No session belongs to the active desk → teaching empty-state holds.
      expect(screen.getByText(/No live sessions yet/i)).toBeInTheDocument();
    });

    it('ignores an association whose session is no longer live', () => {
      // Stamped for the active desk, but never opened (or already closed) in the
      // session store → must not surface as live activity.
      useDeskStore.getState().associateSession('intent-stale', DESKS[0].id);

      renderHome();

      expect(screen.queryByText(/intent-stale/)).not.toBeInTheDocument();
      expect(screen.getByText(/No live sessions yet/i)).toBeInTheDocument();
    });
  });
});
