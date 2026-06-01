/**
 * LeftRail Component
 * Contains the ScenarioBuilder form for configuring compliance scenarios
 * and Credit Deal input mode
 */

import { useState } from 'react';
import { usePanelState } from '@/hooks';
import { useNavigationStore, ScenarioBuilder } from '@features/navigation';
import { Badge, Button } from '@shared/ui';
import { LeftRailArea } from './CanvasLayout';
import { PanelHeader } from '@shared/ui';
import { JURISDICTIONS } from '@entities/jurisdiction/model';
import { cn } from '@shared/lib';

type RailMode = 'regulatory' | 'credit';

const INDUSTRIES = ['Technology', 'Manufacturing', 'Energy', 'Healthcare', 'Financial Services', 'Logistics', 'Real Estate'];
const BORROWER_TYPES = ['Corporation', 'LLC', 'Partnership', 'Sole Proprietor', 'Non-Profit'];

export function LeftRail() {
  const { panels, togglePanel } = usePanelState();
  const store = useNavigationStore();
  const [mode, setMode] = useState<RailMode>('regulatory');

  // Credit form state
  const [borrowerName, setBorrowerName] = useState('');
  const [dealAmount, setDealAmount] = useState<number>(0);
  const [industry, setIndustry] = useState('');
  const [borrowerType, setBorrowerType] = useState('');

  const isExpanded = panels.leftRail === 'expanded';

  // Build summary for collapsed state
  const targetFlags = store.targetJurisdictions
    .map((code) => JURISDICTIONS[code]?.flag || code)
    .join(' ');

  const summary = mode === 'regulatory'
    ? `${JURISDICTIONS[store.issuerJurisdiction]?.flag || store.issuerJurisdiction} → ${targetFlags || 'No targets'}`
    : borrowerName || 'Credit Deal';

  return (
    <LeftRailArea>
      <PanelHeader
        title="Scenario"
        isExpanded={isExpanded}
        onToggle={() => togglePanel('leftRail')}
        summary={summary}
        badge={
          mode === 'regulatory' && store.targetJurisdictions.length > 0 ? (
            <Badge variant="info" size="sm">
              {store.targetJurisdictions.length} targets
            </Badge>
          ) : mode === 'credit' ? (
            <Badge variant="warning" size="sm">Credit</Badge>
          ) : undefined
        }
      />

      {/* Mode toggle */}
      {isExpanded && (
        <div className="flex gap-1 px-4 pb-3">
          {(['regulatory', 'credit'] as RailMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'flex-1 rounded-lg px-3 py-1.5 text-sm capitalize transition-colors',
                mode === m
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              )}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {mode === 'regulatory' ? (
        <ScenarioBuilder className="flex-1 overflow-hidden" />
      ) : (
        isExpanded && (
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-slate-300">Borrower Name</label>
                <input
                  type="text"
                  value={borrowerName}
                  onChange={(e) => setBorrowerName(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  placeholder="e.g. Meridian Capital Partners"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-300">Deal Amount (USD)</label>
                <input
                  type="number"
                  value={dealAmount || ''}
                  onChange={(e) => setDealAmount(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  placeholder="5000000"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-300">Industry</label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="">Select industry...</option>
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-300">Borrower Type</label>
                <select
                  value={borrowerType}
                  onChange={(e) => setBorrowerType(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="">Select type...</option>
                  {BORROWER_TYPES.map((bt) => (
                    <option key={bt} value={bt}>{bt}</option>
                  ))}
                </select>
              </div>
              <Button
                variant="primary"
                className="w-full"
                disabled={!borrowerName || !dealAmount || !industry}
              >
                Run Credit Analysis
              </Button>
            </div>
          </div>
        )
      )}
    </LeftRailArea>
  );
}
