import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '@shared/api';
import { PRODUCT } from '@shared/config';

export function Header() {
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';

  useEffect(() => {
    const checkBackend = async () => {
      try {
        // Use the health endpoint for connectivity check
        await apiClient.get('/health');
        setBackendStatus('connected');
      } catch {
        setBackendStatus('error');
      }
    };

    checkBackend();
  }, []);

  return (
    <header className="mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-500">
            <span className="text-xl font-bold text-white">{PRODUCT.monogram}</span>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">
              {PRODUCT.name}
            </h1>
            <p className="text-sm text-slate-400">
              {PRODUCT.shortTagline}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="rounded-lg bg-blue-500/20 px-4 py-2 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/30"
          >
            Decision Canvas
          </Link>
          {backendStatus === 'checking' && (
            <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-sm text-yellow-400">
              Checking Backend...
            </span>
          )}
          {backendStatus === 'connected' && (
            <span className="rounded-full bg-green-500/20 px-3 py-1 text-sm text-green-400">
              Connected to Backend
            </span>
          )}
          {backendStatus === 'error' && (
            <span className="rounded-full bg-red-500/20 px-3 py-1 text-sm text-red-400" title={apiUrl}>
              Backend Unavailable
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
