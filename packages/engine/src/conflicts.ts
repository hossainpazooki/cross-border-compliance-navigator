import type {
  JurisdictionCode,
  ConflictType,
  ConflictSeverity,
  RuleConflict,
  EvaluationResult,
  RuleDefinition,
} from './types';

/**
 * Represents an evaluated rule with its result
 */
export interface EvaluatedRule {
  definition: RuleDefinition;
  result: EvaluationResult;
}

/**
 * Detect classification conflicts between jurisdictions
 * E.g., EU classifies as "ART" while UK classifies as "security token"
 */
function detectClassificationConflicts(
  evaluatedRules: EvaluatedRule[]
): RuleConflict[] {
  const conflicts: RuleConflict[] = [];
  const classifications = new Map<JurisdictionCode, string>();

  // Group by jurisdiction and collect classifications
  for (const { definition, result } of evaluatedRules) {
    const jurisdiction = definition.metadata.jurisdiction;
    const decision = result.leaf.decision.toLowerCase();

    // Look for classification keywords
    if (
      decision.includes('classified as') ||
      decision.includes('is a') ||
      decision.includes('treated as')
    ) {
      classifications.set(jurisdiction, result.leaf.decision);
    }
  }

  // Compare classifications across jurisdictions
  const jurisdictions = Array.from(classifications.keys());
  for (let i = 0; i < jurisdictions.length; i++) {
    for (let j = i + 1; j < jurisdictions.length; j++) {
      const j1 = jurisdictions[i];
      const j2 = jurisdictions[j];
      const c1 = classifications.get(j1)!;
      const c2 = classifications.get(j2)!;

      if (c1 !== c2) {
        conflicts.push({
          id: `classification-${j1}-${j2}`,
          type: 'classification_divergence',
          severity: 'warning',
          jurisdictions: [j1, j2],
          description: `Classification differs: ${j1} says "${c1}" while ${j2} says "${c2}"`,
          resolution_strategy: 'satisfy_both',
          resolution_note: 'Apply the more restrictive classification',
        });
      }
    }
  }

  return conflicts;
}

/**
 * Detect timeline conflicts between jurisdictions
 * E.g., EU requires 30 days notice while UK requires 60 days
 */
function detectTimelineConflicts(
  evaluatedRules: EvaluatedRule[]
): RuleConflict[] {
  const conflicts: RuleConflict[] = [];
  const timelines = new Map<JurisdictionCode, { rule: string; days: number }>();

  // Extract timeline requirements from obligations
  for (const { definition, result } of evaluatedRules) {
    const jurisdiction = definition.metadata.jurisdiction;
    const obligations = result.leaf.obligations || [];

    for (const obligation of obligations) {
      // Look for timeline patterns in obligations
      const daysMatch = obligation.match(/(\d+)\s*days?/i);
      if (daysMatch) {
        const days = parseInt(daysMatch[1], 10);
        const existing = timelines.get(jurisdiction);
        if (!existing || days > existing.days) {
          timelines.set(jurisdiction, { rule: definition.id, days });
        }
      }
    }
  }

  // Compare timelines - flag if difference is significant
  const jurisdictions = Array.from(timelines.keys());
  for (let i = 0; i < jurisdictions.length; i++) {
    for (let j = i + 1; j < jurisdictions.length; j++) {
      const j1 = jurisdictions[i];
      const j2 = jurisdictions[j];
      const t1 = timelines.get(j1)!;
      const t2 = timelines.get(j2)!;

      if (Math.abs(t1.days - t2.days) >= 15) {
        conflicts.push({
          id: `timeline-${j1}-${j2}`,
          type: 'timeline_conflict',
          severity: 'warning',
          jurisdictions: [j1, j2],
          description: `Timeline difference: ${j1} requires ${t1.days} days, ${j2} requires ${t2.days} days`,
          resolution_strategy: 'earliest',
          resolution_note: 'Use the earlier deadline to satisfy both',
        });
      }
    }
  }

  return conflicts;
}

/**
 * Detect obligation conflicts between jurisdictions
 * E.g., mutually exclusive requirements
 */
function detectObligationConflicts(
  evaluatedRules: EvaluatedRule[]
): RuleConflict[] {
  const conflicts: RuleConflict[] = [];

  // Known conflicting obligation patterns
  const conflictPatterns = [
    {
      pattern1: /retail\s+prohibition/i,
      pattern2: /retail\s+allowed/i,
      type: 'obligation_conflict' as ConflictType,
      severity: 'blocking' as ConflictSeverity,
      description: 'Retail investor eligibility conflict',
    },
    {
      pattern1: /must\s+register/i,
      pattern2: /registration\s+exempt/i,
      type: 'obligation_conflict' as ConflictType,
      severity: 'warning' as ConflictSeverity,
      description: 'Registration requirement conflict',
    },
  ];

  // Group obligations by jurisdiction
  const obligationsByJurisdiction = new Map<JurisdictionCode, string[]>();
  for (const { definition, result } of evaluatedRules) {
    const jurisdiction = definition.metadata.jurisdiction;
    const obligations = result.leaf.obligations || [];
    const existing = obligationsByJurisdiction.get(jurisdiction) || [];
    obligationsByJurisdiction.set(jurisdiction, [...existing, ...obligations]);
  }

  // Check for conflicting patterns
  const jurisdictions = Array.from(obligationsByJurisdiction.keys());
  for (let i = 0; i < jurisdictions.length; i++) {
    for (let j = i + 1; j < jurisdictions.length; j++) {
      const j1 = jurisdictions[i];
      const j2 = jurisdictions[j];
      const o1 = obligationsByJurisdiction.get(j1)!.join(' ');
      const o2 = obligationsByJurisdiction.get(j2)!.join(' ');

      for (const { pattern1, pattern2, type, severity, description } of conflictPatterns) {
        if (
          (pattern1.test(o1) && pattern2.test(o2)) ||
          (pattern2.test(o1) && pattern1.test(o2))
        ) {
          conflicts.push({
            id: `obligation-${j1}-${j2}-${type}`,
            type,
            severity,
            jurisdictions: [j1, j2],
            description: `${description} between ${j1} and ${j2}`,
            resolution_strategy: severity === 'blocking' ? 'satisfy_both' : 'stricter',
          });
        }
      }
    }
  }

  return conflicts;
}

/**
 * Detect all conflicts between evaluated rules
 */
export function detectConflicts(
  evaluatedRules: EvaluatedRule[]
): RuleConflict[] {
  if (evaluatedRules.length < 2) {
    return [];
  }

  const conflicts: RuleConflict[] = [
    ...detectClassificationConflicts(evaluatedRules),
    ...detectTimelineConflicts(evaluatedRules),
    ...detectObligationConflicts(evaluatedRules),
  ];

  // Deduplicate by id
  const seen = new Set<string>();
  return conflicts.filter(c => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

/**
 * Merge obligations from multiple jurisdictions, resolving conflicts
 */
export function mergeObligations(
  evaluatedRules: EvaluatedRule[],
  strategy: 'cumulative' | 'stricter' = 'cumulative'
): string[] {
  const allObligations = evaluatedRules.flatMap(
    ({ result }) => result.leaf.obligations || []
  );

  if (strategy === 'cumulative') {
    // Return all unique obligations
    return Array.from(new Set(allObligations));
  }

  // For 'stricter', would need more sophisticated logic
  // based on obligation semantics
  return Array.from(new Set(allObligations));
}
