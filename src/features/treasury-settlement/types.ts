/**
 * Treasury intent-loop wire types (Stage C(b)).
 *
 * These mirror the Go authorization gate's JSON verbatim
 * (treasury-intent-controller `cmd/server`, CONTRACT-DURABILITY §V2 +
 * CONTRACT-SCORER §S.1) — field names are the cross-repo seam and must never
 * be renamed here. The ACHIEVED trace contract is
 * `{intent_id, idempotency_key, rule_artifact_hash, intent_spec_hash,
 * trajectory_hash, seq}`.
 */

export interface GateCriterion {
  name: string;
  threshold: number;
  volatility: 'stable' | 'volatile';
}

export interface GateSpec {
  action_class: string;
  criteria: GateCriterion[];
  idempotency_scope: string;
}

export interface GateDeclareRequest {
  episode_seed: string;
  idempotency_key: string;
  rule_artifact_hash?: string;
  intent_spec_hash?: string;
  spec: GateSpec;
}

/** The gate's synchronous answer. OBSERVATION ONLY: settlement authority is
 * the durable feed (an observed ACHIEVED record), never this response. */
export interface GateDeclareResponse {
  terminal: string; // "ACHIEVED" | "FAILED" | "FAILED_AT_DISPATCH" | ...
  reason: string;
  trajectory_hash: string;
  achieved_seq?: number;
}

/** One durable-feed record (GET /v2/events). ACHIEVED records additionally
 * carry the trace-contract fields. */
export interface GateEventRecord {
  seq: number;
  intent_seq: number;
  intent_id: string;
  type: string;
  detail?: string;
  idempotency_key?: string;
  rule_artifact_hash?: string;
  intent_spec_hash?: string;
  trajectory_hash?: string;
}

export interface GateEventsPage {
  events: GateEventRecord[];
  /** Max GlobalSeq returned, or the input `since` — the resume cursor. */
  next_since: number;
}

/** A settlement recomputed from an OBSERVED ACHIEVED record. Never built from
 * a declare response. */
export interface SettlementRecord {
  idempotency_key: string;
  intent_id: string;
  /** GlobalSeq of the ACHIEVED record this settlement was recomputed from. */
  seq: number;
  intent_spec_hash?: string;
  rule_artifact_hash?: string;
  trajectory_hash?: string;
}
