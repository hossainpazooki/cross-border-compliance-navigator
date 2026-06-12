import { useResultsStore } from '@features/navigation/model';
import { useUIStore } from '@app/stores';
import { useDecoder } from '@features/decoder/model';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@shared/ui';
import { cn } from '@shared/lib';
import type { ExplanationTier } from '@/types/common';

const TIERS: Array<{
  value: ExplanationTier;
  label: string;
  description: string;
}> = [
  {
    value: 'retail',
    label: 'Retail',
    description: 'Plain language for end users',
  },
  {
    value: 'protocol',
    label: 'Protocol',
    description: 'Technical details for developers',
  },
  {
    value: 'institutional',
    label: 'Institutional',
    description: 'Compliance-focused for funds',
  },
  {
    value: 'regulator',
    label: 'Regulator',
    description: 'Full legal analysis',
  },
];

export function Decoder() {
  const { navigationResult, decoderResult } = useResultsStore();
  const { selectedTier, setSelectedTier } = useUIStore();
  const { explain, isLoading } = useDecoder();

  if (!navigationResult) {
    return (
      <Card variant="bordered">
        <CardContent>
          <p className="text-center text-slate-400">
            Run an analysis first to generate explanations.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleGenerate = () => {
    explain({
      tier: selectedTier,
      include_citations: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* Tier Selector */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Decision Decoder</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Explanation Tier
              </label>
              <div className="grid grid-cols-4 gap-3">
                {TIERS.map((tier) => (
                  <button
                    key={tier.value}
                    type="button"
                    onClick={() => setSelectedTier(tier.value)}
                    className={cn(
                      'rounded-lg border p-3 text-left transition-all',
                      selectedTier === tier.value
                        ? 'border-blue-500 bg-blue-500/20'
                        : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
                    )}
                  >
                    <p className="font-medium text-white">{tier.label}</p>
                    <p className="text-xs text-slate-400">{tier.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleGenerate} isLoading={isLoading}>
                Generate Explanation
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Explanation Result */}
      {decoderResult && (
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>Explanation</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="info">{decoderResult.tier}</Badge>
              <Badge
                variant={
                  decoderResult.summary.risk_level === 'LOW'
                    ? 'success'
                    : decoderResult.summary.risk_level === 'MEDIUM'
                      ? 'warning'
                      : 'error'
                }
              >
                {decoderResult.summary.risk_level} Risk
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Canonical Decision - Droit pattern: never leave the authoritative answer */}
              <div className="rounded-lg border-l-4 border-green-500 bg-slate-800 p-4">
                <div className="mb-1 text-sm text-slate-400">Canonical Decision</div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      decoderResult.summary.status === 'APPROVED'
                        ? 'success'
                        : decoderResult.summary.status === 'DENIED'
                          ? 'error'
                          : 'warning'
                    }
                  >
                    {decoderResult.summary.status}
                  </Badge>
                  <span className="text-lg font-medium text-white">
                    {decoderResult.explanation.headline}
                  </span>
                </div>
                <div className="mt-2 text-sm text-slate-400">
                  This is the authoritative decision from the rule engine.
                  {decoderResult.summary.confidence_level === 'grounded' && (
                    <span className="ml-2 text-green-400">(Fully grounded in rules)</span>
                  )}
                </div>
              </div>

              {/* AI Explanation - Collapsible per Droit pattern */}
              <details className="group">
                <summary className="cursor-pointer list-none rounded-lg bg-slate-700/30 p-3 text-slate-300 hover:bg-slate-700/50 hover:text-white">
                  <span className="flex items-center justify-between">
                    <span>View AI Explanation</span>
                    <svg
                      className="h-5 w-5 transition-transform group-open:rotate-180"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </summary>
                <div className="mt-3 space-y-4 rounded-lg bg-slate-900/50 p-4">
                  {/* Body */}
                  <div>
                    <p className="whitespace-pre-wrap text-slate-200">
                      {decoderResult.explanation.body}
                    </p>
                  </div>

                  {/* Conditions */}
                  {decoderResult.explanation.conditions.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-sm font-medium text-slate-300">
                        Conditions
                      </h4>
                      <ul className="list-inside list-disc space-y-1 text-sm text-slate-400">
                        {decoderResult.explanation.conditions.map((condition, i) => (
                          <li key={i}>{condition}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Warnings */}
                  {decoderResult.explanation.warnings.length > 0 && (
                    <div className="rounded-lg bg-amber-500/10 p-4">
                      <h4 className="mb-2 text-sm font-medium text-amber-400">
                        Warnings
                      </h4>
                      <ul className="list-inside list-disc space-y-1 text-sm text-amber-200">
                        {decoderResult.explanation.warnings.map((warning, i) => (
                          <li key={i}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* AI Disclaimer */}
                  <p className="mt-4 text-xs italic text-slate-500">
                    This explanation is AI-generated to help understand the decision.
                    The canonical decision above is authoritative.
                  </p>
                </div>
              </details>

              {/* Citations */}
              {decoderResult.citations.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-slate-300">
                    Citations
                  </h4>
                  <div className="space-y-2">
                    {decoderResult.citations.map((citation) => (
                      <div
                        key={citation.id}
                        className="rounded-lg bg-slate-700/30 p-3"
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-white">
                            {citation.reference}
                          </p>
                          <Badge variant="default" size="sm">
                            {citation.relevance}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-slate-400">
                          {citation.text}
                        </p>
                        {citation.url && (
                          <a
                            href={citation.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 text-xs text-blue-400 hover:underline"
                          >
                            View source
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Audit Info */}
              <div className="border-t border-slate-700 pt-4">
                <p className="text-xs text-slate-500">
                  Generated at {decoderResult.generated_at} | Rules evaluated:{' '}
                  {decoderResult.audit.rules_evaluated} | Processing time:{' '}
                  {decoderResult.audit.processing_time_ms}ms
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
