import type { Rationale, ThresholdCrossing, TradeSnapshot, Verdict } from '@platform/contracts';
import { useSessionStore } from './store';
import type { ConnectionState, SessionState } from './types';

export function useSession(intentId: string | undefined): SessionState | undefined {
  return useSessionStore((s) => (intentId ? s.sessions[intentId] : undefined));
}

export function useConnection(intentId: string | undefined): ConnectionState {
  return useSessionStore((s) => (intentId && s.sessions[intentId]?.connection) || 'closed');
}

export function useCurrentVerdict(intentId: string | undefined): Verdict {
  return useSessionStore(
    (s) => (intentId && s.sessions[intentId]?.currentVerdict) || 'compliant'
  );
}

export function useLatestSnapshot(intentId: string | undefined): TradeSnapshot | null {
  return useSessionStore((s) => (intentId && s.sessions[intentId]?.latestSnapshot) || null);
}

export function useCrossings(intentId: string | undefined): ThresholdCrossing[] {
  return useSessionStore((s) => (intentId && s.sessions[intentId]?.crossings) || EMPTY_CROSSINGS);
}

export function useRationale(
  intentId: string | undefined,
  crossingId: string
): Rationale | undefined {
  return useSessionStore(
    (s) => (intentId ? s.sessions[intentId]?.rationales[crossingId] : undefined)
  );
}

const EMPTY_CROSSINGS: ThresholdCrossing[] = [];
