// Domain primitives owned by @platform/engine; re-exported here so existing
// `@/types/common` imports keep working.
import type { JurisdictionCode } from '@platform/engine';

export type {
  JurisdictionCode,
  JurisdictionRole,
  ConflictType,
  ConflictSeverity,
  ComplianceStatus,
} from '@platform/engine';

// Explanation tiers from decoder service
export type ExplanationTier = 'retail' | 'protocol' | 'institutional' | 'regulator';

// Scenario types for counterfactual analysis
export type ScenarioType =
  | 'jurisdiction_change'
  | 'entity_change'
  | 'activity_restructure'
  | 'threshold'
  | 'temporal'
  | 'protocol_change'
  | 'regulatory_change'
  | 'rate_shock'
  | 'revenue_decline'
  | 'covenant_breach';

// Risk levels
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// Navigation status
export type NavigationStatus = 'actionable' | 'blocked' | 'requires_review';

// Pathway step status
export type PathwayStepStatus = 'pending' | 'completed' | 'waived';

// Instrument types
export type InstrumentType =
  | 'stablecoin'
  | 'security_token'
  | 'utility_token'
  | 'nft'
  | 'governance_token'
  | 'lp_token'
  | 'other';

// Activity types
export type ActivityType =
  | 'public_offer'
  | 'private_placement'
  | 'trading'
  | 'custody'
  | 'exchange'
  | 'lending'
  | 'staking';

// Investor types
export type InvestorType = 'retail' | 'professional' | 'institutional' | 'accredited';

// Jurisdiction metadata
export interface JurisdictionInfo {
  code: JurisdictionCode;
  name: string;
  authority: string;
  framework: string;
  flag: string;
  color: string;
}

// Jurisdiction metadata map
export const JURISDICTIONS: Record<JurisdictionCode, JurisdictionInfo> = {
  EU: {
    code: 'EU',
    name: 'European Union',
    authority: 'ESMA',
    framework: 'MiCA 2023',
    flag: '🇪🇺',
    color: 'eu',
  },
  UK: {
    code: 'UK',
    name: 'United Kingdom',
    authority: 'FCA',
    framework: 'FCA Crypto 2024',
    flag: '🇬🇧',
    color: 'uk',
  },
  US: {
    code: 'US',
    name: 'United States',
    authority: 'SEC/CFTC',
    framework: 'Securities Act 1933',
    flag: '🇺🇸',
    color: 'us',
  },
  CH: {
    code: 'CH',
    name: 'Switzerland',
    authority: 'FINMA',
    framework: 'FINSA/DLT 2021',
    flag: '🇨🇭',
    color: 'ch',
  },
  SG: {
    code: 'SG',
    name: 'Singapore',
    authority: 'MAS',
    framework: 'PSA 2019',
    flag: '🇸🇬',
    color: 'sg',
  },
};
