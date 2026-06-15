import { IntentForm } from '@features/live-session/ui';
import { useDeskStore, activeDesk } from '@app/stores';

export function LiveIntent() {
  // The VIEW layer reads the active desk and pushes org context DOWN into the
  // desk-agnostic IntentForm as props: pre-fill the venue/targets from the
  // desk's jurisdictions, and stamp the new session with its desk once created.
  const desk = useDeskStore(activeDesk);
  const associateSession = useDeskStore((s) => s.associateSession);

  const initialVenue = desk.jurisdictions[0];
  const initialTargets = [...desk.jurisdictions];

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <IntentForm
        initialVenue={initialVenue}
        initialTargets={initialTargets}
        onSessionCreated={(intentId) => associateSession(intentId, desk.id)}
      />
    </div>
  );
}

export default LiveIntent;
