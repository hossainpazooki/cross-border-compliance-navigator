// SOURCE: institutional-defi-platform-api/src/market_risk/schemas.py
//   class TradeSnapshot(BaseModel) — defined in dev/briefs/live-threshold-rationale-spec.md §3
//   (pending backend implementation; pipeline described in spec §3).
// Decimal fields are serialized as JSON strings to preserve precision;
// ts is an ISO8601 timestamp; funding_rate is nullable per Pydantic source.
export interface TradeSnapshot {
  intent_id: string;
  ts: string;
  mark_price: string;
  bid: string;
  ask: string;
  size: string;
  spread_bps: number;
  slippage_bps: number;
  vol_30d: number;
  var_95_usd: number;
  funding_rate: number | null;
}
