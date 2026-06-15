import { describe, expect, it } from 'vitest';
import {
  SPECIALISTS,
  SPECIALIST_PREFIX_MAP,
  specialistFor,
} from '../specialistRouting';

describe('specialistFor', () => {
  it('maps each regulator namespace to its specialist seat', () => {
    expect(specialistFor('MICA_ART_5_1')).toBe('EU');
    expect(specialistFor('FCA_RP_3_2')).toBe('UK');
    expect(specialistFor('SEC_REG_D')).toBe('US');
    expect(specialistFor('FINMA_ART_1')).toBe('CH');
    expect(specialistFor('MAS_PS_ACT_2')).toBe('SG');
  });

  it('implicates no specialist for RISK_ crossings (LRO judgment, no rule subtree)', () => {
    expect(specialistFor('RISK_VAR_95')).toBeNull();
    expect(specialistFor('RISK_SLIPPAGE')).toBeNull();
  });

  it('is total: unknown namespaces resolve to null, never throw', () => {
    expect(specialistFor('UNKNOWN_RULE')).toBeNull();
    expect(specialistFor('')).toBeNull();
    expect(specialistFor('mica_lowercase')).toBeNull();
  });

  it('seats exactly the five README jurisdictions, each reachable from the prefix map', () => {
    const seats = SPECIALISTS.map((s) => s.jurisdiction);
    expect(seats).toEqual(['EU', 'UK', 'US', 'CH', 'SG']);
    expect(new Set(Object.values(SPECIALIST_PREFIX_MAP))).toEqual(new Set(seats));
  });
});
