/**
 * Domain types for the COMPASS decision engine.
 *
 * This package is the single owner of the decision-tree type system. The app's
 * `src/types/{decisionTree,common,navigate}.ts` modules re-export from here so
 * existing import paths keep working.
 */

// ============================================================================
// Domain primitives (shared with the app's `@/types/common`)
// ============================================================================

// Jurisdiction codes matching backend JurisdictionCode enum
export type JurisdictionCode = 'EU' | 'UK' | 'US' | 'CH' | 'SG';

// Jurisdiction roles in cross-border scenarios
export type JurisdictionRole =
  | 'issuer_home'
  | 'target'
  | 'passporting'
  | 'home'
  | 'passport'
  | 'third_country';

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

// Compliance status
export type ComplianceStatus = 'compliant' | 'blocked' | 'requires_action' | 'no_applicable_rules';

// Regulatory source citation (shared with the app's `@/types/navigate`)
export interface SourceReference {
  document_id: string;
  article?: string;
  paragraph?: string;
  url?: string;
}

// Cross-jurisdiction conflict produced by the conflict detector
// (shared with the app's `@/types/navigate`)
export interface RuleConflict {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  jurisdictions: JurisdictionCode[];
  description: string;
  resolution_strategy: 'cumulative' | 'stricter' | 'home_jurisdiction' | 'satisfy_both' | 'earliest';
  resolution_note?: string;
  obligations?: string[];
  anchor_node_ids?: string[]; // Tree nodes involved in this conflict (Phase 6)
}

// ============================================================================
// Decision-tree types (shared with the app's `@/types/decisionTree`)
// ============================================================================

/**
 * Condition operators (Clojure-style naming)
 * These mirror Clojure predicates for familiarity
 */
export type ConditionOp =
  | 'eq'       // equals
  | 'neq'      // not equals
  | 'gt'       // greater than
  | 'lt'       // less than
  | 'gte'      // greater than or equal
  | 'lte'      // less than or equal
  | 'in'       // value in array
  | 'contains' // array contains value
  | 'matches'  // regex match
  | 'nil?'     // is null/undefined
  | 'some?';   // is not null/undefined

/**
 * A single condition to evaluate against facts
 */
export interface Condition {
  /** Dot-path to the fact: "instrument.type" or "investor.jurisdiction" */
  fact: string;
  /** The comparison operator */
  op: ConditionOp;
  /** The value to compare against */
  value: unknown;
}

/**
 * A condition node in the decision tree (internal node)
 */
export interface ConditionNode {
  nodeId: string;
  type: 'condition';
  condition: Condition;
  /** Optional source reference for regulatory citation */
  sourceRef?: SourceReference;
  /** Human-readable annotation for the condition */
  annotation?: string;
  children: {
    true: DecisionNode;
    false: DecisionNode;
  };
}

/**
 * A leaf node representing a final decision
 */
export interface LeafNode {
  nodeId: string;
  type: 'leaf';
  /** The decision outcome */
  decision: string;
  /** Compliance status this decision results in */
  status: ComplianceStatus;
  /** Obligations triggered by this decision */
  obligations?: string[];
  /** Source reference for regulatory citation */
  sourceRef?: SourceReference;
}

/**
 * Node types for cross-border decision graphs
 */
export type NodeType = 'condition' | 'leaf' | 'group' | 'router' | 'obligation' | 'conflict_anchor';

/**
 * Scope definition for jurisdiction-aware nodes
 */
export interface Scope {
  jurisdictions?: JurisdictionCode[];
  roles?: JurisdictionRole[];
  frameworks?: string[];
}

/**
 * Base node interface for extended node types
 */
export interface BaseExtendedNode {
  nodeId: string;
  type: NodeType;
  label: string;
  scope?: Scope;
  sourceRef?: SourceReference;
  tags?: string[];
}

/**
 * GroupNode - Collapsible jurisdiction module
 * Represents a logical grouping of nodes (e.g., "EU MiCA Module")
 */
export interface GroupNode extends BaseExtendedNode {
  type: 'group';
  /** Module identifier, e.g., "EU_MiCA_Module_v2.3" */
  moduleId: string;
  /** Entry point node within the group */
  entryNodeId: string;
  /** Optional exit node for the group */
  exitNodeId?: string;
  /** Whether the group is collapsed by default in the UI */
  collapsedByDefault: boolean;
  /** Child nodes within this group */
  children: DecisionNode[];
}

/**
 * RouterNode - Parallel jurisdiction dispatch
 * Routes evaluation to multiple jurisdiction-specific subtrees
 */
