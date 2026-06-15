import { cn } from '@shared/lib';
import { SPECIALISTS, specialistFor } from '../specialistRouting';

interface SpecialistsRowProps {
  /** rule_id of the selected crossing; omitted = no crossing selected (all idle). */
  ruleId?: string;
}

/**
 * The five jurisdiction-specialist seats from the README org chart, with wake
 * dots making LAZY WAKE visible: only the specialist implicated by the selected
 * crossing's rule namespace lights up (RISK_ crossings wake none). The woken
 * state is DERIVED frontend-side from the rule_id (see specialistRouting.ts) —
 * the contract carries no tasking envelope yet.
 */
export function SpecialistsRow({ ruleId }: SpecialistsRowProps) {
  const woken = ruleId ? specialistFor(ruleId) : null;

  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="list" aria-label="Jurisdiction specialists">
        {SPECIALISTS.map((seat) => {
          const isWoken = seat.jurisdiction === woken;
          return (
            <div
              key={seat.jurisdiction}
              role="listitem"
              data-testid={`specialist-seat-${seat.jurisdiction}`}
              aria-label={`${seat.label} specialist — ${isWoken ? 'woken' : 'idle'}`}
              className={cn(
                'flex items-center gap-1.5 rounded border px-2 py-1 text-xs transition-colors',
                isWoken
                  ? 'border-emerald-700 bg-emerald-950/40 text-emerald-200'
                  : 'border-slate-800 text-slate-500'
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  isWoken ? 'bg-emerald-400' : 'bg-slate-600'
                )}
              />
              {seat.label}
            </div>
          );
        })}
      </div>
      <p className="mt-1 text-[10px] text-slate-500">
        wake state derived from rule namespace — tasking lives backend-side
      </p>
    </div>
  );
}
