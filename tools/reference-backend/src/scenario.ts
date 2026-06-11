import {
  evaluateTree,
  isConditionNode,
  isLeafNode,
  MICA_STABLECOIN_RULE,
  type DecisionNode,
  type EvaluationResult,
  type Facts,
  type SourceReference,
} from '@platform/engine';

export type Verdict = 'compliant' | 'conditional' | 'blocked';

/** Map the engine's ComplianceStatus onto the streaming contract's tri-state verdict. */
export function verdictOf(result: EvaluationResult): Verdict {
  switch (result.leaf.status) {
    case 'compliant':
    case 'no_applicable_rules':
      return 'compliant';
    case 'blocked':
      return 'blocked';
    case 'requires_action':
      return 'conditional';
  }
}

/** "MiCA Art. 43(1)" from a SourceReference. */
export function formatCitation(ref: SourceReference): string {
  const article = ref.article ? ` Art. ${ref.article}` : '';
  const paragraph = ref.paragraph ? `(${ref.paragraph})` : '';
  return `${ref.document_id}${article}${paragraph}`;
}

/** Every source reference cited along an evaluation: path nodes + final leaf. */
export function citedRefs(result: EvaluationResult): SourceReference[] {
  const refs = result.trace
    .map((t) => t.sourceRef)
    .filter((r): r is SourceReference => r !== undefined);
  if (result.leaf.sourceRef) refs.push(result.leaf.sourceRef);
  return refs;
}

/**
 * The auditor's deterministic grounding pass: is this citation backed by a
 * source reference actually present in the evaluation trace?
 */
export function isGrounded(citation: string, result: EvaluationResult): boolean {
  return citedRefs(result).some((ref) => formatCitation(ref) === citation);
}

export interface ReserveBoundary {
  /** The numeric threshold from the rule tree (EUR). */
  value: number;
  /** The condition node's citation, e.g. MiCA Art. 43(1). */
  sourceRef: SourceReference;
  ruleId: string;
}

/**
 * Extract the significant-issuer reserve boundary from the real MiCA rule tree
 * (first condition on `instrument.reserve_value_eur`). The fixture build fails
 * if the rule data no longer encodes one — the scenario must never drift from
 * the rule it claims to demonstrate.
 */
export function findReserveBoundary(): ReserveBoundary {
  let found: ReserveBoundary | undefined;
  const walk = (node: DecisionNode): void => {
    if (found || isLeafNode(node)) return;
    if (isConditionNode(node)) {
      const { condition, sourceRef } = node;
      if (
        condition.fact === 'instrument.reserve_value_eur' &&
        typeof condition.value === 'number' &&
        sourceRef
      ) {
        found = { value: condition.value, sourceRef, ruleId: MICA_STABLECOIN_RULE.id };
        return;
      }
      walk(node.children.true);
      walk(node.children.false);
    }
  };
  walk(MICA_STABLECOIN_RULE.tree);
  if (!found) {
    throw new Error(
      `rule ${MICA_STABLECOIN_RULE.id} no longer has a reserve_value_eur boundary; scenario invalid`
    );
  }
  return found;
}

export interface GroundedEvaluation {
  result: EvaluationResult;
  verdict: Verdict;
  /** Citation of the leaf actually reached, formatted for the wire. */
  citation: string;
  obligations: string[];
}

/**
 * Evaluate the bundled MiCA stablecoin rule for an EMT issuer at a given
 * reserve value, through the real engine.
 */
export function evaluateAtReserve(reserveValueEur: number): GroundedEvaluation {
  const facts: Facts = {
    instrument: {
      type: 'stablecoin',
      reference_asset: 'fiat_single',
      reserve_value_eur: reserveValueEur,
    },
    issuer: { type: 'credit_institution' },
  };
  const result = evaluateTree(MICA_STABLECOIN_RULE.tree, facts);
  if (!result.leaf.sourceRef) {
    throw new Error(`leaf ${result.leaf.nodeId} has no sourceRef; cannot ground a citation`);
  }
  return {
    result,
    verdict: verdictOf(result),
    citation: formatCitation(result.leaf.sourceRef),
    obligations: result.leaf.obligations ?? [],
  };
}
