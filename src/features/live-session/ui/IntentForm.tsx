import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@shared/ui';
import { JURISDICTION_LIST } from '@entities/jurisdiction/model';
import type {
  IntentCreateRequest,
  IntentDirection,
  InvestorType,
} from '@platform/contracts';
import { createIntent, IntentApiError } from '../api/intentsApi';
import { useSessionStore } from '../store';

const INVESTOR_TYPES: { value: InvestorType; label: string }[] = [
  { value: 'retail', label: 'Retail' },
  { value: 'professional', label: 'Professional' },
  { value: 'eligible_counterparty', label: 'Eligible counterparty' },
];

const DIRECTIONS: { value: IntentDirection; label: string }[] = [
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
];

export function IntentForm() {
  const navigate = useNavigate();
  const openSession = useSessionStore((s) => s.openSession);

  const [asset, setAsset] = useState('ETHUSDT');
  const [direction, setDirection] = useState<IntentDirection>('buy');
  const [notionalUsd, setNotionalUsd] = useState('100000');
  const [venue, setVenue] = useState('EU');
  const [investorType, setInvestorType] = useState<InvestorType>('professional');
  const [targets, setTargets] = useState<string[]>(['EU']);
  const [holdingPeriod, setHoldingPeriod] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTarget = (code: string) => {
    setTargets((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const payload: IntentCreateRequest = {
      asset,
      direction,
      notional_usd: notionalUsd,
      venue_jurisdiction: venue,
      investor_type: investorType,
      target_jurisdictions: targets,
      holding_period_days: holdingPeriod,
    };

    try {
      const record = await createIntent(payload);
      openSession(record.intent_id, { ...payload, intent_id: record.intent_id });
      navigate(`/live/${record.intent_id}`);
    } catch (err) {
      const detail =
        err instanceof IntentApiError
          ? `${err.status}: ${typeof err.body === 'object' ? JSON.stringify(err.body) : String(err.body ?? err.message)}`
          : err instanceof Error
            ? err.message
            : 'unknown error';
      setError(`Couldn't create intent — ${detail}`);
      setSubmitting(false);
    }
  };

  const disabled =
    submitting ||
    !asset ||
    !notionalUsd ||
    targets.length === 0 ||
    holdingPeriod < 1;

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-2xl space-y-5 rounded-lg border border-slate-800 bg-slate-900 p-6"
    >
      <header>
        <h1 className="text-xl font-semibold text-white">New live trading intent</h1>
        <p className="mt-1 text-sm text-slate-400">
          Submits to <code className="text-slate-300">POST /v2/intents</code> and opens a
          live audit stream once the server returns an intent id.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm text-slate-300">Asset</label>
          <input
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            placeholder="ETHUSDT"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-300">Direction</label>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as IntentDirection)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            {DIRECTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-300">
            Notional (USD, decimal string)
          </label>
          <input
            value={notionalUsd}
            onChange={(e) => setNotionalUsd(e.target.value)}
            inputMode="decimal"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            placeholder="100000"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-300">
            Holding period (days)
          </label>
          <input
            type="number"
            min={1}
            value={holdingPeriod}
            onChange={(e) => setHoldingPeriod(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-300">Venue jurisdiction</label>
          <select
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            {JURISDICTION_LIST.map((j) => (
              <option key={j.code} value={j.code}>
                {j.flag} {j.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-300">Investor type</label>
          <select
            value={investorType}
            onChange={(e) => setInvestorType(e.target.value as InvestorType)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            {INVESTOR_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm text-slate-300">Target jurisdictions</label>
        <div className="flex flex-wrap gap-2">
          {JURISDICTION_LIST.map((j) => {
            const on = targets.includes(j.code);
            return (
              <button
                key={j.code}
                type="button"
                onClick={() => toggleTarget(j.code)}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  on
                    ? 'border-blue-500 bg-blue-500/15 text-white'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                }`}
              >
                {j.flag} {j.code}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={disabled}>
          {submitting ? 'Creating intent…' : 'Go Live →'}
        </Button>
      </div>
    </form>
  );
}

export default IntentForm;
