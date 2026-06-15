import { useState } from 'react';
import type { Verdict } from '@platform/contracts';
import { cn } from '@shared/lib';
import { CollapsibleSection } from '@shared/ui';
import { useSession, useAdvisoryFindings, useRetractedRationales } from '../selectors';
import type { ConnectionState } from '../types';
import { AdvisoryFlagQueue } from './AdvisoryFlagQueue';
import { RetractedRationaleQueue } from './RetractedRationaleQueue';

interface BoardBarProps {
  intentId: string;
  /**
   * Optional org-context, injected by the VIEW layer (which may read the desk
   * store). BoardBar is a feature component and stays desk-agnostic — it never
   * imports the desk store; desk context flows DOWN as props.
   */
  deskName?: string;
  memberName?: string;
}

const VERDICT_CLASSES: Record<Verdict, string> = {
  compliant: 'bg-green-500/20 text-green-300',
  conditional: 'bg-amber-500/20 text-amber-300',
  blocked: 'bg-red-500/20 text-red-300',
};

const CONNECTION_DOT: Record<ConnectionState, string> = {
  connecting: 'bg-blue-400 animate-pulse',
  open: 'bg-green-400',
  closed: 'bg-slate-500',
  error: 'bg-red-400',
};

const CONNECTION_LABEL: Record<ConnectionState, string> = {
  connecting: 'Connecting',
  open: 'Live',
  closed: 'Disconnected',
  error: 'Connection error',
};

/**
 * The BOARD bar — the human-apex surface of the org model ("the agents do
 * judgment, the engine verifies, the human is the apex"). Renders the session
 * vitals, the board's approval gates, and the auditor's DIRECT channel to the
 * board (advisory flags + the retraction log) — independent of the leads, per
 * the org chart's reporting lines.
 *
 * Runtime caveat: codec-minted `/v2/intents` records carry only
 * asset / notional_usd / venue_jurisdiction even though the legacy TradeIntent
 * type claims more — every legacy field is guarded here (the unguarded reads in
 * the old SessionHeader crashed on such records).
 */
export function BoardBar({ intentId, deskName, memberName }: BoardBarProps) {
  const session = useSession(intentId);
  const advisories = useAdvisoryFindings(intentId);
  const retractions = useRetractedRationales(intentId);
  // Conflict sign-off is a BOARD-LOCAL acknowledgment: the contract has no
  // envelope/REST surface for board approval yet, so this state is honest
  // frontend-only — it does not persist and the backend never sees it.
  const [signedOff, setSignedOff] = useState(false);

  if (!session) {
    return (
      <header className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <p className="text-sm text-slate-400">No active session.</p>
      </header>
    );
  }

  const { intent, currentVerdict, connection } = session;
  // Guarded reads — see the doc comment.
  const direction = intent.direction ? intent.direction.toUpperCase() : null;
  const targets =
    intent.target_jurisdictions && intent.target_jurisdictions.length > 0
      ? intent.target_jurisdictions.join(', ')
      : '—';
  const hasConflictPosition = Object.values(session.leadPositions).some((positions) =>
    positions.some((p) => p.lead === 'compliance')
  );

  return (
    <header className="rounded-lg border border-slate-800 bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
              Board
            </span>
            {deskName && (
              <span
                data-testid="desk-context-chip"
                className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[10px] text-slate-300"
              >
                <span className="font-medium text-slate-200">{deskName}</span>
                {memberName && <span className="text-slate-500">· {memberName}</span>}
              </span>
            )}
            <h2 className="text-base font-semibold text-white">
              {direction && <span>{direction} </span>}
              {intent.asset}
              <span className="ml-2 font-normal text-slate-400">
                ${Number(intent.notional_usd).toLocaleString()}
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            {intent.venue_jurisdiction} → {targets}
            {intent.investor_type && <> · {intent.investor_type}</>}
            {intent.holding_period_days != null && <> · hp {intent.holding_period_days}d</>}
          </p>
        </div>

        {/* Approval gates — the board's governance primitives. */}
        <div className="flex items-center gap-2" aria-label="Board approval gates">
          <span
            data-testid="gate-go-live"
            className="inline-flex items-center gap-1.5 rounded border border-emerald-800 bg-emerald-950/40 px-2.5 py-1 text-xs text-emerald-300"
          >
            <span aria-hidden>✓</span> Go Live
          </span>
          <button
            type="button"
            data-testid="gate-conflict-signoff"
            disabled={!hasConflictPosition}
            aria-pressed={signedOff}
            onClick={() => setSignedOff((v) => !v)}
            title="Board acknowledgment of the Lead Compliance position. Local only — not persisted; the contract has no board-approval surface yet."
            className={cn(
              'inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs transition-colors',
              !hasConflictPosition
                ? 'cursor-not-allowed border-slate-800 text-slate-600'
                : signedOff
                  ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300'
                  : 'border-amber-800 bg-amber-950/30 text-amber-300 hover:bg-amber-950/50'
            )}
          >
            <span aria-hidden>{signedOff ? '✓' : '◻'}</span> Conflict sign-off
            <span className="text-[9px] text-slate-500">(local)</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium capitalize',
              VERDICT_CLASSES[currentVerdict]
            )}
          >
            {currentVerdict}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <span
              className={cn('h-2 w-2 rounded-full', CONNECTION_DOT[connection])}
              aria-hidden="true"
            />
            {CONNECTION_LABEL[connection]}
          </span>
        </div>
      </div>

      {/* Auditor → board channel: independent of the leads (org-chart reporting
          line). Flags are debatable judgment; retractions are ungrounded claims
          — kept as two distinct logs so the two are never conflated. */}
      <CollapsibleSection title="Advisory flags" badge={advisories.length} icon="⚑">
        <AdvisoryFlagQueue intentId={intentId} />
      </CollapsibleSection>
      <CollapsibleSection title="Retraction log" badge={retractions.length} icon="⛔">
        <RetractedRationaleQueue intentId={intentId} />
      </CollapsibleSection>
    </header>
  );
}
