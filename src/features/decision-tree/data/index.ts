import type { RuleDefinition } from '@entities/rule/model';
import {
  MICA_STABLECOIN_RULE as ENGINE_MICA_RULE,
  CREDIT_DECISION_RULE as ENGINE_CREDIT_RULE,
} from '@platform/engine';

// Rule data is bundled with @platform/engine (shared with the reference
// backend); this module keeps the app-side registry API.
export const MICA_STABLECOIN_RULE: RuleDefinition = ENGINE_MICA_RULE;
export const CREDIT_DECISION_RULE: RuleDefinition = ENGINE_CREDIT_RULE;

// Rule registry for easy lookup
export const RULES: Record<string, RuleDefinition> = {
  'mica-stablecoin-auth': MICA_STABLECOIN_RULE,
};

/**
 * Get a rule by ID
 */
export function getRule(ruleId: string): RuleDefinition | undefined {
  return RULES[ruleId];
}

/**
 * Get all rules for a jurisdiction
 */
export function getRulesForJurisdiction(jurisdiction: string): RuleDefinition[] {
  return Object.values(RULES).filter(
    (rule) => rule.metadata.jurisdiction === jurisdiction
  );
}

/**
 * Get all available rule IDs
 */
export function getAllRuleIds(): string[] {
  return Object.keys(RULES);
}
