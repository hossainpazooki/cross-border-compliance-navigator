import type {
  Rationale,
  ThresholdCrossing,
  TradeIntent,
  TradeSnapshot,
  Verdict,
} from '@platform/contracts';

export type ConnectionState = 'connecting' | 'open' | 'closed' | 'error';

export interface SessionState {
  intent: TradeIntent;
  currentVerdict: Verdict;
  latestSnapshot: TradeSnapshot | null;
  crossings: ThresholdCrossing[];
  rationales: Record<string, Rationale>;
  connection: ConnectionState;
  lastSeq: number;
}

export interface ApplyResult {
  gap: boolean;
}
