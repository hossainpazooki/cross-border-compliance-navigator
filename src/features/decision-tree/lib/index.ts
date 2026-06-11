// Evaluator + conflicts live in @platform/engine since the engine extraction;
// re-exported here to preserve the feature's public surface.
export {
  clearEvaluationCache,
  getEvaluationCacheStats,
  getIn,
  evaluateCondition,
  evaluateTree,
  evaluatePartial,
  collectFactPaths,
  countNodes,
  detectConflicts,
  mergeObligations,
} from '@platform/engine';

// Layout (UI-specific, stays in the app)
export {
  type LayoutConfig,
  type LayoutNode,
  type LayoutEdge,
  type TreeLayout,
  DEFAULT_LAYOUT_CONFIG,
  calculateLayout,
  generateEdgePath,
  getPathFromTrace,
} from './treeLayout';
