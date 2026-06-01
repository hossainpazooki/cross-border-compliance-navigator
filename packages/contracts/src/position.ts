// SOURCE: regulatory-rule-engine (planned) `src/agents/schemas.py`
//   class LeadPosition(BaseModel) / class AuditorFinding(BaseModel) — the agent
//   org model from dev/briefs/agent-org-spec.md (Appendix A). Pending backend
//   implementation; the agent runtime lives backend-side and is out of scope.
//
// Both artifacts are crossing_id-keyed and ride the existing WS envelope union
// (see ./envelope) so they reconstruct from `replayAuditEnvelopes` alongside
// rationales. At most one orchestrating lead and one draft exist per crossing;
// each crossing yields ≤2 lead positions (one Compliance, one Risk) and N
// auditor findings (Appendix A §A.3).
import type { ConflictResolution } from './conflict';

/**
 * A lead's finalized position on a verified crossing. The orchestrating lead
 * (selected by rule_id; see live-session `orchestratorRouting.ts`) finalizes
 * its position; the other lead consumes the verified draft and adds its own.
 *
 * Leads wake on `rationale_verified`, never on the raw crossing — so a position
 * is only ever spent on a grounded draft (Appendix A §A.4 control-flow rule).
 */
export interface LeadPosition {
  crossing_id: string;
  lead: 'compliance' | 'risk';
  /**
   * Compliance positions reuse the RuleConflict resolution union (a strategy
   * for reconciling jurisdictions). Risk positions are an escalation decision.
   */
  stance: LeadStance;
  basis: string;
}

/** Compliance stance: the conflict-resolution strategy the LCO selected. */
export type ComplianceStance = ConflictResolution;

/** Risk stance: the LRO's run-time escalation decision. */
export type RiskStance = 'escalate' | 'hold';

export type LeadStance = ComplianceStance | RiskStance;

/**
 * An auditor finding. The auditor reports to the board (independent line), not
 * to the leads (Appendix A §A.2). Two-tiered:
 *
 *  - `target: 'rationale'` — the deterministic grounding pass. A FAIL verdict
 *    IS the existing NLI gate and surfaces via `rationale_retracted`.
 *  - `target: 'lead_position'` — the advisory LLM challenge pass. ADVISORY ONLY:
 *    it flags to the board and NEVER blocks / retracts. Render visually distinct
 *    from a retraction so "ungrounded claim" is never conflated with "debatable
 *    judgment" (Appendix A §A.4).
 */
export interface AuditorFinding {
  crossing_id: string;
  target: 'rationale' | 'lead_position';
  verdict: 'pass' | 'fail' | 'advisory';
  basis: string;
}
