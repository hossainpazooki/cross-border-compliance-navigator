import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  ThresholdCrossing,
  TradeSnapshot,
  WSEnvelope,
} from '@platform/contracts';

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

function buildMicaThresholdCrossing(): Frame[] {
  const b = new Builder();

  let price = 3500;
  for (let i = 0; i < 3; i++) {
    price += 10;
    b.emit(500, (seq, ts) => ({
      seq,
      ts,
      type: 'tick',
      payload: snapshot(ts, price, 0.65, 4.5, 950_000 + i * 25_000),
    }));
  }

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
      'crossing-mica-1',
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
    'Trade notional of €1.05M exceeds MiCA Article 5(1) reserve-asset threshold of €1M for stablecoin offerings to the public in the European Union. The issuer must publish a crypto-asset white paper and notify the competent authority before any further offering above this size.';

  const tokens = tokenize(rationale);
  tokens.forEach((tok, i) => {
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
    void i;
  });

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
