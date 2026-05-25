// SOURCE: dev/briefs/live-threshold-rationale-spec.md §7 (WebSocket Protocol) and brief §6.
// The spec defines verdict semantics across §5 (Verdict Integration) and §7 message payloads;
// the brief pins the union to these three values.
// Pydantic origin (planned): institutional-defi-platform-api/src/market_risk/schemas.py
// — to be added when the backend Verdict enum lands. JurisdictionStatus in
// src/workflows/schemas.py covers compliance/blocked/requires_action and is the closest
// existing enum; the live-session frontend uses the Verdict tri-state directly.
export type Verdict = 'compliant' | 'conditional' | 'blocked';
