import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Phase H1 spec — `/live/:intentId` live session page.
 *
 * Asserts:
 *   - Page mounts within 3s (Vercel cold-start tolerance).
 *   - WebSocket connection establishes within 10s.
 *   - A synthetic threshold envelope (from the mock-ws fixture replay or
 *     real backend) renders a ThresholdCard within 30s.
 *   - No axe violations on the rendered page.
 *
 * Run locally:
 *   npm run dev:all   # starts mock-ws on :8787 + Vite on :5173
 *   npx playwright test
 *
 * Run against Vercel preview:
 *   PLAYWRIGHT_BASE_URL=https://<preview>.vercel.app npx playwright test
 */

const TEST_INTENT_ID = '00000000-0000-0000-0000-000000000001';

test('live-session page mounts and renders a threshold card', async ({ page }) => {
  const mountStart = Date.now();
  await page.goto(`/live/${TEST_INTENT_ID}`);
  await expect(page.locator('main, [role="main"], body')).toBeVisible({ timeout: 3_000 });
  const mountMs = Date.now() - mountStart;
  expect(mountMs).toBeLessThan(3_000);

  // The session header (SessionHeader.tsx) is the first thing rendered once
  // the page reads the intent_id from the URL. If the route isn't wired, this
  // will surface the missing route as a visible failure.
  await expect(
    page.getByText(/live trading session|intent/i).first()
  ).toBeVisible({ timeout: 5_000 });
});

test('websocket connects within 10s', async ({ page }) => {
  const wsPromise = page.waitForEvent('websocket', { timeout: 10_000 });
  await page.goto(`/live/${TEST_INTENT_ID}`);
  const ws = await wsPromise;
  expect(ws.url()).toMatch(/(\/v2\/ws\/trade\/|intent_id=)/);
});

test('threshold card appears within 30s from mock-ws or live backend', async ({ page }) => {
  await page.goto(`/live/${TEST_INTENT_ID}`);
  // The mock-ws fixtures emit a threshold envelope ~3s into the replay; the
  // ThresholdCard component should render an article-shaped item per crossing.
  // Selector pattern matches a card-shaped element; tighten this to a data
  // attribute (e.g. data-testid="threshold-card") once added to the component.
  await expect(
    page.locator('[data-testid="threshold-card"], article').first()
  ).toBeVisible({ timeout: 30_000 });
});

test('live-session page has no axe a11y violations', async ({ page }) => {
  await page.goto(`/live/${TEST_INTENT_ID}`);
  // Wait for the page to settle before scanning.
  await page.waitForLoadState('networkidle', { timeout: 15_000 });
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
