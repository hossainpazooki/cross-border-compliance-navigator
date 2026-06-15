// Specialist routing for the agent org model (sibling to orchestratorRouting.ts).
//
// The README's org chart seats five jurisdiction specialists (EU/MiCA, UK/FCA,
// US/SEC-CFTC, CH/FINMA, SG/MAS), each scoped to its own rule subtree. The
// contract carries NO tasking envelope — which specialist a lead actually woke
// lives backend-side in the (future) agent runtime. This module is therefore a
// FRONTEND-DERIVED VIEW: it infers the implicated specialist from the
// crossing's originating `rule_id` namespace, with the same pure-total-lookup
// discipline as `orchestratorFor`. The UI labels it as derived; when the
// backend runtime lands, an explicit tasking artifact should replace this.
//
// `RISK_`-namespace crossings implicate no jurisdiction specialist — run-time
// risk breaches are the Lead Risk Officer's own judgment over the live
// snapshot, not a rule-subtree question.

export type SpecialistJurisdiction = 'EU' | 'UK' | 'US' | 'CH' | 'SG';

export interface SpecialistSeat {
  jurisdiction: SpecialistJurisdiction;
  /** Regulator label as seated in the README org chart. */
  label: string;
}

/** The five specialist seats, in the README org-chart order. */
export const SPECIALISTS: readonly SpecialistSeat[] = [
  { jurisdiction: 'EU', label: 'EU / MiCA' },
  { jurisdiction: 'UK', label: 'UK / FCA' },
  { jurisdiction: 'US', label: 'US / SEC-CFTC' },
  { jurisdiction: 'CH', label: 'CH / FINMA' },
  { jurisdiction: 'SG', label: 'SG / MAS' },
] as const;

/** rule_id namespace prefix → implicated specialist. */
export const SPECIALIST_PREFIX_MAP: Readonly<
  Record<string, SpecialistJurisdiction>
> = {
  MICA_: 'EU',
  FCA_: 'UK',
  SEC_: 'US',
  FINMA_: 'CH',
  MAS_: 'SG',
};

/**
 * Resolve the specialist implicated by a crossing's `rule_id`, or `null` when
 * none is (RISK_ namespace, unknown namespaces). Pure and total.
 */
export function specialistFor(ruleId: string): SpecialistJurisdiction | null {
  for (const [prefix, jurisdiction] of Object.entries(SPECIALIST_PREFIX_MAP)) {
    if (ruleId.startsWith(prefix)) return jurisdiction;
  }
  return null;
}
