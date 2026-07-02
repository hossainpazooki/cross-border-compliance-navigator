// Dev-time sync: vendor ATLAS artifact provenance into a committed snapshot.
//
// COMPASS "calls ATLAS" by consuming ATLAS's signed, content-addressed artifact
// PROVENANCE — not by live HTTP (ke-cli serve is Gate 5, not built) and not by
// re-running the crypto (that is the future ke-artifact-py path). The artifact
// is the contract; this script vendors that contract as a committed JSON
// snapshot synced from the sibling repo. Run via `npm run sync:atlas`.
//
// CRITICAL — authoritative hash source: GOLDEN.md, NOT manifest.json. ATLAS's
// `manifest.json.artifact_hash` is a byte array equal to the corpus root; the
// authoritative artifact_hash (BLAKE3 over the envelope with the 32-byte hash
// slot zeroed) is pinned only in GOLDEN.md's ledger table. We parse that table
// and ASSERT the two known-good hashes; a mismatch throws loudly.

import { readFile, writeFile, readdir, access } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EXPECTED_CANON,
  PINNED_ARTIFACTS,
  validateSnapshotArtifacts,
} from '../../src/shared/atlas/snapshotContract';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ATLAS_REPO = process.env.ATLAS_REPO
  ? path.resolve(process.env.ATLAS_REPO)
  : path.resolve(REPO_ROOT, '..', 'regulatory-rule-engine');
const ARTIFACTS_DIR = path.join(ATLAS_REPO, 'fixtures', 'artifacts');
const OUT_FILE = path.join(REPO_ROOT, 'src', 'shared', 'config', 'atlas-provenance.json');

// The pinned artifact kinds, canon triplet, GOLDEN hashes, and validators are the
// single source of truth in src/shared/atlas/snapshotContract.ts — shared with the
// runtime loader (provenance.ts) and the Vitest tripwire. This script enforces that
// contract at vendor time, so a breaking ATLAS change (a new kind, a canon bump, or
// regenerated golden hashes) fails loudly here instead of silently vendoring.
// (EXPECTED_CANON and PINNED_ARTIFACTS are imported above.)

// Registry lifecycle state (Published/Deprecated/Revoked) is NOT in the static
// golden fixtures — it lives only in the live registry (ke-cli serve, ATLAS
// Gate 5). The platform-consumption brief §3 check 11 ("the COMPASS correctness
// fix") rejects non-Published artifacts even with valid crypto. A vendored
// snapshot therefore CANNOT establish current lifecycle: every entry is
// 'unknown' (fail-closed → not execution-authoritative). This is provenance of
// ORIGIN, not a current Published verdict.
const REGISTRY_STATE_STATIC = 'unknown';

interface AttestationProvenance {
  attestation_type: string;
  signer_role: string;
  tsa_class: string;
  claimed_time_unix: number;
}

interface ArtifactProvenance {
  artifact_id: string;
  regime_id: string;
  artifact_kind: string;
  signed: boolean;
  /** Authoritative hash from GOLDEN.md; null for unsigned artifacts. */
  artifact_hash_hex: string | null;
  envelope_len: number | null;
  ir_schema_version: string;
  codec_version: string;
  canonicalization_version: string;
  signer_key_id: string | null;
  is_test_key: boolean;
  effective_from: string | null;
  attestation_policy_version: string | null;
  /** Live-registry lifecycle state — NOT establishable from a static snapshot. */
  registry_state: string;
  attestations: AttestationProvenance[];
}

interface AtlasSource {
  /** ATLAS repo commit this snapshot was vendored from (drift = different contract). */
  atlas_commit: string | null;
  /** Platform rule-corpus commit the artifacts are content-addressed off (SOURCE.md). */
  platform_corpus_commit: string | null;
}

