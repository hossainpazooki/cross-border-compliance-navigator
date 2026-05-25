import { cn } from '@shared/lib';
import { useSession } from '../selectors';
import type { ConnectionState } from '../types';
import type { Verdict } from '@platform/contracts';

interface SessionHeaderProps {
  intentId: string;
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

export function SessionHeader({ intentId }: SessionHeaderProps) {
  const session = useSession(intentId);

  if (!session) {
    return (
      <header className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <p className="text-sm text-slate-400">No active session.</p>
      </header>
    );
  }

  const { intent, currentVerdict, connection } = session;

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-white">
          {intent.direction.toUpperCase()} {intent.asset}
          <span className="ml-2 font-normal text-slate-400">
            ${Number(intent.notional_usd).toLocaleString()}
          </span>
        </h2>
        <p className="text-xs text-slate-400">
          {intent.venue_jurisdiction} → {intent.target_jurisdictions.join(', ')} ·{' '}
          {intent.investor_type} · hp {intent.holding_period_days}d
        </p>
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
    </header>
  );
}
