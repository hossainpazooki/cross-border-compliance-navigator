import { useMemo, useState } from 'react';
import type { AuditorFinding, LeadPosition, ThresholdCrossing } from '@platform/contracts';
import {
  useCrossings,
  useRationale,
  useLeadPositions,
  useAuditorFindings,
} from '../selectors';
import { orchestratorFor, type OrchestratingLead } from '../orchestratorRouting';
import { SpecialistsRow } from './SpecialistsRow';
import { cn } from '@shared/lib';

interface OrgPanelProps {
  intentId: string;
  /** Controlled selection; when omitted the panel selects the newest crossing. */
  crossingId?: string;
}

// Full README titles — also keeps these distinct from the position-card labels
// ('Lead Compliance' / 'Lead Risk') that existing tests match exactly.
const LEAD_LABEL: Record<OrchestratingLead, string> = {
  compliance: 'Lead Compliance Officer (LCO)',
  risk: 'Lead Risk Officer (LRO)',
};

/**
 * The "Org" panel (Appendix A §A.9 — dedicated live-session surface, NOT the
 * legacy workbench tabs). Per selected crossing it renders the org at work:
 * the routing (which lead orchestrates), the specialist seats (lazy wake),
 * the rationale draft, the NLI GATE as an explicit stage, the ≤2 lead
 * positions (orchestrator vs consuming), and the auditor's findings.
 * Retractions and advisory flags are rendered VISUALLY DISTINCT so "ungrounded
 * claim" is never conflated with "debatable judgment" (Appendix A §A.4).
 */
export function OrgPanel({ intentId, crossingId }: OrgPanelProps) {
  const crossings = useCrossings(intentId);
  const [picked, setPicked] = useState<string | null>(null);

  // Selection: explicit prop > user pick > newest crossing.
  const selected = crossingId ?? picked ?? crossings[0]?.crossing_id;
  const selectedCrossing = crossings.find((c) => c.crossing_id === selected);

  if (crossings.length === 0) {
    return (
      <section
        aria-label="Agent org"
        className="rounded-lg border border-dashed border-slate-800 p-6 text-center text-sm text-slate-400"
      >
        The agent org is idle — no crossings yet.
      </section>
    );
  }

  return (
    <section aria-label="Agent org" className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <h3 className="mb-3 text-xs uppercase tracking-wider text-slate-400">Agent org</h3>

      {crossingId === undefined && crossings.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Select crossing">
          {crossings.map((c) => (
            <button
              key={c.crossing_id}
              role="tab"
              aria-selected={c.crossing_id === selected}
              onClick={() => setPicked(c.crossing_id)}
              className={cn(
                'rounded border px-2 py-1 text-xs tabular-nums transition-colors',
                c.crossing_id === selected
                  ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                  : 'border-slate-800 text-slate-400 hover:border-slate-700'
              )}
            >
              {c.citation}
            </button>
          ))}
        </div>
      )}

      {selectedCrossing && <OrgCrossingView intentId={intentId} crossing={selectedCrossing} />}
    </section>
  );
}

const STANCE_LABEL: Record<string, string> = {
  cumulative: 'cumulative',
  stricter: 'stricter',
  home_jurisdiction: 'home jurisdiction',
  satisfy_both: 'satisfy both',
  earliest: 'earliest',
  escalate: 'escalate',
  hold: 'hold',
};

function LeadPositionCard({
  position,
  isOrchestrator,
}: {
  position: LeadPosition;
  isOrchestrator: boolean;
}) {
  const isCompliance = position.lead === 'compliance';
  return (
    <div
      data-testid={`lead-position-${position.lead}`}
      className={cn(
        'rounded-lg border p-3',
        isCompliance ? 'border-indigo-800 bg-indigo-950/40' : 'border-cyan-800 bg-cyan-950/40',
        isOrchestrator && 'ring-1 ring-inset ring-slate-500/40'
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            'text-xs font-medium uppercase tracking-wider',
            isCompliance ? 'text-indigo-300' : 'text-cyan-300'
          )}
        >
          {isCompliance ? 'Lead Compliance' : 'Lead Risk'}
          <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-400">
            · {isOrchestrator ? 'orchestrator' : 'consuming'}
          </span>
        </span>
        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
          {STANCE_LABEL[position.stance] ?? position.stance}
        </span>
      </div>
      <p className="mt-1.5 text-sm text-slate-200">{position.basis}</p>
    </div>
  );
}

