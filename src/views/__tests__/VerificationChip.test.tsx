import { describe, expect, it } from 'vitest';
import { verificationChipProps } from '../VerificationChip';
import type { GateDecision } from '@shared/atlas/verificationTypes';

// Pure mapping from an ADR-0019 gate decision to a display chip. No rendering,
// no env, no I/O — just the label/variant a human reads for each verdict.

describe('verificationChipProps — gate decision -> chip', () => {
  it('unverified (snapshot, flag off) -> warning "Not verified (snapshot)"', () => {
    const p = verificationChipProps({ status: 'unverified', detail: 'snap' });
    expect(p.label).toBe('Not verified (snapshot)');
    expect(p.variant).toBe('warning');
    expect(p.title).toBe('snap');
  });

  it('verifying -> info "Verifying…"', () => {
    expect(verificationChipProps({ status: 'verifying' })).toMatchObject({
      label: 'Verifying…',
      variant: 'info',
    });
  });

  it('allowed -> success "Verified — Published"', () => {
    expect(verificationChipProps({ status: 'allowed', testKey: false })).toMatchObject({
      label: 'Verified — Published',
      variant: 'success',
    });
  });

  it('allowed with a test key -> appends a test-key note', () => {
    expect(verificationChipProps({ status: 'allowed', testKey: true }).label).toBe(
      'Verified — Published · test key',
    );
  });

  it('blocked crypto_rejected -> error "Rejected", detail carried as title', () => {
    const p = verificationChipProps({
      status: 'blocked',
      reason: 'crypto_rejected',
      detail: 'signature mismatch',
    });
    expect(p.variant).toBe('error');
    expect(p.label).toBe('Rejected');
    expect(p.title).toBe('signature mismatch');
  });

  it('blocked not_published -> error "Blocked — not Published"', () => {
    expect(
      verificationChipProps({
        status: 'blocked',
        reason: 'not_published',
        detail: 'Registry state is Revoked, not Published.',
      }).label,
    ).toBe('Blocked — not Published');
  });

  it('blocked not_found -> error "Blocked — not registered"', () => {
    expect(
      verificationChipProps({ status: 'blocked', reason: 'not_found', detail: 'x' }).label,
    ).toBe('Blocked — not registered');
  });

  it('blocked registry_unknown -> error "Unknown — registry unavailable"', () => {
    expect(
      verificationChipProps({ status: 'blocked', reason: 'registry_unknown', detail: 'x' }).label,
    ).toBe('Unknown — registry unavailable');
  });

  it('every block reason maps to the error variant', () => {
    const reasons: GateDecision[] = [
      { status: 'blocked', reason: 'crypto_rejected', detail: '' },
      { status: 'blocked', reason: 'not_published', detail: '' },
      { status: 'blocked', reason: 'not_found', detail: '' },
      { status: 'blocked', reason: 'registry_unknown', detail: '' },
    ];
    for (const d of reasons) expect(verificationChipProps(d).variant).toBe('error');
  });
});
