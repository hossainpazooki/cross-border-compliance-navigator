import { describe, expect, it } from 'vitest';
import {
  allProvenance,
  provenanceForRegime,
  shortHash,
  shortCommit,
  versionTriplet,
  syncedAt,
  atlasSource,
  PROVENANCE_DISCLOSURE,
  LIFECYCLE_DISCLOSURE,
} from '../provenance';

// The two authoritative artifact hashes from ATLAS GOLDEN.md (Gate 4 ledger).
// If `npm run sync:atlas` ever drifts, these assertions fail loudly.
const GOLDEN = {
  rule_reserve_assets: '13a414cf7f6b25c6b6049c0953a83ff5697044aabafbd44b87e87fc4ed90f8a9',
  rule_significant_thresholds: '72a60976bcd55fc9a9b088cada4aae10cfbb4aabf066a8e85c403dbeae893d94',
};

describe('atlas provenance loader', () => {
  it('surfaces the two signed mica_2023 RegimePack artifacts with their GOLDEN hashes', () => {
    const artifacts = provenanceForRegime('mica_2023');
    expect(artifacts).toHaveLength(2);
    expect(artifacts.every((a) => a.signed)).toBe(true);

    const byId = Object.fromEntries(artifacts.map((a) => [a.artifact_id, a]));
    expect(byId.rule_reserve_assets.artifact_hash_hex).toBe(GOLDEN.rule_reserve_assets);
    expect(byId.rule_significant_thresholds.artifact_hash_hex).toBe(
      GOLDEN.rule_significant_thresholds
    );
  });

  it('marks artifacts as test-key signed with three attestations each', () => {
    for (const a of provenanceForRegime('mica_2023')) {
      expect(a.is_test_key).toBe(true);
      expect(a.signer_key_id).toBe('test-fixed-seed-1');
      expect(a.attestations).toHaveLength(3);
      expect(a.attestations.map((x) => x.attestation_type).sort()).toEqual([
        'PublicationApproval',
        'ScenarioCoverage',
        'SourceFidelity',
      ]);
    }
  });

  it('includes the unsigned PolicyBundle, not under mica_2023', () => {
    const all = allProvenance();
    expect(all).toHaveLength(4); // 2 RegimePack + 1 unsigned PolicyBundle + 1 IntentSpec (ADR-0021)
    const policy = all.find((a) => a.artifact_id === 'policy_production_eu');
    expect(policy?.signed).toBe(false);
    expect(policy?.artifact_hash_hex).toBeNull();
    expect(policy?.regime_id).not.toBe('mica_2023');
  });

  it('snapshot shape integrity — required keys present', () => {
    expect(typeof syncedAt()).toBe('string');
    for (const a of allProvenance()) {
      expect(a).toEqual(
        expect.objectContaining({
          artifact_id: expect.any(String),
          regime_id: expect.any(String),
          artifact_kind: expect.any(String),
          signed: expect.any(Boolean),
          ir_schema_version: expect.any(String),
          codec_version: expect.any(String),
          canonicalization_version: expect.any(String),
          registry_state: expect.any(String),
          attestations: expect.any(Array),
        })
      );
    }
  });

  it('records the ATLAS + platform-corpus source revisions (drift = different contract)', () => {
    const src = atlasSource();
    // 40-char git SHAs vendored from the sibling repo + SOURCE.md pin.
    expect(src.atlas_commit).toMatch(/^[0-9a-f]{40}$/);
    expect(src.platform_corpus_commit).toBe(
      'f73b9403c88a7ab5d741b351dce085b6988b6ba7'
    );
  });

  it('never asserts current lifecycle from a static snapshot (the COMPASS correctness fix)', () => {
    // registry_state is live-registry-only; a snapshot proves origin, not validity.
    for (const a of allProvenance()) {
      expect(a.registry_state).toBe('unknown');
    }
  });

  it('disclosures name the honesty boundaries', () => {
    expect(PROVENANCE_DISCLOSURE).toMatch(/not re-verified/i);
    expect(PROVENANCE_DISCLOSURE).toMatch(/test/i);
    expect(LIFECYCLE_DISCLOSURE).toMatch(/live ATLAS registry|Gate 5/i);
  });

  it('display helpers', () => {
    expect(shortHash(GOLDEN.rule_reserve_assets)).toBe('13a414cf7f6b…');
    expect(shortHash(null)).toBe('—');
    expect(shortCommit('f73b9403c88a7ab5d741b351dce085b6988b6ba7')).toBe('f73b940');
    expect(shortCommit(null)).toBe('—');
    const a = provenanceForRegime('mica_2023')[0];
    expect(versionTriplet(a)).toBe('ir 0.5.0 · postcard-1 · ke-canon-5');
  });
});
