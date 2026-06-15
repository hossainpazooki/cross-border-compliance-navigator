import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { SpecialistsRow } from '../ui/SpecialistsRow';

describe('SpecialistsRow', () => {
  it('wakes exactly the implicated specialist for a MiCA crossing', () => {
    render(<SpecialistsRow ruleId="MICA_ART_5_1" />);

    expect(screen.getByTestId('specialist-seat-EU')).toHaveAccessibleName(/woken/);
    for (const j of ['UK', 'US', 'CH', 'SG']) {
      expect(screen.getByTestId(`specialist-seat-${j}`)).toHaveAccessibleName(/idle/);
    }
  });

  it('wakes no specialist for a RISK_ crossing (LRO judgment, no rule subtree)', () => {
    render(<SpecialistsRow ruleId="RISK_VAR_95" />);

    for (const j of ['EU', 'UK', 'US', 'CH', 'SG']) {
      expect(screen.getByTestId(`specialist-seat-${j}`)).toHaveAccessibleName(/idle/);
    }
  });

  it('labels the wake state as derived, not runtime truth', () => {
    render(<SpecialistsRow ruleId="MICA_ART_5_1" />);
    expect(screen.getByText(/derived from rule namespace/i)).toBeInTheDocument();
  });
});
