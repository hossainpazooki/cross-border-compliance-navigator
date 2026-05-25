// SOURCE: institutional-defi-platform-api/src/market_risk/schemas.py
//   class Rationale(BaseModel) — defined in dev/briefs/live-threshold-rationale-spec.md §2 (data model)
//   and §6 (rationale streaming). Pending backend implementation.
// NLIStatus mirrors the spec's three-state lifecycle from §6: streaming → verified | retracted.
// final_score is populated only when status transitions to verified or retracted;
// retraction_reason is present only when retracted.
export type NLIStatus = 'streaming' | 'verified' | 'retracted';

export interface Rationale {
  rationale_id: string;
  crossing_id: string;
  content: string;
  status: NLIStatus;
  final_score?: number;
  retraction_reason?: string;
  completed_at?: string;
}
