/**
 * RightRail Component
 * Contains the Outcome summary and Decoder panel
 * Phase 5: Full DecoderPanel with citation anchoring
 * Supports credit mode with adapted tier labels
 */

import { useCallback, useEffect } from 'react';
import { usePanelState, useCanvasState, useDecoderAnchors } from '@/hooks';
import { useResultsStore, OutcomeSummary } from '@features/navigation';
import { useUIStore } from '@app/stores';
import { useDecoder, DecoderPanel } from '@features/decoder';
import { Badge, PanelHeader } from '@shared/ui';
import { RightRailArea } from './CanvasLayout';

/** Credit mode maps regulatory tiers to credit-specific labels */
export const CREDIT_TIER_LABELS: Record<string, string> = {
  retail: 'Summary',
  institutional: 'Detailed',
  regulatory: 'Audit Trail',
};

export function RightRail() {
  const { panels, togglePanel } = usePanelState();
  const { analysisComplete } = useCanvasState();
  const { navigationResult, decoderResult } = useResultsStore();
  const { selectedTier } = useUIStore();
  const { explain, isLoading: isDecoderLoading } = useDecoder();

  // Decoder anchor management
  const {
    highlightedCitationId,
    handleCitationClick,
    handleCitationHover,
    buildCitationNodeMap,
  } = useDecoderAnchors({
    // TODO: Connect to tree highlight when center pane integration is complete
    onHighlightTreeNodes: (nodeIds) => {
      console.log('Highlight tree nodes:', nodeIds);
    },
    onClearHighlight: () => {
      console.log('Clear tree highlight');
    },
  });

  // Build citation-node map when decoder result changes
  useEffect(() => {
    if (decoderResult?.citations) {
      buildCitationNodeMap(decoderResult.citations);
    }
  }, [decoderResult?.citations, buildCitationNodeMap]);

  const isExpanded = panels.rightRail === 'expanded';

  // Build summary for collapsed state
  const summary = navigationResult
    ? `${navigationResult.jurisdiction_results.length} jurisdictions evaluated`
    : 'No results yet';

  // Determine overall status
  const overallStatus = navigationResult?.jurisdiction_results.every(
    (r) => r.status === 'compliant'
  )
    ? 'COMPLIANT'
    : navigationResult?.jurisdiction_results.some((r) => r.status === 'blocked')
      ? 'BLOCKED'
      : 'CONDITIONAL';

  // Handle generate explanation
  const handleGenerateExplanation = useCallback(() => {
    explain({
      tier: selectedTier,
      include_citations: true,
    });
  }, [explain, selectedTier]);

  return (
    <RightRailArea>
      <PanelHeader
        title="Outcome"
        isExpanded={isExpanded}
        onToggle={() => togglePanel('rightRail')}
        summary={summary}
        badge={
          analysisComplete && (
            <Badge
              variant={
                overallStatus === 'COMPLIANT'
                  ? 'success'
                  : overallStatus === 'BLOCKED'
                    ? 'error'
                    : 'warning'
              }
              size="sm"
            >
              {overallStatus}
            </Badge>
          )
        }
      />

      {isExpanded ? (
        <div className="flex-1 overflow-y-auto p-4">
          {analysisComplete && navigationResult ? (
            <div className="space-y-6">
              {/* Outcome Summary with canonical decision */}
              <OutcomeSummary result={navigationResult} />

              {/* Decoder Panel with AI explanation and citations */}
              <DecoderPanel
                decoderResult={decoderResult}
                isLoading={isDecoderLoading}
                onGenerate={handleGenerateExplanation}
                onCitationClick={handleCitationClick}
                onCitationHighlight={handleCitationHover}
                highlightedCitationId={highlightedCitationId ?? undefined}
              />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="rounded-lg border border-dashed border-slate-600 p-8">
                <p className="text-slate-400">
                  Run analysis to see compliance outcome
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center gap-2 p-2 pt-4">
          {/* Collapsed state: vertical summary */}
          {analysisComplete ? (
            <>
              <Badge
                variant={
                  overallStatus === 'COMPLIANT'
                    ? 'success'
                    : overallStatus === 'BLOCKED'
                      ? 'error'
                      : 'warning'
                }
                size="sm"
              >
                {overallStatus.charAt(0)}
              </Badge>
              <div className="text-center text-xs text-slate-500">
                <div>{navigationResult?.jurisdiction_results.length}</div>
                <div>juris</div>
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-500">—</div>
          )}
        </div>
      )}
    </RightRailArea>
  );
}