export interface RouterNode extends BaseExtendedNode {
  type: 'router';
  /** Branches to different jurisdiction-specific subtrees */
  branches: Array<{
    jurisdiction: JurisdictionCode;
    role: JurisdictionRole;
    targetNodeId: string;
  }>;
}

/**
 * ConflictAnchorNode - Marks a node involved in a cross-jurisdiction conflict
 * Used for "highlight in tree" functionality from conflict cards
 */
export interface ConflictAnchorNode extends BaseExtendedNode {
  type: 'conflict_anchor';
  /** Unique conflict identifier */
  conflictId: string;
  /** The other node in the conflict pair */
  pairedAnchorId: string;
}

/**
 * A decision tree node (discriminated union)
 */
export type DecisionNode = ConditionNode | LeafNode | GroupNode | RouterNode | ConflictAnchorNode;

/**
 * A trace of a single condition evaluation
 */
export interface TraceNode {
  nodeId: string;
  /** Human-readable description of the condition */
  condition: string;
  /** The fact path that was evaluated */
  factPath: string;
  /** The actual value of the fact */
  factValue: unknown;
  /** The expected value for comparison */
  expectedValue: unknown;
  /** The operator used */
  op: ConditionOp;
  /** The result of the evaluation */
  result: boolean;
  /** Depth in the tree (for visualization) */
  depth: number;
  /** Source reference if available */
  sourceRef?: SourceReference;
  /** Links to Digital Library annotation (Droit pattern: connective tissue) */
  annotationId?: string;
  /** Regulatory version that sourced this rule, e.g., "MiCA_2023_v1.2" */
  regulatoryVersion?: string;
  /** Knowledge engineer's reasoning for this rule encoding */
  interpretationNote?: string;
}

/**
 * Complete evaluation trace for a decision
 */
export interface EvaluationTrace {
  ruleId: string;
  ruleVersion: string;
  /** The path of nodes traversed */
  path: TraceNode[];
  /** The final leaf node reached */
  finalNode: LeafNode;
  /** Timestamp of evaluation */
  evaluatedAt: string;
}

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
 */
export interface RuleDefinition {
  id: string;
  version: string;
  name: string;
  description?: string;
  metadata: RuleMetadata;
  tree: DecisionNode;
}

/**
 * Facts object for evaluation
 */
export type Facts = Record<string, unknown>;

/**
 * Result of evaluating a decision tree
 */
export interface EvaluationResult {
  leaf: LeafNode;
  trace: TraceNode[];
}

/**
 * Result of partial evaluation (when facts are incomplete)
 */
export interface PartialEvaluationResult {
  /** Leaf nodes that are still reachable */
  reachableLeaves: LeafNode[];
  /** Fact paths that are missing */
  missingFacts: string[];
  /** Partial trace up to the missing fact */
  partialTrace: TraceNode[];
}

// Type guards

export function isConditionNode(node: DecisionNode): node is ConditionNode {
  return node.type === 'condition';
}

export function isLeafNode(node: DecisionNode): node is LeafNode {
  return node.type === 'leaf';
}

export function isGroupNode(node: DecisionNode): node is GroupNode {
  return node.type === 'group';
}

export function isRouterNode(node: DecisionNode): node is RouterNode {
  return node.type === 'router';
}

export function isConflictAnchorNode(node: DecisionNode): node is ConflictAnchorNode {
  return node.type === 'conflict_anchor';
}

/**
 * Cross-Border Evaluation Types
 */

/**
 * Evaluation result for a single jurisdiction
 */
export interface JurisdictionEvaluation {
  jurisdiction: JurisdictionCode;
  role: JurisdictionRole;
  regime_id: string;
  status: ComplianceStatus;
  trace: TraceNode[];
  leafNodeId: string;
  obligationIds: string[];
}

/**
 * Resolution strategies for conflicts
 */
export type ResolutionStrategy = 'cumulative' | 'stricter' | 'home_jurisdiction';

/**
 * Cross-border conflict between jurisdictions
 */
export interface CrossBorderConflict {
  conflictId: string;
  severity: ConflictSeverity;
  type: ConflictType;
  jurisdictions: JurisdictionCode[];
  /** Node IDs for "click conflict → highlight tree" */
  anchorNodeIds: string[];
  description: string;
  resolution_strategy: ResolutionStrategy;
}

/**
 * Complete cross-border evaluation result
 */
export interface CrossBorderEvaluation {
  graphId: string;
  rule_version: string;
  globalTrace: TraceNode[];
  jurisdictionEvaluations: JurisdictionEvaluation[];
  conflicts: CrossBorderConflict[];
}
