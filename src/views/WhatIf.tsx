import { useState } from 'react';
import { useResultsStore } from '@features/navigation/model';
import { useCounterfactual } from '@features/counterfactual/model';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@shared/ui';
import { JURISDICTION_LIST } from '@entities/jurisdiction/model';
import { cn } from '@shared/lib';
import type { ScenarioType } from '@/types/common';

const SCENARIO_OPTIONS: Array<{
  type: ScenarioType;
  label: string;
  description: string;
}> = [
  {
    type: 'jurisdiction_change',
    label: 'Change Jurisdiction',
    description: 'Add or remove a target market',
  },
  {
    type: 'entity_change',
    label: 'Change Entity Type',
    description: 'Switch between retail/professional/institutional',
  },
  {
    type: 'threshold',
    label: 'Change Amount',
    description: 'Modify offering amount thresholds',
  },
  {
    type: 'temporal',
    label: 'Change Timing',
    description: 'Evaluate at a different effective date',
  },
];

export function WhatIf() {
  const { navigationResult, counterfactualResults } = useResultsStore();
  const { analyze, isLoading } = useCounterfactual();
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType | null>(
    null
  );
  const [scenarioParams, setScenarioParams] = useState<Record<string, unknown>>(
    {}
  );

  if (!navigationResult) {
    return (
      <Card variant="bordered">
        <CardContent>
          <p className="text-center text-slate-400">
            Run an analysis first to explore what-if scenarios.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleRunScenario = () => {
    if (!selectedScenario) return;

    analyze({
      type: selectedScenario,
      parameters: scenarioParams,
    });
  };

  return (
    <div className="space-y-6">
      {/* Scenario Builder */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>What-If Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Select Scenario Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                {SCENARIO_OPTIONS.map((option) => (
                  <button
                    key={option.type}
                    type="button"
                    onClick={() => {
                      setSelectedScenario(option.type);
                      setScenarioParams({});
                    }}
                    className={cn(
                      'rounded-lg border p-4 text-left transition-all',
                      selectedScenario === option.type
                        ? 'border-blue-500 bg-blue-500/20'
                        : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
                    )}
                  >
                    <p className="font-medium text-white">{option.label}</p>
                    <p className="text-sm text-slate-400">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Jurisdiction Change Parameters */}
            {selectedScenario === 'jurisdiction_change' && (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Modify Jurisdictions
                </label>
                <div className="flex gap-4">
                  <select
                    className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white"
                    value={(scenarioParams.action as string) || 'remove'}
                    onChange={(e) =>
                      setScenarioParams({
                        ...scenarioParams,
                        action: e.target.value,
                      })
                    }
                  >
                    <option value="remove">Remove</option>
                    <option value="add">Add</option>
                  </select>
                  <select
                    className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white"
                    value={(scenarioParams.jurisdiction as string) || ''}
                    onChange={(e) =>
                      setScenarioParams({
                        ...scenarioParams,
                        jurisdiction: e.target.value,
                      })
                    }
                  >
                    <option value="">Select jurisdiction...</option>
                    {JURISDICTION_LIST.map((j) => (
                      <option key={j.code} value={j.code}>
                        {j.flag} {j.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button
                onClick={handleRunScenario}
                isLoading={isLoading}
                disabled={!selectedScenario}
              >
                Run Scenario
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {counterfactualResults.length > 0 && (
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>Scenario Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {counterfactualResults.map((result, index) => (
                <div
                  key={result.counterfactual_id}
                  className="rounded-lg border border-slate-600 bg-slate-700/30 p-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-white">
                      Scenario {index + 1}: {result.scenario_applied.type}
                    </h4>
                    <Badge
                      variant={
                        result.delta.status_changed ? 'warning' : 'success'
                      }
                    >
                      {result.delta.status_changed
                        ? 'Status Changed'
                        : 'No Change'}
                    </Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-slate-800/50 p-3">
                      <p className="text-xs font-medium uppercase text-slate-400">
                        Baseline
                      </p>
                      <p className="mt-1 text-white">
                        {result.baseline_outcome.status}
                      </p>
                      <p className="text-sm text-slate-400">
                        {result.baseline_outcome.framework}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-800/50 p-3">
                      <p className="text-xs font-medium uppercase text-slate-400">
                        Counterfactual
                      </p>
                      <p className="mt-1 text-white">
                        {result.counterfactual_outcome.status}
                      </p>
                      <p className="text-sm text-slate-400">
                        {result.counterfactual_outcome.framework}
                      </p>
                    </div>
                  </div>

                  {result.delta.new_requirements.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-medium uppercase text-slate-400">
                        New Requirements
                      </p>
                      <ul className="mt-1 list-inside list-disc text-sm text-white">
                        {result.delta.new_requirements.map((req, i) => (
                          <li key={i}>{req}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
