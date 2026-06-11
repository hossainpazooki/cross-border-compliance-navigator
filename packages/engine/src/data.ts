import type { RuleDefinition } from './types';
import micaStablecoin from '../data/mica-stablecoin.json';
import creditDecision from '../data/credit-decision.json';

// Type assertion for JSON imports
export const MICA_STABLECOIN_RULE = micaStablecoin as unknown as RuleDefinition;
export const CREDIT_DECISION_RULE = creditDecision as unknown as RuleDefinition;
