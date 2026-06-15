import snapshot from '@shared/config/atlas-provenance.json';

/**
 * Typed loader over the committed ATLAS provenance snapshot
 * (src/shared/config/atlas-provenance.json, refreshed by `npm run sync:atlas`).
 *
 * Per the ATLAS Gate-4 platform-consumption brief, COMPASS is a CONSUMER: it
 * surfaces provenance, it does not compile/sign/attest/publish and it does not
 * (yet) re-verify the cryptography. Two honesty boundaries the brief makes
 * load-bearing:
 *
 *  1. **Origin, not current validity.** This is a *static* snapshot. Registry
 *     lifecycle state (Published/Revoked) lives only in the live registry
 *     (`ke-cli serve`, ATLAS Gate 5), so `registry_state` is always 'unknown'
 *     here. Brief §3 check 11 ("the COMPASS correctness fix") rejects
 *     non-Published artifacts even with valid crypto — so a snapshot entry is
 *     proof of origin, never an execution authorization.
 *  2. **Test keys are not authoritative.** Signatures/attestations use ATLAS's
 *     fixed-seed test keys (brief §3: refused in production).
 *
 * Canonical consumption is the `@platform/atlas-artifact` WASM verifier
 * (Gate-4-shipped, npm-publish pending) reading the registry view — see
 * WASM_VERIFY_ENABLED for the rewire seam. Use PROVENANCE_DISCLOSURE wherever a
 * hash / "signed by" renders, and LIFECYCLE_DISCLOSURE wherever validity could
 * be inferred.
 */
export const PROVENANCE_DISCLOSURE =
  'Provenance surfaced from a static ATLAS snapshot — not re-verified. Signatures use a fixed-seed TEST key (test-fixed-seed-1), not a production key.';

export const LIFECYCLE_DISCLOSURE =
  'Lifecycle state (Published / Revoked) is NOT established here — it requires the live ATLAS registry (ke-cli serve, Gate 5). This snapshot proves artifact origin, not current execution validity.';

/**
 * Rewire seam (brief / Gate-5 closeout §): when the `@platform/atlas-artifact`
 * WASM verifier + `ke-cli serve` registry are published, flip this flag to read
 * the canonical registry view and verify in-browser (incl. revoked-pack
 * flagging) instead of this vendored snapshot. Default off; the snapshot path is
 * the pre-publish stopgap. Mirrors ATLAS's `VITE_USE_WASM_PREVIEW` discipline.
 */
export const WASM_VERIFY_ENABLED =
  (process.env as Record<string, string | undefined>).NEXT_PUBLIC_USE_WASM_VERIFY === 'true';

export interface AttestationProvenance {
  attestation_type: string;
  signer_role: string;
  tsa_class: string;
  claimed_time_unix: number;
}

export interface ArtifactProvenance {
  artifact_id: string;
  regime_id: string;
  artifact_kind: string;
  signed: boolean;
  artifact_hash_hex: string | null;
  envelope_len: number | null;
  ir_schema_version: string;
  codec_version: string;
  canonicalization_version: string;
  signer_key_id: string | null;
  is_test_key: boolean;
  effective_from: string | null;
  attestation_policy_version: string | null;
  /** Live-registry lifecycle — always 'unknown' in a static snapshot (see LIFECYCLE_DISCLOSURE). */
  registry_state: string;
  attestations: AttestationProvenance[];
}

export interface AtlasSource {
  atlas_commit: string | null;
  platform_corpus_commit: string | null;
}

export interface CanonTriplet {
  ir_schema_version: string;
  codec_version: string;
  canonicalization_version: string;
}

export interface ProvenanceSnapshot {
  synced_at: string;
  atlas_repo: string;
  atlas_source: AtlasSource;
  canon_triplet: CanonTriplet;
  source: string;
  note: string;
  artifacts: ArtifactProvenance[];
}

const SNAPSHOT = snapshot as ProvenanceSnapshot;

/** When the committed snapshot was last synced from ATLAS. */
export function syncedAt(): string {
  return SNAPSHOT.synced_at;
}

/** The ATLAS / platform-corpus source revisions this snapshot is pinned to. */
export function atlasSource(): AtlasSource {
  return SNAPSHOT.atlas_source;
}

/** Short display form of a git commit (first 7 chars). */
export function shortCommit(sha: string | null): string {
  return sha ? sha.slice(0, 7) : '—';
}

/** All artifacts in the snapshot. */
export function allProvenance(): ArtifactProvenance[] {
  return SNAPSHOT.artifacts;
}

/** Artifacts published under a given ATLAS regime (e.g. 'mica_2023'). */
export function provenanceForRegime(regimeId: string): ArtifactProvenance[] {
  return SNAPSHOT.artifacts.filter((a) => a.regime_id === regimeId);
}

/** Short display form of an artifact hash (first 12 hex chars). */
export function shortHash(hex: string | null): string {
  return hex ? `${hex.slice(0, 12)}…` : '—';
}

/** The version triplet ATLAS pins for an artifact, as one display string. */
export function versionTriplet(a: ArtifactProvenance): string {
  return `ir ${a.ir_schema_version} · ${a.codec_version} · ${a.canonicalization_version}`;
}
