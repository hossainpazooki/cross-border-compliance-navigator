import type { TraceNode, LeafNode } from '@/types/decisionTree';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@shared/ui';
import { TraceStep } from './TraceStep';

interface TraceExplorerProps {
  trace: TraceNode[];
  finalNode?: LeafNode;
  title?: string;
  highlightedNodeId?: string | null;
  onNodeHover?: (nodeId: string | null) => void;
  horizontal?: boolean;
}

/** Credit pipeline phase label mapping */
const CREDIT_PHASE_LABELS: Record<string, string> = {
  'doc-classification': 'Document Classification',
  'dscr-check': 'Financial Agent',
  'credit-score-check': 'Financial Agent',
  'legal-analysis': 'Legal Agent',
  'market-analysis': 'Market Agent',
  'synthesis': 'Synthesis',
  'hitl-review': 'HITL Routing',
  'auto-approve': 'HITL Routing',
};

function getCreditPhaseLabel(nodeId: string): string | null {
  return CREDIT_PHASE_LABELS[nodeId] || null;
}

/**
 * Get status color variant
 */
function getStatusVariant(status: string): 'success' | 'warning' | 'error' | 'info' {
  switch (status) {
    case 'compliant':
      return 'success';
    case 'requires_action':
      return 'warning';
    case 'blocked':
      return 'error';
    default:
      return 'info';
  }
}

export function TraceExplorer({
  trace,
  finalNode,
  title = 'Decision Trace',
  highlightedNodeId,
  onNodeHover,
  horizontal = false,
}: TraceExplorerProps) {
  if (trace.length === 0) {
    return (
      <div className="flex items-center justify-center p-4 text-slate-400">
        No evaluation trace available.
      </div>
    );
  }

  // Horizontal layout for bottom panel
  if (horizontal) {
    return (
      <div className="flex h-full items-center gap-2">
        {trace.map((step, index) => (
          <div key={step.nodeId} className="flex items-center gap-2">
            <div
              className={`shrink-0 rounded-lg border px-3 py-2 text-xs transition-colors ${
                highlightedNodeId === step.nodeId
                  ? 'border-purple-500 bg-purple-500/20'
                  : step.result
                    ? 'border-emerald-500/50 bg-emerald-500/10'
                    : 'border-slate-600 bg-slate-800/50'
              }`}
              onMouseEnter={() => onNodeHover?.(step.nodeId)}
              onMouseLeave={() => onNodeHover?.(null)}
            >
              {getCreditPhaseLabel(step.nodeId) && (
                <div className="text-[10px] text-purple-400 mb-0.5">{getCreditPhaseLabel(step.nodeId)}</div>
              )}
              <div className="font-medium text-slate-200 whitespace-nowrap">
                {step.condition}
              </div>
              <div className={`text-xs ${step.result ? 'text-emerald-400' : 'text-red-400'}`}>
                {step.result ? 'Yes' : 'No'}
              </div>
            </div>
            {index < trace.length - 1 && (
              <span className="text-slate-500">→</span>
            )}
          </div>
        ))}
        {finalNode && (
          <>
            <span className="text-slate-500">→</span>
            <div className="shrink-0 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2">
              <div className="flex items-center gap-2">
                <Badge variant={getStatusVariant(finalNode.status)} size="sm">
                  {finalNode.status.replace(/_/g, ' ')}
                </Badge>
              </div>
              <div className="mt-1 text-xs text-slate-300 max-w-48 truncate">
                {finalNode.decision}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Vertical layout (original)
  return (
    <Card variant="bordered">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-purple-400">📋</span>
          {title}
        </CardTitle>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>{trace.length} conditions evaluated</span>
        </div>
      </CardHeader>
      <CardContent>
        {/* Trace steps */}
        <div className="space-y-1">
          {trace.map((step, index) => (
            <TraceStep
              key={step.nodeId}
              step={step}
              stepNumber={index + 1}
              isLast={index === trace.length - 1 && !finalNode}
              isHighlighted={highlightedNodeId === step.nodeId}
              onHover={onNodeHover}
            />
          ))}
        </div>

        {/* Final decision */}
        {finalNode && (
          <div className="mt-4 rounded-lg border border-slate-600 bg-slate-800/80 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🎯</span>
              <span className="font-medium text-white">Final Decision</span>
              <Badge variant={getStatusVariant(finalNode.status)}>
                {finalNode.status.replace(/_/g, ' ')}
              </Badge>
            </div>
            <p className="text-sm text-slate-300 mb-3">{finalNode.decision}</p>

            {finalNode.obligations && finalNode.obligations.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-2">Obligations:</p>
                <div className="flex flex-wrap gap-1">
                  {finalNode.obligations.map((obligation, i) => (
                    <span
                      key={i}
                      className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300"
                    >
                      {obligation}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {finalNode.sourceRef && (
              <div className="mt-3 pt-3 border-t border-slate-700">
                <a
                  href={finalNode.sourceRef.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:underline"
                >
                  {finalNode.sourceRef.document_id}
                  {finalNode.sourceRef.article && ` Art. ${finalNode.sourceRef.article}`}
                </a>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
