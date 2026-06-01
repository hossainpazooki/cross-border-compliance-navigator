import { create } from 'zustand';
import {
  assertNever,
  type ServerEnvelope,
  type TradeIntent,
} from '@platform/contracts';
import type {
  ApplyResult,
  ConnectionState,
  SessionState,
  WSErrorInfo,
} from './types';

interface SessionStoreState {
  sessions: Record<string, SessionState>;
  openSession: (intentId: string, intent: TradeIntent) => void;
  closeSession: (intentId: string) => void;
  setConnection: (intentId: string, connection: ConnectionState) => void;
  setLastError: (intentId: string, error: WSErrorInfo | null) => void;
  applyEnvelope: (intentId: string, envelope: ServerEnvelope) => ApplyResult;
  replayAuditEnvelopes: (intentId: string, envelopes: ServerEnvelope[]) => void;
}

function initialSessionState(intent: TradeIntent): SessionState {
  return {
    intent,
    currentVerdict: 'compliant',
    latestSnapshot: null,
    crossings: [],
    rationales: {},
    leadPositions: {},
    auditorFindings: {},
    connection: 'connecting',
    lastSeq: 0,
    lastError: null,
  };
}

function reduce(state: SessionState, envelope: ServerEnvelope): SessionState {
  switch (envelope.type) {
    case 'tick':
      return { ...state, latestSnapshot: envelope.payload };
    case 'risk_update':
      return state;
    case 'compliance':
      return { ...state, currentVerdict: envelope.payload.new_verdict };
    case 'threshold': {
      const crossing = envelope.payload;
      return {
        ...state,
        crossings: [crossing, ...state.crossings],
        rationales: {
          ...state.rationales,
          [crossing.crossing_id]: {
            rationale_id: '',
            crossing_id: crossing.crossing_id,
            content: '',
            status: 'streaming',
          },
        },
      };
    }
    case 'rationale_tok': {
      const { rationale_id, crossing_id, token } = envelope.payload;
      const prev = state.rationales[crossing_id];
      return {
        ...state,
        rationales: {
          ...state.rationales,
          [crossing_id]: {
            rationale_id: prev?.rationale_id || rationale_id,
            crossing_id,
            content: (prev?.content ?? '') + token,
            status: 'streaming',
          },
        },
      };
    }
    case 'rationale_verified': {
      const { rationale_id, crossing_id, final_score } = envelope.payload;
      const prev = state.rationales[crossing_id];
      return {
        ...state,
        rationales: {
          ...state.rationales,
          [crossing_id]: {
            rationale_id: prev?.rationale_id || rationale_id,
            crossing_id,
            content: prev?.content ?? '',
            status: 'verified',
            final_score,
            completed_at: envelope.ts,
          },
        },
      };
    }
    case 'rationale_retracted': {
      const { rationale_id, crossing_id, final_score, reason } = envelope.payload;
      const prev = state.rationales[crossing_id];
      return {
        ...state,
        rationales: {
          ...state.rationales,
          [crossing_id]: {
            rationale_id: prev?.rationale_id || rationale_id,
            crossing_id,
            content: prev?.content ?? '',
            status: 'retracted',
            final_score,
            retraction_reason: reason,
            completed_at: envelope.ts,
          },
        },
      };
    }
    case 'lead_position': {
      // Wake-on-rationale_verified (Appendix A §A.4): a position is only ever
      // spent on a grounded draft. The store NEVER surfaces a position for a
      // crossing whose rationale is not verified (e.g. retracted) — the guard
      // lives here so replay and live both honor it. Invariant: ≤2 positions
      // per crossing (one compliance, one risk); a duplicate lead is ignored.
      const pos = envelope.payload;
      const rationale = state.rationales[pos.crossing_id];
      if (rationale?.status !== 'verified') return state;
      const existing = state.leadPositions[pos.crossing_id] ?? [];
      if (existing.some((p) => p.lead === pos.lead)) return state;
      return {
        ...state,
        leadPositions: {
          ...state.leadPositions,
          [pos.crossing_id]: [...existing, pos],
        },
      };
    }
    case 'auditor_finding': {
      // Append-only audit stream, keyed by crossing_id. Both the deterministic
      // grounding pass (target: 'rationale') and the advisory LLM challenge
      // (target: 'lead_position') are recorded; advisory findings flag, never
      // block (the NLI retraction rides its own `rationale_retracted` envelope).
      const finding = envelope.payload;
      const existing = state.auditorFindings[finding.crossing_id] ?? [];
      return {
        ...state,
        auditorFindings: {
          ...state.auditorFindings,
          [finding.crossing_id]: [...existing, finding],
        },
      };
    }
    case 'error':
      return { ...state, connection: 'error' };
    default:
      return assertNever(envelope);
  }
}

export const useSessionStore = create<SessionStoreState>((set, get) => ({
  sessions: {},

  openSession: (intentId, intent) =>
    set((s) => ({
      sessions: {
        ...s.sessions,
        [intentId]: initialSessionState(intent),
      },
    })),

  closeSession: (intentId) =>
    set((s) => {
      const next = { ...s.sessions };
      delete next[intentId];
      return { sessions: next };
    }),

  setConnection: (intentId, connection) =>
    set((s) => {
      const session = s.sessions[intentId];
      if (!session) return s;
      return {
        sessions: {
          ...s.sessions,
          [intentId]: { ...session, connection },
        },
      };
    }),

  setLastError: (intentId, error) =>
    set((s) => {
      const session = s.sessions[intentId];
      if (!session) return s;
      return {
        sessions: {
          ...s.sessions,
          [intentId]: { ...session, lastError: error },
        },
      };
    }),

  applyEnvelope: (intentId, envelope) => {
    const session = get().sessions[intentId];
    if (!session) return { gap: false };

    const gap = envelope.seq > session.lastSeq + 1 && session.lastSeq !== 0;
    const reduced = reduce(session, envelope);
    const next: SessionState = {
      ...reduced,
      lastSeq: envelope.seq,
      connection: gap ? 'error' : reduced.connection === 'connecting' ? 'open' : reduced.connection,
    };

    set((s) => ({
      sessions: { ...s.sessions, [intentId]: next },
    }));

    return { gap };
  },

  replayAuditEnvelopes: (intentId, envelopes) => {
    const session = get().sessions[intentId];
    if (!session) return;

    let working: SessionState = {
      ...session,
      currentVerdict: 'compliant',
      latestSnapshot: null,
      crossings: [],
      rationales: {},
      leadPositions: {},
      auditorFindings: {},
      lastSeq: 0,
      connection: 'open',
      lastError: null,
    };
    for (const envelope of envelopes) {
      working = { ...reduce(working, envelope), lastSeq: envelope.seq };
    }
    working = { ...working, connection: 'open' };

    set((s) => ({
      sessions: { ...s.sessions, [intentId]: working },
    }));
  },
}));
