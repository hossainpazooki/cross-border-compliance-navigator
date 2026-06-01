/**
 * BottomWorkbench Component
 * Tabbed workbench for Jurisdictions, Pathway, Conflicts, What-If
 * Phase 6: Conflict highlighting wired to tree
 * Phase 7: What-If scenario analysis UI
 */

import { useState } from 'react';
import { usePanelState, useCanvasState, useTreeHighlight } from '@/hooks';
import { useResultsStore } from '@features/navigation/model';
import { useCounterfactual } from '@features/counterfactual/model';
import { Badge, Button, LoadingSpinner, PanelHeader } from '@shared/ui';
import { WorkbenchArea } from './CanvasLayout';
import { JURISDICTIONS, JURISDICTION_LIST } from '@entities/jurisdiction/model';
import { QueueList, HITLReviewPanel } from '@features/hitl-review';
import type { QueueItem } from '@features/hitl-review/api/hitl';
import type { ScenarioType } from '@/types/common';

type WorkbenchTab = 'jurisdictions' | 'pathway' | 'conflicts' | 'whatif' | 'hitl';

const TABS: Array<{ id: WorkbenchTab; label: string }> = [
  { id: 'jurisdictions', label: 'Jurisdictions' },
  { id: 'pathway', label: 'Pathway' },
  { id: 'conflicts', label: 'Conflicts' },
  { id: 'whatif', label: 'What-If' },
  { id: 'hitl', label: 'HITL Review' },
];

const SCENARIO_TYPES: Array<{ type: ScenarioType; label: string; description: string }> = [
  { type: 'jurisdiction_change', label: 'Jurisdiction', description: 'Change target jurisdiction' },
  { type: 'entity_change', label: 'Entity Type', description: 'Change issuer/actor type' },
  { type: 'threshold', label: 'Threshold', description: 'Adjust reserve amount' },
  { type: 'temporal', label: 'Temporal', description: 'Change effective date' },
];

