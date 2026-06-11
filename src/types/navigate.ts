import type {
  JurisdictionCode,
  JurisdictionRole,
  ComplianceStatus,
  NavigationStatus,
  PathwayStepStatus,
  InstrumentType,
  ActivityType,
  InvestorType,
} from './common';
import type { SourceReference, RuleConflict } from '@platform/engine';

// Owned by @platform/engine; re-exported here so existing `@/types/navigate`
// imports keep working.
export type { SourceReference, RuleConflict };

// Request to /navigate endpoint
export interface NavigateRequest {
  issuer_jurisdiction: JurisdictionCode;
  target_jurisdictions: JurisdictionCode[];
  instrument_type: InstrumentType | string;
  activity: ActivityType | string;
  investor_types: InvestorType[];
  facts?: Record<string, unknown>;
}

// Jurisdiction with role response
export interface JurisdictionRoleResponse {
  jurisdiction: JurisdictionCode;
  regime_id: string;
  role: JurisdictionRole;
}

// Trace step in decision evaluation
export interface TraceStep {
  path: string;
  condition: string;
  result: boolean;
  explanation?: string;
}

// Decision from rule evaluation
export interface Decision {
  rule_id: string;
  decision: string;
  trace: TraceStep[];
  source?: SourceReference;
}

// Obligation triggered by rule
export interface Obligation {
  id: string;
  description: string;
  deadline?: string;
  rule_id?: string;
  jurisdiction?: JurisdictionCode;
}

// Result per jurisdiction
export interface JurisdictionResult {
  jurisdiction: JurisdictionCode;
  regime_id: string;
  role: JurisdictionRole;
  status: ComplianceStatus;
  applicable_rules: number;
  rules_evaluated: number;
  decisions: Decision[];
  obligations: Obligation[];
}

// Timeline for pathway step
export interface Timeline {
  min_days: number;
  max_days: number;
}

// Single pathway step
export interface PathwayStep {
  step_id: string;
  jurisdiction: JurisdictionCode;
  regime_id: string;
  obligation_id: string;
  action: string;
  source: SourceReference;
  prerequisites: string[];
  timeline: Timeline;
  status: PathwayStepStatus;
  waiver_reason?: string;
}

// Cumulative obligation across jurisdictions
export interface CumulativeObligation {
  id: string;
  description: string;
  jurisdictions: JurisdictionCode[];
}

// Audit trail entry
export interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Full navigation response
export interface NavigateResponse {
  status: NavigationStatus;
  applicable_jurisdictions: JurisdictionRoleResponse[];
  jurisdiction_results: JurisdictionResult[];
  conflicts: RuleConflict[];
  pathway: PathwayStep[];
  cumulative_obligations: CumulativeObligation[];
  estimated_timeline: string;
  audit_trail: AuditEntry[];
}
