import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  ThresholdCrossing,
  TradeSnapshot,
  WSEnvelope,
} from '@platform/contracts';
import {
  evaluateAtReserve,
  findReserveBoundary,
  formatCitation,
  isGrounded,
} from './scenario.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'fixtures');

const INTENT_ID = 'fixture-intent';
const START_TS = new Date('2026-05-15T10:00:00.000Z').getTime();

type Frame = { delay_ms: number; envelope: WSEnvelope };

class Builder {
  private seq = 0;
  private elapsed = 0;
  private frames: Frame[] = [];

  emit(delayMs: number, fn: (seq: number, ts: string) => WSEnvelope): void {
    this.elapsed += delayMs;
    this.seq += 1;
    const ts = new Date(START_TS + this.elapsed).toISOString();
    this.frames.push({ delay_ms: delayMs, envelope: fn(this.seq, ts) });
  }

  build(): Frame[] {
    return this.frames;
  }
}

function snapshot(
  ts: string,
  markPrice: number,
  vol30d: number,
  slippageBps: number,
  notionalUsd: number
): TradeSnapshot {
  const size = notionalUsd / markPrice;
  return {
    intent_id: INTENT_ID,
    ts,
    mark_price: markPrice.toFixed(2),
    bid: (markPrice - 0.5).toFixed(2),
    ask: (markPrice + 0.5).toFixed(2),
    size: size.toFixed(6),
    spread_bps: 2.85,
    slippage_bps: slippageBps,
    vol_30d: vol30d,
    var_95_usd: notionalUsd * vol30d * 1.645 * Math.sqrt(1 / 365),
    funding_rate: 0.0001,
  };
}

function crossing(
  id: string,
  ts: string,
  snap: TradeSnapshot,
  boundary: number,
  direction: 'crossed_up' | 'crossed_down',
  ruleId: string,
  citation: string,
  prior: ThresholdCrossing['prior_verdict'],
  next: ThresholdCrossing['new_verdict']
): ThresholdCrossing {
  return {
    crossing_id: id,
    intent_id: INTENT_ID,
    ts,
    rule_id: ruleId,
    citation,
    boundary: boundary.toString(),
    direction,
    snapshot: snap,
    prior_verdict: prior,
    new_verdict: next,
  };
}

function tokenize(text: string): string[] {
  return text.match(/\S+\s*|\s+/g) ?? [text];
}

/**
 * Engine-driven scenario: an EMT issuer's reserve assets grow through the
 * significant-EMT boundary that the real MiCA rule tree encodes. Verdicts,
 * citations, and obligations all come from `evaluateTree` over
 * `@platform/engine`'s bundled rule data — and the build FAILS if a cited
 * reference is not grounded in the actual evaluation trace (the same check
 * the auditor's deterministic pass performs at runtime).
 */
