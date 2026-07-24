/**
 * E2E game-detail flow: navigate to /games/[id] and verify the route
 * responds cleanly.
 *
 * With no game in DB, the page should 404 (or render a "not found"
 * state) — never 500. This is the simplest valid behavior for an
 * unseeded test DB.
 */
import { test, expect } from "@playwright/test";

test.describe("game detail", () => {
  test("/games/[id] responds without 5xx for any id", async ({ page }) => {
    const response = await page.goto("/games/nonexistent-game-id-12345");
    // 200 with empty state, 404, or auth redirect — anything except 5xx.
    expect(response?.status() ?? 0).toBeLessThan(500);
  });

  test("/games/[id] does not crash the browser on unknown id", async ({
    page,
  }) => {
    await page.goto("/games/another-bogus-id-67890");
    const body = await page.locator("body").textContent();
    expect(body).toBeTruthy();
  });
});
