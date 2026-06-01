// Phase 0 — orchestrator routing for the agent org model (Appendix A §A.3).
//
// A threshold crossing wakes EXACTLY ONE orchestrating lead, selected by the
// crossing's originating `rule_id`. This module is the single source of truth
// for that classification. It is a pure, deterministic lookup — no agent, no
// I/O — so it is safe to call from the store reducer and from tests.
//
// SOURCE (planned backend): regulatory-rule-engine `src/agents/routing.py`
//   `def orchestrator_for(rule_id: str) -> Lead` — the backend agent runtime
//   mirrors this table so frontend routing and backend tasking never diverge.
//   The agent runtime itself is out of scope here (frontend coordinates the
//   org; the runtime lives backend-side).
//
// --- Resolved open questions (Appendix A §A.9 / Phase 0 acceptance) ---------
//
//  1. TRANSPORT: LeadPosition and AuditorFinding ride the EXISTING WS envelope
//     union as two new `type`s (`lead_position`, `auditor_finding`). They are
//     crossing_id-keyed and therefore survive `replayAuditEnvelopes` alongside
//     rationales — no separate channel, no out-of-band state.
//
//  2. UI SURFACE: a dedicated "Org" panel in the live session (LiveSession.tsx),
//     NOT the legacy workbench tabs. The Org panel renders, per selected
//     crossing, the rationale draft + ≤2 lead positions + N auditor findings.

/**
 * Crossing-type / orchestrating-lead classification. A crossing is either a
 * compliance-type crossing (obligation / whitepaper / authorization threshold)
 * orchestrated by the Lead Compliance Officer, or a risk-type crossing (VaR /
 * slippage / position-limit breach) orchestrated by the Lead Risk Officer.
 *
 * This is the same union used for `LeadPosition.lead` in @platform/contracts.
 */
export type OrchestratingLead = 'compliance' | 'risk';

/**
 * Explicit rule_id → orchestrating-lead map, seeded from existing fixture ids.
 *
 * Compliance-type ids are enumerated; risk-type ids are matched by the `RISK_`
 * prefix (see {@link RISK_RULE_PREFIX}) because the backend reserves that
 * namespace for run-time risk breaches and the concrete ids are not yet pinned.
 *
 * Unknown ids default to `'compliance'` — a missed obligation (regulatory
 * exposure) is strictly worse than a missed risk flag, so the safer default is
 * to route an unrecognized crossing to the Compliance lead.
 */
export const RULE_ORCHESTRATOR_MAP: Readonly<Record<string, OrchestratingLead>> = {
  MICA_ART_5_1: 'compliance',
  MICA_ART_5_2: 'compliance',
  FCA_RP_3_2: 'compliance',
  SEC_REG_D: 'compliance',
};

/** Reserved namespace prefix for risk-type rule ids (e.g. `RISK_VAR_95`). */
export const RISK_RULE_PREFIX = 'RISK_';

/** Default orchestrator for an unrecognized rule_id. See map docstring for why. */
export const DEFAULT_ORCHESTRATOR: OrchestratingLead = 'compliance';

/**
 * Resolve the single orchestrating lead for a crossing's originating `rule_id`.
 *
 * Pure and total: every input resolves to exactly one lead, so a
 * dual-implicated crossing (one that trips both a MiCA obligation and a VaR
 * limit) is resolved deterministically here by its originating rule_id and is
 * NEVER escalated to a runtime "which lead?" decision (Appendix A §A.7).
 */
export function orchestratorFor(ruleId: string): OrchestratingLead {
  const explicit = RULE_ORCHESTRATOR_MAP[ruleId];
  if (explicit) return explicit;
  if (ruleId.startsWith(RISK_RULE_PREFIX)) return 'risk';
  return DEFAULT_ORCHESTRATOR;
}
