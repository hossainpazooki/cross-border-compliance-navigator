import type { JurisdictionCode } from '@platform/engine';

/**
 * Desk model — "Organization" in COMPASS means a DESK (a business unit / team
 * within one institution), NOT a SaaS tenant. This is Decision-0 option (a):
 * teams within one institution. There is no auth and no datastore yet, so desks
 * + members are SEEDED CONFIG surfaced as demo identity (see deskStore). No
 * login, no DB, no hard isolation is claimed.
 *
 * `DeskMember.role` mirrors the live-session agent-org roles
 * (compliance / risk / auditor) plus a reviewer — the human bench standing
 * behind the machine bench.
 */
export type DeskRole = 'compliance' | 'risk' | 'auditor' | 'reviewer';

export interface DeskMember {
  id: string;
  name: string;
  role: DeskRole;
}

export interface Desk {
  id: string;
  name: string;
  institution: string;
  jurisdictions: JurisdictionCode[];
  /** ATLAS regime ids this desk operates under (join key to atlas-provenance). */
  regimeIds: string[];
  members: DeskMember[];
}

export const DESKS: readonly Desk[] = [
  {
    id: 'eu-issuance',
    name: 'EU Issuance Desk',
    institution: 'Meridian Capital',
    jurisdictions: ['EU'],
    regimeIds: ['mica_2023'],
    members: [
      { id: 'm-eu-1', name: 'Aria Lindqvist', role: 'compliance' },
      { id: 'm-eu-2', name: 'Tomas Berg', role: 'risk' },
      { id: 'm-eu-3', name: 'Noa Feldman', role: 'auditor' },
    ],
  },
  {
    id: 'multi-jurisdiction',
    name: 'Multi-Jurisdiction Desk',
    institution: 'Meridian Capital',
    jurisdictions: ['EU', 'UK', 'CH'],
    regimeIds: ['mica_2023'],
    members: [
      { id: 'm-mj-1', name: 'Priya Nair', role: 'compliance' },
      { id: 'm-mj-2', name: 'Daniel Okoro', role: 'risk' },
      { id: 'm-mj-3', name: 'Sofia Marchetti', role: 'reviewer' },
      { id: 'm-mj-4', name: 'Lukas Hoffmann', role: 'auditor' },
    ],
  },
] as const;

export function deskById(id: string): Desk | undefined {
  return DESKS.find((d) => d.id === id);
}
