import type {
  Rationale,
  ThresholdCrossing,
  TradeIntent,
  TradeSnapshot,
  Verdict,
} from '@platform/contracts';

export type ConnectionState = 'connecting' | 'open' | 'closed' | 'error';

// Codes the WS handler is documented to emit before closing.
// Source: institutional-defi-platform-api/src/market_risk/live_session/ws_handler.py.
// `(string & {})` is the TS idiom that preserves IDE autocomplete on the four
// known codes while still typing `code` as `string` at runtime. ESLint's
// ban-types rule doesn't have a non-`{}` alternative for this pattern.
export type WSErrorCode =
  | 'ws_idle_timeout'
  | 'intent_terminal'
  | 'session_provider_failed'
  | 'ws_task_error'
  // eslint-disable-next-line @typescript-eslint/ban-types
  | (string & {});

export interface WSErrorInfo {
  code: WSErrorCode;
  message: string;
}

export interface SessionState {
  intent: TradeIntent;
  currentVerdict: Verdict;
  latestSnapshot: TradeSnapshot | null;
  crossings: ThresholdCrossing[];
  rationales: Record<string, Rationale>;
  connection: ConnectionState;
  lastSeq: number;
  lastError: WSErrorInfo | null;
}

export interface ApplyResult {
  gap: boolean;
}
