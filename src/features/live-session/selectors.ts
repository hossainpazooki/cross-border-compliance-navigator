import type {
  AuditorFinding,
  LeadPosition,
  Rationale,
  ThresholdCrossing,
  TradeSnapshot,
  Verdict,
} from '@platform/contracts';
import { useSessionStore } from './store';
import type { ConnectionState, SessionState, WSErrorInfo } from './types';

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

export function useLastError(intentId: string | undefined): WSErrorInfo | null {
  return useSessionStore((s) => (intentId && s.sessions[intentId]?.lastError) || null);
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
const EMPTY_RATIONALES: Rationale[] = [];
const EMPTY_POSITIONS: LeadPosition[] = [];
const EMPTY_FINDINGS: AuditorFinding[] = [];

/**
 * Lead positions for one crossing. Returns a stable empty array reference
 * (mirroring `useRationale`'s memoized-empty pattern) so a crossing with no
 * positions never triggers a re-render churn.
 *
 * The store guards appends so positions only ever exist for a *verified*
 * crossing — a retracted draft yields zero positions (Appendix A §A.4). This
 * selector therefore cannot surface a position for a retracted crossing.
 */
export function useLeadPositions(
  intentId: string | undefined,
  crossingId: string
): LeadPosition[] {
  return useSessionStore(
    (s) => (intentId ? s.sessions[intentId]?.leadPositions[crossingId] : undefined) ?? EMPTY_POSITIONS
  );
}

/** Auditor findings for one crossing (stable empty array when none). */
export function useAuditorFindings(
  intentId: string | undefined,
  crossingId: string
): AuditorFinding[] {
  return useSessionStore(
    (s) => (intentId ? s.sessions[intentId]?.auditorFindings[crossingId] : undefined) ?? EMPTY_FINDINGS
  );
}

/**
 * Advisory auditor findings across the whole session — `target: 'lead_position'`
 * findings, which flag debatable judgment WITHOUT blocking. Surfaced separately
 * from retracted rationales so an advisory flag is never conflated with an
 * ungrounded-claim retraction (Appendix A §A.4).
 */
export function useAdvisoryFindings(intentId: string | undefined): AuditorFinding[] {
  return useSessionStore((s) => {
    if (!intentId) return EMPTY_FINDINGS;
    const session = s.sessions[intentId];
    if (!session) return EMPTY_FINDINGS;
    const out: AuditorFinding[] = [];
    for (const findings of Object.values(session.auditorFindings)) {
      for (const f of findings) {
        if (f.target === 'lead_position') out.push(f);
      }
    }
    return out.length === 0 ? EMPTY_FINDINGS : out;
  });
}

/**
 * Auditor queue selector — every rationale in the session whose NLI gate
 * flipped to `retracted`. Ordered most-recent-first by completed_at, then by
 * insertion order. The BottomWorkbench HITL-style tab consumes this to render
 * a per-session retracted-rationale list (Phase C4 of the unified plan).
 */
export function useRetractedRationales(intentId: string | undefined): Rationale[] {
  return useSessionStore((s) => {
    if (!intentId) return EMPTY_RATIONALES;
    const session = s.sessions[intentId];
    if (!session) return EMPTY_RATIONALES;
    const out: Rationale[] = [];
    for (const r of Object.values(session.rationales)) {
      if (r.status === 'retracted') out.push(r);
    }
    out.sort((a, b) => {
      const ta = a.completed_at ?? '';
      const tb = b.completed_at ?? '';
      if (ta === tb) return 0;
      return tb.localeCompare(ta);
    });
    return out;
  });
}
