import { describe, expect, it } from 'vitest';
import { isWSEnvelope, isMessageType } from '@platform/contracts';

// Guard coverage for the agent-org envelope types (Phase 1). Mirrors the
// rationale_* guard discipline: well-formed envelopes accept, malformed reject.

const base = { seq: 1, ts: '2026-05-15T10:00:00.000Z' };

describe('isMessageType — agent-org types', () => {
  it('recognizes lead_position and auditor_finding', () => {
    expect(isMessageType('lead_position')).toBe(true);
    expect(isMessageType('auditor_finding')).toBe(true);
  });

  it('rejects unknown types', () => {
    expect(isMessageType('lead_opinion')).toBe(false);
    expect(isMessageType('')).toBe(false);
  });
});

describe('isWSEnvelope — lead_position', () => {
  it('accepts a well-formed compliance position with a resolution stance', () => {
    expect(
      isWSEnvelope({
        ...base,
        type: 'lead_position',
        payload: { crossing_id: 'c1', lead: 'compliance', stance: 'satisfy_both', basis: 'EU+UK both apply' },
      })
    ).toBe(true);
  });

  it('accepts a well-formed risk position with escalate/hold', () => {
    expect(
      isWSEnvelope({
        ...base,
        type: 'lead_position',
        payload: { crossing_id: 'c1', lead: 'risk', stance: 'escalate', basis: 'VaR breach' },
      })
    ).toBe(true);
    expect(
      isWSEnvelope({
        ...base,
        type: 'lead_position',
        payload: { crossing_id: 'c1', lead: 'risk', stance: 'hold', basis: 'within limit' },
      })
    ).toBe(true);
  });

  it('rejects a compliance lead carrying a risk stance', () => {
    expect(
      isWSEnvelope({
        ...base,
        type: 'lead_position',
        payload: { crossing_id: 'c1', lead: 'compliance', stance: 'escalate', basis: 'x' },
      })
    ).toBe(false);
  });

  it('rejects a risk lead carrying a compliance stance', () => {
    expect(
      isWSEnvelope({
        ...base,
        type: 'lead_position',
        payload: { crossing_id: 'c1', lead: 'risk', stance: 'satisfy_both', basis: 'x' },
      })
    ).toBe(false);
  });

  it('rejects an unknown lead', () => {
    expect(
      isWSEnvelope({
        ...base,
        type: 'lead_position',
        payload: { crossing_id: 'c1', lead: 'legal', stance: 'stricter', basis: 'x' },
      })
    ).toBe(false);
  });

  it('rejects a missing crossing_id or basis', () => {
    expect(
      isWSEnvelope({
        ...base,
        type: 'lead_position',
        payload: { lead: 'compliance', stance: 'stricter', basis: 'x' },
      })
    ).toBe(false);
    expect(
      isWSEnvelope({
        ...base,
        type: 'lead_position',
        payload: { crossing_id: 'c1', lead: 'compliance', stance: 'stricter' },
      })
    ).toBe(false);
  });
});

describe('isWSEnvelope — auditor_finding', () => {
  it('accepts a rationale-target fail (the NLI gate)', () => {
    expect(
      isWSEnvelope({
        ...base,
        type: 'auditor_finding',
        payload: { crossing_id: 'c1', target: 'rationale', verdict: 'fail', basis: 'sourceRef not in trace' },
      })
    ).toBe(true);
  });

  it('accepts an advisory lead_position finding', () => {
    expect(
      isWSEnvelope({
        ...base,
        type: 'auditor_finding',
        payload: { crossing_id: 'c1', target: 'lead_position', verdict: 'advisory', basis: 'consider stricter' },
      })
    ).toBe(true);
  });

  it('rejects an unknown target or verdict', () => {
    expect(
      isWSEnvelope({
        ...base,
        type: 'auditor_finding',
        payload: { crossing_id: 'c1', target: 'board', verdict: 'pass', basis: 'x' },
      })
    ).toBe(false);
    expect(
      isWSEnvelope({
        ...base,
        type: 'auditor_finding',
        payload: { crossing_id: 'c1', target: 'rationale', verdict: 'maybe', basis: 'x' },
      })
    ).toBe(false);
  });

  it('rejects a non-object payload', () => {
    expect(isWSEnvelope({ ...base, type: 'auditor_finding', payload: null })).toBe(false);
  });
});
