// Same-origin WS + REST proxy to EKS ALB (unified-plan decision 5 — Option A).
// Browser sees `dev.hossainpazooki.com` for everything; Vercel edge rewrites
// `/v2/ws/*` and `/api/*` over to the EKS ALB. No CORS trip on production paths.
//
// This config takes effect once Phase C1 (Vite → Next 15 migration) lands. Until
// then `vercel.json` and `vite.config.ts` are the active build configuration.
// Migration record + full proxied-path table: docs/unified-plan.md (decision 5 — Option A).
// NOTE: EKS_ALB_HOST below still points at the pre-rename backend ALB; repoint it at the
// `regulatory-rule-engine` ALB when the migration lands.

const EKS_ALB_HOST =
  process.env.EKS_ALB_HOST ||
  'k8s-institut-institut-f9519fdd99-938355378.us-east-1.elb.amazonaws.com';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {},
  async rewrites() {
    return [
      {
        source: '/v2/ws/:path*',
        destination: `https://${EKS_ALB_HOST}/v2/ws/:path*`,
      },
      {
        source: '/v2/:path*',
        destination: `https://${EKS_ALB_HOST}/v2/:path*`,
      },
      {
        source: '/api/:path*',
        destination: `https://${EKS_ALB_HOST}/api/:path*`,
      },
      {
        source: '/audit/:path*',
        destination: `https://${EKS_ALB_HOST}/audit/:path*`,
      },
      {
        source: '/decide/:path*',
        destination: `https://${EKS_ALB_HOST}/decide/:path*`,
      },
      {
        source: '/credit/:path*',
        destination: `https://${EKS_ALB_HOST}/credit/:path*`,
      },
    ];
  },
};

export default nextConfig;
