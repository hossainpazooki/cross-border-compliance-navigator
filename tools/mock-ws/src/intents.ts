import type { TradeIntent } from '@platform/contracts';

const store = new Map<string, TradeIntent>();

export function putIntent(intent: TradeIntent): void {
  store.set(intent.intent_id, intent);
}

export function getIntent(intentId: string): TradeIntent | undefined {
  return store.get(intentId);
}
