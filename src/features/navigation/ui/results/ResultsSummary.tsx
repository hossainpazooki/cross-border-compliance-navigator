import { useResultsStore } from '../../model/resultsStore';
import { Card, CardHeader, CardTitle, Badge } from '@shared/ui';
import { formatStatus } from '@shared/lib';
import { JurisdictionCard } from './JurisdictionCard';
import { NextStepsCard } from './NextStepsCard';
import { QuickStats } from './QuickStats';
import { GoLiveButton } from '@features/live-session/ui/GoLiveButton';

export function ResultsSummary() {
  const { navigationResult } = useResultsStore();

  if (!navigationResult) {
    return null;
  }

  const statusVariant =
    navigationResult.status === 'actionable'
      ? 'success'
      : navigationResult.status === 'blocked'
        ? 'error'
        : 'warning';

  // Calculate overall risk based on conflicts and statuses
  const hasBlockingConflict = navigationResult.conflicts.some(
    (c) => c.severity === 'blocking'
  );
  const hasBlockedJurisdiction = navigationResult.jurisdiction_results.some(
    (r) => r.status === 'blocked'
  );
  const riskLevel = hasBlockingConflict || hasBlockedJurisdiction
    ? 'HIGH'
    : navigationResult.conflicts.length > 0
      ? 'MEDIUM'
      : 'LOW';

  const riskVariant =
    riskLevel === 'LOW' ? 'success' : riskLevel === 'MEDIUM' ? 'warning' : 'error';

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <Card variant="bordered">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <span className="text-emerald-400">✓</span>
            Analysis Complete
          </CardTitle>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge variant={statusVariant}>
                {formatStatus(navigationResult.status)}
              </Badge>
              <Badge variant={riskVariant}>{riskLevel} RISK</Badge>
            </div>
            <GoLiveButton />
          </div>
        </CardHeader>
      </Card>

      {/* Next Steps - Action-Oriented Guidance */}
      <NextStepsCard result={navigationResult} />

      {/* Quick Stats */}
      <QuickStats result={navigationResult} />

      {/* Jurisdiction Cards */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-slate-300">
          Jurisdiction Results
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {navigationResult.jurisdiction_results.map((result) => (
            <JurisdictionCard key={result.jurisdiction} result={result} />
          ))}
        </div>
      </div>
    </div>
  );
}
