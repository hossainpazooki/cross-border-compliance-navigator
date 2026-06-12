// Static fixture data, imported as JSON so the frames travel with the
// transpiled package (no `fs` read at runtime). This is what lets the core be
// imported into a serverless/lambda bundle where the filesystem layout of this
// repo does not exist. The fixtures themselves are GENERATED — edit
// `build-fixtures.ts` / `scenario.ts` and run `npm run build-fixtures`, never
// the JSON. `build-fixtures.ts` keeps the `fs` write path; only the READ side
// moved here.
//
// `resolveJsonModule` is on (see tsconfig.json), so these import as typed data.
import micaThresholdCrossing from '../fixtures/mica-threshold-crossing.json';
import retraction from '../fixtures/retraction.json';
import multiCrossing from '../fixtures/multi-crossing.json';

/**
 * The raw, unvalidated fixture frames keyed by scenario name. Consumers
 * (`replay.ts`) run the `isWSEnvelope` validation loop over these before use —
 * the static import only guarantees JSON shape, not contract conformance.
 */
export const FIXTURES: Record<string, unknown> = {
  'mica-threshold-crossing': micaThresholdCrossing,
  retraction,
  'multi-crossing': multiCrossing,
};

export const DEFAULT_SCENARIO = 'mica-threshold-crossing';

/** Stable list of available scenarios. */
export function listScenarios(): string[] {
  return Object.keys(FIXTURES);
}
