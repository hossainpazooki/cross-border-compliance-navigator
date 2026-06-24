import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@shared/ui';
import { cn } from '@shared/lib';
import { DESKS, type Desk, type DeskMember, type DeskRole } from '@shared/config';
import { useDeskStore, activeDesk, activeMember } from '@app/stores';
import {
  provenanceForRegime,
  syncedAt,
  atlasSource,
  shortHash,
  shortCommit,
  versionTriplet,
  PROVENANCE_DISCLOSURE,
  LIFECYCLE_DISCLOSURE,
  type ArtifactProvenance,
} from '@shared/atlas/provenance';
import { useArtifactVerification } from '@shared/atlas/useArtifactVerification';
import { VerificationChip } from './VerificationChip';
import { useSessionStore } from '@features/live-session';
import { JURISDICTIONS } from '@/types/common';

const ROLE_VARIANT: Record<DeskRole, 'info' | 'warning' | 'success' | 'default'> = {
  compliance: 'info',
  risk: 'warning',
  auditor: 'success',
  reviewer: 'default',
};

/**
 * Desk Home — the org-first landing (`/desk`). Answers "where am I / what does
 * this desk operate under / who's here / what's happening". The rule-pack
 * provenance card is the coherent ATLAS surface: real signed-artifact metadata
 * (synced via `npm run sync:atlas`), surfaced — not re-verified — and honestly
 * labeled as test-key, demo identity.
 */
export function DeskHome() {
  const deskId = useDeskStore((s) => s.activeDeskId);
  const memberId = useDeskStore((s) => s.activeMemberId);
  const setActiveDesk = useDeskStore((s) => s.setActiveDesk);
  const desk = useDeskStore(activeDesk);
  const member = useDeskStore(activeMember);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <DeskIdentity desk={desk} desks={DESKS} activeDeskId={deskId} onSwitch={setActiveDesk} />

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-slate-400">
          Rule-pack provenance — verified by ATLAS
        </h2>
        {desk.regimeIds.map((regimeId) => (
          <RegimeProvenanceCard key={regimeId} regimeId={regimeId} />
        ))}
        <p className="text-[11px] leading-relaxed text-slate-500">{PROVENANCE_DISCLOSURE}</p>
        <p className="text-[11px] leading-relaxed text-amber-500/80">{LIFECYCLE_DISCLOSURE}</p>
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <MembersCard members={desk.members} activeMemberId={memberId} />
        <ActivityCard desk={desk} />
      </div>

      <DeskActions desk={desk} memberName={member?.name} />
    </div>
  );
}

