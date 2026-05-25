import { cn } from '@shared/lib';
import type { Verdict } from '@platform/contracts';

interface VerdictTransitionPillProps {
  prior: Verdict;
  next: Verdict;
}

const VERDICT_CLASSES: Record<Verdict, string> = {
  compliant: 'bg-green-500/20 text-green-300',
  conditional: 'bg-amber-500/20 text-amber-300',
  blocked: 'bg-red-500/20 text-red-300',
};

function Chip({ verdict }: { verdict: Verdict }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
        VERDICT_CLASSES[verdict]
      )}
    >
      {verdict}
    </span>
  );
}

export function VerdictTransitionPill({ prior, next }: VerdictTransitionPillProps) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`Verdict change from ${prior} to ${next}`}>
      <Chip verdict={prior} />
      <span aria-hidden="true" className="text-slate-500">→</span>
      <Chip verdict={next} />
    </div>
  );
}
