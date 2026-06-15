import type { JurisdictionCode } from '@entities/jurisdiction/model';

/**
 * Metadata for a rule definition
 */
export interface RuleMetadata {
  jurisdiction: JurisdictionCode;
  framework: string;
  effectiveDate: string;
  expiresDate?: string;
  tags?: string[];
  /** ATLAS regime this rule pack belongs to (join key to atlas-provenance). */
  regime_id?: string;
}

/**
 * A complete rule definition (JSON format)
 * Note: DecisionNode type is defined in features/decision-tree
 */
export interface RuleDefinition {
  id: string;
  version: string;
  name: string;
  description?: string;
  metadata: RuleMetadata;
  tree: unknown; // DecisionNode - circular dependency avoided
}
