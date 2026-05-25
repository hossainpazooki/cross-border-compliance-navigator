// SOURCE: institutional-defi-platform-api/src/market_risk/schemas.py
//   class ThresholdCrossing(BaseModel) — defined in dev/briefs/live-threshold-rationale-spec.md §4
//   (pending backend implementation in market_risk module; detection logic in spec §4).
// The atomic unit of compliance: exactly one citation, one snapshot, one verdict transition.
import type { TradeSnapshot } from './snapshot';
import type { Verdict } from './verdict';

export interface ThresholdCrossing {
  crossing_id: string;
  intent_id: string;
  ts: string;
  rule_id: string;
  citation: string;
  boundary: string;
  direction: 'crossed_up' | 'crossed_down';
  snapshot: TradeSnapshot;
  prior_verdict: Verdict;
  new_verdict: Verdict;
}
