import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the cross-border app.
 *
 * Targets:
 *   1. Local dev — `npm run dev:all` (Vite + mock-ws on :8787).
 *   2. Vercel preview deploys — URL injected via `PLAYWRIGHT_BASE_URL` env var
 *      from the CI workflow (see .github/workflows/playwright-preview.yml).
 */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';

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