export function BottomWorkbench() {
  const { panels, togglePanel } = usePanelState();
  const { analysisComplete } = useCanvasState();
  const { navigationResult, counterfactualResults } = useResultsStore();
  const { highlightNodes, clearHighlight } = useTreeHighlight();
  const { analyze, isLoading: isAnalyzing } = useCounterfactual();
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('jurisdictions');

  // What-If state
  const [selectedScenarioType, setSelectedScenarioType] = useState<ScenarioType | null>(null);
  const [scenarioParams, setScenarioParams] = useState<Record<string, unknown>>({});

  // HITL state
  const [selectedQueueItem, setSelectedQueueItem] = useState<QueueItem | null>(null);

  const isExpanded = panels.workbench === 'expanded';

  // Counts for badges
  const jurisdictionCount = navigationResult?.jurisdiction_results.length || 0;
  const pathwaySteps = navigationResult?.pathway?.length || 0;
  const conflictCount = navigationResult?.conflicts?.length || 0;

  // Build summary for collapsed state
  const summary = analysisComplete
    ? `${jurisdictionCount} jurisdictions • ${pathwaySteps} steps • ${conflictCount} conflicts`
    : 'Run analysis to see workbench';

  // Handle conflict highlight
  const handleHighlightConflict = (anchorNodeIds?: string[]) => {
    if (anchorNodeIds?.length) {
      highlightNodes(anchorNodeIds, 'conflict');
    } else {
      // If no anchor nodes, clear highlight
      clearHighlight();
    }
  };

  // Handle What-If analysis
  const handleRunWhatIf = () => {
    if (!selectedScenarioType) return;

    analyze({
      type: selectedScenarioType,
      name: `${selectedScenarioType} scenario`,
      parameters: scenarioParams,
    });
  };

  // Get the latest counterfactual result
  const latestResult = counterfactualResults?.[counterfactualResults.length - 1];

  return (
    <WorkbenchArea>
      <PanelHeader
        title="Workbench"
        isExpanded={isExpanded}
        onToggle={() => togglePanel('workbench')}
        summary={!isExpanded ? summary : undefined}
        actions={
          isExpanded && (
            <div className="flex gap-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {tab.label}
                  {tab.id === 'jurisdictions' && jurisdictionCount > 0 && (
                    <Badge variant="info" size="sm" className="ml-2">
                      {jurisdictionCount}
                    </Badge>
                  )}
                  {tab.id === 'conflicts' && conflictCount > 0 && (
                    <Badge variant="warning" size="sm" className="ml-2">
                      {conflictCount}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          )
        }
      />

      {isExpanded && (
        <div className="flex-1 overflow-auto p-4">
          {!analysisComplete ? (
            <div className="flex h-full items-center justify-center text-slate-400">
              Run analysis to populate workbench
            </div>
          ) : (
            <>
              {/* Jurisdictions Tab */}
              {activeTab === 'jurisdictions' && (
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {navigationResult?.jurisdiction_results.map((result) => (
                    <div
                      key={result.jurisdiction}
                      className="shrink-0 rounded-lg border border-slate-700 bg-slate-800/50 p-4"
                      style={{ minWidth: '200px' }}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-xl">
                          {JURISDICTIONS[result.jurisdiction]?.flag}
                        </span>
                        <span className="font-medium text-white">
                          {JURISDICTIONS[result.jurisdiction]?.name}
                        </span>
                      </div>
                      <Badge
                        variant={
                          result.status === 'compliant'
                            ? 'success'
                            : result.status === 'blocked'
                              ? 'error'
                              : 'warning'
                        }
                      >
                        {result.status}
                      </Badge>
                      <p className="mt-2 text-sm text-slate-400">
                        {result.obligations?.length || 0} obligations
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Pathway Tab */}
              {activeTab === 'pathway' && (
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {navigationResult?.pathway?.map((step, i) => (
                    <div
                      key={i}
                      className="relative shrink-0 rounded-lg border border-slate-700 bg-slate-800/50 p-4"
                      style={{ minWidth: '180px' }}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs text-white">
                          {i + 1}
                        </span>
                        <span className="text-sm font-medium text-white">
                          {step.action}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        {step.timeline ? `${step.timeline.min_days}-${step.timeline.max_days} days` : 'Timeline TBD'}
                      </p>
                      {i < (navigationResult?.pathway?.length || 0) - 1 && (
                        <div className="absolute -right-3 top-1/2 text-slate-500">
                          →
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Conflicts Tab - Phase 6: Wired to tree highlight */}
              {activeTab === 'conflicts' && (
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {conflictCount === 0 ? (
                    <div className="flex h-full w-full items-center justify-center text-slate-400">
                      No conflicts detected
                    </div>
                  ) : (
                    navigationResult?.conflicts?.map((conflict, i) => (
                      <div
                        key={i}
                        className="shrink-0 rounded-lg border border-slate-700 bg-slate-800/50 p-4"
                        style={{ minWidth: '250px' }}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <Badge
                            variant={
                              conflict.severity === 'blocking'
                                ? 'error'
                                : conflict.severity === 'warning'
                                  ? 'warning'
                                  : 'info'
                            }
                          >
                            {conflict.severity}
                          </Badge>
                          <span className="text-sm text-slate-400">
                            {conflict.type}
                          </span>
                        </div>
                        <p className="text-sm text-white">
                          {conflict.description}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2"
                          onClick={() => handleHighlightConflict(conflict.anchor_node_ids)}
                        >
                          Highlight in tree
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* HITL Review Tab */}
              {activeTab === 'hitl' && (
                <div className="flex gap-6">
                  <div className="w-80 shrink-0 overflow-y-auto">
                    <h4 className="mb-3 text-sm font-medium text-slate-300">Escalated Deals</h4>
                    <QueueList
                      selectedId={selectedQueueItem?.app_id}
                      onSelect={setSelectedQueueItem}
                    />
                  </div>
                  <div className="flex-1">
                    {selectedQueueItem ? (
                      <HITLReviewPanel
                        item={selectedQueueItem}
                        onComplete={() => setSelectedQueueItem(null)}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-600 p-6 text-center">
                        <p className="text-slate-400">Select a deal from the queue to review</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* What-If Tab - Phase 7: Full implementation */}
              {activeTab === 'whatif' && (
                <div className="flex gap-6">
                  {/* Scenario Selector */}
                  <div className="w-80 shrink-0">
                    <h4 className="mb-3 text-sm font-medium text-slate-300">Select Scenario Type</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {SCENARIO_TYPES.map((scenario) => (
                        <button
                          key={scenario.type}
                          type="button"
                          onClick={() => {
                            setSelectedScenarioType(scenario.type);
                            setScenarioParams({});
                          }}
                          className={`rounded-lg border p-3 text-left transition-colors ${
                            selectedScenarioType === scenario.type
                              ? 'border-blue-500 bg-blue-500/10 text-white'
                              : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                          }`}
                        >
                          <p className="text-sm font-medium">{scenario.label}</p>
                          <p className="mt-1 text-xs text-slate-500">{scenario.description}</p>
                        </button>
                      ))}
                    </div>

                    {/* Parameter Input based on scenario type */}
                    {selectedScenarioType && (
                      <div className="mt-4">
                        <h4 className="mb-2 text-sm font-medium text-slate-300">Parameters</h4>
                        {selectedScenarioType === 'jurisdiction_change' && (
                          <select
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                            value={(scenarioParams.target_jurisdiction as string) || ''}
                            onChange={(e) => setScenarioParams({ target_jurisdiction: e.target.value })}
                          >
                            <option value="">Select jurisdiction...</option>
                            {JURISDICTION_LIST.map((j) => (
                              <option key={j.code} value={j.code}>
                                {j.flag} {j.name}
                              </option>
                            ))}
                          </select>
                        )}
                        {selectedScenarioType === 'entity_change' && (
                          <select
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                            value={(scenarioParams.entity_type as string) || ''}
                            onChange={(e) => setScenarioParams({ entity_type: e.target.value })}
                          >
                            <option value="">Select entity type...</option>
                            <option value="credit_institution">Credit Institution</option>
                            <option value="e_money_institution">E-Money Institution</option>
                            <option value="payment_institution">Payment Institution</option>
                            <option value="unregulated">Unregulated Entity</option>
                          </select>
                        )}
                        {selectedScenarioType === 'threshold' && (
                          <input
                            type="number"
                            placeholder="Reserve amount (EUR)"
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                            value={(scenarioParams.reserve_value_eur as number) || ''}
                            onChange={(e) => setScenarioParams({ reserve_value_eur: Number(e.target.value) })}
                          />
                        )}
                        {selectedScenarioType === 'temporal' && (
                          <input
                            type="date"
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                            value={(scenarioParams.effective_date as string) || ''}
                            onChange={(e) => setScenarioParams({ effective_date: e.target.value })}
                          />
                        )}

                        <Button
                          variant="primary"
                          size="sm"
                          className="mt-4 w-full"
                          onClick={handleRunWhatIf}
                          disabled={isAnalyzing || Object.keys(scenarioParams).length === 0}
                        >
                          {isAnalyzing ? (
                            <>
                              <LoadingSpinner size="sm" className="mr-2" />
                              Analyzing...
                            </>
                          ) : (
                            'Run What-If Analysis'
                          )}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Delta Analysis Results */}
                  <div className="flex-1">
                    {latestResult ? (
                      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                        <h4 className="mb-3 text-sm font-medium text-slate-300">Delta Analysis</h4>

                        {/* Status Change */}
                        <div className="mb-4 flex items-center gap-3">
                          <Badge variant={latestResult.delta.status_changed ? 'warning' : 'success'}>
                            {latestResult.delta.status_changed ? 'Status Changed' : 'Status Unchanged'}
                          </Badge>
                          {latestResult.delta.status_changed && (
                            <span className="text-sm text-slate-400">
                              {latestResult.delta.status_from} → {latestResult.delta.status_to}
                            </span>
                          )}
                        </div>

                        {/* Risk Delta */}
                        <div className="mb-4">
                          <p className="text-xs text-slate-500">Risk Delta</p>
                          <div className="flex items-center gap-2">
                            <div className={`text-lg font-medium ${
                              latestResult.delta.risk_delta > 0 ? 'text-red-400' :
                              latestResult.delta.risk_delta < 0 ? 'text-green-400' :
                              'text-slate-400'
                            }`}>
                              {latestResult.delta.risk_delta > 0 ? '+' : ''}{latestResult.delta.risk_delta}
                            </div>
                            <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  latestResult.delta.risk_delta > 0 ? 'bg-red-500' :
                                  latestResult.delta.risk_delta < 0 ? 'bg-green-500' :
                                  'bg-slate-500'
                                }`}
                                style={{ width: `${Math.abs(latestResult.delta.risk_delta) * 25}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* New Requirements */}
                        {latestResult.delta.new_requirements.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs text-slate-500 mb-1">New Requirements</p>
                            <ul className="text-sm text-amber-400">
                              {latestResult.delta.new_requirements.map((req, i) => (
                                <li key={i}>+ {req}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Removed Requirements */}
                        {latestResult.delta.removed_requirements.length > 0 && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Removed Requirements</p>
                            <ul className="text-sm text-green-400">
                              {latestResult.delta.removed_requirements.map((req, i) => (
                                <li key={i}>- {req}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Explanation */}
                        {latestResult.explanation && (
                          <div className="mt-4 border-t border-slate-700 pt-4">
                            <p className="text-sm text-slate-300">{latestResult.explanation.summary}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-600 p-6 text-center">
                        <div>
                          <p className="text-slate-400">Select a scenario and run analysis</p>
                          <p className="mt-2 text-sm text-slate-500">
                            Compare outcomes and see how changes affect compliance
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </WorkbenchArea>
  );
}
