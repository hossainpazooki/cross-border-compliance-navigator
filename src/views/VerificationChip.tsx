import { Badge } from '@shared/ui';
import type { GateDecision } from '@shared/atlas/verificationTypes';

type ChipVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

export interface ChipProps {
  label: string;
  variant: ChipVariant;
  title?: string;
}

/**
 * Pure mapping from an ADR-0019 gate decision to a display chip (label + colour +
 * tooltip). Kept pure + exported so the verdict→label contract is unit-tested
 * without rendering. The labels are the human register of the fail-closed gate:
 *
 *   unverified -> "Not verified (snapshot)"  (flag off; today's honest default)
 *   verifying  -> "Verifying…"
 *   allowed    -> "Verified — Published"     (+ " · test key" while ADR-0009 is open)
 *   blocked    -> a reason-specific label; the full detail rides in the tooltip.
 *
 * Every `blocked` reason is RED — a non-Published / rejected / not-found / unknown
 * pack reads as blocked even with valid crypto (ADR-0019 fail-closed).
 */
export function verificationChipProps(decision: GateDecision): ChipProps {
  switch (decision.status) {
    case 'unverified':
      return { label: 'Not verified (snapshot)', variant: 'warning', title: decision.detail };
    case 'verifying':
      return { label: 'Verifying…', variant: 'info' };
    case 'allowed':
      return {
        label: `Verified — Published${decision.testKey ? ' · test key' : ''}`,
        variant: 'success',
      };
    case 'blocked': {
      const label =
        decision.reason === 'crypto_rejected'
          ? 'Rejected'
          : decision.reason === 'not_published'
            ? 'Blocked — not Published'
            : decision.reason === 'not_found'
              ? 'Blocked — not registered'
              : 'Unknown — registry unavailable';
      return { label, variant: 'error', title: decision.detail };
    }
  }
}

/** The chip itself — a thin render over the pure mapping. */
export function VerificationChip({ decision }: { decision: GateDecision }) {
  const { label, variant, title } = verificationChipProps(decision);
  return (
    <Badge variant={variant} size="sm" title={title}>
      {label}
    </Badge>
  );
}
