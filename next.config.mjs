// COMPASS Next 15 build configuration (Phase C1 — Vite → Next cutover).
//
// REST/audit/health are proxied to the backend ONLY when BACKEND_ORIGIN is set,
// via `beforeFiles` so the proxy can override route handlers (a plain array is
// `afterFiles` and would NEVER override handlers). NOTE: rewrites() is evaluated
// at build time, so on Vercel BACKEND_ORIGIN is bound at build, not per-request.
// There is intentionally NO WebSocket rewrite — the WS endpoint is reached
// directly via NEXT_PUBLIC_WS_BASE_URL, never proxied through Next.

// Build-time assert (node-only; never shipped to the browser bundle): if live
// ATLAS verification is switched on, the registry URL MUST be set — otherwise the
// only available path is the still-blocked in-browser WASM seam, which would make
// every pack read as blocked. Fail the build loudly rather than ship a silently
// dead-verify deployment. Mirrors src/shared/config/env.ts assertVerifyConfig()
// (the runtime still fails CLOSED with a clear message if this is bypassed).
if (
  process.env.NEXT_PUBLIC_USE_WASM_VERIFY === 'true' &&
  !process.env.NEXT_PUBLIC_ATLAS_REGISTRY_URL
) {
  throw new Error(
    'NEXT_PUBLIC_USE_WASM_VERIFY=true requires NEXT_PUBLIC_ATLAS_REGISTRY_URL ' +
      '(the ke-cli serve base URL). Unset it to keep snapshot mode, or point it at a registry.',
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@platform/contracts',
    '@platform/engine',
    '@platform/reference-backend',
  ],
  async rewrites() {
    const backendOrigin = process.env.BACKEND_ORIGIN;
    if (!backendOrigin) {
      return { beforeFiles: [] };
    }
    return {
      beforeFiles: [
        { source: '/v2/:path*', destination: `${backendOrigin}/v2/:path*` },
        { source: '/audit/:path*', destination: `${backendOrigin}/audit/:path*` },
        { source: '/health', destination: `${backendOrigin}/health` },
      ],
    };
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ];
  },
};

export default nextConfig;
