// SOURCE: institutional-defi-platform-api/src/market_risk/live_session/intents_router.py
// Decimal fields (notional_usd) are serialized as JSON strings to preserve precision.

export type InvestorType = 'retail' | 'professional' | 'eligible_counterparty';
export type IntentDirection = 'buy' | 'sell';
export type IntentStatus = 'created' | 'active' | 'closed' | 'failed';

// Body for POST /v2/intents. Backend rejects extra fields (Pydantic extra="forbid"),
// and rejects intent_id — the server generates one.
export interface IntentCreateRequest {
  direction: IntentDirection;
  asset: string;
  notional_usd: string;
  venue_jurisdiction: string;
  investor_type: InvestorType;
  target_jurisdictions: string[];
  holding_period_days: number;
}

// Persisted intent record returned by POST /v2/intents and GET /v2/intents/{id}.
export interface IntentRecord extends IntentCreateRequest {
  intent_id: string;
  status: IntentStatus;
  created_at: string;
  activated_at?: string | null;
  closed_at?: string | null;
  last_error?: { code: string; message: string } | null;
}

// Legacy alias used by the in-browser session store. Kept as a permissive shape
// that satisfies both the request (no intent_id) and the persisted record.
export interface TradeIntent extends IntentCreateRequest {
  intent_id: string;
}