function buildMicaThresholdCrossing(): Frame[] {
  const b = new Builder();

  const boundary = findReserveBoundary();
  const prior = evaluateAtReserve(boundary.value - 250_000);
  const next = evaluateAtReserve(boundary.value + 750_000);

  if (prior.result.leaf.nodeId === next.result.leaf.nodeId) {
    throw new Error('scenario does not cross a leaf boundary; fixture would be meaningless');
  }

  const boundaryCitation = formatCitation(boundary.sourceRef);
  for (const [label, citation, evaluation] of [
    ['boundary', boundaryCitation, next],
    ['leaf', next.citation, next],
  ] as const) {
    if (!isGrounded(citation, evaluation.result)) {
      throw new Error(`${label} citation "${citation}" is not grounded in the evaluation trace`);
    }
  }

  // Reserve approaches the boundary; each tick is a ~€1M trade adding to it.
  const reserves = [
    boundary.value - 1_500_000,
    boundary.value - 900_000,
    boundary.value - 250_000,
  ];
  let price = 3500;
  reserves.forEach((_, i) => {
    price += 10;
    b.emit(500, (seq, ts) => ({
      seq,
      ts,
      type: 'tick',
      payload: snapshot(ts, price, 0.65, 4.5, 950_000 + i * 25_000),
    }));
  });

  const crossingSnap = snapshot(
    new Date(START_TS + 2_500).toISOString(),
    3540,
    0.68,
    5.2,
    1_050_000
  );

  b.emit(500, (seq, ts) => ({
    seq,
    ts,
    type: 'compliance',
    payload: {
      crossing_id: 'crossing-mica-1',
      prior_verdict: prior.verdict,
      new_verdict: next.verdict,
      citation: boundaryCitation,
    },
  }));

  b.emit(50, (seq, ts) => ({
    seq,
    ts,
    type: 'threshold',
    payload: crossing(
      'crossing-mica-1',
      ts,
      crossingSnap,
      boundary.value,
      'crossed_up',
      boundary.ruleId,
      boundaryCitation,
      prior.verdict,
      next.verdict
    ),
  }));

  const escalated = next.obligations.filter((o) => !prior.obligations.includes(o));
  const rationale =
    `Issuer reserve assets now exceed the EUR ${(boundary.value / 1e9).toFixed(0)}B ` +
    `significance threshold (${boundaryCitation}). The e-money token is reclassified ` +
    `from "${prior.result.leaf.decision}" to "${next.result.leaf.decision}" (${next.citation}). ` +
    `The obligation set escalates to: ${escalated.join(', ')}.`;

  const tokens = tokenize(rationale);
  tokens.forEach((tok) => {
    b.emit(80, (seq, ts) => ({
      seq,
      ts,
      type: 'rationale_tok',
      payload: {
        rationale_id: 'rationale-mica-1',
        crossing_id: 'crossing-mica-1',
        token: tok,
      },
    }));
  });

  // NLI scoring stays canned in the reference backend; the grounding gate
  // above is the deterministic part and it actually ran.
  b.emit(300, (seq, ts) => ({
    seq,
    ts,
    type: 'rationale_verified',
    payload: {
      rationale_id: 'rationale-mica-1',
      crossing_id: 'crossing-mica-1',
      final_score: 0.84,
    },
  }));

  // Agent-org frames emitted AFTER rationale_verified (leads wake on verified):
  // the compliance lead orchestrates; the risk lead consumes and adds its
  // position. Then the auditor's findings.
  b.emit(200, (seq, ts) => ({
    seq,
    ts,
    type: 'lead_position',
    payload: {
      crossing_id: 'crossing-mica-1',
      lead: 'compliance',
      stance: 'cumulative',
      basis: `Obligations escalate under ${next.citation}: ${escalated.join(', ')}.`,
    },
  }));

  b.emit(120, (seq, ts) => ({
    seq,
    ts,
    type: 'lead_position',
    payload: {
      crossing_id: 'crossing-mica-1',
      lead: 'risk',
      stance: 'hold',
      basis: `VaR $${Math.round(crossingSnap.var_95_usd).toLocaleString('en-US')} within limit at this notional; no escalation required.`,
    },
  }));

  b.emit(150, (seq, ts) => ({
    seq,
    ts,
    type: 'auditor_finding',
    payload: {
      crossing_id: 'crossing-mica-1',
      target: 'rationale',
      verdict: 'pass',
      basis: `All cited references (${boundaryCitation}; ${next.citation}) present in the evaluateTree trace.`,
    },
  }));

  b.emit(100, (seq, ts) => ({
    seq,
    ts,
    type: 'auditor_finding',
    payload: {
      crossing_id: 'crossing-mica-1',
      target: 'lead_position',
      verdict: 'advisory',
      basis: 'EBA supervision transfer may also implicate the recovery-plan timeline; flag for board.',
    },
  }));

  return b.build();
}

