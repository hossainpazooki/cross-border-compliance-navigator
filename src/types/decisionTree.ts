/**
 * Decision-tree types — owned by @platform/engine since the engine extraction.
 * This module re-exports them so existing `@/types/decisionTree` imports keep
 * working. New code should import from '@platform/engine' directly.
 */

export type {
  ConditionOp,
  Condition,
  ConditionNode,
  LeafNode,
  NodeType,
  Scope,
  BaseExtendedNode,
  GroupNode,
  RouterNode,
  ConflictAnchorNode,
  DecisionNode,
  TraceNode,
  EvaluationTrace,
  RuleMetadata,
  RuleDefinition,
  Facts,
  EvaluationResult,
  PartialEvaluationResult,
  JurisdictionEvaluation,
  ResolutionStrategy,
  CrossBorderConflict,
  CrossBorderEvaluation,
} from '@platform/engine';

export {
  isConditionNode,
  isLeafNode,
  isGroupNode,
  isRouterNode,
  isConflictAnchorNode,
} from '@platform/engine';
