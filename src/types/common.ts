// Jurisdiction codes matching backend JurisdictionCode enum
export type JurisdictionCode = 'EU' | 'UK' | 'US' | 'CH' | 'SG';

// Jurisdiction roles in cross-border scenarios
export type JurisdictionRole = 'issuer_home' | 'target' | 'passporting' | 'home' | 'passport' | 'third_country';

// Conflict types
export type ConflictType =
  | 'classification_divergence'
  | 'obligation_conflict'
  | 'timeline_conflict'
  | 'decision_conflict'
  | 'decision'
  | 'obligation'
  | 'classification'
  | 'timeline';

// Conflict severity levels
export type ConflictSeverity = 'blocking' | 'warning' | 'info';

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

// Compliance status
export type ComplianceStatus = 'compliant' | 'blocked' | 'requires_action' | 'no_applicable_rules';

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