function buildRetraction(): Frame[] {
  const b = new Builder();

  for (let i = 0; i < 2; i++) {
    b.emit(500, (seq, ts) => ({
      seq,
      ts,
      type: 'tick',
      payload: snapshot(ts, 3500 + i * 20, 0.7, 6, 980_000 + i * 30_000),
    }));
  }

  const crossingSnap = snapshot(
    new Date(START_TS + 1_000).toISOString(),
    3540,
    0.72,
    6.5,
    1_010_000
  );

  b.emit(400, (seq, ts) => ({
    seq,
    ts,
    type: 'compliance',
    payload: {
      crossing_id: 'crossing-retract-1',
      prior_verdict: 'compliant',
      new_verdict: 'conditional',
      citation: 'MiCA Art. 5(1)',
    },
  }));

  b.emit(50, (seq, ts) => ({
    seq,
    ts,
    type: 'threshold',
    payload: crossing(
      'crossing-retract-1',
      ts,
      crossingSnap,
      1_000_000,
      'crossed_up',
      'MICA_ART_5_1',
      'MiCA Art. 5(1)',
      'compliant',
      'conditional'
    ),
  }));

  const rationale =
    'The transaction notional, although near the €1M MiCA boundary, sits comfortably below the reporting threshold of €10M for retail public offerings, so no white-paper obligation applies.';
  const tokens = tokenize(rationale);
  tokens.forEach((tok) => {
    b.emit(60, (seq, ts) => ({
      seq,
      ts,
      type: 'rationale_tok',
      payload: {
        rationale_id: 'rationale-retract-1',
        crossing_id: 'crossing-retract-1',
        token: tok,
      },
    }));
  });

  b.emit(200, (seq, ts) => ({
    seq,
    ts,
    type: 'rationale_retracted',
    payload: {
      rationale_id: 'rationale-retract-1',
      crossing_id: 'crossing-retract-1',
      final_score: 0.42,
      reason: 'rationale claims the wrong threshold; NLI entailment failed',
    },
  }));

  return b.build();
}

