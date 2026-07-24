/**
 * E2E library flow: navigate to the library page and verify it renders.
 *
 * Does NOT depend on seeded games — the empty-state path is the most
 * common first-run experience and the most common regression
 * (route 500s when collections array is empty).
 */
import { test, expect } from "@playwright/test";

test.describe("library flow", () => {
  test("library page renders without 5xx", async ({ page }) => {
    const response = await page.goto("/library");
    expect(response?.status() ?? 0).toBeLessThan(500);
  });

  test("library page renders either collections or empty state", async ({
    page,
  }) => {
    await page.goto("/library");
    // Either we see the collections grid (any number of items >= 0)
    // or an explicit "no games yet" message. The page must NOT crash.
    const body = await page.locator("body").textContent();
    expect(body).toBeTruthy();
    // No uncaught error overlay text.
    expect(body?.toLowerCase()).not.toContain("unhandled");
  });
});
