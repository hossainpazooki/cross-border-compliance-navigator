import { useAdvisoryFindings, useCrossings } from '../selectors';

interface Props {
  intentId: string;
}

/**
 * Session-wide queue of the auditor's ADVISORY findings (`target:
 * 'lead_position'`). Sibling to `RetractedRationaleQueue`: retractions there are
 * ungrounded claims (the NLI gate fired); flags here are debatable judgment on a
 * lead's position. They are rendered as flags, never as retractions, so the two
 * are never conflated (Appendix A §A.4). Advisory findings do NOT block.
 */
export function AdvisoryFlagQueue({ intentId }: Props) {
  const findings = useAdvisoryFindings(intentId);
  const crossings = useCrossings(intentId);

  if (findings.length === 0) {
    return (
      <div className="px-4 py-6 text-sm text-slate-400">
        No advisory flags in this session.
      </div>
    );
  }

  const citationFor: Record<string, string> = {};
  for (const c of crossings) citationFor[c.crossing_id] = c.citation;

  return (
    <div className="flex flex-col divide-y divide-slate-800">
      <div className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-amber-400">
        Advisory flags ({findings.length})
      </div>
      {findings.map((f, i) => (
        <div key={`${f.crossing_id}-${i}`} className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-amber-400">⚑</span>
            <span className="text-sm font-medium text-slate-200">
              {citationFor[f.crossing_id] ?? f.crossing_id}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-300">{f.basis}</p>
        </div>
      ))}
    </div>
  );
}
