export type RiskColor = 'green' | 'amber' | 'red';

export function riskColor(score: number): RiskColor {
  if (score >= 67) return 'green';
  if (score >= 34) return 'amber';
  return 'red';
}

export const riskTextClass: Record<RiskColor, string> = {
  green: 'text-green-400',
  amber: 'text-amber-400',
  red: 'text-red-400',
};

export const riskBgClass: Record<RiskColor, string> = {
  green: 'bg-green-500/20',
  amber: 'bg-amber-500/20',
  red: 'bg-red-500/20',
};

export const riskStrokeClass: Record<RiskColor, string> = {
  green: 'stroke-green-400',
  amber: 'stroke-amber-400',
  red: 'stroke-red-400',
};