function AuditorFindingRow({ finding }: { finding: AuditorFinding }) {
  // Advisory (target: lead_position) → a FLAG, not a retraction. A rationale
  // fail is the NLI gate and rides `rationale_retracted`; if it ever surfaces
  // here it renders as a retraction. Pass findings render as grounding ticks.
  const isAdvisory = finding.target === 'lead_position';
  const isFail = finding.verdict === 'fail';

  const tone = isAdvisory
    ? { wrap: 'border-amber-800 bg-amber-950/40 text-amber-200', tag: 'advisory flag' }
    : isFail
      ? { wrap: 'border-rose-800 bg-rose-950/40 text-rose-200', tag: 'retraction' }
      : { wrap: 'border-emerald-900 bg-emerald-950/30 text-emerald-200', tag: 'grounded' };

  return (
    <div
      data-testid={isAdvisory ? 'auditor-finding-advisory' : 'auditor-finding-grounding'}
      className={cn('rounded-lg border p-3', tone.wrap)}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-sm">
          {isAdvisory ? '⚑' : isFail ? '⛔' : '✓'}
        </span>
        <span className="text-[10px] uppercase tracking-wide">{tone.tag}</span>
      </div>
      <p className="mt-1 text-sm">{finding.basis}</p>
    </div>
  );
}

/** The NLI gate rendered as an explicit pipeline stage, not a badge. */
function GateStage({ status, reason }: { status?: string; reason?: string }) {
  const tone =
    status === 'verified'
      ? { wrap: 'border-emerald-900 bg-emerald-950/30 text-emerald-200', label: '✓ passed — leads woken' }
      : status === 'retracted'
        ? { wrap: 'border-rose-800 bg-rose-950/40 text-rose-200', label: '⛔ draft died at the gate' }
        : { wrap: 'border-slate-800 bg-slate-950 text-slate-400', label: '… awaiting grounding' };

  return (
    <div data-testid="org-gate" className={cn('rounded-lg border px-3 py-2', tone.wrap)}>
      <span className="text-[10px] uppercase tracking-wide">NLI gate</span>
      <span className="ml-2 text-sm">{tone.label}</span>
      {status === 'retracted' && reason && <p className="mt-1 text-xs">{reason}</p>}
    </div>
  );
}

function OrgCrossingView({
  intentId,
  crossing,
}: {
  intentId: string;
  crossing: ThresholdCrossing;
}) {
  const crossingId = crossing.crossing_id;
  const rationale = useRationale(intentId, crossingId);
  const positions = useLeadPositions(intentId, crossingId);
  const findings = useAuditorFindings(intentId, crossingId);
  const orchestrator = orchestratorFor(crossing.rule_id);

  const ordered = useMemo(
    () => [...positions].sort((a) => (a.lead === 'compliance' ? -1 : 1)),
    [positions]
  );

  return (
    <div className="space-y-4">
      {/* Routing: one crossing → exactly one orchestrating lead. Shown before
          any position arrives so the org topology is visible from the start. */}
      <div data-testid="org-orchestrator" className="text-xs text-slate-300">
        <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
          {crossing.rule_id}
        </span>
        <span className="ml-2">
          routed to <span className="font-medium text-white">{LEAD_LABEL[orchestrator]}</span> —
          orchestrator
        </span>
      </div>

      <SpecialistsRow ruleId={crossing.rule_id} />

      <div>
        <div className="text-[10px] uppercase tracking-wide text-slate-400">Rationale draft</div>
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">
          {rationale?.content || <em className="text-slate-400">no draft yet</em>}
        </p>
        {rationale && (
          <span
            className={cn(
              'mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide',
              rationale.status === 'verified'
                ? 'bg-emerald-900/50 text-emerald-300'
                : rationale.status === 'retracted'
                  ? 'bg-rose-900/50 text-rose-300'
                  : 'bg-slate-800 text-slate-400'
            )}
          >
            {rationale.status}
          </span>
        )}
      </div>

      <GateStage status={rationale?.status} reason={rationale?.retraction_reason} />

      <div>
        <div className="mb-2 text-[10px] uppercase tracking-wide text-slate-400">
          Lead positions ({ordered.length})
        </div>
        {ordered.length === 0 ? (
          <p className="text-xs text-slate-400">
            No lead positions — leads wake only on a verified rationale.
          </p>
        ) : (
          <div className="space-y-2">
            {ordered.map((p) => (
              <LeadPositionCard
                key={p.lead}
                position={p}
                isOrchestrator={p.lead === orchestrator}
              />
            ))}
          </div>
        )}
      </div>

      {findings.length > 0 && (
        <div>
          <div className="mb-2 text-[10px] uppercase tracking-wide text-slate-400">
            Auditor findings ({findings.length})
          </div>
          <div className="space-y-2">
            {findings.map((f, i) => (
              <AuditorFindingRow key={`${f.target}-${i}`} finding={f} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
