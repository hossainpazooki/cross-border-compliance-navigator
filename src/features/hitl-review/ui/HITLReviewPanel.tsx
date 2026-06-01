import { useState } from 'react';
import type { QueueItem } from '../api/hitl';
import { useSubmitReview } from '../model/useHITLQueue';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@shared/ui';
import { cn } from '@shared/lib';

function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

const RECOMMENDATION_VARIANT: Record<string, 'success' | 'error' | 'warning'> = {
  approve: 'success',
  decline: 'error',
  refer: 'warning',
};

interface HITLReviewPanelProps {
  item: QueueItem;
  onComplete?: () => void;
}

type Decision = 'approve' | 'decline' | 'override';

const DECISION_STYLES: Record<Decision, string> = {
  approve: 'border-green-500 bg-green-500/20 text-green-400',
  decline: 'border-red-500 bg-red-500/20 text-red-400',
  override: 'border-amber-500 bg-amber-500/20 text-amber-400',
};

export function HITLReviewPanel({ item, onComplete }: HITLReviewPanelProps) {
  const [decision, setDecision] = useState<Decision | null>(null);
  const [notes, setNotes] = useState('');
  const { mutate: submitReview, isPending } = useSubmitReview();

  const handleSubmit = () => {
    if (!decision) return;
    submitReview(
      {
        appId: item.app_id,
        decision: {
          reviewer_id: 'current-user',
          decision,
          notes,
        },
      },
      {
        onSuccess: () => {
          setDecision(null);
          setNotes('');
          onComplete?.();
        },
        onError: () => {
          console.warn('Review submission failed (backend unavailable)');
          setDecision(null);
          setNotes('');
          onComplete?.();
        },
      }
    );
  };

  return (
    <Card variant="bordered">
      <CardHeader>
        <CardTitle>Review: {item.borrower_name}</CardTitle>
        <Badge variant={RECOMMENDATION_VARIANT[item.recommendation]} size="sm">
          {item.recommendation}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Deal summary */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-slate-500">Amount</span>
            <p className="text-white">{formatUSD(item.deal_amount_usd)}</p>
          </div>
          <div>
            <span className="text-slate-500">Industry</span>
            <p className="text-white">{item.industry}</p>
          </div>
          <div>
            <span className="text-slate-500">Confidence</span>
            <p className="text-white">{(item.confidence * 100).toFixed(0)}%</p>
          </div>
          <div>
            <span className="text-slate-500">Application</span>
            <p className="text-white">{item.app_id}</p>
          </div>
        </div>

        {item.escalation_reason && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-400">
            Escalation: {item.escalation_reason}
          </div>
        )}

        {/* Decision buttons */}
        <div>
          <p className="mb-2 text-sm font-medium text-slate-300">Decision</p>
          <div className="flex gap-2">
            {(['approve', 'decline', 'override'] as Decision[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDecision(d)}
                className={cn(
                  'flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors',
                  decision === d
                    ? DECISION_STYLES[d]
                    : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1 block text-sm text-slate-300">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            placeholder="Add review notes..."
          />
        </div>

        <Button
          variant="primary"
          className="w-full"
          onClick={handleSubmit}
          disabled={!decision || isPending}
        >
          {isPending ? 'Submitting...' : 'Submit Review'}
        </Button>
      </CardContent>
    </Card>
  );
}
