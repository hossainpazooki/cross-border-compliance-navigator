import { useResultsStore, PathwayTimeline } from '@features/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@shared/ui';
import { getJurisdictionInfo } from '@entities/jurisdiction/model';

export function Pathway() {
  const { navigationResult } = useResultsStore();

  if (!navigationResult) {
    return (
      <Card variant="bordered">
        <CardContent>
          <p className="text-center text-slate-400">
            Run an analysis first to see the compliance pathway.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pathway Timeline */}
      <PathwayTimeline
        steps={navigationResult.pathway}
        estimatedTimeline={navigationResult.estimated_timeline}
      />

      {/* Cumulative Obligations */}
      {navigationResult.cumulative_obligations.length > 0 && (
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>Cumulative Obligations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-slate-400">
              These obligations apply across multiple jurisdictions and must all
              be satisfied.
            </p>
            <div className="space-y-2">
              {navigationResult.cumulative_obligations.map((obligation) => (
                <div
                  key={obligation.id}
                  className="rounded-lg bg-slate-700/30 p-3"
                >
                  <p className="text-white">{obligation.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {obligation.jurisdictions.map((code) => {
                      const info = getJurisdictionInfo(code);
                      return (
                        <span
                          key={code}
                          className="rounded bg-slate-600/50 px-2 py-0.5 text-xs text-slate-300"
                          title={info.name}
                        >
                          {info.flag} {code}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
