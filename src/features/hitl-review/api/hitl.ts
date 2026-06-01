import { apiClient } from '@shared/api';

export interface QueueItem {
  app_id: string;
  borrower_name: string;
  deal_amount_usd: number;
  industry: string;
  recommendation: 'approve' | 'decline' | 'refer';
  confidence: number;
  escalation_reason: string | null;
  created_at: string;
}

export interface ReviewDecision {
  reviewer_id: string;
  decision: 'approve' | 'decline' | 'override';
  notes: string;
  overrides?: Record<string, unknown>;
}

export const hitlApi = {
  getQueue: () => apiClient.get<QueueItem[]>('/credit/queue'),
  submitReview: (appId: string, decision: ReviewDecision) =>
    apiClient.post(`/credit/applications/${appId}/review`, decision),
};
