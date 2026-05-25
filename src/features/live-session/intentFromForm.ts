import type { TradeIntent } from '@platform/contracts';

type InvestorType = 'retail' | 'professional' | 'eligible_counterparty';

interface NavigationFormSnapshot {
  issuerJurisdiction: string;
  targetJurisdictions: string[];
  instrumentType: string;
  investorTypes: string[];
  amount: number;
}

const INVESTOR_PRIORITY: InvestorType[] = [
  'eligible_counterparty',
  'professional',
  'retail',
];

function pickInvestorType(types: string[]): InvestorType {
  for (const candidate of INVESTOR_PRIORITY) {
    if (types.includes(candidate)) return candidate;
  }
  return 'professional';
}

function pickAsset(instrumentType: string): string {
  if (instrumentType.toLowerCase().includes('stablecoin')) return 'USDT';
  return 'ETHUSDT';
}

export function intentFromForm(
  intentId: string,
  form: NavigationFormSnapshot
): TradeIntent {
  return {
    intent_id: intentId,
    direction: 'buy',
    asset: pickAsset(form.instrumentType),
    notional_usd: String(form.amount),
    venue_jurisdiction: form.issuerJurisdiction,
    investor_type: pickInvestorType(form.investorTypes),
    target_jurisdictions: form.targetJurisdictions,
    holding_period_days: 1,
  };
}
