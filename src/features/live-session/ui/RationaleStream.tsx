import { useRationale } from '../selectors';
import { RationaleBadge } from './RationaleBadge';

interface RationaleStreamProps {
  intentId: string;
  crossingId: string;
}

export function RationaleStream({ intentId, crossingId }: RationaleStreamProps) {
  const rationale = useRationale(intentId, crossingId);

  if (!rationale) {
    return (
      <div className="text-sm text-slate-500" aria-live="polite">
        Waiting for rationale…
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <RationaleBadge status={rationale.status} finalScore={rationale.final_score} />
        {rationale.status === 'retracted' && rationale.retraction_reason && (
          <span className="text-xs text-red-300">{rationale.retraction_reason}</span>
        )}
      </div>
      <div
        aria-live="polite"
        className="min-h-[3.5rem] overflow-y-auto whitespace-pre-wrap rounded-md bg-slate-950 p-3 text-sm leading-relaxed text-slate-200"
        style={{ maxHeight: '12rem' }}
      >
        {rationale.content}
      </div>
    </div>
  );
}
