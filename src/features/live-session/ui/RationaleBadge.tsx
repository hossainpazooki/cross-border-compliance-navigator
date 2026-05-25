import { cn } from '@shared/lib';
import type { NLIStatus } from '@platform/contracts';

interface RationaleBadgeProps {
  status: NLIStatus;
  finalScore?: number;
}

const STATUS_LABEL: Record<NLIStatus, string> = {
  streaming: 'Streaming',
  verified: 'Verified',
  retracted: 'Retracted',
};

const STATUS_CLASSES: Record<NLIStatus, string> = {
  streaming: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  verified: 'bg-green-500/20 text-green-300 border-green-500/40',
  retracted: 'bg-red-500/20 text-red-300 border-red-500/40',
};

export function RationaleBadge({ status, finalScore }: RationaleBadgeProps) {
  const showScore =
    (status === 'verified' || status === 'retracted') && finalScore !== undefined;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums',
        STATUS_CLASSES[status]
      )}
      role="status"
    >
      {status === 'streaming' && (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-current"
        />
      )}
      <span>{STATUS_LABEL[status]}</span>
      {showScore && <span className="opacity-80">{finalScore.toFixed(2)}</span>}
    </span>
  );
}
