import { test, expect } from "@playwright/test";

// Smoke spec — exists to unblock CI. Playwright's test runner exits 1 when
// no tests match the testDir glob; this single spec keeps the green-rail
// stable for port/quality-assets. Phase 2 (separate PR) adds the real
// auth-flow + game-library E2E suite (see hyperplan bundle I3 — desktop
// is out of scope, web is the target).
//
// What this covers:
//   - Nuxt SSR Nitro stack reachable (port 4000, dev server)
//   - Root route resolves to either 200 (auth'd landing) or 3xx redirect
//     to /auth/login — the auth-gated baseline. No DB deps required
//     for routing itself; DB deps hit the integration suite, not smoke.
test("app root loads or redirects to /auth/login", async ({ page }) => {
  const response = await page.goto("/");
  expect(response, "navigated to / should produce a response").not.toBeNull();
  const status = response!.status();
  expect(status, "expected 2xx / 3xx from root route").toBeGreaterThanOrEqual(
    200,
  );
  expect(status, "expected < 400 from root route").toBeLessThan(400);
  // After load, URL should be either root (auth'd) or /auth/login (unauth'd).
  const finalUrl = page.url();
  const isRoot = new URL(finalUrl).pathname === "/";
  const isLogin = new URL(finalUrl).pathname.startsWith("/auth");
  expect(
    isRoot || isLogin,
    `expected root or /auth/* path, got ${finalUrl}`,
  ).toBe(true);
});