interface ProvenanceSnapshot {
  synced_at: string;
  atlas_repo: string;
  atlas_source: AtlasSource;
  canon_triplet: typeof EXPECTED_CANON;
  source: string;
  note: string;
  artifacts: ArtifactProvenance[];
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** Parse GOLDEN.md's ledger table → { artifact_id: { hash, envelopeLen } }. */
function parseGolden(golden: string): Record<string, { hash: string; envelopeLen: number }> {
  const out: Record<string, { hash: string; envelopeLen: number }> = {};
  for (const line of golden.split('\n')) {
    // Rows look like: | `rule_reserve_assets` | `bceb…` | 862 |
    const m = line.match(/^\|\s*`([a-z0-9_]+)`\s*\|\s*`([0-9a-f]{64})`\s*\|\s*(\d+)\s*\|/i);
    if (m) out[m[1]] = { hash: m[2], envelopeLen: Number(m[3]) };
  }
  return out;
}

function semver(v: { major: number; minor: number; patch: number }): string {
  return `${v.major}.${v.minor}.${v.patch}`;
}

function effectiveFrom(ef: { year: number; month: number; day: number } | null): string | null {
  if (!ef) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${ef.year}-${pad(ef.month)}-${pad(ef.day)}`;
}

/** ATLAS repo HEAD at sync time — the source revision this snapshot is pinned to. */
function atlasCommit(): string | null {
  try {
    return execSync('git rev-parse HEAD', { cwd: ATLAS_REPO }).toString().trim();
  } catch {
    return null;
  }
}

/** Platform rule-corpus commit from fixtures/rules/SOURCE.md (spec §4.5 pin). */
async function platformCorpusCommit(): Promise<string | null> {
  const p = path.join(ATLAS_REPO, 'fixtures', 'rules', 'SOURCE.md');
  if (!(await exists(p))) return null;
  const m = (await readFile(p, 'utf8')).match(/Platform commit\s*\|\s*`([0-9a-f]{40})`/i);
  return m ? m[1] : null;
}

async function main(): Promise<void> {
  if (!(await exists(ARTIFACTS_DIR))) {
    throw new Error(
      `ATLAS artifacts not found at ${ARTIFACTS_DIR}. ` +
        `Set ATLAS_REPO to the regulatory-rule-engine checkout.`
    );
  }

  const golden = parseGolden(await readFile(path.join(ARTIFACTS_DIR, 'GOLDEN.md'), 'utf8'));

  // Recompute check: the parsed ledger must match the pinned constants.
  for (const [id, expected] of Object.entries(PINNED_ARTIFACTS)) {
    const got = golden[id];
    if (!got || got.hash !== expected.hash || got.envelopeLen !== expected.envelopeLen) {
      throw new Error(
        `GOLDEN.md mismatch for ${id}: expected ${expected.hash}/${expected.envelopeLen}, ` +
          `parsed ${got ? `${got.hash}/${got.envelopeLen}` : '<missing>'}. ` +
          `Refusing to write a snapshot with an unverified hash.`
      );
    }
  }

  const entries = (await readdir(ARTIFACTS_DIR, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const artifacts: ArtifactProvenance[] = [];
  for (const id of entries.sort()) {
    const dir = path.join(ARTIFACTS_DIR, id);
    const manifestPath = path.join(dir, 'manifest.json');
    if (!(await exists(manifestPath))) continue;
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

    const sigPath = path.join(dir, 'signature.json');
    const attPath = path.join(dir, 'attestations.json');
    const hasSig = await exists(sigPath);
    const hasGolden = Boolean(golden[id]);
    // A signature without a GOLDEN hash (or vice versa) is inconsistent — refuse to
    // silently downgrade it to unsigned (the old `hasSig && hasGolden` did exactly
    // that, stripping an artifact's crypto identity with no signal).
    if (hasSig !== hasGolden) {
      throw new Error(
        `${id}: signature.json ${hasSig ? 'present' : 'absent'} but GOLDEN.md hash ${hasGolden ? 'present' : 'absent'} — ` +
          `refusing to vendor a half-signed artifact. Add or remove the GOLDEN row and the signature together.`
      );
    }
    const signed = hasSig && hasGolden;

    let signerKeyId: string | null = null;
    if (await exists(sigPath)) {
      signerKeyId = JSON.parse(await readFile(sigPath, 'utf8')).key_id ?? null;
    }

    let attestations: AttestationProvenance[] = [];
    if (await exists(attPath)) {
      const raw = JSON.parse(await readFile(attPath, 'utf8')) as Array<Record<string, unknown>>;
      attestations = raw.map((a) => ({
        attestation_type: String(a.attestation_type),
        signer_role: String(a.signer_role),
        tsa_class: String(a.tsa_class),
        claimed_time_unix: Number(a.claimed_time_unix),
      }));
    }

    artifacts.push({
      artifact_id: id,
      regime_id: String(manifest.regime_id),
      artifact_kind: String(manifest.artifact_kind),
      signed,
      artifact_hash_hex: signed ? golden[id].hash : null,
      envelope_len: signed ? golden[id].envelopeLen : null,
      ir_schema_version: manifest.ir_schema_version
        ? semver(manifest.ir_schema_version)
        : 'unknown',
      codec_version: String(manifest.codec_version),
      canonicalization_version: String(manifest.canonicalization_version),
      signer_key_id: signerKeyId,
      // Every key in the ATLAS golden suite is a fixed-seed TEST key.
      is_test_key: signerKeyId ? signerKeyId.includes('test') : false,
      effective_from: effectiveFrom(manifest.effective_from ?? null),
      attestation_policy_version: manifest.attestation_policy_version
        ? String(manifest.attestation_policy_version)
        : null,
      registry_state: REGISTRY_STATE_STATIC,
      attestations,
    });
  }

  // Contract guard (shared with the runtime loader + the Vitest tripwire): every
  // artifact must be a known kind on the pinned canon triplet, and every signed
  // artifact must match its pinned GOLDEN hash + envelope length. Unlike the old
  // signed-only canon check, this covers unsigned artifacts too — a drifted
  // PolicyBundle no longer slips through — and rejects an unknown kind (a new ATLAS
  // artifact type) instead of vendoring it blind.
  const violations = validateSnapshotArtifacts(artifacts, PINNED_ARTIFACTS);
  if (violations.length > 0) {
    throw new Error(
      `ATLAS snapshot contract violations — refusing to vendor:\n  - ${violations.join('\n  - ')}`
    );
  }

  const snapshot: ProvenanceSnapshot = {
    synced_at: new Date().toISOString(),
    atlas_repo: path.relative(REPO_ROOT, ATLAS_REPO) || ATLAS_REPO,
    atlas_source: {
      atlas_commit: atlasCommit(),
      platform_corpus_commit: await platformCorpusCommit(),
    },
    canon_triplet: EXPECTED_CANON,
    source: 'fixtures/artifacts (Gate 4 Phase 1+2 golden ledger)',
    note:
      'Provenance as published by ATLAS, vendored as a static snapshot — surfaced, NOT re-verified. ' +
      'Signatures/attestations use FIXED-SEED TEST KEYS (test-fixed-seed-1 / test-expert-fixed-seed-1), never production keys (not authoritative; refused in production per brief §3). ' +
      'registry_state is "unknown" for every entry: lifecycle (Published/Revoked) lives only in the live registry (ke-cli serve, ATLAS Gate 5), so this snapshot proves ORIGIN provenance, not current execution validity. ' +
      'Canonical consumption is the @platform/atlas-artifact WASM verifier (Gate-4-shipped, npm-publish pending) reading the registry view — this vendored snapshot is the pre-publish stopgap.',
    artifacts,
  };

  await writeFile(OUT_FILE, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');

  const signedCount = artifacts.filter((a) => a.signed).length;
  process.stdout.write(
    `wrote ${path.relative(REPO_ROOT, OUT_FILE)} — ${artifacts.length} artifacts ` +
      `(${signedCount} signed); regimes: ${[...new Set(artifacts.map((a) => a.regime_id))].join(', ')}\n`
  );
}

main().catch((err) => {
  process.stderr.write(`build-atlas-snapshot failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