function DeskIdentity({
  desk,
  desks,
  activeDeskId,
  onSwitch,
}: {
  desk: Desk;
  desks: readonly Desk[];
  activeDeskId: string;
  onSwitch: (id: string) => void;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-700 bg-slate-800/50 p-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-slate-500">
          Desk
        </div>
        <h1 className="text-xl font-semibold text-white">{desk.name}</h1>
        <p className="text-sm text-slate-400">{desk.institution}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {desk.jurisdictions.map((j) => (
            <Badge key={j} variant="info" size="sm">
              {JURISDICTIONS[j]?.flag} {j}
            </Badge>
          ))}
        </div>
      </div>

      {desks.length > 1 && (
        <label className="text-xs text-slate-400">
          <span className="mr-2">Desk</span>
          <select
            aria-label="Switch desk"
            value={activeDeskId}
            onChange={(e) => onSwitch(e.target.value)}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200"
          >
            {desks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </header>
  );
}

function RegimeProvenanceCard({ regimeId }: { regimeId: string }) {
  const artifacts = provenanceForRegime(regimeId);

  if (artifacts.length === 0) {
    return (
      <Card variant="bordered">
        <p className="text-sm text-slate-400">
          No ATLAS provenance for <span className="font-mono">{regimeId}</span>. Run{' '}
          <span className="font-mono text-slate-300">npm run sync:atlas</span>.
        </p>
      </Card>
    );
  }

  return (
    <Card variant="bordered" data-testid={`provenance-${regimeId}`}>
      <CardHeader>
        <CardTitle className="text-base">
          <span className="font-mono text-blue-300">{regimeId}</span>
        </CardTitle>
        <span className="text-[11px] text-slate-500">
          synced {syncedAt().slice(0, 10)} · ATLAS{' '}
          <span className="font-mono">{shortCommit(atlasSource().atlas_commit)}</span>
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        {artifacts.map((a) => (
          <ArtifactRow key={a.artifact_id} artifact={a} />
        ))}
      </CardContent>
    </Card>
  );
}

function ArtifactRow({ artifact: a }: { artifact: ArtifactProvenance }) {
  const { decision } = useArtifactVerification({
    hash: a.artifact_hash_hex,
    isTestKey: a.is_test_key,
  });

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-sm text-slate-200">{a.artifact_id}</span>
        <div className="flex flex-wrap items-center gap-2">
          <VerificationChip decision={decision} />
          {a.signed ? (
            <Badge variant="warning" size="sm">
              test-key: {a.signer_key_id}
            </Badge>
          ) : (
            <Badge variant="default" size="sm">
              unsigned ({a.artifact_kind})
            </Badge>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
        <span>
          hash{' '}
          <span className="font-mono text-slate-300" title={a.artifact_hash_hex ?? undefined}>
            {shortHash(a.artifact_hash_hex)}
          </span>
        </span>
        <span>{versionTriplet(a)}</span>
        {a.effective_from && <span>effective {a.effective_from}</span>}
        {a.signed && (
          <span>
            {a.attestations.length} attestation{a.attestations.length === 1 ? '' : 's'}
          </span>
        )}
        {/* Lifecycle is never established by the static snapshot (brief §3 #11). */}
        <span
          className="text-amber-500/80"
          title="Published/Revoked requires the live ATLAS registry (ke-cli serve, Gate 5)"
        >
          lifecycle {a.registry_state}
        </span>
      </div>
    </div>
  );
}

function MembersCard({ members, activeMemberId }: { members: DeskMember[]; activeMemberId: string }) {
  return (
    <Card variant="bordered">
      <CardHeader>
        <CardTitle className="text-base">Members</CardTitle>
        <span className="text-[11px] text-slate-500">demo identity — no login</span>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {members.map((m) => (
          <div
            key={m.id}
            className={cn(
              'flex items-center justify-between rounded-md px-2 py-1.5',
              m.id === activeMemberId && 'bg-slate-800'
            )}
          >
            <span className="text-sm text-slate-200">
              {m.name}
              {m.id === activeMemberId && (
                <span className="ml-2 text-[10px] uppercase tracking-wide text-blue-300">you</span>
              )}
            </span>
            <Badge variant={ROLE_VARIANT[m.role]} size="sm">
              {m.role}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ActivityCard({ desk }: { desk: Desk }) {
  // This desk's live sessions = the intersection of (a) the demo desk↔session
  // association held in the APP/desk layer and (b) the sessions that are
  // actually live in the feature's store. Both reads are view-layer (DeskHome
  // is a view), so the feature store stays desk-agnostic. The association map
  // can outlive a session (it is never pruned), so we always re-check liveness.
  // Select stable store slices (not freshly-derived arrays — Zustand v4 uses
  // Object.is, so a new array per render would loop), then derive in-render.
  const sessions = useSessionStore((s) => s.sessions);
  const sessionDeskMap = useDeskStore((s) => s.sessionDeskMap);
  const live = Object.entries(sessionDeskMap)
    .filter(([sessionId, deskId]) => deskId === desk.id && sessionId in sessions)
    .map(([sessionId]) => sessionId);

  return (
    <Card variant="bordered">
      <CardHeader>
        <CardTitle className="text-base">Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {live.length === 0 ? (
          <p className="text-sm text-slate-400">
            No live sessions yet — start one to put the {desk.name}&rsquo;s agent bench to work.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {live.map((id) => (
              <li key={id} className="flex items-center justify-between text-sm">
                <Link
                  to={`/live/${id}`}
                  className="font-mono text-blue-400 hover:underline"
                  title={id}
                >
                  {id.length > 18 ? `${id.slice(0, 18)}…` : id}
                </Link>
                <Badge variant="success" size="sm">
                  live
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function DeskActions({ desk, memberName }: { desk: Desk; memberName?: string }) {
  const regime = desk.regimeIds[0];
  const firstSigned = regime
    ? provenanceForRegime(regime).find((a) => a.signed)
    : undefined;

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
      <p className="text-sm text-slate-300">
        This is the <span className="font-medium text-white">{desk.name}</span>
        {memberName && <span className="text-slate-400"> · {memberName}</span>}. It operates under{' '}
        <span className="font-mono text-blue-300">{regime ?? 'no regime'}</span>, verified by ATLAS
        {firstSigned && (
          <>
            {' '}
            (artifact <span className="font-mono">{shortHash(firstSigned.artifact_hash_hex)}</span>)
          </>
        )}
        . Start an analysis or go live to begin.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          to="/"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
        >
          Open Decision Canvas
        </Link>
        <Link
          to="/live"
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800"
        >
          Go Live →
        </Link>
      </div>
    </section>
  );
}

export default DeskHome;
