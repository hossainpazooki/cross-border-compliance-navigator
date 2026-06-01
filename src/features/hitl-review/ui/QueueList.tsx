import { useHITLQueue } from '../model/useHITLQueue';
import type { QueueItem } from '../api/hitl';
import { Badge, LoadingSpinner } from '@shared/ui';
import { cn } from '@shared/lib';

function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

const RECOMMENDATION_VARIANT: Record<string, 'success' | 'error' | 'warning'> = {
  approve: 'success',
  decline: 'error',
  refer: 'warning',
};

interface QueueListProps {
  selectedId?: string | null;
  onSelect: (item: QueueItem) => void;
}

export function QueueList({ selectedId, onSelect }: QueueListProps) {
  const { data: queue, isLoading } = useHITLQueue();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (!queue || queue.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-400">
        No items in review queue
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {queue.map((item) => (
        <button
          key={item.app_id}
          type="button"
          onClick={() => onSelect(item)}
          className={cn(
            'w-full rounded-lg border p-3 text-left transition-colors',
            selectedId === item.app_id
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
          )}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-white">{item.borrower_name}</span>
            <Badge variant={RECOMMENDATION_VARIANT[item.recommendation]} size="sm">
              {item.recommendation}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>{formatUSD(item.deal_amount_usd)}</span>
            <Badge variant="default" size="sm">{item.industry}</Badge>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full',
                  item.confidence >= 0.75 ? 'bg-green-500' : item.confidence >= 0.5 ? 'bg-amber-500' : 'bg-red-500'
                )}
                style={{ width: `${item.confidence * 100}%` }}
              />
            </div>
            <span className="text-xs text-slate-500">{(item.confidence * 100).toFixed(0)}%</span>
          </div>
          {item.escalation_reason && (
            <p className="mt-1 text-xs text-slate-500">{item.escalation_reason}</p>
          )}
        </button>
      ))}
    </div>
  );
}
