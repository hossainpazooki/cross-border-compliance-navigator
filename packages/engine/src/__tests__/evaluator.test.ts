import { describe, it, expect, beforeEach } from 'vitest';
import {
  getIn,
  evaluateCondition,
  evaluateTree,
  evaluatePartial,
  collectFactPaths,
  countNodes,
  clearEvaluationCache,
  getEvaluationCacheStats,
} from '../evaluator';
import { MICA_STABLECOIN_RULE } from '../data';
import type { Condition, ConditionNode, DecisionNode, LeafNode } from '../types';

const leaf = (nodeId: string, decision: string, obligations?: string[]): LeafNode => ({
  nodeId,
  type: 'leaf',
  decision,
  status: 'compliant',
  obligations,
  sourceRef: { document_id: `doc-${nodeId}`, article: 'Art. 1' },
});

const cond = (
  nodeId: string,
  condition: Condition,
  trueChild: DecisionNode,
  falseChild: DecisionNode
): ConditionNode => ({
  nodeId,
  type: 'condition',
  condition,
  sourceRef: { document_id: `doc-${nodeId}` },
  children: { true: trueChild, false: falseChild },
});

// instrument.type eq stablecoin → (reserve gte 100) → big | small ; else → out
const TREE: DecisionNode = cond(
  'root',
  { fact: 'instrument.type', op: 'eq', value: 'stablecoin' },
  cond(
    'reserve',
    { fact: 'instrument.reserve', op: 'gte', value: 100 },
    leaf('big', 'Large reserve', ['Notify within 30 days']),
    leaf('small', 'Small reserve')
  ),
  leaf('out', 'Out of scope')
);

