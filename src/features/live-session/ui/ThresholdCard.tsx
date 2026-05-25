import type { ThresholdCrossing } from '@platform/contracts';
import { CitationHeader } from './CitationHeader';
import { VerdictTransitionPill } from './VerdictTransitionPill';
import { RationaleStream } from './RationaleStream';

interface ThresholdCardProps {
  intentId: string;
  crossing: ThresholdCrossing;
}

function formatBoundary(boundary: string): string {
  const n = Number(boundary);
  if (!Number.isFinite(n)) return boundary;
  return n.toLocaleString('en-US');
}

export function ThresholdCard({ intentId, crossing }: ThresholdCardProps) {
  return (
    <article
      className="rounded-lg border border-slate-800 bg-slate-900 p-4 space-y-3"
      aria-labelledby={`crossing-${crossing.crossing_id}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CitationHeader ruleId={crossing.rule_id} citation={crossing.citation} />
          <div
            id={`crossing-${crossing.crossing_id}`}
            className="text-xs text-slate-400 tabular-nums"
          >
            <time dateTime={crossing.ts}>{crossing.ts}</time>
            <span className="mx-1.5">·</span>
            <span>
              {crossing.direction === 'crossed_up' ? '▲ crossed' : '▼ crossed'}{' '}
              {formatBoundary(crossing.boundary)}
            </span>
          </div>
        </div>
        <VerdictTransitionPill prior={crossing.prior_verdict} next={crossing.new_verdict} />
      </header>
      <RationaleStream intentId={intentId} crossingId={crossing.crossing_id} />
    </article>
  );
}
