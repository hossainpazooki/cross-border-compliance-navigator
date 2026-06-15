/**
 * CanvasHeader Component
 * Compact header for the Decision Canvas layout (64px height)
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '@shared/api';
import { PRODUCT, DESKS } from '@shared/config';
import { Badge } from '@shared/ui';
import { useDeskStore, activeDesk, activeMember } from '@app/stores';

export function CanvasHeader() {
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const desk = useDeskStore(activeDesk);
  const member = useDeskStore(activeMember);
  const setActiveDesk = useDeskStore((s) => s.setActiveDesk);

  useEffect(() => {
    const checkBackend = async () => {
      try {
        await apiClient.get('/health');
        setBackendStatus('connected');
      } catch {
        setBackendStatus('error');
      }
    };

    checkBackend();
  }, []);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-700 bg-slate-900 px-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-500">
            <span className="text-sm font-bold text-white">{PRODUCT.monogram}</span>
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">
              {PRODUCT.name}
            </h1>
            <p className="text-xs text-slate-400">
              Decision Canvas
            </p>
          </div>
        </div>
        <div className="hidden md:block border-l border-slate-700 pl-4">
          <p className="text-sm text-slate-400">
            Cross-border DeFi regulatory compliance across EU, UK, US, CH, SG
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Desk context chip — always-visible org identity (demo identity).
            TODO(desk): mirror this into the live-session BoardBar once the
            Stage-3 + redesign change-sets are committed (deferred to keep this
            MVP a disjoint commit). */}
        <Link
          to="/desk"
          className="flex items-center gap-2 rounded-lg border border-slate-700 px-2.5 py-1 text-xs transition-colors hover:bg-slate-800"
          title="Desk home"
        >
          <span className="text-slate-200">{desk.name}</span>
          {member && <span className="text-slate-500">· {member.name}</span>}
        </Link>
        {DESKS.length > 1 && (
          <select
            aria-label="Switch desk"
            value={desk.id}
            onChange={(e) => setActiveDesk(e.target.value)}
            className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs text-slate-300"
          >
            {DESKS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}

        <Link
          to="/legacy"
          className="text-sm text-slate-400 transition-colors hover:text-white"
        >
          Legacy View
        </Link>

        {backendStatus === 'checking' && (
          <Badge variant="warning" size="sm">Checking...</Badge>
        )}
        {backendStatus === 'connected' && (
          <Badge variant="success" size="sm">Backend Connected</Badge>
        )}
        {backendStatus === 'error' && (
          <Badge variant="error" size="sm">Demo Mode</Badge>
        )}
      </div>
    </header>
  );
}
