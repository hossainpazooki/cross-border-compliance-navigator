import { test, expect } from '@playwright/test';

/**
 * Live ATLAS verification — DeskHome chip, in a real browser.
 *
 * Runs only when COMPASS is served with live verification ON
 * (NEXT_PUBLIC_USE_WASM_VERIFY=true + NEXT_PUBLIC_ATLAS_REGISTRY_URL pointed at a
 * running `ke serve`). Proves the chip LEAVES snapshot mode and settles on a live
 * ADR-0019 verdict in the browser (not the static "Not verified (snapshot)").
 *
 * Guarded by ATLAS_LIVE_E2E so it is inert in the normal preview suite. Boot:
 *   PORT=9999 bash ../regulatory-rule-engine/scripts/serve-published-registry.sh   # registry
 *   NEXT_PUBLIC_USE_WASM_VERIFY=true \
 *   NEXT_PUBLIC_ATLAS_REGISTRY_URL=http://127.0.0.1:9999 npm run dev               # COMPASS :5173
 *   ATLAS_LIVE_E2E=1 PLAYWRIGHT_BASE_URL=http://localhost:5173 npx playwright test desk-live-verify
 */
test.skip(!process.env.ATLAS_LIVE_E2E, 'live-verify E2E: set ATLAS_LIVE_E2E with a running registry + COMPASS');

test('DeskHome provenance chip settles on a live verdict (leaves snapshot mode)', async ({ page }) => {
  await page.goto('/desk');

  const card = page.getByTestId('provenance-mica_2023');
  await expect(card).toBeVisible();

  // The signed mica_2023 artifacts must NOT remain in the flag-off snapshot state.
  await expect(card.getByText('Not verified (snapshot)').first()).toHaveCount(0, { timeout: 15_000 });

  // ...and must settle on a definitive live verdict (no longer "Verifying…").
  const settled = card
    .getByText(/Verified — Published|Rejected|Blocked — not Published|Blocked — not registered|Unknown — registry unavailable/)
    .first();
  await expect(settled).toBeVisible({ timeout: 15_000 });

  // Surface the actual rendered verdict in the test output (honest evidence of
  // WHICH live state the live path produced for this registry/snapshot pair).
  console.log('[live-verify] DeskHome chip settled on:', await settled.textContent());
});