function buildMultiCrossing(): Frame[] {
  const b = new Builder();

  type Verdict = 'compliant' | 'conditional' | 'blocked';
  const crossings: Array<{
    id: string;
    rule: string;
    cite: string;
    prior: Verdict;
    next: Verdict;
    boundary: number;
    notional: number;
    rationale: string;
    verified: boolean;
  }> = [
    {
      id: 'm1',
      rule: 'MICA_ART_5_1',
      cite: 'MiCA Art. 5(1)',
      prior: 'compliant',
      next: 'conditional',
      boundary: 1_000_000,
      notional: 1_010_000,
      rationale: 'Trade size crossed €1M MiCA stablecoin offering boundary.',
      verified: true,
    },
    {
      id: 'm2',
      rule: 'FCA_RP_3_2',
      cite: 'FCA RP §3.2',
      prior: 'conditional',
      next: 'conditional',
      boundary: 2_000_000,
      notional: 2_020_000,
      rationale: 'Notional now requires UK FCA promotion registration for retail.',
      verified: true,
    },
    {
      id: 'm3',
      rule: 'MICA_ART_5_2',
      cite: 'MiCA Art. 5(2)',
      prior: 'conditional',
      next: 'blocked',
      boundary: 5_000_000,
      notional: 5_050_000,
      rationale: 'Crossed €5M cap — public offering blocked pending authorization.',
      verified: false,
    },
    {
      id: 'm4',
      rule: 'SEC_REG_D',
      cite: 'Reg D 506(b)',
      prior: 'blocked',
      next: 'blocked',
      boundary: 5_000_000,
      notional: 5_100_000,
      rationale: 'US Reg D limits to accredited investors at this notional.',
      verified: true,
    },
    {
      id: 'm5',
      rule: 'MICA_ART_5_1',
      cite: 'MiCA Art. 5(1)',
      prior: 'blocked',
      next: 'conditional',
      boundary: 1_000_000,
      notional: 990_000,
      rationale: 'Mark price dropped — size now below MiCA primary boundary.',
      verified: true,
    },
  ];

  for (const c of crossings) {
    for (let i = 0; i < 2; i++) {
      b.emit(400, (seq, ts) => ({
        seq,
        ts,
        type: 'tick',
        payload: snapshot(ts, 3500 + i * 5, 0.6, 4, c.notional - 10_000),
      }));
    }

    const snap = snapshot(
      new Date(START_TS + 800).toISOString(),
      3540,
      0.62,
      5,
      c.notional
    );

    b.emit(200, (seq, ts) => ({
      seq,
      ts,
      type: 'compliance',
      payload: {
        crossing_id: `crossing-${c.id}`,
        prior_verdict: c.prior,
        new_verdict: c.next,
        citation: c.cite,
      },
    }));

    b.emit(50, (seq, ts) => ({
      seq,
      ts,
      type: 'threshold',
      payload: crossing(
        `crossing-${c.id}`,
        ts,
        snap,
        c.boundary,
        c.notional >= c.boundary ? 'crossed_up' : 'crossed_down',
        c.rule,
        c.cite,
        c.prior,
        c.next
      ),
    }));

    const tokens = tokenize(c.rationale);
    for (const tok of tokens) {
      b.emit(40, (seq, ts) => ({
        seq,
        ts,
        type: 'rationale_tok',
        payload: {
          rationale_id: `rationale-${c.id}`,
          crossing_id: `crossing-${c.id}`,
          token: tok,
        },
      }));
    }

    if (c.verified) {
      b.emit(150, (seq, ts) => ({
        seq,
        ts,
        type: 'rationale_verified',
        payload: {
          rationale_id: `rationale-${c.id}`,
          crossing_id: `crossing-${c.id}`,
          final_score: 0.82,
        },
      }));

      // All multi-crossing rules are compliance-type, so the compliance lead
      // orchestrates each verified crossing. Emitted strictly AFTER verified.
      b.emit(120, (seq, ts) => ({
        seq,
        ts,
        type: 'lead_position',
        payload: {
          crossing_id: `crossing-${c.id}`,
          lead: 'compliance',
          stance: 'cumulative',
          basis: `Synthesized obligation set for ${c.cite}; cumulative across implicated jurisdictions.`,
        },
      }));

      // The risk lead consumes and adds a position on the most material
      // verified crossing (m4 is blocked at the €5M cap).
      if (c.id === 'm4') {
        b.emit(80, (seq, ts) => ({
          seq,
          ts,
          type: 'lead_position',
          payload: {
            crossing_id: `crossing-${c.id}`,
            lead: 'risk',
            stance: 'escalate',
            basis: 'Blocked verdict at the €5M cap — escalate to board for sign-off.',
          },
        }));
      }

      // Auditor: a deterministic grounding pass on m1, an advisory challenge on m2.
      if (c.id === 'm1') {
        b.emit(90, (seq, ts) => ({
          seq,
          ts,
          type: 'auditor_finding',
          payload: {
            crossing_id: `crossing-${c.id}`,
            target: 'rationale',
            verdict: 'pass',
            basis: 'All cited sourceRefs present in the evaluateTree trace.',
          },
        }));
      } else if (c.id === 'm2') {
        b.emit(90, (seq, ts) => ({
          seq,
          ts,
          type: 'auditor_finding',
          payload: {
            crossing_id: `crossing-${c.id}`,
            target: 'lead_position',
            verdict: 'advisory',
            basis: 'FCA promotion registration may also implicate Art. 5(2) — flag for board.',
          },
        }));
      }
    } else {
      b.emit(150, (seq, ts) => ({
        seq,
        ts,
        type: 'rationale_retracted',
        payload: {
          rationale_id: `rationale-${c.id}`,
          crossing_id: `crossing-${c.id}`,
          final_score: 0.45,
          reason: 'rationale failed NLI verification',
        },
      }));
    }
  }

  return b.build();
}

async function main(): Promise<void> {
  const fixtures: Record<string, Frame[]> = {
    'mica-threshold-crossing': buildMicaThresholdCrossing(),
    retraction: buildRetraction(),
    'multi-crossing': buildMultiCrossing(),
  };
  for (const [name, frames] of Object.entries(fixtures)) {
    const file = path.join(OUT_DIR, `${name}.json`);
    await writeFile(file, JSON.stringify(frames, null, 2));
    console.log(`wrote ${file} (${frames.length} frames)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
