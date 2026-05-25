// SOURCE: institutional-defi-platform-api/src/market_risk/schemas.py
//   class TradeIntent(BaseModel) — defined in dev/briefs/live-threshold-rationale-spec.md §3
//   (pending backend implementation in market_risk module).
// Decimal fields are serialized as JSON strings to preserve precision.
export interface TradeIntent {
  intent_id: string;
  direction: 'buy' | 'sell';
  asset: string;
  notional_usd: string;
  venue_jurisdiction: string;
  investor_type: 'retail' | 'professional' | 'eligible_counterparty';
  target_jurisdictions: string[];
  holding_period_days: number;
}
