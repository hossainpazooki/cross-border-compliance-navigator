import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hitlApi, type QueueItem, type ReviewDecision } from '../api/hitl';

const DEMO_QUEUE: QueueItem[] = [
  {
    app_id: 'APP-2024-001',
    borrower_name: 'Meridian Capital Partners',
    deal_amount_usd: 12_500_000,
    industry: 'Technology',
    recommendation: 'refer',
    confidence: 0.68,
    escalation_reason: 'Confidence below auto-approve threshold',
    created_at: '2024-12-15T10:30:00Z',
  },
  {
    app_id: 'APP-2024-002',
    borrower_name: 'Atlas Manufacturing Corp',
    deal_amount_usd: 8_750_000,
    industry: 'Manufacturing',
    recommendation: 'approve',
    confidence: 0.82,
    escalation_reason: 'Large deal amount requires manual review',
    created_at: '2024-12-15T11:15:00Z',
  },
  {
    app_id: 'APP-2024-003',
    borrower_name: 'Solaris Energy Holdings',
    deal_amount_usd: 25_000_000,
    industry: 'Energy',
    recommendation: 'decline',
    confidence: 0.91,
    escalation_reason: 'Regulatory flags detected in legal analysis',
    created_at: '2024-12-15T12:00:00Z',
  },
  {
    app_id: 'APP-2024-004',
    borrower_name: 'Vanguard Logistics Ltd',
    deal_amount_usd: 5_200_000,
    industry: 'Logistics',
    recommendation: 'refer',
    confidence: 0.55,
    escalation_reason: 'Insufficient DSCR margin',
    created_at: '2024-12-15T14:20:00Z',
  },
];

export function useHITLQueue() {
  return useQuery({
    queryKey: ['hitl', 'queue'],
    queryFn: async () => {
      try {
        const res = await hitlApi.getQueue();
        return res.data;
      } catch {
        console.warn('Backend unavailable, using demo HITL queue');
        return DEMO_QUEUE;
      }
    },
  });
}

export function useSubmitReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ appId, decision }: { appId: string; decision: ReviewDecision }) =>
      hitlApi.submitReview(appId, decision),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hitl', 'queue'] }),
  });
}
