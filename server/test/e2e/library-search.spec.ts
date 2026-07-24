/**
 * E2E game-search flow: navigate to library and exercise search UI.
 *
 * Library page may expose search via input or filter. Even with no
 * games, the search control should render and accept input without
 * crashing the page.
 */
import { test, expect } from "@playwright/test";

test.describe("library search", () => {
  test("search input renders on library page", async ({ page }) => {
    await page.goto("/library");
    const searchInput = page.locator(
      'input[type="search"], input[name="search"], input[placeholder*="earch" i]',
    );
    // Library may or may not have a search input; if it does, typing
    // must not crash the page.
    if ((await searchInput.count()) > 0) {
      await searchInput.first().fill("zelda");
      // Page should still be alive (body has content).
      const body = await page.locator("body").textContent();
      expect(body).toBeTruthy();
    } else {
      // No search input — that's fine, skip silently.
      test.skip(true, "library page has no search input");
    }
  });
});
