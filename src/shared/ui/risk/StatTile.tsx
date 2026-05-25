import { cn } from '@shared/lib';

interface StatTileProps {
  label: string;
  value: number | string;
  delta?: number;
  format?: (value: number | string) => string;
  className?: string;
}

export function StatTile({ label, value, delta, format, className }: StatTileProps) {
  const display = format ? format(value) : String(value);
  const deltaColor =
    delta === undefined ? '' : delta >= 0 ? 'text-green-400' : 'text-red-400';
  const deltaSign = delta !== undefined && delta >= 0 ? '+' : '';

  return (
    <div
      className={cn(
        'rounded-lg border border-slate-800 bg-slate-900 p-4',
        className
      )}
    >
      <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-1 text-xl font-semibold text-white tabular-nums">{display}</div>
      {delta !== undefined && (
        <div className={cn('mt-0.5 text-xs tabular-nums', deltaColor)}>
          {deltaSign}
          {delta.toFixed(2)}%
        </div>
      )}
    </div>
  );
}
