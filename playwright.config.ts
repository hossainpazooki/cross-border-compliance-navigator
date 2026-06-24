import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the cross-border app.
 *
 * Targets:
 *   1. Local dev — `npm run dev:all` (Vite + reference backend on :8787).
 *   2. Vercel preview deploys — URL injected via `PLAYWRIGHT_BASE_URL` env var
 *      from the CI workflow (see .github/workflows/playwright-preview.yml).
 */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';

// Vercel Deployment Protection: a protected preview serves a "Log in to Vercel"
// wall to unauthenticated clients, so every navigation lands on Vercel's login
// page instead of the app. When the project's "Protection Bypass for Automation"
// secret is provided, send it on every request (+ set the bypass cookie so
// sub-resource / stream requests carry it too). Unset (local `dev:all`) => no
// header, no effect. Set VERCEL_AUTOMATION_BYPASS_SECRET in CI (GitHub secret) and
// enable Protection Bypass for Automation in the Vercel project.
const BYPASS_SECRET = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const bypassHeaders = BYPASS_SECRET
  ? {
      'x-vercel-protection-bypass': BYPASS_SECRET,
      'x-vercel-set-bypass-cookie': 'true',
    }
  : undefined;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html']] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    ...(bypassHeaders ? { extraHTTPHeaders: bypassHeaders } : {}),
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // No webServer block — we expect the caller (dev session or CI) to have a
  // server running at PLAYWRIGHT_BASE_URL already. Local dev: `npm run dev:all`.
});
