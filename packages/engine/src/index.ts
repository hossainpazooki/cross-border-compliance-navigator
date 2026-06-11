// Types (single owner of the decision-tree type system)
export * from './types';

// Evaluator
export {
  clearEvaluationCache,
  getEvaluationCacheStats,
  getIn,
  evaluateCondition,
  evaluateTree,
  evaluatePartial,
  collectFactPaths,
  countNodes,
} from './evaluator';

// Conflicts
export { detectConflicts, mergeObligations, type EvaluatedRule } from './conflicts';

// Bundled rule data
export { MICA_STABLECOIN_RULE, CREDIT_DECISION_RULE } from './data';
