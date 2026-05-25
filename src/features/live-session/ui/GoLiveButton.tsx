import { useNavigate } from 'react-router-dom';
import { useNavigationStore } from '@features/navigation/model/store';
import { useSessionStore } from '../store';
import { intentFromForm } from '../intentFromForm';
import { Button } from '@shared/ui';

function generateIntentId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `intent-${Date.now()}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

async function postIntent(intent: ReturnType<typeof intentFromForm>): Promise<void> {
  const base = import.meta.env.VITE_WS_URL
    ? import.meta.env.VITE_WS_URL.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:')
    : 'http://localhost:8787';
  try {
    await fetch(`${base}/intent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(intent),
    });
  } catch {
    // The mock-ws server may not be running in demo-only mode — proceed regardless.
  }
}

export function GoLiveButton() {
  const navigate = useNavigate();
  const form = useNavigationStore();
  const openSession = useSessionStore((s) => s.openSession);

  const handleClick = async () => {
    const intentId = generateIntentId();
    const intent = intentFromForm(intentId, {
      issuerJurisdiction: form.issuerJurisdiction,
      targetJurisdictions: form.targetJurisdictions,
      instrumentType: form.instrumentType,
      investorTypes: form.investorTypes,
      amount: form.amount,
    });
    openSession(intentId, intent);
    await postIntent(intent);
    navigate(`/live/${intentId}`);
  };

  return (
    <Button variant="primary" onClick={handleClick}>
      Go Live →
    </Button>
  );
}
