import { StatTile, riskColor, riskBgClass, riskTextClass } from '@shared/ui/risk';
import { useLatestSnapshot } from '../selectors';
import { cn } from '@shared/lib';

interface RiskComponentBarsProps {
  intentId: string;
}

interface Bar {
  label: string;
  value: number | null;
  formatted: string;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function marketScore(vol30d: number): number {
  return clamp(vol30d * 100, 0, 100);
}

function liquidityScore(slippageBps: number): number {
  return clamp(slippageBps / 2, 0, 100);
}

export function RiskComponentBars({ intentId }: RiskComponentBarsProps) {
  const snapshot = useLatestSnapshot(intentId);

  const bars: Bar[] = [
    {
      label: 'Market',
      value: snapshot ? marketScore(snapshot.vol_30d) : null,
      formatted: snapshot ? `${(snapshot.vol_30d * 100).toFixed(1)}% σ` : '—',
    },
    {
      label: 'Liquidity',
      value: snapshot ? liquidityScore(snapshot.slippage_bps) : null,
      formatted: snapshot ? `${snapshot.slippage_bps.toFixed(1)} bps` : '—',
    },
    { label: 'Compliance', value: null, formatted: '—' },
    { label: 'Protocol', value: null, formatted: '—' },
  ];

  return (
    <div className="space-y-2">
      {bars.map((bar) => {
        if (bar.value === null) {
          return (
            <StatTile key={bar.label} label={bar.label} value={bar.formatted} />
          );
        }
        const color = riskColor(100 - bar.value);
        return (
          <div
            key={bar.label}
            className="rounded-lg border border-slate-800 bg-slate-900 p-3"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wider text-slate-400">
                {bar.label}
              </span>
              <span className={cn('text-xs tabular-nums', riskTextClass[color])}>
                {bar.formatted}
              </span>
            </div>
            <div
              className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800"
              role="meter"
              aria-valuenow={bar.value}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${bar.label} risk`}
            >
              <div
                className={cn('h-full transition-all', riskBgClass[color])}
                style={{ width: `${bar.value}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
