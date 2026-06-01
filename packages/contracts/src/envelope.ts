// SOURCE: dev/briefs/live-threshold-rationale-spec.md §7 (WebSocket Protocol).
//   Envelope: {seq: int, ts: str (ISO8601), type: str, payload: object}
//   Server-side monotonic `seq` per session; clients use it for ordering and gap detection.
// Pydantic origin (planned): institutional-defi-platform-api/src/market_risk/ws_schemas.py
//   (to be added with the WS endpoint).
// crossing_id is included in rationale payloads alongside rationale_id so the client can
// route tokens to the correct crossing in O(1); the spec's §7 table lists only rationale_id
// but the §9 frontend store keys rationales by crossing_id.
import type { ThresholdCrossing } from './crossing';
import type { TradeSnapshot } from './snapshot';
import type { Verdict } from './verdict';
import type { LeadPosition, AuditorFinding, LeadStance } from './position';

export interface SubscribePayload {
  intent_id: string;
}

export interface CompliancePayload {
  crossing_id: string;
  prior_verdict: Verdict;
  new_verdict: Verdict;
  citation: string;
}

export interface RationaleTokPayload {
  rationale_id: string;
  crossing_id: string;
  token: string;
}

export interface RationaleVerifiedPayload {
  rationale_id: string;
  crossing_id: string;
  final_score: number;
}

export interface RationaleRetractedPayload {
  rationale_id: string;
  crossing_id: string;
  final_score: number;
  reason: string;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

export type RiskUpdatePayload = Record<string, unknown>;

// SOURCE: regulatory-rule-engine (planned) `src/agents/ws_schemas.py`.
// LeadPosition / AuditorFinding ride the envelope union verbatim (the payload
// IS the artifact) so they reconstruct from replay alongside rationales.
export type LeadPositionPayload = LeadPosition;
export type AuditorFindingPayload = AuditorFinding;

export type WSMessage =
  | { type: 'subscribe'; payload: SubscribePayload }
  | { type: 'tick'; payload: TradeSnapshot }
  | { type: 'risk_update'; payload: RiskUpdatePayload }
  | { type: 'compliance'; payload: CompliancePayload }
  | { type: 'threshold'; payload: ThresholdCrossing }
  | { type: 'rationale_tok'; payload: RationaleTokPayload }
  | { type: 'rationale_verified'; payload: RationaleVerifiedPayload }
  | { type: 'rationale_retracted'; payload: RationaleRetractedPayload }
  | { type: 'lead_position'; payload: LeadPositionPayload }
  | { type: 'auditor_finding'; payload: AuditorFindingPayload }
  | { type: 'error'; payload: ErrorPayload };

export type MessageType = WSMessage['type'];

export type WSEnvelope<M extends WSMessage = WSMessage> = M & {
  seq: number;
  ts: string;
};

// Server-emitted envelope types (everything except client→server `subscribe`).
export type ServerEnvelope = Exclude<WSEnvelope, WSEnvelope<{ type: 'subscribe'; payload: SubscribePayload }>>;

// -- Type guards ------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isVerdict(v: unknown): v is Verdict {
  return v === 'compliant' || v === 'conditional' || v === 'blocked';
}

function isTradeSnapshot(v: unknown): v is TradeSnapshot {
  if (!isObject(v)) return false;
  return (
    isString(v.intent_id) &&
    isString(v.ts) &&
    isString(v.mark_price) &&
    isString(v.bid) &&
    isString(v.ask) &&
    isString(v.size) &&
    isNumber(v.spread_bps) &&
    isNumber(v.slippage_bps) &&
    isNumber(v.vol_30d) &&
    isNumber(v.var_95_usd) &&
    (v.funding_rate === null || isNumber(v.funding_rate))
  );
}

function isThresholdCrossing(v: unknown): v is ThresholdCrossing {
  if (!isObject(v)) return false;
  return (
    isString(v.crossing_id) &&
    isString(v.intent_id) &&
    isString(v.ts) &&
    isString(v.rule_id) &&
    isString(v.citation) &&
    isString(v.boundary) &&
    (v.direction === 'crossed_up' || v.direction === 'crossed_down') &&
    isTradeSnapshot(v.snapshot) &&
    isVerdict(v.prior_verdict) &&
    isVerdict(v.new_verdict)
  );
}

const COMPLIANCE_STANCES: ReadonlySet<LeadStance> = new Set<LeadStance>([
  'cumulative',
  'stricter',
  'home_jurisdiction',
  'satisfy_both',
  'earliest',
]);
const RISK_STANCES: ReadonlySet<LeadStance> = new Set<LeadStance>(['escalate', 'hold']);

function isLeadStance(lead: unknown, stance: unknown): stance is LeadStance {
  if (lead === 'compliance') return COMPLIANCE_STANCES.has(stance as LeadStance);
  if (lead === 'risk') return RISK_STANCES.has(stance as LeadStance);
  return false;
}

function isLeadPosition(v: unknown): v is LeadPosition {
  if (!isObject(v)) return false;
  return (
    isString(v.crossing_id) &&
    (v.lead === 'compliance' || v.lead === 'risk') &&
    isLeadStance(v.lead, v.stance) &&
    isString(v.basis)
  );
}

function isAuditorFinding(v: unknown): v is AuditorFinding {
  if (!isObject(v)) return false;
  return (
    isString(v.crossing_id) &&
    (v.target === 'rationale' || v.target === 'lead_position') &&
    (v.verdict === 'pass' || v.verdict === 'fail' || v.verdict === 'advisory') &&
    isString(v.basis)
  );
}

const MESSAGE_TYPES: ReadonlySet<MessageType> = new Set<MessageType>([
  'subscribe',
  'tick',
  'risk_update',
  'compliance',
  'threshold',
  'rationale_tok',
  'rationale_verified',
  'rationale_retracted',
  'lead_position',
  'auditor_finding',
  'error',
]);

export function isMessageType(v: unknown): v is MessageType {
  return typeof v === 'string' && MESSAGE_TYPES.has(v as MessageType);
}

export function isWSEnvelope(v: unknown): v is WSEnvelope {
  if (!isObject(v)) return false;
  if (!isNumber(v.seq)) return false;
  if (!isString(v.ts)) return false;
  if (!isMessageType(v.type)) return false;
  if (!isObject(v.payload)) return false;

  const p = v.payload;
  switch (v.type) {
    case 'subscribe':
      return isString(p.intent_id);
    case 'tick':
      return isTradeSnapshot(p);
    case 'risk_update':
      return true;
    case 'compliance':
      return (
        isString(p.crossing_id) &&
        isVerdict(p.prior_verdict) &&
        isVerdict(p.new_verdict) &&
        isString(p.citation)
      );
    case 'threshold':
      return isThresholdCrossing(p);
    case 'rationale_tok':
      return isString(p.rationale_id) && isString(p.crossing_id) && isString(p.token);
    case 'rationale_verified':
      return (
        isString(p.rationale_id) && isString(p.crossing_id) && isNumber(p.final_score)
      );
    case 'rationale_retracted':
      return (
        isString(p.rationale_id) &&
        isString(p.crossing_id) &&
        isNumber(p.final_score) &&
        isString(p.reason)
      );
    case 'lead_position':
      return isLeadPosition(p);
    case 'auditor_finding':
      return isAuditorFinding(p);
    case 'error':
      return isString(p.code) && isString(p.message);
    default:
      return false;
  }
}

export function assertNever(x: never): never {
  throw new Error(`Unhandled envelope type: ${JSON.stringify(x)}`);
}
