import { beforeEach, describe, expect, it } from 'vitest';
import { useDeskStore, activeDesk, activeMember, sessionsForDesk } from '../deskStore';
import { DESKS } from '@shared/config/desks';

beforeEach(() => {
  useDeskStore.setState({
    activeDeskId: DESKS[0].id,
    activeMemberId: DESKS[0].members[0].id,
    sessionDeskMap: {},
  });
});

describe('deskStore', () => {
  it('seeds the active desk and member from config', () => {
    const s = useDeskStore.getState();
    expect(s.activeDeskId).toBe(DESKS[0].id);
    expect(s.activeMemberId).toBe(DESKS[0].members[0].id);
    expect(activeDesk(s).name).toBe(DESKS[0].name);
    expect(activeMember(s)?.id).toBe(DESKS[0].members[0].id);
  });

  it('switching desk resets the active member to the new desk’s first member', () => {
    const other = DESKS[1];
    useDeskStore.getState().setActiveDesk(other.id);
    const s = useDeskStore.getState();
    expect(s.activeDeskId).toBe(other.id);
    expect(s.activeMemberId).toBe(other.members[0].id);
    // No dangling member outside the active desk.
    expect(activeDesk(s).members.some((m) => m.id === s.activeMemberId)).toBe(true);
  });

  it('setActiveMember selects a member within the active desk', () => {
    const second = DESKS[0].members[1];
    useDeskStore.getState().setActiveMember(second.id);
    expect(activeMember(useDeskStore.getState())?.id).toBe(second.id);
  });

  describe('session association (demo-grade)', () => {
    it('associateSession stamps a session id with its desk', () => {
      useDeskStore.getState().associateSession('intent-1', DESKS[0].id);
      expect(useDeskStore.getState().sessionDeskMap['intent-1']).toBe(DESKS[0].id);
    });

    it('sessionsForDesk lists only the sessions stamped for that desk', () => {
      const store = useDeskStore.getState();
      store.associateSession('intent-1', DESKS[0].id);
      store.associateSession('intent-2', DESKS[1].id);
      store.associateSession('intent-3', DESKS[0].id);

      const s = useDeskStore.getState();
      const forFirst = sessionsForDesk(s, DESKS[0].id);
      expect(forFirst).toHaveLength(2);
      expect(forFirst).toEqual(expect.arrayContaining(['intent-1', 'intent-3']));
      expect(forFirst).not.toContain('intent-2');

      expect(sessionsForDesk(s, DESKS[1].id)).toEqual(['intent-2']);
    });

    it('sessionsForDesk returns empty when nothing is stamped for the desk', () => {
      expect(sessionsForDesk(useDeskStore.getState(), DESKS[0].id)).toEqual([]);
    });
  });
});
