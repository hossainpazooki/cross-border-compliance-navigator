import type {
  DecisionNode,
  ConditionNode,
  Condition,
  Facts,
  TraceNode,
  EvaluationResult,
  PartialEvaluationResult,
} from './types';
import { isLeafNode } from './types';

// ============================================================================
// Evaluation Cache (Droit pattern: TMS-like efficiency for incremental updates)
// ============================================================================

interface EvaluationCache {
  factHash: string;
  result: EvaluationResult;
}

/** Cache keyed by treeId, storing results for specific fact hashes */
const evaluationCache = new Map<string, EvaluationCache>();

/**
 * Create a stable hash of facts for cache key comparison.
 * Sorts keys recursively so key insertion order never affects the hash.
 * (A JSON.stringify replacer array is NOT usable here — it filters keys at
 * every nesting level, which collapsed all nested facts to `{}` and made the
 * cache return stale results when only nested values changed.)
 */
function hashFacts(facts: Facts): string {
  const stable = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      return Object.fromEntries(
        Object.keys(record)
          .sort()
          .map((key) => [key, stable(record[key])])
      );
    }
    return value;
  };
  return JSON.stringify(stable(facts));
}

/**
 * Get a cached evaluation result if facts haven't changed.
 * Returns undefined if no cache exists or facts have changed.
 */
function getCachedResult(treeId: string, facts: Facts): EvaluationResult | undefined {
  const cached = evaluationCache.get(treeId);
  if (!cached) return undefined;

  const factHash = hashFacts(facts);
  if (cached.factHash !== factHash) return undefined;

  return cached.result;
}

/**
 * Store an evaluation result in the cache.
 */
function setCachedResult(treeId: string, facts: Facts, result: EvaluationResult): void {
  evaluationCache.set(treeId, {
    factHash: hashFacts(facts),
    result,
  });
}

/**
 * Clear the evaluation cache (useful for testing or memory management).
 */
export function clearEvaluationCache(): void {
  evaluationCache.clear();
}

/**
 * Get cache statistics for debugging/monitoring.
 */
export function getEvaluationCacheStats(): { size: number; keys: string[] } {
  return {
    size: evaluationCache.size,
    keys: Array.from(evaluationCache.keys()),
  };
}

/**
 * Get a nested value from an object using dot-path notation
 * Mirrors Clojure's get-in function
 *
 * @example
 * getIn({ a: { b: 1 } }, 'a.b') // => 1
 * getIn({ a: [1, 2, 3] }, 'a.1') // => 2
 */
