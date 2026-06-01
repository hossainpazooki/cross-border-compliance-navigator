import { useMutation } from '@tanstack/react-query';
import { counterfactualApi } from '../api/counterfactual';
import { useResultsStore } from '@features/navigation/model';
import { useUIStore } from '@app/stores';
import type { InlineAnalyzeRequest, Scenario, CounterfactualResponse } from '@/types/counterfactual';

/**
 * Generate demo counterfactual response when backend is unavailable
 */
function generateDemoCounterfactualResponse(request: InlineAnalyzeRequest): CounterfactualResponse {
  const scenario = request.scenario;

  // Generate different deltas based on scenario type
  let statusChanged = false;
  let riskDelta = 0;
  const newRequirements: string[] = [];
  const removedRequirements: string[] = [];

  switch (scenario.type) {
    case 'jurisdiction_change':
      statusChanged = true;
      riskDelta = scenario.parameters.target_jurisdiction === 'US' ? 1 : -1;
      if (scenario.parameters.target_jurisdiction === 'US') {
        newRequirements.push('SEC registration or exemption required');
        newRequirements.push('State money transmitter licenses may apply');
      } else if (scenario.parameters.target_jurisdiction === 'SG') {
        newRequirements.push('MAS Payment Services Act registration');
        removedRequirements.push('EU-specific whitepaper requirements');
      }
      break;
    case 'entity_change':
      statusChanged = scenario.parameters.entity_type === 'credit_institution';
      riskDelta = scenario.parameters.entity_type === 'credit_institution' ? -2 : 0;
      if (scenario.parameters.entity_type === 'credit_institution') {
        removedRequirements.push('Separate e-money authorization');
        removedRequirements.push('Additional capital requirements');
      }
      break;
    case 'threshold': {
      const reserveValue = scenario.parameters.reserve_value_eur as number || 0;
      statusChanged = reserveValue >= 5000000000; // €5B significant threshold
      riskDelta = reserveValue >= 5000000000 ? 2 : 0;
      if (reserveValue >= 5000000000) {
        newRequirements.push('Significant EMT classification under MiCA');
        newRequirements.push('Enhanced liquidity requirements');
        newRequirements.push('Recovery and resolution planning');
      }
      break;
    }
    case 'temporal':
      riskDelta = 0;
      newRequirements.push('Updated compliance requirements may apply');
      break;
    case 'rate_shock':
      statusChanged = true;
      riskDelta = 2;
      newRequirements.push('Stress test DSCR under elevated rates');
      newRequirements.push('Re-evaluate debt service coverage at +200bps');
      removedRequirements.push('Standard rate assumption');
      break;
    case 'revenue_decline':
      statusChanged = true;
      riskDelta = 1;
      newRequirements.push('Revised cash flow projections required');
      newRequirements.push('Additional collateral may be needed');
      break;
    case 'covenant_breach':
      statusChanged = true;
      riskDelta = 3;
      newRequirements.push('Covenant waiver or amendment required');
      newRequirements.push('Enhanced monitoring and reporting');
      newRequirements.push('Risk committee escalation');
      break;
    default:
      riskDelta = 0;
  }

  return {
    counterfactual_id: `demo-cf-${Date.now()}`,
    baseline_decision_id: `demo-baseline-${Date.now()}`,
    generated_at: new Date().toISOString(),
    scenario_applied: scenario,
    baseline_outcome: {
      status: 'requires_action',
      framework: 'MiCA 2023/1114',
      risk_level: 'MEDIUM',
      conditions: ['Authorization required', 'Whitepaper submission', 'Reserve requirements'],
    },
    counterfactual_outcome: {
      status: statusChanged ? (riskDelta > 0 ? 'blocked' : 'compliant') : 'requires_action',
      framework: scenario.type === 'jurisdiction_change'
        ? `${scenario.parameters.target_jurisdiction} Framework`
        : 'MiCA 2023/1114',
      risk_level: riskDelta > 0 ? 'HIGH' : riskDelta < 0 ? 'LOW' : 'MEDIUM',
      conditions: statusChanged
        ? [...newRequirements]
        : ['Authorization required', 'Whitepaper submission', 'Reserve requirements'],
    },
    delta: {
      status_changed: statusChanged,
      status_from: 'requires_action',
      status_to: statusChanged ? (riskDelta > 0 ? 'blocked' : 'compliant') : 'requires_action',
      framework_changed: scenario.type === 'jurisdiction_change',
      frameworks_added: scenario.type === 'jurisdiction_change' ? [`${scenario.parameters.target_jurisdiction}`] : [],
      frameworks_removed: scenario.type === 'jurisdiction_change' ? ['EU'] : [],
      risk_delta: riskDelta,
      risk_factors_added: riskDelta > 0 ? ['Increased regulatory complexity'] : [],
      risk_factors_removed: riskDelta < 0 ? ['Multi-jurisdiction requirements'] : [],
      new_requirements: newRequirements,
      removed_requirements: removedRequirements,
      modified_requirements: [],
    },
    explanation: {
      summary: `Scenario analysis: ${scenario.type.replace('_', ' ')} shows ${statusChanged ? 'significant' : 'minimal'} impact on compliance status.`,
      key_differences: [
        {
          aspect: 'Regulatory Framework',
          description: scenario.type === 'jurisdiction_change'
            ? `Different regulatory regime applies in ${scenario.parameters.target_jurisdiction}`
            : 'Same regulatory framework with modified parameters',
        },
        {
          aspect: 'Risk Profile',
          description: riskDelta > 0
            ? 'Increased compliance complexity and risk'
            : riskDelta < 0
              ? 'Reduced compliance burden'
              : 'Similar risk profile to baseline',
        },
      ],
    },
    citations: [],
  };
}

export function useCounterfactual() {
  const { addCounterfactualResult, setAnalyzing, setCounterfactualError } =
    useResultsStore();
  const { selectedTier } = useUIStore();

  const mutation = useMutation({
    mutationFn: async (request: InlineAnalyzeRequest): Promise<CounterfactualResponse> => {
      try {
        // Try backend first
        return await counterfactualApi.analyzeInline(request);
      } catch (error) {
        // Fall back to demo mode if backend unavailable
        console.warn('Backend unavailable, using demo counterfactual data');
        return generateDemoCounterfactualResponse(request);
      }
    },
    onMutate: () => {
      setAnalyzing(true);
      setCounterfactualError(null);
    },
    onSuccess: (data) => {
      addCounterfactualResult(data);
    },
    onError: (error: Error) => {
      setCounterfactualError(error.message);
    },
  });

  const analyze = (scenario: Scenario, params?: Partial<InlineAnalyzeRequest>) => {
    const request: InlineAnalyzeRequest = {
      scenario,
      include_explanation: true,
      explanation_tier: selectedTier,
      ...params,
    };
    mutation.mutate(request);
  };

  return {
    analyze,
    isLoading: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
