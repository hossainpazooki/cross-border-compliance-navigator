// SOURCE: regulatory-rule-engine `src/workflows/schemas.py` RuleConflict.resolution_strategy.
//   Mirrors the app-side `RuleConflict['resolution_strategy']` union in
//   src/types/navigate.ts. Hoisted into @platform/contracts because the agent
//   org model's compliance LeadPosition.stance reuses it (see ./position) and
//   contracts is the single source of truth for cross-protocol shapes.
//
// A conflict-resolution strategy: how the Lead Compliance Officer reconciles
// divergent obligations across jurisdictions for a compliance-type crossing.
export type ConflictResolution =
  | 'cumulative'
  | 'stricter'
  | 'home_jurisdiction'
  | 'satisfy_both'
  | 'earliest';
