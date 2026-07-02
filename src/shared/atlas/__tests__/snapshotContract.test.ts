import { describe, expect, it } from 'vitest';
import {
  KNOWN_ARTIFACT_KINDS,
  EXPECTED_CANON,
  PINNED_ARTIFACTS,
  isKnownArtifactKind,
  validateArtifact,
  validateSnapshotArtifacts,
  type ValidatableArtifact,
} from '../snapshotContract';
import { allProvenance } from '../provenance';

// A well-formed signed artifact matching the current pins + canon.
function signedFixture(overrides: Partial<ValidatableArtifact> = {}): ValidatableArtifact {
  return {
    artifact_id: 'rule_reserve_assets',
    artifact_kind: 'RegimePack',
    signed: true,
    artifact_hash_hex: PINNED_ARTIFACTS.rule_reserve_assets.hash,
    envelope_len: PINNED_ARTIFACTS.rule_reserve_assets.envelopeLen,
    ir_schema_version: EXPECTED_CANON.ir_schema_version,
    codec_version: EXPECTED_CANON.codec_version,
    canonicalization_version: EXPECTED_CANON.canonicalization_version,
    ...overrides,
  };
}

function unsignedFixture(overrides: Partial<ValidatableArtifact> = {}): ValidatableArtifact {
  return {
    artifact_id: 'policy_production_eu',
    artifact_kind: 'PolicyBundle',
    signed: false,
    artifact_hash_hex: null,
    envelope_len: null,
    ir_schema_version: EXPECTED_CANON.ir_schema_version,
    codec_version: EXPECTED_CANON.codec_version,
    canonicalization_version: EXPECTED_CANON.canonicalization_version,
    ...overrides,
  };
}

describe('isKnownArtifactKind', () => {
  it('accepts the four current ATLAS kinds', () => {
    for (const k of KNOWN_ARTIFACT_KINDS) expect(isKnownArtifactKind(k)).toBe(true);
  });

  it('rejects a not-yet-adopted kind (IntentSpec) and nonsense', () => {
    expect(isKnownArtifactKind('IntentSpec')).toBe(false);
    expect(isKnownArtifactKind('Nonsense')).toBe(false);
  });
});

describe('validateArtifact', () => {
  it('passes a clean signed artifact', () => {
    expect(validateArtifact(signedFixture(), PINNED_ARTIFACTS)).toEqual([]);
  });

  it('passes a clean unsigned artifact (no pin required)', () => {
    expect(validateArtifact(unsignedFixture(), PINNED_ARTIFACTS)).toEqual([]);
  });

  it('flags an unknown artifact kind (the new-ATLAS-kind tripwire)', () => {
    const v = validateArtifact(signedFixture({ artifact_kind: 'IntentSpec' }), PINNED_ARTIFACTS);
    expect(v.some((m) => /unknown artifact_kind/i.test(m) && /IntentSpec/.test(m))).toBe(true);
  });

  it('flags canon-triplet drift on a SIGNED artifact', () => {
    const v = validateArtifact(signedFixture({ canonicalization_version: 'ke-canon-5' }), PINNED_ARTIFACTS);
    expect(v.some((m) => /canon/i.test(m))).toBe(true);
  });

  it('flags canon-triplet drift on an UNSIGNED artifact (old guard skipped these)', () => {
    const v = validateArtifact(unsignedFixture({ ir_schema_version: '0.5.0' }), PINNED_ARTIFACTS);
    expect(v.some((m) => /canon/i.test(m))).toBe(true);
  });

  it('flags a signed artifact with no pin (unpinned = untrusted)', () => {
    const v = validateArtifact(
      signedFixture({ artifact_id: 'rule_new_unpinned' }),
      PINNED_ARTIFACTS
    );
    expect(v.some((m) => /not pinned|unpinned/i.test(m))).toBe(true);
  });

  it('flags a signed artifact whose hash disagrees with its pin', () => {
    const v = validateArtifact(signedFixture({ artifact_hash_hex: 'deadbeef' }), PINNED_ARTIFACTS);
    expect(v.some((m) => /hash/i.test(m))).toBe(true);
  });

  it('flags a signed artifact whose envelope_len disagrees with its pin', () => {
    const v = validateArtifact(signedFixture({ envelope_len: 999 }), PINNED_ARTIFACTS);
    expect(v.some((m) => /envelope/i.test(m))).toBe(true);
  });
});

describe('validateSnapshotArtifacts', () => {
  it('returns no violations for a clean set', () => {
    expect(validateSnapshotArtifacts([signedFixture(), unsignedFixture()], PINNED_ARTIFACTS)).toEqual([]);
  });

  it('aggregates violations across artifacts', () => {
    const v = validateSnapshotArtifacts(
      [signedFixture({ artifact_kind: 'IntentSpec' }), unsignedFixture({ codec_version: 'postcard-2' })],
      PINNED_ARTIFACTS
    );
    expect(v.length).toBeGreaterThanOrEqual(2);
  });
});

// The tripwire: the COMMITTED snapshot must conform to the pinned contract. This
// goes RED the moment ATLAS ships a breaking change (a new kind like IntentSpec, a
// canon bump, or regenerated hashes) and someone re-runs `sync:atlas` — forcing a
// deliberate COMPASS update rather than a silent vendoring.
describe('committed atlas-provenance snapshot conforms to the pinned contract', () => {
  it('has no contract violations', () => {
    expect(validateSnapshotArtifacts(allProvenance(), PINNED_ARTIFACTS)).toEqual([]);
  });

  it('every artifact_kind is one COMPASS knows how to consume', () => {
    for (const a of allProvenance()) {
      expect(isKnownArtifactKind(a.artifact_kind)).toBe(true);
    }
  });
});
