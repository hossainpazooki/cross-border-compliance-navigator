import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { LiveIntent } from '../LiveIntent';
import { useDeskStore } from '@app/stores';
import { useSessionStore } from '@features/live-session';
import { DESKS } from '@shared/config/desks';

function renderIntent() {
  return render(
    <MemoryRouter>
      <LiveIntent />
    </MemoryRouter>
  );
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

// The venue <select> is the combobox whose current value is a jurisdiction code
// (the other selects hold direction/investor-type values).
const JURISDICTION_CODES = ['EU', 'UK', 'US', 'CH', 'SG'];
function venueSelect(): HTMLSelectElement {
  const combos = screen.getAllByRole('combobox') as HTMLSelectElement[];
  const venue = combos.find((c) => JURISDICTION_CODES.includes(c.value));
  if (!venue) throw new Error('venue select not found');
  return venue;
}

describe('LiveIntent — desk prefill', () => {
  it('pre-fills the venue from the active desk’s first jurisdiction', () => {
    // EU Issuance Desk → jurisdictions ['EU'].
    renderIntent();
    expect(venueSelect().value).toBe(DESKS[0].jurisdictions[0]);
  });

  it('pre-selects the active desk’s jurisdictions as target chips', () => {
    // Multi-Jurisdiction Desk → ['EU','UK','CH']; each should render selected.
    const multi = DESKS[1];
    useDeskStore.setState({
      activeDeskId: multi.id,
      activeMemberId: multi.members[0].id,
      sessionDeskMap: {},
    });

    renderIntent();

    expect(venueSelect().value).toBe(multi.jurisdictions[0]);

    // A target chip is "on" when it carries the selected styling.
    for (const code of multi.jurisdictions) {
      const chip = screen.getByRole('button', { name: new RegExp(`${code}$`) });
      expect(chip.className).toContain('border-blue-500');
    }
  });
});
