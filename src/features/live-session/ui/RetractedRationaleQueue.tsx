import type { Rationale } from '@platform/contracts';
import { useRetractedRationales, useCrossings } from '../selectors';

interface Props {
  intentId: string;
}

interface QueueRow {
  rationale: Rationale;
  citation: string;
  ruleId: string;
}

/**
 * Auditor queue of retracted rationales for a live session. Wired in Phase C4
 * of the unified plan — the backend NLI gate emits `rationale_retracted`
 * envelopes when the entailment score drops below the threshold (see
 * platform-api `src/market_risk/live_session/nli_gate.py`), and the
 * live-session store records the retraction status. This panel surfaces them
 * so a human can review what the model claimed and why the gate retracted it.
 */
export function RetractedRationaleQueue({ intentId }: Props) {
  const rationales = useRetractedRationales(intentId);
  const crossings = useCrossings(intentId);

  if (rationales.length === 0) {
    return (
      <div className="px-4 py-6 text-sm text-slate-400">
        No retracted rationales in this session.
      </div>
    );
  }

  const crossingIndex: Record<string, { citation: string; rule_id: string }> = {};
  for (const c of crossings) {
    crossingIndex[c.crossing_id] = { citation: c.citation, rule_id: c.rule_id };
  }

  const rows: QueueRow[] = rationales.map((r) => ({
    rationale: r,
    citation: crossingIndex[r.crossing_id]?.citation ?? 'unknown citation',
    ruleId: crossingIndex[r.crossing_id]?.rule_id ?? 'unknown',
  }));

  return (
    <div className="flex flex-col divide-y divide-slate-800">
      <div className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-400">
        Retracted rationales ({rows.length})
      </div>
      {rows.map(({ rationale, citation, ruleId }) => (
        <div key={rationale.rationale_id || rationale.crossing_id} className="px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-sm font-medium text-slate-200">{citation}</div>
            <div className="text-xs text-slate-400">
              {rationale.final_score != null && (
                <span>score {rationale.final_score.toFixed(2)}</span>
              )}
            </div>
          </div>
          <div className="mt-0.5 text-xs text-slate-400">rule {ruleId}</div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
            {rationale.content || <em className="text-slate-500">no content captured</em>}
          </p>
          {rationale.retraction_reason && (
            <div className="mt-2 text-xs text-rose-400">
              <span className="font-medium">retracted:</span> {rationale.retraction_reason}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
