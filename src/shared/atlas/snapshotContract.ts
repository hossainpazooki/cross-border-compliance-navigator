// The ATLAS-consumption contract COMPASS pins to — the single source of truth for
// which artifact kinds it understands, which canon triplet it expects, and which
// signed artifacts it trusts. Pure and dependency-free so BOTH the runtime loader
// (`provenance.ts`) and the dev-time sync (`tools/snapshots/build-atlas-snapshot.ts`)
// consume it, and a Vitest tripwire can assert the committed snapshot conforms.
//
// Why this exists: COMPASS is a downstream consumer of ATLAS artifacts. When ATLAS
// ships a breaking change — a new artifact kind (e.g. IntentSpec), a canonicalization
// bump, or regenerated golden hashes — the snapshot must NOT silently vendor it.
// These validators turn every such change into a loud, deliberate failure (a red
// test + a throwing `sync:atlas`) that forces a conscious COMPASS update.

/**
 * ATLAS artifact kinds COMPASS knows how to consume. A hand-maintained mirror of
 * ATLAS `ke-core` `ArtifactKind`; a kind outside this set means ATLAS shipped a new
 * type and COMPASS must consciously adopt it (the validators reject it until then).
 */
export const KNOWN_ARTIFACT_KINDS = [
  'RegimePack',
  'EquivalenceMatrix',
  'TestCorpus',
  'PolicyBundle',
  'IntentSpec',
] as const;

export type ArtifactKind = (typeof KNOWN_ARTIFACT_KINDS)[number];

export function isKnownArtifactKind(kind: string): kind is ArtifactKind {
  return (KNOWN_ARTIFACT_KINDS as readonly string[]).includes(kind);
}

export interface CanonTriplet {
  ir_schema_version: string;
  codec_version: string;
  canonicalization_version: string;
}

/**
 * The ATLAS canon triplet this consumer is pinned to (ADR-0021: 0.5.0 / postcard-1 /
 * ke-canon-5 — the breaking bump that introduced the polymorphic `IntentSpec`
 * payload). A triplet change is a different artifact contract and must force a
 * deliberate re-pin — so every artifact, signed or not, is checked against it.
 */
export const EXPECTED_CANON: CanonTriplet = {
  ir_schema_version: '0.5.0',
  codec_version: 'postcard-1',
  canonicalization_version: 'ke-canon-5',
};

export interface Pin {
  hash: string;
  envelopeLen: number;
}

/**
 * Authoritative BLAKE3 hashes from ATLAS GOLDEN.md for every signed artifact COMPASS
 * vendors. A signed artifact absent from this map is untrusted (unpinned) and the
 * validators reject it; regenerated hashes (a canon bump) make it mismatch loudly.
 */
export const PINNED_ARTIFACTS: Record<string, Pin> = {
  rule_reserve_assets: {
    hash: '13a414cf7f6b25c6b6049c0953a83ff5697044aabafbd44b87e87fc4ed90f8a9',
    envelopeLen: 863,
  },
  rule_significant_thresholds: {
    hash: '72a60976bcd55fc9a9b088cada4aae10cfbb4aabf066a8e85c403dbeae893d94',
    envelopeLen: 599,
  },
  // ADR-0021: the first IntentSpec artifact — polymorphic ArtifactPayload::IntentSpec
  // payload, kind-selected attestation set (SourceFidelity + PublicationApproval).
  intentspec_payment: {
    hash: 'c7a36959bfaafc03e0abfb86fce7e1c0c6efebc812b55f83313724c3d024dc51',
    envelopeLen: 422,
  },
};

/** The minimal artifact shape the validators need (a subset of ArtifactProvenance). */
export interface ValidatableArtifact {
  artifact_id: string;
  artifact_kind: string;
  signed: boolean;
  artifact_hash_hex: string | null;
  envelope_len: number | null;
  ir_schema_version: string;
  codec_version: string;
  canonicalization_version: string;
}

/**
 * Validate one artifact against the pinned kinds, canon triplet, and (for signed
 * artifacts) the pinned hash. Returns human-readable violation strings — empty means
 * conformant. Enforced for EVERY artifact (signed or not): known kind + canon triplet.
 * Enforced for SIGNED artifacts additionally: a required pin whose hash + envelope
 * length match.
 */
export function validateArtifact(a: ValidatableArtifact, pins: Record<string, Pin>): string[] {
  const violations: string[] = [];
  const id = a.artifact_id;

  if (!isKnownArtifactKind(a.artifact_kind)) {
    violations.push(
      `${id}: unknown artifact_kind "${a.artifact_kind}" — ATLAS shipped a new kind; ` +
        `add it to KNOWN_ARTIFACT_KINDS and decide how COMPASS consumes it.`
    );
  }

  if (
    a.ir_schema_version !== EXPECTED_CANON.ir_schema_version ||
    a.codec_version !== EXPECTED_CANON.codec_version ||
    a.canonicalization_version !== EXPECTED_CANON.canonicalization_version
  ) {
    violations.push(
      `${id}: canon-triplet drift — got ` +
        `${a.ir_schema_version}/${a.codec_version}/${a.canonicalization_version}, expected ` +
        `${EXPECTED_CANON.ir_schema_version}/${EXPECTED_CANON.codec_version}/${EXPECTED_CANON.canonicalization_version}. ` +
        `Regenerate the snapshot + re-pin consumers for the new triplet.`
    );
  }

  if (a.signed) {
    const pin = pins[id];
    if (!pin) {
      violations.push(
        `${id}: signed but not pinned — add it to PINNED_ARTIFACTS with its GOLDEN hash before vendoring.`
      );
    } else {
      if (a.artifact_hash_hex !== pin.hash) {
        violations.push(
          `${id}: hash mismatch — snapshot ${a.artifact_hash_hex ?? '<null>'} vs pin ${pin.hash}.`
        );
      }
      if (a.envelope_len !== pin.envelopeLen) {
        violations.push(
          `${id}: envelope_len mismatch — snapshot ${a.envelope_len ?? '<null>'} vs pin ${pin.envelopeLen}.`
        );
      }
    }
  }

  return violations;
}

/** Validate every artifact in a snapshot; returns the aggregated violations. */
export function validateSnapshotArtifacts(
  artifacts: ValidatableArtifact[],
  pins: Record<string, Pin>
): string[] {
  return artifacts.flatMap((a) => validateArtifact(a, pins));
}