export function getIn(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Check if a value is null or undefined (Clojure: nil?)
 */
function isNil(value: unknown): boolean {
  return value === null || value === undefined;
}

/**
 * Check if a value is not null/undefined (Clojure: some?)
 */
function isSome(value: unknown): boolean {
  return !isNil(value);
}

/**
 * Evaluate a single condition against facts
 * Pure function - no side effects
 */
export function evaluateCondition(
  condition: Condition,
  facts: Facts
): boolean {
  const factValue = getIn(facts, condition.fact);
  const { op, value } = condition;

  switch (op) {
    case 'eq':
      return factValue === value;

    case 'neq':
      return factValue !== value;

    case 'gt':
      return typeof factValue === 'number' && typeof value === 'number'
        ? factValue > value
        : false;

    case 'lt':
      return typeof factValue === 'number' && typeof value === 'number'
        ? factValue < value
        : false;

    case 'gte':
      return typeof factValue === 'number' && typeof value === 'number'
        ? factValue >= value
        : false;

    case 'lte':
      return typeof factValue === 'number' && typeof value === 'number'
        ? factValue <= value
        : false;

    case 'in':
      return Array.isArray(value) && value.includes(factValue);

    case 'contains':
      return Array.isArray(factValue) && factValue.includes(value);

    case 'matches':
      if (typeof factValue !== 'string' || typeof value !== 'string') {
        return false;
      }
      try {
        return new RegExp(value).test(factValue);
      } catch {
        return false;
      }

    case 'nil?':
      return isNil(factValue);

    case 'some?':
      return isSome(factValue);

    default:
      return false;
  }
}

/**
 * Format a condition as a human-readable string
 */
function formatCondition(condition: Condition): string {
  const { fact, op, value } = condition;
  const formattedValue = JSON.stringify(value);

  switch (op) {
    case 'eq':
      return `${fact} equals ${formattedValue}`;
    case 'neq':
      return `${fact} does not equal ${formattedValue}`;
    case 'gt':
      return `${fact} > ${formattedValue}`;
    case 'lt':
      return `${fact} < ${formattedValue}`;
    case 'gte':
      return `${fact} >= ${formattedValue}`;
    case 'lte':
      return `${fact} <= ${formattedValue}`;
    case 'in':
      return `${fact} is in ${formattedValue}`;
    case 'contains':
      return `${fact} contains ${formattedValue}`;
    case 'matches':
      return `${fact} matches ${formattedValue}`;
    case 'nil?':
      return `${fact} is nil`;
    case 'some?':
      return `${fact} has a value`;
    default:
      return `${fact} ${op} ${formattedValue}`;
  }
}

/**
 * Create a trace node from a condition evaluation
 */
function createTraceNode(
  node: ConditionNode,
  facts: Facts,
  result: boolean,
  depth: number
): TraceNode {
  const { condition, sourceRef } = node;
  const factValue = getIn(facts, condition.fact);

  return {
    nodeId: node.nodeId,
    condition: formatCondition(condition),
    factPath: condition.fact,
    factValue,
    expectedValue: condition.value,
    op: condition.op,
    result,
    depth,
    sourceRef,
  };
}

/**
 * Evaluate a decision tree against facts, generating a full trace.
 * Supports optional caching for incremental updates (Droit TMS pattern).
 *
 * @param node - The root of the decision tree
 * @param facts - The facts to evaluate against
 * @param treeId - Optional tree ID for caching (enables cache lookup/storage)
 * @returns The final leaf node and the trace of all evaluated conditions
 */
export function evaluateTree(
  node: DecisionNode,
  facts: Facts,
  treeId?: string
): EvaluationResult {
  // Check cache if treeId provided
  if (treeId) {
    const cached = getCachedResult(treeId, facts);
    if (cached) {
      return cached;
    }
  }

  // Perform evaluation
  const result = evaluateTreeInternal(node, facts, 0, []);

  // Cache result if treeId provided
  if (treeId) {
    setCachedResult(treeId, facts, result);
  }

  return result;
}

/**
 * Internal recursive evaluation (not cached)
 */
function evaluateTreeInternal(
  node: DecisionNode,
  facts: Facts,
  depth: number,
  trace: TraceNode[]
): EvaluationResult {
  if (isLeafNode(node)) {
    return { leaf: node, trace };
  }

  // Must be a condition node
  const conditionNode = node as ConditionNode;
  const result = evaluateCondition(conditionNode.condition, facts);
  const traceNode = createTraceNode(conditionNode, facts, result, depth);

  const newTrace = [...trace, traceNode];
  const nextNode = result ? conditionNode.children.true : conditionNode.children.false;

  return evaluateTreeInternal(nextNode, facts, depth + 1, newTrace);
}

/**
 * Perform partial evaluation when facts may be incomplete
 * Returns all reachable leaves and identifies missing facts
 *
 * @returns Reachable leaves, missing facts, and partial trace
 */
export function evaluatePartial(
  node: DecisionNode,
  facts: Facts,
  depth = 0,
  trace: TraceNode[] = [],
  missingFacts: Set<string> = new Set()
): PartialEvaluationResult {
  if (isLeafNode(node)) {
    return {
      reachableLeaves: [node],
      missingFacts: Array.from(missingFacts),
      partialTrace: trace,
    };
  }

  const conditionNode = node as ConditionNode;
  const factValue = getIn(facts, conditionNode.condition.fact);

  // If the fact is missing, explore both branches
  if (factValue === undefined && conditionNode.condition.op !== 'nil?') {
    missingFacts.add(conditionNode.condition.fact);

    const trueResult = evaluatePartial(
      conditionNode.children.true,
      facts,
      depth + 1,
      trace,
      new Set(missingFacts)
    );

    const falseResult = evaluatePartial(
      conditionNode.children.false,
      facts,
      depth + 1,
      trace,
      new Set(missingFacts)
    );

    return {
      reachableLeaves: [...trueResult.reachableLeaves, ...falseResult.reachableLeaves],
      missingFacts: Array.from(
        new Set([...trueResult.missingFacts, ...falseResult.missingFacts])
      ),
      partialTrace: trace,
    };
  }

  // Fact is present, evaluate normally
  const result = evaluateCondition(conditionNode.condition, facts);
  const traceNode = createTraceNode(conditionNode, facts, result, depth);
  const newTrace = [...trace, traceNode];
  const nextNode = result ? conditionNode.children.true : conditionNode.children.false;

  return evaluatePartial(nextNode, facts, depth + 1, newTrace, missingFacts);
}

/**
 * Collect all fact paths referenced in a decision tree
 * Useful for understanding what facts a rule requires
 */
export function collectFactPaths(node: DecisionNode): string[] {
  const paths = new Set<string>();

  function traverse(n: DecisionNode): void {
    if (isLeafNode(n)) {
      return;
    }

    const conditionNode = n as ConditionNode;
    paths.add(conditionNode.condition.fact);
    traverse(conditionNode.children.true);
    traverse(conditionNode.children.false);
  }

  traverse(node);
  return Array.from(paths);
}

/**
 * Count the number of nodes in a decision tree
 */
export function countNodes(node: DecisionNode): { conditions: number; leaves: number } {
  if (isLeafNode(node)) {
    return { conditions: 0, leaves: 1 };
  }

  const conditionNode = node as ConditionNode;
  const trueCount = countNodes(conditionNode.children.true);
  const falseCount = countNodes(conditionNode.children.false);

  return {
    conditions: 1 + trueCount.conditions + falseCount.conditions,
    leaves: trueCount.leaves + falseCount.leaves,
  };
}
