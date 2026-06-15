'use client';

import dynamic from 'next/dynamic';

// ssr:false MUST live in a Client Component — Next 15 rejects it in a Server
// Component. The SPA is a react-router app under a BrowserRouter, which depends
// on the browser History API, so it is client-only. ../../src/app/SpaRoot wraps
// <BrowserRouter> around src/app/App.tsx.
const SpaRoot = dynamic(() => import('@app/SpaRoot'), { ssr: false });

export function Client() {
  return <SpaRoot />;
}
