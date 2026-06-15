import { create } from 'zustand';
import { DESKS, deskById, type Desk, type DeskMember } from '@shared/config/desks';

/**
 * Desk identity store — "which desk am I in" + "who am I within it".
 *
 * DEMO IDENTITY: there is no auth and no datastore in COMPASS yet, so the
 * active desk/member are seeded from config (DESKS[0]) and held in memory only.
 * No login, no persistence, no access control is claimed. Mirrors the simple
 * Zustand pattern used by uiStore / the navigation store.
 */
interface DeskState {
  activeDeskId: string;
  activeMemberId: string;
  /**
   * DEMO ASSOCIATION: maps a live-session id (== the intent_id) to the desk it
   * was launched from. This lives in the APP/desk layer ON PURPOSE — the
   * live-session store (a feature) stays desk-agnostic, so the desk↔session
   * link is owned here and never leaks into `@features/live-session`. In-memory
   * only: no persistence, no datastore, no access control claimed.
   */
  sessionDeskMap: Record<string, string>;
  setActiveDesk: (deskId: string) => void;
  setActiveMember: (memberId: string) => void;
  /** Stamp a session id with the desk it was launched from (demo-grade). */
  associateSession: (sessionId: string, deskId: string) => void;
}

const SEED_DESK = DESKS[0];
const SEED_MEMBER = SEED_DESK.members[0];

export const useDeskStore = create<DeskState>((set) => ({
  activeDeskId: SEED_DESK.id,
  activeMemberId: SEED_MEMBER.id,
  sessionDeskMap: {},

  // Switching desks resets the active member to that desk's first member, so
  // member never dangles outside the active desk.
  setActiveDesk: (deskId) =>
    set(() => {
      const desk = deskById(deskId);
      return {
        activeDeskId: deskId,
        activeMemberId: desk?.members[0]?.id ?? '',
      };
    }),

  setActiveMember: (memberId) => set({ activeMemberId: memberId }),

  associateSession: (sessionId, deskId) =>
    set((s) => ({
      sessionDeskMap: { ...s.sessionDeskMap, [sessionId]: deskId },
    })),
}));

/** Convenience read of the active desk's full record (or the seed if missing). */
export function activeDesk(state: DeskState): Desk {
  return deskById(state.activeDeskId) ?? SEED_DESK;
}

/** Convenience read of the active member within the active desk. */
export function activeMember(state: DeskState): DeskMember | undefined {
  return activeDesk(state).members.find((m) => m.id === state.activeMemberId);
}

/**
 * Session ids associated with a given desk (demo-grade — see `sessionDeskMap`).
 * Pure read over the map; pair with the live-session store to keep only the
 * sessions that are still live.
 */
export function sessionsForDesk(state: DeskState, deskId: string): string[] {
  return Object.entries(state.sessionDeskMap)
    .filter(([, id]) => id === deskId)
    .map(([sessionId]) => sessionId);
}
