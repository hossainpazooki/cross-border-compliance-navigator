import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { SessionHeader, ThresholdFeed, RiskComponentBars, OrgPanel } from '@features/live-session/ui';
import { RiskGauge, StatTile } from '@shared/ui/risk';
import {
  useSession,
  useLatestSnapshot,
  useThresholdStream,
  useSessionStore,
} from '@features/live-session';

function snapshotRiskScore(vol30d: number, slippageBps: number): number {
  const marketRisk = Math.min(vol30d * 100, 100);
  const liqRisk = Math.min(slippageBps / 2, 100);
  const composite = marketRisk * 0.6 + liqRisk * 0.4;
  return Math.max(0, Math.min(100, 100 - composite));
}

export function LiveSession() {
  const { intentId } = useParams<{ intentId: string }>();
  const session = useSession(intentId);
  const latestSnapshot = useLatestSnapshot(intentId);
  const closeSession = useSessionStore((s) => s.closeSession);

  useThresholdStream({ intentId, enabled: Boolean(session) });

  useEffect(() => {
    return () => {
      if (intentId) closeSession(intentId);
    };
  }, [intentId, closeSession]);

  if (!intentId) {
    return <Navigate to="/" replace />;
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-slate-300">
          No active session for this intent. Return to{' '}
          <a className="text-blue-400 hover:underline" href="/legacy/">
            the navigator
          </a>{' '}
          and click <em>Go Live</em>.
        </div>
      </div>
    );
  }

  const gaugeScore = latestSnapshot
    ? snapshotRiskScore(latestSnapshot.vol_30d, latestSnapshot.slippage_bps)
    : 50;

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <SessionHeader intentId={intentId} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]" style={{ minHeight: '70vh' }}>
        <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
          <ThresholdFeed intentId={intentId} />
        </div>

        <aside className="space-y-3">
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <h3 className="mb-3 text-xs uppercase tracking-wider text-slate-400">
              Risk overview
            </h3>
            <div className="flex justify-center">
              <RiskGauge score={gaugeScore} />
            </div>
          </div>

          <RiskComponentBars intentId={intentId} />

          <OrgPanel intentId={intentId} />

          {latestSnapshot && (
            <div className="space-y-2">
              <StatTile
                label="Mark price"
                value={latestSnapshot.mark_price}
                format={(v) => `$${Number(v).toLocaleString()}`}
              />
              <StatTile
                label="Var 95"
                value={latestSnapshot.var_95_usd}
                format={(v) => `$${Number(v).toLocaleString()}`}
              />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default LiveSession;
