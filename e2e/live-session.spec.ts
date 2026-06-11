import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Phase H1 spec — `/live/:intentId` live session page.
 *
 * The live-session workbench only mounts for an *open* session, and a session
 * is opened client-side by the `/live` intent form's "Go Live" handler
 * (IntentForm.tsx → openSession + navigate). Navigating straight to
 * `/live/:intentId` shows the "no active session" placeholder, so the
 * content-bearing tests drive the real form flow via {@link createLiveSession}.
 *
 * Run locally:
 *   VITE_API_URL=http://localhost:8787 npm run dev:all   # REST + WS on the reference backend
 *   npx playwright test
 *
 * Run against Vercel preview (needs a reachable REST origin for POST /v2/intents):
 *   PLAYWRIGHT_BASE_URL=https://<preview>.vercel.app npx playwright test
 */

const TEST_INTENT_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Drive the intent form to open a real session and land on `/live/:intentId`.
 * Defaults target the EU jurisdiction, which routes the reference-backend replay to the
 * `mica-threshold-crossing` fixture (threshold → verified rationale → lead
 * positions → advisory auditor finding). Returns the new intent id.
 */
async function createLiveSession(page: Page): Promise<string> {
  await page.goto('/live');
  await page.getByRole('button', { name: /go live/i }).click();
  await page.waitForURL(/\/live\/[^/]+$/, { timeout: 15_000 });
  const id = new URL(page.url()).pathname.split('/').pop();
  expect(id, 'intent id in URL').toBeTruthy();
  return id as string;
}

test('live-session page mounts within cold-start tolerance', async ({ page }) => {
  const mountStart = Date.now();
  await page.goto(`/live/${TEST_INTENT_ID}`);
  await expect(page.locator('main, [role="main"], body')).toBeVisible({ timeout: 3_000 });
  expect(Date.now() - mountStart).toBeLessThan(3_000);
});

test('websocket connects within 10s after going live', async ({ page }) => {
  const wsPromise = page.waitForEvent('websocket', { timeout: 10_000 });
  await createLiveSession(page);
  const ws = await wsPromise;
  expect(ws.url()).toMatch(/(\/v2\/ws\/trade\/|intent_id=)/);
});

test('threshold card appears within 30s from reference-backend replay', async ({ page }) => {
  await createLiveSession(page);
  await expect(
    page.locator('[data-testid="threshold-card"], article').first()
  ).toBeVisible({ timeout: 30_000 });
});

test('org panel renders a lead position and an auditor finding after replay', async ({ page }) => {
  await createLiveSession(page);

  // The Org panel is keyed off the verified crossing. The mica fixture emits a
  // compliance lead position + risk lead position + an advisory auditor finding
  // strictly after `rationale_verified`, so they land later than the first card.
  const org = page.getByRole('region', { name: /agent org/i });
  await expect(org).toBeVisible({ timeout: 30_000 });

  // A lead position (compliance) renders with its label.
  await expect(org.getByText(/lead compliance/i)).toBeVisible({ timeout: 30_000 });

  // An auditor finding renders as an advisory FLAG (not a retraction).
  const advisory = org.getByTestId('auditor-finding-advisory').first();
  await expect(advisory).toBeVisible({ timeout: 30_000 });
  await expect(advisory).toContainText(/advisory flag/i);
});

test('live-session page has no axe a11y violations', async ({ page }) => {
  await createLiveSession(page);
  // Scan the stable, fully-populated state: wait until the replay has produced a
  // threshold card AND the Org panel's lead position. Scanning earlier races the
  // transient pre-crossing empty states, which is not what this asserts.
  const org = page.getByRole('region', { name: /agent org/i });
  await expect(page.locator('article').first()).toBeVisible({ timeout: 30_000 });
  await expect(org.getByText(/lead compliance/i)).toBeVisible({ timeout: 30_000 });
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
