import { describe, it, expect } from 'vitest';
import { detectConflicts, mergeObligations, type EvaluatedRule } from '../conflicts';
import type { JurisdictionCode } from '../types';

function evaluated(
  jurisdiction: JurisdictionCode,
  decision: string,
  obligations: string[] = []
): EvaluatedRule {
  return {
    definition: {
      id: `rule-${jurisdiction}`,
      version: '1.0',
      name: `Rule ${jurisdiction}`,
      metadata: { jurisdiction, framework: 'test', effectiveDate: '2024-01-01' },
      tree: { nodeId: 'l', type: 'leaf', decision, status: 'compliant' },
    },
    result: {
      leaf: { nodeId: 'l', type: 'leaf', decision, status: 'compliant', obligations },
      trace: [],
    },
  };
}

describe('detectConflicts', () => {
  it('returns no conflicts for fewer than two rules', () => {
    expect(detectConflicts([])).toEqual([]);
    expect(detectConflicts([evaluated('EU', 'Classified as ART')])).toEqual([]);
  });

  it('detects classification divergence across jurisdictions', () => {
    const conflicts = detectConflicts([
      evaluated('EU', 'Classified as ART'),
      evaluated('UK', 'Classified as security token'),
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      type: 'classification_divergence',
      severity: 'warning',
      jurisdictions: ['EU', 'UK'],
      resolution_strategy: 'satisfy_both',
    });
  });

  it('reports no classification conflict when decisions agree', () => {
    const conflicts = detectConflicts([
      evaluated('EU', 'Classified as ART'),
      evaluated('UK', 'Classified as ART'),
    ]);
    expect(conflicts).toEqual([]);
  });

  it('detects a timeline conflict when deadlines differ by 15+ days', () => {
    const conflicts = detectConflicts([
      evaluated('EU', 'Notification required', ['Notify regulator within 30 days']),
      evaluated('SG', 'Notification required', ['Notify MAS within 60 days']),
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      type: 'timeline_conflict',
      jurisdictions: ['EU', 'SG'],
      resolution_strategy: 'earliest',
    });
    expect(conflicts[0].description).toContain('30 days');
    expect(conflicts[0].description).toContain('60 days');
  });

  it('ignores timeline differences under 15 days', () => {
    const conflicts = detectConflicts([
      evaluated('EU', 'Notification required', ['Notify within 30 days']),
      evaluated('SG', 'Notification required', ['Notify within 40 days']),
    ]);
    expect(conflicts).toEqual([]);
  });

  it('flags retail eligibility conflicts as blocking', () => {
    const conflicts = detectConflicts([
      evaluated('UK', 'Restricted', ['Retail prohibition applies to this product']),
      evaluated('SG', 'Permitted', ['Retail allowed under PSA exemption']),
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      type: 'obligation_conflict',
      severity: 'blocking',
      resolution_strategy: 'satisfy_both',
    });
  });

  it('flags registration conflicts as warning with stricter resolution', () => {
    const conflicts = detectConflicts([
      evaluated('US', 'Registration', ['Must register with the SEC']),
      evaluated('CH', 'Exempt', ['Registration exempt under DLT Act']),
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      type: 'obligation_conflict',
      severity: 'warning',
      resolution_strategy: 'stricter',
    });
  });

  it('detects independent conflict kinds in one pass', () => {
    const conflicts = detectConflicts([
      evaluated('EU', 'Classified as ART', ['Notify within 30 days']),
      evaluated('UK', 'Classified as security token', ['Notify within 90 days']),
    ]);
    const types = conflicts.map((c) => c.type).sort();
    expect(types).toEqual(['classification_divergence', 'timeline_conflict']);
  });
});

describe('mergeObligations', () => {
  it('deduplicates cumulative obligations across jurisdictions', () => {
    const merged = mergeObligations([
      evaluated('EU', 'd', ['Whitepaper required', 'Notify regulator']),
      evaluated('UK', 'd', ['Notify regulator', 'FCA notice']),
    ]);
    expect(merged).toEqual(['Whitepaper required', 'Notify regulator', 'FCA notice']);
  });

  it('returns empty for no rules', () => {
    expect(mergeObligations([])).toEqual([]);
  });
});
