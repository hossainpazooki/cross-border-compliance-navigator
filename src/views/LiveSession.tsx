import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { BoardBar, ThresholdFeed, RiskComponentBars, OrgPanel } from '@features/live-session/ui';
import { RiskGauge, StatTile } from '@shared/ui/risk';
import {
  useSession,
  useLatestSnapshot,
  useThresholdStream,
  useSessionStore,
} from '@features/live-session';
import { useDeskStore, activeMember } from '@app/stores';
import { deskById } from '@shared/config';

function snapshotRiskScore(vol30d: number, slippageBps: number): number {
  const marketRisk = Math.min(vol30d * 100, 100);
  const liqRisk = Math.min(slippageBps / 2, 100);
  const composite = marketRisk * 0.6 + liqRisk * 0.4;
  return Math.max(0, Math.min(100, 100 - composite));
}

/**
 * The live session, laid out to correspond to the README org model:
 * BOARD BAR on top (the human apex: vitals, approval gates, the auditor's
 * direct channel), the ORG panel as the main column (the judgment work),
 * the threshold feed on the left (the heartbeat that wakes the org), and the
 * engine-derived risk vitals on the bottom strip (tools, not agents).
 */
export function LiveSession() {
  const { intentId } = useParams<{ intentId: string }>();
  const session = useSession(intentId);
  const latestSnapshot = useLatestSnapshot(intentId);
  const closeSession = useSessionStore((s) => s.closeSession);
  // Org context for the board bar. Views may read the desk store; the desk this
  // session was launched from comes from the demo association map (falling back
  // to the active desk for sessions created before stamping). The active member
  // stands in for "who's at the board" — no per-session attribution yet.
  const sessionDeskMap = useDeskStore((s) => s.sessionDeskMap);
  const sessionDeskId = intentId ? sessionDeskMap[intentId] : undefined;
  const sessionDesk = sessionDeskId ? deskById(sessionDeskId) : undefined;
  const member = useDeskStore(activeMember);
  // Crossing selection lifted to the view: the feed drives the org panel.
  const [selectedCrossingId, setSelectedCrossingId] = useState<string | null>(null);

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
      <BoardBar
        intentId={intentId}
        deskName={sessionDesk?.name}
        memberName={sessionDesk ? member?.name : undefined}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]" style={{ minHeight: '60vh' }}>
        <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
          <ThresholdFeed
            intentId={intentId}
            onSelectCrossing={setSelectedCrossingId}
            selectedCrossingId={selectedCrossingId}
          />
        </div>

        <OrgPanel intentId={intentId} crossingId={selectedCrossingId ?? undefined} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto_1fr_auto]">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h3 className="mb-3 text-xs uppercase tracking-wider text-slate-400">Risk overview</h3>
          <div className="flex justify-center">
            <RiskGauge score={gaugeScore} />
          </div>
        </div>

        <RiskComponentBars intentId={intentId} />

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
      </div>
    </div>
  );
}

export default LiveSession;
