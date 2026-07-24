/**
 * E2E smoke test: verifies the Playwright config is internally consistent
 * and the dev server responds at the configured baseURL.
 *
 * This is the lowest-cost E2E coverage — it doesn't exercise real user
 * flows, but it catches the most common first-run failure (port mismatch
 * between Playwright config and nuxt.config.ts devServer.port).
 *
 * Real user-flow tests will be added in subsequent commits.
 */
import { test, expect } from "@playwright/test";

test.describe("E2E smoke", () => {
  test("baseURL is reachable", async ({ page }) => {
    const response = await page.goto("/");
    // 200 OK for any rendered page, or 302 for an auth redirect (both
    // prove the server is up and responding).
    expect([200, 302, 307]).toContain(response?.status() ?? 0);
  });
});