describe('getIn', () => {
  it('resolves nested dot-paths', () => {
    expect(getIn({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42);
  });

  it('resolves array indices', () => {
    expect(getIn({ a: [10, 20, 30] }, 'a.1')).toBe(20);
  });

  it('returns undefined for missing paths', () => {
    expect(getIn({ a: {} }, 'a.b.c')).toBeUndefined();
  });

  it('returns undefined when traversing through a primitive', () => {
    expect(getIn({ a: 5 }, 'a.b')).toBeUndefined();
  });
});

describe('evaluateCondition', () => {
  const facts = {
    s: 'stablecoin',
    n: 10,
    list: ['EU', 'UK'],
    empty: null,
  };

  it.each([
    [{ fact: 's', op: 'eq', value: 'stablecoin' }, true],
    [{ fact: 's', op: 'eq', value: 'nft' }, false],
    [{ fact: 's', op: 'neq', value: 'nft' }, true],
    [{ fact: 'n', op: 'gt', value: 5 }, true],
    [{ fact: 'n', op: 'gt', value: 10 }, false],
    [{ fact: 'n', op: 'lt', value: 20 }, true],
    [{ fact: 'n', op: 'gte', value: 10 }, true],
    [{ fact: 'n', op: 'lte', value: 9 }, false],
    [{ fact: 's', op: 'in', value: ['stablecoin', 'nft'] }, true],
    [{ fact: 's', op: 'in', value: ['nft'] }, false],
    [{ fact: 'list', op: 'contains', value: 'EU' }, true],
    [{ fact: 'list', op: 'contains', value: 'US' }, false],
    [{ fact: 's', op: 'matches', value: '^stable' }, true],
    [{ fact: 's', op: 'matches', value: '^nft' }, false],
    [{ fact: 'empty', op: 'nil?', value: null }, true],
    [{ fact: 'missing', op: 'nil?', value: null }, true],
    [{ fact: 's', op: 'nil?', value: null }, false],
    [{ fact: 's', op: 'some?', value: null }, true],
    [{ fact: 'missing', op: 'some?', value: null }, false],
  ] as Array<[Condition, boolean]>)('%j → %s', (condition, expected) => {
    expect(evaluateCondition(condition, facts)).toBe(expected);
  });

  it('numeric comparisons are false on non-numeric operands', () => {
    expect(evaluateCondition({ fact: 's', op: 'gt', value: 5 }, facts)).toBe(false);
    expect(evaluateCondition({ fact: 'n', op: 'gt', value: '5' }, facts)).toBe(false);
  });

  it('matches is false on an invalid regex instead of throwing', () => {
    expect(evaluateCondition({ fact: 's', op: 'matches', value: '(' }, facts)).toBe(false);
  });
});

describe('evaluateTree', () => {
  beforeEach(() => clearEvaluationCache());

  it('reaches the correct leaf and records the full trace', () => {
    const { leaf: result, trace } = evaluateTree(TREE, {
      instrument: { type: 'stablecoin', reserve: 500 },
    });
    expect(result.nodeId).toBe('big');
    expect(trace.map((t) => t.nodeId)).toEqual(['root', 'reserve']);
    expect(trace.map((t) => t.result)).toEqual([true, true]);
    expect(trace.map((t) => t.depth)).toEqual([0, 1]);
    expect(trace[0].factValue).toBe('stablecoin');
    expect(trace[0].expectedValue).toBe('stablecoin');
  });

  it('carries each node sourceRef into the trace (grounding invariant)', () => {
    const { trace } = evaluateTree(TREE, { instrument: { type: 'stablecoin', reserve: 1 } });
    expect(trace.every((t) => t.sourceRef?.document_id === `doc-${t.nodeId}`)).toBe(true);
  });

  it('takes the false branch to the out-of-scope leaf', () => {
    const { leaf: result } = evaluateTree(TREE, { instrument: { type: 'nft' } });
    expect(result.nodeId).toBe('out');
  });

  it('returns the cached result for identical facts under the same treeId', () => {
    const facts = { instrument: { type: 'stablecoin', reserve: 500 } };
    const first = evaluateTree(TREE, facts, 'tree-1');
    const second = evaluateTree(TREE, facts, 'tree-1');
    expect(second).toBe(first);
    expect(getEvaluationCacheStats()).toEqual({ size: 1, keys: ['tree-1'] });
  });

  it('re-evaluates when facts change and after cache clear', () => {
    const first = evaluateTree(TREE, { instrument: { type: 'stablecoin', reserve: 500 } }, 't');
    const changed = evaluateTree(TREE, { instrument: { type: 'stablecoin', reserve: 1 } }, 't');
    expect(changed).not.toBe(first);
    expect(changed.leaf.nodeId).toBe('small');
    clearEvaluationCache();
    expect(getEvaluationCacheStats().size).toBe(0);
  });

  it('cache key is insensitive to fact key insertion order', () => {
    const first = evaluateTree(
      TREE,
      { instrument: { type: 'stablecoin', reserve: 500 } },
      'order'
    );
    const reordered = evaluateTree(
      TREE,
      { instrument: { reserve: 500, type: 'stablecoin' } },
      'order'
    );
    expect(reordered).toBe(first);
  });

  it('evaluates the bundled MiCA rule end to end with grounded trace', () => {
    const { leaf: result, trace } = evaluateTree(MICA_STABLECOIN_RULE.tree, {
      instrument: { type: 'stablecoin', reference_asset: 'fiat_single', reserve_value_eur: 1_000_000 },
      issuer: { type: 'credit_institution' },
    });
    expect(result.nodeId).toBe('emt-authorized-issuer-leaf');
    expect(result.status).toBe('requires_action');
    expect(trace.length).toBeGreaterThan(0);
    // every step of the real rule's trace cites a source — the auditor's
    // deterministic grounding pass depends on this
    expect(trace.every((t) => t.sourceRef?.document_id)).toBe(true);
  });
});

describe('evaluatePartial', () => {
  it('explores both branches when a fact is missing and reports it', () => {
    const { reachableLeaves, missingFacts } = evaluatePartial(TREE, {
      instrument: { type: 'stablecoin' },
    });
    expect(missingFacts).toContain('instrument.reserve');
    expect(reachableLeaves.map((l) => l.nodeId).sort()).toEqual(['big', 'small']);
  });

  it('narrows to a single leaf when all facts are present', () => {
    const { reachableLeaves, missingFacts } = evaluatePartial(TREE, {
      instrument: { type: 'nft' },
    });
    expect(missingFacts).toEqual([]);
    expect(reachableLeaves.map((l) => l.nodeId)).toEqual(['out']);
  });
});

describe('tree introspection', () => {
  it('collectFactPaths returns each referenced fact once', () => {
    expect(collectFactPaths(TREE).sort()).toEqual(['instrument.reserve', 'instrument.type']);
  });

  it('countNodes counts conditions and leaves', () => {
    expect(countNodes(TREE)).toEqual({ conditions: 2, leaves: 3 });
  });
});
