import { cn } from '@shared/lib';
import { riskColor, riskStrokeClass, riskTextClass } from './tokens';

interface RiskGaugeProps {
  score: number;
  size?: number;
  className?: string;
}

const SWEEP_DEGREES = 270;

export function RiskGauge({ score, size = 120, className }: RiskGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const color = riskColor(clamped);
  const radius = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = (SWEEP_DEGREES / 360) * 2 * Math.PI * radius;
  const dashFilled = (clamped / 100) * circumference;
  const dashEmpty = circumference - dashFilled;

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Risk score ${Math.round(clamped)} of 100`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-[135deg]"
      >
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          strokeWidth={8}
          strokeLinecap="round"
          className="stroke-slate-700"
          strokeDasharray={`${circumference} ${2 * Math.PI * radius}`}
        />
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          strokeWidth={8}
          strokeLinecap="round"
          className={riskStrokeClass[color]}
          strokeDasharray={`${dashFilled} ${dashEmpty + 2 * Math.PI * radius}`}
          style={{ transition: 'stroke-dasharray 200ms ease-out' }}
        />
      </svg>
      <div
        className={cn(
          'absolute inset-0 flex flex-col items-center justify-center',
          riskTextClass[color]
        )}
      >
        <span className="text-2xl font-bold tabular-nums">{Math.round(clamped)}</span>
        <span className="text-xs uppercase tracking-wider text-slate-400">risk</span>
      </div>
    </div>
  );
}

