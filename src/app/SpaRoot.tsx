'use client';

import { BrowserRouter } from 'react-router-dom';
import App from '@app/App';

/**
 * Client-only SPA root. Mounts <BrowserRouter> around the react-router App.
 * Loaded via `next/dynamic(..., { ssr: false })` from
 * app/[[...slug]]/client.tsx so the browser-History-dependent router never runs
 * during SSR. Replaces the former src/main.tsx mount.
 */
export default function SpaRoot() {
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}
